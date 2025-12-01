/**
 * Streak Save API Endpoint
 * Phase 2: XP-Save Mechanic
 *
 * Allows users to trade XP to save a breaking streak by extending grace period.
 *
 * POST - Save streak (deduct XP, extend grace period)
 * GET  - Check eligibility (preview cost, validate)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession, authOptions } from '@/lib/auth'
import { adminFirestore as db } from '@/lib/firebase/admin'
import { getStreakConfig } from '@/config/gamification/streakConfig'
import {
  getCurrentDateUTC,
  getDateUTC,
  calculateDaysDifference
} from '@/lib/gamification/services/streakService'
import { FieldValue } from 'firebase-admin/firestore'
import logger from '@/lib/logger'

// ============================================================================
// Types
// ============================================================================

interface StreakSaveResult {
  success: true
  xpDeducted: number
  newXP: number
  newLevel: number
  streakSaved: number
  newLastActivityDate: string
  costBreakdown: {
    baseCost: number
    surgePricing: boolean
    daysSinceActivity: number
    totalCost: number
  }
}

interface StreakSaveError {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, any>
  }
}

interface EligibilityCheckResult {
  canSave: boolean
  reason: string
  cost: number | null
  userXP: number | null
  streakToSave: number | null
  daysSinceActivity: number | null
  costBreakdown: {
    baseCost: number
    surgePricing: boolean
    daysSince: number
    totalCost: number
  } | null
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate cost to save streak with surge pricing
 */
function calculateStreakSaveCost(
  baseCost: number,
  daysSinceActivity: number,
  surgePricing: boolean
): number {
  if (surgePricing) {
    return baseCost * daysSinceActivity
  }
  return baseCost
}

/**
 * Validate if user is eligible to save streak
 * Returns error message if not eligible, null if eligible
 *
 * Phase 2.5 Update: Uses brokenAt timestamp instead of grace period logic
 */
function validateEligibility(params: {
  currentStreak: number
  brokenAt: string | null
  daysSinceBreak: number
  maxSaveWindow: number
  userXP: number
  cost: number
  originalStreak: number  // What streak was before breaking
}): string | null {
  const { currentStreak, brokenAt, daysSinceBreak, maxSaveWindow, userXP, cost, originalStreak } = params

  // Streak must be broken (current = 0)
  if (currentStreak > 0) {
    return 'Streak is still active (hasn\'t broken yet)'
  }

  // Must have original streak to restore
  if (originalStreak === 0) {
    return 'No streak to save (best streak is 0)'
  }

  // Must have brokenAt timestamp
  if (!brokenAt) {
    return 'Streak never broke (no brokenAt timestamp)'
  }

  // Phase 2.5: Allow same-day saves (auto-break happens right before save prompt)
  // Only check if beyond max save window
  if (daysSinceBreak > maxSaveWindow) {
    return `Too late to save (${daysSinceBreak} days > ${maxSaveWindow} day window)`
  }

  // Must have sufficient XP
  if (userXP < cost) {
    return `Insufficient XP (need ${cost} XP, have ${userXP} XP)`
  }

  return null // Eligible!
}

// ============================================================================
// GET Handler - Check Eligibility (Read-Only)
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // 2. Feature gate check
    const config = getStreakConfig()
    if (!config.streakSave?.enabled) {
      return NextResponse.json(
        { canSave: false, reason: 'Feature not enabled' } as EligibilityCheckResult,
        { status: 200 }
      )
    }

    // 3. Read user stats (read-only, no transaction needed)
    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      )
    }
    const userStatsRef = db.collection('user_stats').doc(userId)
    const doc = await userStatsRef.get()

    if (!doc.exists) {
      return NextResponse.json(
        { canSave: false, reason: 'User stats not found' } as EligibilityCheckResult,
        { status: 200 }
      )
    }

    const data = doc.data()!

    // Extract data
    const currentXP = data.xp?.total ?? 0
    const currentStreak = data.streak?.current ?? 0
    const bestStreak = data.streak?.best ?? 0
    const brokenAt = data.streak?.brokenAt ?? null
    const lastActivityDate = data.dates?.lastActivityDate ?? null
    const today = getCurrentDateUTC()

    // 4. Check if streak is broken (Phase 2.5: Must be 0 to save)
    if (currentStreak > 0) {
      return NextResponse.json({
        canSave: false,
        reason: 'Streak is still active (hasn\'t broken yet)',
        cost: null,
        userXP: currentXP,
        streakToSave: currentStreak,
        daysSinceActivity: null,
        costBreakdown: null
      } as EligibilityCheckResult)
    }

    // Must have brokenAt timestamp
    if (!brokenAt) {
      return NextResponse.json({
        canSave: false,
        reason: 'Streak never broke (no brokenAt timestamp)',
        cost: null,
        userXP: currentXP,
        streakToSave: bestStreak,  // Show best streak
        daysSinceActivity: null,
        costBreakdown: null
      } as EligibilityCheckResult)
    }

    // Must have lastActivityDate to calculate cost
    if (!lastActivityDate) {
      return NextResponse.json({
        canSave: false,
        reason: 'No activity date found',
        cost: null,
        userXP: currentXP,
        streakToSave: bestStreak,
        daysSinceActivity: null,
        costBreakdown: null
      } as EligibilityCheckResult)
    }

    // Phase 2.5: Calculate cost based on days since LAST ACTIVITY, not days since break
    // This is because auto-break happens immediately before showing the modal
    const daysSinceActivity = calculateDaysDifference(lastActivityDate, today)
    const brokenDate = brokenAt.split('T')[0]
    const daysSinceBreak = calculateDaysDifference(brokenDate, today)

    // 5. Get config values
    const baseCost = config.streakSave.baseCost
    const surgePricing = config.streakSave.surgePricing
    const maxSaveWindow = config.streakSave.maxSaveWindow

    // 6. Calculate cost based on days since ACTIVITY (not break)
    const cost = calculateStreakSaveCost(baseCost, daysSinceActivity, surgePricing)

    // 7. Validate eligibility (use daysSinceActivity for window check)
    const errorMessage = validateEligibility({
      currentStreak,
      brokenAt,
      daysSinceBreak: daysSinceActivity, // Phase 2.5: Check window based on activity, not break
      maxSaveWindow,
      userXP: currentXP,
      cost,
      originalStreak: bestStreak
    })

    if (errorMessage) {
      return NextResponse.json({
        canSave: false,
        reason: errorMessage,
        cost,
        userXP: currentXP,
        streakToSave: bestStreak,
        daysSinceActivity,
        costBreakdown: {
          baseCost,
          surgePricing,
          daysSince: daysSinceActivity,
          totalCost: cost
        }
      } as EligibilityCheckResult)
    }

    // 8. Eligible!
    return NextResponse.json({
      canSave: true,
      reason: 'Eligible to save streak',
      cost,
      userXP: currentXP,
      streakToSave: bestStreak,
      daysSinceActivity,
      costBreakdown: {
        baseCost,
        surgePricing,
        daysSince: daysSinceActivity,
        totalCost: cost
      }
    } as EligibilityCheckResult)

  } catch (error) {
    logger.error('[Streak Save Check] Error:', error)
    return NextResponse.json(
      {
        canSave: false,
        reason: 'Internal server error',
        cost: null,
        userXP: null,
        streakToSave: null,
        daysSinceActivity: null,
        costBreakdown: null
      } as EligibilityCheckResult,
      { status: 500 }
    )
  }
}

// ============================================================================
// POST Handler - Save Streak (Transaction)
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json<StreakSaveError>(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // 2. Feature gate check
    const config = getStreakConfig()
    if (!config.streakSave?.enabled) {
      return NextResponse.json<StreakSaveError>(
        {
          success: false,
          error: {
            code: 'FEATURE_DISABLED',
            message: 'Streak save feature is not enabled'
          }
        },
        { status: 403 }
      )
    }

    // 3. Get config values
    const baseCost = config.streakSave.baseCost
    const surgePricing = config.streakSave.surgePricing
    const maxSaveWindow = config.streakSave.maxSaveWindow

    // 4. Run transaction
    if (!db) {
      return NextResponse.json<StreakSaveError>(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Database not initialized'
          }
        },
        { status: 500 }
      )
    }
    // Capture in local const for TypeScript narrowing inside transaction callback
    const firestore = db
    const userStatsRef = firestore.collection('user_stats').doc(userId)

    const result = await db.runTransaction(async (transaction) => {
      // Read user stats
      const doc = await transaction.get(userStatsRef)

      if (!doc.exists) {
        throw new Error('User stats not found')
      }

      const data = doc.data()!

      // Extract current state
      const currentXP = data.xp?.total ?? 0
      const currentLevel = data.xp?.level ?? 1
      const currentStreak = data.streak?.current ?? 0
      const bestStreak = data.streak?.best ?? 0
      const brokenAt = data.streak?.brokenAt ?? null
      const lastActivityDate = data.dates?.lastActivityDate ?? null
      const streakVersion = data.streak?.version ?? 0
      const today = getCurrentDateUTC()

      // Validate brokenAt exists
      if (!brokenAt) {
        throw new Error('Streak never broke (no brokenAt timestamp)')
      }

      // Validate lastActivityDate exists
      if (!lastActivityDate) {
        throw new Error('No activity date found')
      }

      // Phase 2.5: Calculate cost based on days since ACTIVITY (not break)
      const daysSinceActivity = calculateDaysDifference(lastActivityDate, today)
      const brokenDate = brokenAt.split('T')[0]
      const daysSinceBreak = calculateDaysDifference(brokenDate, today)

      // Calculate cost based on activity days
      const cost = calculateStreakSaveCost(baseCost, daysSinceActivity, surgePricing)

      // Validate eligibility (CRITICAL: Re-validate inside transaction with fresh data)
      const errorMessage = validateEligibility({
        currentStreak,
        brokenAt,
        daysSinceBreak: daysSinceActivity, // Phase 2.5: Validate based on activity, not break
        maxSaveWindow,
        userXP: currentXP,
        cost,
        originalStreak: bestStreak
      })

      if (errorMessage) {
        throw new Error(errorMessage)
      }

      // Calculate new values
      const newXP = currentXP - cost
      const newLevel = Math.max(1, Math.floor(newXP / 1000))
      const yesterday = getDateUTC(new Date(), -1) // Extend grace period to yesterday

      // Update user stats (atomic write)
      // Phase 2.5: Restore streak, clear brokenAt, extend to yesterday
      transaction.update(userStatsRef, {
        'xp.total': newXP,
        'xp.level': newLevel,
        'dates.lastActivityDate': yesterday,
        'dates.isActiveToday': false,
        'streak.current': bestStreak,           // RESTORE streak
        'streak.brokenAt': null,                // CLEAR break timestamp
        'streak.version': FieldValue.increment(1),
        'metadata.lastUpdated': new Date().toISOString(),
        'metadata.streakSaveCount': FieldValue.increment(1)
      })

      // Log to streak_save_logs collection (within transaction for consistency)
      const logRef = firestore.collection('streak_save_logs').doc()
      transaction.set(logRef, {
        userId,
        streakSaved: bestStreak,              // Restored streak value
        xpDeducted: cost,
        xpBefore: currentXP,
        xpAfter: newXP,
        daysSinceActivity,                    // Phase 2.5: Days inactive (used for cost)
        daysSinceBreak,                       // Days since auto-break happened
        brokenAt,                             // When streak broke
        lastActivityDate,                     // When user was last active
        restoredTo: yesterday,                // Extended to yesterday
        costBreakdown: {
          baseCost,
          surgePricing,
          daysSince: daysSinceActivity,       // Cost based on activity days
          totalCost: cost
        },
        timestamp: FieldValue.serverTimestamp(),
        createdAt: new Date().toISOString()
      })

      return {
        xpDeducted: cost,
        newXP,
        newLevel,
        streakSaved: bestStreak,
        newLastActivityDate: yesterday,
        costBreakdown: {
          baseCost,
          surgePricing,
          daysSinceActivity,
          totalCost: cost
        }
      }
    })

    // Success!
    logger.info('[Streak Save] Success:', { userId, ...result })

    return NextResponse.json<StreakSaveResult>({
      success: true,
      ...result
    })

  } catch (error) {
    logger.error('[Streak Save] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json<StreakSaveError>(
      {
        success: false,
        error: {
          code: 'SAVE_FAILED',
          message: errorMessage
        }
      },
      { status: 400 }
    )
  }
}
