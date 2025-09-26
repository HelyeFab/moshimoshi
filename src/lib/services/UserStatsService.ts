/**
 * UserStatsService - Single Source of Truth for All User Statistics
 *
 * This service manages the unified user_stats collection which consolidates:
 * - Streak data (current, best, dates)
 * - XP and levels
 * - Achievements
 * - Session statistics
 * - User metadata
 *
 * ALL stats operations should go through this service to ensure consistency.
 */

import { adminDb } from '@/lib/firebase/admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { calculateStreakFromDates, cleanNestedDates, checkStreakRisk } from '@/utils/streakCalculator'
import logger from '@/lib/logger'

// ============================================
// Type Definitions
// ============================================

export interface UserStats {
  // User Information
  userId: string
  email: string
  displayName: string
  photoURL?: string
  tier: 'free' | 'premium'

  // Streak Data (SINGLE SOURCE OF TRUTH)
  streak: {
    current: number
    best: number
    dates: Record<string, boolean>  // {"2025-09-23": true}
    lastActivityDate: string | null
    isActiveToday: boolean
    streakAtRisk: boolean
    hoursRemainingToday?: number
  }

  // XP & Level System
  xp: {
    total: number
    level: number
    levelTitle: string
    weeklyXP: number
    monthlyXP: number
    xpToNextLevel: number
    lastXpGain?: number
    xpGainedToday: number
  }

  // Achievements
  achievements: {
    totalPoints: number
    unlockedCount: number
    unlockedIds: string[]
    lastUnlocked?: string
    lastUnlockedAt?: Timestamp
    completionPercentage: number
    byCategory?: Record<string, number>
  }

  // Session Statistics
  sessions: {
    totalSessions: number
    totalItemsReviewed: number
    averageAccuracy: number
    totalStudyTimeMinutes: number
    lastSessionDate?: Timestamp
    lastSessionType?: string
    todaySessions: number
    weekSessions: number
    monthSessions: number
  }

  // Metadata
  metadata: {
    createdAt: Timestamp
    lastUpdated: Timestamp
    schemaVersion: number
    syncStatus: 'synced' | 'pending' | 'error'
    dataHealth: 'healthy' | 'needs_repair' | 'corrupted'
    lastDataCheck?: Timestamp
    migratedFrom?: string[]  // Track migration sources
  }
}

// Partial update types
export type UserStatsUpdate = Partial<Omit<UserStats, 'userId' | 'metadata'>>

// Update operation types
export interface StatsUpdateOperation {
  type: 'streak' | 'xp' | 'achievement' | 'session' | 'profile' | 'full'
  data: any
  timestamp: number
}

// ============================================
// Service Class
// ============================================

export class UserStatsService {
  private static instance: UserStatsService
  private readonly COLLECTION_NAME = 'user_stats'
  private readonly SCHEMA_VERSION = 2

  private constructor() {}

  public static getInstance(): UserStatsService {
    if (!UserStatsService.instance) {
      UserStatsService.instance = new UserStatsService()
    }
    return UserStatsService.instance
  }

  // ============================================
  // Core CRUD Operations
  // ============================================

  /**
   * Get user stats - creates if doesn't exist
   */
  async getUserStats(userId: string, userData?: any): Promise<UserStats> {
    try {
      const statsRef = adminDb.collection(this.COLLECTION_NAME).doc(userId)
      const doc = await statsRef.get()

      if (doc.exists) {
        const data = doc.data() as UserStats

        // Check if data needs repair
        if (data.metadata?.dataHealth === 'needs_repair' || data.metadata?.dataHealth === 'corrupted') {
          logger.warn(`[UserStatsService] User ${userId} data needs repair`)
          return await this.repairUserStats(userId, data)
        }

        return data
      }

      // Create new stats document
      return await this.createUserStats(userId, userData)
    } catch (error) {
      logger.error('[UserStatsService] Error getting user stats:', error)
      throw error
    }
  }

  /**
   * Create new user stats document
   */
  private async createUserStats(userId: string, userData?: any): Promise<UserStats> {
    logger.info(`[UserStatsService] Creating new stats for user ${userId}`)

    // Get user data if not provided
    if (!userData) {
      const userDoc = await adminDb.collection('users').doc(userId).get()
      userData = userDoc.exists ? userDoc.data() : {}
    }

    const now = FieldValue.serverTimestamp() as Timestamp
    const today = new Date().toISOString().split('T')[0]

    const newStats: UserStats = {
      // User info
      userId,
      email: userData?.email || '',
      displayName: userData?.displayName || userData?.profile?.displayName || 'Anonymous',
      photoURL: userData?.photoURL || userData?.profile?.avatarUrl || null,
      tier: userData?.subscription?.plan?.startsWith('premium') ? 'premium' : 'free',

      // Initialize streak
      streak: {
        current: 0,
        best: 0,
        dates: {},
        lastActivityDate: null,
        isActiveToday: false,
        streakAtRisk: false
      },

      // Initialize XP
      xp: {
        total: 0,
        level: 1,
        levelTitle: 'Beginner',
        weeklyXP: 0,
        monthlyXP: 0,
        xpToNextLevel: 100,
        xpGainedToday: 0
      },

      // Initialize achievements
      achievements: {
        totalPoints: 0,
        unlockedCount: 0,
        unlockedIds: [],
        completionPercentage: 0
      },

      // Initialize sessions
      sessions: {
        totalSessions: 0,
        totalItemsReviewed: 0,
        averageAccuracy: 0,
        totalStudyTimeMinutes: 0,
        todaySessions: 0,
        weekSessions: 0,
        monthSessions: 0
      },

      // Metadata
      metadata: {
        createdAt: now,
        lastUpdated: now,
        schemaVersion: this.SCHEMA_VERSION,
        syncStatus: 'synced',
        dataHealth: 'healthy'
      }
    }

    await adminDb.collection(this.COLLECTION_NAME).doc(userId).set(newStats)
    return newStats
  }

  /**
   * Update user stats - atomic operation
   */
  async updateUserStats(
    userId: string,
    updates: StatsUpdateOperation
  ): Promise<UserStats> {
    const statsRef = adminDb.collection(this.COLLECTION_NAME).doc(userId)

    try {
      return await adminDb.runTransaction(async (transaction) => {
        const doc = await transaction.get(statsRef)
        let currentStats: UserStats

        if (!doc.exists) {
          currentStats = await this.createUserStats(userId)
        } else {
          currentStats = doc.data() as UserStats
        }

        // Apply updates based on type
        const updatedStats = await this.applyUpdates(currentStats, updates)

        // Update metadata
        updatedStats.metadata.lastUpdated = FieldValue.serverTimestamp() as Timestamp
        updatedStats.metadata.syncStatus = 'synced'

        transaction.set(statsRef, updatedStats)

        logger.info(`[UserStatsService] Updated stats for user ${userId}:`, {
          type: updates.type,
          streak: updatedStats.streak.current,
          xp: updatedStats.xp.total
        })

        return updatedStats
      })
    } catch (error) {
      logger.error('[UserStatsService] Error updating user stats:', error)
      throw error
    }
  }

  // ============================================
  // Specific Update Operations
  // ============================================

  /**
   * Update streak data
   */
  async updateStreak(userId: string, activityDate?: string): Promise<UserStats> {
    const today = activityDate || new Date().toISOString().split('T')[0]

    return this.updateUserStats(userId, {
      type: 'streak',
      data: { activityDate: today },
      timestamp: Date.now()
    })
  }

  /**
   * Update XP and calculate level
   */
  async updateXP(userId: string, xpGained: number, source: string): Promise<UserStats> {
    return this.updateUserStats(userId, {
      type: 'xp',
      data: { xpGained, source },
      timestamp: Date.now()
    })
  }

  /**
   * Unlock achievement
   */
  async unlockAchievement(
    userId: string,
    achievementId: string,
    points: number
  ): Promise<UserStats> {
    return this.updateUserStats(userId, {
      type: 'achievement',
      data: { achievementId, points },
      timestamp: Date.now()
    })
  }

  /**
   * Record session completion
   */
  async recordSession(
    userId: string,
    sessionData: {
      type: string
      itemsReviewed: number
      accuracy: number
      duration: number
    }
  ): Promise<UserStats> {
    return this.updateUserStats(userId, {
      type: 'session',
      data: sessionData,
      timestamp: Date.now()
    })
  }

  // ============================================
  // Data Repair & Migration
  // ============================================

  /**
   * Repair corrupted user stats
   */
  async repairUserStats(userId: string, currentData?: UserStats): Promise<UserStats> {
    logger.warn(`[UserStatsService] Repairing stats for user ${userId}`)

    try {
      // Fetch data from all sources
      const [leaderboardStats, achievementsData, activitiesData, sessionsData] = await Promise.all([
        adminDb.collection('leaderboard_stats').doc(userId).get(),
        adminDb.collection('users').doc(userId).collection('achievements').doc('data').get(),
        adminDb.collection('users').doc(userId).collection('achievements').doc('activities').get(),
        adminDb.collection('users').doc(userId).collection('statistics').doc('overall').get()
      ])

      // Extract and clean dates
      let cleanDates: Record<string, boolean> = {}
      if (activitiesData.exists) {
        const rawData = activitiesData.data()
        cleanDates = cleanNestedDates(rawData)

        // Also check for corrupted root-level dates
        Object.keys(rawData || {}).forEach(key => {
          if (key.startsWith('dates.') && key.match(/dates\.\d{4}-\d{2}-\d{2}$/)) {
            const dateOnly = key.replace('dates.', '')
            cleanDates[dateOnly] = true
          }
        })
      }

      // Calculate correct streak
      const existingBest = currentData?.streak?.best ||
                          leaderboardStats.data()?.bestStreak ||
                          activitiesData.data()?.bestStreak || 0

      const streakResult = calculateStreakFromDates(cleanDates, existingBest)
      const riskInfo = checkStreakRisk(cleanDates)

      // Build repaired stats
      const repairedStats: UserStats = {
        ...(currentData || await this.createUserStats(userId)),

        streak: {
          current: streakResult.currentStreak,
          best: streakResult.bestStreak,
          dates: cleanDates,
          lastActivityDate: streakResult.lastActivityDate,
          isActiveToday: streakResult.isActiveToday,
          streakAtRisk: riskInfo.atRisk,
          hoursRemainingToday: riskInfo.hoursRemaining
        },

        xp: {
          total: achievementsData.data()?.totalXp || leaderboardStats.data()?.totalXP || 0,
          level: achievementsData.data()?.currentLevel || leaderboardStats.data()?.level || 1,
          levelTitle: this.getLevelTitle(achievementsData.data()?.currentLevel || 1),
          weeklyXP: leaderboardStats.data()?.weeklyXP || 0,
          monthlyXP: leaderboardStats.data()?.monthlyXP || 0,
          xpToNextLevel: this.calculateXPToNextLevel(
            achievementsData.data()?.totalXp || 0,
            achievementsData.data()?.currentLevel || 1
          ),
          xpGainedToday: 0
        },

        achievements: {
          totalPoints: achievementsData.data()?.totalPoints || leaderboardStats.data()?.achievementPoints || 0,
          unlockedCount: achievementsData.data()?.unlocked?.length || 0,
          unlockedIds: achievementsData.data()?.unlocked || [],
          completionPercentage: achievementsData.data()?.statistics?.percentageComplete || 0,
          byCategory: achievementsData.data()?.statistics?.byCategory || {}
        },

        sessions: {
          totalSessions: sessionsData.data()?.totalSessions || 0,
          totalItemsReviewed: sessionsData.data()?.totalItemsReviewed || 0,
          averageAccuracy: sessionsData.data()?.averageAccuracy || 0,
          totalStudyTimeMinutes: sessionsData.data()?.totalStudyTime || 0,
          todaySessions: 0,
          weekSessions: 0,
          monthSessions: 0
        },

        metadata: {
          ...currentData?.metadata!,
          lastUpdated: FieldValue.serverTimestamp() as Timestamp,
          dataHealth: 'healthy',
          lastDataCheck: FieldValue.serverTimestamp() as Timestamp,
          migratedFrom: ['leaderboard_stats', 'achievements', 'statistics']
        }
      }

      // Save repaired data
      await adminDb.collection(this.COLLECTION_NAME).doc(userId).set(repairedStats)

      logger.info(`[UserStatsService] Successfully repaired stats for user ${userId}`)
      return repairedStats

    } catch (error) {
      logger.error(`[UserStatsService] Failed to repair stats for user ${userId}:`, error)
      throw error
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Apply updates to current stats
   */
  private async applyUpdates(
    current: UserStats,
    updates: StatsUpdateOperation
  ): Promise<UserStats> {
    const updated = { ...current }
    const today = new Date().toISOString().split('T')[0]

    switch (updates.type) {
      case 'streak':
        // Mark activity date
        const activityDate = updates.data.activityDate || today
        updated.streak.dates[activityDate] = true

        // Recalculate streak
        const streakResult = calculateStreakFromDates(
          updated.streak.dates,
          updated.streak.best
        )

        const riskInfo = checkStreakRisk(updated.streak.dates)

        updated.streak = {
          ...updated.streak,
          current: streakResult.currentStreak,
          best: streakResult.bestStreak,
          lastActivityDate: streakResult.lastActivityDate,
          isActiveToday: streakResult.isActiveToday,
          streakAtRisk: riskInfo.atRisk,
          hoursRemainingToday: riskInfo.hoursRemaining
        }
        break

      case 'xp':
        const xpGained = updates.data.xpGained || 0
        updated.xp.total += xpGained
        updated.xp.lastXpGain = xpGained

        // Update daily/weekly/monthly XP
        if (updates.data.resetPeriod !== true) {
          updated.xp.xpGainedToday += xpGained
          updated.xp.weeklyXP += xpGained
          updated.xp.monthlyXP += xpGained
        }

        // Calculate new level
        const newLevel = this.calculateLevel(updated.xp.total)
        if (newLevel > updated.xp.level) {
          updated.xp.level = newLevel
          updated.xp.levelTitle = this.getLevelTitle(newLevel)
        }

        updated.xp.xpToNextLevel = this.calculateXPToNextLevel(updated.xp.total, updated.xp.level)
        break

      case 'achievement':
        const { achievementId, points } = updates.data
        if (!updated.achievements.unlockedIds.includes(achievementId)) {
          updated.achievements.unlockedIds.push(achievementId)
          updated.achievements.unlockedCount++
          updated.achievements.totalPoints += points || 0
          updated.achievements.lastUnlocked = achievementId
          updated.achievements.lastUnlockedAt = FieldValue.serverTimestamp() as Timestamp
        }
        break

      case 'session':
        const { itemsReviewed, accuracy, duration, type } = updates.data
        updated.sessions.totalSessions++
        updated.sessions.totalItemsReviewed += itemsReviewed || 0
        updated.sessions.todaySessions++
        updated.sessions.weekSessions++
        updated.sessions.monthSessions++

        // Update average accuracy
        if (accuracy !== undefined) {
          const total = updated.sessions.totalSessions
          const currentAvg = updated.sessions.averageAccuracy
          updated.sessions.averageAccuracy =
            ((currentAvg * (total - 1)) + accuracy) / total
        }

        // Update study time
        if (duration) {
          updated.sessions.totalStudyTimeMinutes += Math.round(duration / 60000)
        }

        updated.sessions.lastSessionDate = FieldValue.serverTimestamp() as Timestamp
        updated.sessions.lastSessionType = type
        break

      case 'profile':
        // Update profile info
        Object.assign(updated, updates.data)
        break

      case 'full':
        // Full replacement (used in migration)
        return { ...updated, ...updates.data }
    }

    return updated
  }

  /**
   * Calculate level from XP
   */
  private calculateLevel(totalXP: number): number {
    // Simple level calculation - can be made more complex
    if (totalXP < 100) return 1
    if (totalXP < 300) return 2
    if (totalXP < 600) return 3
    if (totalXP < 1000) return 4
    if (totalXP < 1500) return 5
    if (totalXP < 2100) return 6
    if (totalXP < 2800) return 7
    if (totalXP < 3600) return 8
    if (totalXP < 4500) return 9
    if (totalXP < 5500) return 10

    // After level 10, every 1000 XP = 1 level
    return 10 + Math.floor((totalXP - 5500) / 1000)
  }

  /**
   * Get level title
   */
  private getLevelTitle(level: number): string {
    if (level <= 5) return 'Beginner'
    if (level <= 10) return 'Novice'
    if (level <= 15) return 'Apprentice'
    if (level <= 20) return 'Student'
    if (level <= 25) return 'Scholar'
    if (level <= 30) return 'Adept'
    if (level <= 35) return 'Expert'
    if (level <= 40) return 'Master'
    if (level <= 50) return 'Grandmaster'
    if (level <= 60) return 'Sensei'
    if (level <= 80) return 'Legend'
    if (level <= 100) return 'Mythic'
    return 'Kami'
  }

  /**
   * Calculate XP needed for next level
   */
  private calculateXPToNextLevel(currentXP: number, currentLevel: number): number {
    const xpTable = [
      0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500
    ]

    if (currentLevel < 10) {
      return xpTable[currentLevel] - currentXP
    }

    // After level 10, every 1000 XP = 1 level
    const nextLevelXP = 5500 + ((currentLevel - 9) * 1000)
    return nextLevelXP - currentXP
  }

  // ============================================
  // Query Methods
  // ============================================

  /**
   * Get top users by XP
   */
  async getTopUsersByXP(limit: number = 10): Promise<UserStats[]> {
    const snapshot = await adminDb
      .collection(this.COLLECTION_NAME)
      .orderBy('xp.total', 'desc')
      .limit(limit)
      .get()

    return snapshot.docs.map(doc => doc.data() as UserStats)
  }

  /**
   * Get users with streaks at risk
   */
  async getUsersWithStreaksAtRisk(): Promise<UserStats[]> {
    const snapshot = await adminDb
      .collection(this.COLLECTION_NAME)
      .where('streak.streakAtRisk', '==', true)
      .get()

    return snapshot.docs.map(doc => doc.data() as UserStats)
  }

  /**
   * Get stats summary for admin
   */
  async getAdminStatsSummary(): Promise<any> {
    const snapshot = await adminDb.collection(this.COLLECTION_NAME).get()

    let totalUsers = 0
    let activeToday = 0
    let totalXP = 0
    let totalStreakDays = 0
    let premiumUsers = 0

    snapshot.forEach(doc => {
      const data = doc.data() as UserStats
      totalUsers++
      if (data.streak.isActiveToday) activeToday++
      totalXP += data.xp.total
      totalStreakDays += data.streak.current
      if (data.tier === 'premium') premiumUsers++
    })

    return {
      totalUsers,
      activeToday,
      totalXP,
      averageStreak: totalUsers > 0 ? (totalStreakDays / totalUsers).toFixed(1) : 0,
      premiumUsers,
      freeUsers: totalUsers - premiumUsers
    }
  }
}

// Export singleton instance
export const userStatsService = UserStatsService.getInstance()