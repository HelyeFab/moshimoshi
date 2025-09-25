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

    // Use the path structure from the guide: users/{uid}/progress/streak
    await setDoc(
      doc(db, 'users', user.uid, 'progress', 'streak'),
      {
        currentStreak,
        longestStreak,
        lastActiveDay,
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

    // Loading streak from Firestore

    const streakDoc = await getDoc(doc(db, 'users', user.uid, 'progress', 'streak'))

    if (streakDoc.exists()) {
      const data = streakDoc.data() as FirestoreStreakData

      // Loaded streak data from Firestore

      // Update local store with Firestore data
      useStreakStore.getState().setStreakData({
        currentStreak: data.currentStreak,
        longestStreak: data.longestStreak,
        lastActiveDay: data.lastActiveDay,
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

    // Subscribing to Firestore streak updates

    const streakDoc = doc(db, 'users', user.uid, 'progress', 'streak')

    // Create a wrapped unsubscribe function that handles cleanup
    let isUnsubscribed = false

    const unsubscribe = onSnapshot(
      streakDoc,
      (snap) => {
        // Skip if we've already unsubscribed
        if (isUnsubscribed) return

        if (snap.exists()) {
          const data = snap.data() as FirestoreStreakData
          const localState = useStreakStore.getState()

          // Only update if Firestore data is different from local
          // This prevents infinite sync loops
          if (
            data.currentStreak !== localState.currentStreak ||
            data.longestStreak !== localState.longestStreak ||
            data.lastActiveDay !== localState.lastActiveDay
          ) {
            // Received streak update from Firestore

            useStreakStore.getState().setStreakData({
              currentStreak: data.currentStreak,
              longestStreak: data.longestStreak,
              lastActiveDay: data.lastActiveDay,
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
 * Migrate streak data from old structure to new
 * This will be called once for existing users
 */
export async function migrateStreakData(userId: string): Promise<void> {
  try {
    // Starting streak migration

    // Try to load from old location: users/{uid}/achievements/activities
    const oldDoc = await getDoc(doc(db, 'users', userId, 'achievements', 'activities'))

    if (!oldDoc.exists()) {
      // No old streak data to migrate
      return
    }

    const oldData = oldDoc.data()
    // Found old streak data

    // Extract dates and calculate last active day
    const dates = oldData.dates || {}
    const dateKeys = Object.keys(dates)
      .filter(key => key.match(/^\d{4}-\d{2}-\d{2}$/) && dates[key] === true)
      .sort()

    let lastActiveDay: string | null = null
    let currentStreak = 0

    if (dateKeys.length > 0) {
      // Get the most recent active day
      lastActiveDay = dateKeys[dateKeys.length - 1]

      // Count consecutive days backwards from the most recent
      const today = format(new Date(), 'yyyy-MM-dd')
      let checkDate = lastActiveDay

      // If last active was today or yesterday, calculate the streak
      const daysSinceActive = Math.floor(
        (new Date(today).getTime() - new Date(lastActiveDay).getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysSinceActive <= 1) {
        // Count backwards from lastActiveDay
        for (let i = dateKeys.length - 1; i >= 0; i--) {
          if (dateKeys[i] === checkDate) {
            currentStreak++
            // Move to previous day
            const prevDate = new Date(checkDate)
            prevDate.setDate(prevDate.getDate() - 1)
            checkDate = format(prevDate, 'yyyy-MM-dd')
          } else {
            break
          }
        }
      }
    }

    const longestStreak = Math.max(oldData.bestStreak || 0, currentStreak)

    // Save to new location
    await setDoc(
      doc(db, 'users', userId, 'progress', 'streak'),
      {
        currentStreak,
        longestStreak,
        lastActiveDay,
        updatedAt: serverTimestamp(),
        userId,
        migratedAt: serverTimestamp(),
        migratedFrom: 'achievements/activities',
      }
    )

    // Migration complete

    // Update local store if this is the current user
    if (auth.currentUser?.uid === userId) {
      useStreakStore.getState().setStreakData({
        currentStreak,
        longestStreak,
        lastActiveDay,
      })
    }
  } catch (error) {
    console.error('[StreakSync] Migration failed:', error)
  }
}