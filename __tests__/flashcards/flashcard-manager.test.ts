import 'fake-indexeddb/auto'

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'uuid-1'),
}))

import { FlashcardManager } from '@/lib/flashcards/FlashcardManager'

jest.mock('@/lib/flashcards/StorageManager', () => ({
  storageManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
    calculateDeckSize: jest.fn().mockReturnValue(1),
    hasEnoughSpace: jest.fn().mockResolvedValue(true),
    handleStorageError: jest.fn((error: Error) => ({
      message: error.message,
    })),
  },
}))

describe('FlashcardManager.createDeck', () => {
  beforeAll(() => {
    jest.spyOn(FlashcardManager, 'getDeckLimits').mockReturnValue({
      maxDecks: -1,
      dailyReviews: -1,
    })
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  it('uses provided deck id and defaults source to user', async () => {
    const manager = new FlashcardManager()
    jest.spyOn(manager, 'getDecks').mockResolvedValue([])
    const deck = await manager.createDeck(
      {
        id: 'deck-1',
        name: 'Test Deck',
      },
      'user-1',
      false
    )

    expect(deck).toBeTruthy()
    expect(deck?.id).toBe('deck-1')
    expect(deck?.source).toBe('user')
    ;(manager as any).db?.close?.()
  })

  it('preserves provided card ids when creating a deck', async () => {
    const manager = new FlashcardManager()
    jest.spyOn(manager, 'getDecks').mockResolvedValue([])
    const deck = await manager.createDeck(
      {
        id: 'deck-2',
        name: 'Card Ids',
        initialCards: [
          {
            id: 'card-1',
            front: { text: 'Front 1' },
            back: { text: 'Back 1' },
          },
          {
            front: { text: 'Front 2' },
            back: { text: 'Back 2' },
          },
        ],
      },
      'user-1',
      false
    )

    expect(deck).toBeTruthy()
    expect(deck?.cards.length).toBe(2)
    expect(deck?.cards[0].id).toBe('card-1')
    expect(deck?.cards[1].id).toBeTruthy()
    expect(deck?.cards[1].id).not.toBe('card-1')
    ;(manager as any).db?.close?.()
  })
})
