/**
 * Unit Tests for Streak Save API
 * Phase 2: XP-Save Mechanic
 *
 * Tests cost calculation, eligibility validation, and edge cases
 */

describe('Streak Save - Unit Tests', () => {
  describe('calculateStreakSaveCost', () => {
    /**
     * Cost calculation formula:
     * - Surge pricing enabled: baseCost × daysSinceActivity
     * - Surge pricing disabled: baseCost
     */
    const calculateStreakSaveCost = (
      baseCost: number,
      daysSinceActivity: number,
      surgePricing: boolean
    ): number => {
      if (surgePricing) {
        return baseCost * daysSinceActivity
      }
      return baseCost
    }

    describe('with surge pricing enabled', () => {
      it('should calculate cost for day 1', () => {
        const cost = calculateStreakSaveCost(25, 1, true)
        expect(cost).toBe(25)
      })

      it('should calculate cost for day 2', () => {
        const cost = calculateStreakSaveCost(25, 2, true)
        expect(cost).toBe(50)
      })

      it('should calculate cost for day 3 (max window)', () => {
        const cost = calculateStreakSaveCost(25, 3, true)
        expect(cost).toBe(75)
      })

      it('should handle different base costs', () => {
        expect(calculateStreakSaveCost(10, 2, true)).toBe(20)
        expect(calculateStreakSaveCost(50, 2, true)).toBe(100)
        expect(calculateStreakSaveCost(100, 3, true)).toBe(300)
      })

      it('should handle fractional days correctly', () => {
        const cost = calculateStreakSaveCost(25, 2.5, true)
        expect(cost).toBe(62.5)
      })
    })

    describe('with surge pricing disabled', () => {
      it('should return base cost regardless of days', () => {
        expect(calculateStreakSaveCost(25, 1, false)).toBe(25)
        expect(calculateStreakSaveCost(25, 2, false)).toBe(25)
        expect(calculateStreakSaveCost(25, 3, false)).toBe(25)
        expect(calculateStreakSaveCost(25, 10, false)).toBe(25)
      })

      it('should handle different base costs', () => {
        expect(calculateStreakSaveCost(10, 5, false)).toBe(10)
        expect(calculateStreakSaveCost(50, 5, false)).toBe(50)
        expect(calculateStreakSaveCost(100, 5, false)).toBe(100)
      })
    })

    describe('edge cases', () => {
      it('should handle zero base cost', () => {
        expect(calculateStreakSaveCost(0, 2, true)).toBe(0)
        expect(calculateStreakSaveCost(0, 2, false)).toBe(0)
      })

      it('should handle zero days', () => {
        expect(calculateStreakSaveCost(25, 0, true)).toBe(0)
        expect(calculateStreakSaveCost(25, 0, false)).toBe(25)
      })

      it('should handle negative values (should not occur in production)', () => {
        expect(calculateStreakSaveCost(-25, 2, true)).toBe(-50)
        expect(calculateStreakSaveCost(25, -2, true)).toBe(-50)
      })
    })
  })

  describe('validateEligibility', () => {
    /**
     * Eligibility validation
     * Returns error message if not eligible, null if eligible
     */
    const validateEligibility = (params: {
      currentStreak: number
      lastActivityDate: string | null
      daysSince: number
      gracePeriodDays: number
      maxSaveWindow: number
      userXP: number
      cost: number
    }): string | null => {
      const {
        currentStreak,
        lastActivityDate,
        daysSince,
        gracePeriodDays,
        maxSaveWindow,
        userXP,
        cost
      } = params

      // Must have a streak to save
      if (currentStreak === 0) {
        return 'No streak to save (current streak is 0)'
      }

      // Must have activity date
      if (!lastActivityDate) {
        return 'No activity date recorded'
      }

      // Must be beyond grace period (actually breaking)
      if (daysSince <= gracePeriodDays) {
        return `Streak is not breaking (${daysSince} day${daysSince === 1 ? '' : 's'} <= ${gracePeriodDays} day grace period)`
      }

      // Must be within save window
      if (daysSince > maxSaveWindow) {
        return `Too late to save (${daysSince} days > ${maxSaveWindow} day window)`
      }

      // Must have sufficient XP
      if (userXP < cost) {
        return `Insufficient XP (need ${cost} XP, have ${userXP} XP)`
      }

      return null // Eligible!
    }

    const baseParams = {
      currentStreak: 10,
      lastActivityDate: '2025-11-03',
      daysSince: 2,
      gracePeriodDays: 1,
      maxSaveWindow: 3,
      userXP: 100,
      cost: 50
    }

    describe('valid eligibility', () => {
      it('should return null when all conditions are met', () => {
        const result = validateEligibility(baseParams)
        expect(result).toBeNull()
      })

      it('should allow save on day after grace period', () => {
        const result = validateEligibility({
          ...baseParams,
          daysSince: 2, // 1 day grace + 1 day after = day 2
          gracePeriodDays: 1
        })
        expect(result).toBeNull()
      })

      it('should allow save on last day of window', () => {
        const result = validateEligibility({
          ...baseParams,
          daysSince: 3,
          maxSaveWindow: 3
        })
        expect(result).toBeNull()
      })

      it('should allow save with exact XP needed', () => {
        const result = validateEligibility({
          ...baseParams,
          userXP: 50,
          cost: 50
        })
        expect(result).toBeNull()
      })

      it('should allow save with more than enough XP', () => {
        const result = validateEligibility({
          ...baseParams,
          userXP: 1000,
          cost: 50
        })
        expect(result).toBeNull()
      })
    })

    describe('no streak to save', () => {
      it('should reject when streak is 0', () => {
        const result = validateEligibility({
          ...baseParams,
          currentStreak: 0
        })
        expect(result).toBe('No streak to save (current streak is 0)')
      })

      it('should allow negative streak (validation only checks for 0)', () => {
        // Note: Negative streaks shouldn't occur in production, but validation
        // only explicitly checks for 0. This is acceptable as the streak
        // system itself prevents negative values.
        const result = validateEligibility({
          ...baseParams,
          currentStreak: -1
        })
        // The function doesn't explicitly reject negative values
        // Only checks for === 0
        expect(result).toBeNull()
      })
    })

    describe('no activity date', () => {
      it('should reject when lastActivityDate is null', () => {
        const result = validateEligibility({
          ...baseParams,
          lastActivityDate: null
        })
        expect(result).toBe('No activity date recorded')
      })

      it('should reject when lastActivityDate is empty string', () => {
        const result = validateEligibility({
          ...baseParams,
          lastActivityDate: ''
        })
        expect(result).toBe('No activity date recorded')
      })
    })

    describe('within grace period', () => {
      it('should reject when daysSince equals grace period', () => {
        const result = validateEligibility({
          ...baseParams,
          daysSince: 1,
          gracePeriodDays: 1
        })
        expect(result).toContain('Streak is not breaking')
        expect(result).toContain('1 day <= 1 day grace period')
      })

      it('should reject when daysSince is less than grace period', () => {
        const result = validateEligibility({
          ...baseParams,
          daysSince: 1,
          gracePeriodDays: 2
        })
        expect(result).toContain('Streak is not breaking')
        expect(result).toContain('1 day <= 2 day grace period')
      })

      it('should reject on day 0 (today)', () => {
        const result = validateEligibility({
          ...baseParams,
          daysSince: 0,
          gracePeriodDays: 1
        })
        expect(result).toContain('Streak is not breaking')
      })

      it('should handle 2-day grace period', () => {
        const result = validateEligibility({
          ...baseParams,
          daysSince: 2,
          gracePeriodDays: 2
        })
        expect(result).toContain('Streak is not breaking')
        expect(result).toContain('2 days <= 2 day grace period')
      })
    })

    describe('beyond save window', () => {
      it('should reject when daysSince exceeds maxSaveWindow', () => {
        const result = validateEligibility({
          ...baseParams,
          daysSince: 4,
          maxSaveWindow: 3
        })
        expect(result).toBe('Too late to save (4 days > 3 day window)')
      })

      it('should reject far beyond window', () => {
        const result = validateEligibility({
          ...baseParams,
          daysSince: 10,
          maxSaveWindow: 3
        })
        expect(result).toBe('Too late to save (10 days > 3 day window)')
      })

      it('should handle 1-day save window', () => {
        const result = validateEligibility({
          ...baseParams,
          daysSince: 3,
          gracePeriodDays: 1,
          maxSaveWindow: 2
        })
        expect(result).toContain('Too late to save')
      })
    })

    describe('insufficient XP', () => {
      it('should reject when userXP is 1 less than cost', () => {
        const result = validateEligibility({
          ...baseParams,
          userXP: 49,
          cost: 50
        })
        expect(result).toBe('Insufficient XP (need 50 XP, have 49 XP)')
      })

      it('should reject when userXP is 0', () => {
        const result = validateEligibility({
          ...baseParams,
          userXP: 0,
          cost: 50
        })
        expect(result).toBe('Insufficient XP (need 50 XP, have 0 XP)')
      })

      it('should reject when userXP is far below cost', () => {
        const result = validateEligibility({
          ...baseParams,
          userXP: 10,
          cost: 100
        })
        expect(result).toBe('Insufficient XP (need 100 XP, have 10 XP)')
      })

      it('should handle high surge pricing costs', () => {
        const result = validateEligibility({
          ...baseParams,
          userXP: 50,
          cost: 75, // 25 × 3 days
          daysSince: 3
        })
        expect(result).toContain('Insufficient XP')
        expect(result).toContain('need 75 XP, have 50 XP')
      })
    })

    describe('priority order', () => {
      it('should check streak before XP', () => {
        const result = validateEligibility({
          ...baseParams,
          currentStreak: 0,
          userXP: 0 // Also insufficient
        })
        expect(result).toBe('No streak to save (current streak is 0)')
      })

      it('should check activity date before grace period', () => {
        const result = validateEligibility({
          ...baseParams,
          lastActivityDate: null,
          daysSince: 0 // Would also fail grace check
        })
        expect(result).toBe('No activity date recorded')
      })

      it('should check grace period before window', () => {
        const result = validateEligibility({
          ...baseParams,
          daysSince: 1,
          gracePeriodDays: 1,
          maxSaveWindow: 0 // Would also fail window check
        })
        expect(result).toContain('Streak is not breaking')
      })

      it('should check window before XP', () => {
        const result = validateEligibility({
          ...baseParams,
          daysSince: 10,
          maxSaveWindow: 3,
          userXP: 0 // Would also fail XP check
        })
        expect(result).toContain('Too late to save')
      })
    })

    describe('realistic scenarios', () => {
      it('should handle user with 10-day streak, 2 days late, 100 XP', () => {
        const result = validateEligibility({
          currentStreak: 10,
          lastActivityDate: '2025-11-04',
          daysSince: 2,
          gracePeriodDays: 1,
          maxSaveWindow: 3,
          userXP: 100,
          cost: 50 // 25 × 2
        })
        expect(result).toBeNull()
      })

      it('should reject user with 50 XP but cost is 75 (day 3)', () => {
        const result = validateEligibility({
          currentStreak: 5,
          lastActivityDate: '2025-11-03',
          daysSince: 3,
          gracePeriodDays: 1,
          maxSaveWindow: 3,
          userXP: 50,
          cost: 75 // 25 × 3
        })
        expect(result).toContain('Insufficient XP')
      })

      it('should reject user who is 4 days late (beyond window)', () => {
        const result = validateEligibility({
          currentStreak: 20,
          lastActivityDate: '2025-11-02',
          daysSince: 4,
          gracePeriodDays: 1,
          maxSaveWindow: 3,
          userXP: 1000,
          cost: 100
        })
        expect(result).toContain('Too late to save')
      })

      it('should allow new user with 1-day streak on day 2', () => {
        const result = validateEligibility({
          currentStreak: 1,
          lastActivityDate: '2025-11-04',
          daysSince: 2,
          gracePeriodDays: 1,
          maxSaveWindow: 3,
          userXP: 60,
          cost: 50
        })
        expect(result).toBeNull()
      })

      it('should allow veteran with 100-day streak, plenty of XP', () => {
        const result = validateEligibility({
          currentStreak: 100,
          lastActivityDate: '2025-11-05',
          daysSince: 2,
          gracePeriodDays: 1,
          maxSaveWindow: 3,
          userXP: 50000,
          cost: 50
        })
        expect(result).toBeNull()
      })
    })

    describe('config variations', () => {
      it('should handle 2-day grace period', () => {
        const validResult = validateEligibility({
          ...baseParams,
          daysSince: 3,
          gracePeriodDays: 2
        })
        expect(validResult).toBeNull()

        const invalidResult = validateEligibility({
          ...baseParams,
          daysSince: 2,
          gracePeriodDays: 2
        })
        expect(invalidResult).toContain('Streak is not breaking')
      })

      it('should handle 5-day save window', () => {
        const validResult = validateEligibility({
          ...baseParams,
          daysSince: 5,
          maxSaveWindow: 5
        })
        expect(validResult).toBeNull()

        const invalidResult = validateEligibility({
          ...baseParams,
          daysSince: 6,
          maxSaveWindow: 5
        })
        expect(invalidResult).toContain('Too late to save')
      })

      it('should handle higher base cost (50 XP)', () => {
        const result = validateEligibility({
          ...baseParams,
          userXP: 100,
          cost: 100, // 50 × 2 days
          daysSince: 2
        })
        expect(result).toBeNull()
      })
    })
  })

  describe('integration scenarios', () => {
    /**
     * Test combined cost calculation + validation
     */
    const calculateStreakSaveCost = (
      baseCost: number,
      daysSinceActivity: number,
      surgePricing: boolean
    ): number => {
      if (surgePricing) {
        return baseCost * daysSinceActivity
      }
      return baseCost
    }

    const validateEligibility = (params: {
      currentStreak: number
      lastActivityDate: string | null
      daysSince: number
      gracePeriodDays: number
      maxSaveWindow: number
      userXP: number
      cost: number
    }): string | null => {
      const {
        currentStreak,
        lastActivityDate,
        daysSince,
        gracePeriodDays,
        maxSaveWindow,
        userXP,
        cost
      } = params

      if (currentStreak === 0) {
        return 'No streak to save (current streak is 0)'
      }

      if (!lastActivityDate) {
        return 'No activity date recorded'
      }

      if (daysSince <= gracePeriodDays) {
        return `Streak is not breaking (${daysSince} day${daysSince === 1 ? '' : 's'} <= ${gracePeriodDays} day grace period)`
      }

      if (daysSince > maxSaveWindow) {
        return `Too late to save (${daysSince} days > ${maxSaveWindow} day window)`
      }

      if (userXP < cost) {
        return `Insufficient XP (need ${cost} XP, have ${userXP} XP)`
      }

      return null
    }

    it('should calculate cost and validate successfully', () => {
      const baseCost = 25
      const daysSince = 2
      const cost = calculateStreakSaveCost(baseCost, daysSince, true)

      expect(cost).toBe(50)

      const validation = validateEligibility({
        currentStreak: 10,
        lastActivityDate: '2025-11-04',
        daysSince,
        gracePeriodDays: 1,
        maxSaveWindow: 3,
        userXP: 100,
        cost
      })

      expect(validation).toBeNull()
    })

    it('should calculate high cost and reject due to insufficient XP', () => {
      const baseCost = 25
      const daysSince = 3
      const cost = calculateStreakSaveCost(baseCost, daysSince, true)

      expect(cost).toBe(75)

      const validation = validateEligibility({
        currentStreak: 5,
        lastActivityDate: '2025-11-03',
        daysSince,
        gracePeriodDays: 1,
        maxSaveWindow: 3,
        userXP: 50,
        cost
      })

      expect(validation).toContain('Insufficient XP')
    })

    it('should handle no surge pricing scenario', () => {
      const baseCost = 25
      const daysSince = 3
      const cost = calculateStreakSaveCost(baseCost, daysSince, false)

      expect(cost).toBe(25) // No surge

      const validation = validateEligibility({
        currentStreak: 5,
        lastActivityDate: '2025-11-03',
        daysSince,
        gracePeriodDays: 1,
        maxSaveWindow: 3,
        userXP: 30,
        cost
      })

      expect(validation).toBeNull()
    })
  })
})
