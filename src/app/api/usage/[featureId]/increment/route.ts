/**
 * Feature Usage Increment API
 * Handles POST /api/usage/[featureId]/increment
 *
 * This route increments usage and returns the entitlement decision
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { evaluate, getTodayBucket, getBucketKey } from '@/lib/entitlements/evaluator';
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

    // 2. Get session and user data
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

    // 4. Get current usage
    const nowUtc = new Date().toISOString();
    const bucketKey = getBucketKey(featureId, userId || 'guest', nowUtc);
    let currentUsage = 0;

    if (userId && adminDb) {
      try {
        const usageRef = adminDb.collection('usage').doc(userId);
        const usageDoc = await usageRef.get();
        const usageData = usageDoc.data() || {};
        currentUsage = usageData[bucketKey] || 0;
      } catch (error) {
        console.error('Error fetching usage:', error);
      }
    }

    // 5. Evaluate entitlement
    const evalContext: EvalContext = {
      userId: userId || 'guest',
      plan: plan as any,
      usage: { [featureId]: currentUsage },
      nowUtcISO: nowUtc
    };

    const decision = evaluate(featureId, evalContext);

    // 6. If allowed, increment usage
    if (decision.allow && userId && adminDb) {
      try {
        const usageRef = adminDb.collection('usage').doc(userId);
        await usageRef.set({
          [bucketKey]: currentUsage + 1,
          lastUpdated: nowUtc
        }, { merge: true });

        // Update decision with new usage
        decision.remaining = decision.limit === -1 ? -1 : Math.max(0, decision.limit - (currentUsage + 1));
      } catch (error) {
        console.error('Error updating usage:', error);
      }
    }

    // 7. Return decision
    return NextResponse.json(decision);

  } catch (error) {
    console.error('Error in usage increment API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}