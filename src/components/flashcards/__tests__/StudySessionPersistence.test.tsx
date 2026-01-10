/**
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

import React from 'react'
import { render, screen, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StudySession } from '../StudySession'
import type { FlashcardDeck, FlashcardContent, PersistedStudySession } from '@/types/flashcards'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { useBatchMediaHydration } from '@/hooks/useMediaHydration'

jest.mock('canvas-confetti', () => jest.fn())

jest.mock('@/i18n/I18nContext')
jest.mock('@/hooks/useAuth')
jest.mock('@/hooks/useSubscription')
jest.mock('@/hooks/useMediaHydration')
jest.mock('@/lib/firebase/client', () => ({
  auth: {},
  db: {},
}))
jest.mock('@/components/flashcards/FlashcardViewer', () => ({
  FlashcardViewer: ({ card }: { card: FlashcardContent }) => (
    <div data-testid="card">{card.id}</div>
  ),
}))
jest.mock('@/lib/flashcards/FlashcardManager', () => ({
  flashcardManager: {
    updateCardAfterReview: jest.fn(),
    updateDeck: jest.fn(),
    saveSessionStats: jest.fn(),
  },
}))

const mockUseI18n = useI18n as jest.MockedFunction<typeof useI18n>
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUseSubscription = useSubscription as jest.MockedFunction<typeof useSubscription>
const mockUseBatchMediaHydration = useBatchMediaHydration as jest.MockedFunction<typeof useBatchMediaHydration>

describe('StudySession persistence', () => {
  const deck: FlashcardDeck = {
    id: 'deck-1',
    userId: 'user-1',
    name: 'Test Deck',
    emoji: '📘',
    color: 'blue',
    cardStyle: 'minimal',
    cards: [],
    settings: {
      studyDirection: 'front-to-back',
      autoPlay: false,
      showHints: true,
      animationSpeed: 'normal',
      soundEffects: true,
      hapticFeedback: true,
      sessionLength: 2,
      reviewMode: 'srs',
      newCardsPerDay: 20,
      reviewsPerDay: 100,
    },
    stats: {
      totalCards: 2,
      newCards: 2,
      learningCards: 0,
      reviewCards: 0,
      masteredCards: 0,
      totalStudied: 0,
      averageAccuracy: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalTimeSpent: 0,
      heatmapData: {},
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const cards: FlashcardContent[] = [
    { id: 'card-1', front: 'Front 1', back: 'Back 1' },
    { id: 'card-2', front: 'Front 2', back: 'Back 2' },
  ]

  beforeEach(() => {
    jest.useFakeTimers()
    localStorage.clear()

    mockUseI18n.mockReturnValue({
      t: (key: string) => key,
      language: 'en',
    } as any)
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } } as any)
    mockUseSubscription.mockReturnValue({ isPremium: true } as any)
    mockUseBatchMediaHydration.mockImplementation((cardsToPreload: FlashcardContent[]) => {
      return new Map(cardsToPreload.map(card => [card.id, card]))
    })
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
  })

  it('persists the active session to localStorage', () => {
    render(
      <StudySession
        deck={{ ...deck, cards }}
        cards={cards}
        onComplete={jest.fn()}
        onExit={jest.fn()}
      />
    )

    act(() => {
      jest.advanceTimersByTime(250)
    })

    const stored = localStorage.getItem('flashcards_active_session_user-1')
    expect(stored).not.toBeNull()

    const parsed = JSON.parse(stored!) as PersistedStudySession
    expect(parsed.deckId).toBe('deck-1')
    expect(parsed.cardIds).toEqual(['card-1', 'card-2'])
    expect(parsed.currentIndex).toBe(0)
  })

  it('clears persisted session on exit', () => {
    const { unmount } = render(
      <StudySession
        deck={{ ...deck, cards }}
        cards={cards}
        onComplete={jest.fn()}
        onExit={() => unmount()}
      />
    )

    act(() => {
      jest.advanceTimersByTime(250)
    })

    const closeButtons = screen.getAllByLabelText('common.close')
    act(() => {
      closeButtons[0].click()
    })

    expect(localStorage.getItem('flashcards_active_session_user-1')).toBeNull()
  })
})
