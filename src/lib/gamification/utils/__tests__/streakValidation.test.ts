/**
 * Unit Tests for Streak Validation Utilities
 * Phase 1: Emergency UI Fix
 *
 * Tests validate that client-side streak validation matches backend logic
 * from streakService.ts to prevent showing stale streak data in UI.
 */

import {
  getCurrentDateUTC,
  parseISODate,
  calculateDaysDifference,
  validateStreakDisplay,
  getStreakDeadline,
  formatDaysSinceActivity,
  shouldWarnStreakAtRisk
} from '../streakValidation'

describe('Streak Validation Utilities', () => {
  describe('getCurrentDateUTC', () => {
    it('should return current date in UTC yyyy-mm-dd format', () => {
      const result = getCurrentDateUTC()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should return correct date for given reference date', () => {
      const refDate = new Date('2025-11-06T15:30:00.000Z')
      const result = getCurrentDateUTC(refDate)
      expect(result).toBe('2025-11-06')
    })

    it('should handle date at midnight UTC', () => {
      const refDate = new Date('2025-11-06T00:00:00.000Z')
      const result = getCurrentDateUTC(refDate)
      expect(result).toBe('2025-11-06')
    })

    it('should handle date near midnight (23:59:59 UTC)', () => {
      const refDate = new Date('2025-11-06T23:59:59.999Z')
      const result = getCurrentDateUTC(refDate)
      expect(result).toBe('2025-11-06')
    })
  })

  describe('parseISODate', () => {
    it('should parse ISO date string to Date at midnight UTC', () => {
      const result = parseISODate('2025-11-06')
      expect(result.toISOString()).toBe('2025-11-06T00:00:00.000Z')
    })

    it('should handle various date formats', () => {
      const dates = [
        '2025-01-01',
        '2025-12-31',
        '2025-06-15'
      ]
      dates.forEach(dateStr => {
        const result = parseISODate(dateStr)
        expect(result.toISOString()).toBe(`${dateStr}T00:00:00.000Z`)
      })
    })
  })

  describe('calculateDaysDifference', () => {
    it('should return 0 for same date', () => {
      const result = calculateDaysDifference('2025-11-06', '2025-11-06')
      expect(result).toBe(0)
    })

    it('should return 1 for consecutive dates', () => {
      const result = calculateDaysDifference('2025-11-05', '2025-11-06')
      expect(result).toBe(1)
    })

    it('should return 3 for dates 3 days apart', () => {
      const result = calculateDaysDifference('2025-11-03', '2025-11-06')
      expect(result).toBe(3)
    })

    it('should return absolute difference (order independent)', () => {
      const result1 = calculateDaysDifference('2025-11-03', '2025-11-06')
      const result2 = calculateDaysDifference('2025-11-06', '2025-11-03')
      expect(result1).toBe(result2)
      expect(result1).toBe(3)
    })

    it('should handle month boundaries', () => {
      const result = calculateDaysDifference('2025-10-31', '2025-11-02')
      expect(result).toBe(2)
    })

    it('should handle year boundaries', () => {
      const result = calculateDaysDifference('2024-12-30', '2025-01-02')
      expect(result).toBe(3)
    })
  })

  describe('validateStreakDisplay', () => {
    const TODAY = '2025-11-06'

    beforeEach(() => {
      // Mock getCurrentDateUTC to return consistent date for testing
      jest.spyOn(require('../streakValidation'), 'getCurrentDateUTC')
        .mockReturnValue(TODAY)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    describe('Edge Cases', () => {
      it('should handle null lastActivityDate', () => {
        const result = validateStreakDisplay(5, null, 24)
        expect(result).toEqual({
          isStale: false,
          daysSinceActivity: 0,
          effectiveStreak: 5,
          reason: 'No activity recorded',
          isWithinGracePeriod: false
        })
      })

      it('should handle zero streak with no activity', () => {
        const result = validateStreakDisplay(0, null, 24)
        expect(result.effectiveStreak).toBe(0)
        expect(result.isStale).toBe(false)
      })
    })

    describe('Active Streak Scenarios', () => {
      it('should show streak when active today (0 days since)', () => {
        const result = validateStreakDisplay(5, TODAY, 24)
        expect(result).toEqual({
          isStale: false,
          daysSinceActivity: 0,
          effectiveStreak: 5,
          reason: 'Active today',
          isWithinGracePeriod: true
        })
      })

      it('should show streak when active yesterday (1 day, within grace)', () => {
        const yesterday = '2025-11-05'
        const result = validateStreakDisplay(5, yesterday, 24)
        expect(result).toEqual({
          isStale: false,
          daysSinceActivity: 1,
          effectiveStreak: 5,
          reason: 'Active 1 day ago (within grace period)',
          isWithinGracePeriod: true
        })
      })
    })

    describe('Broken Streak Scenarios', () => {
      it('should hide streak when 2 days since activity (beyond 24h grace)', () => {
        const twoDaysAgo = '2025-11-04'
        const result = validateStreakDisplay(5, twoDaysAgo, 24)
        expect(result).toEqual({
          isStale: true,
          daysSinceActivity: 2,
          effectiveStreak: 0,
          reason: 'Streak broken 2 days ago (beyond grace period)',
          isWithinGracePeriod: false
        })
      })

      it('should hide streak when 3 days since activity', () => {
        const threeDaysAgo = '2025-11-03'
        const result = validateStreakDisplay(1, threeDaysAgo, 24)
        expect(result).toEqual({
          isStale: true,
          daysSinceActivity: 3,
          effectiveStreak: 0,
          reason: 'Streak broken 3 days ago (beyond grace period)',
          isWithinGracePeriod: false
        })
      })

      it('should hide streak when 7 days since activity', () => {
        const weekAgo = '2025-10-30'
        const result = validateStreakDisplay(10, weekAgo, 24)
        expect(result.isStale).toBe(true)
        expect(result.daysSinceActivity).toBe(7)
        expect(result.effectiveStreak).toBe(0)
      })
    })

    describe('Different Grace Periods', () => {
      it('should handle 48-hour grace period (2 days)', () => {
        const twoDaysAgo = '2025-11-04'
        const result = validateStreakDisplay(5, twoDaysAgo, 48)
        expect(result.isStale).toBe(false)
        expect(result.effectiveStreak).toBe(5)
        expect(result.isWithinGracePeriod).toBe(true)
      })

      it('should break streak after 48-hour grace period', () => {
        const threeDaysAgo = '2025-11-03'
        const result = validateStreakDisplay(5, threeDaysAgo, 48)
        expect(result.isStale).toBe(true)
        expect(result.effectiveStreak).toBe(0)
        expect(result.isWithinGracePeriod).toBe(false)
      })

      it('should handle 12-hour grace period (rounds up to 1 day)', () => {
        // Note: Grace period calculation uses Math.max(1, Math.ceil(gracePeriodHours / 24))
        // So 12 hours becomes ceil(0.5) = 1 day minimum
        const oneDayAgo = '2025-11-05'
        const result = validateStreakDisplay(5, oneDayAgo, 12)
        expect(result.isStale).toBe(false) // 1 day <= 1 day (still valid)
        expect(result.effectiveStreak).toBe(5)
        expect(result.isWithinGracePeriod).toBe(true)
      })
    })

    describe('Real User Bug Scenario', () => {
      it('should correctly identify user bug case (1 streak, 3 days inactive)', () => {
        // This is the exact bug scenario from the user's Firebase data
        const lastActive = '2025-11-03'
        const currentStreak = 1
        const result = validateStreakDisplay(currentStreak, lastActive, 24)

        expect(result).toEqual({
          isStale: true,
          daysSinceActivity: 3,
          effectiveStreak: 0, // Should show 0, not 1
          reason: 'Streak broken 3 days ago (beyond grace period)',
          isWithinGracePeriod: false
        })
      })
    })
  })

  describe('getStreakDeadline', () => {
    it('should return deadline for active streak (1 day ago)', () => {
      const yesterday = '2025-11-05'
      const deadline = getStreakDeadline(yesterday, 24)

      expect(deadline).not.toBeNull()
      if (deadline) {
        // Deadline should be yesterday + 24 hours = today midnight
        expect(deadline.toISOString()).toBe('2025-11-06T00:00:00.000Z')
      }
    })

    it('should return null for stale streak (3 days ago)', () => {
      const threeDaysAgo = '2025-11-03'
      const deadline = getStreakDeadline(threeDaysAgo, 24)
      expect(deadline).toBeNull()
    })

    it('should return null when no activity date', () => {
      const deadline = getStreakDeadline(null, 24)
      expect(deadline).toBeNull()
    })

    it('should calculate deadline with 48-hour grace period', () => {
      const twoDaysAgo = '2025-11-04'
      const deadline = getStreakDeadline(twoDaysAgo, 48)

      expect(deadline).not.toBeNull()
      if (deadline) {
        // Deadline should be 2 days ago + 48 hours
        expect(deadline.toISOString()).toBe('2025-11-06T00:00:00.000Z')
      }
    })
  })

  describe('formatDaysSinceActivity', () => {
    it('should format 0 days as "today"', () => {
      expect(formatDaysSinceActivity(0)).toBe('today')
    })

    it('should format 1 day as "yesterday"', () => {
      expect(formatDaysSinceActivity(1)).toBe('yesterday')
    })

    it('should format 2 days as "2 days ago"', () => {
      expect(formatDaysSinceActivity(2)).toBe('2 days ago')
    })

    it('should format 3 days as "3 days ago"', () => {
      expect(formatDaysSinceActivity(3)).toBe('3 days ago')
    })

    it('should format 7 days as "7 days ago"', () => {
      expect(formatDaysSinceActivity(7)).toBe('7 days ago')
    })
  })

  describe('shouldWarnStreakAtRisk', () => {
    beforeAll(() => {
      // Mock current time to 2025-11-05T20:00:00.000Z (4 hours before deadline)
      // Last activity: 2025-11-04, Deadline: 2025-11-05T00:00:00.000Z + 24h = 2025-11-06T00:00:00.000Z
      // Wait, that's not right. Let me recalculate...
      // Last activity: 2025-11-05, Deadline: 2025-11-06T00:00:00.000Z (midnight today + 1 day)
      // Actually deadline = lastActivity + gracePeriod = 2025-11-05T00:00:00.000Z + 24h = 2025-11-06T00:00:00.000Z
      // If now is 2025-11-05T20:00:00.000Z, deadline is 4 hours away
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2025-11-05T20:00:00.000Z'))
    })

    afterAll(() => {
      jest.useRealTimers()
    })

    it('should warn when deadline is within warning threshold (4h)', () => {
      // Current time: 2025-11-05T20:00:00.000Z
      // Last active: 2025-11-04 (yesterday from mocked time)
      // Deadline: 2025-11-04T00:00:00.000Z + 24h = 2025-11-05T00:00:00.000Z
      // Hours until deadline: (midnight - 8pm) = -20h (already passed!)
      // Let's use today as last activity instead
      const today = '2025-11-05'
      // Deadline: 2025-11-05T00:00:00.000Z + 24h = 2025-11-06T00:00:00.000Z
      // Hours until deadline: (2025-11-06T00:00:00 - 2025-11-05T20:00:00) = 4h
      const result = shouldWarnStreakAtRisk(today, 24, 4)
      expect(result).toBe(true)
    })

    it('should not warn when deadline is beyond threshold', () => {
      // Current time: 2025-11-05T20:00:00.000Z
      // Last active: 2025-11-05 (today)
      // Deadline: 2025-11-06T00:00:00.000Z
      // Hours until deadline: 4h
      // Threshold: 2h
      // 4h > 2h, so should NOT warn
      const today = '2025-11-05'
      const result = shouldWarnStreakAtRisk(today, 24, 2)
      expect(result).toBe(false)
    })

    it('should not warn when streak already broken', () => {
      // Last active 2 days ago from mocked time (2025-11-03)
      const twoDaysAgo = '2025-11-03'
      const result = shouldWarnStreakAtRisk(twoDaysAgo, 24, 4)
      expect(result).toBe(false)
    })

    it('should not warn when no activity date', () => {
      const result = shouldWarnStreakAtRisk(null, 24, 4)
      expect(result).toBe(false)
    })

    it('should not warn when deadline has passed', () => {
      // Last active 3 days ago (already broken)
      const threeDaysAgo = '2025-11-02'
      const result = shouldWarnStreakAtRisk(threeDaysAgo, 24, 4)
      expect(result).toBe(false)
    })

    it('should handle different warning thresholds', () => {
      // Mock time to 2025-11-05T23:00:00.000Z (1 hour before deadline)
      jest.setSystemTime(new Date('2025-11-05T23:00:00.000Z'))

      const today = '2025-11-05'
      // Deadline: 2025-11-06T00:00:00.000Z
      // Hours until deadline: 1h

      // Should warn with 2h threshold (1h <= 2h)
      expect(shouldWarnStreakAtRisk(today, 24, 2)).toBe(true)

      // Should not warn with 30min threshold (1h > 0.5h)
      expect(shouldWarnStreakAtRisk(today, 24, 0.5)).toBe(false)
    })
  })

  describe('Integration: Full Validation Flow', () => {
    const TODAY = '2025-11-06'

    beforeAll(() => {
      jest.spyOn(require('../streakValidation'), 'getCurrentDateUTC')
        .mockReturnValue(TODAY)
    })

    afterAll(() => {
      jest.restoreAllMocks()
    })

    it('should provide complete validation data for UI rendering', () => {
      const currentStreak = 5
      const lastActivityDate = '2025-11-05' // yesterday

      const validation = validateStreakDisplay(currentStreak, lastActivityDate, 24)
      const deadline = getStreakDeadline(lastActivityDate, 24)
      const formatted = formatDaysSinceActivity(validation.daysSinceActivity)

      // Should show active streak
      expect(validation.effectiveStreak).toBe(5)
      expect(validation.isStale).toBe(false)

      // Should have valid deadline
      expect(deadline).not.toBeNull()

      // Should format correctly
      expect(formatted).toBe('yesterday')

      // UI can render: "🔥 5 days streak" + countdown timer
    })

    it('should provide complete broken streak data for UI rendering', () => {
      const currentStreak = 1
      const lastActivityDate = '2025-11-03' // 3 days ago

      const validation = validateStreakDisplay(currentStreak, lastActivityDate, 24)
      const deadline = getStreakDeadline(lastActivityDate, 24)
      const formatted = formatDaysSinceActivity(validation.daysSinceActivity)

      // Should hide streak
      expect(validation.effectiveStreak).toBe(0)
      expect(validation.isStale).toBe(true)

      // Should have no deadline
      expect(deadline).toBeNull()

      // Should format correctly
      expect(formatted).toBe('3 days ago')

      // UI can render: "💔 Streak broken - Last active 3 days ago"
    })
  })
})
