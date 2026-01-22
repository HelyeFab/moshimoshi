/**
 * API Route: POST /api/news/progress/complete
 * Records news article completion and awards XP
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { recordNewsCompletion } from '@/lib/gamification/services/gamification-coordinator'
import { getStorageDecision } from '@/lib/api/storage-helper'
import { FieldValue } from 'firebase-admin/firestore'

/**
 * POST /api/news/progress/complete
 * Mark an article as complete and award XP based on reading time
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
    const { articleId, readingTimeMs, difficulty } = body

    // Validate required fields
    if (!articleId || typeof readingTimeMs !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'articleId and readingTimeMs are required' },
        },
        { status: 400 }
      )
    }

    // Get user's premium status
    const storageDecision = await getStorageDecision(session)
    const isPremium = storageDecision.shouldWriteToFirebase

    // Check if article was already completed (no double XP)
    const odcId = `${session.uid}_${articleId}`
    const progressRef = adminDb!.collection('news_progress').doc(odcId)
    const progressDoc = await progressRef.get()

    if (progressDoc.exists && progressDoc.data()?.completed) {
      console.log('[News Progress API] Article already completed, no XP awarded:', {
        userId: session.uid,
        articleId,
      })

      return NextResponse.json({
        success: true,
        data: {
          xpEarned: 0,
          newTotalXP: progressDoc.data()?.xpEarned || 0,
          newLevel: 1,
          streakIncremented: false,
          currentStreak: 0,
          bestStreak: 0,
          alreadyCompleted: true,
        },
      })
    }

    // Record gamification (XP + streak)
    let gamificationResult = null
    if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION === 'true') {
      try {
        gamificationResult = await recordNewsCompletion({
          userId: session.uid,
          articleId,
          readingTimeMs,
          difficulty: difficulty || 'N5',
          isPremium,
        })

        console.log('[News Progress API] Gamification recorded:', {
          xpEarned: gamificationResult.xpEarned,
          streakIncremented: gamificationResult.streakIncremented,
          currentStreak: gamificationResult.currentStreak,
        })
      } catch (error) {
        console.error('[News Progress API] Failed to record gamification:', error)
        // Continue without gamification - don't fail the whole request
      }
    }

    // Save progress to Firebase
    const nowIso = new Date().toISOString()
    const progressData = {
      odcId,
      userId: session.uid,
      articleId,
      difficulty: difficulty || 'N5',
      lastReadAt: nowIso,
      totalReadTimeMs: FieldValue.increment(readingTimeMs),
      completed: true,
      xpEarned: gamificationResult?.xpEarned || 0,
      version: FieldValue.increment(1),
      updatedAt: nowIso,
      // Only set firstReadAt if document doesn't exist
      ...(progressDoc.exists ? {} : { firstReadAt: nowIso }),
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
          bestStreak: gamificationResult?.bestStreak || 0,
          alreadyCompleted: false,
        },
      })
  } catch (error) {
    console.error('[News Progress API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to save progress' },
      },
      { status: 500 }
    )
  }
}
