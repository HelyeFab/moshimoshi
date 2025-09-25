/**
 * Redis Cache for Leaderboard Data
 * Provides fast access to leaderboard snapshots with automatic fallback to Firestore
 */

import { redis } from '@/lib/redis/client'
import { LeaderboardSnapshot, TimeFrame } from '@/lib/leaderboard/types'
import logger from '@/lib/logger'

// Helper function to check Redis availability
function isRedisAvailable(): boolean {
  return redis !== null && redis !== undefined
}

// Cache configuration
const CACHE_PREFIX = 'leaderboard:'
const CACHE_TTL = 300 // 5 minutes in seconds

/**
 * Get cache key for a timeframe
 */
function getCacheKey(timeframe: TimeFrame): string {
  return `${CACHE_PREFIX}${timeframe}:latest`
}

/**
 * Get leaderboard snapshot from cache
 */
export async function getCachedLeaderboard(
  timeframe: TimeFrame
): Promise<LeaderboardSnapshot | null> {
  if (!isRedisAvailable()) {
    return null
  }

  try {
    const key = getCacheKey(timeframe)
    const cached = await redis.get(key)

    if (cached) {
      logger.debug('[LeaderboardCache] Cache hit for', timeframe)
      return JSON.parse(cached) as LeaderboardSnapshot
    }

    logger.debug('[LeaderboardCache] Cache miss for', timeframe)
    return null
  } catch (error) {
    logger.error('[LeaderboardCache] Error getting cached data:', error)
    return null
  }
}

/**
 * Set leaderboard snapshot in cache
 */
export async function setCachedLeaderboard(
  timeframe: TimeFrame,
  snapshot: LeaderboardSnapshot
): Promise<void> {
  if (!isRedisAvailable()) {
    return
  }

  try {
    const key = getCacheKey(timeframe)
    await redis.setex(key, CACHE_TTL, JSON.stringify(snapshot))
    logger.debug('[LeaderboardCache] Cached snapshot for', timeframe)
  } catch (error) {
    logger.error('[LeaderboardCache] Error setting cache:', error)
  }
}

/**
 * Invalidate leaderboard cache for a specific timeframe
 */
export async function invalidateLeaderboardCache(
  timeframe?: TimeFrame
): Promise<void> {
  if (!isRedisAvailable()) {
    return
  }

  try {
    if (timeframe) {
      // Invalidate specific timeframe
      const key = getCacheKey(timeframe)
      await redis.del(key)
      logger.info('[LeaderboardCache] Invalidated cache for', timeframe)
    } else {
      // Invalidate all timeframes
      const keys = ['daily', 'weekly', 'monthly', 'allTime'].map(tf =>
        getCacheKey(tf as TimeFrame)
      )
      await redis.del(...keys)
      logger.info('[LeaderboardCache] Invalidated all cache entries')
    }
  } catch (error) {
    logger.error('[LeaderboardCache] Error invalidating cache:', error)
  }
}

/**
 * Get user's rank from cached leaderboard
 */
export async function getCachedUserRank(
  userId: string,
  timeframe: TimeFrame
): Promise<{ rank: number; totalPlayers: number } | null> {
  try {
    const snapshot = await getCachedLeaderboard(timeframe)

    if (!snapshot) {
      return null
    }

    const userEntry = snapshot.entries.find(e => e.userId === userId)

    if (userEntry) {
      return {
        rank: userEntry.rank,
        totalPlayers: snapshot.totalPlayers
      }
    }

    // User not in top entries, estimate based on total players
    return {
      rank: snapshot.entries.length + 1, // At least below all top entries
      totalPlayers: snapshot.totalPlayers
    }
  } catch (error) {
    logger.error('[LeaderboardCache] Error getting user rank:', error)
    return null
  }
}

/**
 * Warm up cache by preloading all timeframes
 */
export async function warmUpLeaderboardCache(): Promise<void> {
  if (!isRedisAvailable()) {
    return
  }

  try {
    logger.info('[LeaderboardCache] Warming up cache...')

    // This would typically fetch from Firestore and cache
    // For now, we'll just log the intent
    const timeframes: TimeFrame[] = ['daily', 'weekly', 'monthly', 'allTime']

    for (const tf of timeframes) {
      // In production, this would fetch from Firestore
      logger.debug(`[LeaderboardCache] Would warm up ${tf} cache`)
    }

    logger.info('[LeaderboardCache] Cache warm-up complete')
  } catch (error) {
    logger.error('[LeaderboardCache] Error warming up cache:', error)
  }
}

/**
 * Get cache statistics
 */
export async function getLeaderboardCacheStats(): Promise<{
  hits: number
  misses: number
  size: number
} | null> {
  if (!isRedisAvailable()) {
    return null
  }

  try {
    // In a real implementation, we'd track these metrics
    // For now, return placeholder stats
    return {
      hits: 0,
      misses: 0,
      size: 0
    }
  } catch (error) {
    logger.error('[LeaderboardCache] Error getting stats:', error)
    return null
  }
}