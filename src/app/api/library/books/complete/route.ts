/**
 * API Route: POST /api/library/books/complete
 * Records book completion and awards XP
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { recordBookCompletion } from '@/lib/gamification/services/gamification-coordinator'
import { getStorageDecision } from '@/lib/api/storage-helper'
import { FieldValue } from 'firebase-admin/firestore'

/**
 * POST /api/library/books/complete
 * Mark a book as complete and award XP based on reading time
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
    const { bookId, readingTimeSec } = body

    // Validate required fields
    if (!bookId || typeof readingTimeSec !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'bookId and readingTimeSec are required' },
        },
        { status: 400 }
      )
    }

    // Get user's premium status
    const storageDecision = await getStorageDecision(session)
    const isPremium = storageDecision.shouldWriteToFirebase

    // Check if book was already completed (no double XP)
    const progressId = `${session.uid}_${bookId}`
    const progressRef = adminDb!.collection('bookProgress').doc(progressId)
    const progressDoc = await progressRef.get()

    if (progressDoc.exists && progressDoc.data()?.completed) {
      console.log('[Book Complete API] Book already completed, no XP awarded:', {
        userId: session.uid,
        bookId,
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
        gamificationResult = await recordBookCompletion({
          userId: session.uid,
          bookId,
          readingTimeSec,
          isPremium,
        })

        console.log('[Book Complete API] Gamification recorded:', {
          xpEarned: gamificationResult.xpEarned,
          streakIncremented: gamificationResult.streakIncremented,
          currentStreak: gamificationResult.currentStreak,
        })
      } catch (error) {
        console.error('[Book Complete API] Failed to record gamification:', error)
        // Continue without gamification - don't fail the whole request
      }
    }

    // Save progress to Firebase
    const nowIso = new Date().toISOString()
    const progressData = {
      userId: session.uid,
      bookId,
      lastReadAt: nowIso,
      timeSpentSec: FieldValue.increment(readingTimeSec),
      completed: true,
      completedAt: nowIso,
      xpEarned: gamificationResult?.xpEarned || 0,
      updatedAt: nowIso,
      // Only set createdAt if document doesn't exist
      ...(progressDoc.exists ? {} : { createdAt: nowIso }),
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
    console.error('[Book Complete API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to save progress' },
      },
      { status: 500 }
    )
  }
}
