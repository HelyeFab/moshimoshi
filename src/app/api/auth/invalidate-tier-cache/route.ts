import { NextRequest, NextResponse } from 'next/server';
import { getSession, invalidateTierCache } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';

/**
 * POST /api/auth/invalidate-tier-cache
 * Invalidates the tier cache for a user when their subscription changes
 *
 * Can be called:
 * 1. By Stripe webhooks when subscription updates
 * 2. By Firebase Functions after processing subscription changes
 * 3. Manually by admin tools
 * 4. By the user themselves to force refresh
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, stripeCustomerId } = body;

    // If no userId but we have stripeCustomerId, look it up
    let targetUserId = userId;
    if (!targetUserId && stripeCustomerId) {
      console.log(`[Invalidate Tier Cache] Looking up userId for Stripe customer: ${stripeCustomerId}`);

      // Query Firestore for user with this Stripe customer ID
      const usersSnapshot = await adminDb
        .collection('users')
        .where('subscription.stripeCustomerId', '==', stripeCustomerId)
        .limit(1)
        .get();

      if (!usersSnapshot.empty) {
        targetUserId = usersSnapshot.docs[0].id;
        console.log(`[Invalidate Tier Cache] Found userId: ${targetUserId} for customer: ${stripeCustomerId}`);
      } else {
        console.log(`[Invalidate Tier Cache] No user found for Stripe customer: ${stripeCustomerId}`);
        return NextResponse.json({
          success: false,
          error: 'User not found for Stripe customer'
        }, { status: 404 });
      }
    }

    // If still no userId, check if the caller is authenticated and invalidate their own cache
    if (!targetUserId) {
      const session = await getSession();
      if (session) {
        targetUserId = session.uid;
        console.log(`[Invalidate Tier Cache] Using session userId: ${targetUserId}`);
      } else {
        return NextResponse.json({
          success: false,
          error: 'No userId provided and no active session'
        }, { status: 400 });
      }
    }

    // Invalidate the tier cache
    await invalidateTierCache(targetUserId);

    // Log the invalidation
    console.log(`[Invalidate Tier Cache] Successfully invalidated cache for user: ${targetUserId}`);

    return NextResponse.json({
      success: true,
      message: `Tier cache invalidated for user ${targetUserId}`,
      userId: targetUserId
    });

  } catch (error) {
    console.error('[Invalidate Tier Cache] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to invalidate tier cache'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/invalidate-tier-cache
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    endpoint: '/api/auth/invalidate-tier-cache',
    method: 'POST',
    description: 'Invalidates tier cache for a user',
    parameters: {
      userId: 'Firebase user ID (optional)',
      stripeCustomerId: 'Stripe customer ID (optional)'
    }
  });
}