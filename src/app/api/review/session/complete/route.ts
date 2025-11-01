/**
 * API Route: Complete Review Session with Gamification
 *
 * POST /api/review/session/complete
 *
 * Handles review session completion atomically:
 * - Validates session data
 * - Records gamification (XP, streaks, achievements) via coordinator
 * - Returns updated gamification state
 *
 * Used by: gamificationListener when URE emits SESSION_COMPLETED
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { recordReviewCompletion } from '@/lib/gamification/services/gamification-coordinator';

/**
 * POST /api/review/session/complete
 *
 * Complete a review session and record gamification
 *
 * Request body:
 * - sessionId: string
 * - itemsReviewed: number
 * - correctCount: number
 * - accuracy: number
 *
 * Response:
 * - success: boolean
 * - gamification: GamificationResult
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
    const { sessionId, itemsReviewed, correctCount, accuracy } = body;

    // Validate required fields
    if (!sessionId || typeof itemsReviewed !== 'number' || typeof correctCount !== 'number' || typeof accuracy !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: sessionId, itemsReviewed, correctCount, accuracy'
        },
        { status: 400 }
      );
    }

    // Check if user is premium (for streak freeze eligibility)
    const isPremium = decodedToken.stripeRole === 'premium' || false;

    // Record review completion via coordinator (atomic transaction)
    const gamificationResult = await recordReviewCompletion({
      userId,
      sessionId,
      itemsReviewed,
      correctCount,
      accuracy,
      isPremium
    });

    // Return success with gamification data
    return NextResponse.json({
      success: true,
      gamification: {
        xpEarned: gamificationResult.xpEarned,
        newTotalXP: gamificationResult.newTotalXP,
        newLevel: gamificationResult.newLevel,
        streakIncremented: gamificationResult.streakIncremented,
        currentStreak: gamificationResult.currentStreak,
        bestStreak: gamificationResult.bestStreak,
        achievementsUnlocked: gamificationResult.achievementsUnlocked
      }
    });

  } catch (error: any) {
    console.error('[API] Review session completion error:', error);

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
