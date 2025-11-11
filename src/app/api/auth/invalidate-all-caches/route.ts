import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { invalidateAllUserCaches } from '@/lib/redis/invalidation/tier-change-handler'

/**
 * POST /api/auth/invalidate-all-caches
 * Comprehensive cache invalidation for tier changes
 *
 * Called by:
 * - Stripe webhook (via Firebase Functions) after subscription changes
 * - Admin tools for manual cache clearing
 * - User-initiated refresh requests
 *
 * Invalidates:
 * - Tier cache (60s TTL)
 * - Session cache (1hr TTL)
 * - Stats cache (1hr TTL)
 * - Queue cache (30min TTL)
 * - Entitlements cache (10min TTL)
 * - Profile cache (15min TTL)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, stripeCustomerId, reason } = body

    console.log('[Invalidate All Caches] Request received:', {
      hasUserId: !!userId,
      hasStripeCustomerId: !!stripeCustomerId,
      reason: reason || 'not specified'
    })

    // Resolve userId from various sources
    let targetUserId = userId

    // Method 1: Look up by Stripe customer ID
    if (!targetUserId && stripeCustomerId) {
      console.log(`[Invalidate All Caches] Looking up user by Stripe customer ID: ${stripeCustomerId}`)

      const snapshot = await adminDb
        .collection('users')
        .where('subscription.stripeCustomerId', '==', stripeCustomerId)
        .limit(1)
        .get()

      if (!snapshot.empty) {
        targetUserId = snapshot.docs[0].id
        console.log(`[Invalidate All Caches] Found user: ${targetUserId}`)
      } else {
        console.warn(`[Invalidate All Caches] No user found for Stripe customer: ${stripeCustomerId}`)
        return NextResponse.json(
          {
            success: false,
            error: 'User not found for Stripe customer ID'
          },
          { status: 404 }
        )
      }
    }

    // Method 2: Use authenticated session
    if (!targetUserId) {
      const session = await getSession()
      if (session) {
        targetUserId = session.uid
        console.log(`[Invalidate All Caches] Using authenticated session user: ${targetUserId}`)
      }
    }

    // No user ID could be determined
    if (!targetUserId) {
      console.error('[Invalidate All Caches] No userId provided and no active session')
      return NextResponse.json(
        {
          success: false,
          error: 'No userId provided and no active session found'
        },
        { status: 400 }
      )
    }

    // Invalidate all caches for the user
    console.log(`[Invalidate All Caches] Starting invalidation for user: ${targetUserId}`)
    const result = await invalidateAllUserCaches(targetUserId, reason || 'api_request')

    // Return result with details
    return NextResponse.json({
      success: result.success,
      userId: result.userId,
      cachesClearedCount: result.cachesClearedCount,
      cacheTypes: result.cacheTypes,
      errors: result.errors,
      timestamp: result.timestamp,
      message: result.success
        ? `Successfully cleared ${result.cachesClearedCount} caches`
        : `Cleared ${result.cachesClearedCount} caches with ${result.errors.length} errors`
    })

  } catch (error) {
    console.error('[Invalidate All Caches] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to invalidate caches',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/auth/invalidate-all-caches
 * Health check and documentation endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/auth/invalidate-all-caches',
    method: 'POST',
    description: 'Invalidates ALL user caches on tier change (comprehensive)',
    caches: [
      'tier (60s TTL)',
      'session (1hr TTL)',
      'stats (1hr TTL)',
      'queue (30min TTL)',
      'entitlements (10min TTL)',
      'profile (15min TTL)'
    ],
    usage: {
      fromStripeWebhook: {
        body: {
          stripeCustomerId: 'cus_xxx',
          reason: 'stripe_webhook'
        }
      },
      fromAdmin: {
        body: {
          userId: 'firebase_uid',
          reason: 'manual_admin'
        }
      },
      fromAuthenticatedUser: {
        body: {
          reason: 'user_refresh'
        },
        note: 'Uses session authentication to determine userId'
      }
    },
    differences: {
      oldEndpoint: '/api/auth/invalidate-tier-cache',
      oldBehavior: 'Only invalidated tier cache (60s TTL)',
      newBehavior: 'Invalidates ALL user caches for complete refresh',
      benefit: 'Prevents cache staleness bugs after subscription changes'
    }
  })
}
