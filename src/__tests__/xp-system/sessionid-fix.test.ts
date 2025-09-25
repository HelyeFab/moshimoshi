/**
 * Test specifically for the sessionId fix in UniversalProgressManager
 * This verifies that the bug where `this.currentSession?.id` was used instead of
 * `this.currentSession?.sessionId` has been fixed.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

describe('SessionId Fix Verification', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { xpGained: 10 } })
    } as Response)
  })

  it('should use sessionId (not id) when tracking XP', async () => {
    // Import after setting up mocks
    const { UniversalProgressManager } = await import('@/lib/review-engine/progress/UniversalProgressManager')
    const manager = new UniversalProgressManager()

    // Create a session with sessionId (correct) but no id property
    const mockSession = {
      sessionId: 'correct-session-id-123',  // This is what should be used
      // Note: no 'id' property - this was the bug
      contentType: 'hiragana' as const,
      totalItems: 10,
      correctAnswers: 8,
      incorrectAnswers: 2,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString()
    }

    // Set the current session
    ;(manager as any).currentSession = mockSession

    // Call trackXPForReview
    await manager.trackXPForReview('user123', 'hiragana', 'item-1', {
      correct: true,
      responseTime: 1000
    })

    // Verify the API was called
    expect(mockFetch).toHaveBeenCalled()

    // Get the actual call
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/xp/track')

    // Parse the body to check sessionId
    const body = JSON.parse(options.body as string)
    
    // CRITICAL: Verify sessionId is correctly included
    expect(body.metadata.sessionId).toBe('correct-session-id-123')
    
    // Verify it's not undefined (which would happen with the old bug)
    expect(body.metadata.sessionId).not.toBeUndefined()
  })

  it('should handle session with both id and sessionId correctly', async () => {
    const { UniversalProgressManager } = await import('@/lib/review-engine/progress/UniversalProgressManager')
    const manager = new UniversalProgressManager()

    // Create a session with both id and sessionId
    const mockSession = {
      id: 'wrong-id-456',  // This should NOT be used
      sessionId: 'correct-session-789',  // This SHOULD be used
      contentType: 'kanji' as const,
      totalItems: 5,
      correctAnswers: 5,
      incorrectAnswers: 0
    } as any

    ;(manager as any).currentSession = mockSession

    await manager.trackXPForReview('user123', 'kanji', 'kanji-1', {
      correct: true,
      responseTime: 2000
    })

    const [, options] = mockFetch.mock.calls[0]
    const body = JSON.parse(options.body as string)
    
    // Should use sessionId, NOT id
    expect(body.metadata.sessionId).toBe('correct-session-789')
    expect(body.metadata.sessionId).not.toBe('wrong-id-456')
  })

  it('should not crash when sessionId is missing', async () => {
    const { UniversalProgressManager } = await import('@/lib/review-engine/progress/UniversalProgressManager')
    const manager = new UniversalProgressManager()

    // Session without sessionId
    const mockSession = {
      contentType: 'vocabulary' as const,
      totalItems: 3,
      correctAnswers: 2,
      incorrectAnswers: 1
    } as any

    ;(manager as any).currentSession = mockSession

    // Should not throw
    await expect(
      manager.trackXPForReview('user123', 'vocabulary', 'word-1', {
        correct: false,
        responseTime: 3000
      })
    ).resolves.not.toThrow()

    // API should still be called
    expect(mockFetch).toHaveBeenCalled()
    
    const [, options] = mockFetch.mock.calls[0]
    const body = JSON.parse(options.body as string)
    
    // sessionId should be undefined but not cause error
    expect(body.metadata.sessionId).toBeUndefined()
  })

  it('should track session completion with correct sessionId', async () => {
    const { UniversalProgressManager } = await import('@/lib/review-engine/progress/UniversalProgressManager')
    const manager = new UniversalProgressManager()

    // Create session summary
    const sessionSummary = {
      sessionId: 'session-completion-123',
      userId: 'user123',
      contentType: 'kanji',
      itemsCompleted: 10,
      stats: {
        accuracy: 90,
        duration: 600000
      }
    }

    await manager.trackSessionXP(sessionSummary as any)

    expect(mockFetch).toHaveBeenCalled()
    
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/xp/track')
    
    const body = JSON.parse(options.body as string)
    
    // Verify sessionId is passed correctly
    expect(body.metadata.sessionId).toBe('session-completion-123')
    expect(body.eventType).toBe('review_completed')
    expect(body.metadata.accuracy).toBe(90)
  })
})
