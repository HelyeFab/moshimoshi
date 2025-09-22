/**
 * Statistics cache for user review metrics
 * Uses Redis hashes for efficient field updates
 */

import { ReviewRedisClient, CacheKeyBuilder } from '../review-redis-client'
import { ContentType } from '@/lib/firebase/schema/review-collections'

/**
 * Cached statistics structure
 */
export interface CachedStatistics {
  // Item counts
  totalPinned: number
  newItems: number
  learningItems: number
  masteredItems: number
  dueToday: number
  
  // Performance metrics
  streak: number
  bestStreak: number
  lastReview: string | null
  accuracy7d: number
  accuracy30d: number
  accuracyAllTime: number
  
  // Activity metrics
  reviewsToday: number
  reviewsThisWeek: number
  reviewsThisMonth: number
  totalReviews: number
  
  // Time metrics
  averageResponseTime: number
  totalTimeSpent: number  // seconds
  
  // Progress metrics
  itemsLearnedToday: number
  itemsMasteredToday: number
  itemsLearnedThisWeek: number
  itemsMasteredThisWeek: number
  
  // By content type (JSON stringified)
  statsByType?: string
}

/**
 * Statistics by content type
 */
export interface StatsByType {
  [key: string]: {
    total: number
    new: number
    learning: number
    mastered: number
    accuracy: number
  }
}

/**
 * Cache TTL constants
 */
const TTL = {
  STATS: 60 * 60,         // 1 hour
  STREAK: 30 * 60,        // 30 minutes
  PROGRESS: 15 * 60,      // 15 minutes
}

/**
 * Statistics cache implementation
 */
export class StatsCache {
  private redis: ReviewRedisClient
  
  constructor() {
    this.redis = ReviewRedisClient.getInstance()
  }
  
  /**
   * Set all statistics at once
   */
  async set(userId: string, stats: CachedStatistics): Promise<void> {
    const statsKey = CacheKeyBuilder.userStats(userId)
    
    try {
      // Convert stats to hash fields
      const hashFields: Record<string, string> = {}
      
      for (const [key, value] of Object.entries(stats)) {
        if (value !== null && value !== undefined) {
          if (typeof value === 'object') {
            hashFields[key] = JSON.stringify(value)
          } else {
            hashFields[key] = String(value)
          }
        }
      }
      
      // Set all fields at once
      await this.redis.hmset(statsKey, hashFields)
      await this.redis.expire(statsKey, TTL.STATS)
      
      // Track for invalidation
      await this.redis.trackForInvalidation(`stats:${userId}`, statsKey)
      
      // Also cache streak separately for quick access
      if (stats.streak !== undefined) {
        const streakKey = CacheKeyBuilder.userStreak(userId)
        await this.redis.setJSON(
          streakKey,
          { 
            current: stats.streak, 
            best: stats.bestStreak,
            lastReview: stats.lastReview 
          },
          TTL.STREAK
        )
      }
    } catch (error) {
      console.error('Error setting stats cache:', error)
      throw error
    }
  }
  
  /**
   * Get all statistics
   */
  async get(userId: string): Promise<CachedStatistics | null> {
    const statsKey = CacheKeyBuilder.userStats(userId)
    
    try {
      const hashData = await this.redis.hgetall(statsKey)
      
      if (!hashData || Object.keys(hashData).length === 0) {
        return null
      }
      
      // Convert hash fields back to stats object
      const stats: Partial<CachedStatistics> = {}
      
      for (const [key, value] of Object.entries(hashData)) {
        if (key === 'statsByType' || key === 'lastReview') {
          stats[key as keyof CachedStatistics] = value as any
        } else if (value === 'null') {
          stats[key as keyof CachedStatistics] = null as any
        } else {
          const numValue = Number(value)
          stats[key as keyof CachedStatistics] = isNaN(numValue) ? value as any : numValue
        }
      }
      
      return stats as CachedStatistics
    } catch (error) {
      console.error('Error getting stats from cache:', error)
      return null
    }
  }
  
  /**
   * Increment a specific field
   */
  async increment(userId: string, field: keyof CachedStatistics, value: number = 1): Promise<void> {
    const statsKey = CacheKeyBuilder.userStats(userId)
    
    try {
      await this.redis.hincrby(statsKey, field, value)
      
      // Ensure TTL is set
      const ttl = await this.redis.ttl(statsKey)
      if (ttl === -1) {
        await this.redis.expire(statsKey, TTL.STATS)
      }
    } catch (error) {
      console.error('Error incrementing stat:', error)
      throw error
    }
  }
  
  /**
   * Update streak information
   */
  async updateStreak(userId: string, streak: number, lastReview?: string): Promise<void> {
    const statsKey = CacheKeyBuilder.userStats(userId)
    const streakKey = CacheKeyBuilder.userStreak(userId)
    
    try {
      // Update in main stats
      const updates: Record<string, string> = {
        streak: String(streak)
      }
      
      if (lastReview) {
        updates.lastReview = lastReview
      }
      
      // Check if this is a new best streak
      const currentStats = await this.get(userId)
      if (currentStats && streak > currentStats.bestStreak) {
        updates.bestStreak = String(streak)
      }
      
      await this.redis.hmset(statsKey, updates)
      
      // Update separate streak cache
      await this.redis.setJSON(
        streakKey,
        {
          current: streak,
          best: currentStats?.bestStreak || streak,
          lastReview: lastReview || currentStats?.lastReview || null
        },
        TTL.STREAK
      )
    } catch (error) {
      console.error('Error updating streak:', error)
      throw error
    }
  }
  
  /**
   * Update accuracy metrics
   */
  async updateAccuracy(
    userId: string,
    accuracy7d?: number,
    accuracy30d?: number,
    accuracyAllTime?: number
  ): Promise<void> {
    const statsKey = CacheKeyBuilder.userStats(userId)
    
    try {
      const updates: Record<string, string> = {}
      
      if (accuracy7d !== undefined) {
        updates.accuracy7d = String(accuracy7d)
      }
      if (accuracy30d !== undefined) {
        updates.accuracy30d = String(accuracy30d)
      }
      if (accuracyAllTime !== undefined) {
        updates.accuracyAllTime = String(accuracyAllTime)
      }
      
      if (Object.keys(updates).length > 0) {
        await this.redis.hmset(statsKey, updates)
      }
    } catch (error) {
      console.error('Error updating accuracy:', error)
      throw error
    }
  }
  
  /**
   * Update progress metrics
   */
  async updateProgress(userId: string, progress: {
    newItems?: number
    learningItems?: number
    masteredItems?: number
    dueToday?: number
  }): Promise<void> {
    const statsKey = CacheKeyBuilder.userStats(userId)
    const progressKey = CacheKeyBuilder.userProgress(userId)
    
    try {
      const updates: Record<string, string> = {}
      
      if (progress.newItems !== undefined) {
        updates.newItems = String(progress.newItems)
      }
      if (progress.learningItems !== undefined) {
        updates.learningItems = String(progress.learningItems)
      }
      if (progress.masteredItems !== undefined) {
        updates.masteredItems = String(progress.masteredItems)
      }
      if (progress.dueToday !== undefined) {
        updates.dueToday = String(progress.dueToday)
      }
      
      if (Object.keys(updates).length > 0) {
        await this.redis.hmset(statsKey, updates)
        
        // Also cache progress separately
        await this.redis.setJSON(progressKey, progress, TTL.PROGRESS)
      }
    } catch (error) {
      console.error('Error updating progress:', error)
      throw error
    }
  }
  
  /**
   * Update statistics by content type
   */
  async updateStatsByType(userId: string, statsByType: StatsByType): Promise<void> {
    const statsKey = CacheKeyBuilder.userStats(userId)
    
    try {
      await this.redis.hmset(statsKey, {
        statsByType: JSON.stringify(statsByType)
      })
    } catch (error) {
      console.error('Error updating stats by type:', error)
      throw error
    }
  }
  
  /**
   * Get just the streak information
   */
  async getStreak(userId: string): Promise<{ current: number; best: number; lastReview: string | null } | null> {
    const streakKey = CacheKeyBuilder.userStreak(userId)
    
    try {
      // Try dedicated streak cache first
      const cached = await this.redis.getJSON<{ current: number; best: number; lastReview: string | null }>(streakKey)
      if (cached) {
        return cached
      }
      
      // Fallback to main stats
      const stats = await this.get(userId)
      if (stats) {
        return {
          current: stats.streak,
          best: stats.bestStreak,
          lastReview: stats.lastReview
        }
      }
      
      return null
    } catch (error) {
      console.error('Error getting streak:', error)
      return null
    }
  }
  
  /**
   * Get just the progress information
   */
  async getProgress(userId: string): Promise<{
    newItems: number
    learningItems: number
    masteredItems: number
    dueToday: number
  } | null> {
    const progressKey = CacheKeyBuilder.userProgress(userId)
    
    try {
      // Try dedicated progress cache first
      const cached = await this.redis.getJSON<any>(progressKey)
      if (cached) {
        return cached
      }
      
      // Fallback to main stats
      const stats = await this.get(userId)
      if (stats) {
        return {
          newItems: stats.newItems,
          learningItems: stats.learningItems,
          masteredItems: stats.masteredItems,
          dueToday: stats.dueToday
        }
      }
      
      return null
    } catch (error) {
      console.error('Error getting progress:', error)
      return null
    }
  }
  
  /**
   * Invalidate all statistics for a user
   */
  async invalidate(userId: string): Promise<void> {
    const statsKey = CacheKeyBuilder.userStats(userId)
    const streakKey = CacheKeyBuilder.userStreak(userId)
    const progressKey = CacheKeyBuilder.userProgress(userId)
    
    try {
      await this.redis.del(statsKey, streakKey, progressKey)
    } catch (error) {
      console.error('Error invalidating stats cache:', error)
      throw error
    }
  }
  
  /**
   * Batch update multiple statistics
   */
  async batchUpdate(userId: string, updates: Partial<CachedStatistics>): Promise<void> {
    const statsKey = CacheKeyBuilder.userStats(userId)
    
    try {
      const hashFields: Record<string, string> = {}
      
      for (const [key, value] of Object.entries(updates)) {
        if (value !== null && value !== undefined) {
          if (typeof value === 'object') {
            hashFields[key] = JSON.stringify(value)
          } else {
            hashFields[key] = String(value)
          }
        }
      }
      
      if (Object.keys(hashFields).length > 0) {
        await this.redis.hmset(statsKey, hashFields)
        
        // Ensure TTL is set
        const ttl = await this.redis.ttl(statsKey)
        if (ttl === -1) {
          await this.redis.expire(statsKey, TTL.STATS)
        }
      }
    } catch (error) {
      console.error('Error batch updating stats:', error)
      throw error
    }
  }
}