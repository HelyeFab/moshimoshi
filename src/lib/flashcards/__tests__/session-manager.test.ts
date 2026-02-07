import { describe, it, expect } from 'vitest'
import { sessionManager } from '../SessionManager'
import type { FlashcardDeck, SessionStats } from '@/types/flashcards'

const buildDeck = (id: string, name: string): FlashcardDeck => ({
  id,
  userId: 'user-1',
  name,
  description: '',
  emoji: '🎴',
  color: 'primary',
  cardStyle: 'minimal',
  source: 'user',
  cards: [],
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
    totalCards: 0,
    newCards: 0,
    learningCards: 0,
    reviewCards: 0,
    masteredCards: 0,
    totalStudied: 0,
    lastStudied: undefined,
    averageAccuracy: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalTimeSpent: 0,
    heatmapData: {},
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

const buildSession = (overrides: Partial<SessionStats>): SessionStats => ({
  id: overrides.id || 'sess',
  userId: 'user-1',
  deckId: 'deck-1',
  deckName: 'Deck',
  timestamp: Date.now(),
  duration: 60000,
  cardsStudied: 20,
  cardsCorrect: 18,
  cardsIncorrect: 2,
  cardsSkipped: 0,
  accuracy: 0.9,
  newCards: 5,
  learningCards: 10,
  reviewCards: 5,
  averageResponseTime: 1500,
  fastestResponseTime: 800,
  slowestResponseTime: 2500,
  xpEarned: 0,
  streakSnapshot: 0,
  perfectSession: false,
  ...overrides,
})

describe('FlashcardSessionManager.getLearningInsights', () => {
  it('filters strongest/weakest topics to existing decks', async () => {
    const deckA = buildDeck('deck-a', 'Deck A')
    const deckB = buildDeck('deck-b', 'Deck B')

    const sessions: SessionStats[] = [
      buildSession({ id: 'a-1', deckId: deckA.id, deckName: 'Old A', accuracy: 0.9 }),
      buildSession({ id: 'a-2', deckId: deckA.id, deckName: 'Old A', accuracy: 0.95 }),
      buildSession({ id: 'a-3', deckId: deckA.id, deckName: 'Old A', accuracy: 0.85 }),
      buildSession({ id: 'b-1', deckId: deckB.id, deckName: 'Deck B', accuracy: 0.4 }),
      buildSession({ id: 'b-2', deckId: deckB.id, deckName: 'Deck B', accuracy: 0.3 }),
      buildSession({ id: 'b-3', deckId: deckB.id, deckName: 'Deck B', accuracy: 0.2 }),
    ]

    const insights = await sessionManager.getLearningInsights('user-1', sessions, [deckA])

    expect(insights.strongestTopics).toEqual(['Deck A'])
    expect(insights.weakestTopics).toEqual([])
  })
})
