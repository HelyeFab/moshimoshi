/**
 * QuizPlayer Component Tests
 *
 * Tests the unified quiz player component with:
 * - Answer selection (multiple-choice)
 * - Score calculation
 * - Auto-save functionality
 * - XP integration
 * - Multi-locale support
 * - Furigana rendering
 *
 * @jest-environment jsdom
 */

// Polyfill fetch and related APIs BEFORE any imports
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
global.Request = class Request {} as any
global.Response = class Response {
  constructor(public body?: any, public init?: any) {}
  json() { return Promise.resolve(this.body) }
  text() { return Promise.resolve(String(this.body)) }
} as any
global.Headers = class Headers {} as any

// Polyfill TextEncoder/TextDecoder for jsdom
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder
  global.TextDecoder = require('util').TextDecoder
}

// Mock Firebase
jest.mock('@/lib/firebase/client', () => ({
  auth: {},
  db: {},
}))

// Mock dependencies
jest.mock('@/i18n/I18nContext')
jest.mock('@/hooks/useAuth')
jest.mock('@/hooks/useQuizAutoSave')
jest.mock('@/components/reading/GrammarHighlightedText', () => ({
  GrammarHighlightedText: ({ text }: { text: string }) => <div>{text}</div>,
}))

// Mock gamification store
const mockUpdateFromServer = jest.fn()
const mockSetLastSessionStats = jest.fn()
const mockIncrementSessionCount = jest.fn()

jest.mock('@/state/userGamification', () => ({
  useGamificationStore: {
    getState: () => ({
      updateFromServer: mockUpdateFromServer,
      setLastSessionStats: mockSetLastSessionStats,
      incrementSessionCount: mockIncrementSessionCount,
    }),
  },
}))

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QuizPlayer } from '../QuizPlayer'
import { BaseQuizQuestion } from '@/types/quiz'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useQuizAutoSave } from '@/hooks/useQuizAutoSave'

const mockUseI18n = useI18n as jest.MockedFunction<typeof useI18n>
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUseQuizAutoSave = useQuizAutoSave as jest.MockedFunction<typeof useQuizAutoSave>

describe('QuizPlayer', () => {
  const mockQuestions: BaseQuizQuestion[] = [
    {
      id: 'q1',
      question: 'What is the capital of Japan?',
      questionJa: '日本の首都はどこですか？',
      options: ['Tokyo', 'Osaka', 'Kyoto', 'Nagoya'],
      correctAnswer: 0,
      type: 'multiple-choice',
      explanation: 'Tokyo is the capital of Japan.',
      explanationJa: '東京は日本の首都です。',
    },
    {
      id: 'q2',
      question: 'Which is the largest city in Japan?',
      questionJa: '日本で最も大きな都市はどこですか？',
      options: ['Tokyo', 'Osaka', 'Yokohama', 'Nagoya'],
      correctAnswer: 0,
      type: 'multiple-choice',
      explanation: 'Tokyo is the largest city.',
      explanationJa: '東京が最大の都市です。',
    },
  ]

  const mockUser = {
    uid: 'test-user-123',
    email: 'test@example.com',
  }

  const mockAutoSave = {
    saveProgress: jest.fn(),
    restoreProgress: jest.fn(() => null),
    clearProgress: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Clear gamification store mocks
    mockUpdateFromServer.mockClear()
    mockSetLastSessionStats.mockClear()
    mockIncrementSessionCount.mockClear()

    // Mock i18n
    mockUseI18n.mockReturnValue({
      t: (key: string) => key,
      language: 'en',
    } as any)

    // Mock auth
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    } as any)

    // Mock auto-save
    mockUseQuizAutoSave.mockReturnValue(mockAutoSave)

    // Mock fetch success with full gamification data
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          xpEarned: 30,
          newTotalXP: 150,
          newLevel: 1,
          streakIncremented: true,
          currentStreak: 1,
          bestStreak: 1,
          alreadyCompleted: false,
        },
      }),
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('should render quiz questions', () => {
      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
        />
      )

      expect(screen.getByText('Question 1')).toBeInTheDocument()
      expect(screen.getByText(/What is the capital of Japan/)).toBeInTheDocument()
      expect(screen.getAllByText('Tokyo').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Osaka').length).toBeGreaterThan(0)
    })

    it('should render all answer options', () => {
      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
        />
      )

      mockQuestions[0].options.forEach((option) => {
        expect(screen.getAllByText(option).length).toBeGreaterThan(0)
      })
    })

    it('should show progress indicator', () => {
      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
        />
      )

      expect(screen.getByText('0/2')).toBeInTheDocument()
    })

    it('should render Japanese questions in Japanese locale', () => {
      mockUseI18n.mockReturnValue({
        t: (key: string) => key,
        language: 'ja',
      } as any)

      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
          showFurigana={true}
        />
      )

      expect(screen.getByText(/日本の首都はどこですか/)).toBeInTheDocument()
    })
  })

  describe('Answer Selection', () => {
    it('should allow selecting an answer', () => {
      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
        />
      )

      const tokyoOption = screen.getAllByText('Tokyo')[0]
      const radioButton = tokyoOption.closest('label')?.querySelector('input[type="radio"]')

      expect(radioButton).not.toBeChecked()

      fireEvent.click(tokyoOption)

      expect(radioButton).toBeChecked()
    })

    it('should update progress when answer is selected', () => {
      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
        />
      )

      const tokyoOption = screen.getAllByText('Tokyo')[0]
      fireEvent.click(tokyoOption)

      expect(screen.getByText('1/2')).toBeInTheDocument()
    })

    it('should call auto-save when answer is selected', async () => {
      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
          enableAutoSave={true}
        />
      )

      const tokyoOption = screen.getAllByText('Tokyo')[0]
      fireEvent.click(tokyoOption)

      await waitFor(() => {
        expect(mockAutoSave.saveProgress).toHaveBeenCalled()
      })
    })

    it('should not call auto-save when disabled', () => {
      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
          enableAutoSave={false}
        />
      )

      const tokyoOption = screen.getAllByText('Tokyo')[0]
      fireEvent.click(tokyoOption)

      expect(mockAutoSave.saveProgress).not.toHaveBeenCalled()
    })
  })

  describe('Quiz Submission', () => {
    it('should disable submit button when not all questions answered', () => {
      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
        />
      )

      const submitButton = screen.getByText('story.quiz.submit')
      expect(submitButton).toBeDisabled()
    })

    it('should enable submit button when all questions answered', () => {
      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
        />
      )

      // Answer all questions
      const allTokyoOptions = screen.getAllByText('Tokyo')
      allTokyoOptions.forEach((option) => {
        fireEvent.click(option)
      })

      const submitButton = screen.getByText('story.quiz.submit')
      expect(submitButton).not.toBeDisabled()
    })

    it('should calculate correct score', async () => {
      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
        />
      )

      // Answer all correctly (Tokyo is correct for both)
      const allTokyoOptions = screen.getAllByText('Tokyo')
      allTokyoOptions.forEach((option) => {
        fireEvent.click(option)
      })

      const submitButton = screen.getByText('story.quiz.submit')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument()
      })
    })

    it('should calculate partial score', async () => {
      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
        />
      )

      // Answer first correctly, second incorrectly
      const firstTokyo = screen.getAllByText('Tokyo')[0]
      const secondOsaka = screen.getAllByText('Osaka')[1]

      fireEvent.click(firstTokyo)
      fireEvent.click(secondOsaka)

      const submitButton = screen.getByText('story.quiz.submit')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument()
      })
    })

    it('should call API to record completion', async () => {
      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
        />
      )

      // Answer all questions
      const allTokyoOptions = screen.getAllByText('Tokyo')
      allTokyoOptions.forEach((option) => {
        fireEvent.click(option)
      })

      const submitButton = screen.getByText('story.quiz.submit')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/quiz/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentType: 'story',
            contentId: 'test-story-1',
            score: 100,
            totalQuestions: 2,
            correctAnswers: 2,
          }),
        })
      })
    })

    it('should call onComplete callback with score and XP', async () => {
      const onComplete = jest.fn()

      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
          onComplete={onComplete}
        />
      )

      // Answer all questions
      const allTokyoOptions = screen.getAllByText('Tokyo')
      allTokyoOptions.forEach((option) => {
        fireEvent.click(option)
      })

      const submitButton = screen.getByText('story.quiz.submit')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith(100, 30)
      })
    })

    it('should clear auto-save on submission', async () => {
      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
          enableAutoSave={true}
        />
      )

      // Answer all questions
      const allTokyoOptions = screen.getAllByText('Tokyo')
      allTokyoOptions.forEach((option) => {
        fireEvent.click(option)
      })

      const submitButton = screen.getByText('story.quiz.submit')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockAutoSave.clearProgress).toHaveBeenCalled()
      })
    })

    it('should update gamification store to trigger celebration', async () => {
      // Set environment variable for gamification
      const originalEnv = process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION
      process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'true'

      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
        />
      )

      // Answer all questions correctly
      const allTokyoOptions = screen.getAllByText('Tokyo')
      allTokyoOptions.forEach((option) => {
        fireEvent.click(option)
      })

      const submitButton = screen.getByText('story.quiz.submit')
      fireEvent.click(submitButton)

      await waitFor(() => {
        // Verify updateFromServer was called with correct data
        expect(mockUpdateFromServer).toHaveBeenCalledWith({
          totalXP: 150,
          currentLevel: 1,
          currentStreak: 1,
          bestStreak: 1,
        })

        // Verify setLastSessionStats was called with quiz stats
        expect(mockSetLastSessionStats).toHaveBeenCalledWith({
          itemsCompleted: 2,
          accuracy: 100,
          duration: 0, // Quizzes don't track time
          xpGained: 30,
        })

        // Verify incrementSessionCount was called to trigger celebration
        expect(mockIncrementSessionCount).toHaveBeenCalled()
      })

      // Restore environment variable
      process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = originalEnv
    })

    it('should not update gamification store when gamification is disabled', async () => {
      // Disable gamification
      const originalEnv = process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION
      process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'false'

      // Clear previous calls
      mockUpdateFromServer.mockClear()
      mockSetLastSessionStats.mockClear()
      mockIncrementSessionCount.mockClear()

      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
        />
      )

      // Answer and submit
      const allTokyoOptions = screen.getAllByText('Tokyo')
      allTokyoOptions.forEach((option) => {
        fireEvent.click(option)
      })

      const submitButton = screen.getByText('story.quiz.submit')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument()
      })

      // Verify gamification store methods were NOT called
      expect(mockUpdateFromServer).not.toHaveBeenCalled()
      expect(mockSetLastSessionStats).not.toHaveBeenCalled()
      expect(mockIncrementSessionCount).not.toHaveBeenCalled()

      // Restore environment variable
      process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = originalEnv
    })
  })

  describe('Results Display', () => {
    it('should show results after submission', async () => {
      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
        />
      )

      // Answer and submit
      const allTokyoOptions = screen.getAllByText('Tokyo')
      allTokyoOptions.forEach((option) => {
        fireEvent.click(option)
      })

      const submitButton = screen.getByText('story.quiz.submit')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument()
        expect(screen.getByText('Review')).toBeInTheDocument()
      })
    })

    it('should show XP earned', async () => {
      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
        />
      )

      // Answer and submit
      const allTokyoOptions = screen.getAllByText('Tokyo')
      allTokyoOptions.forEach((option) => {
        fireEvent.click(option)
      })

      const submitButton = screen.getByText('story.quiz.submit')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('+30 XP')).toBeInTheDocument()
      })
    })

    it('should show correct/incorrect indicators', async () => {
      const { container } = render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
        />
      )

      // Answer first correctly, second incorrectly
      const firstTokyo = screen.getAllByText('Tokyo')[0]
      const secondOsaka = screen.getAllByText('Osaka')[1]

      fireEvent.click(firstTokyo)
      fireEvent.click(secondOsaka)

      const submitButton = screen.getByText('story.quiz.submit')
      fireEvent.click(submitButton)

      await waitFor(() => {
        const checkIcons = container.querySelectorAll('.text-green-500')
        const xIcons = container.querySelectorAll('.text-red-500')

        expect(checkIcons.length).toBeGreaterThan(0)
        expect(xIcons.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Navigation', () => {
    it('should call onBack when back button clicked', () => {
      const onBack = jest.fn()

      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
          onBack={onBack}
        />
      )

      const backButton = screen.getByText('Back')
      fireEvent.click(backButton)

      expect(onBack).toHaveBeenCalled()
    })

    it('should call onExit after results shown', async () => {
      const onExit = jest.fn()

      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
          onExit={onExit}
        />
      )

      // Answer and submit
      const allTokyoOptions = screen.getAllByText('Tokyo')
      allTokyoOptions.forEach((option) => {
        fireEvent.click(option)
      })

      const submitButton = screen.getByText('story.quiz.submit')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Continue')).toBeInTheDocument()
      })

      const continueButton = screen.getByText('Continue')
      fireEvent.click(continueButton)

      expect(onExit).toHaveBeenCalled()
    })

    it('should allow retaking quiz', async () => {
      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
        />
      )

      // Answer and submit
      const allTokyoOptions = screen.getAllByText('Tokyo')
      allTokyoOptions.forEach((option) => {
        fireEvent.click(option)
      })

      const submitButton = screen.getByText('story.quiz.submit')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument()
      })

      const retakeButton = screen.getByText('Try Again')
      fireEvent.click(retakeButton)

      // Should show quiz questions again
      await waitFor(() => {
        expect(screen.getByText('Question 1')).toBeInTheDocument()
        expect(screen.getByText('0/2')).toBeInTheDocument()
      })
    })
  })

  describe('Auto-Save Restoration', () => {
    it('should restore saved progress on mount', () => {
      mockAutoSave.restoreProgress.mockReturnValue({
        answers: { 0: 0, 1: 1 },
        currentQuestion: 1,
        totalQuestions: 2,
        timestamp: Date.now(),
      })

      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
          enableAutoSave={true}
        />
      )

      expect(mockAutoSave.restoreProgress).toHaveBeenCalled()
      expect(screen.getByText('2/2')).toBeInTheDocument()
    })

    it('should not restore when auto-save disabled', () => {
      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
          enableAutoSave={false}
        />
      )

      expect(mockAutoSave.restoreProgress).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle API error gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
        />
      )

      // Answer and submit
      const allTokyoOptions = screen.getAllByText('Tokyo')
      allTokyoOptions.forEach((option) => {
        fireEvent.click(option)
      })

      const submitButton = screen.getByText('story.quiz.submit')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '[QuizPlayer] Failed to submit quiz:',
          expect.any(Error)
        )
      })

      // Should still show results
      expect(screen.getByText('100%')).toBeInTheDocument()

      consoleSpy.mockRestore()
    })
  })

  describe('Content Type Support', () => {
    it('should work with story content type', async () => {
      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="story"
          contentId="test-story-1"
        />
      )

      const allTokyoOptions = screen.getAllByText('Tokyo')
      allTokyoOptions.forEach((option) => {
        fireEvent.click(option)
      })

      const submitButton = screen.getByText('story.quiz.submit')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/quiz/complete',
          expect.objectContaining({
            body: expect.stringContaining('"contentType":"story"'),
          })
        )
      })
    })

    it('should work with comic content type', async () => {
      render(
        <QuizPlayer
          questions={mockQuestions}
          contentType="comic"
          contentId="test-comic-1"
        />
      )

      const allTokyoOptions = screen.getAllByText('Tokyo')
      allTokyoOptions.forEach((option) => {
        fireEvent.click(option)
      })

      const submitButton = screen.getByText('story.quiz.submit')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/quiz/complete',
          expect.objectContaining({
            body: expect.stringContaining('"contentType":"comic"'),
          })
        )
      })
    })
  })
})
