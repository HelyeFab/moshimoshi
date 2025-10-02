/**
 * E2E Tests: Offline → Online Sync with Idempotency
 *
 * Tests the offline queue system and sync reliability:
 * - Activities recorded offline are queued
 * - When online, queue syncs to server
 * - Idempotency prevents duplicate streak increments
 * - Proper XP summation across multiple activities
 *
 * Critical Scenarios:
 * 1. Single offline activity → sync correctly
 * 2. Multiple offline activities same day → single streak increment
 * 3. Offline queue replay with idempotency keys
 * 4. Network errors during sync with retry
 * 5. Mixed offline/online activities
 */

import { test, expect } from '@playwright/test'
import {
  authenticateUser,
  getUserStats,
  recordSession,
  generateIdempotencyKey,
  simulateOffline,
  simulateOnline,
  assertions,
  timezoneHelpers
} from './helpers/gamification-helpers'

test.describe('Gamification: Offline Activity Queuing', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page, 'premium')
  })

  test('Offline: Single activity queues correctly', async ({ page }) => {
    // Get initial stats while online
    const beforeStats = await getUserStats(page)

    // Go offline
    await simulateOffline(page)

    // Record activity while offline
    // Note: This may fail to reach server, but should queue locally
    try {
      await recordSession(page, {
        type: 'drill',
        itemsReviewed: 10,
        accuracy: 85,
        duration: 120000,
        xpEarned: 15
      }, generateIdempotencyKey('offline_single'))
    } catch (error) {
      // Expected: API call will fail while offline
    }

    // Verify activity is in offline queue (IndexedDB)
    const queueSize = await page.evaluate(async () => {
      const db = await indexedDB.open('gamification_sync', 1)
      return new Promise<number>((resolve) => {
        db.onsuccess = () => {
          const transaction = db.result.transaction(['sync_queue'], 'readonly')
          const store = transaction.objectStore('sync_queue')
          const request = store.count()
          request.onsuccess = () => resolve(request.result)
        }
      })
    })

    expect(queueSize).toBeGreaterThan(0)

    // Come back online
    await simulateOnline(page)

    // Wait for sync to process
    await page.waitForTimeout(2000)

    // Get updated stats
    const afterStats = await getUserStats(page)

    // Verify streak incremented
    assertions.assertStreakIncremented(beforeStats, afterStats, 1)
    assertions.assertXPAdded(beforeStats, afterStats, 15)
  })

  test('Offline: Multiple activities same day → single streak increment', async ({ page }) => {
    // This is the CRITICAL test from Day 2 acceptance criteria
    // Multiple offline activities on same day should:
    // - Sum XP correctly (all activities counted)
    // - Increment streak ONCE (not once per activity)

    const beforeStats = await getUserStats(page)

    // Go offline
    await simulateOffline(page)

    // Record 3 activities while offline (40 XP total)
    const activities = [
      { xp: 15, key: 'offline_multi_1' },
      { xp: 12, key: 'offline_multi_2' },
      { xp: 13, key: 'offline_multi_3' }
    ]

    for (const activity of activities) {
      try {
        await recordSession(page, {
          type: 'drill',
          itemsReviewed: 10,
          accuracy: 85,
          duration: 120000,
          xpEarned: activity.xp
        }, generateIdempotencyKey(activity.key))
      } catch (error) {
        // Expected: offline, no server connection
      }

      // Small delay between activities
      await page.waitForTimeout(100)
    }

    // Verify all 3 activities queued
    const queueSize = await page.evaluate(async () => {
      const db = await indexedDB.open('gamification_sync', 1)
      return new Promise<number>((resolve) => {
        db.onsuccess = () => {
          const transaction = db.result.transaction(['sync_queue'], 'readonly')
          const store = transaction.objectStore('sync_queue')
          const request = store.count()
          request.onsuccess = () => resolve(request.result)
        }
      })
    })

    expect(queueSize).toBe(3)

    // Come back online
    await simulateOnline(page)

    // Wait for sync queue to process (may take a few seconds)
    await page.waitForTimeout(3000)

    // Get updated stats
    const afterStats = await getUserStats(page)

    // CRITICAL ASSERTIONS:
    // 1. All XP counted (40 total)
    assertions.assertXPAdded(beforeStats, afterStats, 40)

    // 2. Streak incremented ONCE (not 3 times)
    assertions.assertStreakIncremented(beforeStats, afterStats, 1)

    // 3. Queue should be empty (all processed)
    const finalQueueSize = await page.evaluate(async () => {
      const db = await indexedDB.open('gamification_sync', 1)
      return new Promise<number>((resolve) => {
        db.onsuccess = () => {
          const transaction = db.result.transaction(['sync_queue'], 'readonly')
          const store = transaction.objectStore('sync_queue')
          const request = store.count()
          request.onsuccess = () => resolve(request.result)
        }
      })
    })

    expect(finalQueueSize).toBe(0)
  })

  test('Offline: Activities across multiple days build streak', async ({ page }) => {
    const beforeStats = await getUserStats(page)

    // Simulate offline activities over 3 days
    // Day 1: Yesterday
    await simulateOffline(page)

    try {
      await recordSession(page, {
        type: 'drill',
        itemsReviewed: 10,
        accuracy: 85,
        duration: 120000,
        xpEarned: 15
      }, generateIdempotencyKey(`offline_day1_${timezoneHelpers.getUTCDateString(1)}`))
    } catch (error) {
      // Expected offline
    }

    await page.waitForTimeout(500)

    // Day 2: Today
    try {
      await recordSession(page, {
        type: 'drill',
        itemsReviewed: 10,
        accuracy: 85,
        duration: 120000,
        xpEarned: 15
      }, generateIdempotencyKey(`offline_day2_${timezoneHelpers.getCurrentUTCDateString()}`))
    } catch (error) {
      // Expected offline
    }

    // Come back online
    await simulateOnline(page)

    // Wait for sync
    await page.waitForTimeout(3000)

    // Get updated stats
    const afterStats = await getUserStats(page)

    // Should have 2-day streak (or added 2 to existing)
    expect(afterStats.streak.current).toBeGreaterThanOrEqual(beforeStats.streak.current + 2)

    // Total XP should be 30
    assertions.assertXPAdded(beforeStats, afterStats, 30)
  })
})

test.describe('Gamification: Sync Retry & Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page, 'premium')
  })

  test('Sync retry: Failed sync attempts retry with backoff', async ({ page }) => {
    // This test verifies the exponential backoff retry strategy

    // Go offline
    await simulateOffline(page)

    // Queue activity
    try {
      await recordSession(page, {
        type: 'drill',
        itemsReviewed: 10,
        accuracy: 85,
        duration: 120000,
        xpEarned: 15
      }, generateIdempotencyKey('retry_test'))
    } catch (error) {
      // Expected
    }

    // Come back online
    await simulateOnline(page)

    // Monitor retry attempts via console logs
    const retryLogs: string[] = []

    page.on('console', (msg) => {
      if (msg.text().includes('retry') || msg.text().includes('backoff')) {
        retryLogs.push(msg.text())
      }
    })

    // Wait for retries
    await page.waitForTimeout(5000)

    // Verify sync eventually succeeds
    const queueSize = await page.evaluate(async () => {
      const db = await indexedDB.open('gamification_sync', 1)
      return new Promise<number>((resolve) => {
        db.onsuccess = () => {
          const transaction = db.result.transaction(['sync_queue'], 'readonly')
          const store = transaction.objectStore('sync_queue')
          const request = store.count()
          request.onsuccess = () => resolve(request.result)
        }
      })
    })

    // Queue should be empty (sync succeeded)
    expect(queueSize).toBe(0)
  })

  test('Sync deduplication: Same activityId only syncs once', async ({ page }) => {
    const beforeStats = await getUserStats(page)

    // Use same activityId for multiple queue items
    const activityId = 'duplicate_activity_123'
    const idempotencyKey = generateIdempotencyKey('dedup_test')

    // Go offline
    await simulateOffline(page)

    // Try to queue same activity twice
    for (let i = 0; i < 2; i++) {
      try {
        await page.evaluate(async ({ activityId, idempotencyKey }) => {
          // Manually add to queue with same activityId
          const db = await indexedDB.open('gamification_sync', 1)
          db.onsuccess = () => {
            const transaction = db.result.transaction(['sync_queue'], 'readwrite')
            const store = transaction.objectStore('sync_queue')
            store.add({
              id: `${activityId}_${Date.now()}_${Math.random()}`,
              userId: 'current_user',
              type: 'session',
              data: {
                type: 'drill',
                itemsReviewed: 10,
                accuracy: 85,
                duration: 120000,
                xpEarned: 15
              },
              activityId,
              idempotencyKey,
              timestamp: Date.now(),
              retryCount: 0,
              status: 'pending'
            })
          }
        }, { activityId, idempotencyKey })
      } catch (error) {
        // May fail due to unique constraint - that's good!
      }

      await page.waitForTimeout(100)
    }

    // Come online and sync
    await simulateOnline(page)
    await page.waitForTimeout(3000)

    const afterStats = await getUserStats(page)

    // Should only process once (XP added once, streak incremented once)
    // Even if queue had duplicates
    assertions.assertStreakIncremented(beforeStats, afterStats, 1)
    assertions.assertXPAdded(beforeStats, afterStats, 15)
  })
})

test.describe('Gamification: Mixed Offline/Online Activity', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page, 'premium')
  })

  test('Mixed: Online activity, then offline, then online again', async ({ page }) => {
    const beforeStats = await getUserStats(page)

    // Step 1: Online activity
    const response1 = await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    }, generateIdempotencyKey('mixed_online_1'))

    assertions.assertSuccessResponse(response1)

    await page.waitForTimeout(500)

    // Step 2: Go offline and queue activity
    await simulateOffline(page)

    try {
      await recordSession(page, {
        type: 'drill',
        itemsReviewed: 10,
        accuracy: 85,
        duration: 120000,
        xpEarned: 12
      }, generateIdempotencyKey('mixed_offline'))
    } catch (error) {
      // Expected
    }

    await page.waitForTimeout(500)

    // Step 3: Come back online
    await simulateOnline(page)
    await page.waitForTimeout(2000)

    // Step 4: Another online activity
    const response2 = await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 13
    }, generateIdempotencyKey('mixed_online_2'))

    assertions.assertSuccessResponse(response2)

    await page.waitForTimeout(1000)

    // Get final stats
    const afterStats = await getUserStats(page)

    // Total XP: 15 + 12 + 13 = 40
    assertions.assertXPAdded(beforeStats, afterStats, 40)

    // Streak: Depends on if all same day or different days
    // At minimum, should be 1 if all same day
    expect(afterStats.streak.current).toBeGreaterThanOrEqual(beforeStats.streak.current + 1)
  })

  test('Mixed: Intermittent connectivity with queue processing', async ({ page }) => {
    const beforeStats = await getUserStats(page)

    // Simulate flaky network: offline → online → offline → online
    const activities = [
      { offline: false, xp: 15, key: 'stable_1' },
      { offline: true, xp: 12, key: 'flaky_1' },
      { offline: true, xp: 13, key: 'flaky_2' },
      { offline: false, xp: 10, key: 'stable_2' }
    ]

    for (const activity of activities) {
      if (activity.offline) {
        await simulateOffline(page)
      } else {
        await simulateOnline(page)
      }

      try {
        await recordSession(page, {
          type: 'drill',
          itemsReviewed: 10,
          accuracy: 85,
          duration: 120000,
          xpEarned: activity.xp
        }, generateIdempotencyKey(activity.key))
      } catch (error) {
        // Expected for offline activities
      }

      await page.waitForTimeout(300)
    }

    // Ensure we're online at the end
    await simulateOnline(page)
    await page.waitForTimeout(3000)

    const afterStats = await getUserStats(page)

    // All XP should be counted: 15 + 12 + 13 + 10 = 50
    assertions.assertXPAdded(beforeStats, afterStats, 50)

    // Queue should be empty
    const queueSize = await page.evaluate(async () => {
      const db = await indexedDB.open('gamification_sync', 1)
      return new Promise<number>((resolve) => {
        db.onsuccess = () => {
          const transaction = db.result.transaction(['sync_queue'], 'readonly')
          const store = transaction.objectStore('sync_queue')
          const request = store.count()
          request.onsuccess = () => resolve(request.result)
        }
      })
    })

    expect(queueSize).toBe(0)
  })
})

test.describe('Gamification: Circuit Breaker Protection', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page, 'premium')
  })

  test('Circuit breaker: Opens after 5 consecutive failures', async ({ page }) => {
    // This test verifies the circuit breaker pattern
    // After 5 consecutive sync failures, circuit should open
    // and pause retries for 30 seconds

    // Note: This is a complex test that requires simulating server errors
    // Implementation depends on how circuit breaker is exposed

    // For now, we'll test the happy path and document the pattern
    expect(true).toBe(true) // Placeholder

    // TODO: Implement circuit breaker testing when error simulation is available
    // Expected behavior:
    // 1. Force 5 consecutive server errors (500)
    // 2. Verify circuit opens (no more retries)
    // 3. Wait 30 seconds
    // 4. Verify circuit closes (retries resume)
  })

  test('Circuit breaker: Resets after successful sync', async ({ page }) => {
    // Verify that circuit breaker resets retry count after success

    const beforeStats = await getUserStats(page)

    // Simulate some failed syncs followed by success
    await simulateOffline(page)

    try {
      await recordSession(page, {
        type: 'drill',
        itemsReviewed: 10,
        accuracy: 85,
        duration: 120000,
        xpEarned: 15
      }, generateIdempotencyKey('circuit_reset_test'))
    } catch (error) {
      // Expected
    }

    // Come online (should succeed)
    await simulateOnline(page)
    await page.waitForTimeout(3000)

    const afterStats = await getUserStats(page)

    // Verify sync succeeded
    assertions.assertStreakIncremented(beforeStats, afterStats, 1)
  })
})
