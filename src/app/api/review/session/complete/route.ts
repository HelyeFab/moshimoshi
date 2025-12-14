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
import { getSession } from '@/lib/auth/session';
import { recordReviewCompletion } from '@/lib/gamification/services/gamification-coordinator';
import { adminDb } from '@/lib/firebase/admin';

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
 * - bestStreak?: number (optional - for flashcard sessions)
 * - fastCards?: number (optional - for flashcard sessions)
 *
 * Response:
 * - success: boolean
 * - gamification: GamificationResult
 * - error?: string
 */
export async function POST(req: NextRequest) {
  try {
    // Use standard session-based auth (same as all other routes)
    const session = await getSession();

    if (!session?.uid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not authenticated'
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { sessionId, itemsReviewed, correctCount, accuracy, bestStreak, fastCards } = body;

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
    const userDoc = await adminDb!.collection('users').doc(session.uid).get();
    const userData = userDoc.data();
    const plan = userData?.subscription?.plan || 'free';
    const isPremium = plan === 'premium_monthly' || plan === 'premium_yearly';

    // Record review completion via coordinator (atomic transaction)
    // Pass flashcard-specific params if provided (for accurate XP calculation)
    const gamificationResult = await recordReviewCompletion({
      userId: session.uid,
      sessionId,
      itemsReviewed,
      correctCount,
      accuracy,
      isPremium,
      // Flashcard-specific params (optional)
      bestStreak: typeof bestStreak === 'number' ? bestStreak : undefined,
      fastCards: typeof fastCards === 'number' ? fastCards : undefined,
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
