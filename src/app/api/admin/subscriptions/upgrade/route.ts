/**
 * Admin API endpoint to upgrade/downgrade user subscriptions
 * This endpoint bypasses Stripe payment and directly updates the user's subscription
 *
 * Security: Admin-only access via session check
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import { getStripe } from '@/lib/stripe/server'
import { getPriceId, toPlan } from '@/lib/stripe/mapping'
import type { SubscriptionPlan } from '@/lib/stripe/types'

// Helper function to check if user is admin
async function isUserAdmin(uid: string): Promise<boolean> {
  try {
    const userDoc = await adminFirestore.collection('users').doc(uid).get()
    const userData = userDoc.data()
    // Check for isAdmin field (not admin)
    return userData?.isAdmin === true
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check session authentication
    const session = await getSession()

    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify admin privileges
    const isAdmin = await isUserAdmin(session.uid)
    if (!isAdmin) {
      console.warn(`[Admin API] Non-admin user ${session.uid} attempted to access admin endpoint`)
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      targetUserId,
      plan,
      reason = 'Admin manual upgrade'
    }: {
      targetUserId: string
      plan: SubscriptionPlan
      reason?: string
    } = body

    if (!targetUserId || !plan) {
      return NextResponse.json(
        { error: 'Missing required fields: targetUserId and plan' },
        { status: 400 }
      )
    }

    console.log(`[Admin API] Admin ${session.uid} upgrading user ${targetUserId} to ${plan}`)

    // Get the target user's current data
    const targetUserDoc = await adminFirestore.collection('users').doc(targetUserId).get()

    if (!targetUserDoc.exists) {
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      )
    }

    const targetUserData = targetUserDoc.data()
    const currentPlan = targetUserData?.subscription?.plan || 'free'

    // Handle different plan types
    if (plan === 'free') {
      // Downgrade to free - cancel any existing Stripe subscription
      if (targetUserData?.subscription?.stripeSubscriptionId) {
        try {
          const stripe = getStripe()
          await stripe.subscriptions.cancel(targetUserData.subscription.stripeSubscriptionId)
          console.log(`[Admin API] Cancelled Stripe subscription ${targetUserData.subscription.stripeSubscriptionId}`)
        } catch (error) {
          console.error('[Admin API] Failed to cancel Stripe subscription:', error)
          // Continue anyway - we'll update Firebase regardless
        }
      }

      // Update Firebase to free plan (matching Stripe webhook structure)
      await adminFirestore.collection('users').doc(targetUserId).set({
        subscription: {
          plan: 'free',
          status: 'active',
          canceledAt: new Date(),
          previousPlan: currentPlan,
          metadata: {
            source: 'admin',
            updatedAt: new Date(),
            updatedBy: session.uid,
            reason
          }
        },
        updatedAt: new Date()
      }, { merge: true })

    } else {
      // Upgrade to premium - create or update subscription
      const stripe = getStripe()
      const priceId = getPriceId(plan)

      if (!priceId) {
        return NextResponse.json(
          { error: `Invalid plan: ${plan}` },
          { status: 400 }
        )
      }

      let stripeCustomerId = targetUserData?.stripeCustomerId

      // Create Stripe customer if doesn't exist
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: targetUserData?.email,
          metadata: {
            uid: targetUserId,
            createdBy: 'admin',
            adminUid: session.uid
          }
        })
        stripeCustomerId = customer.id
      }

      // Cancel existing subscription if upgrading/downgrading between premium plans
      if (targetUserData?.subscription?.stripeSubscriptionId && currentPlan !== 'free') {
        try {
          await stripe.subscriptions.cancel(targetUserData.subscription.stripeSubscriptionId)
          console.log(`[Admin API] Cancelled existing subscription before creating new one`)
        } catch (error) {
          console.error('[Admin API] Failed to cancel existing subscription:', error)
        }
      }

      // Create a 100% off coupon for admin upgrades
      // Use a shorter ID to avoid Stripe limitations
      const timestamp = Math.floor(Date.now() / 1000) // Unix timestamp in seconds
      const userIdShort = targetUserId.substring(0, 6)
      const couponId = `admin_${timestamp}_${userIdShort}`

      console.log(`[Admin API] Creating coupon with ID: ${couponId}`)

      let coupon
      try {
        coupon = await stripe.coupons.create({
          percent_off: 100,
          duration: 'forever',
          id: couponId,
          metadata: {
            createdBy: 'admin',
            adminUid: session.uid,
            targetUserId,
            reason
          }
        })
        console.log(`[Admin API] Coupon created successfully: ${coupon.id}`)
      } catch (error) {
        console.error('[Admin API] Failed to create coupon:', error)
        throw error
      }

      // Create new subscription with 100% discount coupon
      console.log(`[Admin API] Creating subscription with coupon ${coupon.id}`)

      let subscription
      try {
        subscription = await stripe.subscriptions.create({
          customer: stripeCustomerId,
          items: [{ price: priceId }],
          discounts: [{
            coupon: coupon.id
          }],
          metadata: {
            uid: targetUserId,
            createdBy: 'admin',
            adminUid: session.uid,
            reason
          }
        })
        console.log(`[Admin API] Subscription created: ${subscription.id}`)
      } catch (error) {
        console.error('[Admin API] Failed to create subscription:', error)
        // Try to delete the coupon if subscription creation failed
        try {
          await stripe.coupons.del(coupon.id)
          console.log(`[Admin API] Cleaned up unused coupon: ${coupon.id}`)
        } catch (cleanupError) {
          console.error('[Admin API] Failed to cleanup coupon:', cleanupError)
        }
        throw error
      }

      // Update Firebase with new subscription (matching Stripe webhook structure EXACTLY)
      // Get the actual price ID from the created subscription (like webhook does)
      const actualPriceId = subscription.items.data[0]?.price.id;
      console.log(`[Admin API] Price ID from subscription: ${actualPriceId}`)
      console.log(`[Admin API] Expected yearly price: ${process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY}`)
      console.log(`[Admin API] Expected monthly price: ${process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY}`)

      const actualPlan = toPlan(actualPriceId) || plan; // Use toPlan to convert price ID to plan name
      console.log(`[Admin API] Converted plan: ${actualPlan} (original request: ${plan})`)

      await adminFirestore.collection('users').doc(targetUserId).set({
        subscription: {
          plan: actualPlan,  // Use the plan derived from the actual price ID
          status: subscription.status,
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: actualPriceId,  // Use the actual price ID from subscription
          currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
          metadata: {
            source: 'admin',
            updatedAt: new Date(),
            updatedBy: session.uid,
            reason,
            stripeCouponId: coupon.id,
            discountType: '100% off coupon'
          }
        },
        stripeCustomerId,
        updatedAt: new Date()
      }, { merge: true })
    }

    // Log admin action (use new Date() to match webhook pattern)
    await adminFirestore.collection('admin_logs').add({
      action: 'subscription_change',
      adminUid: session.uid,
      adminEmail: session.email,
      targetUserId,
      fromPlan: currentPlan,
      toPlan: plan,
      reason,
      timestamp: new Date()
    })

    console.log(`[Admin API] Successfully updated user ${targetUserId} from ${currentPlan} to ${plan}`)

    return NextResponse.json({
      success: true,
      message: `User subscription updated to ${plan}`,
      previousPlan: currentPlan,
      newPlan: plan
    })

  } catch (error) {
    console.error('[Admin API] Error updating subscription:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update subscription' },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch all users with subscription info
export async function GET(request: NextRequest) {
  try {
    // Check session authentication
    const session = await getSession()

    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify admin privileges
    const isAdmin = await isUserAdmin(session.uid)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Fetch all users
    const usersSnapshot = await adminFirestore.collection('users').get()

    const users = usersSnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        uid: doc.id,
        email: data.email,
        displayName: data.displayName,
        subscription: data.subscription || { plan: 'free', status: 'active' },
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      }
    })

    // Sort by most recent first
    users.sort((a, b) => {
      const dateA = a.updatedAt?.toDate?.() || new Date(0)
      const dateB = b.updatedAt?.toDate?.() || new Date(0)
      return dateB.getTime() - dateA.getTime()
    })

    return NextResponse.json({ users })

  } catch (error) {
    console.error('[Admin API] Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}