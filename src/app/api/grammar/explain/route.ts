import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { evaluate, getBucketKey } from '@/lib/entitlements/evaluator';
import type { EvalContext } from '@/lib/entitlements/evaluator';
import type { FeatureId } from '@/types/FeatureId';
import { AIService } from '@/lib/ai/AIService';
import { getCachedExplanation, setCachedExplanation } from '@/lib/ai/cache/GrammarExplanationCache';

const FEATURE_ID = 'grammar_explanations' as FeatureId;
const MAX_SENTENCE_LENGTH = 500;
const MAX_CONTEXT_LENGTH = 1200;
const MAX_SURROUNDING_SENTENCES = 5;

function sanitizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, MAX_SURROUNDING_SENTENCES);
  return items.length > 0 ? items : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const sentence = sanitizeString(body?.sentence);
    const context = sanitizeString(body?.context);
    const focusQuestion = sanitizeString(body?.focusQuestion);
    const title = sanitizeString(body?.title);
    const surroundingSentences = sanitizeStringArray(body?.surroundingSentences);
    const jlptLevel = sanitizeString(body?.jlptLevel);

    if (!sentence) {
      return NextResponse.json({
        success: false,
        error: 'SENTENCE_REQUIRED'
      }, { status: 400 });
    }

    if (sentence.length > MAX_SENTENCE_LENGTH) {
      return NextResponse.json({
        success: false,
        error: 'SENTENCE_TOO_LONG'
      }, { status: 400 });
    }

    if (context && context.length > MAX_CONTEXT_LENGTH) {
      return NextResponse.json({
        success: false,
        error: 'CONTEXT_TOO_LONG'
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

    const nowUtc = new Date().toISOString();
    const bucketKey = getBucketKey(FEATURE_ID, session.uid, nowUtc);
    const usageRef = adminDb.collection('users').doc(session.uid).collection('usage').doc(bucketKey);
    const usageDoc = await usageRef.get();
    const currentUsage = usageDoc.data()?.[FEATURE_ID] || 0;

    const evalContext: EvalContext = {
      userId: session.uid,
      plan: plan as any,
      usage: { [FEATURE_ID]: currentUsage },
      nowUtcISO: nowUtc
    };

    const decision = evaluate(FEATURE_ID, evalContext);
    if (!decision.allow) {
      return NextResponse.json({
        success: false,
        error: 'LIMIT_REACHED',
        decision
      }, { status: 403 });
    }

    const computeRemaining = (limit: number | undefined) => {
      if (limit === -1) return -1;
      if (typeof limit !== 'number') return decision.remaining;
      return Math.max(0, limit - (currentUsage + 1));
    };

    const cached = await getCachedExplanation(sentence, context);
    if (cached) {
      await usageRef.set({
        [FEATURE_ID]: currentUsage + 1,
        lastUpdated: nowUtc
      }, { merge: true });

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
    const aiResponse = await aiService.explainGrammarSentence({
      sentence,
      context,
      title,
      surroundingSentences,
      focusQuestion
    }, {
      jlptLevel: jlptLevel || userData?.profile?.jlptLevel || 'N5'
    });

    if (!aiResponse.success || !aiResponse.data) {
      return NextResponse.json({
        success: false,
        error: aiResponse.error || 'AI_PROCESSING_FAILED'
      }, { status: 500 });
    }

    await setCachedExplanation(sentence, context, aiResponse.data);

    await usageRef.set({
      [FEATURE_ID]: currentUsage + 1,
      lastUpdated: nowUtc
    }, { merge: true });

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
  } catch (error) {
    console.error('[GrammarExplainAPI] Unexpected error', error);
    return NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
