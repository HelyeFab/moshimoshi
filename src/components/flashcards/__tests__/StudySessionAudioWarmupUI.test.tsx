/**
 * @jest-environment jsdom
 */

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
import type { FlashcardDeck, FlashcardContent } from '@/types/flashcards'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { useBatchMediaHydration } from '@/hooks/useMediaHydration'
import { startLocalFlashcardsAudioWarmup } from '@/lib/flashcards/audioWarmup'

jest.mock('canvas-confetti', () => jest.fn())
jest.mock('@/i18n/I18nContext')
jest.mock('@/hooks/useAuth')
jest.mock('@/hooks/useSubscription')
jest.mock('@/hooks/useMediaHydration')
jest.mock('@/lib/firebase/client', () => ({ auth: {}, db: {} }))
jest.mock('@/lib/flashcards/audioWarmup')
jest.mock('@/components/ui/DoshiMascot', () => ({
  __esModule: true,
  default: () => <div data-testid="doshi-mascot">Doshi</div>,
}))
jest.mock('@/components/flashcards/FlashcardViewer', () => ({
  FlashcardViewer: ({ card }: { card: FlashcardContent }) => <div data-testid="card">{card.id}</div>,
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
const mockStartLocalWarmup = startLocalFlashcardsAudioWarmup as jest.MockedFunction<typeof startLocalFlashcardsAudioWarmup>

describe('StudySession audio warmup indicator', () => {
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
      sessionLength: 1,
      reviewMode: 'srs',
      newCardsPerDay: 20,
      reviewsPerDay: 100,
    },
    stats: {
      totalCards: 1,
      newCards: 1,
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

  const cards: FlashcardContent[] = [{ id: 'card-1', front: '日本語', back: 'English' }]

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockUseI18n.mockReturnValue({ t: (k: string) => k, language: 'en' } as any)
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } } as any)
    mockUseSubscription.mockReturnValue({ isPremium: false } as any)
    mockUseBatchMediaHydration.mockImplementation((cardsToPreload: FlashcardContent[]) => new Map(cardsToPreload.map(c => [c.id, c])))
    mockStartLocalWarmup.mockImplementation(({ onProgress }) => {
      onProgress?.({ phase: 'warming', completed: 1, total: 3 })
      return () => {}
    })
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
  })

  it('shows Doshi alert + progress during preview warmup', () => {
    render(
      <StudySession
        deck={{ ...deck, cards }}
        cards={cards}
        mode="preview"
        onComplete={jest.fn()}
        onExit={jest.fn()}
      />
    )

    expect(screen.getByText('flashcards.audioWarmup.title')).toBeInTheDocument()
    expect(screen.getByText('flashcards.audioWarmup.message')).toBeInTheDocument()
    expect(screen.getByText(/flashcards\.audioWarmup\.progress/)).toBeInTheDocument()
    expect(screen.getByTestId('doshi-mascot')).toBeInTheDocument()
  })
})
