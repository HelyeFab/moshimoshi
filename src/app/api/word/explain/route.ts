import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb, FieldValue } from '@/lib/firebase/admin';
import { evaluate, getBucketKey } from '@/lib/entitlements/evaluator';
import type { EvalContext } from '@/lib/entitlements/evaluator';
import type { FeatureId } from '@/types/FeatureId';
import { AIService } from '@/lib/ai/AIService';
import type { WordExplanation } from '@/lib/ai/types';
import { getCachedWordExplanation, setCachedWordExplanation } from '@/lib/ai/cache/WordExplanationCache';

// Feature IDs for different lookup types
const WORD_LOOKUP_FEATURE_ID = 'word_lookup' as FeatureId; // Vocabulary browser (15/day for free)
const MAX_WORD_LENGTH = 100;

function sanitizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeWord(value: string): string {
  let normalized = value.trim();
  try {
    normalized = normalized.normalize('NFKC');
  } catch {
    // ignore
  }
  return normalized.toLowerCase();
}

const CONTENT_COLLECTIONS: Record<string, string> = {
  article: 'news_article_word_explanations',
  book: 'book_word_explanations',
  story: 'story_word_explanations',
  youtube: 'youtube_word_explanations',
  video: 'video_word_explanations',
  comic: 'comic_word_explanations',
  flashcard: 'flashcard_word_explanations',
};

async function upsertContentWordExplanation(
  contentType: string,
  contentId: string,
  explanation: WordExplanation,
  requestedWord?: string
) {
  if (!adminDb) return;

  const collection = CONTENT_COLLECTIONS[contentType];
  if (!collection) return;

  const docRef = adminDb.collection(collection).doc(contentId);
  const docSnap = await docRef.get();
  const existingWords = (docSnap.data()?.words as WordExplanation[]) || [];
  const normalizedTarget = normalizeWord(explanation.word);
  const exists = existingWords.some(w => {
    const surfaceForms = (w as any).surfaceForms as string[] | undefined;
    return (
      normalizeWord(w.word || '') === normalizedTarget ||
      normalizeWord(w.reading || '') === normalizedTarget ||
      (surfaceForms || []).some(sf => normalizeWord(sf) === normalizedTarget)
    );
  });

  if (exists) return;

  const nextSurfaceForms = new Set<string>(explanation.surfaceForms || []);
  if (requestedWord) nextSurfaceForms.add(requestedWord);
  const nextExplanation = {
    ...explanation,
    surfaceForms: Array.from(nextSurfaceForms),
  };

  const nextWords = [...existingWords, nextExplanation];
  await docRef.set(
    {
      words: nextWords,
      wordCount: nextWords.length,
      total: nextWords.length,
      lastUpdated: FieldValue.serverTimestamp(),
      ...(docSnap.exists ? {} : { generatedAt: FieldValue.serverTimestamp() }),
    },
    { merge: true }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const word = sanitizeString(body?.word);
    const context = sanitizeString(body?.context);

    if (!word) {
      return NextResponse.json({
        success: false,
        error: 'WORD_REQUIRED'
      }, { status: 400 });
    }

    if (word.length > MAX_WORD_LENGTH) {
      return NextResponse.json({
        success: false,
        error: 'WORD_TOO_LONG'
      }, { status: 400 });
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'UNAUTHENTICATED'
      }, { status: 401 });
    }

    if (!adminDb) {
      return NextResponse.json({
        success: false,
        error: 'SERVICE_UNAVAILABLE'
      }, { status: 503 });
    }

    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const userData = userDoc.data();
    const plan = userData?.subscription?.plan || 'free';

    // Check if this is a content-based lookup (article, book, story, comic, flashcard)
    // These should have prefetched explanations and don't need quota checks
    const contentId = request.headers.get('x-content-id');
    const contentType = request.headers.get('x-content-type');
    const isContentLookup = !!(contentId && contentType);

    let decision;
    let usageRef;
    let currentUsage = 0;
    const nowUtc = new Date().toISOString();

    // Only check quota for standalone vocabulary lookups (not content-based)
    if (!isContentLookup) {
      // This is a vocabulary browser lookup - check word_lookup quota
      const bucketKey = getBucketKey(WORD_LOOKUP_FEATURE_ID, session.uid, nowUtc);
      usageRef = adminDb.collection('users').doc(session.uid).collection('usage').doc(bucketKey);
      const usageDoc = await usageRef.get();
      currentUsage = usageDoc.data()?.[WORD_LOOKUP_FEATURE_ID] || 0;

      const evalContext: EvalContext = {
        userId: session.uid,
        plan: plan as any,
        usage: { [WORD_LOOKUP_FEATURE_ID]: currentUsage },
        nowUtcISO: nowUtc
      };

      decision = evaluate(WORD_LOOKUP_FEATURE_ID, evalContext);
      if (!decision.allow) {
        return NextResponse.json({
          success: false,
          error: 'LIMIT_REACHED',
          decision
        }, { status: 403 });
      }
    } else {
      // Content lookup - no quota check needed (prefetched content)
      decision = { allow: true, remaining: -1, reason: 'content_prefetched' };
    }

    const computeRemaining = (limit: number | undefined) => {
      if (limit === -1) return -1;
      if (typeof limit !== 'number') return decision.remaining;
      return Math.max(0, limit - (currentUsage + 1));
    };

    const cached = await getCachedWordExplanation(word);
    if (cached) {
      // Only increment usage for standalone lookups
      if (!isContentLookup && usageRef) {
        await usageRef.set({
          [WORD_LOOKUP_FEATURE_ID]: currentUsage + 1,
          lastUpdated: nowUtc
        }, { merge: true });
      }

      if (isContentLookup && contentId && contentType) {
        try {
          await upsertContentWordExplanation(contentType, contentId, cached, word || undefined);
        } catch {
          // Ignore write-back failures
        }
      }

      return NextResponse.json({
        success: true,
        cached: true,
        explanation: cached,
        decision: {
          ...decision,
          remaining: computeRemaining(decision.limit)
        }
      });
    }

    const aiService = AIService.getInstance();
    const aiResponse = await aiService.explainWord({
      word,
      context
    }, {
      jlptLevel: userData?.profile?.jlptLevel || 'N5'
    });

    if (!aiResponse.success || !aiResponse.data) {
      return NextResponse.json({
        success: false,
        error: aiResponse.error || 'AI_PROCESSING_FAILED'
      }, { status: 500 });
    }

    await setCachedWordExplanation(word, aiResponse.data);

    // Only increment usage for standalone lookups
    if (!isContentLookup && usageRef) {
      await usageRef.set({
        [WORD_LOOKUP_FEATURE_ID]: currentUsage + 1,
        lastUpdated: nowUtc
      }, { merge: true });
    }

    if (isContentLookup && contentId && contentType) {
      try {
        await upsertContentWordExplanation(contentType, contentId, aiResponse.data, word || undefined);
      } catch {
        // Ignore write-back failures
      }
    }

    return NextResponse.json({
      success: true,
      cached: false,
      explanation: aiResponse.data,
      usage: aiResponse.usage,
      decision: {
        ...decision,
        remaining: computeRemaining(decision.limit)
      }
    });
  } catch {
    return NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
