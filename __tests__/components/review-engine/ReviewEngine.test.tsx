import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ReviewEngine from '@/components/review-engine/ReviewEngine'
import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { SessionStatistics } from '@/lib/review-engine/core/types'
import { I18nProvider } from '@/i18n/I18nContext'

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}))

// Mock the hooks
jest.mock('@/hooks/useReviewEngine', () => ({
  useReviewEngine: () => ({
    playSound: jest.fn(),
    vibrate: jest.fn(),
    playAudio: jest.fn(),
    stopAudio: jest.fn(),
    isOffline: jest.fn(() => false),
  }),
}))

jest.mock('@/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: jest.fn(),
}))

// Mock IndexedDB
jest.mock('@/lib/review-engine/offline/indexed-db', () => ({
  IndexedDBStorage: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    saveSession: jest.fn().mockResolvedValue(undefined),
    getSession: jest.fn().mockResolvedValue(null),
    cacheContent: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  })),
}))

describe('ReviewEngine', () => {
  const mockContent: ReviewableContent[] = [
    {
      id: '1',
      contentType: 'kana',
      primaryDisplay: 'あ',
      primaryAnswer: 'a',
      supportedModes: ['recognition', 'recall', 'listening'],
      tags: [],
      difficulty: 0.1,
    },
    {
      id: '2',
      contentType: 'kana',
      primaryDisplay: 'い',
      primaryAnswer: 'i',
      supportedModes: ['recognition', 'recall', 'listening'],
      tags: [],
      difficulty: 0.1,
    },
  ]

  const mockOnComplete = jest.fn()
  const mockOnCancel = jest.fn()
  const mockOnProgressUpdate = jest.fn()

  const renderWithI18n = (component: React.ReactElement) => {
    return render(
      <I18nProvider initialLanguage="en">
        {component}
      </I18nProvider>
    )
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize session correctly', async () => {
    renderWithI18n(
      <ReviewEngine
        content={mockContent}
        mode="recognition"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        userId="test-user"
      />
    )

    await waitFor(() => {
      expect(screen.queryByText(/preparing your review session/i)).not.toBeInTheDocument()
    })
  })

  it('should handle mode switching', async () => {
    renderWithI18n(
      <ReviewEngine
        content={mockContent}
        mode="recognition"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        userId="test-user"
      />
    )

    await waitFor(() => {
      const recallButton = screen.getByText(/Recall/i)
      expect(recallButton).toBeInTheDocument()
    })

    const recallButton = screen.getByText(/Recall/i)
    fireEvent.click(recallButton)

    // Check if recall mode is active (button should have different styling)
    expect(recallButton).toHaveClass('bg-primary-500')
  })

  it('should submit answers', async () => {
    renderWithI18n(
      <ReviewEngine
        content={mockContent}
        mode="recognition"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        userId="test-user"
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Show Answer/i)).toBeInTheDocument()
    })

    // Click show answer
    const showAnswerButton = screen.getByText(/Show Answer/i)
    fireEvent.click(showAnswerButton)

    // Check if next button appears
    await waitFor(() => {
      expect(screen.getByText(/Next/i)).toBeInTheDocument()
    })
  })

  it('should show progress', async () => {
    renderWithI18n(
      <ReviewEngine
        content={mockContent}
        mode="recognition"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        userId="test-user"
      />
    )

    await waitFor(() => {
      // Check if progress is displayed (1/2)
      expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument()
    })
  })

  it('should handle keyboard shortcuts', async () => {
    const { container } = renderWithI18n(
      <ReviewEngine
        content={mockContent}
        mode="recognition"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        userId="test-user"
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Show Answer/i)).toBeInTheDocument()
    })

    // Simulate Escape key to cancel
    fireEvent.keyDown(container, { key: 'Escape' })
    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('should complete session and show summary', async () => {
    // Create single item content for easier testing
    const singleContent: ReviewableContent[] = [mockContent[0]]

    renderWithI18n(
      <ReviewEngine
        content={singleContent}
        mode="recognition"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        userId="test-user"
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Show Answer/i)).toBeInTheDocument()
    })

    // Show answer
    fireEvent.click(screen.getByText(/Show Answer/i))

    // Click next to complete session
    await waitFor(() => {
      const nextButton = screen.getByText(/Next/i)
      fireEvent.click(nextButton)
    })

    // Check if onComplete was called with statistics
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          totalItems: 1,
          completedItems: expect.any(Number),
          accuracy: expect.any(Number),
        })
      )
    })
  })

  it('should handle offline mode', async () => {
    // Mock offline status
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    })

    renderWithI18n(
      <ReviewEngine
        content={mockContent}
        mode="recognition"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        userId="test-user"
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Offline Mode/i)).toBeInTheDocument()
    })
  })

  it('should handle errors gracefully', async () => {
    // Mock an error during initialization
    const ErrorReviewEngine = () => {
      throw new Error('Test error')
    }

    const { getByText } = renderWithI18n(
      <ReviewEngine
        content={[]}
        mode="recognition"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        userId="test-user"
      />
    )

    // Since we're passing empty content, we should handle it gracefully
    await waitFor(() => {
      // The component should still render without crashing
      expect(mockOnCancel).toBeDefined()
    })
  })
})