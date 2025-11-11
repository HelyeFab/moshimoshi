/**
 * Comprehensive Cache Invalidation on Tier Changes
 *
 * Ensures all user-related caches are invalidated when subscription updates.
 * Critical for Stripe checkout flow to show immediate premium access.
 *
 * This handler is called by:
 * - Stripe webhook (via Firebase Functions)
 * - Manual admin operations
 * - User-initiated refresh requests
 *
 * @module redis/invalidation/tier-change-handler
 */

import { redis, RedisKeys } from '@/lib/redis/client'
import { adminDb } from '@/lib/firebase/admin'

export interface TierChangeInvalidationResult {
  success: boolean
  cachesClearedCount: number
  errors: string[]
  userId: string
  timestamp: Date
  cacheTypes: string[]
}

/**
 * Invalidate ALL user caches when tier changes
 * Called by Stripe webhook after subscription update
 *
 * @param userId - Firebase user ID
 * @param reason - Why invalidation was triggered (e.g., 'stripe_upgrade', 'stripe_downgrade', 'manual')
 * @returns Result with success status and details
 */
export async function invalidateAllUserCaches(
  userId: string,
  reason: string = 'tier_change'
): Promise<TierChangeInvalidationResult> {
  console.log(`[TierChangeHandler] Starting cache invalidation for user ${userId}`)
  console.log(`[TierChangeHandler] Reason: ${reason}`)

  const result: TierChangeInvalidationResult = {
    success: true,
    cachesClearedCount: 0,
    errors: [],
    userId,
    timestamp: new Date(),
    cacheTypes: []
  }

  // Define all cache keys that need to be invalidated
  const cacheOperations = [
    { key: RedisKeys.userTier(userId), type: 'tier' },
    { key: RedisKeys.userSession(userId), type: 'session' },
    { key: RedisKeys.userStats(userId), type: 'stats' },
    { key: RedisKeys.reviewQueue(userId), type: 'queue' },
    { key: RedisKeys.userEntitlements(userId), type: 'entitlements' },
    { key: RedisKeys.userProfile(userId), type: 'profile' },
  ]

  // Delete all cache keys in parallel for maximum speed
  const deletePromises = cacheOperations.map(async (operation) => {
    try {
      const deleted = await redis.del(operation.key)

      if (deleted > 0) {
        result.cachesClearedCount++
        result.cacheTypes.push(operation.type)
        console.log(`[TierChangeHandler] ✅ Cleared ${operation.type} cache: ${operation.key}`)
      } else {
        console.log(`[TierChangeHandler] ⚪ ${operation.type} cache did not exist: ${operation.key}`)
      }

      return { success: true, type: operation.type }
    } catch (error) {
      const errMsg = `Failed to clear ${operation.type} cache (${operation.key}): ${error}`
      result.errors.push(errMsg)
      result.success = false
      console.error(`[TierChangeHandler] ❌ ${errMsg}`)
      return { success: false, type: operation.type, error }
    }
  })

  // Wait for all deletions to complete
  try {
    await Promise.all(deletePromises)
  } catch (error) {
    result.success = false
    result.errors.push(`Batch delete failed: ${error}`)
    console.error('[TierChangeHandler] ❌ Batch cache clear failed:', error)
  }

  // Log invalidation event to Firestore (for auditing and monitoring)
  try {
    await adminDb.collection('audit_logs').add({
      type: 'cache_invalidation',
      userId,
      reason,
      cachesClearedCount: result.cachesClearedCount,
      cacheTypes: result.cacheTypes,
      errors: result.errors,
      success: result.success,
      timestamp: result.timestamp,
      environment: process.env.NODE_ENV || 'unknown',
    })
    console.log('[TierChangeHandler] 📝 Audit log created')
  } catch (error) {
    console.error('[TierChangeHandler] ⚠️  Failed to log audit event:', error)
    // Don't fail the invalidation if logging fails
  }

  // Summary log
  if (result.success) {
    console.log(`[TierChangeHandler] ✅ SUCCESS: Cleared ${result.cachesClearedCount} caches for user ${userId}`)
    console.log(`[TierChangeHandler] Cache types cleared: ${result.cacheTypes.join(', ')}`)
  } else {
    console.error(`[TierChangeHandler] ⚠️  PARTIAL SUCCESS: Cleared ${result.cachesClearedCount} caches with ${result.errors.length} errors`)
    result.errors.forEach(err => console.error(`[TierChangeHandler]   - ${err}`))
  }

  return result
}

/**
 * Invalidate specific cache types for a user
 * Useful for targeted cache invalidation without clearing everything
 *
 * @param userId - Firebase user ID
 * @param cacheTypes - Array of cache types to invalidate (e.g., ['tier', 'stats'])
 * @param reason - Why invalidation was triggered
 */
export async function invalidateSpecificCaches(
  userId: string,
  cacheTypes: Array<'tier' | 'session' | 'stats' | 'queue' | 'entitlements' | 'profile'>,
  reason: string = 'targeted_invalidation'
): Promise<TierChangeInvalidationResult> {
  console.log(`[TierChangeHandler] Targeted cache invalidation for user ${userId}`)
  console.log(`[TierChangeHandler] Cache types: ${cacheTypes.join(', ')}`)

  const result: TierChangeInvalidationResult = {
    success: true,
    cachesClearedCount: 0,
    errors: [],
    userId,
    timestamp: new Date(),
    cacheTypes: []
  }

  // Map cache types to Redis keys
  const cacheKeyMap: Record<string, string> = {
    tier: RedisKeys.userTier(userId),
    session: RedisKeys.userSession(userId),
    stats: RedisKeys.userStats(userId),
    queue: RedisKeys.reviewQueue(userId),
    entitlements: RedisKeys.userEntitlements(userId),
    profile: RedisKeys.userProfile(userId),
  }

  // Delete specified caches
  for (const cacheType of cacheTypes) {
    const key = cacheKeyMap[cacheType]

    if (!key) {
      result.errors.push(`Unknown cache type: ${cacheType}`)
      result.success = false
      continue
    }

    try {
      const deleted = await redis.del(key)

      if (deleted > 0) {
        result.cachesClearedCount++
        result.cacheTypes.push(cacheType)
        console.log(`[TierChangeHandler] ✅ Cleared ${cacheType} cache`)
      }
    } catch (error) {
      const errMsg = `Failed to clear ${cacheType} cache: ${error}`
      result.errors.push(errMsg)
      result.success = false
      console.error(`[TierChangeHandler] ❌ ${errMsg}`)
    }
  }

  // Log to audit
  try {
    await adminDb.collection('audit_logs').add({
      type: 'cache_invalidation_targeted',
      userId,
      reason,
      cacheTypes: result.cacheTypes,
      cachesClearedCount: result.cachesClearedCount,
      errors: result.errors,
      success: result.success,
      timestamp: result.timestamp,
    })
  } catch (error) {
    console.error('[TierChangeHandler] Failed to log audit event:', error)
  }

  return result
}

/**
 * API endpoint wrapper for external calls
 * Used by Firebase Functions webhook and admin tools
 *
 * @param userId - Firebase user ID
 * @param reason - Optional reason for invalidation
 */
export async function invalidateCachesAPI(
  userId: string,
  reason?: string
): Promise<TierChangeInvalidationResult> {
  return invalidateAllUserCaches(userId, reason)
}

/**
 * Batch invalidate caches for multiple users
 * Useful for bulk operations or migrations
 *
 * @param userIds - Array of Firebase user IDs
 * @param reason - Why invalidation was triggered
 * @returns Array of results for each user
 */
export async function invalidateBatchUserCaches(
  userIds: string[],
  reason: string = 'batch_invalidation'
): Promise<TierChangeInvalidationResult[]> {
  console.log(`[TierChangeHandler] Batch cache invalidation for ${userIds.length} users`)

  const results = await Promise.all(
    userIds.map(userId => invalidateAllUserCaches(userId, reason))
  )

  const successCount = results.filter(r => r.success).length
  const failureCount = results.length - successCount

  console.log(`[TierChangeHandler] Batch complete: ${successCount} succeeded, ${failureCount} failed`)

  return results
}

/**
 * Health check function to verify Redis connection for cache invalidation
 *
 * @returns True if Redis is accessible, false otherwise
 */
export async function checkCacheInvalidationHealth(): Promise<boolean> {
  try {
    // Try a simple Redis operation
    await redis.ping()
    return true
  } catch (error) {
    console.error('[TierChangeHandler] Health check failed:', error)
    return false
  }
}
