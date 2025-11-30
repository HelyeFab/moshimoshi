import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { createNewsletterVerificationToken } from '@/lib/auth/jwt';
import { redis, RedisKeys } from '@/lib/redis/client';
import { sendNewsletterVerificationEmail } from '@/lib/email/resend';

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

    if (!adminDb) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Database not available' } },
        { status: 500 }
      );
    }

    const subscriberRef = adminDb.collection('newsletterSubscribers').doc(emailHash);
    const subscriberDoc = await subscriberRef.get();

    const now = Timestamp.now();

    // Check if already subscribed
    if (subscriberDoc.exists) {
      const data = subscriberDoc.data();

      // If previously unsubscribed, resend verification
      if (data?.status === 'unsubscribed') {
        // Generate new verification token
        const verificationToken = createNewsletterVerificationToken(normalizedEmail, 24 * 60 * 60 * 1000); // 24 hours

        // Store in Redis
        const verificationKey = RedisKeys.emailVerification(verificationToken);
        await redis.setex(
          verificationKey,
          86400, // 24 hours
          JSON.stringify({
            email: normalizedEmail,
            source,
            type: 'newsletter',
          })
        );

        // Update subscriber to pending
        await subscriberRef.update({
          status: 'pending',
          subscribedAt: now,
          source: source,
          unsubscribedAt: null,
        });

        // Send verification email
        const verificationUrl = `${request.nextUrl.origin}/newsletter/verify?token=${verificationToken}`;
        await sendNewsletterVerificationEmail(normalizedEmail, verificationUrl);

        return NextResponse.json({
          success: true,
          message: 'Please check your email to confirm your subscription.',
          requiresVerification: true,
        });
      }

      // If pending, resend verification email
      if (data?.status === 'pending') {
        // Generate new verification token
        const verificationToken = createNewsletterVerificationToken(normalizedEmail, 24 * 60 * 60 * 1000);

        // Store in Redis
        const verificationKey = RedisKeys.emailVerification(verificationToken);
        await redis.setex(
          verificationKey,
          86400,
          JSON.stringify({
            email: normalizedEmail,
            source,
            type: 'newsletter',
          })
        );

        // Send verification email
        const verificationUrl = `${request.nextUrl.origin}/newsletter/verify?token=${verificationToken}`;
        await sendNewsletterVerificationEmail(normalizedEmail, verificationUrl);

        return NextResponse.json({
          success: true,
          message: 'Verification email resent! Please check your inbox.',
          requiresVerification: true,
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

    // Generate verification token
    const verificationToken = createNewsletterVerificationToken(normalizedEmail, 24 * 60 * 60 * 1000); // 24 hours

    // Store verification data in Redis
    const verificationKey = RedisKeys.emailVerification(verificationToken);
    await redis.setex(
      verificationKey,
      86400, // 24 hours
      JSON.stringify({
        email: normalizedEmail,
        source,
        type: 'newsletter',
      })
    );

    // Create new subscriber with pending status
    const subscriber = {
      email: normalizedEmail,
      subscribedAt: now,
      status: 'pending', // Changed from 'active' to 'pending'
      source: source,
      ...(userId && { userId }), // Only add userId if it exists
    };

    console.log('📧 Creating new newsletter subscriber (pending):', { email: normalizedEmail, source, emailHash });
    await subscriberRef.set(subscriber);

    // Send verification email
    const verificationUrl = `${request.nextUrl.origin}/newsletter/verify?token=${verificationToken}`;
    await sendNewsletterVerificationEmail(normalizedEmail, verificationUrl);

    console.log('✅ Newsletter subscriber created (pending verification)');
    console.log('📧 Verification email sent to:', normalizedEmail);

    return NextResponse.json({
      success: true,
      message: 'Almost done! Please check your email to confirm your subscription.',
      requiresVerification: true,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error subscribing to newsletter:', error);

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to subscribe. Please try again later.' } },
      { status: 500 }
    );
  }
}
