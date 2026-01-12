import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb, getAdminDb } from '@/lib/firebase/admin';
import { evaluate, getBucketKey } from '@/lib/entitlements/evaluator';
import type { FeatureId } from '@/types/FeatureId';
import { FEATURE_IDS } from '@/types/FeatureId';
import type { EvalContext } from '@/types/entitlements';

// Use centralized getAdminDb() for null-safe database access
const getDb = getAdminDb;

// Valid feature IDs - should match the main route
const VALID_FEATURES: Set<FeatureId> = new Set(FEATURE_IDS);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    const { featureId: featureIdParam } = await params;
    const featureId = featureIdParam as FeatureId;

    // Validate feature ID
    if (!VALID_FEATURES.has(featureId)) {
      return NextResponse.json(
        { error: 'Invalid feature ID' },
        { status: 400 }
      );
    }

    // Get session using the same auth as rest of app
    const session = await getSession();

    if (!session) {
      // Return guest limits
      return handleGuestCheck(featureId);
    }

    // Get FRESH user data from Firestore (NEVER trust session.tier)
    const db = getDb()
    const userDoc = await db.collection('users').doc(session.uid).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data()!;
    const plan = userData?.subscription?.plan || 'free';

    // Get current usage for the feature
    const nowUtcISO = new Date().toISOString();
    const bucket = getBucketKey(featureId, session.uid, nowUtcISO);
    const usageRef = db
      .collection('users')
      .doc(session.uid)
      .collection('usage')
      .doc(bucket);

    const usageDoc = await usageRef.get();
    const usageData = (usageDoc.data() as Record<string, unknown> | undefined) || {};
    const counts = (usageData.counts as Record<string, number> | undefined) || {};
    const currentUsage = (usageData[featureId] as number | undefined) ?? counts[featureId] ?? 0;

    // Build evaluation context
    const context: EvalContext = {
      userId: session.uid,
      plan: plan as any,
      usage: { [featureId]: currentUsage },
      nowUtcISO: nowUtcISO
    };

    // Evaluate without incrementing
    const decision = evaluate(featureId, context);

    // Add additional metadata for the client
    const response = {
      ...decision,
      featureId,
      currentUsage,
      bucketKey: bucket,
      plan,
      resetAtLocal: decision.resetAtUtc ? new Date(decision.resetAtUtc).toLocaleString() : undefined
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error checking usage:', error);
    return NextResponse.json(
      { error: 'Failed to check usage' },
      { status: 500 }
    );
  }
}

function handleGuestCheck(featureId: FeatureId): NextResponse {
  // For guests, return default limits
  const context: EvalContext = {
    userId: 'guest',
    plan: 'guest' as any,
    usage: { [featureId]: 0 },
    nowUtcISO: new Date().toISOString()
  };

  const decision = evaluate(featureId, context);

  return NextResponse.json({
    ...decision,
    featureId,
    currentUsage: 0,
    plan: 'guest',
    isGuest: true,
    message: 'Guest access - please sign in to save progress'
  });
}
