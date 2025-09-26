/**
 * useUserStats Hook - Unified Interface for User Statistics
 *
 * This hook provides a single, unified interface to access ALL user statistics
 * from the new user_stats collection. It replaces:
 * - useLeaderboardStats
 * - useAchievements
 * - Direct Firebase queries to achievements/statistics
 *
 * ALL components should use this hook instead of accessing stats directly.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { UserStats } from '@/lib/services/UserStatsService'
import logger from '@/lib/logger'
import { useToast } from '@/components/ui/Toast'

interface UseUserStatsReturn {
  // Data
  stats: UserStats | null
  isLoading: boolean
  error: string | null

  // Derived data for convenience
  streak: {
    current: number
    best: number
    isActiveToday: boolean
    atRisk: boolean
  }
  xp: {
    total: number
    level: number
    levelTitle: string
    progressToNext: number
  }
  achievements: {
    count: number
    points: number
    recentUnlocks: string[]
  }

  // Actions
  refreshStats: () => Promise<void>
  updateStreak: () => Promise<void>
  addXP: (amount: number, source: string) => Promise<void>
  unlockAchievement: (achievementId: string, points: number) => Promise<void>
  recordSession: (sessionData: any) => Promise<void>
  repairData: () => Promise<void>
}

export function useUserStats(): UseUserStatsReturn {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch stats from unified API
  const fetchStats = useCallback(async () => {
    if (!user?.uid) {
      setStats(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/stats/unified', {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.statusText}`)
      }

      const data = await response.json()
      setStats(data.stats)

      logger.info('[useUserStats] Stats loaded:', {
        userId: user.uid,
        streak: data.stats?.streak?.current,
        xp: data.stats?.xp?.total,
        level: data.stats?.xp?.level
      })

    } catch (err) {
      logger.error('[useUserStats] Error fetching stats:', err)
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setIsLoading(false)
    }
  }, [user?.uid])

  // Initial load
  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Update streak (daily activity)
  const updateStreak = useCallback(async () => {
    if (!user?.uid) return

    try {
      const response = await fetch('/api/stats/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'streak',
          data: { activityDate: new Date().toISOString().split('T')[0] }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update streak')
      }

      const data = await response.json()
      setStats(data.stats)

      // Show feedback if streak increased
      if (data.stats.streak.current > (stats?.streak?.current || 0)) {
        showToast(`🔥 Streak increased to ${data.stats.streak.current} days!`, 'success')
      }

    } catch (err) {
      logger.error('[useUserStats] Error updating streak:', err)
      showToast('Failed to update streak', 'error')
    }
  }, [user?.uid, stats?.streak?.current, showToast])

  // Add XP
  const addXP = useCallback(async (amount: number, source: string) => {
    if (!user?.uid) return

    try {
      const response = await fetch('/api/stats/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'xp',
          data: { amount, source }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add XP')
      }

      const data = await response.json()
      setStats(data.stats)

      // Check for level up
      if (data.stats.xp.level > (stats?.xp?.level || 1)) {
        showToast(`🎉 Level up! You're now level ${data.stats.xp.level}!`, 'success')
      } else if (amount > 0) {
        showToast(`+${amount} XP`, 'success')
      }

    } catch (err) {
      logger.error('[useUserStats] Error adding XP:', err)
    }
  }, [user?.uid, stats?.xp?.level, showToast])

  // Unlock achievement
  const unlockAchievement = useCallback(async (achievementId: string, points: number) => {
    if (!user?.uid) return

    try {
      const response = await fetch('/api/stats/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'achievement',
          data: { achievementId, points }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to unlock achievement')
      }

      const data = await response.json()
      setStats(data.stats)

      showToast(`🏆 Achievement unlocked: ${achievementId}!`, 'success')

    } catch (err) {
      logger.error('[useUserStats] Error unlocking achievement:', err)
    }
  }, [user?.uid, showToast])

  // Record session
  const recordSession = useCallback(async (sessionData: any) => {
    if (!user?.uid) return

    try {
      const response = await fetch('/api/stats/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'session',
          data: sessionData
        })
      })

      if (!response.ok) {
        throw new Error('Failed to record session')
      }

      const data = await response.json()
      setStats(data.stats)

      logger.info('[useUserStats] Session recorded:', {
        type: sessionData.type,
        items: sessionData.itemsReviewed,
        accuracy: sessionData.accuracy
      })

    } catch (err) {
      logger.error('[useUserStats] Error recording session:', err)
    }
  }, [user?.uid])

  // Repair data
  const repairData = useCallback(async () => {
    if (!user?.uid) return

    try {
      setIsLoading(true)
      showToast('Repairing data...', 'info')

      const response = await fetch('/api/stats/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'repair',
          data: {}
        })
      })

      if (!response.ok) {
        throw new Error('Failed to repair data')
      }

      const data = await response.json()
      setStats(data.stats)

      showToast('Data repaired successfully!', 'success')

    } catch (err) {
      logger.error('[useUserStats] Error repairing data:', err)
      showToast('Failed to repair data', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [user?.uid, showToast])

  // Compute derived data
  const derivedData = {
    streak: {
      current: stats?.streak?.current || 0,
      best: stats?.streak?.best || 0,
      isActiveToday: stats?.streak?.isActiveToday || false,
      atRisk: stats?.streak?.streakAtRisk || false
    },
    xp: {
      total: stats?.xp?.total || 0,
      level: stats?.xp?.level || 1,
      levelTitle: stats?.xp?.levelTitle || 'Beginner',
      progressToNext: stats?.xp?.xpToNextLevel || 100
    },
    achievements: {
      count: stats?.achievements?.unlockedCount || 0,
      points: stats?.achievements?.totalPoints || 0,
      recentUnlocks: stats?.achievements?.unlockedIds?.slice(-3) || []
    }
  }

  return {
    // Data
    stats,
    isLoading,
    error,

    // Derived data
    ...derivedData,

    // Actions
    refreshStats: fetchStats,
    updateStreak,
    addXP,
    unlockAchievement,
    recordSession,
    repairData
  }
}

/**
 * Helper hook for components that only need specific stats
 */
export function useStreak() {
  const { streak, updateStreak, isLoading } = useUserStats()
  return { ...streak, updateStreak, isLoading }
}

export function useXP() {
  const { xp, addXP, isLoading } = useUserStats()
  return { ...xp, addXP, isLoading }
}

export function useAchievements() {
  const { achievements, unlockAchievement, isLoading } = useUserStats()
  return { ...achievements, unlockAchievement, isLoading }
}