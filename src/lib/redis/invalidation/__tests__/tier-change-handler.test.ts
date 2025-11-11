/**
 * Unit tests for tier-change-handler
 * Tests cache invalidation logic for subscription tier changes
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'

// Mock Redis client
const mockRedis = {
  del: jest.fn(),
  ping: jest.fn(),
}

// Mock Firebase admin
const mockAdminDb = {
  collection: jest.fn(() => ({
    add: jest.fn().mockResolvedValue({ id: 'test-audit-log-id' })
  }))
}

// Mock the dependencies before importing the handler
jest.mock('@/lib/redis/client', () => ({
  redis: mockRedis,
  RedisKeys: {
    userTier: (userId: string) => `tier:${userId}`,
    userSession: (userId: string) => `user_sessions:${userId}`,
    userStats: (userId: string) => `stats:${userId}`,
    reviewQueue: (userId: string) => `queue:${userId}`,
    userEntitlements: (userId: string) => `entitlements:${userId}`,
    userProfile: (userId: string) => `profile:${userId}`,
  }
}))

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: mockAdminDb
}))

// Now import the handler after mocks are set up
import {
  invalidateAllUserCaches,
  invalidateSpecificCaches,
  checkCacheInvalidationHealth
} from '../tier-change-handler'

describe('tier-change-handler', () => {
  beforeEach(() => {
    // Clear all mock data before each test
    jest.clearAllMocks()
    mockRedis.del.mockResolvedValue(1) // Default: cache exists and was deleted
    mockRedis.ping.mockResolvedValue('PONG')
  })

  describe('invalidateAllUserCaches', () => {
    it('should clear all 6 cache types for a user', async () => {
      const userId = 'test-user-123'
      const reason = 'stripe_upgrade'

      const result = await invalidateAllUserCaches(userId, reason)

      // Should have called del for all 6 cache types
      expect(mockRedis.del).toHaveBeenCalledTimes(6)
      expect(mockRedis.del).toHaveBeenCalledWith('tier:test-user-123')
      expect(mockRedis.del).toHaveBeenCalledWith('user_sessions:test-user-123')
      expect(mockRedis.del).toHaveBeenCalledWith('stats:test-user-123')
      expect(mockRedis.del).toHaveBeenCalledWith('queue:test-user-123')
      expect(mockRedis.del).toHaveBeenCalledWith('entitlements:test-user-123')
      expect(mockRedis.del).toHaveBeenCalledWith('profile:test-user-123')

      // Verify result
      expect(result.success).toBe(true)
      expect(result.cachesClearedCount).toBe(6)
      expect(result.errors).toHaveLength(0)
      expect(result.userId).toBe(userId)
      expect(result.cacheTypes).toHaveLength(6)

      // Should have logged to audit
      expect(mockAdminDb.collection).toHaveBeenCalledWith('audit_logs')
    })

    it('should handle partial failures gracefully', async () => {
      const userId = 'test-user-456'

      // Mock: First 3 succeed, last 3 fail
      mockRedis.del
        .mockResolvedValueOnce(1)  // tier - success
        .mockResolvedValueOnce(1)  // session - success
        .mockResolvedValueOnce(1)  // stats - success
        .mockRejectedValueOnce(new Error('Redis connection lost'))  // queue - fail
        .mockRejectedValueOnce(new Error('Redis connection lost'))  // entitlements - fail
        .mockRejectedValueOnce(new Error('Redis connection lost'))  // profile - fail

      const result = await invalidateAllUserCaches(userId, 'test_failure')

      // Should have attempted all 6 deletions
      expect(mockRedis.del).toHaveBeenCalledTimes(6)

      // Should report partial success
      expect(result.success).toBe(false)
      expect(result.cachesClearedCount).toBe(3)
      expect(result.errors).toHaveLength(3)
      expect(result.errors[0]).toContain('Redis connection lost')
    })

    it('should continue even if audit logging fails', async () => {
      const userId = 'test-user-789'

      // Mock audit log failure
      mockAdminDb.collection = jest.fn(() => ({
        add: jest.fn().mockRejectedValue(new Error('Firestore unavailable'))
      }))

      const result = await invalidateAllUserCaches(userId, 'test_audit_fail')

      // Should still succeed with cache invalidation
      expect(result.success).toBe(true)
      expect(result.cachesClearedCount).toBe(6)

      // Audit failure shouldn't affect result
      expect(result.errors).toHaveLength(0)
    })

    it('should handle non-existent caches gracefully', async () => {
      const userId = 'new-user'

      // Mock: Caches don't exist (del returns 0)
      mockRedis.del.mockResolvedValue(0)

      const result = await invalidateAllUserCaches(userId, 'test_no_cache')

      expect(mockRedis.del).toHaveBeenCalledTimes(6)
      expect(result.success).toBe(true)
      expect(result.cachesClearedCount).toBe(0) // None actually cleared
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('invalidateSpecificCaches', () => {
    it('should only clear specified cache types', async () => {
      const userId = 'test-user-selective'
      const cacheTypes: Array<'tier' | 'stats'> = ['tier', 'stats']

      const result = await invalidateSpecificCaches(userId, cacheTypes, 'targeted_test')

      // Should only call del for specified caches
      expect(mockRedis.del).toHaveBeenCalledTimes(2)
      expect(mockRedis.del).toHaveBeenCalledWith('tier:test-user-selective')
      expect(mockRedis.del).toHaveBeenCalledWith('stats:test-user-selective')

      expect(result.success).toBe(true)
      expect(result.cachesClearedCount).toBe(2)
      expect(result.cacheTypes).toEqual(['tier', 'stats'])
    })

    it('should handle unknown cache types', async () => {
      const userId = 'test-user-invalid'
      const cacheTypes: any = ['tier', 'unknown_cache_type']

      const result = await invalidateSpecificCaches(userId, cacheTypes, 'test_invalid')

      // Should only clear valid cache type
      expect(mockRedis.del).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('Unknown cache type')
    })
  })

  describe('checkCacheInvalidationHealth', () => {
    it('should return true when Redis is accessible', async () => {
      mockRedis.ping.mockResolvedValue('PONG')

      const healthy = await checkCacheInvalidationHealth()

      expect(healthy).toBe(true)
      expect(mockRedis.ping).toHaveBeenCalled()
    })

    it('should return false when Redis is inaccessible', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'))

      const healthy = await checkCacheInvalidationHealth()

      expect(healthy).toBe(false)
    })
  })

  describe('Stripe webhook integration scenarios', () => {
    it('should handle subscription created event', async () => {
      const userId = 'stripe-user-create'

      const result = await invalidateAllUserCaches(userId, 'stripe_subscription_created')

      expect(result.success).toBe(true)
      expect(result.cachesClearedCount).toBe(6)

      // Verify audit log has correct reason
      const auditCall = mockAdminDb.collection().add
      expect(auditCall).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cache_invalidation',
          userId: userId,
          reason: 'stripe_subscription_created'
        })
      )
    })

    it('should handle subscription updated event', async () => {
      const userId = 'stripe-user-update'

      const result = await invalidateAllUserCaches(userId, 'stripe_subscription_updated')

      expect(result.success).toBe(true)
      expect(mockRedis.del).toHaveBeenCalledTimes(6)
    })

    it('should handle subscription deleted event (critical for security)', async () => {
      const userId = 'stripe-user-delete'

      const result = await invalidateAllUserCaches(userId, 'stripe_subscription_deleted')

      expect(result.success).toBe(true)
      expect(result.cachesClearedCount).toBe(6)

      // All caches must be cleared to revoke premium access immediately
      expect(mockRedis.del).toHaveBeenCalledWith('tier:stripe-user-delete')
      expect(mockRedis.del).toHaveBeenCalledWith('stats:stripe-user-delete')
      expect(mockRedis.del).toHaveBeenCalledWith('entitlements:stripe-user-delete')
    })
  })

  describe('Performance', () => {
    it('should clear caches in parallel (fast execution)', async () => {
      const userId = 'perf-test-user'
      const startTime = Date.now()

      // Mock slow Redis operations (100ms each)
      mockRedis.del.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(1), 100))
      )

      await invalidateAllUserCaches(userId, 'perf_test')

      const duration = Date.now() - startTime

      // If parallel: ~100ms, if sequential: ~600ms
      // Allow some overhead, should be < 200ms for parallel execution
      expect(duration).toBeLessThan(200)
    })
  })
})
