/**
 * Cache invalidation service
 * Handles intelligent cache invalidation with dependency tracking
 */

import { QueueCache, StatsCache, ContentCache, CacheKeyBuilder } from '../caches'
import { ReviewRedisClient } from '../review-redis-client'

/**
 * Dependency map for cache invalidation
 */
const CACHE_DEPENDENCIES: Record<string, string[]> = {
  'item': ['queue', 'stats', 'progress'],
  'session': ['stats', 'streak', 'heatmap'],
  'pin': ['queue', 'stats', 'pinned'],
  'review': ['queue', 'stats', 'streak', 'progress'],
  'set': ['sets', 'queue'],
  'content': ['queue'],
}

/**
 * Cache invalidator implementation
 */
export class CacheInvalidator {
  private redis: ReviewRedisClient
  private queueCache: QueueCache
  private statsCache: StatsCache
  private contentCache: ContentCache
  
  constructor() {
    this.redis = ReviewRedisClient.getInstance()
    this.queueCache = new QueueCache()
    this.statsCache = new StatsCache()
    this.contentCache = new ContentCache()
  }
  
  /**
   * Invalidate caches when an item is pinned
   */
  async onItemPinned(userId: string, itemId: string): Promise<void> {
    try {
      // Invalidate queue (needs to be rebuilt with new item)
      await this.queueCache.invalidate(userId)
      
      // Update stats (increment pinned count)
      await this.statsCache.increment(userId, 'totalPinned', 1)
      
      // Invalidate pinned items cache
      const pinnedKey = CacheKeyBuilder.pinnedItems(userId)
      await this.redis.del(pinnedKey)
      
      // Log invalidation
      console.log(`Cache invalidated for pin: user=${userId}, item=${itemId}`)
    } catch (error) {
      console.error('Error invalidating cache on pin:', error)
    }
  }
  
  /**
   * Invalidate caches when an item is unpinned
   */
  async onItemUnpinned(userId: string, itemId: string): Promise<void> {
    try {
      // Remove from queue
      await this.queueCache.removeItem(userId, itemId)
      
      // Update stats (decrement pinned count)
      await this.statsCache.increment(userId, 'totalPinned', -1)
      
      // Invalidate pinned items cache
      const pinnedKey = CacheKeyBuilder.pinnedItems(userId)
      await this.redis.del(pinnedKey)
      
      console.log(`Cache invalidated for unpin: user=${userId}, item=${itemId}`)
    } catch (error) {
      console.error('Error invalidating cache on unpin:', error)
    }
  }
  
  /**
   * Invalidate caches when an item is reviewed
   */
  async onItemReviewed(userId: string, itemId: string, correct: boolean): Promise<void> {
    try {
      // Update stats
      await this.statsCache.increment(userId, 'totalReviews', 1)
      await this.statsCache.increment(userId, 'reviewsToday', 1)
      
      if (correct) {
        // Update streak if needed
        const streak = await this.statsCache.getStreak(userId)
        if (streak) {
          const today = new Date().toISOString().split('T')[0]
          if (streak.lastReview !== today) {
            await this.statsCache.updateStreak(userId, streak.current + 1, today)
          }
        }
      }
      
      // Queue will be updated by the review process
      // Just invalidate due items cache
      const dueKey = CacheKeyBuilder.dueItems(userId)
      await this.redis.del(dueKey)
      
      console.log(`Cache updated for review: user=${userId}, item=${itemId}, correct=${correct}`)
    } catch (error) {
      console.error('Error invalidating cache on review:', error)
    }
  }
  
  /**
   * Invalidate caches when a session is completed
   */
  async onSessionComplete(userId: string, sessionId: string): Promise<void> {
    try {
      // Clear session caches
      const sessionKey = CacheKeyBuilder.sessionProgress(sessionId)
      const sessionStateKey = CacheKeyBuilder.sessionState(sessionId)
      await this.redis.del(sessionKey, sessionStateKey)
      
      // Update user stats
      await this.statsCache.increment(userId, 'reviewsThisWeek', 1)
      await this.statsCache.increment(userId, 'reviewsThisMonth', 1)
      
      // Invalidate heatmap cache for current year
      const year = new Date().getFullYear()
      const heatmapKey = CacheKeyBuilder.heatmap(userId, year)
      await this.redis.del(heatmapKey)
      
      console.log(`Cache invalidated for session complete: user=${userId}, session=${sessionId}`)
    } catch (error) {
      console.error('Error invalidating cache on session complete:', error)
    }
  }
  
  /**
   * Invalidate caches when settings change
   */
  async onSettingsChanged(userId: string): Promise<void> {
    try {
      // Settings changes might affect queue generation
      await this.queueCache.invalidate(userId)
      
      // Clear user sets cache
      const setsKey = CacheKeyBuilder.userSets(userId)
      await this.redis.del(setsKey)
      
      console.log(`Cache invalidated for settings change: user=${userId}`)
    } catch (error) {
      console.error('Error invalidating cache on settings change:', error)
    }
  }
  
  /**
   * Invalidate all caches for a user
   */
  async invalidateUser(userId: string): Promise<void> {
    try {
      const keysToDelete = [
        CacheKeyBuilder.reviewQueue(userId),
        CacheKeyBuilder.reviewQueueMeta(userId),
        CacheKeyBuilder.dueItems(userId),
        CacheKeyBuilder.userStats(userId),
        CacheKeyBuilder.userStreak(userId),
        CacheKeyBuilder.userProgress(userId),
        CacheKeyBuilder.pinnedItems(userId),
        CacheKeyBuilder.pinnedCount(userId),
        CacheKeyBuilder.userSets(userId),
        CacheKeyBuilder.heatmap(userId, new Date().getFullYear()),
        CacheKeyBuilder.achievements(userId),
      ]
      
      await this.redis.del(...keysToDelete)
      
      console.log(`All caches invalidated for user: ${userId}`)
    } catch (error) {
      console.error('Error invalidating user caches:', error)
    }
  }
  
  /**
   * Invalidate caches by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      await this.redis.flushPattern(pattern)
      console.log(`Caches invalidated for pattern: ${pattern}`)
    } catch (error) {
      console.error('Error invalidating pattern:', error)
    }
  }
  
  /**
   * Get dependent cache keys
   */
  private getDependentKeys(key: string): string[] {
    for (const [prefix, deps] of Object.entries(CACHE_DEPENDENCIES)) {
      if (key.includes(prefix)) {
        return deps
      }
    }
    return []
  }
  
  /**
   * Invalidate with dependencies
   */
  async invalidateWithDependencies(userId: string, cacheType: string): Promise<void> {
    try {
      const dependencies = CACHE_DEPENDENCIES[cacheType] || []
      const keysToDelete: string[] = []
      
      // Build list of keys to delete based on dependencies
      for (const dep of dependencies) {
        switch (dep) {
          case 'queue':
            keysToDelete.push(
              CacheKeyBuilder.reviewQueue(userId),
              CacheKeyBuilder.reviewQueueMeta(userId),
              CacheKeyBuilder.dueItems(userId)
            )
            break
          case 'stats':
            keysToDelete.push(CacheKeyBuilder.userStats(userId))
            break
          case 'streak':
            keysToDelete.push(CacheKeyBuilder.userStreak(userId))
            break
          case 'progress':
            keysToDelete.push(CacheKeyBuilder.userProgress(userId))
            break
          case 'pinned':
            keysToDelete.push(
              CacheKeyBuilder.pinnedItems(userId),
              CacheKeyBuilder.pinnedCount(userId)
            )
            break
          case 'sets':
            keysToDelete.push(CacheKeyBuilder.userSets(userId))
            break
          case 'heatmap':
            keysToDelete.push(CacheKeyBuilder.heatmap(userId, new Date().getFullYear()))
            break
        }
      }
      
      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete)
        console.log(`Invalidated ${keysToDelete.length} dependent caches for ${cacheType}`)
      }
    } catch (error) {
      console.error('Error invalidating with dependencies:', error)
    }
  }
  
  /**
   * Batch invalidation for multiple users
   */
  async batchInvalidate(userIds: string[], cacheTypes: string[]): Promise<void> {
    try {
      const keysToDelete: string[] = []
      
      for (const userId of userIds) {
        for (const cacheType of cacheTypes) {
          switch (cacheType) {
            case 'queue':
              keysToDelete.push(
                CacheKeyBuilder.reviewQueue(userId),
                CacheKeyBuilder.reviewQueueMeta(userId),
                CacheKeyBuilder.dueItems(userId)
              )
              break
            case 'stats':
              keysToDelete.push(CacheKeyBuilder.userStats(userId))
              break
            case 'streak':
              keysToDelete.push(CacheKeyBuilder.userStreak(userId))
              break
            case 'progress':
              keysToDelete.push(CacheKeyBuilder.userProgress(userId))
              break
          }
        }
      }
      
      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete)
        console.log(`Batch invalidated ${keysToDelete.length} caches`)
      }
    } catch (error) {
      console.error('Error in batch invalidation:', error)
    }
  }
}