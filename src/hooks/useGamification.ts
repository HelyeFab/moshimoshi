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
import { useSubscription } from '@/hooks/useSubscription'

export interface GamificationData {
  totalXP: number
  currentLevel: number
  currentStreak: number
  bestStreak: number
  unlockedAchievements: string[]
  sessionCount: number
  lastActivityDate: Date | null
  hasHydrated: boolean
  loading: boolean
  error: Error | null
  isEnabled: boolean
  loadFromFirebase: () => Promise<void> // Expose reload function
}

/**
 * Hook to access gamification state with feature flag support
 *
 * Returns safe defaults when feature flag is OFF or during loading.
 * Automatically loads data from IndexedDB on mount.
 */
export function useGamification(): GamificationData {
  const { user } = useAuth()
  const { isPremium, isLoading: subscriptionLoading } = useSubscription()
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

    // Wait for subscription status to load
    if (subscriptionLoading) {
      return
    }

    // Load data with priority: Firebase (premium) > IndexedDB > defaults
    async function loadData() {
      try {
        // Set userId first for all operations
        store.setUserId(user.uid)

        // Premium users: Try Firebase first, fallback to IndexedDB
        if (isPremium) {
          try {
            await store.loadFromFirebase()
          } catch (firebaseError) {
            console.warn('[useGamification] Firebase load failed, trying IndexedDB fallback:', firebaseError)
            await store.loadFromIndexedDB(user.uid)
          }
        } else {
          // Free users: IndexedDB only
          await store.loadFromIndexedDB(user.uid)
        }

        setLoading(false)
      } catch (err) {
        console.error('[useGamification] Failed to load data:', err)
        setError(err as Error)
        setLoading(false)
      }
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, user?.uid, isPremium, subscriptionLoading]) // store is stable, don't include in deps

  // If feature flag is OFF, return safe defaults
  if (!isEnabled) {
    return {
      totalXP: 0,
      currentLevel: 1,
      currentStreak: 0,
      bestStreak: 0,
      unlockedAchievements: [],
      sessionCount: 0,
      lastActivityDate: null,
      hasHydrated: false,
      loading: false,
      error: null,
      isEnabled: false,
      loadFromFirebase: async () => {} // Dummy function when disabled
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
    lastActivityDate: store.lastActivityDate,
    hasHydrated: store.hasHydrated,
    loading,
    error,
    isEnabled: true,
    loadFromFirebase: store.loadFromFirebase // Expose reload function
  }
}
