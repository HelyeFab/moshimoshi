/**
 * Content cache for frequently accessed content
 * Caches content items to reduce database reads
 */

import { ReviewRedisClient, CacheKeyBuilder } from '../review-redis-client'

/**
 * Cache TTL constants
 */
const TTL = {
  CONTENT: 2 * 60 * 60,   // 2 hours
  BATCH: 60 * 60,         // 1 hour
}

/**
 * Content cache implementation
 */
export class ContentCache {
  private redis: ReviewRedisClient
  
  constructor() {
    this.redis = ReviewRedisClient.getInstance()
  }
  
  /**
   * Set a single content item
   */
  async set(type: string, id: string, content: any, ttl: number = TTL.CONTENT): Promise<void> {
    const key = CacheKeyBuilder.content(type, id)
    
    try {
      await this.redis.setJSON(key, content, ttl)
      await this.redis.trackForInvalidation(`content:${type}`, key)
    } catch (error) {
      console.error('Error setting content cache:', error)
      throw error
    }
  }
  
  /**
   * Get a single content item
   */
  async get(type: string, id: string): Promise<any | null> {
    const key = CacheKeyBuilder.content(type, id)
    
    try {
      return await this.redis.getJSON(key)
    } catch (error) {
      console.error('Error getting content from cache:', error)
      return null
    }
  }
  
  /**
   * Get multiple content items
   */
  async mget(items: Array<{ type: string; id: string }>): Promise<any[]> {
    if (items.length === 0) return []
    
    try {
      const keys = items.map(item => CacheKeyBuilder.content(item.type, item.id))
      return await this.redis.mgetJSON(keys)
    } catch (error) {
      console.error('Error getting multiple content items:', error)
      return items.map(() => null)
    }
  }
  
  /**
   * Set multiple content items in batch
   */
  async setBatch(type: string, items: Array<{ id: string; content: any }>, ttl: number = TTL.BATCH): Promise<void> {
    if (items.length === 0) return
    
    try {
      const pipeline = this.redis.getClient().pipeline()
      
      for (const item of items) {
        const key = CacheKeyBuilder.content(type, item.id)
        pipeline.setex(key, ttl, JSON.stringify(item.content))
      }
      
      await pipeline.exec()
      
      // Track for invalidation
      for (const item of items) {
        const key = CacheKeyBuilder.content(type, item.id)
        await this.redis.trackForInvalidation(`content:${type}`, key)
      }
    } catch (error) {
      console.error('Error setting batch content:', error)
      throw error
    }
  }
  
  /**
   * Invalidate content cache
   */
  async invalidate(type: string, id: string): Promise<void> {
    const key = CacheKeyBuilder.content(type, id)
    
    try {
      await this.redis.del(key)
    } catch (error) {
      console.error('Error invalidating content:', error)
      throw error
    }
  }
  
  /**
   * Invalidate all content of a type
   */
  async invalidateType(type: string): Promise<void> {
    try {
      await this.redis.flushPattern(`content:${type}`)
    } catch (error) {
      console.error('Error invalidating content type:', error)
      throw error
    }
  }
  
  /**
   * Warm up cache with content
   */
  async warmup(items: Array<{ type: string; id: string; content: any }>): Promise<void> {
    if (items.length === 0) return
    
    try {
      const pipeline = this.redis.getClient().pipeline()
      
      for (const item of items) {
        const key = CacheKeyBuilder.content(item.type, item.id)
        pipeline.setex(key, TTL.CONTENT, JSON.stringify(item.content))
      }
      
      await pipeline.exec()
    } catch (error) {
      console.error('Error warming content cache:', error)
      throw error
    }
  }
  
  /**
   * Check if content exists in cache
   */
  async exists(type: string, id: string): Promise<boolean> {
    const key = CacheKeyBuilder.content(type, id)
    
    try {
      return await this.redis.exists(key)
    } catch (error) {
      console.error('Error checking content existence:', error)
      return false
    }
  }
  
  /**
   * Get remaining TTL for content
   */
  async getTTL(type: string, id: string): Promise<number> {
    const key = CacheKeyBuilder.content(type, id)
    
    try {
      return await this.redis.ttl(key)
    } catch (error) {
      console.error('Error getting content TTL:', error)
      return -1
    }
  }
}