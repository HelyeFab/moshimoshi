/**
 * UniversalProgressManager XP Tracking Test
 * Verifies the fix for XP tracking with correct sessionId
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { UniversalProgressManager } from '@/lib/review-engine/progress/UniversalProgressManager'

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

// Mock window.dispatchEvent
global.window = {
  dispatchEvent: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
} as any

describe('UniversalProgressManager XP Tracking', () => {
  let manager: UniversalProgressManager
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
    manager = new UniversalProgressManager()
    
    // Mock successful API response
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
      })
    } as Response)
  })

  it('should track XP with correct sessionId for review completion', async () => {
    // Setup a mock session with proper sessionId
    const mockSession = {
      sessionId: 'test-session-123', // This is the correct field name
      contentType: 'hiragana' as const,
      totalItems: 10,
      correctAnswers: 8,
      incorrectAnswers: 2,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString()
    }

    // Set the current session
    ;(manager as any).currentSession = mockSession

    // Track XP for review
    await manager.trackXPForReview('test-item', true, 1000)

    // Verify the API was called with correct sessionId
    expect(mockFetch).toHaveBeenCalledWith('/api/xp/track', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'review_completed',
        xpAmount: 10,
        contentType: 'hiragana',
        metadata: {
          itemId: 'test-item',
          correct: true,
          responseTime: 1000,
          sessionId: 'test-session-123' // Should use sessionId, not id
        }
      })
    }))
  })

  it('should track session completion XP with correct data', async () => {
    // Setup a mock session
    const mockSession = {
      sessionId: 'session-456',
      contentType: 'kanji' as const,
      totalItems: 20,
      correctAnswers: 18,
      incorrectAnswers: 2,
      startTime: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
      endTime: new Date().toISOString()
    }

    ;(manager as any).currentSession = mockSession

    // Track session completion
    await manager.trackSessionXP()

    // Verify the API was called correctly
    expect(mockFetch).toHaveBeenCalledWith('/api/xp/track', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        eventType: 'session_completed',
        xpAmount: expect.any(Number),
        contentType: 'kanji',
        metadata: {
          sessionId: 'session-456',
          totalItems: 20,
          correctAnswers: 18,
          accuracy: 90,
          duration: expect.any(Number)
        }
      })
    }))
  })

  it('should handle missing sessionId gracefully', async () => {
    // Don't set a current session
    ;(manager as any).currentSession = null

    // Try to track XP - should not throw
    await expect(
      manager.trackXPForReview('test-item', true, 1000)
    ).resolves.not.toThrow()

    // API should still be called but without sessionId
    expect(mockFetch).toHaveBeenCalledWith('/api/xp/track', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('review_completed')
    }))
  })

  it('should handle API errors gracefully', async () => {
    // Mock API error
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const mockSession = {
      sessionId: 'error-test',
      contentType: 'vocabulary' as const,
      totalItems: 5,
      correctAnswers: 3,
      incorrectAnswers: 2
    }

    ;(manager as any).currentSession = mockSession

    // Should not throw even on API error
    await expect(
      manager.trackXPForReview('test-item', false, 2000)
    ).resolves.not.toThrow()
  })

  it('should dispatch browser event on successful XP gain', async () => {
    const mockSession = {
      sessionId: 'event-test',
      contentType: 'katakana' as const,
      totalItems: 15,
      correctAnswers: 15,
      incorrectAnswers: 0
    }

    ;(manager as any).currentSession = mockSession

    await manager.trackXPForReview('test-item', true, 500)

    // Check that browser event was dispatched
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'xpGained',
        detail: expect.objectContaining({
          xpGained: 10,
          totalXP: 110,
          currentLevel: 2
        })
      })
    )
  })

  it('should use correct content type from session', async () => {
    // Test each content type
    const contentTypes = ['hiragana', 'katakana', 'kanji', 'vocabulary'] as const

    for (const contentType of contentTypes) {
      jest.clearAllMocks()
      
      const mockSession = {
        sessionId: `${contentType}-session`,
        contentType,
        totalItems: 10,
        correctAnswers: 10,
        incorrectAnswers: 0
      }

      ;(manager as any).currentSession = mockSession
      await manager.trackXPForReview('item', true, 1000)

      expect(mockFetch).toHaveBeenCalledWith('/api/xp/track', expect.objectContaining({
        body: expect.stringContaining(`"contentType":"${contentType}"`)
      }))
    }
  })
})
