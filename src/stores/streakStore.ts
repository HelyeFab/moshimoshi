/**
 * Streak Store
 * Tracks consecutive days of user activity
 * Follows the guide architecture with added flexibility for activity types
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { format, differenceInDays, parseISO, startOfDay } from 'date-fns'
import logger from '@/lib/logger'
import { virtualClock } from '@/lib/time/virtualClock'

/**
 * Activity types that count towards streaks
 * Easy to extend in the future
 */
export enum StreakActivity {
  REVIEW_SESSION = 'review_session',
  STUDY_SESSION = 'study_session',
  // Future activities can be added here:
  // QUIZ_COMPLETION = 'quiz_completion',
  // LESSON_COMPLETION = 'lesson_completion',
}

/**
 * Configuration for which activities count towards streaks
 * Can be modified without changing core logic
 */
export const STREAK_ELIGIBLE_ACTIVITIES: Set<StreakActivity> = new Set([
  StreakActivity.REVIEW_SESSION,
  StreakActivity.STUDY_SESSION,
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
       * Record an activity and update streak if eligible
       * Flexible method that checks activity type configuration
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
       * Legacy method for compatibility during migration
       * Will be deprecated once all code uses recordActivity
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
       */
      checkAndUpdateStreak: () => {
        const { lastActiveDay, currentStreak } = get()

        if (!lastActiveDay || currentStreak === 0) {
          return
        }

        const today = format(startOfDay(virtualClock.now()), 'yyyy-MM-dd')
        const daysSinceActive = differenceInDays(
          startOfDay(virtualClock.nowDate()),
          startOfDay(parseISO(lastActiveDay))
        )

        // If more than 1 day has passed, streak is broken
        if (daysSinceActive > 1) {
          logger.streak('Streak broken due to inactivity', { daysSinceActive })
          set({
            currentStreak: 0,
            todayActivities: new Set(),
          })
        } else if (daysSinceActive === 1) {
          // Yesterday was active, today not yet - streak still valid but at risk
          logger.streak('Streak at risk - complete activity today')
          // Clear today's activities since it's a new day
          set({ todayActivities: new Set() })
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
      storage: createJSONStorage(() => localStorage),
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

// Check streak status on app load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    useStreakStore.getState().checkAndUpdateStreak()
  }, 0)
}