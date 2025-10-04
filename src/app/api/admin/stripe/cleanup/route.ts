/**
 * Admin-Only Cleanup/Reset
 *
 * Resets the admin's test subscription to free tier.
 * Cancels any active Stripe subscriptions and cleans up test data.
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
    console.log('[Admin Cleanup] Request received');

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
      console.warn(`[Admin Cleanup] Non-admin user ${session.uid} attempted to access endpoint`);
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    console.log(`[Admin Cleanup] ✅ Admin verified: ${session.uid}`);

    const uid = session.uid;
    const customerId = await getCustomerIdByUid(uid);

    if (!customerId) {
      console.log('[Admin Cleanup] No customer found, cleaning Firestore only');
      await resetFirestoreSubscription(uid);
      return NextResponse.json({
        success: true,
        message: 'No Stripe customer found. Firestore reset to free tier.',
      });
    }

    const stripe = getStripe();
    const actions: string[] = [];

    // 2. CANCEL ALL ACTIVE SUBSCRIPTIONS
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    });

    console.log(`[Admin Cleanup] Found ${subscriptions.data.length} subscription(s)`);

    for (const subscription of subscriptions.data) {
      if (subscription.status === 'active' || subscription.status === 'trialing') {
        try {
          await stripe.subscriptions.cancel(subscription.id);
          console.log(`[Admin Cleanup] Canceled subscription: ${subscription.id}`);
          actions.push(`Canceled subscription ${subscription.id}`);
        } catch (error: any) {
          console.error(`[Admin Cleanup] Failed to cancel ${subscription.id}:`, error.message);
          actions.push(`Failed to cancel ${subscription.id}: ${error.message}`);
        }
      }
    }

    // 3. VOID UNPAID INVOICES
    const invoices = await stripe.invoices.list({
      customer: customerId,
      status: 'open',
      limit: 10,
    });

    console.log(`[Admin Cleanup] Found ${invoices.data.length} open invoice(s)`);

    for (const invoice of invoices.data) {
      try {
        await stripe.invoices.voidInvoice(invoice.id);
        console.log(`[Admin Cleanup] Voided invoice: ${invoice.id}`);
        actions.push(`Voided invoice ${invoice.id}`);
      } catch (error: any) {
        console.error(`[Admin Cleanup] Failed to void ${invoice.id}:`, error.message);
      }
    }

    // 4. RESET FIRESTORE SUBSCRIPTION
    await resetFirestoreSubscription(uid);
    actions.push('Reset Firestore subscription to free tier');

    // 5. INVALIDATE ALL CACHES
    try {
      const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.vercel.app';
      const response = await fetch(`${appUrl}/api/auth/invalidate-all-caches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripeCustomerId: customerId,
          reason: 'admin_cleanup',
        }),
      });

      if (response.ok) {
        console.log('[Admin Cleanup] ✅ Caches invalidated');
        actions.push('Invalidated all user caches');
      }
    } catch (error) {
      console.error('[Admin Cleanup] Failed to invalidate caches:', error);
      actions.push('Warning: Failed to invalidate caches');
    }

    console.log('[Admin Cleanup] ✅ Cleanup completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed successfully',
      customerId,
      actionsPerformed: actions,
      note: 'Admin account reset to free tier. All test subscriptions canceled.',
    });

  } catch (error: any) {
    console.error('[Admin Cleanup] Error:', error);

    return NextResponse.json(
      {
        error: error.message || 'Failed to cleanup',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Reset user subscription in Firestore to free tier
 */
async function resetFirestoreSubscription(uid: string): Promise<void> {
  try {
    await adminFirestore!.collection('users').doc(uid).set(
      {
        subscription: {
          plan: 'free',
          status: 'active',
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          stripePriceId: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          metadata: {
            source: 'admin_cleanup',
            updatedAt: new Date(),
          },
        },
        updatedAt: new Date(),
      },
      { merge: true }
    );

    console.log(`[Admin Cleanup] ✅ Firestore subscription reset for uid: ${uid}`);
  } catch (error) {
    console.error('[Admin Cleanup] Failed to reset Firestore:', error);
    throw error;
  }
}
