/**
 * Stats Adapter Service
 *
 * Provides backward compatibility during migration from old collections
 * to the new unified user_stats collection.
 *
 * This adapter allows the app to work with both old and new data structures
 * during the transition period.
 */

import { adminDb } from '@/lib/firebase/admin'
import { UserStats, userStatsService } from './UserStatsService'
import logger from '@/lib/logger'

export interface MigrationStatus {
  hasUserStats: boolean
  hasLeaderboardStats: boolean
  hasAchievements: boolean
  hasStatistics: boolean
  isFullyMigrated: boolean
  needsMigration: boolean
}

export class StatsAdapter {
  private static instance: StatsAdapter
  private readonly USE_UNIFIED_ONLY = false // Set to true to force unified stats

  private constructor() {}

  public static getInstance(): StatsAdapter {
    if (!StatsAdapter.instance) {
      StatsAdapter.instance = new StatsAdapter()
    }
    return StatsAdapter.instance
  }

  /**
   * Check migration status for a user
   */
  async checkMigrationStatus(userId: string): Promise<MigrationStatus> {
    try {
      const [userStatsDoc, leaderboardDoc, achievementsDoc, statsDoc] = await Promise.all([
        adminDb.collection('user_stats').doc(userId).get(),
        adminDb.collection('leaderboard_stats').doc(userId).get(),
        adminDb.collection('users').doc(userId).collection('achievements').doc('data').get(),
        adminDb.collection('users').doc(userId).collection('statistics').doc('overall').get()
      ])

      const status: MigrationStatus = {
        hasUserStats: userStatsDoc.exists,
        hasLeaderboardStats: leaderboardDoc.exists,
        hasAchievements: achievementsDoc.exists,
        hasStatistics: statsDoc.exists,
        isFullyMigrated: false,
        needsMigration: false
      }

      // Check if fully migrated
      status.isFullyMigrated = status.hasUserStats &&
                               (!status.hasLeaderboardStats && !status.hasAchievements && !status.hasStatistics)

      // Check if needs migration
      status.needsMigration = !status.hasUserStats &&
                             (status.hasLeaderboardStats || status.hasAchievements || status.hasStatistics)

      logger.info(`[StatsAdapter] Migration status for ${userId}:`, status)
      return status

    } catch (error) {
      logger.error('[StatsAdapter] Error checking migration status:', error)
      return {
        hasUserStats: false,
        hasLeaderboardStats: false,
        hasAchievements: false,
        hasStatistics: false,
        isFullyMigrated: false,
        needsMigration: true
      }
    }
  }

  /**
   * Get stats with fallback to old collections if needed
   */
  async getStatsWithFallback(userId: string): Promise<UserStats> {
    // First, try to get from unified stats
    const userStatsDoc = await adminDb.collection('user_stats').doc(userId).get()

    if (userStatsDoc.exists || this.USE_UNIFIED_ONLY) {
      logger.info(`[StatsAdapter] Using unified stats for ${userId}`)
      return userStatsService.getUserStats(userId)
    }

    // Fallback: Check migration status
    const status = await this.checkMigrationStatus(userId)

    if (status.needsMigration) {
      logger.warn(`[StatsAdapter] User ${userId} needs migration, triggering repair`)
      // Trigger migration via repair
      const stats = await userStatsService.getUserStats(userId)
      return await userStatsService.repairUserStats(userId, stats)
    }

    // Default: Create new stats
    logger.info(`[StatsAdapter] Creating new stats for ${userId}`)
    return userStatsService.getUserStats(userId)
  }

  /**
   * Update stats with automatic migration if needed
   */
  async updateStats(userId: string, type: string, data: any): Promise<UserStats> {
    // Check if user has been migrated
    const status = await this.checkMigrationStatus(userId)

    if (status.needsMigration) {
      logger.info(`[StatsAdapter] Auto-migrating ${userId} before update`)
      const stats = await userStatsService.getUserStats(userId)
      await userStatsService.repairUserStats(userId, stats)
    }

    // Now update using the unified service
    return userStatsService.updateUserStats(userId, {
      type: type as any,
      data,
      timestamp: Date.now()
    })
  }

  /**
   * Get leaderboard data (backward compatible)
   */
  async getLeaderboardData(userId: string): Promise<any> {
    const stats = await this.getStatsWithFallback(userId)

    // Transform to old leaderboard format for compatibility
    return {
      userId,
      displayName: stats.displayName,
      photoURL: stats.photoURL,
      currentStreak: stats.streak.current,
      bestStreak: stats.streak.best,
      totalXP: stats.xp.total,
      level: stats.xp.level,
      weeklyXP: stats.xp.weeklyXP,
      monthlyXP: stats.xp.monthlyXP,
      achievementPoints: stats.achievements.totalPoints,
      lastActivityDate: stats.streak.lastActivityDate
    }
  }

  /**
   * Get achievement data (backward compatible)
   */
  async getAchievementData(userId: string): Promise<any> {
    const stats = await this.getStatsWithFallback(userId)

    // Transform to old achievement format
    return {
      unlocked: stats.achievements.unlockedIds,
      totalPoints: stats.achievements.totalPoints,
      totalXp: stats.xp.total,
      currentLevel: stats.xp.level,
      statistics: {
        percentageComplete: stats.achievements.completionPercentage,
        byCategory: stats.achievements.byCategory || {}
      }
    }
  }

  /**
   * Get activity data (backward compatible)
   */
  async getActivityData(userId: string): Promise<any> {
    const stats = await this.getStatsWithFallback(userId)

    return {
      dates: stats.streak.dates,
      currentStreak: stats.streak.current,
      bestStreak: stats.streak.best,
      lastActivity: Date.now()
    }
  }

  /**
   * Migrate specific user to unified stats
   */
  async migrateUser(userId: string): Promise<boolean> {
    try {
      logger.info(`[StatsAdapter] Starting migration for ${userId}`)

      const status = await this.checkMigrationStatus(userId)

      if (status.isFullyMigrated) {
        logger.info(`[StatsAdapter] User ${userId} already fully migrated`)
        return true
      }

      if (!status.hasUserStats) {
        // Create and populate user_stats
        const stats = await userStatsService.getUserStats(userId)
        await userStatsService.repairUserStats(userId, stats)
      }

      // Mark old collections for deletion (but don't delete yet)
      logger.info(`[StatsAdapter] Migration complete for ${userId}`)
      return true

    } catch (error) {
      logger.error(`[StatsAdapter] Migration failed for ${userId}:`, error)
      return false
    }
  }

  /**
   * Batch migrate multiple users
   */
  async batchMigrate(userIds: string[]): Promise<{ success: string[], failed: string[] }> {
    const results = {
      success: [] as string[],
      failed: [] as string[]
    }

    for (const userId of userIds) {
      const success = await this.migrateUser(userId)
      if (success) {
        results.success.push(userId)
      } else {
        results.failed.push(userId)
      }

      // Small delay between migrations
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    logger.info('[StatsAdapter] Batch migration complete:', results)
    return results
  }

  /**
   * Check if should use unified stats
   */
  shouldUseUnifiedStats(userId: string): boolean {
    // You can implement logic here to gradually roll out
    // For now, use unified if it exists
    return this.USE_UNIFIED_ONLY
  }

  /**
   * Log stats source for debugging
   */
  private logSource(userId: string, source: 'unified' | 'legacy' | 'mixed') {
    logger.debug(`[StatsAdapter] Using ${source} source for user ${userId}`)
  }
}

// Export singleton instance
export const statsAdapter = StatsAdapter.getInstance()