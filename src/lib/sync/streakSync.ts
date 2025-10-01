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
 * @deprecated Push local streak data to Firestore
 *
 * DISABLED: This function has been disabled to prevent overwriting user_stats.
 * Streaks are now managed server-side via UserStatsService only.
 *
 * Called after each streak update for premium users
 */
export async function pushStreakToFirestore(): Promise<void> {
  // ❌ DISABLED: Do not push from client - UserStatsService handles all streak updates
  console.warn('[StreakSync] pushStreakToFirestore is disabled - streaks are managed by UserStatsService')
  return
}

/**
 * @deprecated Load streak data from Firestore
 *
 * DISABLED: This function has been disabled. Streaks are now read via useReviewStats().
 * The client should never directly read or write streak data to/from Firestore.
 * All streak management is handled server-side via UserStatsService.
 *
 * Called on app initialization for premium users
 */
export async function loadStreakFromFirestore(): Promise<void> {
  // ❌ DISABLED: Do not load from client - useReviewStats handles all streak reads via API
  console.warn('[StreakSync] loadStreakFromFirestore is disabled - use useReviewStats instead')
  return
}

/**
 * @deprecated Subscribe to real-time streak updates from Firestore
 *
 * DISABLED: This function has been disabled. Streaks are now read via useReviewStats().
 * Real-time updates are not needed as the dashboard refetches data periodically.
 *
 * Enables cross-device sync for premium users
 */
export function subscribeToStreakFromFirestore(): Unsubscribe | null {
  // ❌ DISABLED: Do not subscribe from client - useReviewStats handles all streak reads
  console.warn('[StreakSync] subscribeToStreakFromFirestore is disabled - use useReviewStats instead')
  return null
}

/**
 * @deprecated Manual streak recording is no longer needed.
 * Streaks are now automatically updated when XP is tracked via UserStatsService.
 * Any activity earning 10+ XP with countsForStreak=true in xp-config.json
 * will automatically update the streak.
 *
 * This function is kept for backward compatibility but should not be used in new code.
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