/**
 * API Route: Increment User Streak
 *
 * POST /api/gamification/streak/increment
 *
 * Uses Firebase transactions to increment streak atomically.
 * Implements version-based conflict detection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { updateStreakTransaction } from '@/lib/gamification/services/streakService';

/**
 * POST /api/gamification/streak/increment
 *
 * Increment user streak using Firebase transaction
 *
 * Request body:
 * - version: number (for conflict detection)
 * - xpEarned: number (optional, defaults to minimum required XP)
 *
 * Response:
 * - success: boolean
 * - data: StreakData | null
 * - streakIncremented: boolean
 * - newRecordSet: boolean
 * - conflictDetected?: boolean
 * - error?: string
 */
export async function POST(req: NextRequest) {
  try {
    // Get auth token from request
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid authorization header'
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify token with Firebase Admin
    const decodedToken = await getAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid user ID'
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { version, xpEarned = 25 } = body; // Default to minimum XP

    // Check if user is premium (for freeze eligibility)
    const isPremium = decodedToken.stripeRole === 'premium' || false;

    // Call streak service
    const result = await updateStreakTransaction(userId, xpEarned, {
      isPremium,
      expectedVersion: typeof version === 'number' ? version : undefined
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          streakIncremented: false,
          newRecordSet: false,
          error: result.error,
          conflictDetected: result.conflictDetected
        },
        { status: result.conflictDetected ? 409 : 500 }
      );
    }

    // Return success with streak data
    return NextResponse.json({
      success: true,
      data: result.data && {
        current: result.data.current,
        best: result.data.best,
        lastActivityDate: result.data.lastActivityDate,
        freezesRemaining: result.data.freezesRemaining,
        version: result.data.version,
        updatedAt: result.data.updatedAt
      },
      streakIncremented: result.streakIncremented,
      newRecordSet: result.newRecordSet
    });

  } catch (error: any) {
    console.error('[API] Streak increment error:', error);

    // Handle specific Firebase errors
    if (error.code === 'auth/id-token-expired') {
      return NextResponse.json(
        {
          success: false,
          error: 'Token expired'
        },
        { status: 401 }
      );
    }

    if (error.code === 'auth/argument-error') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid token'
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error'
      },
      { status: 500 }
    );
  }
}
