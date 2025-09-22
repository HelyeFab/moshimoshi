import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/server';
import { getSession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    // Log environment check
    console.log('[Donate API] Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      keyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 7),
    });

    const { amount = 500 } = await request.json(); // Default $5.00

    // Validate amount (minimum $1.00)
    if (amount < 100) {
      return NextResponse.json(
        { error: 'Minimum donation is $1.00' },
        { status: 400 }
      );
    }

    // Get optional session (donations can be anonymous)
    const session = await getSession(request);
    const userEmail = session?.email;
    const userId = session?.uid;

    console.log('[Donate API] Creating donation session:', {
      amount,
      hasUser: !!userId,
      userEmail,
    });

    const stripe = getStripe();

    // Get the host from headers for redirect URLs
    const host = request.headers.get('host') || 'localhost:3004';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;

    // Create Stripe checkout session for one-time donation
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: '☕ Coffee for Moshimoshi',
              description: 'Support the development of Moshimoshi Japanese Learning Platform',
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/dashboard?donation=success`,
      cancel_url: `${baseUrl}/dashboard?donation=cancelled`,
      metadata: {
        type: 'donation',
        userId: userId || 'anonymous',
        amount: amount.toString(),
      },
      ...(userEmail && { customer_email: userEmail }),
      submit_type: 'donate',
      billing_address_collection: 'auto',
      allow_promotion_codes: false,
    });

    console.log('[Donate API] Checkout session created:', {
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });

    return NextResponse.json({
      sessionUrl: checkoutSession.url,
      sessionId: checkoutSession.id
    });
  } catch (error: any) {
    console.error('[Donate API] Error:', error);

    // Provide more specific error messages
    if (error.message?.includes('STRIPE_SECRET_KEY')) {
      return NextResponse.json(
        { error: 'Stripe configuration error - check server logs' },
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
      { error: error.message || 'Failed to create donation session' },
      { status: 500 }
    );
  }
}