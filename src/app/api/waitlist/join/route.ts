/**
 * Waitlist Join API
 *
 * Allows users to join the pre-launch waitlist to receive a 25% discount
 * when Moshimoshi launches.
 *
 * @module api/waitlist/join
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { LAUNCH_DATE_STRING } from '@/lib/prelaunch/config';

// Email validation schema
const waitlistSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .transform((email) => email.toLowerCase().trim()),
});

export async function POST(request: NextRequest) {
  console.log('[API /waitlist/join] Request received');

  try {
    // Ensure Firebase Admin is initialized
    ensureAdminInitialized();

    // Parse and validate request body
    const body = await request.json();

    let validatedData;
    try {
      validatedData = waitlistSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: error.issues[0]?.message || 'Invalid email address',
            },
          },
          { status: 400 }
        );
      }
      throw error;
    }

    const { email } = validatedData;
    console.log(`[API /waitlist/join] Processing email: ${email.substring(0, 3)}***`);

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized');
    }

    // Check if email already exists in waitlist
    const existingQuery = await adminFirestore
      .collection('waitlist')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      console.log('[API /waitlist/join] Email already on waitlist');
      // Return success anyway - don't reveal if email exists (privacy)
      return NextResponse.json({
        success: true,
        message: "You're on the list! We'll notify you when we launch.",
        alreadyJoined: true,
      });
    }

    // Add to waitlist
    const waitlistDoc = {
      email,
      joinedAt: Timestamp.now(),
      source: 'pre_launch_2025',
      linkedUid: null,
      linkedAt: null,
      discountGranted: false,
    };

    await adminFirestore.collection('waitlist').add(waitlistDoc);
    console.log('[API /waitlist/join] Successfully added to waitlist');

    return NextResponse.json({
      success: true,
      message: "You're on the list! You'll get 25% off Premium when we launch.",
      alreadyJoined: false,
    });

  } catch (error: any) {
    console.error('[API /waitlist/join] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Something went wrong. Please try again.',
        },
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check waitlist count (admin/debug only)
export async function GET(request: NextRequest) {
  try {
    ensureAdminInitialized();

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized');
    }

    const countSnapshot = await adminFirestore
      .collection('waitlist')
      .count()
      .get();

    const count = countSnapshot.data().count;

    return NextResponse.json({
      success: true,
      count,
      launchDate: LAUNCH_DATE_STRING,
    });
  } catch (error: any) {
    console.error('[API /waitlist/join] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get count' },
      { status: 500 }
    );
  }
}
