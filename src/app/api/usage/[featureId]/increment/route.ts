/**
 * Feature Usage Increment API
 * Handles POST /api/usage/[featureId]/increment
 *
 * This route increments usage and returns the entitlement decision
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { evaluate, getBucketKey } from '@/lib/entitlements/evaluator';
import type { EvalContext } from '@/lib/entitlements/evaluator';
import { FeatureId } from '@/types/FeatureId';
import { FEATURE_IDS } from '@/types/FeatureId';

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
    let existingCounts: Record<string, number> = {};

    if (userId && adminDb) {
      try {
        const usageRef = adminDb.collection('users').doc(userId).collection('usage').doc(bucketKey);
        const usageDoc = await usageRef.get();
        const usageData = (usageDoc.data() as Record<string, unknown> | undefined) || {};
        const counts = (usageData.counts as Record<string, number> | undefined) || {};
        existingCounts = counts;
        currentUsage = (usageData[featureId] as number | undefined) ?? counts[featureId] ?? 0;
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

    // 7. If allowed, increment usage
    if (decision.allow && userId && adminDb) {
      try {
        const usageRef = adminDb.collection('users').doc(userId).collection('usage').doc(bucketKey);
        await usageRef.set({
          [featureId]: currentUsage + 1,
          counts: {
            ...existingCounts,
            [featureId]: currentUsage + 1
          },
          updatedAt: nowUtc,
          lastUpdated: nowUtc
        }, { merge: true });

        // Update decision with new usage
        const limit = decision.limit ?? 0;
        decision.remaining = limit === -1 ? -1 : Math.max(0, limit - (currentUsage + 1));
      } catch (error) {
        console.error('Error updating usage:', error);
      }
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
    return NextResponse.json(decision);

  } catch (error) {
    console.error('Error in usage increment API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
