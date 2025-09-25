/**
 * XP System Integration Tests
 * Test integration with UniversalProgressManager and review flow
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { UniversalProgressManager } from '@/lib/review-engine/progress/UniversalProgressManager'
import { ProgressEvent } from '@/lib/review-engine/core/progress.types'
import { reviewLogger } from '@/lib/monitoring/logger'

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

// Mock logger
jest.mock('@/lib/monitoring/logger', () => ({
  reviewLogger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}))

describe('XP System Integration with Review Engine', () => {
  let progressManager: UniversalProgressManager
  let mockUser: any
  let mockFetch: jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockClear()

    progressManager = new UniversalProgressManager()
    mockUser = {
      uid: 'test-user-123',
      email: 'test@example.com'
    }

    // Mock successful XP tracking response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          xpGained: 10,
          totalXP: 110,
          currentLevel: 2,
          leveledUp: false
        }
      }),
      text: async () => 'Success'
    } as Response)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Review Completion XP Tracking', () => {
    it('should track XP when review item is completed correctly', async () => {
      await progressManager.trackProgress(
        'hiragana',
        'hi-a',
        ProgressEvent.COMPLETED,
        mockUser,
        true,
        {
          correct: true,
          responseTime: 1500
        }
      )

      // Verify XP API was called
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/xp/track',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: expect.stringContaining('review_completed')
        })
      )

      // Verify correct XP calculation
      const callBody = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      )
      expect(callBody.amount).toBe(15) // 10 base + 5 speed bonus
      expect(callBody.metadata.correct).toBe(true)
      expect(callBody.metadata.responseTime).toBe(1500)
    })

    it('should track reduced XP for incorrect answers', async () => {
      await progressManager.trackProgress(
        'kanji',
        'kanji-123',
        ProgressEvent.COMPLETED,
        mockUser,
        true,
        {
          correct: false,
          responseTime: 3000
        }
      )

      const callBody = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      )
      expect(callBody.amount).toBe(4) // 3 base * 1.5 multiplier, rounded down
      expect(callBody.metadata.correct).toBe(false)
    })

    it('should apply content type multipliers correctly', async () => {
      // Test each content type
      const contentTypes = [
        { type: 'hiragana', multiplier: 1.0, expected: 10 },
        { type: 'katakana', multiplier: 1.0, expected: 10 },
        { type: 'kanji', multiplier: 1.5, expected: 15 },
        { type: 'vocabulary', multiplier: 1.2, expected: 12 },
        { type: 'sentence', multiplier: 2.0, expected: 20 }
      ]

      for (const content of contentTypes) {
        mockFetch.mockClear()

        await progressManager.trackProgress(
          content.type,
          'test-id',
          ProgressEvent.COMPLETED,
          mockUser,
          true,
          { correct: true, responseTime: 3000 } // No speed bonus
        )

        const callBody = JSON.parse(
          (mockFetch.mock.calls[0][1] as RequestInit).body as string
        )
        expect(callBody.amount).toBe(content.expected)
      }
    })

    it('should award speed bonus for fast responses', async () => {
      await progressManager.trackProgress(
        'hiragana',
        'hi-a',
        ProgressEvent.COMPLETED,
        mockUser,
        true,
        {
          correct: true,
          responseTime: 1000 // Under 2 seconds
        }
      )

      const callBody = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      )
      expect(callBody.amount).toBe(15) // 10 base + 5 speed bonus
    })

    it('should not award speed bonus for slow responses', async () => {
      await progressManager.trackProgress(
        'hiragana',
        'hi-a',
        ProgressEvent.COMPLETED,
        mockUser,
        true,
        {
          correct: true,
          responseTime: 5000 // Over 2 seconds
        }
      )

      const callBody = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      )
      expect(callBody.amount).toBe(10) // No speed bonus
    })

    it('should not track XP for non-completed events', async () => {
      await progressManager.trackProgress(
        'hiragana',
        'hi-a',
        ProgressEvent.VIEWED,
        mockUser,
        true
      )

      expect(mockFetch).not.toHaveBeenCalled()

      await progressManager.trackProgress(
        'hiragana',
        'hi-a',
        ProgressEvent.SKIPPED,
        mockUser,
        true
      )

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should include session ID in XP metadata', async () => {
      // Start a session
      await progressManager.startSession('test-session-1', 'kanji')

      await progressManager.trackProgress(
        'kanji',
        'kanji-1',
        ProgressEvent.COMPLETED,
        mockUser,
        true,
        { correct: true }
      )

      const callBody = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      )
      expect(callBody.metadata.sessionId).toBe('test-session-1')
    })

    it('should handle XP tracking failures gracefully', async () => {
      // Mock failed API call
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server error'
      } as Response)

      // Should not throw
      await expect(
        progressManager.trackProgress(
          'hiragana',
          'hi-a',
          ProgressEvent.COMPLETED,
          mockUser,
          true,
          { correct: true }
        )
      ).resolves.not.toThrow()

      // Should log error
      expect(reviewLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to track XP'),
        expect.anything()
      )
    })

    it('should dispatch browser event for XP gains', async () => {
      const mockDispatchEvent = jest.fn()
      global.window = { dispatchEvent: mockDispatchEvent } as any

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            xpGained: 15,
            totalXP: 265,
            currentLevel: 5,
            leveledUp: true
          }
        })
      } as Response)

      await progressManager.trackProgress(
        'kanji',
        'kanji-1',
        ProgressEvent.COMPLETED,
        mockUser,
        true,
        { correct: true, responseTime: 1500 }
      )

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'xpGained',
          detail: {
            xpGained: 15,
            totalXP: 265,
            leveledUp: true,
            newLevel: 5
          }
        })
      )

      delete (global as any).window
    })
  })

  describe('Session XP Tracking', () => {
    it('should track XP for completed sessions', async () => {
      const sessionSummary = {
        sessionId: 'session-123',
        userId: 'user-123',
        contentType: 'kanji',
        itemsCompleted: 10,
        stats: {
          accuracy: 80,
          duration: 300000,
          totalAnswered: 10,
          correct: 8,
          incorrect: 2
        }
      }

      await progressManager.trackSessionXP(sessionSummary as any)

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/xp/track',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('review_completed')
        })
      )

      const callBody = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      )
      expect(callBody.amount).toBe(60) // 10 items * 5 + 10 bonus for 80% accuracy
    })

    it('should award perfect session bonus', async () => {
      const perfectSession = {
        sessionId: 'session-perfect',
        userId: 'user-123',
        contentType: 'hiragana',
        itemsCompleted: 10,
        stats: {
          accuracy: 100,
          duration: 180000
        }
      }

      await progressManager.trackSessionXP(perfectSession as any)

      const callBody = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      )
      expect(callBody.eventType).toBe('perfect_session')
      expect(callBody.amount).toBe(100) // 10 items * 5 + 50 perfect bonus
    })

    it('should scale XP with session size', async () => {
      const largeSession = {
        sessionId: 'session-large',
        userId: 'user-123',
        contentType: 'vocabulary',
        itemsCompleted: 50,
        stats: {
          accuracy: 90,
          duration: 600000
        }
      }

      await progressManager.trackSessionXP(largeSession as any)

      const callBody = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      )
      expect(callBody.amount).toBe(275) // 50 items * 5 + 25 bonus for 90% accuracy
    })

    it('should not award bonus for small sessions', async () => {
      const smallSession = {
        sessionId: 'session-small',
        userId: 'user-123',
        contentType: 'katakana',
        itemsCompleted: 3,
        stats: {
          accuracy: 100,
          duration: 60000
        }
      }

      await progressManager.trackSessionXP(smallSession as any)

      const callBody = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      )
      expect(callBody.amount).toBe(15) // 3 items * 5, no bonus (needs 5+ items)
    })

    it('should handle session XP tracking failures gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server error'
      } as Response)

      const session = {
        sessionId: 'session-fail',
        userId: 'user-123',
        contentType: 'kanji',
        itemsCompleted: 10,
        stats: { accuracy: 80 }
      }

      // Should not throw
      await expect(
        progressManager.trackSessionXP(session as any)
      ).resolves.not.toThrow()

      expect(reviewLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to track session XP'),
        expect.anything()
      )
    })

    it('should skip XP tracking for empty sessions', async () => {
      await progressManager.trackSessionXP(null as any)
      expect(mockFetch).not.toHaveBeenCalled()

      await progressManager.trackSessionXP({} as any)
      expect(mockFetch).not.toHaveBeenCalled()

      await progressManager.trackSessionXP({
        sessionId: 'empty',
        itemsCompleted: 0
      } as any)
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(
        progressManager.trackProgress(
          'hiragana',
          'hi-a',
          ProgressEvent.COMPLETED,
          mockUser,
          true,
          { correct: true }
        )
      ).resolves.not.toThrow()

      expect(reviewLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error tracking XP'),
        expect.any(Error)
      )
    })

    it('should handle malformed API responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON') }
      } as Response)

      await expect(
        progressManager.trackProgress(
          'hiragana',
          'hi-a',
          ProgressEvent.COMPLETED,
          mockUser,
          true,
          { correct: true }
        )
      ).resolves.not.toThrow()
    })

    it('should default to correct=true if not specified', async () => {
      await progressManager.trackProgress(
        'hiragana',
        'hi-a',
        ProgressEvent.COMPLETED,
        mockUser,
        true,
        {} // No correct field
      )

      const callBody = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      )
      expect(callBody.amount).toBe(10) // Should get full XP
      expect(callBody.metadata.correct).toBe(true)
    })

    it('should handle undefined metadata gracefully', async () => {
      await progressManager.trackProgress(
        'hiragana',
        'hi-a',
        ProgressEvent.COMPLETED,
        mockUser,
        true,
        undefined
      )

      expect(mockFetch).toHaveBeenCalled()
      const callBody = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      )
      expect(callBody.amount).toBe(10) // Default XP
    })

    it('should handle unknown content types', async () => {
      await progressManager.trackProgress(
        'unknown-type',
        'unknown-id',
        ProgressEvent.COMPLETED,
        mockUser,
        true,
        { correct: true }
      )

      const callBody = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      )
      expect(callBody.amount).toBe(10) // Default multiplier of 1.0
    })
  })
})