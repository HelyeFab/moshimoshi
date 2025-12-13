/**
 * API Route: POST /api/quiz/complete
 * Records quiz completion (story/comic) and awards XP
 * XP is only awarded on first completion (no retakes)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { recordQuizCompletion } from '@/lib/gamification/services/gamification-coordinator'
import { getStorageDecision } from '@/lib/api/storage-helper'
import { FieldValue } from 'firebase-admin/firestore'

// Request validation schema
const QuizCompleteSchema = z.object({
  contentType: z.enum(['story', 'comic']),
  contentId: z.string().min(1),
  score: z.number().min(0).max(100),
  totalQuestions: z.number().min(1),
  correctAnswers: z.number().min(0),
})

/**
 * POST /api/quiz/complete
 * Mark a quiz as complete and award XP based on score
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validate request body
    const parseResult = QuizCompleteSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid request body',
            details: parseResult.error.issues,
          },
        },
        { status: 400 }
      )
    }

    const { contentType, contentId, score, totalQuestions, correctAnswers } = parseResult.data

    // Get user's premium status
    const storageDecision = await getStorageDecision(session)
    const isPremium = storageDecision.shouldWriteToFirebase

    // Check if quiz was already completed (no double XP)
    const progressId = `${session.uid}_${contentType}_${contentId}`
    const progressRef = adminDb!.collection('quiz_progress').doc(progressId)
    const progressDoc = await progressRef.get()

    if (progressDoc.exists && progressDoc.data()?.completed) {
      console.log('[Quiz Complete API] Quiz already completed, no XP awarded:', {
        userId: session.uid,
        contentType,
        contentId,
      })

      return NextResponse.json({
        success: true,
        data: {
          xpEarned: 0,
          newTotalXP: 0,
          newLevel: 1,
          streakIncremented: false,
          currentStreak: 0,
          alreadyCompleted: true,
          previousScore: progressDoc.data()?.score || 0,
        },
      })
    }

    // Record gamification (XP + streak)
    let gamificationResult = null
    if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION === 'true') {
      try {
        gamificationResult = await recordQuizCompletion({
          userId: session.uid,
          contentType,
          contentId,
          score,
          totalQuestions,
          correctAnswers,
          isPremium,
        })

        console.log('[Quiz Complete API] Gamification recorded:', {
          contentType,
          contentId,
          score,
          xpEarned: gamificationResult.xpEarned,
          streakIncremented: gamificationResult.streakIncremented,
          currentStreak: gamificationResult.currentStreak,
        })
      } catch (error) {
        console.error('[Quiz Complete API] Failed to record gamification:', error)
        // Continue without gamification - don't fail the whole request
      }
    }

    // Save progress to Firebase
    const nowIso = new Date().toISOString()
    const progressData = {
      progressId,
      userId: session.uid,
      contentType,
      contentId,
      score,
      totalQuestions,
      correctAnswers,
      completed: true,
      xpEarned: gamificationResult?.xpEarned || 0,
      completedAt: nowIso,
      updatedAt: nowIso,
    }

    await progressRef.set(progressData, { merge: true })

    return NextResponse.json({
      success: true,
      data: {
        xpEarned: gamificationResult?.xpEarned || 0,
        newTotalXP: gamificationResult?.newTotalXP || 0,
        newLevel: gamificationResult?.newLevel || 1,
        streakIncremented: gamificationResult?.streakIncremented || false,
        currentStreak: gamificationResult?.currentStreak || 0,
        alreadyCompleted: false,
      },
    })
  } catch (error) {
    console.error('[Quiz Complete API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to save quiz progress' },
      },
      { status: 500 }
    )
  }
}
