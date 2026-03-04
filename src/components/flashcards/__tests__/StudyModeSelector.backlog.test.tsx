/**
 * @jest-environment jsdom
 */

import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StudyModeSelector } from '../StudyModeSelector'
import type { FlashcardContent, FlashcardDeck } from '@/types/flashcards'
import { useI18n } from '@/i18n/I18nContext'
import { getEventHub } from '@/lib/review-engine/core/event-hub'
import { ReviewEventType } from '@/lib/review-engine/core/events'

jest.mock('@/i18n/I18nContext')
jest.mock('@/lib/review-engine/core/event-hub', () => ({
  getEventHub: jest.fn(),
}))
jest.mock('@/lib/flashcards/mistakeReplay', () => ({
  mistakeReplayStore: {
    load: jest.fn(() => null),
    getCombinedCardIds: jest.fn(() => []),
  },
}))

const mockUseI18n = useI18n as jest.MockedFunction<typeof useI18n>
const mockGetEventHub = getEventHub as jest.MockedFunction<typeof getEventHub>

const now = Date.now()

const buildDeck = (cards: FlashcardContent[]): FlashcardDeck => ({
  id: 'deck-backlog',
  userId: 'user-1',
  name: 'Backlog Deck',
  emoji: '📘',
  color: 'blue',
  cardStyle: 'minimal',
  cards,
  settings: {
    studyDirection: 'front-to-back',
    autoPlay: false,
    showHints: true,
    animationSpeed: 'normal',
    soundEffects: true,
    hapticFeedback: true,
    sessionLength: 20,
    reviewMode: 'srs',
    newCardsPerDay: 20,
    reviewsPerDay: 100,
  },
  stats: {
    totalCards: cards.length,
    newCards: cards.filter(c => !c.metadata?.status || c.metadata.status === 'new').length,
    learningCards: 0,
    reviewCards: cards.filter(c => c.metadata?.status && c.metadata.status !== 'new').length,
    masteredCards: 0,
    totalStudied: 10,
    averageAccuracy: 0.8,
    currentStreak: 2,
    longestStreak: 3,
    totalTimeSpent: 1000,
    heatmapData: {},
  },
  createdAt: now,
  updatedAt: now,
})

const createNewCard = (id: string): FlashcardContent => ({
  id,
  front: `Front ${id}`,
  back: `Back ${id}`,
  metadata: { status: 'new' },
})

const createReviewCard = (id: string, nextReview: number): FlashcardContent => ({
  id,
  front: `Front ${id}`,
  back: `Back ${id}`,
  metadata: { status: 'review', nextReview },
})

describe('StudyModeSelector backlog mode', () => {
  const emit = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseI18n.mockReturnValue({
      t: (key: string) => key,
      language: 'en',
    } as any)
    mockGetEventHub.mockReturnValue({ emit } as any)
  })

  it('shows backlog mode and displays full backlog count on Due tile', () => {
    const deck = buildDeck([
      createReviewCard('r1', now - 10000),
      createReviewCard('r2', now - 5000),
      createNewCard('n1'),
      createNewCard('n2'),
    ])

    render(
      <StudyModeSelector
        deck={deck}
        userId="user-1"
        studiedToday={4}
        onStartStudy={jest.fn()}
        onClose={jest.fn()}
      />
    )

    const backlogTile = screen.getByTestId('flashcards-study-mode-backlog')
    const dueTile = screen.getByTestId('flashcards-study-mode-due')
    expect(backlogTile).toBeInTheDocument()
    expect(within(dueTile).getByText('flashcards.backlog.label')).toBeInTheDocument()
  })

  it('keeps due mode blocked when remaining today is zero after studiedToday is applied', () => {
    const deck = buildDeck([
      createReviewCard('r1', now - 10000),
      createReviewCard('r2', now - 5000),
      createNewCard('n1'),
      createNewCard('n2'),
    ])
    const onStartStudy = jest.fn()

    render(
      <StudyModeSelector
        deck={deck}
        userId="user-1"
        studiedToday={4}
        onStartStudy={onStartStudy}
        onClose={jest.fn()}
      />
    )

    const dueTile = screen.getByTestId('flashcards-study-mode-due')
    fireEvent.click(dueTile)
    fireEvent.click(dueTile)

    expect(onStartStudy).not.toHaveBeenCalled()
  })

  it('uses selected backlog preset size when starting', () => {
    const backlogCards = Array.from({ length: 120 }, (_, i) =>
      createReviewCard(`r${i + 1}`, now - (i + 1) * 1000)
    )
    const deck = buildDeck(backlogCards)
    const onStartStudy = jest.fn()

    render(
      <StudyModeSelector
        deck={deck}
        userId="user-1"
        onStartStudy={onStartStudy}
        onClose={jest.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('flashcards-study-mode-backlog'))
    fireEvent.click(screen.getByRole('button', { name: '20' }))
    fireEvent.click(screen.getByTestId('flashcards-start-study'))

    expect(onStartStudy).toHaveBeenCalledTimes(1)
    expect(onStartStudy.mock.calls[0][1]).toBe('backlog')
    expect(onStartStudy.mock.calls[0][0]).toHaveLength(20)
  })

  it('orders backlog cards by due reviews first then new cards', () => {
    const deck = buildDeck([
      createReviewCard('r1', now - 5000),
      createReviewCard('r2', now - 10000),
      createReviewCard('r3', now - 2000),
      createNewCard('n1'),
      createNewCard('n2'),
    ])
    const onStartStudy = jest.fn()

    render(
      <StudyModeSelector
        deck={deck}
        userId="user-1"
        onStartStudy={onStartStudy}
        onClose={jest.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('flashcards-study-mode-backlog'))
    fireEvent.click(screen.getByRole('button', { name: 'common.all' }))
    fireEvent.click(screen.getByTestId('flashcards-start-study'))

    const selected = onStartStudy.mock.calls[0][0] as FlashcardContent[]
    expect(selected.map(card => card.id)).toEqual(['r2', 'r1', 'r3', 'n1', 'n2'])
  })

  it('emits analytics event when backlog mode starts', () => {
    const deck = buildDeck([
      createReviewCard('r1', now - 10000),
      createReviewCard('r2', now - 5000),
      createNewCard('n1'),
      createNewCard('n2'),
    ])

    render(
      <StudyModeSelector
        deck={deck}
        userId="user-1"
        onStartStudy={jest.fn()}
        onClose={jest.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('flashcards-study-mode-backlog'))
    fireEvent.click(screen.getByRole('button', { name: 'common.all' }))
    fireEvent.click(screen.getByTestId('flashcards-start-study'))

    expect(emit).toHaveBeenCalledWith(
      ReviewEventType.ANALYTICS_TRACKED,
      expect.objectContaining({
        eventName: 'flashcards_backlog_mode_started',
        category: 'flashcards',
        properties: expect.objectContaining({
          deckId: 'deck-backlog',
          selectedCount: 4,
          backlogSize: 4,
        }),
      })
    )
  })
})
