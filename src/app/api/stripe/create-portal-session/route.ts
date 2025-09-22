import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/server';
import { getCustomerIdByUid } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import type { PortalSessionRequest } from '@/lib/stripe/types';

export async function POST(request: NextRequest) {
  try {
    console.log('[Portal API] Request received');

    // Get session from cookies instead of Firebase token
    const session = await getSession();

    console.log('[Portal API] Session:', session ? `Found for uid: ${session.uid}` : 'Not found');

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const uid = session.uid;

    // Parse request body
    const body: PortalSessionRequest = await request.json();
    const { returnUrl } = body;

    if (!returnUrl) {
      return NextResponse.json(
        { error: 'Missing returnUrl' },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Get customer ID
    const customerId = await getCustomerIdByUid(uid);
    console.log('[Portal API] Customer ID:', customerId || 'Not found');

    if (!customerId) {
      return NextResponse.json(
        { error: 'No Stripe customer found. Please subscribe first.' },
        { status: 400 }
      );
    }

    // Create billing portal session
    console.log('[Portal API] Creating portal session for customer:', customerId);
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    console.log('[Portal API] Portal session created:', portalSession.id);
    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    console.error('[Portal API] Error:', error);
    console.error('[Portal API] Error stack:', error?.stack);

    // Return more detailed error in development
    const isDev = process.env.NODE_ENV === 'development';

    return NextResponse.json(
      {
        error: isDev && error?.message
          ? `Portal session error: ${error.message}`
          : 'Failed to create portal session'
      },
      { status: 500 }
    );
  }
}