/**
 * Hook for updating leaderboard stats
 *
 * This hook manages updates to the minimal public leaderboard data.
 * It ensures updates are batched and throttled to avoid excessive writes.
 *
 * Usage:
 * - Call updateStats() after session completion
 * - Call updateStreak() when daily streak changes
 * - Call updateLevel() on level up
 * - XP updates are automatically batched
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { debounce } from 'lodash'
import logger from '@/lib/logger'

interface LeaderboardStats {
  totalXP: number
  currentStreak: number
  level: number
  displayName?: string
  photoURL?: string
}

interface UpdateOptions {
  immediate?: boolean // Skip debouncing
  forceUpdate?: boolean // Bypass cooldown
}

export function useLeaderboardStats() {
  const { user } = useAuth()
  const [isUpdating, setIsUpdating] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Track pending updates
  const pendingUpdates = useRef<Partial<LeaderboardStats>>({})
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Batch XP updates (wait 5 seconds for more changes)
  const batchedXPUpdate = useRef(
    debounce(async (xp: number) => {
      if (!user?.uid) return

      try {
        setIsUpdating(true)
        const response = await fetch('/api/leaderboard/update-stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ totalXP: xp })
        })

        if (!response.ok) {
          const error = await response.json()
          if (error.message?.includes('cooldown')) {
            logger.info('[LeaderboardStats] Update on cooldown, will retry later')
            return
          }
          throw new Error(error.message || 'Failed to update stats')
        }

        setLastUpdate(new Date())
        logger.info('[LeaderboardStats] XP updated:', xp)
      } catch (error) {
        logger.error('[LeaderboardStats] Failed to update XP:', error)
      } finally {
        setIsUpdating(false)
      }
    }, 5000) // 5 second debounce for XP
  ).current

  /**
   * Update XP (batched/debounced)
   */
  const updateXP = useCallback((xp: number) => {
    if (!user?.uid) return
    pendingUpdates.current.totalXP = xp
    batchedXPUpdate(xp)
  }, [user, batchedXPUpdate])

  /**
   * Update streak (immediate - happens once daily)
   */
  const updateStreak = useCallback(async (streak: number) => {
    if (!user?.uid) return

    try {
      setIsUpdating(true)
      const response = await fetch('/api/leaderboard/update-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStreak: streak })
      })

      if (!response.ok) {
        throw new Error('Failed to update streak')
      }

      setLastUpdate(new Date())
      logger.info('[LeaderboardStats] Streak updated:', streak)
    } catch (error) {
      logger.error('[LeaderboardStats] Failed to update streak:', error)
    } finally {
      setIsUpdating(false)
    }
  }, [user])

  /**
   * Update level (immediate - significant achievement)
   */
  const updateLevel = useCallback(async (level: number) => {
    if (!user?.uid) return

    try {
      setIsUpdating(true)
      const response = await fetch('/api/leaderboard/update-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level })
      })

      if (!response.ok) {
        throw new Error('Failed to update level')
      }

      setLastUpdate(new Date())
      logger.info('[LeaderboardStats] Level updated:', level)
    } catch (error) {
      logger.error('[LeaderboardStats] Failed to update level:', error)
    } finally {
      setIsUpdating(false)
    }
  }, [user])

  /**
   * Update profile info (name/avatar)
   */
  const updateProfile = useCallback(async (
    displayName?: string,
    photoURL?: string
  ) => {
    if (!user?.uid) return

    try {
      setIsUpdating(true)
      const updates: any = {}
      if (displayName !== undefined) updates.displayName = displayName
      if (photoURL !== undefined) updates.photoURL = photoURL

      const response = await fetch('/api/leaderboard/update-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error('Failed to update profile')
      }

      setLastUpdate(new Date())
      logger.info('[LeaderboardStats] Profile updated')
    } catch (error) {
      logger.error('[LeaderboardStats] Failed to update profile:', error)
    } finally {
      setIsUpdating(false)
    }
  }, [user])

  /**
   * Update multiple stats at once (e.g., after session completion)
   */
  const updateStats = useCallback(async (
    stats: Partial<LeaderboardStats>,
    options: UpdateOptions = {}
  ) => {
    if (!user?.uid) return

    try {
      setIsUpdating(true)

      const body = {
        ...stats,
        forceUpdate: options.forceUpdate
      }

      const response = await fetch('/api/leaderboard/update-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const error = await response.json()
        if (error.message?.includes('cooldown')) {
          logger.info('[LeaderboardStats] Update on cooldown')
          return
        }
        throw new Error(error.message || 'Failed to update stats')
      }

      const result = await response.json()
      setLastUpdate(new Date())
      logger.info('[LeaderboardStats] Stats updated:', result.updates)

      return result
    } catch (error) {
      logger.error('[LeaderboardStats] Failed to update stats:', error)
      throw error
    } finally {
      setIsUpdating(false)
    }
  }, [user])

  /**
   * Get current stats from server
   */
  const getCurrentStats = useCallback(async () => {
    if (!user?.uid) return null

    try {
      const response = await fetch('/api/leaderboard/update-stats')
      if (!response.ok) {
        throw new Error('Failed to get stats')
      }

      const data = await response.json()
      return data.stats
    } catch (error) {
      logger.error('[LeaderboardStats] Failed to get stats:', error)
      return null
    }
  }, [user])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
      batchedXPUpdate.cancel()
    }
  }, [batchedXPUpdate])

  // Update profile info when user changes
  useEffect(() => {
    if (user?.displayName || user?.photoURL) {
      updateProfile(user.displayName || undefined, user.photoURL || undefined)
    }
  }, [user?.displayName, user?.photoURL, updateProfile])

  return {
    updateXP,
    updateStreak,
    updateLevel,
    updateProfile,
    updateStats,
    getCurrentStats,
    isUpdating,
    lastUpdate
  }
}