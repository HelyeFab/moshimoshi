/**
 * DeckMarket Gating & Starter Deck Removal Tests
 *
 * These tests cover the rules from the DeckMarket Integration decisions (2026-02-11):
 *   - Starter decks removed for both free and premium
 *   - Free users can have ONE DeckMarket deck at a time
 *   - Free users can delete and replace their DeckMarket deck
 *   - Premium users: DeckMarket decks are source: 'anki', excluded from flashcard_decks limits (count toward anki_imports)
 *   - Free users cannot create non-DeckMarket decks
 *
 * These tests are spec-first — they describe expected behavior that Agents 1-3 must implement.
 */
import type { FlashcardDeck } from '@/types/flashcards'

// ---------- Mocks (must be before imports that trigger FlashcardManager) ----------

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

jest.mock('idb', () => ({
  openDB: jest.fn(async () => fakeDb),
}))

jest.mock('@/lib/anki/mediaStore', () => ({
  AnkiMediaStore: jest.fn(),
}))

jest.mock('@/lib/flashcards/StorageManager', () => ({
  storageManager: {
    initialize: jest.fn(async () => {}),
    calculateDeckSize: jest.fn(() => 1),
    hasEnoughSpace: jest.fn(async () => true),
    handleStorageError: jest.fn((error: any) => ({ message: error?.message || 'error' })),
  },
}))

jest.mock('@/lib/flashcards/SRSHelper', () => ({
  FlashcardSRSHelper: {
    updateCardAfterReview: jest.fn(),
    sortByPriority: jest.fn(),
  },
}))

// ---- Now import the module under test ----
import { FlashcardManager } from '../FlashcardManager'

const USER_ID = 'test-user-1'

let deckIdCounter = 0

function makeDeckMarketRequest(overrides: Record<string, unknown> = {}) {
  deckIdCounter++
  return {
    id: `dm-deck-${deckIdCounter}`,
    name: 'Genki Vocab',
    emoji: '📘',
    color: 'blue',
    cardStyle: 'minimal' as const,
    source: 'anki' as const,
    origin: 'deckmarket' as const,
    initialCards: [
      { front: 'こんにちは', back: 'Hello' },
      { front: 'ありがとう', back: 'Thank you' },
    ],
    ...overrides,
  }
}

function makeUserDeckRequest(overrides: Record<string, unknown> = {}) {
  deckIdCounter++
  return {
    id: `user-deck-${deckIdCounter}`,
    name: 'My Custom Deck',
    emoji: '✏️',
    color: 'green',
    cardStyle: 'minimal' as const,
    initialCards: [{ front: 'Test', back: 'テスト' }],
    ...overrides,
  }
}

/** Seed a DeckMarket deck directly into FakeDB (bypasses createDeck gating). */
async function seedDeckMarketDeck(userId: string, id = 'dm-seeded-1') {
  const deck: FlashcardDeck = {
    id,
    userId,
    name: 'Seeded DM Deck',
    emoji: '📘',
    color: 'blue',
    cardStyle: 'minimal',
    source: 'anki',
    origin: 'deckmarket',
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
  }
  await fakeDb.put('decks', deck)
  return deck
}

/** Seed a normal user deck directly into FakeDB (bypasses createDeck flow). */
async function seedUserDeck(userId: string, id: string) {
  const deck: FlashcardDeck = {
    id,
    userId,
    name: `Seeded User Deck ${id}`,
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
      averageAccuracy: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalTimeSpent: 0,
      heatmapData: {},
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await fakeDb.put('decks', deck)
  return deck
}

function makeStarterDeck(userId: string, id = 'starter-v1-greetings'): FlashcardDeck {
  return {
    id,
    userId,
    name: 'Japanese Greetings',
    emoji: '👋',
    color: 'primary',
    cardStyle: 'minimal',
    source: 'user',
    isStarter: true,
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
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('FlashcardManager — DeckMarket gating (free tier)', () => {
  let manager: FlashcardManager

  beforeEach(() => {
    manager = new FlashcardManager()
    fakeDb.reset()
    deckIdCounter = 0
    global.fetch = jest.fn() as jest.Mock
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('allows a free user to create a deck with origin: deckmarket', async () => {
    const deck = await manager.createDeck(makeDeckMarketRequest(), USER_ID, false)

    expect(deck).not.toBeNull()
    expect(deck!.origin).toBe('deckmarket')
    expect(deck!.cards).toHaveLength(2)
  })

  it('rejects a free user creating a second DeckMarket deck', async () => {
    // Seed one DeckMarket deck already in storage
    await seedDeckMarketDeck(USER_ID)

    await expect(
      manager.createDeck(makeDeckMarketRequest({ name: 'Second DM Deck' }), USER_ID, false)
    ).rejects.toThrow()
  })

  it('allows a free user to delete their DeckMarket deck', async () => {
    await seedDeckMarketDeck(USER_ID, 'dm-to-delete')

    const result = await manager.deleteDeck('dm-to-delete', USER_ID, false)
    expect(result).toBe(true)

    const decks = await manager.getDecks(USER_ID, false)
    expect(decks.find(d => d.id === 'dm-to-delete')).toBeUndefined()
  })

  it('allows a free user to create a new DeckMarket deck after deleting the previous one', async () => {
    // Create first DeckMarket deck
    const first = await manager.createDeck(
      makeDeckMarketRequest({ id: 'dm-first' }),
      USER_ID,
      false
    )
    expect(first).not.toBeNull()

    // Delete it
    await manager.deleteDeck('dm-first', USER_ID, false)

    // Create a replacement
    const second = await manager.createDeck(
      makeDeckMarketRequest({ id: 'dm-second', name: 'Replacement Deck' }),
      USER_ID,
      false
    )
    expect(second).not.toBeNull()
    expect(second!.origin).toBe('deckmarket')
  })

  it('rejects a free user creating a non-DeckMarket, non-starter deck', async () => {
    await expect(
      manager.createDeck(makeUserDeckRequest(), USER_ID, false)
    ).rejects.toThrow()
  })

  it('preserves the origin marker on the stored deck', async () => {
    await manager.createDeck(makeDeckMarketRequest({ id: 'dm-check' }), USER_ID, false)

    const decks = await manager.getDecks(USER_ID, false)
    const deck = decks.find(d => d.id === 'dm-check')

    expect(deck).toBeDefined()
    expect(deck!.origin).toBe('deckmarket')
  })
})

describe('FlashcardManager — DeckMarket gating (premium tier)', () => {
  let manager: FlashcardManager

  beforeEach(() => {
    manager = new FlashcardManager()
    fakeDb.reset()
    deckIdCounter = 0
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as jest.Mock
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('allows a premium user to create a DeckMarket deck', async () => {
    const deck = await manager.createDeck(makeDeckMarketRequest(), USER_ID, true)

    expect(deck).not.toBeNull()
    expect(deck!.origin).toBe('deckmarket')
  })

  it('stores DeckMarket decks as source: anki, excluded from user-deck limit count', async () => {
    // DeckMarket decks are Anki imports (source: 'anki') so they are excluded from the
    // flashcard_decks monthly limit (which only counts source !== 'anki').
    // They count toward anki_imports limits instead.
    const deck = await manager.createDeck(makeDeckMarketRequest(), USER_ID, true)
    expect(deck).not.toBeNull()
    expect(deck!.source).toBe('anki')
    expect(deck!.origin).toBe('deckmarket')

    const decks = await manager.getDecks(USER_ID, true)

    // DeckMarket deck is present in full deck list
    expect(decks.some(d => d.origin === 'deckmarket')).toBe(true)

    // But excluded from user-deck count (source !== 'anki' filter)
    const userDecks = decks.filter(d => d.source !== 'anki')
    expect(userDecks.some(d => d.origin === 'deckmarket')).toBe(false)
  })

  it('allows premium creation even when local active user deck count already exceeds monthly quota', async () => {
    // Premium monthly quota is about creations tracked in entitlements, not local active inventory.
    // Seed many existing user decks; createDeck should still succeed locally.
    for (let i = 0; i < 12; i++) {
      await seedUserDeck(USER_ID, `seed-user-${i}`)
    }

    const created = await manager.createDeck(
      makeUserDeckRequest({ id: 'premium-after-many-local', source: 'user' }),
      USER_ID,
      true
    )

    expect(created).not.toBeNull()
    expect(created!.id).toBe('premium-after-many-local')
    expect(created!.source).toBe('user')
  })
})

describe('Starter deck removal (cleanupLegacyStarterDecks)', () => {
  let manager: FlashcardManager

  beforeEach(() => {
    manager = new FlashcardManager()
    fakeDb.reset()
    global.fetch = jest.fn() as jest.Mock
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns zero when no starter decks exist', async () => {
    const result = await manager.cleanupLegacyStarterDecks(USER_ID, false)
    expect(result.deleted).toBe(0)
  })

  it('deletes existing starter decks for free users', async () => {
    await fakeDb.put('decks', makeStarterDeck(USER_ID))

    const result = await manager.cleanupLegacyStarterDecks(USER_ID, false)
    expect(result.deleted).toBe(1)

    const decks = await manager.getDecks(USER_ID, false)
    const starters = decks.filter(d => d.isStarter === true)
    expect(starters).toHaveLength(0)
  })

  it('deletes existing starter decks for premium users', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
      text: async () => 'ok',
    })

    await fakeDb.put('decks', makeStarterDeck(USER_ID, 'starter-v1-numbers'))

    const result = await manager.cleanupLegacyStarterDecks(USER_ID, true)
    expect(result.deleted).toBe(1)

    const decks = await manager.getDecks(USER_ID, true)
    expect(decks.find(d => d.isStarter)).toBeUndefined()
  })

  it('tombstones removed starter decks to prevent sync resurrection', async () => {
    await fakeDb.put('decks', makeStarterDeck(USER_ID, 'starter-v1-numbers'))

    await manager.cleanupLegacyStarterDecks(USER_ID, false)

    // Tombstone should exist to prevent resurrection via sync/restore
    const tombstone = await fakeDb.get('deletedDecks', 'starter-v1-numbers')
    expect(tombstone).not.toBeNull()
    expect(tombstone!.deckId).toBe('starter-v1-numbers')
  })

  it('skips guest users', async () => {
    const result = await manager.cleanupLegacyStarterDecks('guest', false)
    expect(result.deleted).toBe(0)
  })

  it('does not delete non-starter decks', async () => {
    await seedDeckMarketDeck(USER_ID, 'dm-keep')

    const result = await manager.cleanupLegacyStarterDecks(USER_ID, false)
    expect(result.deleted).toBe(0)

    const decks = await manager.getDecks(USER_ID, false)
    expect(decks.find(d => d.id === 'dm-keep')).toBeDefined()
  })
})
