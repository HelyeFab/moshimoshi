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
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StudySession } from '../StudySession'
import type { FlashcardDeck, FlashcardContent } from '@/types/flashcards'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { useBatchMediaHydration } from '@/hooks/useMediaHydration'
import { flashcardManager } from '@/lib/flashcards/FlashcardManager'

jest.mock('canvas-confetti', () => jest.fn())
jest.mock('@/i18n/I18nContext')
jest.mock('@/hooks/useAuth')
jest.mock('@/hooks/useSubscription')
jest.mock('@/hooks/useMediaHydration')
jest.mock('@/lib/firebase/client', () => ({ auth: {}, db: {} }))
jest.mock('@/lib/services/XPConfigService', () => ({
  xpConfigService: {
    calculateFlashcardsXP: jest.fn(() => ({ cappedXP: 0 })),
  },
}))
jest.mock('@/components/flashcards/FlashcardViewer', () => ({
  FlashcardViewer: ({
    card,
    onNext,
    onResponse,
  }: {
    card: FlashcardContent
    onNext?: () => void
    onResponse?: (correct: boolean, difficulty?: 'again' | 'hard' | 'good' | 'easy') => void
  }) => (
    <div>
      <div data-testid="card">{card.id}</div>
      <button type="button" onClick={onNext} disabled={!onNext}>
        viewer-next
      </button>
      <button
        type="button"
        onClick={() => onResponse?.(true, 'good')}
        disabled={!onResponse}
      >
        viewer-grade-good
      </button>
    </div>
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
const mockFlashcardManager = flashcardManager as jest.Mocked<typeof flashcardManager>

describe('StudySession preview/study modes', () => {
  const baseDeck: FlashcardDeck = {
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

  const cards: FlashcardContent[] = [
    { id: 'card-1', front: 'Front 1', back: 'Back 1', metadata: { status: 'new' } },
  ]
  const twoCards: FlashcardContent[] = [
    { id: 'card-1', front: 'Front 1', back: 'Back 1', metadata: { status: 'new' } },
    { id: 'card-2', front: 'Front 2', back: 'Back 2', metadata: { status: 'new' } },
  ]
  const duplicateIdCards: FlashcardContent[] = [
    { id: 'card-dup', front: 'Front 1', back: 'Back 1', metadata: { status: 'new' } },
    { id: 'card-dup', front: 'Front 2', back: 'Back 2', metadata: { status: 'new' } },
  ]

  beforeEach(() => {
    jest.useFakeTimers()
    localStorage.clear()
    jest.clearAllMocks()

    mockUseI18n.mockReturnValue({
      t: (key: string) => key,
      language: 'en',
    } as any)
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } } as any)
    mockUseSubscription.mockReturnValue({ isPremium: false } as any)
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

  it('preview mode completes without SRS writes or session stat persistence', async () => {
    const onComplete = jest.fn()

    render(
      <StudySession
        deck={{ ...baseDeck, cards }}
        cards={cards}
        mode="preview"
        onComplete={onComplete}
        onExit={jest.fn()}
      />
    )

    fireEvent.click(screen.getByText('viewer-next'))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(mockFlashcardManager.updateCardAfterReview).not.toHaveBeenCalled()
    expect(mockFlashcardManager.saveSessionStats).not.toHaveBeenCalled()
  })

  it('study mode self-check does not update SRS or persist session stats', async () => {
    const onComplete = jest.fn()

    render(
      <StudySession
        deck={{ ...baseDeck, cards }}
        cards={cards}
        mode="study"
        onComplete={onComplete}
        onExit={jest.fn()}
      />
    )

    fireEvent.click(screen.getByText('flashcards.markCorrect'))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(mockFlashcardManager.updateCardAfterReview).not.toHaveBeenCalled()
    expect(mockFlashcardManager.saveSessionStats).not.toHaveBeenCalled()
  })

  it('persists partial session stats when exiting early in classic mode', async () => {
    const onComplete = jest.fn()
    const onExit = jest.fn()

    render(
      <StudySession
        deck={{ ...baseDeck, cards: twoCards }}
        cards={twoCards}
        mode="classic"
        onComplete={onComplete}
        onExit={onExit}
      />
    )

    fireEvent.click(screen.getByText('viewer-grade-good'))
    fireEvent.click(screen.getAllByLabelText('common.close')[0])

    await waitFor(() => expect(mockFlashcardManager.saveSessionStats).toHaveBeenCalledTimes(1))
    expect(mockFlashcardManager.saveSessionStats).toHaveBeenCalledWith(
      expect.objectContaining({
        cardsStudied: 1,
        mode: 'classic',
      }),
      'user-1',
      false
    )
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('study mode ignores duplicate taps for the same card', async () => {
    const onComplete = jest.fn()

    render(
      <StudySession
        deck={{ ...baseDeck, cards }}
        cards={cards}
        mode="study"
        onComplete={onComplete}
        onExit={jest.fn()}
      />
    )

    const markCorrectButton = screen.getByText('flashcards.markCorrect')
    fireEvent.click(markCorrectButton)
    await waitFor(() => expect(markCorrectButton).toBeDisabled())
    fireEvent.click(markCorrectButton)

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
  })

  it('study mode persists weak/mistake signals and returns follow-up card ids', async () => {
    const onComplete = jest.fn()

    render(
      <StudySession
        deck={{ ...baseDeck, cards: twoCards }}
        cards={twoCards}
        mode="study"
        onComplete={onComplete}
        onExit={jest.fn()}
      />
    )

    fireEvent.click(screen.getByText('flashcards.markIncorrect'))
    act(() => {
      jest.advanceTimersByTime(300)
    })
    fireEvent.click(screen.getByText('flashcards.markCorrect'))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    const summary = onComplete.mock.calls[0][0]
    expect(summary.studyFollowUpCardIds).toEqual(['card-1'])

    const weakRaw = localStorage.getItem('flashcards_weak_cards_user-1_deck-1')
    expect(weakRaw).not.toBeNull()
    const weakParsed = JSON.parse(weakRaw!)
    expect(weakParsed.entries).toEqual([{ cardId: 'card-1', difficulty: 'again' }])

    const replayRaw = localStorage.getItem('flashcards_mistake_replay_user-1_deck-1')
    expect(replayRaw).not.toBeNull()
    const replayParsed = JSON.parse(replayRaw!)
    expect(Array.isArray(replayParsed.sessions)).toBe(true)
    expect(replayParsed.sessions[0].cardIds).toEqual(['card-1'])
  })

  it('shows follow-up drill banner in chained study rounds', () => {
    render(
      <StudySession
        deck={{ ...baseDeck, cards }}
        cards={cards}
        mode="study"
        followUpRound={2}
        onComplete={jest.fn()}
        onExit={jest.fn()}
      />
    )

    expect(screen.getByText('flashcards.studyFollowUp.title')).toBeInTheDocument()
    expect(screen.getByText('flashcards.studyFollowUp.cardsLeft')).toBeInTheDocument()
  })

  it('auto-hides mode hint banner after a few seconds', () => {
    render(
      <StudySession
        deck={{ ...baseDeck, cards }}
        cards={cards}
        mode="study"
        onComplete={jest.fn()}
        onExit={jest.fn()}
      />
    )

    expect(screen.getByText('flashcards.modes.study.description')).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(screen.queryByText('flashcards.modes.study.description')).not.toBeInTheDocument()
  })

  it('completes study session even when cards share duplicate ids', async () => {
    const onComplete = jest.fn()

    render(
      <StudySession
        deck={{ ...baseDeck, cards: duplicateIdCards }}
        cards={duplicateIdCards}
        mode="study"
        onComplete={onComplete}
        onExit={jest.fn()}
      />
    )

    fireEvent.click(screen.getByText('flashcards.markCorrect'))
    act(() => {
      jest.advanceTimersByTime(300)
    })
    fireEvent.click(screen.getByText('flashcards.markCorrect'))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
  })

})
