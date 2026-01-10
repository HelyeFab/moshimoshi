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
import { getSession } from '@/lib/auth/session';
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
    let userId: string | null = null;
    const authHeader = req.headers.get('authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decodedToken = await getAuth().verifyIdToken(token);
        userId = decodedToken.uid;
      } catch (error: any) {
        if (error.code === 'auth/id-token-expired') {
          return NextResponse.json(
            { success: false, error: 'Token expired' },
            { status: 401 }
          );
        }
        if (error.code === 'auth/argument-error') {
          return NextResponse.json(
            { success: false, error: 'Invalid token' },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { success: false, error: 'Invalid token' },
          { status: 401 }
        );
      }
    } else {
      const session = await getSession();
      if (!session) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
      userId = session.uid;
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID' },
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

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error'
      },
      { status: 500 }
    );
  }
}
