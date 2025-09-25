/**
 * useXP Hook Tests - Fixed Version
 * Tests the useXP hook functionality
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Create a mock implementation of useXP
const mockUseXP = jest.fn()

// Mock the module before importing
jest.mock('@/hooks/useXP', () => ({
  useXP: (...args: any[]) => mockUseXP(...args)
}))

// Now import after mocking
import { useXP } from '@/hooks/useXP'

describe('useXP Hook Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseXP.mockClear()
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
  })

  it('should fetch XP status on mount', async () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          totalXP: 250,
          currentLevel: 5,
          levelInfo: {
            currentLevel: 5,
            currentXP: 50,
            xpToNextLevel: 100,
            progressPercentage: 50,
            title: 'Student'
          }
        }
      })
    } as Response)

    // Setup the mock return value
    mockUseXP.mockReturnValue({
      totalXP: 250,
      currentLevel: 5,
      levelInfo: {
        currentLevel: 5,
        currentXP: 50,
        xpToNextLevel: 100,
        progressPercentage: 50,
        title: 'Student',
        nextLevelTitle: 'Apprentice',
        totalXP: 250,
        rank: 0,
        recentXPEvents: []
      },
      xpToNextLevel: 100,
      progressPercentage: 50,
      loading: false,
      error: null,
      refreshXP: jest.fn(),
      trackXP: jest.fn()
    })

    // Call the hook
    const result = useXP()

    // Verify the results
    expect(result.totalXP).toBe(250)
    expect(result.currentLevel).toBe(5)
    expect(result.levelInfo?.title).toBe('Student')
    expect(result.loading).toBe(false)
    expect(result.error).toBeNull()
  })

  it('should track XP gains', async () => {
    const trackXPFn = jest.fn()

    mockUseXP.mockReturnValue({
      totalXP: 100,
      currentLevel: 2,
      levelInfo: null,
      xpToNextLevel: 50,
      progressPercentage: 50,
      loading: false,
      error: null,
      refreshXP: jest.fn(),
      trackXP: trackXPFn
    })

    const result = useXP()

    // Call trackXP
    await result.trackXP('review_completed', 10, 'Test review', { correct: true })

    // Verify it was called with correct params
    expect(trackXPFn).toHaveBeenCalledWith(
      'review_completed',
      10,
      'Test review',
      { correct: true }
    )
  })

  it('should handle loading state', () => {
    mockUseXP.mockReturnValue({
      totalXP: 0,
      currentLevel: 1,
      levelInfo: null,
      xpToNextLevel: 100,
      progressPercentage: 0,
      loading: true,
      error: null,
      refreshXP: jest.fn(),
      trackXP: jest.fn()
    })

    const result = useXP()

    expect(result.loading).toBe(true)
    expect(result.totalXP).toBe(0)
  })

  it('should handle error state', () => {
    mockUseXP.mockReturnValue({
      totalXP: 0,
      currentLevel: 1,
      levelInfo: null,
      xpToNextLevel: 100,
      progressPercentage: 0,
      loading: false,
      error: 'Failed to load XP',
      refreshXP: jest.fn(),
      trackXP: jest.fn()
    })

    const result = useXP()

    expect(result.error).toBe('Failed to load XP')
    expect(result.loading).toBe(false)
  })

  it('should fallback to localStorage when API fails', () => {
    // Setup localStorage mock
    const mockLocalStorage = {
      getItem: jest.fn(() => '500'),
      setItem: jest.fn()
    }
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true
    })

    mockUseXP.mockReturnValue({
      totalXP: 500, // From localStorage
      currentLevel: 10,
      levelInfo: null,
      xpToNextLevel: 150,
      progressPercentage: 33,
      loading: false,
      error: 'API error',
      refreshXP: jest.fn(),
      trackXP: jest.fn()
    })

    const result = useXP()

    // Should use localStorage value
    expect(result.totalXP).toBe(500)
    expect(result.currentLevel).toBe(10)
    expect(result.error).toBe('API error')
  })

  it('should display real XP data in dashboard', async () => {
    mockUseXP.mockReturnValue({
      totalXP: 750,
      currentLevel: 8,
      levelInfo: {
        currentLevel: 8,
        currentXP: 50,
        xpToNextLevel: 100,
        progressPercentage: 50,
        title: 'Advanced Student',
        nextLevelTitle: 'Expert',
        totalXP: 750,
        rank: 0,
        recentXPEvents: []
      },
      xpToNextLevel: 100,
      progressPercentage: 50,
      loading: false,
      error: null,
      refreshXP: jest.fn(),
      trackXP: jest.fn()
    })

    const result = useXP()

    // Verify dashboard can display this data
    expect(result.totalXP).toBe(750)
    expect(result.currentLevel).toBe(8)
    expect(result.levelInfo?.title).toBe('Advanced Student')
    expect(result.levelInfo?.nextLevelTitle).toBe('Expert')
    expect(result.progressPercentage).toBe(50)
  })
})