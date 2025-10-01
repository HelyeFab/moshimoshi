/**
 * Streak Store
 * Tracks consecutive days of user activity
 * Follows the guide architecture with added flexibility for activity types
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { format, differenceInDays, parseISO, startOfDay } from 'date-fns'
import logger from '@/lib/logger'
import { virtualClock } from '@/lib/time/virtualClock'
import { createUserStorage } from '@/lib/storage/zustand-user-storage'

/**
 * @deprecated Activity types are now dynamically determined from xp-config.json
 * Use StreakConfigService.getEligibleActivityIds() instead.
 * This enum is kept for backward compatibility only.
 *
 * Migration: Any activity earning 10+ XP with countsForStreak=true
 * in xp-config.json automatically counts toward streaks.
 */
export enum StreakActivity {
  REVIEW_SESSION = 'review_session',
  STUDY_SESSION = 'study_session',
  DRILL_COMPLETION = 'drill_completion',
  KANJI_MASTERY_SESSION = 'kanji_mastery_session',
  KANJI_MASTERY_ROUND = 'kanji_mastery_round',
  // Future activities can be added here:
  // QUIZ_COMPLETION = 'quiz_completion',
  // LESSON_COMPLETION = 'lesson_completion',
}

/**
 * @deprecated Configuration is now read from xp-config.json
 * Use StreakConfigService.getEligibleActivityIds() instead.
 * This constant is kept for backward compatibility only.
 */
export const STREAK_ELIGIBLE_ACTIVITIES: Set<StreakActivity> = new Set([
  StreakActivity.REVIEW_SESSION,
  StreakActivity.STUDY_SESSION,
  StreakActivity.DRILL_COMPLETION,
  StreakActivity.KANJI_MASTERY_SESSION,
  StreakActivity.KANJI_MASTERY_ROUND,
])

interface StreakState {
  // Core streak data
  currentStreak: number
  longestStreak: number
  lastActiveDay: string | null // YYYY-MM-DD format

  // Activity tracking for the day
  todayActivities: Set<StreakActivity>

  // Actions
  recordActivity: (activity: StreakActivity, timestamp?: number) => void
  loadFromSession: (timestamp: number, activity?: StreakActivity) => void
  resetStreak: () => void
  checkAndUpdateStreak: () => void

  // Utilities
  isStreakActive: () => boolean
  getDaysSinceLastActivity: () => number | null

  // For migration and sync
  setStreakData: (data: { currentStreak: number; longestStreak: number; lastActiveDay: string | null }) => void
}

export const useStreakStore = create<StreakState>()(
  persist(
    (set, get) => ({
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDay: null,
      todayActivities: new Set(),

      /**
       * @deprecated Manual streak recording is no longer needed.
       * Streaks are now automatically updated when XP is tracked via UserStatsService.
       * Any activity earning 10+ XP with countsForStreak=true in xp-config.json
       * will automatically update the streak.
       *
       * This method is kept for backward compatibility but should not be used in new code.
       */
      recordActivity: (activity: StreakActivity, timestamp: number = virtualClock.now()) => {
        // Check if this activity type counts towards streaks
        if (!STREAK_ELIGIBLE_ACTIVITIES.has(activity)) {
          logger.streak('Activity does not count towards streaks', { activity })
          return
        }

        const today = format(startOfDay(timestamp), 'yyyy-MM-dd')
        const { lastActiveDay, currentStreak, longestStreak, todayActivities } = get()

        // Track today's activities
        const newTodayActivities = new Set(todayActivities)
        newTodayActivities.add(activity)

        logger.streak('Recording activity', { activity, today })

        // If no previous activity, start a new streak
        if (!lastActiveDay) {
          set({
            currentStreak: 1,
            longestStreak: Math.max(1, longestStreak),
            lastActiveDay: today,
            todayActivities: newTodayActivities,
          })
          return
        }

        // If already recorded today, just track the activity
        if (today === lastActiveDay) {
          set({ todayActivities: newTodayActivities })
          return
        }

        // Calculate days difference
        const daysDiff = differenceInDays(
          startOfDay(timestamp),
          startOfDay(parseISO(lastActiveDay))
        )

        if (daysDiff === 1) {
          // Consecutive day - increment streak
          const newStreak = currentStreak + 1
          set({
            currentStreak: newStreak,
            longestStreak: Math.max(longestStreak, newStreak),
            lastActiveDay: today,
            todayActivities: newTodayActivities,
          })
        } else if (daysDiff > 1) {
          // Gap in days - reset streak to 1
          logger.streak('Gap detected, resetting streak', { daysDiff })
          set({
            currentStreak: 1,
            longestStreak: Math.max(longestStreak, 1),
            lastActiveDay: today,
            todayActivities: newTodayActivities,
          })
        } else {
          // This shouldn't happen (daysDiff < 0 means timestamp is in the past)
          console.warn(`[StreakStore] Unexpected date ordering: ${today} vs ${lastActiveDay}`)
        }
      },

      /**
       * @deprecated Legacy method for compatibility.
       * Use XP tracking instead - streaks update automatically when XP >= 10
       * and activity has countsForStreak=true in xp-config.json.
       */
      loadFromSession: (timestamp: number, activity: StreakActivity = StreakActivity.REVIEW_SESSION) => {
        get().recordActivity(activity, timestamp)
      },

      resetStreak: () => {
        logger.streak('Resetting streak')
        set({
          currentStreak: 0,
          lastActiveDay: null,
          todayActivities: new Set(),
        })
      },

      /**
       * Check if streak is still active (called on app load)
       * Handles the case where user hasn't been active for days
       *
       * CRITICAL: This function MUST persist state changes to storage
       * to ensure broken streaks are properly saved
       */
      checkAndUpdateStreak: () => {
        const { lastActiveDay, currentStreak } = get()

        // If no streak exists, nothing to check
        if (!lastActiveDay) {
          return
        }

        const today = format(startOfDay(virtualClock.now()), 'yyyy-MM-dd')
        const daysSinceActive = differenceInDays(
          startOfDay(virtualClock.nowDate()),
          startOfDay(parseISO(lastActiveDay))
        )

        // If more than 1 day has passed, streak is broken
        if (daysSinceActive > 1) {
          logger.streak('Streak broken due to inactivity', {
            daysSinceActive,
            lastActiveDay,
            today
          })

          // IMPORTANT: Set to 0 AND clear lastActiveDay to mark as broken
          // This ensures the state is persisted by Zustand's persist middleware
          set({
            currentStreak: 0,
            lastActiveDay: null,  // Clear to ensure fresh start
            todayActivities: new Set(),
          })

          logger.streak('Streak reset to 0 and persisted', { currentStreak: 0 })
        } else if (daysSinceActive === 1) {
          // Yesterday was active, today not yet - streak still valid but at risk
          logger.streak('Streak at risk - complete activity today', { currentStreak })
          // Clear today's activities since it's a new day
          set({ todayActivities: new Set() })
        } else if (daysSinceActive === 0) {
          // Activity already done today - all good
          logger.streak('Streak active - activity completed today', { currentStreak })
        }
      },

      isStreakActive: () => {
        const { currentStreak, lastActiveDay } = get()

        if (currentStreak === 0 || !lastActiveDay) {
          return false
        }

        const daysSinceActive = differenceInDays(
          startOfDay(virtualClock.nowDate()),
          startOfDay(parseISO(lastActiveDay))
        )

        // Streak is active if last activity was today or yesterday
        return daysSinceActive <= 1
      },

      getDaysSinceLastActivity: () => {
        const { lastActiveDay } = get()

        if (!lastActiveDay) {
          return null
        }

        return differenceInDays(
          startOfDay(virtualClock.nowDate()),
          startOfDay(parseISO(lastActiveDay))
        )
      },

      /**
       * Set streak data directly (for migration and Firebase sync)
       */
      setStreakData: (data) => {
        logger.streak('Setting streak data', data)
        set({
          currentStreak: data.currentStreak,
          longestStreak: data.longestStreak,
          lastActiveDay: data.lastActiveDay,
        })
      },
    }),
    {
      name: 'streak-storage',
      storage: createUserStorage('streak-storage'),
      partialize: (state) => ({
        // Only persist these fields
        currentStreak: state.currentStreak,
        longestStreak: state.longestStreak,
        lastActiveDay: state.lastActiveDay,
        // Don't persist todayActivities as it should reset on new day
      }),
    }
  )
)

// ❌ DISABLED: Auto-initialization disabled
// Streaks are now managed entirely by UserStatsService on the server
// This store is kept for backward compatibility only and should not be used
//
// Check streak status on app load and set up daily verification
// if (typeof window !== 'undefined') {
//   // Initial check on load
//   setTimeout(() => {
//     useStreakStore.getState().checkAndUpdateStreak()
//   }, 0)
//
//   // Set up daily verification at midnight
//   // This ensures streaks are checked even if user doesn't reload the app
//   const scheduleNextCheck = () => {
//     const now = new Date()
//     const tomorrow = new Date(now)
//     tomorrow.setDate(tomorrow.getDate() + 1)
//     tomorrow.setHours(0, 0, 1, 0) // 1 second after midnight
//
//     const msUntilMidnight = tomorrow.getTime() - now.getTime()
//
//     setTimeout(() => {
//       logger.streak('[Daily Check] Running automatic streak verification')
//       useStreakStore.getState().checkAndUpdateStreak()
//       scheduleNextCheck() // Schedule next day's check
//     }, msUntilMidnight)
//
//     logger.streak('[Scheduled] Next streak check in', {
//       hours: Math.floor(msUntilMidnight / (1000 * 60 * 60)),
//       minutes: Math.floor((msUntilMidnight % (1000 * 60 * 60)) / (1000 * 60))
//     })
//   }
//
//   scheduleNextCheck()
// }