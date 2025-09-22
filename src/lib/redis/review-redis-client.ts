/**
 * Redis client singleton for review system
 * Extends the base Redis client with review-specific functionality
 */

import { Redis } from '@upstash/redis'
import { redis } from './client'

/**
 * Cache key builder for review system
 */
export class CacheKeyBuilder {
  private static PREFIX = 'review'
  
  // Review queue keys
  static reviewQueue(userId: string): string {
    return `${this.PREFIX}:queue:${userId}`
  }
  
  static reviewQueueMeta(userId: string): string {
    return `${this.PREFIX}:queue:meta:${userId}`
  }
  
  static dueItems(userId: string): string {
    return `${this.PREFIX}:due:${userId}`
  }
  
  // User statistics keys
  static userStats(userId: string): string {
    return `${this.PREFIX}:stats:${userId}`
  }
  
  static userStreak(userId: string): string {
    return `${this.PREFIX}:streak:${userId}`
  }
  
  static userProgress(userId: string): string {
    return `${this.PREFIX}:progress:${userId}`
  }
  
  // Session progress keys
  static sessionProgress(sessionId: string): string {
    return `${this.PREFIX}:session:${sessionId}`
  }
  
  static sessionState(sessionId: string): string {
    return `${this.PREFIX}:session:state:${sessionId}`
  }
  
  // Pinned items keys
  static pinnedItems(userId: string): string {
    return `${this.PREFIX}:pinned:${userId}`
  }
  
  static pinnedCount(userId: string): string {
    return `${this.PREFIX}:pinned:count:${userId}`
  }
  
  // Content caching keys
  static content(type: string, id: string): string {
    return `${this.PREFIX}:content:${type}:${id}`
  }
  
  static contentBatch(type: string): string {
    return `${this.PREFIX}:content:batch:${type}`
  }
  
  // Review sets keys
  static reviewSet(setId: string): string {
    return `${this.PREFIX}:set:${setId}`
  }
  
  static userSets(userId: string): string {
    return `${this.PREFIX}:sets:${userId}`
  }
  
  // Rate limiting keys
  static rateLimit(userId: string, action: string): string {
    return `${this.PREFIX}:ratelimit:${action}:${userId}`
  }
  
  // Leaderboard keys
  static leaderboard(type: 'streak' | 'mastered' | 'xp' | 'accuracy', period?: string): string {
    return period ? 
      `${this.PREFIX}:leaderboard:${type}:${period}` :
      `${this.PREFIX}:leaderboard:${type}`
  }
  
  // Achievement keys
  static achievements(userId: string): string {
    return `${this.PREFIX}:achievements:${userId}`
  }
  
  // Heatmap data keys
  static heatmap(userId: string, year: number): string {
    return `${this.PREFIX}:heatmap:${userId}:${year}`
  }
  
  // Cache invalidation tracking
  static invalidationSet(pattern: string): string {
    return `${this.PREFIX}:invalidate:${pattern}`
  }
}

/**
 * Enhanced Redis client for review system
 */
export class ReviewRedisClient {
  private static instance: ReviewRedisClient
  private redis: typeof redis
  
  private constructor() {
    this.redis = redis
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): ReviewRedisClient {
    if (!ReviewRedisClient.instance) {
      ReviewRedisClient.instance = new ReviewRedisClient()
    }
    return ReviewRedisClient.instance
  }
  
  /**
   * Get the underlying Redis client
   */
  getClient(): typeof redis {
    return this.redis
  }
  
  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping()
      return true
    } catch (error) {
      console.error('Redis health check failed:', error)
      return false
    }
  }
  
  /**
   * Flush all review-related keys (dangerous - use with caution)
   */
  async flushPattern(pattern: string): Promise<void> {
    // Track keys for bulk deletion
    const trackingKey = CacheKeyBuilder.invalidationSet(pattern)
    const keys = await this.redis.smembers(trackingKey) as string[]
    
    if (keys.length > 0) {
      await this.redis.del(...keys)
      await this.redis.del(trackingKey)
    }
  }
  
  /**
   * Track a key for later invalidation
   */
  async trackForInvalidation(pattern: string, key: string): Promise<void> {
    const trackingKey = CacheKeyBuilder.invalidationSet(pattern)
    await this.redis.sadd(trackingKey, key)
    await this.redis.expire(trackingKey, 86400) // 24 hours
  }
  
  /**
   * Set with JSON serialization and TTL
   */
  async setJSON<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value)
    if (ttl) {
      await this.redis.setex(key, ttl, serialized)
    } else {
      await this.redis.set(key, serialized)
    }
  }
  
  /**
   * Get with JSON deserialization
   */
  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key)
    if (!value) return null
    
    try {
      return JSON.parse(value as string) as T
    } catch (error) {
      console.error('Failed to parse JSON from Redis:', error)
      return null
    }
  }
  
  /**
   * Multi-get with JSON deserialization
   */
  async mgetJSON<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return []
    
    const values = await this.redis.mget(...keys)
    return values.map((value: any) => {
      if (!value) return null
      try {
        return JSON.parse(value as string) as T
      } catch {
        return null
      }
    })
  }
  
  /**
   * Use sorted sets for efficient queue management
   */
  async addToSortedSet(key: string, score: number, member: string): Promise<void> {
    await this.redis.zadd(key, { score, member })
  }
  
  /**
   * Get items from sorted set by score range
   */
  async getRangeByScore(
    key: string, 
    min: number, 
    max: number, 
    limit?: number
  ): Promise<string[]> {
    const args: any[] = [key, min, max]
    if (limit) {
      args.push('LIMIT', 0, limit)
    }
    return await this.redis.zrangebyscore(...args) as string[]
  }
  
  /**
   * Remove items from sorted set
   */
  async removeFromSortedSet(key: string, ...members: string[]): Promise<number> {
    return await this.redis.zrem(key, ...members) as number
  }
  
  /**
   * Get sorted set size
   */
  async getSortedSetSize(key: string): Promise<number> {
    return await this.redis.zcard(key) as number
  }
  
  /**
   * Increment a hash field
   */
  async hincrby(key: string, field: string, increment: number): Promise<number> {
    return await this.redis.hincrby(key, field, increment) as number
  }
  
  /**
   * Get all hash fields
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    const result = await this.redis.hgetall(key)
    return result || {}
  }
  
  /**
   * Set multiple hash fields
   */
  async hmset(key: string, fields: Record<string, any>): Promise<void> {
    const flatFields: any[] = []
    for (const [field, value] of Object.entries(fields)) {
      flatFields.push(field, JSON.stringify(value))
    }
    await this.redis.hmset(key, ...flatFields)
  }
  
  /**
   * Execute a pipeline of commands
   */
  async pipeline(commands: Array<() => any>): Promise<any[]> {
    const pipe = this.redis.pipeline()
    commands.forEach(cmd => cmd.call(pipe))
    return await pipe.exec()
  }
  
  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key)
    return result === 1
  }
  
  /**
   * Set expiration on a key
   */
  async expire(key: string, ttl: number): Promise<void> {
    await this.redis.expire(key, ttl)
  }
  
  /**
   * Get remaining TTL
   */
  async ttl(key: string): Promise<number> {
    return await this.redis.ttl(key) as number
  }
  
  /**
   * Delete keys
   */
  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0
    return await this.redis.del(...keys) as number
  }
}