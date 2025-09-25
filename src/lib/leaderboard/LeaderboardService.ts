/**
 * Leaderboard Service
 * Handles aggregation, ranking, and retrieval of leaderboard data
 */

import { adminDb } from '@/lib/firebase/admin'
import {
  LeaderboardEntry,
  LeaderboardSnapshot,
  TimeFrame,
  LeaderboardAggregationData,
  LeaderboardFilters,
  UserLeaderboardStats
} from './types'
import logger from '@/lib/logger'
import {
  getCachedLeaderboard,
  setCachedLeaderboard,
  invalidateLeaderboardCache
} from '@/lib/redis/caches/leaderboard-cache'

export class LeaderboardService {
  private static instance: LeaderboardService

  private constructor() {}

  public static getInstance(): LeaderboardService {
    if (!LeaderboardService.instance) {
      LeaderboardService.instance = new LeaderboardService()
    }
    return LeaderboardService.instance
  }

  /**
   * Get user data from lightweight leaderboard stats
   * (This replaces the heavy aggregation approach)
   */
  async getUserLeaderboardData(userId: string): Promise<LeaderboardAggregationData | null> {
    try {
      logger.info('[LeaderboardService] Getting leaderboard data for user:', userId)

      // Check if user has opted out
      const optOutDoc = await adminDb.collection('leaderboard_optouts').doc(userId).get()
      if (optOutDoc.exists) {
        logger.info(`[LeaderboardService] User ${userId} has opted out of leaderboard`)
        return null
      }

      // Get user's leaderboard stats
      const statsDoc = await adminDb.collection('leaderboard_stats').doc(userId).get()
      if (!statsDoc.exists) {
        logger.warn(`[LeaderboardService] No leaderboard stats for user ${userId}`)
        return null
      }

      const data = statsDoc.data()
      return {
        userId,
        displayName: data.displayName || 'Anonymous',
        photoURL: data.photoURL,
        currentStreak: data.currentStreak || 0,
        bestStreak: data.bestStreak || data.currentStreak || 0,
        lastActivity: data.lastActivityDate?.toMillis() || Date.now(),
        totalXP: data.totalXP || 0,
        currentLevel: data.level || 1,
        weeklyXP: data.weeklyXP || 0,
        monthlyXP: data.monthlyXP || 0,
        achievementsUnlocked: {},
        totalPoints: data.achievementPoints || 0,
        subscription: data.subscription,
        privacy: {
          publicProfile: true,
          hideFromLeaderboard: false,
          useAnonymousName: false
        }
      }
    } catch (error) {
      logger.error('[LeaderboardService] Error getting user leaderboard data:', error)
      return null
    }
  }

  /**
   * DEPRECATED: Heavy aggregation from multiple collections
   * Kept for backward compatibility but should not be used
   */
  async aggregateUserData(userId: string): Promise<LeaderboardAggregationData | null> {
    // This method is deprecated in favor of getUserLeaderboardData
    // which uses the lightweight leaderboard_stats collection
    return this.getUserLeaderboardData(userId)
  }

  /**
   * Build leaderboard for a specific timeframe
   */
  async buildLeaderboard(timeframe: TimeFrame, limit: number = 100): Promise<LeaderboardSnapshot> {
    try {
      logger.info('[LeaderboardService] Building leaderboard for timeframe:', timeframe)

      // Get all users from the lightweight leaderboard_stats collection
      // This contains only public achievement data for ALL users (free and premium)
      const [statsSnapshot, optOutsSnapshot] = await Promise.all([
        adminDb.collection('leaderboard_stats')
          .orderBy('totalXP', 'desc')
          .limit(limit * 2) // Get extra in case of opt-outs
          .get(),
        adminDb.collection('leaderboard_optouts').get()
      ])

      // Create a set of opted-out users for quick lookup
      const optedOutUsers = new Set(optOutsSnapshot.docs.map(doc => doc.id))

      // Filter out opted-out users and build the leaderboard
      const aggregatedData: LeaderboardAggregationData[] = []

      for (const doc of statsSnapshot.docs) {
        const userId = doc.id
        const data = doc.data()

        // Skip if user has opted out
        if (optedOutUsers.has(userId)) {
          continue
        }

        // Build aggregated data from lightweight stats
        aggregatedData.push({
          userId,
          displayName: data.displayName || 'Anonymous',
          photoURL: data.photoURL,
          currentStreak: data.currentStreak || 0,
          bestStreak: data.bestStreak || data.currentStreak || 0,
          lastActivity: data.lastActivityDate?.toMillis() || Date.now(),
          totalXP: data.totalXP || 0,
          currentLevel: data.level || 1,
          weeklyXP: data.weeklyXP || 0,
          monthlyXP: data.monthlyXP || 0,
          achievementsUnlocked: {},
          totalPoints: data.achievementPoints || 0,
          subscription: data.subscription,
          privacy: {
            publicProfile: true,
            hideFromLeaderboard: false,
            useAnonymousName: false
          }
        })

        // Stop if we have enough entries
        if (aggregatedData.length >= limit) {
          break
        }
      }

      // Calculate scores based on timeframe
      const scoredEntries = aggregatedData.map(data => {
        let score = 0
        let xpForTimeframe = data.totalXP

        switch (timeframe) {
          case 'daily':
            // For daily, weight recent activity more heavily
            xpForTimeframe = Math.floor(data.totalXP / 30) // Rough daily average
            score = data.totalPoints + xpForTimeframe + (data.currentStreak * 10)
            break
          case 'weekly':
            xpForTimeframe = data.weeklyXP || Math.floor(data.totalXP / 4)
            score = data.totalPoints + xpForTimeframe + (data.currentStreak * 5)
            break
          case 'monthly':
            xpForTimeframe = data.monthlyXP || data.totalXP
            score = data.totalPoints + xpForTimeframe + (data.currentStreak * 2)
            break
          case 'allTime':
          default:
            score = data.totalPoints + data.totalXP + (data.bestStreak * 3)
            break
        }

        // Count achievement rarities
        const rarityCount = {
          legendary: 0,
          epic: 0,
          rare: 0,
          uncommon: 0,
          common: 0
        }

        // Note: In a real implementation, you'd look up achievement definitions
        // to determine rarity. For now, we'll use a simple heuristic
        const achievementCount = Object.keys(data.achievementsUnlocked).length
        rarityCount.common = Math.floor(achievementCount * 0.4)
        rarityCount.uncommon = Math.floor(achievementCount * 0.3)
        rarityCount.rare = Math.floor(achievementCount * 0.2)
        rarityCount.epic = Math.floor(achievementCount * 0.08)
        rarityCount.legendary = Math.floor(achievementCount * 0.02)

        const entry: LeaderboardEntry = {
          rank: 0, // Will be set after sorting
          userId: data.userId,
          displayName: data.privacy?.useAnonymousName
            ? `Anonymous Learner ${data.userId.slice(-4)}`
            : data.displayName,
          photoURL: data.privacy?.useAnonymousName ? undefined : data.photoURL,
          totalPoints: data.totalPoints,
          totalXP: xpForTimeframe,
          currentLevel: data.currentLevel,
          currentStreak: data.currentStreak,
          bestStreak: data.bestStreak,
          achievementCount,
          achievementRarity: rarityCount,
          lastActive: data.lastActivity,
          subscription: data.subscription?.plan as any,
          isPublic: true,
          isAnonymous: data.privacy?.useAnonymousName || false
        }

        return { entry, score }
      })

      // Sort by score (descending)
      scoredEntries.sort((a, b) => b.score - a.score)

      // Assign ranks and extract entries
      const entries = scoredEntries.slice(0, limit).map((item, index) => {
        item.entry.rank = index + 1
        return item.entry
      })

      const snapshot: LeaderboardSnapshot = {
        id: `${timeframe}-${Date.now()}`,
        timeframe,
        timestamp: Date.now(),
        entries,
        totalPlayers: aggregatedData.length,
        lastUpdated: Date.now()
      }

      // Store snapshot in Firestore for caching
      await this.saveSnapshot(snapshot)

      return snapshot
    } catch (error) {
      logger.error('[LeaderboardService] Error building leaderboard:', error)
      throw error
    }
  }

  /**
   * Get leaderboard from cache or build if not available
   */
  async getLeaderboard(filters: LeaderboardFilters): Promise<LeaderboardSnapshot> {
    try {
      // First try Redis cache
      let cached = await getCachedLeaderboard(filters.timeframe)

      if (cached && this.isSnapshotFresh(cached)) {
        logger.info('[LeaderboardService] Returning Redis cached leaderboard')
        return this.applyFilters(cached, filters)
      }

      // Try Firestore cache
      cached = await this.getCachedSnapshot(filters.timeframe)

      if (cached && this.isSnapshotFresh(cached)) {
        logger.info('[LeaderboardService] Returning Firestore cached leaderboard')
        // Update Redis cache
        await setCachedLeaderboard(filters.timeframe, cached)
        return this.applyFilters(cached, filters)
      }

      // Build new snapshot
      logger.info('[LeaderboardService] Building fresh leaderboard')
      const snapshot = await this.buildLeaderboard(filters.timeframe, filters.limit || 100)

      // Update Redis cache
      await setCachedLeaderboard(filters.timeframe, snapshot)

      return this.applyFilters(snapshot, filters)
    } catch (error) {
      logger.error('[LeaderboardService] Error getting leaderboard:', error)
      throw error
    }
  }

  /**
   * Get specific user's leaderboard stats
   */
  async getUserStats(userId: string, timeframe: TimeFrame): Promise<UserLeaderboardStats | null> {
    try {
      const snapshot = await this.getLeaderboard({ timeframe })
      const userEntry = snapshot.entries.find(e => e.userId === userId)

      if (!userEntry) {
        // User not in top entries, calculate their position
        const userData = await this.aggregateUserData(userId)
        if (!userData) return null

        // This is simplified - in production you'd query to find exact rank
        const estimatedRank = snapshot.totalPlayers > 100 ?
          Math.floor(snapshot.totalPlayers * 0.5) : 101

        return {
          userId,
          globalRank: estimatedRank,
          percentile: Math.round((estimatedRank / snapshot.totalPlayers) * 100),
          rankChange: 0,
          timeframeRanks: {
            daily: null,
            weekly: null,
            monthly: null,
            allTime: estimatedRank
          },
          nextMilestone: {
            rank: 100,
            pointsNeeded: 1000, // Simplified
            label: 'Top 100'
          }
        }
      }

      // User is in top entries
      const percentile = Math.round((userEntry.rank / snapshot.totalPlayers) * 100)

      return {
        userId,
        globalRank: userEntry.rank,
        percentile,
        rankChange: userEntry.changeAmount || 0,
        timeframeRanks: {
          daily: timeframe === 'daily' ? userEntry.rank : null,
          weekly: timeframe === 'weekly' ? userEntry.rank : null,
          monthly: timeframe === 'monthly' ? userEntry.rank : null,
          allTime: timeframe === 'allTime' ? userEntry.rank : userEntry.rank
        },
        nextMilestone: this.getNextMilestone(userEntry.rank)
      }
    } catch (error) {
      logger.error('[LeaderboardService] Error getting user stats:', error)
      return null
    }
  }

  /**
   * Save snapshot to Firestore
   */
  private async saveSnapshot(snapshot: LeaderboardSnapshot): Promise<void> {
    try {
      await adminDb
        .collection('leaderboard_snapshots')
        .doc(`${snapshot.timeframe}-latest`)
        .set(snapshot)
    } catch (error) {
      logger.error('[LeaderboardService] Error saving snapshot:', error)
    }
  }

  /**
   * Get cached snapshot from Firestore
   */
  private async getCachedSnapshot(timeframe: TimeFrame): Promise<LeaderboardSnapshot | null> {
    try {
      const doc = await adminDb
        .collection('leaderboard_snapshots')
        .doc(`${timeframe}-latest`)
        .get()

      if (!doc.exists) return null
      return doc.data() as LeaderboardSnapshot
    } catch (error) {
      logger.error('[LeaderboardService] Error getting cached snapshot:', error)
      return null
    }
  }

  /**
   * Check if snapshot is fresh (less than 5 minutes old)
   */
  private isSnapshotFresh(snapshot: LeaderboardSnapshot): boolean {
    const fiveMinutes = 5 * 60 * 1000
    return Date.now() - snapshot.lastUpdated < fiveMinutes
  }

  /**
   * Apply filters to snapshot
   */
  private applyFilters(
    snapshot: LeaderboardSnapshot,
    filters: LeaderboardFilters
  ): LeaderboardSnapshot {
    let entries = [...snapshot.entries]

    // Apply limit
    if (filters.limit) {
      entries = entries.slice(0, filters.limit)
    }

    // Apply offset for pagination
    if (filters.offset) {
      entries = entries.slice(filters.offset)
    }

    return {
      ...snapshot,
      entries
    }
  }

  /**
   * Get next milestone for a given rank
   */
  private getNextMilestone(currentRank: number): any {
    if (currentRank <= 3) {
      return { rank: 1, pointsNeeded: 500, label: '#1 Champion' }
    } else if (currentRank <= 10) {
      return { rank: 3, pointsNeeded: 1000, label: 'Top 3' }
    } else if (currentRank <= 25) {
      return { rank: 10, pointsNeeded: 1500, label: 'Top 10' }
    } else if (currentRank <= 50) {
      return { rank: 25, pointsNeeded: 2000, label: 'Top 25' }
    } else if (currentRank <= 100) {
      return { rank: 50, pointsNeeded: 2500, label: 'Top 50' }
    } else {
      return { rank: 100, pointsNeeded: 3000, label: 'Top 100' }
    }
  }
}