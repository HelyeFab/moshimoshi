import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { FlashcardManager } from '../FlashcardManager'
import { STARTER_DECKS } from '../starterDecks'
import type { FlashcardDeck } from '@/types/flashcards'

type StoreName = 'decks' | 'deletedDecks'

class FakeDB {
  objectStoreNames = {
    contains: (name: string) => name === 'decks' || name === 'deletedDecks',
  }

  private decks = new Map<string, FlashcardDeck>()
  private deletedDecks = new Map<string, { deckId: string; userId: string; deletedAt: number }>()

  reset() {
    this.decks.clear()
    this.deletedDecks.clear()
  }

  async getAllFromIndex(store: StoreName, _index: string, userId: string) {
    if (store === 'decks') {
      return Array.from(this.decks.values()).filter(deck => deck.userId === userId)
    }
    return Array.from(this.deletedDecks.values()).filter(item => item.userId === userId)
  }

  async get(store: StoreName, key: string) {
    if (store === 'decks') return this.decks.get(key) || null
    return this.deletedDecks.get(key) || null
  }

  async put(store: StoreName, value: any) {
    if (store === 'decks') {
      this.decks.set(value.id, value)
      return
    }
    this.deletedDecks.set(value.deckId, value)
  }

  async delete(store: StoreName, key: string) {
    if (store === 'decks') {
      this.decks.delete(key)
      return
    }
    this.deletedDecks.delete(key)
  }
}

const fakeDb = new FakeDB()

vi.mock('idb', () => ({
  openDB: vi.fn(async () => fakeDb),
}))

vi.mock('@/lib/flashcards/StorageManager', () => ({
  storageManager: {
    initialize: vi.fn(async () => {}),
    calculateDeckSize: vi.fn(() => 1),
    hasEnoughSpace: vi.fn(async () => true),
    handleStorageError: vi.fn((error: any) => ({ message: error?.message || 'error' })),
  },
}))

describe('FlashcardManager starter decks', () => {
  let manager: FlashcardManager

  beforeEach(() => {
    manager = new FlashcardManager()
    fakeDb.reset()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('seeds starter decks for new free users without calling server tombstones', async () => {
    const decks = await manager.ensureStarterDecks('user-1', false)

    expect(decks).toHaveLength(STARTER_DECKS.length)
    expect(decks.every(deck => deck.isStarter)).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('skips local tombstoned starter decks', async () => {
    const tombstonedId = STARTER_DECKS[0]?.id as string
    await fakeDb.put('deletedDecks', {
      deckId: tombstonedId,
      userId: 'user-1',
      deletedAt: Date.now(),
    })

    const decks = await manager.ensureStarterDecks('user-1', false)
    const deckIds = new Set(decks.map(deck => deck.id))

    expect(deckIds.has(tombstonedId)).toBe(false)
    expect(decks).toHaveLength(STARTER_DECKS.length - 1)
  })

  it('skips server tombstoned starter decks for premium users', async () => {
    const tombstonedId = STARTER_DECKS[0]?.id as string
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ deletedDeckIds: [tombstonedId] }),
    })

    const decks = await manager.ensureStarterDecks('user-1', true)
    const deckIds = new Set(decks.map(deck => deck.id))

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(deckIds.has(tombstonedId)).toBe(false)
    expect(decks).toHaveLength(STARTER_DECKS.length - 1)
  })

  it('does not seed when decks already exist', async () => {
    await fakeDb.put('decks', {
      id: 'existing-deck',
      userId: 'user-1',
      name: 'Existing',
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
        averageAccuracy: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalTimeSpent: 0,
        heatmapData: {},
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'user',
    })

    const decks = await manager.ensureStarterDecks('user-1', false)
    expect(decks).toHaveLength(1)
    expect(decks[0].id).toBe('existing-deck')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('backfills missing starter deck media without touching content', async () => {
    const baseStarter = STARTER_DECKS[0]
    if (!baseStarter) throw new Error('Missing starter deck')

    const strippedCards = baseStarter.initialCards?.map(card => {
      if (typeof card.front === 'string') return card
      return {
        ...card,
        front: {
          ...card.front,
          media: undefined,
        },
      }
    })

    await manager.createDeck(
      {
        ...baseStarter,
        isStarter: true,
        initialCards: strippedCards,
      },
      'user-1',
      true
    )

    let decks = await manager.getDecks('user-1', true)
    const starterDeck = decks.find(deck => deck.id === baseStarter.id)
    if (!starterDeck) throw new Error('Starter deck not found')

    const missingBefore = starterDeck.cards.filter(card => {
      if (typeof card.front === 'string') return false
      return !card.front.media
    })

    expect(missingBefore.length).toBeGreaterThan(0)

    decks = await manager.backfillStarterDeckMedia('user-1', decks)
    const updatedDeck = decks.find(deck => deck.id === baseStarter.id)
    if (!updatedDeck) throw new Error('Updated starter deck not found')

    const missingAfter = updatedDeck.cards.filter(card => {
      if (typeof card.front === 'string') return false
      return !card.front.media
    })

    expect(missingAfter.length).toBe(0)
  })
})
