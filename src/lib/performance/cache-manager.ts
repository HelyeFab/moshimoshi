/**
 * Performance-Optimized Cache Manager
 * Week 2 - Redis Caching Layer Implementation
 * 
 * Implements multi-tier caching with:
 * - L1: In-memory LRU cache (fastest, limited size)
 * - L2: Redis cache (fast, distributed)
 * - L3: Database (source of truth)
 */

import { redis, RedisKeys, CacheTTL } from '@/lib/redis/client'
import LRUCache from 'lru-cache'

/**
 * Cache configuration based on performance budget
 */
export const CACHE_CONFIG = {
  // Session data - frequently accessed, small size
  SESSION: {
    ttl: 5 * 60, // 5 minutes
    maxMemoryItems: 100,
    warmup: true,
  },
  
  // Queue generation - moderate access, medium size
  QUEUE: {
    ttl: 60, // 1 minute
    maxMemoryItems: 50,
    warmup: false,
  },
  
  // User progress - moderate access, medium size
  USER_PROGRESS: {
    ttl: 10 * 60, // 10 minutes
    maxMemoryItems: 200,
    warmup: true,
  },
  
  // Lesson data - infrequent changes, large size
  LESSON_DATA: {
    ttl: 60 * 60, // 1 hour
    maxMemoryItems: 500,
    warmup: true,
  },
  
  // Statistics - expensive to calculate
  STATS: {
    ttl: 5 * 60, // 5 minutes
    maxMemoryItems: 20,
    warmup: false,
  },
  
  // TTS audio URLs - static content
  TTS_AUDIO: {
    ttl: 24 * 60 * 60, // 24 hours
    maxMemoryItems: 1000,
    warmup: false,
  },
}

/**
 * Multi-tier cache manager
 */
export class CacheManager {
  private static instance: CacheManager
  private memoryCache: Map<string, any>
  private stats: CacheStatistics
  
  private constructor() {
    this.memoryCache = new Map()
    this.stats = {
      hits: { memory: 0, redis: 0 },
      misses: 0,
      sets: 0,
      evictions: 0,
      errors: 0,
    }
    
    // Initialize memory caches for each category
    Object.entries(CACHE_CONFIG).forEach(([category, config]) => {
      this.memoryCache.set(
        category,
        new LRUCache({
          max: config.maxMemoryItems,
          ttl: config.ttl * 1000, // Convert to milliseconds
          updateAgeOnGet: true,
          updateAgeOnHas: false,
        })
      )
    })
  }
  
  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }
  
  /**
   * Get value from cache (L1 -> L2 -> L3)
   */
  async get<T>(
    category: keyof typeof CACHE_CONFIG,
    key: string,
    fetcher?: () => Promise<T>
  ): Promise<T | null> {
    const fullKey = this.buildKey(category, key)
    
    // L1: Check memory cache
    const memCache = this.memoryCache.get(category)
    if (memCache) {
      const memValue = memCache.get(fullKey)
      if (memValue !== undefined) {
        this.stats.hits.memory++
        return memValue as T
      }
    }
    
    // L2: Check Redis cache
    try {
      const redisValue = await redis.get(fullKey)
      if (redisValue) {
        this.stats.hits.redis++
        const parsed = JSON.parse(redisValue as string)
        
        // Populate L1 cache
        if (memCache) {
          memCache.set(fullKey, parsed)
        }
        
        return parsed as T
      }
    } catch (error) {
      console.error('Redis get error:', error)
      this.stats.errors++
    }
    
    // L3: Fetch from source if fetcher provided
    if (fetcher) {
      this.stats.misses++
      
      try {
        const value = await fetcher()
        
        if (value !== null && value !== undefined) {
          // Populate both caches
          await this.set(category, key, value)
        }
        
        return value
      } catch (error) {
        console.error('Fetcher error:', error)
        this.stats.errors++
        return null
      }
    }
    
    this.stats.misses++
    return null
  }
  
  /**
   * Set value in cache (L1 + L2)
   */
  async set<T>(
    category: keyof typeof CACHE_CONFIG,
    key: string,
    value: T,
    customTTL?: number
  ): Promise<void> {
    const fullKey = this.buildKey(category, key)
    const config = CACHE_CONFIG[category]
    const ttl = customTTL || config.ttl
    
    this.stats.sets++
    
    // L1: Set in memory cache
    const memCache = this.memoryCache.get(category)
    if (memCache) {
      memCache.set(fullKey, value)
    }
    
    // L2: Set in Redis cache
    try {
      await redis.setex(fullKey, ttl, JSON.stringify(value))
    } catch (error) {
      console.error('Redis set error:', error)
      this.stats.errors++
    }
  }
  
  /**
   * Delete value from cache
   */
  async delete(category: keyof typeof CACHE_CONFIG, key: string): Promise<void> {
    const fullKey = this.buildKey(category, key)
    
    // L1: Delete from memory cache
    const memCache = this.memoryCache.get(category)
    if (memCache) {
      memCache.delete(fullKey)
    }
    
    // L2: Delete from Redis
    try {
      await redis.del(fullKey)
    } catch (error) {
      console.error('Redis delete error:', error)
      this.stats.errors++
    }
  }
  
  /**
   * Invalidate entire category
   */
  async invalidateCategory(category: keyof typeof CACHE_CONFIG): Promise<void> {
    // L1: Clear memory cache
    const memCache = this.memoryCache.get(category)
    if (memCache) {
      memCache.clear()
    }
    
    // L2: Clear Redis keys for category
    try {
      const pattern = `${category.toLowerCase()}:*`
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch (error) {
      console.error('Redis invalidate error:', error)
      this.stats.errors++
    }
  }
  
  /**
   * Batch get with optimized Redis operations
   */
  async batchGet<T>(
    category: keyof typeof CACHE_CONFIG,
    keys: string[]
  ): Promise<Map<string, T>> {
    const results = new Map<string, T>()
    const memCache = this.memoryCache.get(category)
    const missingKeys: string[] = []
    
    // L1: Check memory cache first
    for (const key of keys) {
      const fullKey = this.buildKey(category, key)
      if (memCache) {
        const value = memCache.get(fullKey)
        if (value !== undefined) {
          results.set(key, value as T)
          this.stats.hits.memory++
        } else {
          missingKeys.push(key)
        }
      } else {
        missingKeys.push(key)
      }
    }
    
    // L2: Batch fetch from Redis
    if (missingKeys.length > 0) {
      try {
        const fullKeys = missingKeys.map(k => this.buildKey(category, k))
        const values = await redis.mget(...fullKeys)
        
        values.forEach((value: any, index: number) => {
          if (value) {
            const parsed = JSON.parse(value as string)
            results.set(missingKeys[index], parsed)
            this.stats.hits.redis++
            
            // Populate L1 cache
            if (memCache) {
              memCache.set(fullKeys[index], parsed)
            }
          } else {
            this.stats.misses++
          }
        })
      } catch (error) {
        console.error('Redis batch get error:', error)
        this.stats.errors++
      }
    }
    
    return results
  }
  
  /**
   * Batch set with pipelining
   */
  async batchSet<T>(
    category: keyof typeof CACHE_CONFIG,
    items: Array<{ key: string; value: T }>,
    customTTL?: number
  ): Promise<void> {
    const config = CACHE_CONFIG[category]
    const ttl = customTTL || config.ttl
    const memCache = this.memoryCache.get(category)
    
    // L1: Set in memory cache
    for (const item of items) {
      const fullKey = this.buildKey(category, item.key)
      if (memCache) {
        memCache.set(fullKey, item.value)
      }
      this.stats.sets++
    }
    
    // L2: Batch set in Redis using pipeline
    try {
      const pipeline = redis.pipeline()
      
      for (const item of items) {
        const fullKey = this.buildKey(category, item.key)
        pipeline.setex(fullKey, ttl, JSON.stringify(item.value))
      }
      
      await pipeline.exec()
    } catch (error) {
      console.error('Redis batch set error:', error)
      this.stats.errors++
    }
  }
  
  /**
   * Warm up cache with frequently accessed data
   */
  async warmup(category: keyof typeof CACHE_CONFIG, items: any[]): Promise<void> {
    const config = CACHE_CONFIG[category]
    
    if (!config.warmup) {
      return
    }
    
    console.log(`Warming up ${category} cache with ${items.length} items...`)
    
    // Batch set all items
    const cacheItems = items.map(item => ({
      key: item.id || item.key,
      value: item,
    }))
    
    await this.batchSet(category, cacheItems)
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStatistics & { hitRate: number } {
    const totalHits = this.stats.hits.memory + this.stats.hits.redis
    const totalRequests = totalHits + this.stats.misses
    const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0
    
    return {
      ...this.stats,
      hitRate,
    }
  }
  
  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: { memory: 0, redis: 0 },
      misses: 0,
      sets: 0,
      evictions: 0,
      errors: 0,
    }
  }
  
  /**
   * Build cache key
   */
  private buildKey(category: keyof typeof CACHE_CONFIG, key: string): string {
    return `${category.toLowerCase()}:${key}`
  }
}

/**
 * Cache statistics interface
 */
interface CacheStatistics {
  hits: {
    memory: number
    redis: number
  }
  misses: number
  sets: number
  evictions: number
  errors: number
}

/**
 * Cache decorator for methods
 */
export function cached(
  category: keyof typeof CACHE_CONFIG,
  keyBuilder?: (...args: any[]) => string
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    
    descriptor.value = async function (...args: any[]) {
      const cache = CacheManager.getInstance()
      const key = keyBuilder ? keyBuilder(...args) : JSON.stringify(args)
      
      // Try to get from cache
      const cached = await cache.get(category, key)
      if (cached !== null) {
        return cached
      }
      
      // Execute method and cache result
      const result = await originalMethod.apply(this, args)
      
      if (result !== null && result !== undefined) {
        await cache.set(category, key, result)
      }
      
      return result
    }
    
    return descriptor
  }
}

/**
 * Invalidate cache decorator
 */
export function invalidatesCache(
  category: keyof typeof CACHE_CONFIG,
  keyBuilder?: (...args: any[]) => string
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    
    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args)
      
      // Invalidate cache after successful execution
      const cache = CacheManager.getInstance()
      
      if (keyBuilder) {
        const key = keyBuilder(...args)
        await cache.delete(category, key)
      } else {
        // Invalidate entire category if no key builder provided
        await cache.invalidateCategory(category)
      }
      
      return result
    }
    
    return descriptor
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance()