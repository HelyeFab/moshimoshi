import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import crypto from 'crypto';

// GET /api/newsletter/status - Get newsletter subscription status for current user
export async function GET(request: NextRequest) {
  try {
    // Get current session
    const session = await getSession();

    if (!session?.email) {
      return NextResponse.json(
        {
          subscribed: false,
          status: 'guest',
          message: 'Not logged in'
        },
        { status: 200 }
      );
    }

    const normalizedEmail = session.email.toLowerCase().trim();

    // Create a hash of the email to find the document
    const emailHash = crypto
      .createHash('sha256')
      .update(normalizedEmail)
      .digest('hex');

    if (!adminDb) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Database not available' } },
        { status: 500 }
      );
    }

    const subscriberRef = adminDb.collection('newsletterSubscribers').doc(emailHash);
    const subscriberDoc = await subscriberRef.get();

    if (!subscriberDoc.exists) {
      return NextResponse.json({
        subscribed: false,
        status: 'not_subscribed',
        email: normalizedEmail,
      });
    }

    const data = subscriberDoc.data();

    return NextResponse.json({
      subscribed: data?.status === 'active',
      status: data?.status || 'unknown',
      email: normalizedEmail,
      subscribedAt: data?.subscribedAt,
      source: data?.source,
    });

  } catch (error: any) {
    console.error('Error checking newsletter status:', error);

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to check subscription status' } },
      { status: 500 }
    );
  }
}
