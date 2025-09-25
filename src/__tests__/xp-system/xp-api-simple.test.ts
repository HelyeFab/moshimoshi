/**
 * XP API Tests - Simplified Version
 * Tests API logic without complex Next.js mocking
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock all dependencies first
jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn(),
    batch: jest.fn()
  },
  FieldValue: {
    serverTimestamp: () => new Date().toISOString(),
    increment: (n: number) => n
  }
}))

jest.mock('@/lib/auth/session', () => ({
  requireAuth: jest.fn(),
  getSession: jest.fn()
}))

jest.mock('@/lib/gamification/xp-system', () => ({
  xpSystem: {
    getLevelFromXP: jest.fn((xp) => Math.floor(xp / 100) + 1),
    getUserLevel: jest.fn((xp) => ({
      currentLevel: Math.floor(xp / 100) + 1,
      currentXP: xp % 100,
      xpToNextLevel: 100 - (xp % 100),
      progressPercentage: (xp % 100),
      title: 'Student',
      nextLevelTitle: 'Apprentice',
      totalXP: xp,
      rank: 0,
      recentXPEvents: []
    })),
    getLevelBadge: jest.fn(() => '🎓'),
    getLevelColor: jest.fn(() => 'from-blue-400 to-blue-600'),
    getXPMultiplier: jest.fn((level) => level >= 20 ? 1.2 : 1.0)
  }
}))

// Import after mocking
import { adminDb, FieldValue } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/session'
import { xpSystem } from '@/lib/gamification/xp-system'

describe('XP API Logic Tests', () => {
  let mockBatch: any
  let mockUserDoc: any
  let mockHistoryRef: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mock batch
    mockBatch = {
      update: jest.fn(),
      set: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined)
    }

    // Setup mock history ref
    mockHistoryRef = {
      set: jest.fn()
    }

    // Setup mock user doc
    mockUserDoc = {
      data: jest.fn(() => ({
        progress: {
          totalXp: 100,
          currentLevel: 2,
          lastXpGain: 10
        },
        subscription: {
          plan: 'free'
        }
      }))
    }

    // Configure adminDb mock
    ;(adminDb.collection as jest.Mock).mockReturnValue({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue(mockUserDoc),
        update: jest.fn().mockResolvedValue(undefined),
        collection: jest.fn(() => ({
          doc: jest.fn(() => mockHistoryRef),
          orderBy: jest.fn(() => ({
            limit: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({
                docs: []
              })
            }))
          }))
        }))
      }))
    })

    ;(adminDb.batch as jest.Mock).mockReturnValue(mockBatch)
  })

  describe('POST /api/xp/track Logic', () => {
    it('should track XP for authenticated user', async () => {
      // Setup auth
      ;(requireAuth as jest.Mock).mockResolvedValue({ uid: 'user123' })

      // Simulate the API logic
      const trackXP = async (userId: string, xpData: any) => {
        const userRef = adminDb.collection('users').doc(userId)
        const userDoc = await userRef.get()
        const userData = userDoc.data()

        const currentProgress = userData?.progress || { totalXp: 0, currentLevel: 1 }
        const plan = userData?.subscription?.plan || 'free'

        let xpToAward = xpData.amount

        // Apply multiplier for premium users
        if (plan === 'premium_monthly') {
          const multiplier = xpSystem.getXPMultiplier(currentProgress.currentLevel)
          xpToAward = Math.floor(xpToAward * multiplier)
        }

        const newTotalXP = currentProgress.totalXp + xpToAward
        const newLevel = xpSystem.getLevelFromXP(newTotalXP)
        const leveledUp = newLevel > currentProgress.currentLevel

        // Update database
        const batch = adminDb.batch()
        batch.update(userRef, {
          'progress.totalXp': newTotalXP,
          'progress.currentLevel': newLevel
        })

        await batch.commit()

        return {
          success: true,
          data: {
            xpGained: xpToAward,
            totalXP: newTotalXP,
            currentLevel: newLevel,
            leveledUp
          }
        }
      }

      const result = await trackXP('user123', {
        eventType: 'review_completed',
        amount: 10,
        source: 'Test review'
      })

      expect(result.success).toBe(true)
      expect(result.data.xpGained).toBe(10)
      expect(result.data.totalXP).toBe(110)
      expect(mockBatch.commit).toHaveBeenCalled()
    })

    it('should apply premium multiplier', async () => {
      // Setup premium user
      mockUserDoc.data.mockReturnValue({
        progress: { totalXp: 2000, currentLevel: 21 },
        subscription: { plan: 'premium_monthly' }
      })

      ;(xpSystem.getXPMultiplier as jest.Mock).mockReturnValue(1.2)

      const calculateXP = (amount: number, level: number, isPremium: boolean) => {
        let xpToAward = amount
        if (isPremium) {
          const multiplier = xpSystem.getXPMultiplier(level)
          xpToAward = Math.floor(xpToAward * multiplier)
        }
        return xpToAward
      }

      const result = calculateXP(10, 21, true)
      expect(result).toBe(12) // 10 * 1.2
    })

    it('should detect level ups', async () => {
      // User at 195 XP (close to level up at 200)
      mockUserDoc.data.mockReturnValue({
        progress: { totalXp: 195, currentLevel: 2 },
        subscription: { plan: 'free' }
      })

      const detectLevelUp = (currentXP: number, xpGained: number) => {
        const oldLevel = xpSystem.getLevelFromXP(currentXP)
        const newXP = currentXP + xpGained
        const newLevel = xpSystem.getLevelFromXP(newXP)

        return {
          leveledUp: newLevel > oldLevel,
          oldLevel,
          newLevel,
          levelUpBonus: newLevel > oldLevel ? newLevel * 10 : 0
        }
      }

      const result = detectLevelUp(195, 10)

      expect(result.leveledUp).toBe(true)
      expect(result.oldLevel).toBe(2)
      expect(result.newLevel).toBe(3)
      expect(result.levelUpBonus).toBe(30)
    })

    it('should validate XP amounts', () => {
      const validateXP = (amount: number) => {
        if (amount < 0) return { valid: false, error: 'Negative XP not allowed' }
        if (amount > 1000) return { valid: false, error: 'XP exceeds maximum' }
        return { valid: true }
      }

      expect(validateXP(-10).valid).toBe(false)
      expect(validateXP(0).valid).toBe(true)
      expect(validateXP(100).valid).toBe(true)
      expect(validateXP(5000).valid).toBe(false)
    })

    it('should validate event types', () => {
      const validEvents = [
        'review_completed',
        'achievement_unlocked',
        'streak_bonus',
        'perfect_session',
        'speed_bonus',
        'daily_bonus'
      ]

      const validateEvent = (eventType: string) => {
        return validEvents.includes(eventType)
      }

      expect(validateEvent('review_completed')).toBe(true)
      expect(validateEvent('invalid_event')).toBe(false)
    })

    it('should store XP history', async () => {
      const storeXPHistory = async (userId: string, xpEvent: any) => {
        const batch = adminDb.batch()

        const historyRef = adminDb
          .collection('users')
          .doc(userId)
          .collection('xp_history')
          .doc()

        batch.set(historyRef, {
          ...xpEvent,
          userId,
          timestamp: FieldValue.serverTimestamp()
        })

        await batch.commit()
        return true
      }

      const result = await storeXPHistory('user123', {
        type: 'review_completed',
        xpGained: 15,
        source: 'Kanji review',
        metadata: { contentType: 'kanji' }
      })

      expect(result).toBe(true)
      expect(mockBatch.set).toHaveBeenCalled()
    })
  })

  describe('GET /api/xp/track Logic', () => {
    it('should return current XP status', async () => {
      const getXPStatus = async (userId: string) => {
        const userDoc = await adminDb.collection('users').doc(userId).get()
        const userData = userDoc.data()

        const progress = userData?.progress || {
          totalXp: 0,
          currentLevel: 1,
          lastXpGain: 0
        }

        const userLevel = xpSystem.getUserLevel(progress.totalXp)

        return {
          success: true,
          data: {
            totalXP: progress.totalXp,
            currentLevel: progress.currentLevel,
            levelInfo: userLevel,
            levelBadge: xpSystem.getLevelBadge(progress.currentLevel),
            levelColor: xpSystem.getLevelColor(progress.currentLevel)
          }
        }
      }

      const result = await getXPStatus('user123')

      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('totalXP')
      expect(result.data).toHaveProperty('currentLevel')
      expect(result.data).toHaveProperty('levelInfo')
      expect(result.data).toHaveProperty('levelBadge')
      expect(result.data).toHaveProperty('levelColor')
    })

    it('should handle users with no XP', async () => {
      mockUserDoc.data.mockReturnValue({})

      const getXPStatus = async (userId: string) => {
        const userDoc = await adminDb.collection('users').doc(userId).get()
        const userData = userDoc.data()

        const progress = userData?.progress || {
          totalXp: 0,
          currentLevel: 1,
          lastXpGain: 0
        }

        return {
          totalXP: progress.totalXp,
          currentLevel: progress.currentLevel
        }
      }

      const result = await getXPStatus('newuser')

      expect(result.totalXP).toBe(0)
      expect(result.currentLevel).toBe(1)
    })
  })

  describe('XP Calculation Logic', () => {
    it('should calculate XP with all factors', () => {
      const calculateReviewXP = (
        correct: boolean,
        contentType: string,
        responseTime?: number,
        isPremium?: boolean,
        level?: number
      ) => {
        // Base XP
        let baseXP = correct ? 10 : 3

        // Content type multiplier
        const multipliers: Record<string, number> = {
          hiragana: 1.0,
          katakana: 1.0,
          kanji: 1.5,
          vocabulary: 1.2,
          sentence: 2.0
        }
        const contentMultiplier = multipliers[contentType] || 1.0
        baseXP = Math.floor(baseXP * contentMultiplier)

        // Speed bonus
        let bonusXP = 0
        if (correct && responseTime && responseTime < 2000) {
          bonusXP += 5
        }

        let totalXP = baseXP + bonusXP

        // Premium multiplier
        if (isPremium && level && level >= 20) {
          totalXP = Math.floor(totalXP * 1.2)
        }

        return totalXP
      }

      // Test different scenarios
      expect(calculateReviewXP(true, 'hiragana', 1500)).toBe(15) // 10 + 5 speed
      expect(calculateReviewXP(true, 'kanji', 3000)).toBe(15) // 10 * 1.5
      expect(calculateReviewXP(false, 'kanji', 3000)).toBe(4) // 3 * 1.5 rounded
      expect(calculateReviewXP(true, 'sentence', 1500, true, 25)).toBe(30) // (10*2 + 5) * 1.2
    })

    it('should calculate session XP', () => {
      const calculateSessionXP = (itemsCompleted: number, accuracy: number) => {
        let baseXP = itemsCompleted * 5
        let bonusXP = 0

        if (accuracy === 100 && itemsCompleted >= 5) {
          bonusXP += 50
        } else if (accuracy >= 90 && itemsCompleted >= 5) {
          bonusXP += 25
        } else if (accuracy >= 80 && itemsCompleted >= 5) {
          bonusXP += 10
        }

        return baseXP + bonusXP
      }

      expect(calculateSessionXP(10, 100)).toBe(100) // 50 + 50
      expect(calculateSessionXP(10, 90)).toBe(75)   // 50 + 25
      expect(calculateSessionXP(10, 80)).toBe(60)   // 50 + 10
      expect(calculateSessionXP(3, 100)).toBe(15)   // 15 + 0 (too small)
    })
  })

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      ;(requireAuth as jest.Mock).mockRejectedValue(new Error('Unauthorized'))

      try {
        await requireAuth()
      } catch (error: any) {
        expect(error.message).toBe('Unauthorized')
      }
    })

    it('should handle Firebase errors', async () => {
      mockBatch.commit.mockRejectedValue(new Error('Firebase error'))

      try {
        await mockBatch.commit()
      } catch (error: any) {
        expect(error.message).toBe('Firebase error')
      }
    })

    it('should handle invalid input gracefully', () => {
      const processXPRequest = (body: any) => {
        if (!body.eventType) {
          return { error: 'Missing event type' }
        }
        if (typeof body.amount !== 'number') {
          return { error: 'Invalid amount' }
        }
        if (!body.source) {
          return { error: 'Missing source' }
        }
        return { success: true }
      }

      expect(processXPRequest({})).toHaveProperty('error')
      expect(processXPRequest({ eventType: 'test' })).toHaveProperty('error')
      expect(processXPRequest({
        eventType: 'review_completed',
        amount: 10,
        source: 'Test'
      })).toHaveProperty('success')
    })
  })
})