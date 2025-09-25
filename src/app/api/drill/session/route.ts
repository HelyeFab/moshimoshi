/**
 * API Route: /api/drill/session
 * Manages drill sessions - create, retrieve, update
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireAuth } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { evaluate, getBucketKey } from '@/lib/entitlements/evaluator';
import type { EvalContext } from '@/lib/entitlements/evaluator';
import type { FeatureId } from '@/types/FeatureId';
import type { DrillSession, DrillQuestion, JapaneseWord } from '@/types/drill';
import { WordUtils } from '@/lib/drill/word-utils';
import { QuestionGenerator } from '@/lib/drill/question-generator';
import { getStorageDecision, createStorageResponse } from '@/lib/api/storage-helper';

/**
 * GET /api/drill/session
 * Get current drill session or session stats
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check storage decision
    const decision = await getStorageDecision(session);

    // Free users don't have Firebase access - return empty
    if (!decision.shouldWriteToFirebase) {
      return NextResponse.json({
        success: true,
        data: {
          sessions: [],
          storage: {
            location: 'local',
            message: 'Drill history is stored locally for free users'
          }
        }
      });
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (sessionId) {
      // Get specific session (premium only)
      const sessionDoc = await adminDb!
        .collection('drill_sessions')
        .doc(sessionId)
        .get();

      if (!sessionDoc.exists) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      const sessionData = sessionDoc.data() as DrillSession;

      // Verify ownership
      if (sessionData.userId !== session.uid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      return NextResponse.json({
        success: true,
        data: { session: sessionData }
      });
    }

    // Get user's recent sessions (premium only)
    const recentSessions = await adminDb!
      .collection('drill_sessions')
      .where('userId', '==', session.uid)
      .orderBy('startedAt', 'desc')
      .limit(10)
      .get();

    const sessions = recentSessions.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      success: true,
      data: { sessions }
    });
  } catch (error) {
    console.error('Error in GET /api/drill/session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/drill/session
 * Create a new drill session
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const { mode, wordTypeFilter, selectedLists, questionsCount } = body;

    // Get fresh user data for entitlements
    const userDoc = await adminDb!.collection('users').doc(session.uid).get();
    const userData = userDoc.data();
    const plan = userData?.subscription?.plan || 'free';

    // Check entitlement
    const nowUtc = new Date().toISOString();
    const bucketKey = getBucketKey('conjugation_drill' as FeatureId, session.uid, nowUtc);

    // Get current usage
    const usageRef = adminDb!.collection('usage').doc(session.uid);
    const usageDoc = await usageRef.get();
    const usageData = usageDoc.data() || {};
    const currentUsage = usageData[bucketKey] || 0;

    // Build full usage object (evaluator expects all features)
    const usage: Record<string, number> = {
      hiragana_practice: 0,
      katakana_practice: 0,
      kanji_browser: 0,
      custom_lists: 0,
      save_items: 0,
      youtube_shadowing: 0,
      media_upload: 0,
      stall_layout_customization: 0,
      todos: 0,
      conjugation_drill: currentUsage
    };

    // Evaluate entitlement
    const evalContext: EvalContext = {
      userId: session.uid,
      plan: plan as any,
      usage: usage as any,
      nowUtcISO: nowUtc
    };

    const decision = evaluate('conjugation_drill' as FeatureId, evalContext);

    if (!decision.allow) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'LIMIT_REACHED',
          message: decision.reason || 'Daily drill limit reached'
        },
        usage: {
          current: currentUsage,
          limit: decision.limit,
          remaining: 0
        }
      }, { status: 403 });
    }

    // Generate questions based on mode
    let questions: DrillQuestion[] = [];

    if (mode === 'random') {
      // Use fallback words for now (would normally fetch from a word API)
      const practiceWords = WordUtils.getCommonPracticeWords();
      const filteredWords = WordUtils.filterByType(practiceWords, wordTypeFilter);
      // Use custom question count if provided, otherwise use plan defaults
      const questionsPerSession = questionsCount || getQuestionsPerSession(plan);
      questions = QuestionGenerator.generateQuestions(filteredWords, 3, questionsPerSession);
    } else if (mode === 'lists' && selectedLists?.length > 0) {
      // Fetch words from user's lists
      const listWords: JapaneseWord[] = [];

      for (const listId of selectedLists) {
        const listDoc = await adminDb!
          .collection('users')
          .doc(session.uid)
          .collection('lists')
          .doc(listId)
          .get();

        if (listDoc.exists) {
          const items = listDoc.data()?.items || [];
          // Transform items to JapaneseWord format
          const words = items.map((item: any) => ({
            id: item.id,
            kanji: item.kanji || item.word,
            kana: item.kana || item.reading,
            meaning: item.meaning || item.english,
            type: WordUtils.detectWordTypeByPattern({
              kanji: item.kanji || item.word,
              kana: item.kana || item.reading,
            } as JapaneseWord),
            jlpt: item.jlpt,
          }));

          listWords.push(...WordUtils.filterConjugableWords(words));
        }
      }

      if (listWords.length > 0) {
        const filteredWords = WordUtils.filterByType(listWords, wordTypeFilter);
        // Use custom question count if provided, otherwise use plan defaults
        const questionsPerSession = questionsCount || getQuestionsPerSession(plan);
        questions = QuestionGenerator.generateQuestions(filteredWords, 3, questionsPerSession);
      }
    }

    if (questions.length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NO_QUESTIONS',
          message: 'Could not generate questions with selected criteria'
        }
      }, { status: 400 });
    }

    // Create session
    const sessionId = `drill_${session.uid}_${Date.now()}`;
    const drillSession: DrillSession = {
      id: sessionId,
      userId: session.uid,
      questions,
      currentQuestionIndex: 0,
      score: 0,
      startedAt: nowUtc,
      mode,
      wordTypeFilter
    };

    // Check storage decision
    const storageDecision = await getStorageDecision(session);

    // Only save to Firebase for premium users
    if (storageDecision.shouldWriteToFirebase) {
      console.log('[Drill API] Premium user - saving to Firebase:', session.uid);
      await adminDb!
        .collection('drill_sessions')
        .doc(sessionId)
        .set(drillSession);
    } else {
      console.log('[Drill API] Free user - session will be stored locally:', session.uid);
    }

    // Increment usage
    await usageRef.set({
      [bucketKey]: currentUsage + 1,
      lastUpdated: nowUtc
    }, { merge: true });

    return NextResponse.json({
      success: true,
      data: {
        session: drillSession,
        usage: {
          current: currentUsage + 1,
          limit: decision.limit || 0,
          remaining: (decision.limit || 0) - (currentUsage + 1)
        }
      }
    });
  } catch (error) {
    console.error('Error in POST /api/drill/session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/drill/session
 * Update drill session (answer submission, completion)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const { sessionId, action, answer } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Get session
    const sessionRef = adminDb!.collection('drill_sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionData = sessionDoc.data() as DrillSession;

    // Verify ownership
    if (sessionData.userId !== session.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (action === 'answer') {
      // Process answer
      const currentQuestion = sessionData.questions[sessionData.currentQuestionIndex];
      const isCorrect = answer === currentQuestion.correctAnswer;

      if (isCorrect) {
        sessionData.score++;
      }

      // Move to next question or complete
      if (sessionData.currentQuestionIndex < sessionData.questions.length - 1) {
        sessionData.currentQuestionIndex++;
      } else {
        // Session complete
        sessionData.completedAt = new Date().toISOString();
      }

      // Update session
      await sessionRef.update(sessionData);

      return NextResponse.json({
        success: true,
        data: {
          isCorrect,
          currentScore: sessionData.score,
          isComplete: !!sessionData.completedAt,
          session: sessionData
        }
      });
    }

    if (action === 'complete') {
      // Mark session as complete
      const completedAt = new Date().toISOString();
      const finalScore = body.finalScore || sessionData.score;
      const accuracy = body.accuracy || (finalScore / sessionData.questions.length) * 100;

      // Get user's plan to determine storage
      const userDoc = await adminDb!.collection('users').doc(session.uid).get();
      const userData = userDoc.data();
      const plan = userData?.subscription?.plan || 'free';

      // Only update Firebase for premium users
      if (plan === 'premium_monthly' || plan === 'premium_yearly') {
        // Update session with completion data
        await sessionRef.update({
          completedAt,
          score: finalScore,
          accuracy
        });

        // Update user's drill statistics
        const userRef = adminDb!.collection('users').doc(session.uid);
        const batch = adminDb!.batch();

        // Update drill statistics
        batch.update(userRef, {
          'drillStats.totalSessions': FieldValue.increment(1),
          'drillStats.totalQuestions': FieldValue.increment(sessionData.questions.length),
          'drillStats.totalCorrect': FieldValue.increment(finalScore),
          'drillStats.lastSessionAt': completedAt,
          'drillStats.updatedAt': FieldValue.serverTimestamp()
        });

        // Track drill session in user's progress
        batch.update(userRef, {
          'progress.drillSessions': FieldValue.increment(1),
          'progress.lastDrillAt': completedAt
        });

        // Add to drill history subcollection for detailed tracking
        const historyRef = userRef.collection('drill_history').doc();
        batch.set(historyRef, {
          sessionId,
          completedAt,
          score: finalScore,
          totalQuestions: sessionData.questions.length,
          accuracy,
          mode: sessionData.mode,
          wordTypeFilter: sessionData.wordTypeFilter,
          timestamp: FieldValue.serverTimestamp()
        });

        // If perfect score, track it
        if (accuracy === 100) {
          batch.update(userRef, {
            'drillStats.perfectSessions': FieldValue.increment(1)
          });
        }

        // Update best accuracy if this is a new record
        const currentBestAccuracy = userData?.drillStats?.bestAccuracy || 0;
        if (accuracy > currentBestAccuracy) {
          batch.update(userRef, {
            'drillStats.bestAccuracy': accuracy
          });
        }

        // Commit all updates
        await batch.commit();
      }
      // Free users: stats are handled client-side in IndexedDB

      return NextResponse.json({
        success: true,
        data: {
          session: {
            ...sessionData,
            completedAt,
            score: finalScore,
            accuracy
          },
          stats: {
            accuracy,
            questionsAnswered: sessionData.questions.length,
            correctAnswers: finalScore
          }
        }
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in PUT /api/drill/session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get questions per session based on plan
 */
function getQuestionsPerSession(plan: string): number {
  const limits = {
    guest: 5,
    free: 10,
    premium_monthly: 30,
    premium_yearly: 30
  };
  return limits[plan as keyof typeof limits] || 10;
}