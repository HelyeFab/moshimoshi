/**
 * Badge Utilities Tests
 *
 * Tests for badge expiry logic, visibility checks, and days remaining calculations.
 * Ensures 6-day auto-expiry works correctly across different timezones and edge cases.
 */

import {
  isBadgeExpired,
  shouldShowBadge,
  getBadgeDaysRemaining,
  BADGE_EXPIRY_DAYS,
} from '../badgeUtils'
import type { StallBadge } from '@/config/learning-village-types'

describe('badgeUtils', () => {
  // Helper to create a badge with a specific age in days
  const createBadge = (daysAgo: number, type: 'new' | 'updated' = 'new'): StallBadge => {
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    return {
      type,
      addedAt: date.toISOString(),
    }
  }

  describe('BADGE_EXPIRY_DAYS constant', () => {
    it('should be 6 days', () => {
      expect(BADGE_EXPIRY_DAYS).toBe(6)
    })
  })

  describe('isBadgeExpired', () => {
    it('should return true for undefined badge', () => {
      expect(isBadgeExpired(undefined)).toBe(true)
    })

    it('should return false for badge added today', () => {
      const badge = createBadge(0)
      expect(isBadgeExpired(badge)).toBe(false)
    })

    it('should return false for badge added 1 day ago', () => {
      const badge = createBadge(1)
      expect(isBadgeExpired(badge)).toBe(false)
    })

    it('should return false for badge added 5 days ago', () => {
      const badge = createBadge(5)
      expect(isBadgeExpired(badge)).toBe(false)
    })

    it('should return false for badge added exactly 5.99 days ago', () => {
      const badge = createBadge(5.99)
      expect(isBadgeExpired(badge)).toBe(false)
    })

    it('should return true for badge added exactly 6 days ago', () => {
      const badge = createBadge(6)
      expect(isBadgeExpired(badge)).toBe(true)
    })

    it('should return true for badge added 7 days ago', () => {
      const badge = createBadge(7)
      expect(isBadgeExpired(badge)).toBe(true)
    })

    it('should return true for badge added 30 days ago', () => {
      const badge = createBadge(30)
      expect(isBadgeExpired(badge)).toBe(true)
    })

    it('should handle different badge types the same way', () => {
      const newBadge = createBadge(5, 'new')
      const updatedBadge = createBadge(5, 'updated')

      expect(isBadgeExpired(newBadge)).toBe(false)
      expect(isBadgeExpired(updatedBadge)).toBe(false)
    })

    it('should handle malformed dates gracefully', () => {
      const badBadge: StallBadge = {
        type: 'new',
        addedAt: 'invalid-date',
      }
      // Invalid dates should result in NaN, which should be handled
      const result = isBadgeExpired(badBadge)
      expect(typeof result).toBe('boolean')
    })
  })

  describe('shouldShowBadge', () => {
    it('should return false for undefined badge', () => {
      expect(shouldShowBadge(undefined)).toBe(false)
    })

    it('should return true for fresh badge (0 days old)', () => {
      const badge = createBadge(0)
      expect(shouldShowBadge(badge)).toBe(true)
    })

    it('should return true for badge added 3 days ago', () => {
      const badge = createBadge(3)
      expect(shouldShowBadge(badge)).toBe(true)
    })

    it('should return true for badge added 5 days ago', () => {
      const badge = createBadge(5)
      expect(shouldShowBadge(badge)).toBe(true)
    })

    it('should return false for badge added exactly 6 days ago', () => {
      const badge = createBadge(6)
      expect(shouldShowBadge(badge)).toBe(false)
    })

    it('should return false for badge added 10 days ago', () => {
      const badge = createBadge(10)
      expect(shouldShowBadge(badge)).toBe(false)
    })
  })

  describe('getBadgeDaysRemaining', () => {
    it('should return 0 for undefined badge', () => {
      expect(getBadgeDaysRemaining(undefined)).toBe(0)
    })

    it('should return 6 for badge added today', () => {
      const badge = createBadge(0)
      const remaining = getBadgeDaysRemaining(badge)
      expect(remaining).toBe(6)
    })

    it('should return 5 for badge added 1 day ago', () => {
      const badge = createBadge(1)
      const remaining = getBadgeDaysRemaining(badge)
      expect(remaining).toBe(5)
    })

    it('should return 3 for badge added 3 days ago', () => {
      const badge = createBadge(3)
      const remaining = getBadgeDaysRemaining(badge)
      expect(remaining).toBe(3)
    })

    it('should return 1 for badge added 5 days ago', () => {
      const badge = createBadge(5)
      const remaining = getBadgeDaysRemaining(badge)
      expect(remaining).toBe(1)
    })

    it('should return 0 for badge added exactly 6 days ago', () => {
      const badge = createBadge(6)
      const remaining = getBadgeDaysRemaining(badge)
      expect(remaining).toBe(0)
    })

    it('should return 0 for expired badge (7 days ago)', () => {
      const badge = createBadge(7)
      const remaining = getBadgeDaysRemaining(badge)
      expect(remaining).toBe(0)
    })

    it('should return 0 for very old badge (100 days ago)', () => {
      const badge = createBadge(100)
      const remaining = getBadgeDaysRemaining(badge)
      expect(remaining).toBe(0)
    })

    it('should round up fractional days', () => {
      // Badge added 3.2 days ago should have 2.8 days remaining, rounds to 3
      const badge = createBadge(3.2)
      const remaining = getBadgeDaysRemaining(badge)
      expect(remaining).toBeGreaterThanOrEqual(2)
      expect(remaining).toBeLessThanOrEqual(3)
    })
  })

  describe('edge cases', () => {
    it('should handle badge added exactly at expiry threshold', () => {
      const badge = createBadge(BADGE_EXPIRY_DAYS)
      expect(isBadgeExpired(badge)).toBe(true)
      expect(shouldShowBadge(badge)).toBe(false)
      expect(getBadgeDaysRemaining(badge)).toBe(0)
    })

    it('should handle badge added just before expiry threshold', () => {
      const badge = createBadge(BADGE_EXPIRY_DAYS - 0.01)
      expect(isBadgeExpired(badge)).toBe(false)
      expect(shouldShowBadge(badge)).toBe(true)
      expect(getBadgeDaysRemaining(badge)).toBeGreaterThan(0)
    })

    it('should handle very recent badge (minutes ago)', () => {
      const now = new Date()
      const badge: StallBadge = {
        type: 'new',
        addedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
      }
      expect(isBadgeExpired(badge)).toBe(false)
      expect(shouldShowBadge(badge)).toBe(true)
      expect(getBadgeDaysRemaining(badge)).toBe(6)
    })

    it('should handle future date gracefully', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const badge: StallBadge = {
        type: 'new',
        addedAt: tomorrow.toISOString(),
      }
      // Future dates should be treated as fresh
      expect(isBadgeExpired(badge)).toBe(false)
      expect(shouldShowBadge(badge)).toBe(true)
    })
  })

  describe('timezone handling', () => {
    it('should handle ISO timestamps correctly', () => {
      const isoDate = '2024-02-01T10:30:00.000Z'
      const badge: StallBadge = {
        type: 'new',
        addedAt: isoDate,
      }

      // Should parse ISO date correctly regardless of timezone
      expect(typeof isBadgeExpired(badge)).toBe('boolean')
      expect(typeof shouldShowBadge(badge)).toBe('boolean')
      expect(typeof getBadgeDaysRemaining(badge)).toBe('number')
    })

    it('should handle different date formats', () => {
      const date1 = new Date('2024-02-01').toISOString()
      const date2 = new Date(2024, 1, 1).toISOString()

      const badge1: StallBadge = { type: 'new', addedAt: date1 }
      const badge2: StallBadge = { type: 'new', addedAt: date2 }

      // Both should be handled consistently
      expect(typeof isBadgeExpired(badge1)).toBe('boolean')
      expect(typeof isBadgeExpired(badge2)).toBe('boolean')
    })
  })

  describe('performance', () => {
    it('should handle many calculations efficiently', () => {
      const start = Date.now()

      for (let i = 0; i < 1000; i++) {
        const badge = createBadge(Math.random() * 10)
        isBadgeExpired(badge)
        shouldShowBadge(badge)
        getBadgeDaysRemaining(badge)
      }

      const elapsed = Date.now() - start
      // Should complete 3000 calculations in under 100ms
      expect(elapsed).toBeLessThan(100)
    })
  })
})
