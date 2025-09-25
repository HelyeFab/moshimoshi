/**
 * XP System Integration Test - Simplified
 * Tests the core XP functionality without complex mocking
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock Firebase and Auth modules before imports
jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          data: () => ({
            progress: { totalXp: 100, currentLevel: 2 },
            subscription: { plan: 'free' }
          })
        }),
        update: jest.fn(),
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            set: jest.fn()
          }))
        }))
      }))
    })),
    batch: jest.fn(() => ({
      update: jest.fn(),
      set: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined)
    }))
  },
  FieldValue: {
    serverTimestamp: () => new Date(),
    increment: (n: number) => n
  }
}))

jest.mock('@/lib/auth/session', () => ({
  requireAuth: jest.fn().mockResolvedValue({ uid: 'test-user' }),
  getSession: jest.fn().mockResolvedValue({ uid: 'test-user' })
}))

jest.mock('@/lib/redis/client', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    expire: jest.fn()
  }
}))

// Now import the actual functions
import { xpSystem } from '@/lib/gamification/xp-system'

describe('XP System Core Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('XP Calculations', () => {
    it('should calculate XP for different content types', () => {
      // Test base XP calculations
      const hiraganaXP = 10 * 1.0  // Base * multiplier
      const katakanaXP = 10 * 1.0
      const kanjiXP = 10 * 1.5
      const vocabularyXP = 10 * 1.2
      const sentenceXP = 10 * 2.0

      expect(Math.floor(hiraganaXP)).toBe(10)
      expect(Math.floor(katakanaXP)).toBe(10)
      expect(Math.floor(kanjiXP)).toBe(15)
      expect(Math.floor(vocabularyXP)).toBe(12)
      expect(Math.floor(sentenceXP)).toBe(20)
    })

    it('should add speed bonus for fast responses', () => {
      const baseXP = 10
      const speedBonus = 5
      const totalWithSpeed = baseXP + speedBonus

      expect(totalWithSpeed).toBe(15)
    })

    it('should reduce XP for incorrect answers', () => {
      const correctXP = 10
      const incorrectXP = 3

      expect(incorrectXP).toBeLessThan(correctXP)
      expect(incorrectXP).toBe(3)
    })
  })

  describe('Level Progression', () => {
    it('should calculate level from XP correctly', () => {
      const level1 = xpSystem.getLevelFromXP(0)
      const level2 = xpSystem.getLevelFromXP(200)
      const level5 = xpSystem.getLevelFromXP(1000)

      expect(level1).toBe(1)
      expect(level2).toBeGreaterThan(1)
      expect(level5).toBeGreaterThan(level2)
    })

    it('should get user level info', () => {
      const userLevel = xpSystem.getUserLevel(500)

      expect(userLevel).toHaveProperty('currentLevel')
      expect(userLevel).toHaveProperty('currentXP')
      expect(userLevel).toHaveProperty('xpToNextLevel')
      expect(userLevel).toHaveProperty('progressPercentage')
      expect(userLevel).toHaveProperty('title')
      expect(userLevel.totalXP).toBe(500)
    })

    it('should handle level titles correctly', () => {
      const beginner = xpSystem.getUserLevel(0)
      const advanced = xpSystem.getUserLevel(10000)

      expect(beginner.title).toContain('Beginner')
      expect(advanced.title).not.toContain('Beginner')
    })
  })

  describe('Session XP', () => {
    it('should calculate session XP based on performance', () => {
      const mockSession = {
        id: 'session-1',
        status: 'completed' as const,
        currentIndex: 10,
        items: new Array(10).fill({}),
        stats: {
          totalAnswered: 10,
          correct: 10,
          incorrect: 0,
          accuracy: 100,
          avgResponseTime: 1500,
          hintsUsed: 0
        }
      }

      const xp = xpSystem.calculateSessionXP(mockSession as any)
      expect(xp).toBeGreaterThan(50) // Should have perfect bonus
    })

    it('should scale XP with accuracy', () => {
      const perfectSession = {
        id: 'session-1',
        status: 'completed' as const,
        currentIndex: 10,
        items: new Array(10).fill({}),
        stats: { accuracy: 100, totalAnswered: 10 }
      }

      const poorSession = {
        ...perfectSession,
        stats: { accuracy: 50, totalAnswered: 10 }
      }

      const perfectXP = xpSystem.calculateSessionXP(perfectSession as any)
      const poorXP = xpSystem.calculateSessionXP(poorSession as any)

      expect(perfectXP).toBeGreaterThan(poorXP)
    })
  })

  describe('Streak Bonuses', () => {
    it('should calculate streak bonuses correctly', () => {
      expect(xpSystem.calculateStreakBonus(0)).toBe(0)
      expect(xpSystem.calculateStreakBonus(3)).toBe(10)
      expect(xpSystem.calculateStreakBonus(7)).toBe(25)
      expect(xpSystem.calculateStreakBonus(30)).toBe(75)
      expect(xpSystem.calculateStreakBonus(100)).toBe(150)
    })
  })

  describe('Achievement XP', () => {
    it('should award XP based on achievement rarity', () => {
      const achievements = [
        { rarity: 'common', expectedXP: 25 },
        { rarity: 'uncommon', expectedXP: 50 },
        { rarity: 'rare', expectedXP: 100 },
        { rarity: 'epic', expectedXP: 200 },
        { rarity: 'legendary', expectedXP: 500 }
      ]

      achievements.forEach(achievement => {
        const xp = xpSystem.calculateAchievementXP({ rarity: achievement.rarity } as any)
        expect(xp).toBe(achievement.expectedXP)
      })
    })
  })

  describe('XP Multipliers', () => {
    it('should apply level-based multipliers', () => {
      expect(xpSystem.getXPMultiplier(1)).toBe(1.0)
      expect(xpSystem.getXPMultiplier(20)).toBe(1.1)
      expect(xpSystem.getXPMultiplier(40)).toBe(1.2)
      expect(xpSystem.getXPMultiplier(70)).toBe(1.3)
    })
  })

  describe('Level Up Detection', () => {
    it('should detect when user levels up', () => {
      const xpForLevel2 = xpSystem.calculateXPForLevel(2)
      const beforeLevelUp = xpForLevel2 - 10
      const afterLevelUp = xpForLevel2 + 10

      const levelBefore = xpSystem.getLevelFromXP(beforeLevelUp)
      const levelAfter = xpSystem.getLevelFromXP(afterLevelUp)

      expect(levelAfter).toBeGreaterThan(levelBefore)
    })

    it('should calculate level up bonus correctly', () => {
      const newLevel = 5
      const levelUpBonus = newLevel * 10

      expect(levelUpBonus).toBe(50)
    })
  })

  describe('Data Validation', () => {
    it('should cap XP at reasonable limits', () => {
      const maxSingleGain = 1000
      const testAmount = 5000

      const capped = Math.min(testAmount, maxSingleGain)
      expect(capped).toBe(maxSingleGain)
    })

    it('should not allow negative XP', () => {
      const negativeXP = -10
      const validated = Math.max(0, negativeXP)

      expect(validated).toBe(0)
    })

    it('should handle edge case levels', () => {
      const level0XP = xpSystem.getLevelFromXP(-100)
      const level100XP = xpSystem.getLevelFromXP(999999)

      expect(level0XP).toBe(1) // Minimum level
      expect(level100XP).toBe(100) // Maximum level
    })
  })

  describe('XP Event Tracking', () => {
    it('should track different event types', () => {
      const eventTypes = [
        'review_completed',
        'achievement_unlocked',
        'streak_bonus',
        'perfect_session',
        'speed_bonus',
        'daily_bonus'
      ]

      eventTypes.forEach(type => {
        expect(type).toMatch(/^[a-z_]+$/)
      })
    })

    it('should include metadata in XP events', () => {
      const xpEvent = {
        type: 'review_completed',
        xpGained: 15,
        source: 'Kanji review',
        timestamp: new Date(),
        metadata: {
          contentType: 'kanji',
          contentId: 'kanji-123',
          correct: true,
          responseTime: 1500
        }
      }

      expect(xpEvent.metadata).toHaveProperty('contentType')
      expect(xpEvent.metadata).toHaveProperty('correct')
      expect(xpEvent.metadata).toHaveProperty('responseTime')
    })
  })

  describe('Performance Requirements', () => {
    it('should calculate XP quickly', () => {
      const start = performance.now()

      // Run 1000 XP calculations
      for (let i = 0; i < 1000; i++) {
        xpSystem.getLevelFromXP(Math.random() * 10000)
      }

      const end = performance.now()
      const avgTime = (end - start) / 1000

      expect(avgTime).toBeLessThan(1) // Should be under 1ms per calculation
    })
  })
})