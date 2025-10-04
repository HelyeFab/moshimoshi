/**
 * Admin-Only Renewal Simulation
 *
 * Simulates a subscription renewal by triggering an invoice.payment_succeeded event.
 * This tests the recurring billing code path without waiting for an actual renewal.
 *
 * Uses Stripe CLI or direct API to trigger the event.
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
    console.log('[Admin Test Renewal] Request received');

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
      console.warn(`[Admin Test Renewal] Non-admin user ${session.uid} attempted to access endpoint`);
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    console.log(`[Admin Test Renewal] ✅ Admin verified: ${session.uid}`);

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

    // Find active subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json(
        { error: 'No subscription found. Run checkout test first.' },
        { status: 400 }
      );
    }

    const subscription = subscriptions.data[0];

    console.log(`[Admin Test Renewal] Found subscription: ${subscription.id}`);
    console.log(`[Admin Test Renewal] Status: ${subscription.status}`);

    // 3. CREATE A TEST INVOICE
    // This simulates what happens during a renewal
    const invoice = await stripe.invoices.create({
      customer: customerId,
      subscription: subscription.id,
      auto_advance: false, // Don't auto-finalize
      description: 'Admin Test - Simulated Renewal',
      metadata: {
        admin_test: 'true',
        test_type: 'renewal_simulation',
        test_timestamp: new Date().toISOString(),
      },
    });

    console.log(`[Admin Test Renewal] Created test invoice: ${invoice.id}`);

    // 4. ADD INVOICE ITEM (simulating subscription charge)
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: 0, // £0.00 for testing
      currency: 'gbp',
      description: 'Subscription Renewal (Test)',
    });

    // 5. FINALIZE AND PAY THE INVOICE
    // This triggers the invoice.payment_succeeded webhook
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id, {
      auto_advance: true, // Automatically attempt payment
    });

    console.log(`[Admin Test Renewal] Finalized invoice: ${finalizedInvoice.id}`);

    // If invoice has payment_intent, confirm it
    if (finalizedInvoice.payment_intent) {
      // For test invoices with £0, payment should succeed automatically
      console.log(`[Admin Test Renewal] Payment intent: ${finalizedInvoice.payment_intent}`);
    }

    // 6. MANUALLY PAY THE INVOICE (ensures webhook fires)
    const paidInvoice = await stripe.invoices.pay(invoice.id);

    console.log(`[Admin Test Renewal] ✅ Invoice paid successfully`);
    console.log(`[Admin Test Renewal] Status: ${paidInvoice.status}`);

    return NextResponse.json({
      success: true,
      message: 'Renewal simulation completed',
      subscriptionId: subscription.id,
      invoiceId: paidInvoice.id,
      status: paidInvoice.status,
      webhookExpected: 'invoice.payment_succeeded',
      note: 'Check Firestore for subscription updates and webhook logs',
    });

  } catch (error: any) {
    console.error('[Admin Test Renewal] Error:', error);

    return NextResponse.json(
      {
        error: error.message || 'Failed to simulate renewal',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        hint: error.message.includes('No such subscription')
          ? 'Run checkout test first to create a subscription'
          : undefined,
      },
      { status: 500 }
    );
  }
}
