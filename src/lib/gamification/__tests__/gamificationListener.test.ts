/**
 * Unit Tests for Gamification Listener
 * Tests XP calculation, streak logic, and achievement conditions
 */

import { GamificationListener, XPCalculationResult } from '../gamificationListener'
import { useGamificationStore } from '@/state/userGamification'
import { EventEmitter } from 'events'
import { ReviewEventType } from '@/lib/review-engine/core/events'

// Mock configs
jest.mock('@/config/gamification/xp.json', () => ({
  baseXP: 10,
  bonuses: {
    accuracy: [
      { threshold: 100, multiplier: 1.5 },
      { threshold: 90, multiplier: 1.3 },
      { threshold: 80, multiplier: 1.2 }
    ],
    speed: {
      thresholdMs: 3000,
      bonus: 5
    },
    streak: {
      minStreak: 10,
      bonusPerItem: 2,
      maxBonus: 50
    }
  },
  dailyXPCap: 500
}))

jest.mock('@/config/gamification/streak.json', () => ({
  minXPForStreak: 10
}))

jest.mock('@/config/gamification/achievements.json', () => ({
  achievements: [
    {
      id: 'first_session',
      name: 'First Session',
      condition: { type: 'session_count', operator: '>=', value: 1 }
    },
    {
      id: 'week_warrior',
      name: 'Week Warrior',
      condition: { type: 'streak', operator: '>=', value: 7 }
    }
  ]
}))

describe('GamificationListener', () => {
  let listener: GamificationListener
  let mockEmitter: EventEmitter

  beforeEach(() => {
    listener = new GamificationListener()
    mockEmitter = new EventEmitter()
    process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'true'
    useGamificationStore.getState().reset()
  })

  afterEach(() => {
    listener.destroy()
  })

  describe('Initialization', () => {
    it('should initialize with feature flag ON', () => {
      listener.initialize('user123', mockEmitter)
      expect(listener['isEnabled']).toBe(true)
      expect(listener['userId']).toBe('user123')
    })

    it('should not initialize with feature flag OFF', () => {
      process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'false'
      listener.initialize('user123', mockEmitter)
      expect(listener['isEnabled']).toBe(false)
    })

    it('should not initialize with undefined feature flag', () => {
      delete process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION
      listener.initialize('user123', mockEmitter)
      expect(listener['isEnabled']).toBe(false)
    })
  })

  describe('XP Calculation', () => {
    it('should calculate base XP correctly', () => {
      const statistics = {
        correctItems: 10,
        accuracy: 70,
        averageResponseTime: 5000,
        bestStreak: 5
      }

      const result = listener['calculateXP'](statistics)
      expect(result.baseXP).toBe(100) // 10 * 10
      expect(result.totalXP).toBeGreaterThanOrEqual(100)
    })

    it('should apply accuracy bonus for 100% accuracy', () => {
      const statistics = {
        correctItems: 10,
        accuracy: 100,
        averageResponseTime: 5000,
        bestStreak: 5
      }

      const result = listener['calculateXP'](statistics)
      expect(result.bonuses.accuracy).toBe(50) // 100 * (1.5 - 1) = 50
      expect(result.totalXP).toBe(150) // 100 + 50
    })

    it('should apply accuracy bonus for 90%+ accuracy', () => {
      const statistics = {
        correctItems: 10,
        accuracy: 95,
        averageResponseTime: 5000,
        bestStreak: 5
      }

      const result = listener['calculateXP'](statistics)
      expect(result.bonuses.accuracy).toBe(30) // 100 * (1.3 - 1) = 30
    })

    it('should apply accuracy bonus for 80%+ accuracy', () => {
      const statistics = {
        correctItems: 10,
        accuracy: 85,
        averageResponseTime: 5000,
        bestStreak: 5
      }

      const result = listener['calculateXP'](statistics)
      expect(result.bonuses.accuracy).toBe(20) // 100 * (1.2 - 1) = 20
    })

    it('should not apply accuracy bonus for <80% accuracy', () => {
      const statistics = {
        correctItems: 10,
        accuracy: 75,
        averageResponseTime: 5000,
        bestStreak: 5
      }

      const result = listener['calculateXP'](statistics)
      expect(result.bonuses.accuracy).toBeUndefined()
    })

    it('should apply speed bonus for <3s average', () => {
      const statistics = {
        correctItems: 10,
        accuracy: 70,
        averageResponseTime: 2500,
        bestStreak: 5
      }

      const result = listener['calculateXP'](statistics)
      expect(result.bonuses.speed).toBe(5)
    })

    it('should not apply speed bonus for >=3s average', () => {
      const statistics = {
        correctItems: 10,
        accuracy: 70,
        averageResponseTime: 3500,
        bestStreak: 5
      }

      const result = listener['calculateXP'](statistics)
      expect(result.bonuses.speed).toBeUndefined()
    })

    it('should apply streak bonus for 10+ streak', () => {
      const statistics = {
        correctItems: 10,
        accuracy: 70,
        averageResponseTime: 5000,
        bestStreak: 12
      }

      const result = listener['calculateXP'](statistics)
      expect(result.bonuses.streak).toBe(24) // 12 * 2
    })

    it('should not apply streak bonus for <10 streak', () => {
      const statistics = {
        correctItems: 10,
        accuracy: 70,
        averageResponseTime: 5000,
        bestStreak: 8
      }

      const result = listener['calculateXP'](statistics)
      expect(result.bonuses.streak).toBeUndefined()
    })

    it('should cap streak bonus at maxBonus', () => {
      const statistics = {
        correctItems: 10,
        accuracy: 70,
        averageResponseTime: 5000,
        bestStreak: 50 // Would be 100 XP, but capped at 50
      }

      const result = listener['calculateXP'](statistics)
      expect(result.bonuses.streak).toBe(50) // Capped at maxBonus
    })

    it('should cap daily XP at 500', () => {
      const statistics = {
        correctItems: 100,
        accuracy: 100,
        averageResponseTime: 2000,
        bestStreak: 50
      }

      const result = listener['calculateXP'](statistics)
      expect(result.cappedXP).toBe(500) // Capped
      expect(result.totalXP).toBeGreaterThan(500) // But totalXP shows actual
    })

    it('should combine all bonuses correctly', () => {
      const statistics = {
        correctItems: 10,
        accuracy: 100,
        averageResponseTime: 2500,
        bestStreak: 12
      }

      const result = listener['calculateXP'](statistics)
      // Base: 100
      // Accuracy: 50 (100 * 0.5)
      // Speed: 5
      // Streak: 24 (12 * 2)
      // Total: 179
      expect(result.totalXP).toBe(179)
      expect(result.cappedXP).toBe(179)
    })
  })

  describe('Achievement Conditions', () => {
    it('should evaluate session_count condition', () => {
      const condition = { type: 'session_count', operator: '>=', value: 1 }
      const statistics = {}
      const store = { sessionCount: 1 }

      const result = listener['evaluateCondition'](condition, statistics, store)
      expect(result).toBe(true)
    })

    it('should evaluate streak condition', () => {
      const condition = { type: 'streak', operator: '>=', value: 7 }
      const statistics = {}
      const store = { currentStreak: 7 }

      const result = listener['evaluateCondition'](condition, statistics, store)
      expect(result).toBe(true)
    })

    it('should evaluate best_streak condition', () => {
      const condition = { type: 'best_streak', operator: '>=', value: 10 }
      const statistics = { bestStreak: 12 }
      const store = {}

      const result = listener['evaluateCondition'](condition, statistics, store)
      expect(result).toBe(true)
    })

    it('should evaluate level condition', () => {
      const condition = { type: 'level', operator: '>=', value: 10 }
      const statistics = {}
      const store = { currentLevel: 10 }

      const result = listener['evaluateCondition'](condition, statistics, store)
      expect(result).toBe(true)
    })

    it('should evaluate time_of_day condition (early bird)', () => {
      const condition = { type: 'time_of_day', operator: '<', value: 6 }
      const statistics = {}
      const store = {}

      // Mock current hour
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(5)

      const result = listener['evaluateCondition'](condition, statistics, store)
      expect(result).toBe(true)
    })

    it('should evaluate time_of_day condition (night owl)', () => {
      const condition = { type: 'time_of_day', operator: '>=', value: 22 }
      const statistics = {}
      const store = {}

      // Mock current hour
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(23)

      const result = listener['evaluateCondition'](condition, statistics, store)
      expect(result).toBe(true)
    })

    it('should support all operators (>=, >, <=, <, ==)', () => {
      const store = { sessionCount: 5 }
      const statistics = {}

      expect(listener['evaluateCondition']({ type: 'session_count', operator: '>=', value: 5 }, statistics, store)).toBe(true)
      expect(listener['evaluateCondition']({ type: 'session_count', operator: '>', value: 4 }, statistics, store)).toBe(true)
      expect(listener['evaluateCondition']({ type: 'session_count', operator: '<=', value: 5 }, statistics, store)).toBe(true)
      expect(listener['evaluateCondition']({ type: 'session_count', operator: '<', value: 6 }, statistics, store)).toBe(true)
      expect(listener['evaluateCondition']({ type: 'session_count', operator: '==', value: 5 }, statistics, store)).toBe(true)
    })
  })

  describe('Feature Flag', () => {
    it('should block all logic when flag is OFF', () => {
      process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'false'
      listener.initialize('user123', mockEmitter)

      const statistics = {
        correctItems: 10,
        accuracy: 100,
        averageResponseTime: 2000,
        bestStreak: 15
      }

      const event = {
        data: {
          sessionId: 'test',
          statistics,
          duration: 60000
        }
      }

      listener['handleSessionCompleted'](event)

      // Should not award XP
      const store = useGamificationStore.getState()
      expect(store.totalXP).toBe(0)
      expect(store.currentStreak).toBe(0)
    })
  })
})
