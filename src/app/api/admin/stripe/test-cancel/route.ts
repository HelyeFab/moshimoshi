/**
 * Admin-Only Cancellation Test
 *
 * Tests the subscription cancellation flow by:
 * 1. Canceling the admin's test subscription
 * 2. Triggering customer.subscription.deleted webhook
 * 3. Verifying reversion to free tier
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getStripe } from '@/lib/stripe/server';
import { getCustomerIdByUid, adminFirestore } from '@/lib/firebase/admin';

// Helper function to check if user is admin
async function isUserAdmin(uid: string): Promise<boolean> {
  try {
    const userDoc = await adminFirestore!.collection('users').doc(uid).get();
    const userData = userDoc.data();
    return userData?.isAdmin === true;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Admin Test Cancel] Request received');

    // 1. AUTHENTICATION - Admin only
    const session = await getSession();

    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify admin privileges
    const isAdmin = await isUserAdmin(session.uid);
    if (!isAdmin) {
      console.warn(`[Admin Test Cancel] Non-admin user ${session.uid} attempted to access endpoint`);
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    console.log(`[Admin Test Cancel] ✅ Admin verified: ${session.uid}`);

    // 2. GET CUSTOMER & SUBSCRIPTION
    const uid = session.uid;
    const customerId = await getCustomerIdByUid(uid);

    if (!customerId) {
      return NextResponse.json(
        { error: 'No customer found. Run checkout test first.' },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Find active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json(
        { error: 'No active subscription found to cancel.' },
        { status: 400 }
      );
    }

    const subscription = subscriptions.data[0];

    console.log(`[Admin Test Cancel] Canceling subscription: ${subscription.id}`);

    // 3. CANCEL SUBSCRIPTION IMMEDIATELY
    // Use 'cancel' instead of 'cancel_at_period_end' to trigger immediate webhook
    const canceledSubscription = await stripe.subscriptions.cancel(subscription.id, {
      prorate: false, // No prorating for test subscriptions
    });

    console.log(`[Admin Test Cancel] ✅ Subscription canceled successfully`);
    console.log(`[Admin Test Cancel] Status: ${canceledSubscription.status}`);
    console.log(`[Admin Test Cancel] Webhook expected: customer.subscription.deleted`);

    return NextResponse.json({
      success: true,
      message: 'Cancellation test completed',
      subscriptionId: canceledSubscription.id,
      status: canceledSubscription.status,
      canceledAt: canceledSubscription.canceled_at,
      webhookExpected: 'customer.subscription.deleted',
      note: 'User should be reverted to free tier. Check Firestore and session cache.',
    });

  } catch (error: any) {
    console.error('[Admin Test Cancel] Error:', error);

    return NextResponse.json(
      {
        error: error.message || 'Failed to cancel subscription',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        hint: error.message.includes('No such subscription')
          ? 'No active subscription found. Run checkout test first.'
          : undefined,
      },
      { status: 500 }
    );
  }
}
