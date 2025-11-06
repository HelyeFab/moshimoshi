/**
 * Streak Auto-Break Scheduled Function
 * Phase 2.5: Database Sync & Auto-Break System
 *
 * Runs every hour to automatically break streaks that are beyond grace period.
 * This ensures DB and UI stay in sync even if user doesn't open the app.
 *
 * Architecture:
 * - Scheduled: Runs hourly via Cloud Scheduler
 * - Client-side: useStreakSaveDetection calls break endpoint on app open
 * - Manual: /api/gamification/streak/break endpoint
 */

import { onSchedule } from 'firebase-functions/v2/scheduler'
import * as admin from 'firebase-admin'

const db = admin.firestore()

/**
 * Calculate days between two dates (UTC)
 */
function calculateDaysDifference(date1String: string, date2String: string): number {
  const d1 = new Date(date1String + 'T00:00:00.000Z')
  const d2 = new Date(date2String + 'T00:00:00.000Z')
  const diffMs = d2.getTime() - d1.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Get current date in UTC format (YYYY-MM-DD)
 */
function getCurrentDateUTC(): string {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

/**
 * Core logic for auto-breaking streaks
 * Extracted to be reusable by both scheduled and manual functions
 */
async function runAutoBreakStreaks() {
  console.log('[Auto-Break Scheduler] Starting streak auto-break check')

  const today = getCurrentDateUTC()
  const gracePeriodDays = 1 // 24 hours = 1 day

  let totalChecked = 0
  let totalBroken = 0
  let totalErrors = 0
  let totalAlreadyBroken = 0
  let totalWithinGrace = 0

  try {
    // Query all users with active streaks (current > 0)
    const snapshot = await db.collection('user_stats')
      .where('streak.current', '>', 0)
      .get()

    console.log(`[Auto-Break Scheduler] Found ${snapshot.size} users with active streaks`)

    // Process in batches to avoid overwhelming the database
    const BATCH_SIZE = 100
    const batches: FirebaseFirestore.DocumentSnapshot[] = []

    for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
      batches.push(...snapshot.docs.slice(i, i + BATCH_SIZE))
    }

    // Process each user
    for (const doc of snapshot.docs) {
      totalChecked++
      const userId = doc.id
      const data = doc.data()

      const currentStreak = data.streak?.current ?? 0
      const lastActivityDate = data.dates?.lastActivityDate ?? null

      // Skip if no activity date
      if (!lastActivityDate) {
        console.log(`[Auto-Break Scheduler] User ${userId}: No activity date, skipping`)
        continue
      }

      // Skip if streak already 0 (shouldn't happen due to query, but defensive)
      if (currentStreak === 0) {
        totalAlreadyBroken++
        continue
      }

      // Calculate days since last activity
      const daysSince = calculateDaysDifference(lastActivityDate, today)

      // Check if beyond grace period
      if (daysSince <= gracePeriodDays) {
        totalWithinGrace++
        continue // Still within grace, no action needed
      }

      // Beyond grace period - break the streak!
      try {
        await db.runTransaction(async (transaction) => {
          const userStatsRef = db.collection('user_stats').doc(userId)
          const freshDoc = await transaction.get(userStatsRef)

          if (!freshDoc.exists) {
            throw new Error('User stats not found')
          }

          const freshData = freshDoc.data()!
          const freshStreak = freshData.streak?.current ?? 0

          // Double-check streak is still active
          if (freshStreak === 0) {
            totalAlreadyBroken++
            return
          }

          // Break the streak
          const now = new Date().toISOString()
          transaction.update(userStatsRef, {
            'streak.current': 0,
            'streak.brokenAt': now,
            'streak.version': admin.firestore.FieldValue.increment(1),
            'metadata.lastUpdated': now
          })

          console.log(`[Auto-Break Scheduler] User ${userId}: Broke streak of ${freshStreak} days (${daysSince} days since activity)`)
          totalBroken++
        })
      } catch (error) {
        console.error(`[Auto-Break Scheduler] User ${userId}: Error breaking streak:`, error)
        totalErrors++
      }
    }

    console.log('[Auto-Break Scheduler] Completed:', {
      totalChecked,
      totalBroken,
      totalAlreadyBroken,
      totalWithinGrace,
      totalErrors
    })

  } catch (error) {
    console.error('[Auto-Break Scheduler] Fatal error:', error)
    throw error
  }

  return null
}

/**
 * Scheduled function to auto-break streaks beyond grace period
 * Runs every hour
 */
export const autoBreakStreaks = onSchedule(
  {
    schedule: '0 * * * *', // Every hour at :00
    timeZone: 'UTC',
    region: 'europe-west1',
    memory: '256MiB',
    timeoutSeconds: 300 // 5 minutes
  },
  runAutoBreakStreaks
)

// Manual function removed
// To manually trigger auto-break, use: /api/gamification/streak/break endpoint
