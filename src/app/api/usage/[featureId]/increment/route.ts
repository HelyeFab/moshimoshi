/**
 * Feature Usage Increment API
 * Handles POST /api/usage/[featureId]/increment
 *
 * This route increments usage and returns the entitlement decision
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, FieldValue } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { evaluate, getBucketKey } from '@/lib/entitlements/evaluator';
import type { EvalContext } from '@/lib/entitlements/evaluator';
import { FeatureId } from '@/types/FeatureId';
import { FEATURE_IDS } from '@/types/FeatureId';

const UNIQUE_ITEM_FIELDS: Partial<Record<FeatureId, string>> = {
  kanji_mood_board: 'kanji_mood_board_boards',
  news: 'news_items',
  books: 'books_items',
  comics: 'comics_items',
  kanji_connection: 'kanji_connection_items',
  textbook_vocabulary: 'textbook_vocabulary_items',
  story: 'story_items',
  kanji_drawing_practice: 'kanji_drawing_practice_items'
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    // 1. Validate feature ID
    const { featureId: featureIdParam } = await params;
    const featureId = featureIdParam as FeatureId;

    if (!FEATURE_IDS.includes(featureId)) {
      return NextResponse.json(
        { error: 'Invalid feature ID' },
        { status: 400 }
      );
    }

    // 2. Parse request body (optional idempotency)
    const body = await request.json().catch(() => ({}));
    const idempotencyKey =
      typeof body?.idempotencyKey === 'string' && body.idempotencyKey.trim().length > 0
        ? body.idempotencyKey.trim()
        : null;
    const itemId =
      typeof body?.itemId === 'string' && body.itemId.trim().length > 0
        ? body.itemId.trim()
        : typeof body?.boardId === 'string' && body.boardId.trim().length > 0
          ? body.boardId.trim()
          : null;

    // 3. Get session and user data
    const session = await getSession();
    let userId: string | null = null;
    let plan: string = 'guest';

    if (session) {
      userId = session.uid;

      // 3. Get fresh user data from Firestore (don't trust session.tier)
      if (adminDb) {
        try {
          const userDoc = await adminDb.collection('users').doc(userId).get();
          const userData = userDoc.data();
          plan = userData?.subscription?.plan || 'free';

          console.log(`[increment] User ${userId} has plan: ${plan}`);
        } catch (error) {
          console.error('Error fetching user data:', error);
          plan = 'free';
        }
      }
    }

    // 4. Idempotency check (prevent duplicate increments)
    let idempotencyRef: FirebaseFirestore.DocumentReference | null = null;
    if (userId && adminDb && idempotencyKey) {
      const ref = adminDb.collection('idempotency').doc(`${userId}_${featureId}_${idempotencyKey}`);
      idempotencyRef = ref;
      const idempotencyDoc = await ref.get();
      if (idempotencyDoc.exists) {
        const cached = idempotencyDoc.data() as { decision?: unknown };
        if (cached?.decision) {
          return NextResponse.json(cached.decision);
        }
        return NextResponse.json(idempotencyDoc.data());
      }
    }

    // 5. Get current usage
    const nowUtc = new Date().toISOString();
    const bucketKey = getBucketKey(featureId, userId || 'guest', nowUtc);
    let currentUsage = 0;
    let uniqueItems: string[] | null = null;

    if (userId && adminDb) {
      try {
        const usageRef = adminDb.collection('users').doc(userId).collection('usage').doc(bucketKey);
        const usageDoc = await usageRef.get();
        const usageData = (usageDoc.data() as Partial<Record<FeatureId, number>> | undefined) || {};
        currentUsage = usageData[featureId] ?? 0;
        const uniqueField = UNIQUE_ITEM_FIELDS[featureId];
        const items = uniqueField && Array.isArray((usageData as any)[uniqueField])
          ? (usageData as any)[uniqueField]
          : null;
        uniqueItems = items;
        if (Array.isArray(items)) {
          currentUsage = items.length;
        }
      } catch (error) {
        console.error('Error fetching usage:', error);
      }
    }

    // 6. Evaluate entitlement
    const evalContext: EvalContext = {
      userId: userId || 'guest',
      plan: plan as any,
      usage: { [featureId]: currentUsage },
      nowUtcISO: nowUtc
    };

    const decision = evaluate(featureId, evalContext);
    const isRepeat =
      !!itemId &&
      (Array.isArray(uniqueItems) && uniqueItems.includes(itemId));

    // 7. If allowed, increment usage
    let didIncrement = false;
    if (decision.allow && userId && adminDb && !isRepeat) {
      try {
        const usageRef = adminDb.collection('users').doc(userId).collection('usage').doc(bucketKey);
        const uniqueField = UNIQUE_ITEM_FIELDS[featureId];
        if (uniqueField && itemId) {
          await usageRef.set({
            [featureId]: currentUsage + 1,
            [uniqueField]: FieldValue.arrayUnion(itemId),
            updatedAt: nowUtc,
            lastUpdated: nowUtc
          }, { merge: true });
        } else {
          await usageRef.set({
            [featureId]: currentUsage + 1,
            updatedAt: nowUtc,
            lastUpdated: nowUtc
          }, { merge: true });
        }

        // Update decision with new usage
        const limit = decision.limit ?? 0;
        decision.remaining = limit === -1 ? -1 : Math.max(0, limit - (currentUsage + 1));
        didIncrement = true;
      } catch (error) {
        console.error('Error updating usage:', error);
      }
    }
    if (isRepeat) {
      decision.allow = true;
      decision.reason = 'ok';
    }

    // 8. Store idempotency decision
    if (userId && adminDb && idempotencyKey && idempotencyRef) {
      try {
        await idempotencyRef.set({
          decision,
          createdAt: nowUtc
        });
      } catch (error) {
        console.error('Error storing idempotency record:', error);
      }
    }

    // 9. Return decision
    return NextResponse.json({ ...decision, incremented: didIncrement });

  } catch (error) {
    console.error('Error in usage increment API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
