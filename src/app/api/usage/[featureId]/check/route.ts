import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyIdToken } from '@/lib/firebase/admin';
import { evaluate } from '@/lib/entitlements/evaluator';
import { getBucketKey } from '@/lib/entitlements/policy';
import { getFeature } from '@/lib/features/registry';
import type { FeatureId } from '@/types/FeatureId';
import type { EvalContext, Decision } from '@/types/entitlements';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    const { featureId: featureIdParam } = await params;
    
    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      // Allow guest access with limited quota
      return handleGuestCheck(featureIdParam as FeatureId);
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    // Check if adminDb is initialized
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }

    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data()!;
    const featureId = featureIdParam as FeatureId;

    // Get feature definition
    const feature = getFeature(featureId);
    if (!feature) {
      return NextResponse.json(
        { error: 'Invalid feature ID' },
        { status: 400 }
      );
    }

    // Get current usage
    const bucketKey = getBucketKey(feature.limitType, new Date());
    const usageDoc = await adminDb
      .collection('usage')
      .doc(userId)
      .collection(feature.limitType)
      .doc(bucketKey)
      .get();

    const usageData = usageDoc.exists ? usageDoc.data()! : {};
    
    // Build complete usage record with all FeatureIds
    const usage: Record<FeatureId, number> = {
      hiragana_practice: usageData.hiragana_practice || 0,
      katakana_practice: usageData.katakana_practice || 0
    };

    // Determine plan - subscription.plan should already be in correct format
    const planType = userData.subscription?.plan || 'free';

    // Build evaluation context
    const context: EvalContext = {
      userId,
      plan: planType,
      usage,
      nowUtcISO: new Date().toISOString(),
      overrides: userData.entitlementOverrides,
      tenant: userData.tenant
    };

    // Evaluate without incrementing
    const decision = evaluate(featureId, context);

    // Add additional metadata for the client
    const response = {
      ...decision,
      featureId,
      currentUsage: usage[featureId],
      bucketKey,
      limitType: feature.limitType,
      featureName: feature.name,
      plan: planType,
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

async function handleGuestCheck(featureId: FeatureId): Promise<NextResponse> {
  // For guests, use session storage or return default limits
  const feature = getFeature(featureId);
  if (!feature) {
    return NextResponse.json(
      { error: 'Invalid feature ID' },
      { status: 400 }
    );
  }

  const context: EvalContext = {
    userId: 'guest',
    plan: 'guest',
    usage: {
      hiragana_practice: 0,
      katakana_practice: 0
    }, // Guests start fresh each session
    nowUtcISO: new Date().toISOString()
  };

  const decision = evaluate(featureId, context);

  return NextResponse.json({
    ...decision,
    featureId,
    currentUsage: 0,
    limitType: feature.limitType,
    featureName: feature.name,
    plan: 'guest',
    isGuest: true,
    message: 'Guest access - progress not saved'
  });
}