/**
 * Streak Save Detection Hook
 * Phase 2.5: XP-Save Mechanic with Auto-Break
 *
 * Automatically detects when user's streak is breaking and:
 * 1. Calls break endpoint to update database (if beyond grace period)
 * 2. Triggers save modal (if within save window)
 *
 * Trigger Conditions (ALL must be true):
 * 1. Zustand store has hydrated
 * 2. User has a streak (currentStreak > 0)
 * 3. Last activity date exists
 * 4. Days since activity > grace period (streak is breaking)
 * 5. Days since activity <= maxSaveWindow (within save window)
 * 6. Not already prompted today (localStorage check)
 */

import { useState, useEffect } from 'react'
import { useGamification } from './useGamification'
import { validateStreakDisplay } from '@/lib/gamification/utils/streakValidation'
import { getStreakConfigClient } from '@/config/gamification/streakConfig.client'

const STORAGE_KEY = 'moshimoshi_streak_save_prompt_date'
const BREAK_CHECK_KEY = 'moshimoshi_last_break_check'

interface UseStreakSaveDetectionReturn {
  shouldShowModal: boolean
  dismissModal: () => void
  resetDetection: () => void
}

export function useStreakSaveDetection(): UseStreakSaveDetectionReturn {
  const [shouldShowModal, setShouldShowModal] = useState(false)

  const {
    currentStreak,
    lastActivityDate,
    hasHydrated
  } = useGamification()

  useEffect(() => {
    // Don't check until store is hydrated
    if (!hasHydrated) {
      return
    }

    checkIfShouldPrompt()

    // Optional: Re-check when user comes back to tab
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkIfShouldPrompt()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [hasHydrated, currentStreak, lastActivityDate])

  /**
   * Phase 2.5: Auto-break streak if beyond grace period
   * Called before showing modal to ensure DB is in sync
   */
  const triggerAutoBreak = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/gamification/streak/break', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        console.warn('[useStreakSaveDetection] Break endpoint failed:', response.status)
        return false
      }

      const result = await response.json()

      if (result.success && result.broken) {
        console.log('[useStreakSaveDetection] Streak auto-broken:', result)
        return true
      }

      if (result.success && result.alreadyBroken) {
        console.log('[useStreakSaveDetection] Streak already broken')
        return true
      }

      if (result.success && result.notEligible) {
        console.log('[useStreakSaveDetection] Not eligible for break:', result.message)
        return false
      }

      return false
    } catch (error) {
      console.error('[useStreakSaveDetection] Error calling break endpoint:', error)
      return false
    }
  }

  /**
   * Check if modal should be shown
   * Phase 2.5: Now calls auto-break before showing modal
   */
  const checkIfShouldPrompt = async () => {
    // 1. Must have hydrated
    if (!hasHydrated) {
      return
    }

    // 2. Must have activity date
    if (!lastActivityDate) {
      return
    }

    // 3. Check if already prompted today
    const lastPromptDate = localStorage.getItem(STORAGE_KEY)
    const today = new Date().toISOString().split('T')[0]

    if (lastPromptDate === today) {
      // Already prompted today, don't show again
      return
    }

    // 4. Get config
    let config
    try {
      config = getStreakConfigClient()
    } catch (err) {
      console.error('[useStreakSaveDetection] Failed to load config:', err)
      return
    }

    // Check if feature is enabled
    if (!config.streakSave?.enabled) {
      return
    }

    const gracePeriodHours = config.gracePeriodHours
    const maxSaveWindow = config.streakSave.maxSaveWindow

    // 5. Validate streak status
    const validation = validateStreakDisplay(currentStreak, lastActivityDate, gracePeriodHours)

    // Must be stale (beyond grace period)
    if (!validation.isStale) {
      return
    }

    // Must be within save window
    if (validation.daysSinceActivity > maxSaveWindow) {
      return
    }

    // Phase 2.5: Trigger auto-break to sync DB before showing modal
    // This will break the streak if it's still > 0, or confirm it's already broken
    const breakSuccess = await triggerAutoBreak()

    if (!breakSuccess) {
      console.warn('[useStreakSaveDetection] Auto-break failed, not showing modal')
      return
    }

    // All conditions met! Show modal
    setShouldShowModal(true)

    // Mark as prompted today
    localStorage.setItem(STORAGE_KEY, today)
  }

  /**
   * Dismiss modal
   */
  const dismissModal = () => {
    setShouldShowModal(false)
  }

  /**
   * Reset detection (useful for testing or manual triggers)
   */
  const resetDetection = () => {
    localStorage.removeItem(STORAGE_KEY)
    checkIfShouldPrompt()
  }

  return {
    shouldShowModal,
    dismissModal,
    resetDetection
  }
}
