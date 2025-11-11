/**
 * Break Streak API Endpoint
 * Phase 2.5: Auto-Break System
 *
 * Manually triggers streak break (used by client-side check and scheduled function)
 * POST - Break streak if eligible (beyond grace period)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession, authOptions } from '@/lib/auth'
import { adminFirestore as db } from '@/lib/firebase/admin'
import { getStreakConfig } from '@/config/gamification/streakConfig'
import {
  calculateDaysDifference,
  getCurrentDateUTC
} from '@/lib/gamification/services/streakService'
import { FieldValue } from 'firebase-admin/firestore'
import logger from '@/lib/logger'

// ============================================================================
// Types
// ============================================================================

interface BreakStreakResult {
  success: true
  broken: true
  streakBroken: number
  brokenAt: string
  daysSince: number
}

interface AlreadyBrokenResult {
  success: true
  alreadyBroken: true
  message: string
}

interface NotEligibleResult {
  success: true
  notEligible: true
  message: string
}

interface ErrorResult {
  success: false
  error: string
}

type BreakStreakResponse = BreakStreakResult | AlreadyBrokenResult | NotEligibleResult | ErrorResult

// ============================================================================
// POST Handler - Break Streak
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json<BreakStreakErrorResult>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // 2. Get config
    const config = getStreakConfig()
    const gracePeriodHours = config.gracePeriodHours
    const gracePeriodDays = Math.max(1, Math.ceil(gracePeriodHours / 24))

    // 3. Run transaction
    if (!db) {
      return NextResponse.json<BreakStreakErrorResult>(
        {
          success: false,
          error: 'Database not initialized'
        },
        { status: 500 }
      )
    }
    const userStatsRef = db.collection('user_stats').doc(userId)

    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(userStatsRef)

      if (!doc.exists) {
        throw new Error('User stats not found')
      }

      const data = doc.data()!
      const currentStreak = data.streak?.current ?? 0
      const lastActivityDate = data.dates?.lastActivityDate ?? null
      const today = getCurrentDateUTC()

      // Already broken?
      if (currentStreak === 0) {
        return {
          alreadyBroken: true,
          message: 'Streak already at 0'
        } as AlreadyBrokenResult
      }

      // No activity date?
      if (!lastActivityDate) {
        return {
          alreadyBroken: true,
          message: 'No activity date recorded'
        } as AlreadyBrokenResult
      }

      // Check if beyond grace period
      const daysSince = calculateDaysDifference(lastActivityDate, today)
      if (daysSince <= gracePeriodDays) {
        return {
          notEligible: true,
          message: `Within grace period (${daysSince} day${daysSince === 1 ? '' : 's'} <= ${gracePeriodDays} day grace period)`
        } as NotEligibleResult
      }

      // Break the streak
      const now = new Date().toISOString()
      transaction.update(userStatsRef, {
        'streak.current': 0,
        'streak.brokenAt': now,
        'streak.version': FieldValue.increment(1),
        'metadata.lastUpdated': now
      })

      return {
        broken: true,
        streakBroken: currentStreak,
        brokenAt: now,
        daysSince
      } as BreakStreakResult
    })

    logger.info('[Streak Break] Result:', { userId, ...result })

    return NextResponse.json({
      success: true,
      ...result
    })

  } catch (error) {
    logger.error('[Streak Break] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json<ErrorResult>(
      { success: false, error: errorMessage },
      { status: 400 }
    )
  }
}
