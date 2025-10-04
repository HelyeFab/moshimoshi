import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/newsletter/subscribe - Subscribe to newsletter
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, source = 'blog' } = body;

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: { code: 'INVALID_EMAIL', message: 'Email is required' } },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json(
        { error: { code: 'INVALID_EMAIL', message: 'Please enter a valid email address' } },
        { status: 400 }
      );
    }

    // Validate source
    const validSources = ['blog', 'homepage', 'popup'];
    if (!validSources.includes(source)) {
      return NextResponse.json(
        { error: { code: 'INVALID_SOURCE', message: 'Invalid subscription source' } },
        { status: 400 }
      );
    }

    // Create a hash of the email to use as document ID (prevents duplicates)
    const emailHash = crypto
      .createHash('sha256')
      .update(normalizedEmail)
      .digest('hex');

    const subscriberRef = adminDb.collection('newsletterSubscribers').doc(emailHash);
    const subscriberDoc = await subscriberRef.get();

    const now = Timestamp.now();

    // Check if already subscribed
    if (subscriberDoc.exists) {
      const data = subscriberDoc.data();

      // If previously unsubscribed, resubscribe
      if (data?.status === 'unsubscribed') {
        await subscriberRef.update({
          status: 'active',
          subscribedAt: now,
          source: source,
          unsubscribedAt: null,
        });

        return NextResponse.json({
          success: true,
          message: 'Welcome back! You have been resubscribed to our newsletter.',
        });
      }

      // Already active subscriber - idempotent response
      return NextResponse.json({
        success: true,
        message: 'You are already subscribed to our newsletter!',
      });
    }

    // Try to get user session if exists (optional linking)
    let userId: string | undefined;
    try {
      const { getSession } = await import('@/lib/auth/session');
      const session = await getSession();
      if (session?.uid) {
        userId = session.uid;
      }
    } catch (error) {
      // No session - guest subscription is fine
    }

    // Create new subscriber
    const subscriber = {
      email: normalizedEmail,
      subscribedAt: now,
      status: 'active',
      source: source,
      ...(userId && { userId }), // Only add userId if it exists
    };

    await subscriberRef.set(subscriber);

    return NextResponse.json({
      success: true,
      message: 'Thank you for subscribing! You will receive our latest updates.',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error subscribing to newsletter:', error);

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to subscribe. Please try again later.' } },
      { status: 500 }
    );
  }
}
