import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase/admin';
import { getStripe } from '@/lib/stripe/server';
import { getCustomerIdByUid, mapUidToCustomer } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import type { CheckoutSessionRequest } from '@/lib/stripe/types';

export async function POST(request: NextRequest) {
  try {
    // Log environment check
    console.log('[Checkout API] Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      hasFirebaseAdmin: !!auth,
      keyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 7), // Log key prefix for debugging
    });

    // Get session from cookies instead of Firebase token
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const uid = session.uid;
    const email = session.email;

    // Parse request body
    const body: CheckoutSessionRequest = await request.json();
    const { priceId, successUrl, cancelUrl, idempotencyKey } = body;

    console.log('[Checkout API] Request received:', {
      priceId,
      successUrl,
      cancelUrl,
      hasIdempotencyKey: !!idempotencyKey,
      uid: uid,
      email: email,
    });

    if (!priceId || !successUrl || !cancelUrl || !idempotencyKey) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Resolve or create Stripe customer
    let customerId = await getCustomerIdByUid(uid);

    // Verify customer exists in Stripe (handles account switches)
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch (error: any) {
        console.log(`Customer ${customerId} not found in Stripe, creating new one`);
        customerId = null;
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { uid },
        email: email,
      });
      customerId = customer.id;
      await mapUidToCustomer(uid, customerId);
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: customerId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        subscription_data: {
          metadata: {
            uid,
          },
          // Customize invoice data for the subscription
          description: 'Moshimoshi Premium - Japanese Learning Platform',
        },
        metadata: {
          uid,
          price_id: priceId,
        },
      },
      {
        idempotencyKey,
      }
    );

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: any) {
    console.error('Failed to create checkout session:', error);

    // Provide more specific error messages
    if (error.message?.includes('STRIPE_SECRET_KEY')) {
      return NextResponse.json(
        { error: 'Stripe configuration error' },
        { status: 500 }
      );
    }

    if (error.type === 'StripeInvalidRequestError') {
      return NextResponse.json(
        { error: error.message || 'Invalid Stripe request' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}