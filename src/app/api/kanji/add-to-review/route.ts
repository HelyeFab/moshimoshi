import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { evaluate, getTodayBucket } from '@/lib/entitlements/evaluator';
import { EvalContext } from '@/types/entitlements';

/**
 * POST /api/kanji/add-to-review
 * Add kanji to the review queue with entitlement checks
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { kanjiIds } = body;

    if (!kanjiIds || !Array.isArray(kanjiIds) || kanjiIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: kanjiIds array required' },
        { status: 400 }
      );
    }

    // Get user data and current usage for entitlement check
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const userData = userDoc.data();
    const subscription = userData?.subscription;

    const today = getTodayBucket(new Date().toISOString());
    const usageRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('usage')
      .doc(today);

    const usageDoc = await usageRef.get();
    const currentUsage = usageDoc.data()?.kanji_browser || 0;

    // Build evaluation context and check entitlements
    const evalContext: EvalContext = {
      userId: session.uid,
      plan: subscription?.plan || 'free',
      usage: { kanji_browser: currentUsage },
      nowUtcISO: new Date().toISOString()
    };

    const decision = evaluate('kanji_browser', evalContext);

    // Check if adding these kanji would exceed the limit
    if (!decision.allow || (decision.remaining !== -1 && kanjiIds.length > decision.remaining)) {
      return NextResponse.json(
        {
          error: decision.reason === 'limit_reached' ? 'Daily limit exceeded' : 'Access denied',
          limit: decision.limit,
          current: currentUsage,
          requested: kanjiIds.length,
          remaining: decision.remaining === -1 ? 'unlimited' : decision.remaining
        },
        { status: 429 }
      );
    }

    // Add kanji to review queue
    const batch = adminDb.batch();
    const timestamp = FieldValue.serverTimestamp();

    for (const kanjiId of kanjiIds) {
      // Add to review queue
      const queueRef = adminDb
        .collection('users')
        .doc(session.uid)
        .collection('review_queue')
        .doc(kanjiId);

      batch.set(queueRef, {
        contentId: kanjiId,
        contentType: 'kanji',
        state: 'new',
        interval: 0,
        easeFactor: 2.5,
        nextReviewDate: timestamp,
        addedFrom: 'kanji_browser',
        addedAt: timestamp,
        consecutiveCorrect: 0,
        totalReviews: 0
      }, { merge: true });

      // Update progress to mark as added to review
      const progressRef = adminDb
        .collection('users')
        .doc(session.uid)
        .collection('progress')
        .doc('kanji');

      batch.set(progressRef, {
        [`items.${kanjiId}.addedToReview`]: true,
        [`items.${kanjiId}.addedToReviewAt`]: timestamp,
        lastUpdated: timestamp
      }, { merge: true });
    }

    // Update usage counter
    batch.set(usageRef, {
      kanji_browser: FieldValue.increment(kanjiIds.length),
      lastUpdated: timestamp
    }, { merge: true });

    // Log the action
    const logRef = adminDb.collection('logs').doc();
    batch.set(logRef, {
      action: 'kanji_added_to_review',
      userId: session.uid,
      kanjiCount: kanjiIds.length,
      timestamp,
      source: 'kanji_browser'
    });

    await batch.commit();

    // Track achievement progress
    await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('achievements')
      .doc('data')
      .set({
        kanjiAddedToReview: FieldValue.increment(kanjiIds.length),
        lastUpdated: timestamp
      }, { merge: true });

    // Re-evaluate after update to get new remaining count
    const newUsage = currentUsage + kanjiIds.length;
    const newContext: EvalContext = {
      ...evalContext,
      usage: { kanji_browser: newUsage }
    };
    const newDecision = evaluate('kanji_browser', newContext);

    return NextResponse.json({
      success: true,
      message: `Added ${kanjiIds.length} kanji to review queue`,
      added: kanjiIds.length,
      dailyUsage: newUsage,
      dailyLimit: decision.limit === -1 ? 'unlimited' : decision.limit,
      remaining: newDecision.remaining === -1 ? 'unlimited' : newDecision.remaining
    });

  } catch (error) {
    console.error('[Add to Review] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add kanji to review', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}