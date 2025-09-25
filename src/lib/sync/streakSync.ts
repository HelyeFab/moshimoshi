/**
 * Streak Sync Module
 * Handles bidirectional sync between local streak store and Firebase
 * Premium users only
 */

import { useStreakStore, StreakActivity } from '@/stores/streakStore'
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Unsubscribe
} from 'firebase/firestore'
import { auth, firestore } from '@/lib/firebase/client'
import { format, parseISO } from 'date-fns'

const db = firestore

interface FirestoreStreakData {
  currentStreak: number
  longestStreak: number
  lastActiveDay: string | null
  updatedAt: any // serverTimestamp type
  userId: string
}

/**
 * Push local streak data to Firestore
 * Called after each streak update for premium users
 */
export async function pushStreakToFirestore(): Promise<void> {
  try {
    const user = auth.currentUser
    if (!user) {
      // No authenticated user, skipping push
      return
    }

    // Check if Firestore is available
    if (!db) {
      // Firestore not initialized, skipping
      return
    }

    const { currentStreak, longestStreak, lastActiveDay } = useStreakStore.getState()

    // Pushing streak to Firestore

    // Use the CORRECT path that the API reads from: users/{uid}/achievements/activities
    // This ensures consistency with existing data
    const dates: Record<string, boolean> = {}
    if (lastActiveDay) {
      dates[lastActiveDay] = true
    }

    await setDoc(
      doc(db, 'users', user.uid, 'achievements', 'activities'),
      {
        currentStreak,
        bestStreak: longestStreak,
        lastActivity: Date.now(),
        dates,
        updatedAt: serverTimestamp(),
        userId: user.uid,
      },
      { merge: true }
    )

    // Successfully pushed streak to Firestore
  } catch (error: any) {
    // Silently handle expected errors
    const errorString = error?.toString?.() || ''
    const isExpectedError =
      error?.code === 'permission-denied' ||
      error?.code === 'unavailable' ||
      error?.message?.includes('internal error') ||
      errorString.includes('Failed to get document')

    if (!isExpectedError) {
      console.error('[StreakSync] Failed to push streak to Firestore:', error)
    }
    // Don't throw - we don't want to break the app if sync fails
  }
}

/**
 * Load streak data from Firestore
 * Called on app initialization for premium users
 */
export async function loadStreakFromFirestore(): Promise<void> {
  try {
    const user = auth.currentUser
    if (!user) {
      // No authenticated user, skipping load
      return
    }

    // Check if Firestore is available
    if (!db) {
      // Firestore not initialized, skipping
      return
    }

    // Loading streak from Firestore from CORRECT location

    const streakDoc = await getDoc(doc(db, 'users', user.uid, 'achievements', 'activities'))

    if (streakDoc.exists()) {
      const data = streakDoc.data()

      // Loaded streak data from Firestore

      // Extract the last active day from dates object
      let lastActiveDay: string | null = null
      if (data.dates) {
        const dateKeys = Object.keys(data.dates).filter(key => data.dates[key] === true).sort()
        if (dateKeys.length > 0) {
          lastActiveDay = dateKeys[dateKeys.length - 1]
        }
      }

      // Update local store with Firestore data
      useStreakStore.getState().setStreakData({
        currentStreak: data.currentStreak || 0,
        longestStreak: data.bestStreak || data.longestStreak || 0,
        lastActiveDay,
      })

      // Check if streak needs to be reset due to inactivity
      useStreakStore.getState().checkAndUpdateStreak()
    } else {
      // No streak data found in Firestore
    }
  } catch (error: any) {
    // Silently handle expected errors
    const errorString = error?.toString?.() || ''
    const isExpectedError =
      error?.code === 'permission-denied' ||
      error?.code === 'unavailable' ||
      error?.message?.includes('internal error') ||
      errorString.includes('Failed to get document')

    if (!isExpectedError) {
      console.error('[StreakSync] Failed to load streak from Firestore:', error)
    }
    // For expected errors (permissions, network), just use local data silently
  }
}

/**
 * Subscribe to real-time streak updates from Firestore
 * Enables cross-device sync for premium users
 */
export function subscribeToStreakFromFirestore(): Unsubscribe | null {
  try {
    const user = auth.currentUser
    if (!user) {
      // No authenticated user, skipping subscription
      return null
    }

    // Subscribing to Firestore streak updates from CORRECT location

    const streakDoc = doc(db, 'users', user.uid, 'achievements', 'activities')

    // Create a wrapped unsubscribe function that handles cleanup
    let isUnsubscribed = false

    const unsubscribe = onSnapshot(
      streakDoc,
      (snap) => {
        // Skip if we've already unsubscribed
        if (isUnsubscribed) return

        if (snap.exists()) {
          const data = snap.data()
          const localState = useStreakStore.getState()

          // Extract the last active day from dates object
          let lastActiveDay: string | null = null
          if (data.dates) {
            const dateKeys = Object.keys(data.dates).filter(key => data.dates[key] === true).sort()
            if (dateKeys.length > 0) {
              lastActiveDay = dateKeys[dateKeys.length - 1]
            }
          }

          const longestStreak = data.bestStreak || data.longestStreak || 0

          // Only update if Firestore data is different from local
          // This prevents infinite sync loops
          if (
            data.currentStreak !== localState.currentStreak ||
            longestStreak !== localState.longestStreak ||
            lastActiveDay !== localState.lastActiveDay
          ) {
            // Received streak update from Firestore

            useStreakStore.getState().setStreakData({
              currentStreak: data.currentStreak || 0,
              longestStreak,
              lastActiveDay,
            })

            // Check if streak needs to be reset due to inactivity
            useStreakStore.getState().checkAndUpdateStreak()
          }
        }
      },
      (error: any) => {
        // Skip if we've already unsubscribed
        if (isUnsubscribed) return

        // Silently ignore network-related errors
        const ignoredErrors = [
          'unavailable',
          'permission-denied',
          'ERR_NETWORK_CHANGED',
          'ERR_ABORTED',
          'network-request-failed',
          'NETWORK_ERROR'
        ]

        // Check for network errors in various formats
        const errorString = error?.toString?.() || ''
        const isNetworkError =
          ignoredErrors.some(err =>
            error?.code?.includes?.(err) ||
            error?.message?.includes?.(err) ||
            errorString.includes(err)
          ) ||
          // Additional check for network errors
          error?.code === 'failed-precondition' ||
          error?.code === 'unavailable' ||
          // Check for Firestore's internal network errors
          errorString.includes('Failed to get document because the client is offline')

        // Only log non-network errors in development
        if (!isNetworkError && process.env.NODE_ENV === 'development') {
          console.error('[StreakSync] Firestore subscription error:', error)
        }
      }
    )

    // Return a wrapped unsubscribe function
    return () => {
      isUnsubscribed = true
      unsubscribe()
    }
  } catch (error) {
    console.error('[StreakSync] Failed to subscribe to Firestore:', error)
    return null
  }
}

/**
 * Record an activity and sync to Firestore if premium
 * Convenience wrapper that handles both local update and sync
 */
export async function recordActivityAndSync(
  activity: StreakActivity,
  isPremium: boolean,
  timestamp: number = Date.now()
): Promise<void> {
  // Update local store first
  useStreakStore.getState().recordActivity(activity, timestamp)

  // Push to Firestore if premium
  if (isPremium && auth.currentUser) {
    await pushStreakToFirestore()
  }
}

/**
 * No migration needed anymore - we're using achievements/activities as the single source of truth
 * This function is kept for backwards compatibility but does nothing
 */
export async function migrateStreakData(userId: string): Promise<void> {
  // No migration needed - achievements/activities is already the correct location
  console.log('[StreakSync] No migration needed, using achievements/activities as source of truth')
  return
}