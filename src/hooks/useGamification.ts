/**
 * useGamification Hook
 *
 * React hook that provides access to the gamification system state.
 * Wraps the Zustand store and handles feature flag checking, IndexedDB loading,
 * and provides safe defaults when gamification is disabled.
 *
 * @example
 * ```tsx
 * const { totalXP, currentLevel, currentStreak, loading, isEnabled } = useGamification()
 *
 * if (!isEnabled) {
 *   return null // Don't render gamification UI
 * }
 *
 * if (loading) {
 *   return <LoadingSpinner />
 * }
 *
 * return <div>XP: {totalXP}</div>
 * ```
 */

import { useEffect, useState } from 'react'
import { useGamificationStore } from '@/state/userGamification'
import { useAuth } from '@/hooks/useAuth'

export interface GamificationData {
  totalXP: number
  currentLevel: number
  currentStreak: number
  bestStreak: number
  unlockedAchievements: string[]
  sessionCount: number
  loading: boolean
  error: Error | null
  isEnabled: boolean
}

/**
 * Hook to access gamification state with feature flag support
 *
 * Returns safe defaults when feature flag is OFF or during loading.
 * Automatically loads data from IndexedDB on mount.
 */
export function useGamification(): GamificationData {
  const { user } = useAuth()
  const store = useGamificationStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Check feature flag (must be explicitly 'true')
  const isEnabled = process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION === 'true'

  useEffect(() => {
    // Don't load if feature is disabled
    if (!isEnabled) {
      setLoading(false)
      return
    }

    // Don't load if user is not authenticated
    if (!user?.uid) {
      setLoading(false)
      return
    }

    // Load from IndexedDB on mount
    async function loadData() {
      try {
        await store.loadFromIndexedDB(user.uid)
        setLoading(false)
      } catch (err) {
        console.error('[useGamification] Failed to load data:', err)
        setError(err as Error)
        setLoading(false)
      }
    }

    loadData()
  }, [isEnabled, user?.uid, store])

  // If feature flag is OFF, return safe defaults
  if (!isEnabled) {
    return {
      totalXP: 0,
      currentLevel: 1,
      currentStreak: 0,
      bestStreak: 0,
      unlockedAchievements: [],
      sessionCount: 0,
      loading: false,
      error: null,
      isEnabled: false
    }
  }

  // Return real data from store
  return {
    totalXP: store.totalXP,
    currentLevel: store.currentLevel,
    currentStreak: store.currentStreak,
    bestStreak: store.bestStreak,
    unlockedAchievements: store.unlockedAchievements,
    sessionCount: store.sessionCount,
    loading,
    error,
    isEnabled: true
  }
}
