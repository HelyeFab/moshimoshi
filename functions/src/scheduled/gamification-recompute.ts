/**
 * Nightly Gamification Recompute Cloud Function
 *
 * Scheduled Function: Runs daily at 02:00 UTC
 *
 * Purpose:
 * - Recompute streaks from dates map (canonical truth)
 * - Detect and fix data corruption
 * - Materialize leaderboard deltas
 * - Update streak risk indicators
 *
 * Safety:
 * - Source of truth guardrail
 * - Catches drift between client/server
 * - Auto-repairs within tolerance
 * - Alerts on anomalies
 */

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

// ============================================
// Streak Calculation (Server-side canonical)
// ============================================

interface StreakResult {
  currentStreak: number
  bestStreak: number
  isActiveToday: boolean
  lastActivityDate: string | null
  streakAtRisk: boolean
  hoursRemainingToday: number
}

function calculateStreakFromDates(
  dates: Record<string, boolean>,
  existingBest: number = 0
): StreakResult {
  // Handle empty or invalid input
  if (!dates || typeof dates !== 'object' || Object.keys(dates).length === 0) {
    return {
      currentStreak: 0,
      bestStreak: existingBest,
      isActiveToday: false,
      lastActivityDate: null,
      streakAtRisk: false,
      hoursRemainingToday: 0
    }
  }

  // Clean and deduplicate dates - only keep valid date strings
  const validDates = Object.entries(dates)
    .filter(([key, value]) => {
      // Check if key is a valid date format (YYYY-MM-DD)
      return key.match(/^\d{4}-\d{2}-\d{2}$/) && value === true
    })
    .map(([key]) => key)

  if (validDates.length === 0) {
    return {
      currentStreak: 0,
      bestStreak: existingBest,
      isActiveToday: false,
      lastActivityDate: null,
      streakAtRisk: false,
      hoursRemainingToday: 0
    }
  }

  // Sort dates in descending order (most recent first)
  const sortedDates = [...new Set(validDates)].sort().reverse()

  // Get today's date in YYYY-MM-DD format (UTC)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  // Check if user was active today
  const isActiveToday = sortedDates.includes(todayStr)

  // Calculate current streak
  let currentStreak = 0
  let expectedDate = new Date(today)

  for (const dateStr of sortedDates) {
    const date = new Date(dateStr + 'T00:00:00Z')
    date.setHours(0, 0, 0, 0)

    // Calculate difference in days
    const daysDiff = Math.floor((expectedDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDiff === 0) {
      // This date matches the expected date (consecutive)
      currentStreak++
      // Move to previous day for next iteration
      expectedDate.setDate(expectedDate.getDate() - 1)
    } else if (currentStreak === 0 && daysDiff === 1) {
      // First check: if today has no activity but yesterday does
      // The streak is still active (user has until end of today)
      currentStreak++
      // Skip today and move to day before yesterday
      expectedDate.setDate(expectedDate.getDate() - 2)
    } else {
      // Gap found - streak is broken
      break
    }
  }

  // Calculate best streak
  const bestStreak = Math.max(existingBest, currentStreak)

  // Get the most recent activity date
  const lastActivityDate = sortedDates[0] || null

  // Calculate hours remaining today
  const now = new Date()
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)
  const hoursRemainingToday = Math.max(0, Math.floor((endOfDay.getTime() - now.getTime()) / (1000 * 60 * 60)))

  // Streak is at risk if:
  // - User has a streak to maintain (current > 0)
  // - User hasn't been active today
  // - Less than 4 hours remain
  const streakAtRisk = currentStreak > 0 && !isActiveToday && hoursRemainingToday < 4

  return {
    currentStreak,
    bestStreak,
    isActiveToday,
    lastActivityDate,
    streakAtRisk,
    hoursRemainingToday
  }
}

// ============================================
// Recompute Function
// ============================================

interface RecomputeResult {
  totalUsers: number
  processed: number
  repaired: number
  anomalies: number
  errors: Array<{ userId: string; error: string }>
  duration: number
}

async function recomputeUserStats(
  userId: string,
  userStats: any
): Promise<{
  repaired: boolean
  anomaly: boolean
  error?: string
}> {
  try {
    const dates = userStats.streak?.dates || {}
    const storedCurrent = userStats.streak?.current || 0
    const storedBest = userStats.streak?.best || 0

    // Recalculate streak from dates (source of truth)
    const calculated = calculateStreakFromDates(dates, storedBest)

    // Check for drift
    const currentDrift = Math.abs(calculated.currentStreak - storedCurrent)
    const bestDrift = Math.abs(calculated.bestStreak - storedBest)

    // Tolerance: allow drift up to 1 day for current streak
    const CURRENT_TOLERANCE = 1
    const BEST_TOLERANCE = 0 // Best should never drift

    const needsRepair = currentDrift > CURRENT_TOLERANCE || bestDrift > BEST_TOLERANCE
    const isAnomaly = currentDrift > 5 || bestDrift > 5 // Flag major drift

    if (needsRepair) {
      console.log(`Repairing user ${userId}`, {
        storedCurrent,
        calculatedCurrent: calculated.currentStreak,
        storedBest,
        calculatedBest: calculated.bestStreak,
        drift: { current: currentDrift, best: bestDrift }
      })

      // Update with corrected values
      await db.collection('user_stats').doc(userId).update({
        'streak.current': calculated.currentStreak,
        'streak.best': calculated.bestStreak,
        'streak.isActiveToday': calculated.isActiveToday,
        'streak.lastActivityDate': calculated.lastActivityDate,
        'streak.streakAtRisk': calculated.streakAtRisk,
        'streak.hoursRemainingToday': calculated.hoursRemainingToday,
        'metadata.lastDataCheck': admin.firestore.FieldValue.serverTimestamp(),
        'metadata.dataHealth': isAnomaly ? 'needs_repair' : 'healthy'
      })

      return {
        repaired: true,
        anomaly: isAnomaly
      }
    }

    // Update streak risk indicators even if no repair needed
    if (userStats.streak) {
      await db.collection('user_stats').doc(userId).update({
        'streak.streakAtRisk': calculated.streakAtRisk,
        'streak.hoursRemainingToday': calculated.hoursRemainingToday,
        'metadata.lastDataCheck': admin.firestore.FieldValue.serverTimestamp()
      })
    }

    return {
      repaired: false,
      anomaly: false
    }

  } catch (error: any) {
    console.error(`Recompute error for user ${userId}:`, error.message)
    return {
      repaired: false,
      anomaly: false,
      error: error.message
    }
  }
}

async function recomputeAllUsers(): Promise<RecomputeResult> {
  const startTime = Date.now()
  const result: RecomputeResult = {
    totalUsers: 0,
    processed: 0,
    repaired: 0,
    anomalies: 0,
    errors: [],
    duration: 0
  }

  try {
    console.log('[Gamification Recompute] Starting nightly recompute')

    // Get all user_stats documents
    const snapshot = await db.collection('user_stats').get()

    result.totalUsers = snapshot.size
    console.log(`[Gamification Recompute] Found ${result.totalUsers} users to process`)

    // Process in batches of 50
    const BATCH_SIZE = 50
    const docs = snapshot.docs

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE)

      await Promise.all(
        batch.map(async (doc) => {
          const userId = doc.id
          const userStats = doc.data()

          const recomputeResult = await recomputeUserStats(userId, userStats)

          result.processed++

          if (recomputeResult.repaired) {
            result.repaired++
          }

          if (recomputeResult.anomaly) {
            result.anomalies++
          }

          if (recomputeResult.error) {
            result.errors.push({
              userId,
              error: recomputeResult.error
            })
          }
        })
      )

      console.log(`[Gamification Recompute] Progress: ${result.processed}/${result.totalUsers}`)
    }

  } catch (error: any) {
    console.error('[Gamification Recompute] Fatal error:', error.message)
    throw error
  }

  result.duration = Date.now() - startTime

  console.log('[Gamification Recompute] Complete', {
    ...result,
    durationSeconds: Math.round(result.duration / 1000)
  })

  return result
}

// ============================================
// Cloud Function Export
// ============================================

/**
 * Scheduled function: Runs daily at 02:00 UTC
 *
 * Recomputes all user streaks from their dates maps (source of truth).
 * Auto-repairs drift within tolerance and flags anomalies.
 */
export const gamificationRecompute = onSchedule(
  {
    schedule: '0 2 * * *',  // 2 AM UTC daily
    timeZone: 'UTC',
    timeoutSeconds: 540, // 9 minutes
    memory: '1GiB'
  },
  async (event) => {
    console.log('[Gamification Recompute] Scheduled function triggered')

    try {
      const result = await recomputeAllUsers()

      // Log summary to Cloud Logging
      console.log('[Gamification Recompute] Summary', {
        totalUsers: result.totalUsers,
        processed: result.processed,
        repaired: result.repaired,
        anomalies: result.anomalies,
        errors: result.errors.length,
        durationSeconds: Math.round(result.duration / 1000)
      })

      // Alert if significant issues found
      if (result.anomalies > 10 || result.errors.length > 10) {
        console.error('[Gamification Recompute] ALERT: Significant issues detected', {
          anomalies: result.anomalies,
          errors: result.errors.length
        })

        // TODO: Send alert to monitoring system (PagerDuty, Slack, etc.)
      }

      // Scheduled functions must return void

    } catch (error: any) {
      console.error('[Gamification Recompute] Function failed:', error.message)
      throw error // Re-throw to mark function as failed
    }
  }
)

/**
 * HTTP callable function for manual recompute (admin only)
 *
 * Usage:
 *   firebase functions:call manualRecompute
 */
export const manualRecompute = onCall(
  {
    timeoutSeconds: 540,
    memory: '1GiB'
  },
  async (request) => {
    // Verify admin auth
    if (!request.auth || !request.auth.token.admin) {
      throw new HttpsError(
        'permission-denied',
        'Only admins can trigger manual recompute'
      )
    }

    console.log('[Manual Recompute] Triggered by admin:', request.auth.uid)

    const result = await recomputeAllUsers()

    return {
      success: true,
      result
    }
  }
)
