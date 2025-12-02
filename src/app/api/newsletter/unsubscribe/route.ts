import { NextRequest, NextResponse } from 'next/server';
import { adminDb, getAdminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';

// Use centralized getAdminDb() for null-safe database access
const getDb = getAdminDb;

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/newsletter/unsubscribe - Unsubscribe from newsletter
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

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

    // Create a hash of the email to find the document
    const emailHash = crypto
      .createHash('sha256')
      .update(normalizedEmail)
      .digest('hex');

    const db = getDb()
    const subscriberRef = db.collection('newsletterSubscribers').doc(emailHash);
    const subscriberDoc = await subscriberRef.get();

    // If not subscribed, return success anyway (idempotent)
    if (!subscriberDoc.exists) {
      return NextResponse.json({
        success: true,
        message: 'You are not subscribed to our newsletter.',
      });
    }

    const data = subscriberDoc.data();

    // If already unsubscribed, return success (idempotent)
    if (data?.status === 'unsubscribed') {
      return NextResponse.json({
        success: true,
        message: 'You have already been unsubscribed from our newsletter.',
      });
    }

    // Update subscriber status to unsubscribed
    await subscriberRef.update({
      status: 'unsubscribed',
      unsubscribedAt: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      message: 'You have been successfully unsubscribed from our newsletter.',
    });

  } catch (error: any) {
    console.error('Error unsubscribing from newsletter:', error);

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to unsubscribe. Please try again later.' } },
      { status: 500 }
    );
  }
}

// GET /api/newsletter/unsubscribe?email=...  - For email unsubscribe links
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return new NextResponse('Email parameter is required', { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return new NextResponse('Invalid email address', { status: 400 });
    }

    // Create a hash of the email
    const emailHash = crypto
      .createHash('sha256')
      .update(normalizedEmail)
      .digest('hex');

    const db = getDb()
    const subscriberRef = db.collection('newsletterSubscribers').doc(emailHash);
    const subscriberDoc = await subscriberRef.get();

    // Update if exists and is currently active
    if (subscriberDoc.exists) {
      const data = subscriberDoc.data();

      if (data?.status === 'active') {
        await subscriberRef.update({
          status: 'unsubscribed',
          unsubscribedAt: Timestamp.now(),
        });
      }
    }

    // Redirect to a confirmation page (you can create this later)
    return NextResponse.redirect(new URL('/newsletter/unsubscribed', request.url));

  } catch (error: any) {
    console.error('Error processing unsubscribe link:', error);
    return new NextResponse('Failed to unsubscribe', { status: 500 });
  }
}
