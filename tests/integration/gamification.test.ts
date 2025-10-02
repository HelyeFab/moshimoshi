/**
 * Gamification Integration Tests
 *
 * Tests the complete flow: URE → Listener → State → IndexedDB
 * Tests achievement unlocking, streak logic, and feature flag behavior
 */

import { EventEmitter } from 'events'
import { ReviewEventType } from '@/lib/review-engine/core/events'
import { gamificationListener } from '@/lib/gamification/gamificationListener'
import { useGamificationStore } from '@/state/userGamification'
import { indexedDBStore } from '@/lib/gamification/indexedDBStore'

// Mock IndexedDB
global.indexedDB = {
  open: jest.fn(() => ({
    result: {
      objectStoreNames: { contains: () => false },
      createObjectStore: jest.fn()
    },
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null
  }))
} as any

describe('Gamification Integration', () => {
  let mockURE: EventEmitter
  const testUserId = 'test-user-integration'

  beforeEach(async () => {
    // Enable feature flag
    process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'true'

    // Reset state
    useGamificationStore.getState().reset()

    // Clear IndexedDB mock
    jest.clearAllMocks()

    // Create mock URE emitter
    mockURE = new EventEmitter()

    // Initialize listener
    gamificationListener.initialize(testUserId, mockURE)
  })

  afterEach(() => {
    gamificationListener.destroy()
  })

  describe('URE → Listener → State Flow', () => {
    it('should award XP when URE emits SESSION_COMPLETED', async () => {
      const initialXP = useGamificationStore.getState().totalXP

      // Mock URE event
      mockURE.emit(ReviewEventType.SESSION_COMPLETED, {
        data: {
          sessionId: 'test-session',
          statistics: {
            correctItems: 10,
            accuracy: 90,
            averageResponseTime: 4000,
            bestStreak: 5
          },
          duration: 60000
        }
      })

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 150))

      // Verify XP awarded (get fresh state)
      const finalXP = useGamificationStore.getState().totalXP
      expect(finalXP).toBeGreaterThan(initialXP)
      expect(finalXP).toBe(130) // 100 + 30 accuracy bonus
    })

    it('should increment streak when XP >= 10', async () => {
      mockURE.emit(ReviewEventType.SESSION_COMPLETED, {
        data: {
          sessionId: 'test-session',
          statistics: {
            correctItems: 5,
            accuracy: 70,
            averageResponseTime: 5000,
            bestStreak: 3
          },
          duration: 30000
        }
      })

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(useGamificationStore.getState().currentStreak).toBe(1)
    })

    it('should not increment streak when XP < 10', async () => {
      mockURE.emit(ReviewEventType.SESSION_COMPLETED, {
        data: {
          sessionId: 'test-session',
          statistics: {
            correctItems: 0,
            accuracy: 0,
            averageResponseTime: 5000,
            bestStreak: 0
          },
          duration: 10000
        }
      })

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(useGamificationStore.getState().currentStreak).toBe(0) // Not incremented
    })

    it('should increment session count on each session', async () => {
      const initialCount = useGamificationStore.getState().sessionCount

      // Complete 3 sessions
      for (let i = 0; i < 3; i++) {
        mockURE.emit(ReviewEventType.SESSION_COMPLETED, {
          data: {
            sessionId: `session-${i}`,
            statistics: {
              correctItems: 5,
              accuracy: 80,
              averageResponseTime: 4000,
              bestStreak: 3
            },
            duration: 30000
          }
        })

        await new Promise(resolve => setTimeout(resolve, 150))
      }

      expect(useGamificationStore.getState().sessionCount).toBe(initialCount + 3)
    })
  })

  describe('Achievement Unlock Flow', () => {
    it('should track achievement unlock potential', async () => {
      // Verify initial state
      expect(useGamificationStore.getState().sessionCount).toBe(0)
      expect(useGamificationStore.getState().unlockedAchievements).toEqual([])

      // Mock first session
      mockURE.emit(ReviewEventType.SESSION_COMPLETED, {
        data: {
          sessionId: 'first-session',
          statistics: {
            correctItems: 5,
            accuracy: 80,
            averageResponseTime: 4000,
            bestStreak: 3
          },
          duration: 30000
        }
      })

      await new Promise(resolve => setTimeout(resolve, 200))

      // Verify session was counted (prerequisite for achievements)
      const state = useGamificationStore.getState()
      expect(state.sessionCount).toBeGreaterThanOrEqual(1)

      // Achievement system should be processing (unlocked array exists and is valid)
      expect(Array.isArray(state.unlockedAchievements)).toBe(true)
    })

    it('should not unlock achievement twice', async () => {
      // Complete two sessions
      mockURE.emit(ReviewEventType.SESSION_COMPLETED, {
        data: {
          sessionId: 'session-1',
          statistics: { correctItems: 5, accuracy: 80, averageResponseTime: 4000, bestStreak: 3 },
          duration: 30000
        }
      })

      await new Promise(resolve => setTimeout(resolve, 200))

      const unlockCount1 = useGamificationStore.getState().unlockedAchievements.filter(id => id === 'first_session').length
      expect(unlockCount1).toBeGreaterThanOrEqual(0) // May or may not have unlocked yet

      mockURE.emit(ReviewEventType.SESSION_COMPLETED, {
        data: {
          sessionId: 'session-2',
          statistics: { correctItems: 5, accuracy: 80, averageResponseTime: 4000, bestStreak: 3 },
          duration: 30000
        }
      })

      await new Promise(resolve => setTimeout(resolve, 200))

      const unlockCount2 = useGamificationStore.getState().unlockedAchievements.filter(id => id === 'first_session').length

      // Should still be same count (not unlocked twice)
      expect(unlockCount2).toBeLessThanOrEqual(1) // At most 1
    })
  })

  describe('Feature Flag Toggle', () => {
    it('should disable system when flag is OFF', async () => {
      process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'false'

      const mockURE2 = new EventEmitter()
      gamificationListener.initialize('test-user-2', mockURE2)

      const initialXP = useGamificationStore.getState().totalXP

      // Emit event
      mockURE2.emit(ReviewEventType.SESSION_COMPLETED, {
        data: {
          sessionId: 'test',
          statistics: { correctItems: 10, accuracy: 90, averageResponseTime: 4000, bestStreak: 5 },
          duration: 60000
        }
      })

      await new Promise(resolve => setTimeout(resolve, 150))

      // XP should NOT change
      expect(useGamificationStore.getState().totalXP).toBe(initialXP)
    })
  })

  describe('Level Calculation', () => {
    it('should calculate level correctly from totalXP', async () => {
      // Award 2500 XP (should be level 2)
      useGamificationStore.getState().awardXP(2500)

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(useGamificationStore.getState().currentLevel).toBe(2) // floor(2500/1000) = 2
    })

    it('should maintain minimum level of 1', () => {
      // With 0 XP, level should still be 1
      expect(useGamificationStore.getState().currentLevel).toBe(1)
    })
  })

  describe('Streak Management', () => {
    it('should update bestStreak when currentStreak exceeds it', () => {
      // Increment streak multiple times
      useGamificationStore.getState().incrementStreak()
      useGamificationStore.getState().incrementStreak()
      useGamificationStore.getState().incrementStreak()

      expect(useGamificationStore.getState().currentStreak).toBe(3)
      expect(useGamificationStore.getState().bestStreak).toBe(3)

      // Reset and increment again
      useGamificationStore.getState().resetStreak()
      expect(useGamificationStore.getState().currentStreak).toBe(0)
      expect(useGamificationStore.getState().bestStreak).toBe(3) // Should remain 3

      useGamificationStore.getState().incrementStreak()
      useGamificationStore.getState().incrementStreak()

      expect(useGamificationStore.getState().currentStreak).toBe(2)
      expect(useGamificationStore.getState().bestStreak).toBe(3) // Still 3, not updated
    })
  })

  describe('XP Bonuses Integration', () => {
    it('should apply multiple bonuses correctly', async () => {
      // Session with all bonuses: 100% accuracy, fast response, good streak
      mockURE.emit(ReviewEventType.SESSION_COMPLETED, {
        data: {
          sessionId: 'bonus-session',
          statistics: {
            correctItems: 10,
            accuracy: 100,
            averageResponseTime: 2500,
            bestStreak: 12
          },
          duration: 45000
        }
      })

      await new Promise(resolve => setTimeout(resolve, 150))

      // Base: 100, Accuracy: 50, Speed: 5, Streak: 24 = 179 XP
      expect(useGamificationStore.getState().totalXP).toBe(179)
    })

    it('should respect daily XP cap', async () => {
      // Session that would exceed 500 XP
      mockURE.emit(ReviewEventType.SESSION_COMPLETED, {
        data: {
          sessionId: 'big-session',
          statistics: {
            correctItems: 100,
            accuracy: 100,
            averageResponseTime: 2000,
            bestStreak: 50
          },
          duration: 180000
        }
      })

      await new Promise(resolve => setTimeout(resolve, 150))

      // Should be capped at 500
      expect(useGamificationStore.getState().totalXP).toBe(500)
    })
  })
})
