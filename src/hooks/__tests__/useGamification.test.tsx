/**
 * useGamification Hook Tests
 *
 * Tests the gamification hook behavior with feature flag ON/OFF,
 * loading states, error handling, and auth integration.
 */

import { renderHook, waitFor, act } from '@testing-library/react'
import { useGamification } from '../useGamification'
import { useGamificationStore } from '@/state/userGamification'
import { useAuth } from '@/hooks/useAuth'

// Mock dependencies
jest.mock('@/state/userGamification')
jest.mock('@/hooks/useAuth')

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

describe('useGamification', () => {
  const mockUser = {
    uid: 'test-user-123',
    email: 'test@example.com',
    displayName: 'Test User'
  }

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Reset store to initial state
    const store = useGamificationStore.getState()
    act(() => {
      store.reset()
    })

    // Default: user is authenticated
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false
    } as any)
  })

  afterEach(() => {
    // Clean up environment variable
    delete process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION
  })

  describe('Feature Flag ON', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'true'
    })

    it('should return initial loading state', () => {
      const { result } = renderHook(() => useGamification())

      expect(result.current.loading).toBe(true)
      expect(result.current.isEnabled).toBe(true)
    })

    it('should load data from IndexedDB and stop loading', async () => {
      const { result } = renderHook(() => useGamification())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBeNull()
    })

    it('should return real gamification data from store', async () => {
      // Pre-populate store with test data
      const store = useGamificationStore.getState()
      act(() => {
        store.awardXP(500)
        store.incrementStreak()
        store.unlockAchievement('first_session')
      })

      const { result } = renderHook(() => useGamification())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.totalXP).toBe(500)
      expect(result.current.currentLevel).toBe(1) // floor(500/1000) = 0, max(1, 0) = 1
      expect(result.current.currentStreak).toBe(1)
      expect(result.current.bestStreak).toBe(1)
      expect(result.current.unlockedAchievements).toEqual(['first_session'])
      expect(result.current.isEnabled).toBe(true)
    })

    it('should calculate level correctly from totalXP', async () => {
      const store = useGamificationStore.getState()
      act(() => {
        store.awardXP(2500) // floor(2500/1000) = 2
      })

      const { result } = renderHook(() => useGamification())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.currentLevel).toBe(2)
    })

    it('should not load if user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false
      } as any)

      const { result } = renderHook(() => useGamification())

      expect(result.current.loading).toBe(false)
      expect(result.current.totalXP).toBe(0)
    })
  })

  describe('Feature Flag OFF', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'false'
    })

    it('should return defaults when flag is OFF', () => {
      const { result } = renderHook(() => useGamification())

      expect(result.current.totalXP).toBe(0)
      expect(result.current.currentLevel).toBe(1)
      expect(result.current.currentStreak).toBe(0)
      expect(result.current.bestStreak).toBe(0)
      expect(result.current.unlockedAchievements).toEqual([])
      expect(result.current.sessionCount).toBe(0)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.isEnabled).toBe(false)
    })

    it('should not load from IndexedDB', () => {
      const { result } = renderHook(() => useGamification())

      // Should immediately return defaults without loading
      expect(result.current.loading).toBe(false)
      expect(result.current.isEnabled).toBe(false)
    })

    it('should ignore store data when disabled', () => {
      // Pre-populate store
      const store = useGamificationStore.getState()
      act(() => {
        store.awardXP(1000)
        store.incrementStreak()
      })

      const { result } = renderHook(() => useGamification())

      // Should still return defaults
      expect(result.current.totalXP).toBe(0)
      expect(result.current.currentStreak).toBe(0)
    })
  })

  describe('Feature Flag Undefined (not set)', () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION
    })

    it('should treat undefined flag as disabled', () => {
      const { result } = renderHook(() => useGamification())

      expect(result.current.isEnabled).toBe(false)
      expect(result.current.totalXP).toBe(0)
      expect(result.current.loading).toBe(false)
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'true'
    })

    it('should handle IndexedDB load errors gracefully', async () => {
      const store = useGamificationStore.getState()
      const mockError = new Error('IndexedDB unavailable')

      // Mock loadFromIndexedDB to throw error
      jest.spyOn(store, 'loadFromIndexedDB').mockRejectedValue(mockError)

      const { result } = renderHook(() => useGamification())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toEqual(mockError)
      // Should still return current store state
      expect(result.current.isEnabled).toBe(true)
    })

    it('should continue to return data even after error', async () => {
      const store = useGamificationStore.getState()

      // Set up data before error
      act(() => {
        store.awardXP(100)
      })

      jest.spyOn(store, 'loadFromIndexedDB').mockRejectedValue(
        new Error('Load failed')
      )

      const { result } = renderHook(() => useGamification())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Should still have the data that was set
      expect(result.current.totalXP).toBe(100)
      expect(result.current.error).toBeTruthy()
    })
  })

  describe('Re-render Behavior', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'true'
    })

    it('should reflect store updates on re-render', async () => {
      const { result, rerender } = renderHook(() => useGamification())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Update store
      const store = useGamificationStore.getState()
      act(() => {
        store.awardXP(250)
      })

      // Force re-render
      rerender()

      expect(result.current.totalXP).toBe(250)
    })
  })

  describe('Session Count', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'true'
    })

    it('should return session count from store', async () => {
      const store = useGamificationStore.getState()
      act(() => {
        store.incrementSessionCount()
        store.incrementSessionCount()
        store.incrementSessionCount()
      })

      const { result } = renderHook(() => useGamification())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.sessionCount).toBe(3)
    })
  })

  describe('Unlocked Achievements', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'true'
    })

    it('should return unlocked achievements array', async () => {
      const store = useGamificationStore.getState()
      act(() => {
        store.unlockAchievement('first_session')
        store.unlockAchievement('week_warrior')
        store.unlockAchievement('centurion')
      })

      const { result } = renderHook(() => useGamification())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.unlockedAchievements).toHaveLength(3)
      expect(result.current.unlockedAchievements).toContain('first_session')
      expect(result.current.unlockedAchievements).toContain('week_warrior')
      expect(result.current.unlockedAchievements).toContain('centurion')
    })

    it('should return empty array when no achievements unlocked', async () => {
      const { result } = renderHook(() => useGamification())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.unlockedAchievements).toEqual([])
    })
  })
})
