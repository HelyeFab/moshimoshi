import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { evaluate, getTodayBucket } from '@/lib/entitlements/evaluator';
import type { FeatureId } from '@/types/FeatureId';
import type { EvalContext } from '@/types/entitlements';

// Valid feature IDs - should match the main route
const VALID_FEATURES: Set<FeatureId> = new Set([
  'hiragana_practice',
  'katakana_practice',
  'kanji_browser',
  'custom_lists',
  'save_items',
  'youtube_shadowing',
  'media_upload',
  'stall_layout_customization',
  'todos',
  'conjugation_drill'
]);

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
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
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
    const bucket = getTodayBucket(nowUtcISO);
    const usageRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('usage')
      .doc(bucket);

    const usageDoc = await usageRef.get();
    const currentUsage = usageDoc.data()?.[featureId] || 0;

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