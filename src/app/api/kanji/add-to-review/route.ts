import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { evaluateFeatureAccess, getUserPlan } from '@/lib/entitlements/server';

// Helper for database availability check
function getDb() {
  if (!adminDb) {
    throw new Error('Database not available');
  }
  return adminDb;
}

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

    const db = getDb();

    const body = await request.json();
    const { kanjiIds } = body;

    if (!kanjiIds || !Array.isArray(kanjiIds) || kanjiIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: kanjiIds array required' },
        { status: 400 }
      );
    }

    const nowUtcISO = new Date().toISOString();
    const plan = await getUserPlan(session.uid);
    const { decision, currentUsage } = await evaluateFeatureAccess({
      featureId: 'kanji_browser',
      userId: session.uid,
      plan,
      nowUtcISO,
      increment: true,
      incrementBy: kanjiIds.length,
    });

    if (!decision.allow) {
      return NextResponse.json(
        {
          error: decision.reason === 'limit_reached' ? 'Daily limit reached' : 'Access denied',
          limit: decision.limit,
          remaining: decision.remaining === -1 ? 'unlimited' : decision.remaining,
          decision
        },
        { status: decision.reason === 'limit_reached' ? 429 : 403 }
      );
    }

    // Add kanji to review queue
    const batch = db.batch();
    const timestamp = FieldValue.serverTimestamp();

    for (const kanjiId of kanjiIds) {
      // Add to review queue
      const queueRef = db
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
      const progressRef = db
        .collection('users')
        .doc(session.uid)
        .collection('progress')
        .doc('kanji');

      batch.set(progressRef, {
        userId: session.uid,
        contentType: 'kanji',
        [`items.${kanjiId}.addedToReview`]: true,
        [`items.${kanjiId}.addedToReviewAt`]: timestamp,
        lastUpdated: timestamp
      }, { merge: true });
    }

    // Log the action
    const logRef = db.collection('logs').doc();
    batch.set(logRef, {
      action: 'kanji_added_to_review',
      userId: session.uid,
      kanjiCount: kanjiIds.length,
      timestamp,
      source: 'kanji_browser'
    });

    await batch.commit();

    // Track achievement progress
    await db
      .collection('users')
      .doc(session.uid)
      .collection('achievements')
      .doc('data')
      .set({
        kanjiAddedToReview: FieldValue.increment(kanjiIds.length),
        lastUpdated: timestamp
      }, { merge: true });

    return NextResponse.json({
      success: true,
      message: `Added ${kanjiIds.length} kanji to review queue`,
      added: kanjiIds.length,
      dailyUsage: currentUsage + kanjiIds.length,
      dailyLimit: decision.limit === -1 ? 'unlimited' : decision.limit,
      remaining: decision.remaining === -1 ? 'unlimited' : decision.remaining
    });

  } catch (error) {
    console.error('[Add to Review] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add kanji to review', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
