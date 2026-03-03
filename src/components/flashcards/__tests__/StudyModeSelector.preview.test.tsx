/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StudyModeSelector } from '../StudyModeSelector'
import type { FlashcardDeck } from '@/types/flashcards'
import { useI18n } from '@/i18n/I18nContext'
import { useIsMobile } from '@/hooks/useMediaQuery'

jest.mock('@/i18n/I18nContext')
jest.mock('@/hooks/useMediaQuery')
jest.mock('@/lib/flashcards/mistakeReplay', () => ({
  mistakeReplayStore: {
    load: jest.fn(() => null),
    getCombinedCardIds: jest.fn(() => []),
  },
}))

const mockUseI18n = useI18n as jest.MockedFunction<typeof useI18n>
const mockUseIsMobile = useIsMobile as jest.MockedFunction<typeof useIsMobile>

describe('StudyModeSelector new deck recommendation', () => {
  const deck: FlashcardDeck = {
    id: 'deck-new',
    userId: 'user-1',
    name: 'New Deck',
    emoji: '📘',
    color: 'blue',
    cardStyle: 'minimal',
    cards: [
      { id: 'c1', front: 'A', back: 'B', metadata: { status: 'new' } },
      { id: 'c2', front: 'C', back: 'D', metadata: { status: 'new' } },
    ],
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

  beforeEach(() => {
    localStorage.clear()
    mockUseI18n.mockReturnValue({
      t: (key: string) => key,
      language: 'en',
    } as any)
    mockUseIsMobile.mockReturnValue(false as any)
  })

  it('defaults to preview and starts preview mode for brand new decks', () => {
    const onStartStudy = jest.fn()

    render(
      <StudyModeSelector
        deck={deck}
        userId="user-1"
        onStartStudy={onStartStudy}
        onClose={jest.fn()}
      />
    )

    expect(screen.getByText('flashcards.recommendedForNewDeck')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('flashcards-start-study'))

    expect(onStartStudy).toHaveBeenCalledTimes(1)
    expect(onStartStudy.mock.calls[0][0]).toHaveLength(2)
    expect(onStartStudy.mock.calls[0][1]).toBe('preview')
  })

  it('study mode on large all-new decks is not locked to the first 20 cards', () => {
    const onStartStudy = jest.fn()
    const largeDeck: FlashcardDeck = {
      ...deck,
      id: 'deck-large',
      cards: Array.from({ length: 40 }, (_, idx) => ({
        id: `c${idx + 1}`,
        front: `Front ${idx + 1}`,
        back: `Back ${idx + 1}`,
        metadata: { status: 'new' as const },
      })),
      stats: {
        ...deck.stats,
        totalCards: 40,
        newCards: 40,
      },
    }

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0)

    render(
      <StudyModeSelector
        deck={largeDeck}
        userId="user-1"
        onStartStudy={onStartStudy}
        onClose={jest.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('flashcards-study-mode-study'))
    fireEvent.click(screen.getByTestId('flashcards-start-study'))

    expect(onStartStudy).toHaveBeenCalledTimes(1)
    const selectedCards = onStartStudy.mock.calls[0][0] as Array<{ id: string }>
    expect(selectedCards).toHaveLength(20)
    expect(selectedCards.some(card => Number(card.id.slice(1)) > 20)).toBe(true)

    randomSpy.mockRestore()
  })

  it('study mode rotates cards across sessions without replacement for large all-new decks', () => {
    const onStartStudy = jest.fn()
    const largeDeck: FlashcardDeck = {
      ...deck,
      id: 'deck-rotate',
      updatedAt: 123456789,
      cards: Array.from({ length: 40 }, (_, idx) => ({
        id: `c${idx + 1}`,
        front: `Front ${idx + 1}`,
        back: `Back ${idx + 1}`,
        metadata: { status: 'new' as const },
      })),
      stats: {
        ...deck.stats,
        totalCards: 40,
        newCards: 40,
      },
    }

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0)

    const first = render(
      <StudyModeSelector
        deck={largeDeck}
        userId="user-1"
        onStartStudy={onStartStudy}
        onClose={jest.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('flashcards-study-mode-study'))
    fireEvent.click(screen.getByTestId('flashcards-start-study'))
    const firstSessionIds = new Set((onStartStudy.mock.calls[0][0] as Array<{ id: string }>).map(card => card.id))
    first.unmount()

    onStartStudy.mockClear()

    render(
      <StudyModeSelector
        deck={largeDeck}
        userId="user-1"
        onStartStudy={onStartStudy}
        onClose={jest.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('flashcards-study-mode-study'))
    fireEvent.click(screen.getByTestId('flashcards-start-study'))
    const secondSessionIds = new Set((onStartStudy.mock.calls[0][0] as Array<{ id: string }>).map(card => card.id))

    const overlap = Array.from(firstSessionIds).filter(id => secondSessionIds.has(id))
    expect(firstSessionIds.size).toBe(20)
    expect(secondSessionIds.size).toBe(20)
    expect(overlap).toHaveLength(0)

    randomSpy.mockRestore()
  })
})
