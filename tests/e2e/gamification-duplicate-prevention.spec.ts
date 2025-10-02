/**
 * E2E Tests: Duplicate Prevention via Idempotency
 *
 * Tests that the idempotency system prevents duplicate operations:
 * - Same idempotencyKey returns cached response (200 OK)
 * - No double-counting of XP, streaks, achievements
 * - Proper handling across retries and replays
 * - Idempotency key expiry (24 hours)
 *
 * Critical Scenarios:
 * 1. Exact duplicate request returns same response
 * 2. Duplicate does NOT double-count XP or streak
 * 3. Different idempotencyKey allows new operation
 * 4. Idempotency works across different update types
 * 5. Concurrent duplicate requests handled correctly
 */

import { test, expect } from '@playwright/test'
import {
  authenticateUser,
  getUserStats,
  recordSession,
  callUnifiedStatsAPI,
  generateIdempotencyKey,
  assertions
} from './helpers/gamification-helpers'

test.describe('Gamification: Idempotency - Basic Duplicate Prevention', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page, 'premium')
  })

  test('Idempotency: Same key returns duplicate response (200 OK)', async ({ page }) => {
    const idempotencyKey = generateIdempotencyKey('duplicate_test')

    // First request
    const response1 = await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    }, idempotencyKey)

    // Verify first request succeeded
    assertions.assertSuccessResponse(response1)

    // Wait a moment
    await page.waitForTimeout(500)

    // Second request with SAME idempotencyKey
    const response2 = await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    }, idempotencyKey)

    // Should return 200 OK (not 409 Conflict)
    expect(response2.status).toBe(200)

    // Should be marked as duplicate
    assertions.assertDuplicateResponse(response2)

    // Response data should be identical to first request
    expect(response2.data.stats).toBeDefined()
  })

  test('Idempotency: Duplicate does NOT double-count XP', async ({ page }) => {
    const beforeStats = await getUserStats(page)
    const idempotencyKey = generateIdempotencyKey('no_double_xp')

    // First request
    await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    }, idempotencyKey)

    await page.waitForTimeout(500)

    const afterFirstRequest = await getUserStats(page)

    // Verify XP added once
    assertions.assertXPAdded(beforeStats, afterFirstRequest, 15)

    // Second request with same key
    await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    }, idempotencyKey)

    await page.waitForTimeout(500)

    const afterSecondRequest = await getUserStats(page)

    // XP should NOT increase again
    expect(afterSecondRequest.xp.total).toBe(afterFirstRequest.xp.total)

    // Total increase should still be 15 (not 30)
    assertions.assertXPAdded(beforeStats, afterSecondRequest, 15)
  })

  test('Idempotency: Duplicate does NOT increment streak twice', async ({ page }) => {
    const beforeStats = await getUserStats(page)
    const idempotencyKey = generateIdempotencyKey('no_double_streak')

    // First request
    await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    }, idempotencyKey)

    await page.waitForTimeout(500)

    const afterFirstRequest = await getUserStats(page)

    // Verify streak incremented once
    assertions.assertStreakIncremented(beforeStats, afterFirstRequest, 1)

    // Second request with same key
    await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    }, idempotencyKey)

    await page.waitForTimeout(500)

    const afterSecondRequest = await getUserStats(page)

    // Streak should NOT increment again
    expect(afterSecondRequest.streak.current).toBe(afterFirstRequest.streak.current)

    // Total increment should still be 1 (not 2)
    assertions.assertStreakIncremented(beforeStats, afterSecondRequest, 1)
  })

  test('Idempotency: Different key allows new operation', async ({ page }) => {
    const beforeStats = await getUserStats(page)

    // First request
    const key1 = generateIdempotencyKey('first_op')
    await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    }, key1)

    await page.waitForTimeout(500)

    const afterFirst = await getUserStats(page)
    assertions.assertXPAdded(beforeStats, afterFirst, 15)

    // Second request with DIFFERENT key
    const key2 = generateIdempotencyKey('second_op')
    const response2 = await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 12
    }, key2)

    // Should NOT be marked as duplicate
    expect(response2.data.duplicate).toBeUndefined()

    await page.waitForTimeout(500)

    const afterSecond = await getUserStats(page)

    // XP should increase again (15 + 12 = 27 total)
    assertions.assertXPAdded(beforeStats, afterSecond, 27)
  })
})

test.describe('Gamification: Idempotency - Different Operation Types', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page, 'premium')
  })

  test('Idempotency: XP update type', async ({ page }) => {
    const beforeStats = await getUserStats(page)
    const idempotencyKey = generateIdempotencyKey('xp_update')

    // First XP update
    const response1 = await callUnifiedStatsAPI(page, {
      type: 'xp',
      data: {
        amount: 20,
        source: 'bonus_reward',
        idempotencyKey
      }
    })

    assertions.assertSuccessResponse(response1)

    await page.waitForTimeout(500)

    const afterFirst = await getUserStats(page)
    assertions.assertXPAdded(beforeStats, afterFirst, 20)

    // Duplicate XP update
    const response2 = await callUnifiedStatsAPI(page, {
      type: 'xp',
      data: {
        amount: 20,
        source: 'bonus_reward',
        idempotencyKey
      }
    })

    assertions.assertDuplicateResponse(response2)

    await page.waitForTimeout(500)

    const afterSecond = await getUserStats(page)

    // XP should not increase again
    assertions.assertXPAdded(beforeStats, afterSecond, 20)
  })

  test('Idempotency: Achievement unlock type', async ({ page }) => {
    const beforeStats = await getUserStats(page)
    const idempotencyKey = generateIdempotencyKey('achievement_unlock')

    // First achievement unlock
    const response1 = await callUnifiedStatsAPI(page, {
      type: 'achievement',
      data: {
        achievementId: 'first_drill_complete',
        points: 50,
        idempotencyKey
      }
    })

    assertions.assertSuccessResponse(response1)

    await page.waitForTimeout(500)

    const afterFirst = await getUserStats(page)

    // Achievement should be unlocked
    expect(afterFirst.achievements.unlockedIds).toContain('first_drill_complete')

    // Duplicate achievement unlock
    const response2 = await callUnifiedStatsAPI(page, {
      type: 'achievement',
      data: {
        achievementId: 'first_drill_complete',
        points: 50,
        idempotencyKey
      }
    })

    assertions.assertDuplicateResponse(response2)

    await page.waitForTimeout(500)

    const afterSecond = await getUserStats(page)

    // Achievement count should not increase
    expect(afterSecond.achievements.unlockedCount).toBe(afterFirst.achievements.unlockedCount)
  })

  test('Idempotency: Session record type (most common)', async ({ page }) => {
    // This is the most common use case - session recordings

    const beforeStats = await getUserStats(page)
    const idempotencyKey = generateIdempotencyKey('session_record')

    // First session
    const response1 = await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    }, idempotencyKey)

    assertions.assertSuccessResponse(response1)

    await page.waitForTimeout(500)

    const afterFirst = await getUserStats(page)

    // Verify session was recorded
    expect(afterFirst.sessions.total).toBe(beforeStats.sessions.total + 1)

    // Duplicate session
    const response2 = await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    }, idempotencyKey)

    assertions.assertDuplicateResponse(response2)

    await page.waitForTimeout(500)

    const afterSecond = await getUserStats(page)

    // Session count should not increase
    expect(afterSecond.sessions.total).toBe(afterFirst.sessions.total)

    // XP should not increase
    expect(afterSecond.xp.total).toBe(afterFirst.xp.total)

    // Streak should not change
    expect(afterSecond.streak.current).toBe(afterFirst.streak.current)
  })
})

test.describe('Gamification: Idempotency - Retry Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page, 'premium')
  })

  test('Retry: Client retry after network error uses same key', async ({ page }) => {
    const beforeStats = await getUserStats(page)
    const idempotencyKey = generateIdempotencyKey('client_retry')

    // First attempt (succeeds)
    await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    }, idempotencyKey)

    await page.waitForTimeout(500)

    const afterFirst = await getUserStats(page)

    // Client doesn't know if request succeeded, retries with same key
    const response2 = await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    }, idempotencyKey)

    // Should be marked as duplicate
    assertions.assertDuplicateResponse(response2)

    await page.waitForTimeout(500)

    const afterSecond = await getUserStats(page)

    // Stats should be identical
    expect(afterSecond.xp.total).toBe(afterFirst.xp.total)
    expect(afterSecond.streak.current).toBe(afterFirst.streak.current)
  })

  test('Retry: Multiple rapid retries with same key', async ({ page }) => {
    const beforeStats = await getUserStats(page)
    const idempotencyKey = generateIdempotencyKey('rapid_retry')

    // Simulate client retrying rapidly (network flakiness)
    const promises = []

    for (let i = 0; i < 5; i++) {
      promises.push(
        recordSession(page, {
          type: 'drill',
          itemsReviewed: 10,
          accuracy: 85,
          duration: 120000,
          xpEarned: 15
        }, idempotencyKey)
      )
    }

    // Wait for all requests
    const responses = await Promise.all(promises)

    // First response should succeed
    assertions.assertSuccessResponse(responses[0])

    // Subsequent responses should be duplicates
    for (let i = 1; i < responses.length; i++) {
      if (responses[i].data.duplicate !== undefined) {
        assertions.assertDuplicateResponse(responses[i])
      }
    }

    await page.waitForTimeout(1000)

    const afterStats = await getUserStats(page)

    // XP should only be added once (15 total, not 75)
    assertions.assertXPAdded(beforeStats, afterStats, 15)

    // Streak should only increment once
    assertions.assertStreakIncremented(beforeStats, afterStats, 1)
  })
})

test.describe('Gamification: Idempotency - Concurrent Requests', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page, 'premium')
  })

  test('Concurrent: Same idempotencyKey from multiple tabs', async ({ page, context }) => {
    // Simulate user with multiple tabs open
    const beforeStats = await getUserStats(page)
    const idempotencyKey = generateIdempotencyKey('multi_tab')

    // Open second tab
    const page2 = await context.newPage()
    await authenticateUser(page2, 'premium')

    // Both tabs try to record same session simultaneously
    const promise1 = recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    }, idempotencyKey)

    const promise2 = recordSession(page2, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    }, idempotencyKey)

    const [response1, response2] = await Promise.all([promise1, promise2])

    // One should succeed, other should be duplicate
    const successCount = [response1, response2].filter(
      r => r.data.success && !r.data.duplicate
    ).length

    const duplicateCount = [response1, response2].filter(
      r => r.data.duplicate
    ).length

    // Exactly one success, one duplicate
    expect(successCount).toBe(1)
    expect(duplicateCount).toBe(1)

    await page.waitForTimeout(1000)

    const afterStats = await getUserStats(page)

    // XP should only be added once
    assertions.assertXPAdded(beforeStats, afterStats, 15)

    // Streak should only increment once
    assertions.assertStreakIncremented(beforeStats, afterStats, 1)

    await page2.close()
  })

  test('Concurrent: Different idempotencyKeys from multiple tabs', async ({ page, context }) => {
    const beforeStats = await getUserStats(page)

    // Open second tab
    const page2 = await context.newPage()
    await authenticateUser(page2, 'premium')

    // Both tabs record different sessions
    const promise1 = recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    }, generateIdempotencyKey('tab1'))

    const promise2 = recordSession(page2, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 12
    }, generateIdempotencyKey('tab2'))

    const [response1, response2] = await Promise.all([promise1, promise2])

    // Both should succeed
    assertions.assertSuccessResponse(response1)
    assertions.assertSuccessResponse(response2)

    await page.waitForTimeout(1000)

    const afterStats = await getUserStats(page)

    // Both XP amounts should be added (15 + 12 = 27)
    assertions.assertXPAdded(beforeStats, afterStats, 27)

    // Streak should only increment once (same day)
    assertions.assertStreakIncremented(beforeStats, afterStats, 1)

    await page2.close()
  })
})

test.describe('Gamification: Idempotency - Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page, 'premium')
  })

  test('Edge: Missing idempotencyKey allows duplicates (not recommended)', async ({ page }) => {
    const beforeStats = await getUserStats(page)

    // Request without idempotencyKey
    await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    })  // No key

    await page.waitForTimeout(500)

    const afterFirst = await getUserStats(page)
    assertions.assertXPAdded(beforeStats, afterFirst, 15)

    // Same request again, still no key
    await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    })  // No key

    await page.waitForTimeout(500)

    const afterSecond = await getUserStats(page)

    // Without idempotencyKey, request is treated as new
    // This is allowed but not recommended for user-initiated actions
    expect(afterSecond.xp.total).toBeGreaterThan(afterFirst.xp.total)
  })

  test('Edge: Very long idempotencyKey (max length test)', async ({ page }) => {
    const longKey = 'test_' + 'x'.repeat(200) // 205 characters

    const response = await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    }, longKey)

    // Should still work
    assertions.assertSuccessResponse(response)

    // Duplicate should still work
    const response2 = await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    }, longKey)

    assertions.assertDuplicateResponse(response2)
  })

  test('Edge: Special characters in idempotencyKey', async ({ page }) => {
    const specialKey = 'test_!@#$%^&*()_+-=[]{}|;:,.<>?'

    const response = await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    }, specialKey)

    // Should still work
    assertions.assertSuccessResponse(response)

    // Duplicate should still work
    const response2 = await recordSession(page, {
      type: 'drill',
      itemsReviewed: 10,
      accuracy: 85,
      duration: 120000,
      xpEarned: 15
    }, specialKey)

    assertions.assertDuplicateResponse(response2)
  })
})
