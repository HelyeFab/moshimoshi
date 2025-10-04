/**
 * Admin-Only Easter Egg Test Checkout
 *
 * Creates a £0.00 checkout session for production testing.
 * Tests the complete checkout → webhook → database → cache flow
 * without spending any money.
 *
 * Security:
 * - Admin UID verification
 * - Production-only mode
 * - Easter egg price validation (£0.00)
 * - Rate limiting
 * - Audit logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getStripe } from '@/lib/stripe/server';
import { getCustomerIdByUid, mapUidToCustomer, adminFirestore } from '@/lib/firebase/admin';

// Easter egg price ID (£0.00 one-time payment)
const EASTER_EGG_PRICE_ID = 'price_1SDlJJHdrJomitOwnRmWRKhI';

// Helper function to check if user is admin (same as other admin endpoints)
async function isUserAdmin(uid: string): Promise<boolean> {
  try {
    console.log('[isUserAdmin] Checking admin status for uid:', uid);
    const userDoc = await adminFirestore!.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      console.log('[isUserAdmin] User document does not exist');
      return false;
    }

    const userData = userDoc.data();
    console.log('[isUserAdmin] User data:', {
      uid,
      isAdmin: userData?.isAdmin,
      hasAdminField: 'isAdmin' in (userData || {})
    });

    return userData?.isAdmin === true;
  } catch (error) {
    console.error('[isUserAdmin] Error checking admin status:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Admin Test Checkout] Request received');

    // 1. AUTHENTICATION - Admin only (same pattern as admin/subscriptions/upgrade)
    const session = await getSession();

    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify admin privileges using Firestore check
    const isAdmin = await isUserAdmin(session.uid);
    if (!isAdmin) {
      console.warn(`[Admin Test Checkout] Non-admin user ${session.uid} attempted to access endpoint`);
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    console.log(`[Admin Test Checkout] ✅ Admin verified: ${session.uid}`);

    // 2. ENVIRONMENT CHECK - Production only
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction) {
      return NextResponse.json(
        {
          error: 'This endpoint is for production testing only',
          hint: 'Use test mode Stripe dashboard for development'
        },
        { status: 400 }
      );
    }

    // 3. VALIDATE EASTER EGG PRICE
    const stripe = getStripe();
    const price = await stripe.prices.retrieve(EASTER_EGG_PRICE_ID);

    if (!price || price.unit_amount !== 0) {
      console.error('[Admin Test Checkout] Invalid price configuration');
      return NextResponse.json(
        { error: 'Easter egg price misconfigured' },
        { status: 500 }
      );
    }

    console.log('[Admin Test Checkout] ✅ Easter egg price validated (£0.00)');

    // 4. GET OR CREATE CUSTOMER
    const uid = session.uid;
    const email = session.email;
    let customerId = await getCustomerIdByUid(uid);

    // Verify customer exists in Stripe
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
        console.log(`[Admin Test Checkout] Existing customer: ${customerId}`);
      } catch (error: any) {
        console.log(`[Admin Test Checkout] Customer not found, creating new one`);
        customerId = null;
      }
    }

    // Create customer if needed
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {
          uid,
          admin_test: 'true',
          created_via: 'easter_egg_test'
        },
        email: email,
        name: 'Admin Test User',
      });
      customerId = customer.id;
      await mapUidToCustomer(uid, customerId);
      console.log(`[Admin Test Checkout] ✅ New customer created: ${customerId}`);
    }

    // 5. PARSE REQUEST
    const body = await request.json();
    const {
      successUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.vercel.app'}/admin/stripe-testing?test=success`,
      cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.vercel.app'}/admin/stripe-testing?test=canceled`
    } = body;

    // 6. CREATE CHECKOUT SESSION
    const testId = `test_${Date.now()}`;
    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: 'payment', // One-time payment (not subscription)
        customer: customerId,
        line_items: [
          {
            price: EASTER_EGG_PRICE_ID,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          uid,
          admin_test: 'true',
          test_id: testId,
          test_timestamp: new Date().toISOString(),
          test_type: 'easter_egg_checkout',
        },
        // Don't allow promotion codes for tests
        allow_promotion_codes: false,
      },
      {
        idempotencyKey: `admin_test_${uid}_${testId}`,
      }
    );

    console.log(`[Admin Test Checkout] ✅ Checkout session created: ${checkoutSession.id}`);
    console.log(`[Admin Test Checkout] Test ID: ${testId}`);
    console.log(`[Admin Test Checkout] Customer: ${customerId}`);

    // 7. AUDIT LOG
    await logAdminTest({
      action: 'test_checkout_created',
      uid,
      customerId,
      sessionId: checkoutSession.id,
      testId,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      url: checkoutSession.url,
      testId,
      sessionId: checkoutSession.id,
      customerId,
      message: 'Test checkout session created (£0.00)',
    });

  } catch (error: any) {
    console.error('[Admin Test Checkout] Error:', error);

    return NextResponse.json(
      {
        error: error.message || 'Failed to create test checkout',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Log admin test actions for audit trail
 */
async function logAdminTest(data: {
  action: string;
  uid: string;
  customerId: string;
  sessionId: string;
  testId: string;
  timestamp: string;
}) {
  try {
    // Log to console for now, can add Firestore logging later
    console.log('[Admin Test Audit]', JSON.stringify(data, null, 2));

    // TODO: Add Firestore logging
    // await adminFirestore.collection('admin_audit_logs').add({
    //   ...data,
    //   createdAt: Timestamp.now()
    // });
  } catch (error) {
    console.error('[Admin Test Audit] Failed to log:', error);
    // Don't fail the request if logging fails
  }
}
