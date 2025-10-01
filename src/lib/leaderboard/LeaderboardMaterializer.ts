/**
 * Leaderboard Materializer Service
 *
 * Syncs user_stats → leaderboard_stats
 *
 * ARCHITECTURE:
 * - user_stats: Source of truth for all user statistics
 * - leaderboard_stats: Read-only materialized view for fast leaderboard queries
 *
 * This service ensures leaderboard_stats stays in sync with user_stats.
 * ALL writes to leaderboard_stats MUST go through this materializer.
 *
 * IMPORTANT: Supports FREE users for leaderboard participation exception
 */

import { adminDb } from '@/lib/firebase/admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import logger from '@/lib/logger'

export interface LeaderboardEntry {
  userId: string
  displayName: string
  photoURL?: string
  email: string

  // Stats synced from user_stats
  totalPoints: number        // From user_stats.achievements.totalPoints
  currentStreak: number       // From user_stats.streak.current
  bestStreak: number          // From user_stats.streak.best
  totalXP: number             // From user_stats.xp.total
  currentLevel: number        // From user_stats.xp.level
  achievementCount: number    // From user_stats.achievements.unlockedCount

  // Metadata
  lastSyncedAt: Timestamp
  lastActivityDate: string | null
  isPublic: boolean
  optedOut: boolean

  // Performance optimization
  rank?: number  // Calculated during queries
}

export class LeaderboardMaterializer {
  private static instance: LeaderboardMaterializer
  private readonly LEADERBOARD_COLLECTION = 'leaderboard_stats'
  private readonly USER_STATS_COLLECTION = 'user_stats'

  // Debouncing: max 1 sync per user per minute
  private syncQueue: Map<string, NodeJS.Timeout> = new Map()
  private readonly DEBOUNCE_MS = 60000 // 1 minute

  private constructor() {}

  public static getInstance(): LeaderboardMaterializer {
    if (!LeaderboardMaterializer.instance) {
      LeaderboardMaterializer.instance = new LeaderboardMaterializer()
    }
    return LeaderboardMaterializer.instance
  }

  /**
   * Sync a single user's stats from user_stats to leaderboard_stats
   *
   * This is the main sync method called after streak, XP, or achievement updates.
   * Includes debouncing to prevent excessive writes.
   */
  async syncUserToLeaderboard(userId: string, immediate = false): Promise<void> {
    try {
      // Debouncing logic
      if (!immediate && this.syncQueue.has(userId)) {
        logger.debug(`[LeaderboardMaterializer] Sync for ${userId} already queued, skipping`)
        return
      }

      if (!immediate) {
        // Queue the sync with debouncing
        const timeout = setTimeout(async () => {
          await this.performSync(userId)
          this.syncQueue.delete(userId)
        }, this.DEBOUNCE_MS)

        this.syncQueue.set(userId, timeout)
        logger.debug(`[LeaderboardMaterializer] Queued sync for ${userId} (${this.DEBOUNCE_MS}ms)`)
        return
      }

      // Immediate sync (bypass debouncing)
      await this.performSync(userId)

    } catch (error) {
      logger.error(`[LeaderboardMaterializer] Failed to sync user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Internal method that performs the actual sync
   */
  private async performSync(userId: string): Promise<void> {
    try {
      logger.info(`[LeaderboardMaterializer] Syncing user ${userId} to leaderboard`)

      // 1. Get user_stats (source of truth)
      const userStatsRef = adminDb.collection(this.USER_STATS_COLLECTION).doc(userId)
      const userStatsDoc = await userStatsRef.get()

      if (!userStatsDoc.exists) {
        logger.warn(`[LeaderboardMaterializer] No user_stats found for ${userId}, skipping sync`)
        return
      }

      const userStats = userStatsDoc.data()!

      // 2. Check if user opted out of leaderboard
      const userDoc = await adminDb.collection('users').doc(userId).get()
      const userData = userDoc.data()
      const optedOut = userData?.leaderboard?.optedOut === true

      if (optedOut) {
        // If opted out, remove from leaderboard or mark as optedOut
        const leaderboardRef = adminDb.collection(this.LEADERBOARD_COLLECTION).doc(userId)
        await leaderboardRef.set({
          userId,
          optedOut: true,
          lastSyncedAt: FieldValue.serverTimestamp()
        }, { merge: true })

        logger.info(`[LeaderboardMaterializer] User ${userId} opted out, marked in leaderboard`)
        return
      }

      // 3. Build leaderboard entry from user_stats
      const leaderboardEntry: any = {
        userId,
        displayName: userStats.displayName || 'Anonymous',
        email: userStats.email || '',

        // Sync stats from user_stats (SINGLE SOURCE OF TRUTH)
        totalPoints: userStats.achievements?.totalPoints || 0,
        currentStreak: userStats.streak?.current || 0,
        bestStreak: userStats.streak?.best || 0,
        totalXP: userStats.xp?.total || 0,
        currentLevel: userStats.xp?.level || 1,
        achievementCount: userStats.achievements?.unlockedCount || 0,

        // Metadata
        lastSyncedAt: FieldValue.serverTimestamp(),
        lastActivityDate: userStats.streak?.lastActivityDate || null,
        isPublic: userData?.leaderboard?.isPublic !== false, // Default true
        optedOut: false
      }

      // Only add photoURL if it exists (Firestore doesn't accept undefined)
      if (userStats.photoURL) {
        leaderboardEntry.photoURL = userStats.photoURL
      }

      // 4. Write to leaderboard_stats
      const leaderboardRef = adminDb.collection(this.LEADERBOARD_COLLECTION).doc(userId)
      await leaderboardRef.set(leaderboardEntry, { merge: true })

      logger.info(`[LeaderboardMaterializer] ✅ Synced ${userId}:`, {
        totalPoints: leaderboardEntry.totalPoints,
        currentStreak: leaderboardEntry.currentStreak,
        totalXP: leaderboardEntry.totalXP
      })

    } catch (error) {
      logger.error(`[LeaderboardMaterializer] Error in performSync for ${userId}:`, error)
      throw error
    }
  }

  /**
   * Batch sync multiple users
   * Used for admin operations or migrations
   */
  async batchSyncUsers(userIds: string[], options = { batchSize: 50 }): Promise<{
    success: number
    failed: number
    errors: Array<{ userId: string; error: string }>
  }> {
    logger.info(`[LeaderboardMaterializer] Batch syncing ${userIds.length} users`)

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ userId: string; error: string }>
    }

    // Process in batches
    for (let i = 0; i < userIds.length; i += options.batchSize) {
      const batch = userIds.slice(i, i + options.batchSize)

      await Promise.allSettled(
        batch.map(async (userId) => {
          try {
            await this.performSync(userId)
            results.success++
          } catch (error: any) {
            results.failed++
            results.errors.push({
              userId,
              error: error.message || 'Unknown error'
            })
          }
        })
      )

      logger.info(`[LeaderboardMaterializer] Batch progress: ${i + batch.length}/${userIds.length}`)
    }

    logger.info(`[LeaderboardMaterializer] Batch sync complete:`, results)
    return results
  }

  /**
   * Rebuild entire leaderboard from user_stats
   * ADMIN ONLY - Use with caution!
   */
  async rebuildLeaderboard(options = { dryRun: false }): Promise<{
    totalUsers: number
    synced: number
    failed: number
    errors: Array<{ userId: string; error: string }>
  }> {
    logger.warn(`[LeaderboardMaterializer] Starting full leaderboard rebuild (dryRun: ${options.dryRun})`)
    console.log(`[LeaderboardMaterializer] Starting full leaderboard rebuild (dryRun: ${options.dryRun})`)

    try {
      // 1. Get all user_stats documents
      const userStatsSnapshot = await adminDb
        .collection(this.USER_STATS_COLLECTION)
        .get()

      const userIds = userStatsSnapshot.docs.map(doc => doc.id)

      logger.info(`[LeaderboardMaterializer] Found ${userIds.length} users to rebuild`)
      console.log(`[LeaderboardMaterializer] Found ${userIds.length} users to rebuild`, userIds)

      if (options.dryRun) {
        return {
          totalUsers: userIds.length,
          synced: 0,
          failed: 0,
          errors: []
        }
      }

      // 2. Batch sync all users
      const batchResults = await this.batchSyncUsers(userIds, { batchSize: 100 })

      console.log(`[LeaderboardMaterializer] Batch results:`, batchResults)

      return {
        totalUsers: userIds.length,
        synced: batchResults.success,
        failed: batchResults.failed,
        errors: batchResults.errors
      }

    } catch (error) {
      logger.error('[LeaderboardMaterializer] Rebuild failed:', error)
      throw error
    }
  }

  /**
   * Check consistency between user_stats and leaderboard_stats
   * Returns users with mismatched data
   */
  async checkConsistency(options = { limit: 1000 }): Promise<Array<{
    userId: string
    email: string
    issues: {
      streak?: { userStats: number; leaderboard: number; diff: number }
      points?: { userStats: number; leaderboard: number; diff: number }
      xp?: { userStats: number; leaderboard: number; diff: number }
    }
    severity: 'low' | 'medium' | 'high'
  }>> {
    logger.info(`[LeaderboardMaterializer] Checking consistency (limit: ${options.limit})`)

    const inconsistencies: any[] = []

    try {
      // Get sample of users
      const userStatsSnapshot = await adminDb
        .collection(this.USER_STATS_COLLECTION)
        .limit(options.limit)
        .get()

      for (const userStatsDoc of userStatsSnapshot.docs) {
        const userId = userStatsDoc.id
        const userStats = userStatsDoc.data()

        // Get corresponding leaderboard entry
        const leaderboardDoc = await adminDb
          .collection(this.LEADERBOARD_COLLECTION)
          .doc(userId)
          .get()

        if (!leaderboardDoc.exists) {
          // User not in leaderboard at all
          inconsistencies.push({
            userId,
            email: userStats.email || 'unknown',
            issues: {
              missing: 'User not in leaderboard_stats'
            },
            severity: 'high'
          })
          continue
        }

        const leaderboardData = leaderboardDoc.data()!
        const issues: any = {}

        // Check streak
        const streakDiff = Math.abs((userStats.streak?.current || 0) - (leaderboardData.currentStreak || 0))
        if (streakDiff > 0) {
          issues.streak = {
            userStats: userStats.streak?.current || 0,
            leaderboard: leaderboardData.currentStreak || 0,
            diff: streakDiff
          }
        }

        // Check points
        const pointsDiff = Math.abs((userStats.achievements?.totalPoints || 0) - (leaderboardData.totalPoints || 0))
        if (pointsDiff > 0) {
          issues.points = {
            userStats: userStats.achievements?.totalPoints || 0,
            leaderboard: leaderboardData.totalPoints || 0,
            diff: pointsDiff
          }
        }

        // Check XP
        const xpDiff = Math.abs((userStats.xp?.total || 0) - (leaderboardData.totalXP || 0))
        if (xpDiff > 0) {
          issues.xp = {
            userStats: userStats.xp?.total || 0,
            leaderboard: leaderboardData.totalXP || 0,
            diff: xpDiff
          }
        }

        // If any issues found, add to list
        if (Object.keys(issues).length > 0) {
          // Determine severity
          let severity: 'low' | 'medium' | 'high' = 'low'
          if (streakDiff > 5 || pointsDiff > 100 || xpDiff > 500) {
            severity = 'high'
          } else if (streakDiff > 2 || pointsDiff > 50 || xpDiff > 200) {
            severity = 'medium'
          }

          inconsistencies.push({
            userId,
            email: userStats.email || 'unknown',
            issues,
            severity
          })
        }
      }

      logger.info(`[LeaderboardMaterializer] Found ${inconsistencies.length} inconsistencies`)
      return inconsistencies

    } catch (error) {
      logger.error('[LeaderboardMaterializer] Consistency check failed:', error)
      throw error
    }
  }

  /**
   * Clear the sync queue (for testing)
   */
  clearQueue(): void {
    for (const timeout of this.syncQueue.values()) {
      clearTimeout(timeout)
    }
    this.syncQueue.clear()
    logger.debug('[LeaderboardMaterializer] Cleared sync queue')
  }
}

// Export singleton instance
export const leaderboardMaterializer = LeaderboardMaterializer.getInstance()
