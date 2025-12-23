/**
 * useQuizAutoSave Hook Tests
 *
 * Tests the quiz auto-save hook with:
 * - localStorage persistence
 * - Debounced saves
 * - User isolation
 * - Expiration handling
 * - Progress restoration
 *
 * @jest-environment jsdom
 */

// Polyfill fetch and related APIs for jsdom environment
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
global.Request = class Request {} as any
global.Response = class Response {
  constructor(public body?: any, public init?: any) {}
  json() { return Promise.resolve(this.body) }
  text() { return Promise.resolve(String(this.body)) }
} as any
global.Headers = class Headers {} as any

// Mock Firebase before any imports
jest.mock('@/lib/firebase/client', () => ({
  auth: {},
  db: {},
}))

import { renderHook, act, waitFor } from '@testing-library/react'
import { useQuizAutoSave } from '../useQuizAutoSave'
import { useAuth } from '@/hooks/useAuth'

// Mock dependencies
jest.mock('@/hooks/useAuth')

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

describe('useQuizAutoSave', () => {
  const mockUser = {
    uid: 'test-user-123',
    email: 'test@example.com',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    jest.useFakeTimers()

    // Mock auth
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    } as any)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('Storage Key Generation', () => {
    it('should generate user-specific storage key', () => {
      const { result } = renderHook(() =>
        useQuizAutoSave({
          contentType: 'story',
          contentId: 'test-story-1',
        })
      )

      act(() => {
        result.current.saveProgress({
          answers: { 0: 0 },
          currentQuestion: 0,
          totalQuestions: 2,
        })
      })

      // Advance timers to trigger save
      act(() => {
        jest.advanceTimersByTime(500)
      })

      const keys = Object.keys(localStorage)
      expect(keys[0]).toBe('moshimoshi_quiz_progress_story_test-story-1_test-user-123')
    })

    it('should use anonymous for unauthenticated users', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
      } as any)

      const { result } = renderHook(() =>
        useQuizAutoSave({
          contentType: 'story',
          contentId: 'test-story-1',
        })
      )

      act(() => {
        result.current.saveProgress({
          answers: { 0: 0 },
          currentQuestion: 0,
          totalQuestions: 2,
        })
      })

      act(() => {
        jest.advanceTimersByTime(500)
      })

      const keys = Object.keys(localStorage)
      expect(keys[0]).toBe('moshimoshi_quiz_progress_story_test-story-1_anonymous')
    })
  })

  describe('Save Progress', () => {
    it('should save progress to localStorage', () => {
      const { result } = renderHook(() =>
        useQuizAutoSave({
          contentType: 'story',
          contentId: 'test-story-1',
        })
      )

      const progress = {
        answers: { 0: 0, 1: 2 },
        currentQuestion: 1,
        totalQuestions: 2,
      }

      act(() => {
        result.current.saveProgress(progress)
      })

      // Advance timers to trigger debounced save
      act(() => {
        jest.advanceTimersByTime(500)
      })

      const saved = JSON.parse(
        localStorage.getItem('moshimoshi_quiz_progress_story_test-story-1_test-user-123') || '{}'
      )

      expect(saved.answers).toEqual(progress.answers)
      expect(saved.currentQuestion).toBe(progress.currentQuestion)
      expect(saved.totalQuestions).toBe(progress.totalQuestions)
      expect(saved.timestamp).toBeDefined()
    })

    it('should debounce saves', () => {
      const { result } = renderHook(() =>
        useQuizAutoSave({
          contentType: 'story',
          contentId: 'test-story-1',
        })
      )

      // Call save multiple times rapidly
      act(() => {
        result.current.saveProgress({
          answers: { 0: 0 },
          currentQuestion: 0,
          totalQuestions: 2,
        })
      })

      act(() => {
        result.current.saveProgress({
          answers: { 0: 0, 1: 1 },
          currentQuestion: 1,
          totalQuestions: 2,
        })
      })

      // Advance time but not enough to trigger save
      act(() => {
        jest.advanceTimersByTime(400)
      })

      expect(localStorage.length).toBe(0)

      // Advance remaining time
      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(localStorage.length).toBe(1)

      const saved = JSON.parse(
        localStorage.getItem('moshimoshi_quiz_progress_story_test-story-1_test-user-123') || '{}'
      )

      // Should have the latest save
      expect(saved.currentQuestion).toBe(1)
    })

    it('should not save when disabled', () => {
      const { result } = renderHook(() =>
        useQuizAutoSave({
          contentType: 'story',
          contentId: 'test-story-1',
          enabled: false,
        })
      )

      act(() => {
        result.current.saveProgress({
          answers: { 0: 0 },
          currentQuestion: 0,
          totalQuestions: 2,
        })
      })

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(localStorage.length).toBe(0)
    })
  })

  describe('Restore Progress', () => {
    it('should restore saved progress', () => {
      const savedProgress = {
        answers: { 0: 0, 1: 2 },
        currentQuestion: 1,
        totalQuestions: 2,
        timestamp: Date.now(),
      }

      localStorage.setItem(
        'moshimoshi_quiz_progress_story_test-story-1_test-user-123',
        JSON.stringify(savedProgress)
      )

      const { result } = renderHook(() =>
        useQuizAutoSave({
          contentType: 'story',
          contentId: 'test-story-1',
        })
      )

      const restored = result.current.restoreProgress()

      expect(restored).toEqual(savedProgress)
    })

    it('should return null if no saved progress', () => {
      const { result } = renderHook(() =>
        useQuizAutoSave({
          contentType: 'story',
          contentId: 'test-story-1',
        })
      )

      const restored = result.current.restoreProgress()

      expect(restored).toBeNull()
    })

    it('should remove expired progress', () => {
      const expiredProgress = {
        answers: { 0: 0 },
        currentQuestion: 0,
        totalQuestions: 2,
        timestamp: Date.now() - 49 * 60 * 60 * 1000, // 49 hours ago (expired)
      }

      localStorage.setItem(
        'moshimoshi_quiz_progress_story_test-story-1_test-user-123',
        JSON.stringify(expiredProgress)
      )

      const { result } = renderHook(() =>
        useQuizAutoSave({
          contentType: 'story',
          contentId: 'test-story-1',
          expirationHours: 48,
        })
      )

      const restored = result.current.restoreProgress()

      expect(restored).toBeNull()
      expect(localStorage.length).toBe(0)
    })

    it('should keep non-expired progress', () => {
      const validProgress = {
        answers: { 0: 0 },
        currentQuestion: 0,
        totalQuestions: 2,
        timestamp: Date.now() - 24 * 60 * 60 * 1000, // 24 hours ago (not expired)
      }

      localStorage.setItem(
        'moshimoshi_quiz_progress_story_test-story-1_test-user-123',
        JSON.stringify(validProgress)
      )

      const { result } = renderHook(() =>
        useQuizAutoSave({
          contentType: 'story',
          contentId: 'test-story-1',
          expirationHours: 48,
        })
      )

      const restored = result.current.restoreProgress()

      expect(restored).not.toBeNull()
      expect(restored?.answers).toEqual(validProgress.answers)
    })

    it('should return null when disabled', () => {
      localStorage.setItem(
        'moshimoshi_quiz_progress_story_test-story-1_test-user-123',
        JSON.stringify({
          answers: { 0: 0 },
          currentQuestion: 0,
          totalQuestions: 2,
          timestamp: Date.now(),
        })
      )

      const { result } = renderHook(() =>
        useQuizAutoSave({
          contentType: 'story',
          contentId: 'test-story-1',
          enabled: false,
        })
      )

      const restored = result.current.restoreProgress()

      expect(restored).toBeNull()
    })
  })

  describe('Clear Progress', () => {
    it('should clear saved progress', () => {
      localStorage.setItem(
        'moshimoshi_quiz_progress_story_test-story-1_test-user-123',
        JSON.stringify({
          answers: { 0: 0 },
          currentQuestion: 0,
          totalQuestions: 2,
          timestamp: Date.now(),
        })
      )

      const { result } = renderHook(() =>
        useQuizAutoSave({
          contentType: 'story',
          contentId: 'test-story-1',
        })
      )

      expect(localStorage.length).toBe(1)

      act(() => {
        result.current.clearProgress()
      })

      expect(localStorage.length).toBe(0)
    })

    it('should not clear when disabled', () => {
      localStorage.setItem(
        'moshimoshi_quiz_progress_story_test-story-1_test-user-123',
        JSON.stringify({
          answers: { 0: 0 },
          currentQuestion: 0,
          totalQuestions: 2,
          timestamp: Date.now(),
        })
      )

      const { result } = renderHook(() =>
        useQuizAutoSave({
          contentType: 'story',
          contentId: 'test-story-1',
          enabled: false,
        })
      )

      act(() => {
        result.current.clearProgress()
      })

      expect(localStorage.length).toBe(1)
    })
  })

  describe('Expired Data Cleanup', () => {
    it('should cleanup expired quiz data on mount', () => {
      // Add expired data for different quizzes
      localStorage.setItem(
        'moshimoshi_quiz_progress_story_old-1_test-user-123',
        JSON.stringify({
          answers: { 0: 0 },
          currentQuestion: 0,
          totalQuestions: 2,
          timestamp: Date.now() - 49 * 60 * 60 * 1000, // Expired
        })
      )

      localStorage.setItem(
        'moshimoshi_quiz_progress_story_old-2_test-user-123',
        JSON.stringify({
          answers: { 0: 0 },
          currentQuestion: 0,
          totalQuestions: 2,
          timestamp: Date.now() - 25 * 60 * 60 * 1000, // Not expired
        })
      )

      localStorage.setItem('unrelated_key', 'should_not_be_touched')

      expect(localStorage.length).toBe(3)

      renderHook(() =>
        useQuizAutoSave({
          contentType: 'story',
          contentId: 'test-story-1',
          expirationHours: 48,
        })
      )

      // Should have removed only the expired quiz data
      expect(localStorage.length).toBe(2)
      expect(localStorage.getItem('moshimoshi_quiz_progress_story_old-1_test-user-123')).toBeNull()
      expect(localStorage.getItem('moshimoshi_quiz_progress_story_old-2_test-user-123')).not.toBeNull()
      expect(localStorage.getItem('unrelated_key')).toBe('should_not_be_touched')
    })

    it('should handle invalid JSON gracefully', () => {
      localStorage.setItem('moshimoshi_quiz_progress_story_invalid_test-user-123', 'invalid-json')

      expect(localStorage.length).toBe(1)

      renderHook(() =>
        useQuizAutoSave({
          contentType: 'story',
          contentId: 'test-story-1',
        })
      )

      // Should remove the invalid data
      expect(localStorage.length).toBe(0)
    })
  })

  describe('Different Content Types', () => {
    it('should isolate story and comic progress', () => {
      const { result: storyResult } = renderHook(() =>
        useQuizAutoSave({
          contentType: 'story',
          contentId: 'test-1',
        })
      )

      const { result: comicResult } = renderHook(() =>
        useQuizAutoSave({
          contentType: 'comic',
          contentId: 'test-1',
        })
      )

      act(() => {
        storyResult.current.saveProgress({
          answers: { 0: 0 },
          currentQuestion: 0,
          totalQuestions: 2,
        })

        comicResult.current.saveProgress({
          answers: { 0: 1 },
          currentQuestion: 1,
          totalQuestions: 3,
        })
      })

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(localStorage.length).toBe(2)

      const storyData = JSON.parse(
        localStorage.getItem('moshimoshi_quiz_progress_story_test-1_test-user-123') || '{}'
      )
      const comicData = JSON.parse(
        localStorage.getItem('moshimoshi_quiz_progress_comic_test-1_test-user-123') || '{}'
      )

      expect(storyData.currentQuestion).toBe(0)
      expect(comicData.currentQuestion).toBe(1)
    })
  })

  describe('Custom Expiration', () => {
    it('should use custom expiration time', () => {
      const customExpired = {
        answers: { 0: 0 },
        currentQuestion: 0,
        totalQuestions: 2,
        timestamp: Date.now() - 13 * 60 * 60 * 1000, // 13 hours ago
      }

      localStorage.setItem(
        'moshimoshi_quiz_progress_story_test-story-1_test-user-123',
        JSON.stringify(customExpired)
      )

      const { result } = renderHook(() =>
        useQuizAutoSave({
          contentType: 'story',
          contentId: 'test-story-1',
          expirationHours: 12, // Custom 12 hour expiration
        })
      )

      const restored = result.current.restoreProgress()

      expect(restored).toBeNull() // Should be expired with 12hr limit
    })
  })

  describe('Cleanup on Unmount', () => {
    it('should cleanup debounce timer on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useQuizAutoSave({
          contentType: 'story',
          contentId: 'test-story-1',
        })
      )

      act(() => {
        result.current.saveProgress({
          answers: { 0: 0 },
          currentQuestion: 0,
          totalQuestions: 2,
        })
      })

      unmount()

      // Timer should be cleared, no save should occur
      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(localStorage.length).toBe(0)
    })
  })
})
