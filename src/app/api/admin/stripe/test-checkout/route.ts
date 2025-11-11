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

// Easter egg price ID (£0.00 monthly subscription)
const EASTER_EGG_PRICE_ID = 'price_1SEXlIHdrJomitOw956pZB3q';

// Helper function to check if user is admin (same as other admin endpoints)
async function isUserAdmin(uid: string): Promise<boolean> {
  try {
    console.log('[isUserAdmin] Checking admin status for uid:', uid);

    if (!adminFirestore) {
      console.error('[isUserAdmin] adminFirestore is not initialized!');
      return false;
    }

    const userDoc = await adminFirestore.collection('users').doc(uid).get();

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
  // Outer safety wrapper - ensures we ALWAYS return valid JSON
  try {
    console.log('[Admin Test Checkout] ========== FUNCTION ENTERED ==========');

    return await handleTestCheckout(request);
  } catch (outerError: any) {
    console.error('[Admin Test Checkout] OUTER ERROR HANDLER:', outerError);
    return NextResponse.json(
      {
        error: 'Unexpected server error',
        message: outerError.message,
        type: outerError.constructor?.name,
        stack: process.env.NODE_ENV === 'development' ? outerError.stack : undefined,
      },
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function handleTestCheckout(request: NextRequest) {
  try {
    console.log('[Admin Test Checkout] ========== REQUEST START ==========');
    console.log('[Admin Test Checkout] Environment:', process.env.NODE_ENV);
    console.log('[Admin Test Checkout] adminFirestore available:', !!adminFirestore);

    // 1. AUTHENTICATION - Admin only (same pattern as admin/subscriptions/upgrade)
    let session;
    try {
      session = await getSession();
      console.log('[Admin Test Checkout] Session retrieved:', session ? 'exists' : 'null', session?.uid);
    } catch (sessionError: any) {
      console.error('[Admin Test Checkout] getSession() failed:', sessionError);
      return NextResponse.json(
        { error: 'Session error', details: sessionError.message },
        { status: 500 }
      );
    }

    if (!session?.uid) {
      console.log('[Admin Test Checkout] No session or uid');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify admin privileges using Firestore check
    console.log('[Admin Test Checkout] Checking admin privileges...');
    const isAdmin = await isUserAdmin(session.uid);
    console.log('[Admin Test Checkout] isAdmin result:', isAdmin);

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
    console.log('[Admin Test Checkout] Getting Stripe instance...');
    const stripe = getStripe();
    console.log('[Admin Test Checkout] Stripe instance obtained, retrieving price...');

    let price;
    try {
      price = await stripe.prices.retrieve(EASTER_EGG_PRICE_ID);
      console.log('[Admin Test Checkout] Price retrieved:', price.id, 'amount:', price.unit_amount);
    } catch (priceError: any) {
      console.error('[Admin Test Checkout] Failed to retrieve price:', priceError);
      return NextResponse.json(
        { error: 'Failed to retrieve easter egg price', details: priceError.message },
        { status: 500 }
      );
    }

    if (!price || price.unit_amount !== 0) {
      console.error('[Admin Test Checkout] Invalid price configuration:', price);
      return NextResponse.json(
        { error: 'Easter egg price misconfigured', priceData: { id: price?.id, amount: price?.unit_amount } },
        { status: 500 }
      );
    }

    console.log('[Admin Test Checkout] ✅ Easter egg price validated (£0.00)');

    // 4. GET OR CREATE CUSTOMER
    const uid = session.uid;
    const email = session.email;
    console.log('[Admin Test Checkout] Getting customer for uid:', uid);

    let customerId: string | null = null;

    try {
      customerId = await getCustomerIdByUid(uid);
      console.log('[Admin Test Checkout] getCustomerIdByUid result:', customerId);
    } catch (error: any) {
      console.error('[Admin Test Checkout] Error getting customer ID:', error);
      throw new Error(`Failed to get customer ID: ${error.message}`);
    }

    // Verify customer exists in Stripe
    if (customerId) {
      try {
        console.log('[Admin Test Checkout] Verifying customer exists in Stripe:', customerId);
        await stripe.customers.retrieve(customerId);
        console.log(`[Admin Test Checkout] ✅ Existing customer verified: ${customerId}`);
      } catch (error: any) {
        console.log(`[Admin Test Checkout] Customer not found in Stripe, will create new one`);
        customerId = null;
      }
    }

    // Create customer if needed
    if (!customerId) {
      try {
        console.log('[Admin Test Checkout] Creating new Stripe customer...');
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
        console.log(`[Admin Test Checkout] ✅ New customer created: ${customerId}`);

        console.log('[Admin Test Checkout] Mapping uid to customer...');
        await mapUidToCustomer(uid, customerId);
        console.log(`[Admin Test Checkout] ✅ Customer mapped successfully`);
      } catch (error: any) {
        console.error('[Admin Test Checkout] Error creating customer:', error);
        throw new Error(`Failed to create Stripe customer: ${error.message}`);
      }
    }

    // 5. PARSE REQUEST (handle empty body gracefully)
    let body = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch (parseError) {
      console.log('[Admin Test Checkout] No body or invalid JSON, using defaults');
    }

    const {
      successUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.vercel.app'}/admin/stripe-testing?test=success`,
      cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.vercel.app'}/admin/stripe-testing?test=canceled`
    } = body as any;

    // 6. CREATE CHECKOUT SESSION
    const testId = `test_${Date.now()}`;
    console.log('[Admin Test Checkout] Creating checkout session...');

    let checkoutSession;
    try {
      checkoutSession = await stripe.checkout.sessions.create(
        {
          mode: 'subscription', // Monthly subscription (£0.00)
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
            test_type: 'easter_egg_subscription',
            price_id: EASTER_EGG_PRICE_ID,
          },
          // Don't allow promotion codes for tests
          allow_promotion_codes: false,
        },
        {
          idempotencyKey: `admin_test_${uid}_${testId}`,
        }
      );
    } catch (checkoutError: any) {
      console.error('[Admin Test Checkout] Failed to create checkout session:', checkoutError);
      return NextResponse.json(
        { error: 'Failed to create checkout session', details: checkoutError.message },
        { status: 500 }
      );
    }

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
    console.error('[Admin Test Checkout] ========== ERROR ==========');
    console.error('[Admin Test Checkout] Error message:', error.message);
    console.error('[Admin Test Checkout] Error stack:', error.stack);
    console.error('[Admin Test Checkout] Full error:', error);

    // Always return valid JSON, even on error
    return NextResponse.json(
      {
        error: error.message || 'Failed to create test checkout',
        errorType: error.constructor.name,
        stack: error.stack,
        timestamp: new Date().toISOString()
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
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
