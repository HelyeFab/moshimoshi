/**
 * API Route: Reset User Streak
 *
 * POST /api/gamification/streak/reset
 *
 * Uses Firebase transactions to reset streak atomically.
 * Implements version-based conflict detection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { resetStreak } from '@/lib/gamification/services/streakService';

/**
 * POST /api/gamification/streak/reset
 *
 * Reset user streak using Firebase transaction
 *
 * Request body:
 * - version: number (for conflict detection)
 *
 * Response:
 * - success: boolean
 * - data: Partial<StreakData> | null
 * - error?: string
 * - conflictDetected?: boolean
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

    // Call streak service
    const result = await resetStreak(userId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: result.error
        },
        { status: 500 }
      );
    }

    // Return success
    return NextResponse.json({
      success: true,
      data: result.data && {
        current: result.data.current,
        best: result.data.best,
        lastActivityDate: result.data.lastActivityDate,
        freezesRemaining: result.data.freezesRemaining,
        version: result.data.version,
        updatedAt: result.data.updatedAt
      }
    });

  } catch (error: any) {
    console.error('[API] Streak reset error:', error);

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
