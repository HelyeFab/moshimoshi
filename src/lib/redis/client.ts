// Redis client configuration for Upstash Redis
// Handles caching, session storage, and rate limiting

import { Redis } from '@upstash/redis'

// Environment variables - trim any whitespace
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL?.trim()
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()

if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  console.warn('⚠️  Redis not configured. Some features may not work properly.')
  console.warn('Please add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to your .env.local')
}

// Create Redis instance or mock for development
export const redis = (!UPSTASH_REDIS_REST_URL || UPSTASH_REDIS_REST_URL.includes('mock')) ? 
  // Mock Redis implementation for development
  {
    get: async (key: string) => {
      console.log('[Mock Redis] GET:', key)
      return null
    },
    set: async (key: string, value: any, options?: any) => {
      console.log('[Mock Redis] SET:', key)
      return 'OK'
    },
    setex: async (key: string, ttl: number, value: any) => {
      console.log('[Mock Redis] SETEX:', key, ttl)
      return 'OK'
    },
    del: async (...keys: string[]) => {
      console.log('[Mock Redis] DEL:', keys)
      return keys.length
    },
    exists: async (...keys: string[]) => {
      console.log('[Mock Redis] EXISTS:', keys)
      return 0
    },
    expire: async (key: string, ttl: number) => {
      console.log('[Mock Redis] EXPIRE:', key, ttl)
      return 1
    },
    ttl: async (key: string) => {
      console.log('[Mock Redis] TTL:', key)
      return -1
    },
    incr: async (key: string) => {
      console.log('[Mock Redis] INCR:', key)
      return 1
    },
    mget: async (...keys: string[]) => {
      console.log('[Mock Redis] MGET:', keys)
      return keys.map(() => null)
    },
    mset: async (data: any) => {
      console.log('[Mock Redis] MSET:', data)
      return 'OK'
    },
    pipeline: () => ({
      exec: async () => {
        console.log('[Mock Redis] PIPELINE EXEC')
        return []
      }
    })
  } as any :
  new Redis({
    url: UPSTASH_REDIS_REST_URL,
    token: UPSTASH_REDIS_REST_TOKEN,
    automaticDeserialization: false, // Keep as strings for consistent JSON handling
  })

// Redis key prefixes for different data types
export const RedisKeys = {
  // Session management
  session: (sessionId: string) => `session:${sessionId}`,
  userSessions: (userId: string) => `user_sessions:${userId}`,
  blacklist: (sessionId: string) => `blacklist:${sessionId}`,
  
  // User data caching
  userProfile: (userId: string) => `profile:${userId}`,
  userTier: (userId: string) => `tier:${userId}`,
  userEntitlements: (userId: string) => `entitlements:${userId}`,
  
  // Authentication
  magicLink: (token: string) => `magic:${token}`,
  passwordReset: (token: string) => `reset:${token}`,
  emailVerification: (token: string) => `verify:${token}`,
  
  // Rate limiting
  rateLimit: (identifier: string, endpoint: string) => `ratelimit:${endpoint}:${identifier}`,
  authAttempts: (identifier: string) => `auth_attempts:${identifier}`,
  
  // Application data
  lessonProgress: (userId: string, lessonId: string) => `progress:${userId}:${lessonId}`,
  userStats: (userId: string) => `stats:${userId}`,
  
  // Admin operations
  adminAudit: (action: string, timestamp: string) => `audit:${action}:${timestamp}`,
}

// Cache TTL constants (in seconds)
export const CacheTTL = {
  // Session data
  SESSION_VALIDATION: 5 * 60,        // 5 minutes
  SESSION_TOKEN: 60 * 60,            // 1 hour
  
  // User data
  USER_PROFILE: 15 * 60,             // 15 minutes
  USER_TIER: 5 * 60,                 // 5 minutes
  USER_ENTITLEMENTS: 10 * 60,        // 10 minutes
  
  // Authentication
  MAGIC_LINK: 15 * 60,               // 15 minutes
  PASSWORD_RESET: 60 * 60,           // 1 hour
  EMAIL_VERIFICATION: 24 * 60 * 60,  // 24 hours
  
  // Rate limiting
  RATE_LIMIT_WINDOW: 60,             // 1 minute
  AUTH_ATTEMPTS: 15 * 60,            // 15 minutes
  
  // Application data
  LESSON_PROGRESS: 30 * 60,          // 30 minutes
  USER_STATS: 60 * 60,               // 1 hour
  
  // Short-lived caches
  TEMPORARY: 5 * 60,                 // 5 minutes
  LONG_TERM: 24 * 60 * 60,          // 24 hours
}

// Utility functions for Redis operations
export const RedisUtils = {
  /**
   * Set with automatic expiration
   */
  async setWithTTL(key: string, value: any, ttl: number): Promise<void> {
    await redis.setex(key, ttl, JSON.stringify(value))
  },

  /**
   * Get and parse JSON
   */
  async getJSON<T>(key: string): Promise<T | null> {
    const value = await redis.get(key)
    return value ? JSON.parse(value as string) : null
  },

  /**
   * Increment with expiration
   */
  async incrementWithTTL(key: string, ttl: number): Promise<number> {
    const pipeline = redis.pipeline()
    pipeline.incr(key)
    pipeline.expire(key, ttl)
    const results = await pipeline.exec()
    return results[0] as number
  },

  /**
   * Set expiration if key doesn't have one
   */
  async ensureExpiration(key: string, ttl: number): Promise<void> {
    const currentTTL = await redis.ttl(key)
    if (currentTTL === -1) { // Key exists but no expiration
      await redis.expire(key, ttl)
    }
  },

  /**
   * Multi-get with fallback
   */
  async mgetWithDefault<T>(keys: string[], defaultValue: T): Promise<(T | any)[]> {
    const values = await redis.mget(...keys)
    return values.map((value: any) => value !== null ? value : defaultValue)
  },

  /**
   * Cache with function fallback
   */
  async cacheWithFallback<T>(
    key: string,
    fallbackFn: () => Promise<T>,
    ttl: number = CacheTTL.TEMPORARY
  ): Promise<T> {
    // Try to get from cache first
    const cached = await RedisUtils.getJSON<T>(key)
    if (cached !== null) {
      return cached
    }

    // Execute fallback function
    const result = await fallbackFn()
    
    // Cache the result
    await RedisUtils.setWithTTL(key, result, ttl)
    
    return result
  },

  /**
   * Invalidate cache pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    // Note: Upstash Redis doesn't support KEYS command for security reasons
    // In production, you'd maintain a set of keys to invalidate
    console.log(`Would invalidate pattern: ${pattern}`)
  },

  /**
   * Batch set operations
   */
  async setBatch(operations: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    const pipeline = redis.pipeline()
    
    for (const op of operations) {
      if (op.ttl) {
        pipeline.setex(op.key, op.ttl, JSON.stringify(op.value))
      } else {
        pipeline.set(op.key, JSON.stringify(op.value))
      }
    }
    
    await pipeline.exec()
  },

  /**
   * Batch delete operations
   */
  async deleteBatch(keys: string[]): Promise<void> {
    if (keys.length === 0) return
    
    const pipeline = redis.pipeline()
    keys.forEach(key => pipeline.del(key))
    await pipeline.exec()
  },

  /**
   * Check if key exists and is not expired
   */
  async isValid(key: string): Promise<boolean> {
    const exists = await redis.exists(key)
    return exists === 1
  },

  /**
   * Get TTL remaining for a key
   */
  async getTTL(key: string): Promise<number> {
    return await redis.ttl(key)
  },
}

// Health check function
export async function checkRedisConnection(): Promise<{ connected: boolean; latency?: number; error?: string }> {
  try {
    const start = Date.now()
    await redis.ping()
    const latency = Date.now() - start
    
    return { connected: true, latency }
  } catch (error) {
    return { 
      connected: false, 
      error: error instanceof Error ? error.message : 'Unknown Redis error' 
    }
  }
}

// Redis connection info for debugging
export function getRedisInfo(): { 
  url: string | undefined
  configured: boolean 
} {
  return {
    url: UPSTASH_REDIS_REST_URL ? `${UPSTASH_REDIS_REST_URL.slice(0, 20)}...` : undefined,
    configured: !!(UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN),
  }
}

// Get Redis client (alias for compatibility)
export function getRedisClient() {
  return redis
}

// Graceful shutdown helper
export async function closeRedis(): Promise<void> {
  try {
    // Upstash Redis client doesn't need explicit connection closing
    console.log('Redis client shutdown complete')
  } catch (error) {
    console.error('Error during Redis shutdown:', error)
  }
}