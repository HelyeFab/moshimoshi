// Tier Cache Service - Hybrid approach for subscription tier management
// Provides short-lived Redis caching (60s) to prevent stale tier data
// while maintaining good performance

import { redis, RedisKeys, RedisUtils, CacheTTL } from '@/lib/redis/client'
import { adminDb } from '@/lib/firebase/admin'

/**
 * Tier Cache Service
 *
 * Solves the stale tier problem by using short-lived Redis cache (60 seconds)
 * instead of embedding tier in JWT tokens (which last 24 hours).
 *
 * Benefits:
 * - Subscription changes reflect within 60 seconds
 * - No more session refresh complexity
 * - Maintains good performance with Redis caching
 * - Graceful fallback to Firestore on cache miss
 */
class TierCacheService {
  private readonly TTL = 60; // 60 seconds cache TTL

  /**
   * Get user tier with caching
   * First checks Redis cache, then falls back to Firestore
   */
  async getUserTier(userId: string): Promise<'guest' | 'free' | 'premium_monthly' | 'premium_yearly'> {
    if (!userId) {
      console.log('[TierCache] No userId provided, returning guest')
      return 'guest'
    }

    try {
      // Try Redis cache first
      const cacheKey = RedisKeys.userTier(userId)
      const cached = await redis.get(cacheKey)

      if (cached) {
        console.log(`[TierCache] Cache HIT for user ${userId}: ${cached}`)
        return cached as any
      }

      console.log(`[TierCache] Cache MISS for user ${userId}, fetching from Firestore`)

      // Fetch from Firestore
      const userDoc = await adminDb.collection('users').doc(userId).get()
      const userData = userDoc.data()

      if (!userDoc.exists || !userData) {
        console.log(`[TierCache] User ${userId} not found in Firestore, returning free`)
        return 'free'
      }

      // Determine tier from subscription data
      let tier: 'free' | 'premium_monthly' | 'premium_yearly' = 'free'

      if (userData.subscription) {
        const { status, plan } = userData.subscription
        console.log(`[TierCache] User ${userId} subscription - status: ${status}, plan: ${plan}`)

        // Check if subscription is valid (active or trialing)
        if ((status === 'active' || status === 'trialing') && plan) {
          tier = plan as any
          console.log(`[TierCache] User ${userId} has active subscription: ${tier}`)
        } else {
          console.log(`[TierCache] User ${userId} subscription not active or no plan, using free tier`)
        }
      } else {
        console.log(`[TierCache] User ${userId} has no subscription data, using free tier`)
      }

      // Cache the result for 60 seconds
      await redis.setex(cacheKey, this.TTL, tier)
      console.log(`[TierCache] Cached tier for user ${userId}: ${tier} (TTL: ${this.TTL}s)`)

      return tier

    } catch (error) {
      console.error(`[TierCache] Error getting tier for user ${userId}:`, error)

      // In case of any error, try direct Firestore as last resort
      try {
        const userDoc = await adminDb.collection('users').doc(userId).get()
        const userData = userDoc.data()

        if (userData?.subscription?.status === 'active' && userData?.subscription?.plan) {
          return userData.subscription.plan
        }
      } catch (fallbackError) {
        console.error(`[TierCache] Fallback Firestore fetch also failed:`, fallbackError)
      }

      // Default to free tier on any error
      return 'free'
    }
  }

  /**
   * Manually set tier in cache (useful for testing or manual override)
   */
  async setTier(userId: string, tier: 'guest' | 'free' | 'premium_monthly' | 'premium_yearly'): Promise<void> {
    if (!userId) {
      console.log('[TierCache] Cannot set tier without userId')
      return
    }

    try {
      const cacheKey = RedisKeys.userTier(userId)
      await redis.setex(cacheKey, this.TTL, tier)
      console.log(`[TierCache] Manually set tier for user ${userId}: ${tier}`)
    } catch (error) {
      console.error(`[TierCache] Error setting tier for user ${userId}:`, error)
    }
  }

  /**
   * Invalidate cached tier (call this when subscription changes)
   */
  async invalidate(userId: string): Promise<void> {
    if (!userId) {
      console.log('[TierCache] Cannot invalidate without userId')
      return
    }

    try {
      const cacheKey = RedisKeys.userTier(userId)
      await redis.del(cacheKey)
      console.log(`[TierCache] Invalidated tier cache for user ${userId}`)
    } catch (error) {
      console.error(`[TierCache] Error invalidating tier for user ${userId}:`, error)
    }
  }

  /**
   * Batch invalidate multiple users (useful for bulk operations)
   */
  async invalidateBatch(userIds: string[]): Promise<void> {
    if (!userIds || userIds.length === 0) {
      console.log('[TierCache] No userIds provided for batch invalidation')
      return
    }

    try {
      const keys = userIds.map(userId => RedisKeys.userTier(userId))
      await RedisUtils.deleteBatch(keys)
      console.log(`[TierCache] Batch invalidated tier cache for ${userIds.length} users`)
    } catch (error) {
      console.error(`[TierCache] Error batch invalidating tiers:`, error)
    }
  }

  /**
   * Check if tier is cached for a user
   */
  async isCached(userId: string): Promise<boolean> {
    if (!userId) return false

    try {
      const cacheKey = RedisKeys.userTier(userId)
      return await RedisUtils.isValid(cacheKey)
    } catch (error) {
      console.error(`[TierCache] Error checking cache for user ${userId}:`, error)
      return false
    }
  }

  /**
   * Get cache TTL remaining for a user
   */
  async getCacheTTL(userId: string): Promise<number> {
    if (!userId) return -1

    try {
      const cacheKey = RedisKeys.userTier(userId)
      return await RedisUtils.getTTL(cacheKey)
    } catch (error) {
      console.error(`[TierCache] Error getting TTL for user ${userId}:`, error)
      return -1
    }
  }

  /**
   * Warm up cache for a user (pre-fetch and cache)
   */
  async warmUp(userId: string): Promise<void> {
    if (!userId) return

    try {
      console.log(`[TierCache] Warming up cache for user ${userId}`)
      await this.getUserTier(userId) // This will fetch and cache
    } catch (error) {
      console.error(`[TierCache] Error warming up cache for user ${userId}:`, error)
    }
  }

  /**
   * Get stats about the cache (for monitoring)
   */
  async getStats(): Promise<{
    ttl: number
    description: string
  }> {
    return {
      ttl: this.TTL,
      description: 'Hybrid tier caching with 60-second TTL'
    }
  }
}

// Export singleton instance
export const tierCache = new TierCacheService()

// Export for backward compatibility and easy migration
export default tierCache

// Type guard for tier values
export function isValidTier(tier: any): tier is 'guest' | 'free' | 'premium_monthly' | 'premium_yearly' {
  return ['guest', 'free', 'premium_monthly', 'premium_yearly'].includes(tier)
}

// Helper to normalize tier values (in case of data inconsistencies)
export function normalizeTier(rawTier: any): 'guest' | 'free' | 'premium_monthly' | 'premium_yearly' {
  if (!rawTier) return 'guest'

  const tierStr = String(rawTier).toLowerCase()

  if (tierStr === 'premium_monthly' || tierStr === 'premium.monthly') {
    return 'premium_monthly'
  }
  if (tierStr === 'premium_yearly' || tierStr === 'premium.yearly') {
    return 'premium_yearly'
  }
  if (tierStr === 'free') {
    return 'free'
  }
  if (tierStr === 'guest') {
    return 'guest'
  }

  // Check for partial matches
  if (tierStr.includes('premium')) {
    // Try to determine if monthly or yearly
    if (tierStr.includes('month')) return 'premium_monthly'
    if (tierStr.includes('year')) return 'premium_yearly'
    // Default to monthly if can't determine
    return 'premium_monthly'
  }

  // Default to free for any unrecognized value
  return 'free'
}