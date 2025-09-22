/**
 * Queue cache for efficient review queue management
 * Uses Redis sorted sets for priority-based ordering
 */

import { ReviewRedisClient, CacheKeyBuilder } from '../review-redis-client'
import { ReviewItemDocument } from '@/lib/firebase/schema/review-collections'
import { Timestamp } from 'firebase-admin/firestore'

/**
 * Queue metadata for cache management
 */
interface QueueMetadata {
  lastUpdated: string
  totalItems: number
  dueItems: number
  newItems: number
  learningItems: number
  version: number
}

/**
 * Cache TTL constants
 */
const TTL = {
  QUEUE: 30 * 60,        // 30 minutes
  METADATA: 15 * 60,     // 15 minutes
  DUE_ITEMS: 10 * 60,    // 10 minutes
}

/**
 * Queue cache implementation
 */
export class QueueCache {
  private redis: ReviewRedisClient
  
  constructor() {
    this.redis = ReviewRedisClient.getInstance()
  }
  
  /**
   * Set the review queue for a user
   * Uses sorted set with nextReviewAt timestamp as score
   */
  async set(userId: string, items: ReviewItemDocument[]): Promise<void> {
    if (!items || items.length === 0) {
      return
    }
    
    const queueKey = CacheKeyBuilder.reviewQueue(userId)
    const metaKey = CacheKeyBuilder.reviewQueueMeta(userId)
    const dueKey = CacheKeyBuilder.dueItems(userId)
    
    try {
      // Clear existing queue
      await this.redis.del(queueKey, dueKey)
      
      // Add items to sorted set
      const now = Date.now()
      const dueItems: ReviewItemDocument[] = []
      
      for (const item of items) {
        // Use nextReviewAt timestamp as score for ordering
        const score = item.srsData.nextReviewAt.toMillis()
        const serialized = JSON.stringify(item)
        
        await this.redis.addToSortedSet(queueKey, score, serialized)
        
        // Track due items separately
        if (score <= now) {
          dueItems.push(item)
        }
      }
      
      // Cache due items for quick access
      if (dueItems.length > 0) {
        await this.redis.setJSON(dueKey, dueItems, TTL.DUE_ITEMS)
      }
      
      // Update metadata
      const metadata: QueueMetadata = {
        lastUpdated: new Date().toISOString(),
        totalItems: items.length,
        dueItems: dueItems.length,
        newItems: items.filter(i => i.status === 'new').length,
        learningItems: items.filter(i => i.status === 'learning').length,
        version: 1
      }
      
      await this.redis.setJSON(metaKey, metadata, TTL.METADATA)
      await this.redis.expire(queueKey, TTL.QUEUE)
      
      // Track for invalidation
      await this.redis.trackForInvalidation(`queue:${userId}`, queueKey)
      await this.redis.trackForInvalidation(`queue:${userId}`, metaKey)
      await this.redis.trackForInvalidation(`queue:${userId}`, dueKey)
    } catch (error) {
      console.error('Error setting queue cache:', error)
      throw error
    }
  }
  
  /**
   * Get review queue for a user
   * Returns items ordered by due date
   */
  async get(userId: string, limit?: number): Promise<ReviewItemDocument[] | null> {
    const queueKey = CacheKeyBuilder.reviewQueue(userId)
    
    try {
      // Check if queue exists
      if (!await this.redis.exists(queueKey)) {
        return null
      }
      
      // Get all items or limited number
      const args = limit ? 
        [queueKey, 0, limit - 1, 'WITHSCORES'] :
        [queueKey, 0, -1, 'WITHSCORES']
      
      const items = await this.redis.getClient().zrange(...args) as string[]
      
      if (!items || items.length === 0) {
        return null
      }
      
      // Parse items (every other element is the score)
      const reviewItems: ReviewItemDocument[] = []
      for (let i = 0; i < items.length; i += 2) {
        try {
          const item = JSON.parse(items[i])
          // Reconstruct Timestamp objects
          item.srsData.nextReviewAt = new Timestamp(
            Math.floor(parseInt(items[i + 1]) / 1000),
            (parseInt(items[i + 1]) % 1000) * 1000000
          )
          if (item.srsData.lastReviewedAt) {
            item.srsData.lastReviewedAt = new Timestamp(
              item.srsData.lastReviewedAt._seconds,
              item.srsData.lastReviewedAt._nanoseconds
            )
          }
          reviewItems.push(item)
        } catch (error) {
          console.error('Error parsing queue item:', error)
        }
      }
      
      return reviewItems
    } catch (error) {
      console.error('Error getting queue from cache:', error)
      return null
    }
  }
  
  /**
   * Get only due items (items that should be reviewed now)
   */
  async getDueItems(userId: string, limit?: number): Promise<ReviewItemDocument[] | null> {
    const dueKey = CacheKeyBuilder.dueItems(userId)
    
    try {
      // Try to get from dedicated due items cache first
      const cachedDue = await this.redis.getJSON<ReviewItemDocument[]>(dueKey)
      if (cachedDue) {
        return limit ? cachedDue.slice(0, limit) : cachedDue
      }
      
      // Fallback to getting from queue by score
      const queueKey = CacheKeyBuilder.reviewQueue(userId)
      if (!await this.redis.exists(queueKey)) {
        return null
      }
      
      const now = Date.now()
      const items = await this.redis.getRangeByScore(queueKey, 0, now, limit)
      
      if (!items || items.length === 0) {
        return []
      }
      
      // Parse items
      const reviewItems: ReviewItemDocument[] = []
      for (const itemStr of items) {
        try {
          const item = JSON.parse(itemStr)
          // Reconstruct Timestamp objects
          if (item.srsData.nextReviewAt) {
            item.srsData.nextReviewAt = new Timestamp(
              item.srsData.nextReviewAt._seconds,
              item.srsData.nextReviewAt._nanoseconds
            )
          }
          if (item.srsData.lastReviewedAt) {
            item.srsData.lastReviewedAt = new Timestamp(
              item.srsData.lastReviewedAt._seconds,
              item.srsData.lastReviewedAt._nanoseconds
            )
          }
          reviewItems.push(item)
        } catch (error) {
          console.error('Error parsing due item:', error)
        }
      }
      
      // Cache the due items for next time
      if (reviewItems.length > 0) {
        await this.redis.setJSON(dueKey, reviewItems, TTL.DUE_ITEMS)
      }
      
      return reviewItems
    } catch (error) {
      console.error('Error getting due items:', error)
      return null
    }
  }
  
  /**
   * Add a single item to the queue
   */
  async addItem(userId: string, item: ReviewItemDocument): Promise<void> {
    const queueKey = CacheKeyBuilder.reviewQueue(userId)
    const metaKey = CacheKeyBuilder.reviewQueueMeta(userId)
    
    try {
      // Add to sorted set
      const score = item.srsData.nextReviewAt.toMillis()
      await this.redis.addToSortedSet(queueKey, score, JSON.stringify(item))
      
      // Update metadata
      const metadata = await this.redis.getJSON<QueueMetadata>(metaKey)
      if (metadata) {
        metadata.totalItems++
        if (score <= Date.now()) {
          metadata.dueItems++
        }
        if (item.status === 'new') {
          metadata.newItems++
        } else if (item.status === 'learning') {
          metadata.learningItems++
        }
        metadata.lastUpdated = new Date().toISOString()
        metadata.version++
        
        await this.redis.setJSON(metaKey, metadata, TTL.METADATA)
      }
      
      // Invalidate due items cache
      await this.redis.del(CacheKeyBuilder.dueItems(userId))
    } catch (error) {
      console.error('Error adding item to queue:', error)
      throw error
    }
  }
  
  /**
   * Remove an item from the queue
   */
  async removeItem(userId: string, itemId: string): Promise<void> {
    const queueKey = CacheKeyBuilder.reviewQueue(userId)
    const metaKey = CacheKeyBuilder.reviewQueueMeta(userId)
    
    try {
      // Get all items to find the one to remove
      const items = await this.get(userId)
      if (!items) return
      
      const itemToRemove = items.find(i => i.id === itemId)
      if (!itemToRemove) return
      
      // Remove from sorted set
      await this.redis.removeFromSortedSet(queueKey, JSON.stringify(itemToRemove))
      
      // Update metadata
      const metadata = await this.redis.getJSON<QueueMetadata>(metaKey)
      if (metadata) {
        metadata.totalItems--
        if (itemToRemove.srsData.nextReviewAt.toMillis() <= Date.now()) {
          metadata.dueItems--
        }
        if (itemToRemove.status === 'new') {
          metadata.newItems--
        } else if (itemToRemove.status === 'learning') {
          metadata.learningItems--
        }
        metadata.lastUpdated = new Date().toISOString()
        metadata.version++
        
        await this.redis.setJSON(metaKey, metadata, TTL.METADATA)
      }
      
      // Invalidate due items cache
      await this.redis.del(CacheKeyBuilder.dueItems(userId))
    } catch (error) {
      console.error('Error removing item from queue:', error)
      throw error
    }
  }
  
  /**
   * Get the count of due items
   */
  async getDueCount(userId: string): Promise<number> {
    const metaKey = CacheKeyBuilder.reviewQueueMeta(userId)
    
    try {
      // Try to get from metadata first
      const metadata = await this.redis.getJSON<QueueMetadata>(metaKey)
      if (metadata) {
        return metadata.dueItems
      }
      
      // Fallback to counting from queue
      const queueKey = CacheKeyBuilder.reviewQueue(userId)
      if (!await this.redis.exists(queueKey)) {
        return 0
      }
      
      const now = Date.now()
      const count = await this.redis.getClient().zcount(queueKey, 0, now) as number
      return count
    } catch (error) {
      console.error('Error getting due count:', error)
      return 0
    }
  }
  
  /**
   * Get queue metadata
   */
  async getMetadata(userId: string): Promise<QueueMetadata | null> {
    const metaKey = CacheKeyBuilder.reviewQueueMeta(userId)
    
    try {
      return await this.redis.getJSON<QueueMetadata>(metaKey)
    } catch (error) {
      console.error('Error getting queue metadata:', error)
      return null
    }
  }
  
  /**
   * Invalidate the queue cache for a user
   */
  async invalidate(userId: string): Promise<void> {
    const queueKey = CacheKeyBuilder.reviewQueue(userId)
    const metaKey = CacheKeyBuilder.reviewQueueMeta(userId)
    const dueKey = CacheKeyBuilder.dueItems(userId)
    
    try {
      await this.redis.del(queueKey, metaKey, dueKey)
    } catch (error) {
      console.error('Error invalidating queue cache:', error)
      throw error
    }
  }
  
  /**
   * Update the order of items after review
   * Efficiently updates scores without full rebuild
   */
  async updateItemOrder(userId: string, itemId: string, newNextReviewAt: Timestamp): Promise<void> {
    const queueKey = CacheKeyBuilder.reviewQueue(userId)
    
    try {
      // Get all items to find the one to update
      const items = await this.get(userId)
      if (!items) return
      
      const itemToUpdate = items.find(i => i.id === itemId)
      if (!itemToUpdate) return
      
      // Remove old entry
      await this.redis.removeFromSortedSet(queueKey, JSON.stringify(itemToUpdate))
      
      // Update the item
      itemToUpdate.srsData.nextReviewAt = newNextReviewAt
      
      // Add back with new score
      const newScore = newNextReviewAt.toMillis()
      await this.redis.addToSortedSet(queueKey, newScore, JSON.stringify(itemToUpdate))
      
      // Invalidate due items cache
      await this.redis.del(CacheKeyBuilder.dueItems(userId))
      
      // Update metadata
      const metaKey = CacheKeyBuilder.reviewQueueMeta(userId)
      const metadata = await this.redis.getJSON<QueueMetadata>(metaKey)
      if (metadata) {
        // Recalculate due items
        const now = Date.now()
        const dueCount = await this.redis.getClient().zcount(queueKey, 0, now) as number
        metadata.dueItems = dueCount
        metadata.lastUpdated = new Date().toISOString()
        metadata.version++
        
        await this.redis.setJSON(metaKey, metadata, TTL.METADATA)
      }
    } catch (error) {
      console.error('Error updating item order:', error)
      throw error
    }
  }
}