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
const UNIQUE_ITEM_FIELDS: Partial<Record<FeatureId, string>> = {
  kanji_mood_board: 'kanji_mood_board_boards',
  news: 'news_items',
  story: 'story_items',
  books: 'books_items',
  comics: 'comics_items',
  kanji_connection: 'kanji_connection_items',
  textbook_vocabulary: 'textbook_vocabulary_items',
  kanji_drawing_practice: 'kanji_drawing_practice_items'
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    const { featureId: featureIdParam } = await params;
    const featureId = featureIdParam as FeatureId;
    const itemId = request.nextUrl.searchParams.get('itemId') || request.nextUrl.searchParams.get('boardId');

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

    const nowUtcISO = new Date().toISOString();
    const bucket = getBucketKey(featureId, session.uid, nowUtcISO);

    if (featureId === 'custom_lists') {
      const listsSnapshot = await db
        .collection('users')
        .doc(session.uid)
        .collection('lists')
        .get();
      const currentUsage = listsSnapshot.size;

      const context: EvalContext = {
        userId: session.uid,
        plan: plan as any,
        usage: { [featureId]: currentUsage },
        nowUtcISO
      };

      const decision = evaluate(featureId, context);
      const response = {
        ...decision,
        featureId,
        currentUsage,
        bucketKey: bucket,
        plan,
        resetAtLocal: decision.resetAtUtc ? new Date(decision.resetAtUtc).toLocaleString() : undefined
      };

      return NextResponse.json(response);
    }

    // Get current usage for other features
    const usageRef = db
      .collection('users')
      .doc(session.uid)
      .collection('usage')
      .doc(bucket);

    const usageDoc = await usageRef.get();
    const usageData = (usageDoc.data() as Partial<Record<FeatureId, number>> | undefined) || {};
    const currentUsage = usageData[featureId] ?? 0;
    const uniqueField = UNIQUE_ITEM_FIELDS[featureId];
    const uniqueItems = uniqueField && Array.isArray((usageData as any)[uniqueField])
      ? (usageData as any)[uniqueField]
      : null;
    const usageFromUnique = uniqueItems ? uniqueItems.length : currentUsage;

    // Build evaluation context
    const context: EvalContext = {
      userId: session.uid,
      plan: plan as any,
      usage: {
        [featureId]: usageFromUnique
      },
      nowUtcISO: nowUtcISO
    };

    // Evaluate without incrementing
    const decision = evaluate(featureId, context);
    const isRepeat =
      typeof itemId === 'string' &&
      itemId.length > 0 &&
      (uniqueItems && uniqueItems.includes(itemId));

    const resolvedDecision = isRepeat
      ? {
          ...decision,
          allow: true,
          reason: 'ok',
          remaining: decision.remaining,
        }
      : decision;

    // Add additional metadata for the client
    const response = {
      ...resolvedDecision,
      featureId,
      currentUsage: usageFromUnique,
      bucketKey: bucket,
      plan,
      resetAtLocal: resolvedDecision.resetAtUtc ? new Date(resolvedDecision.resetAtUtc).toLocaleString() : undefined
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
