import { ankiDeckManager } from '@/lib/anki/AnkiDeckManager'
import type { AnkiDeck } from '@/lib/anki/importer'
import { getR2UploadQueue } from '@/lib/r2/R2UploadQueue'

require('fake-indexeddb/auto')

jest.mock('@/lib/r2/R2UploadQueue', () => ({
  getR2UploadQueue: jest.fn(),
}))

const userId = 'user-1'

const buildDeck = (id: string): AnkiDeck => ({
  id,
  name: `Deck ${id}`,
  description: 'Test deck',
  cards: [
    {
      id: `${id}-card-1`,
      front: 'front',
      back: 'back',
      tags: [],
      deckName: `Deck ${id}`,
    },
  ],
})

const deleteDb = async (name: string) => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => resolve()
  })
}

describe('AnkiDeckManager.setR2BackupEnabled', () => {
  beforeEach(async () => {
    const instance = ankiDeckManager as any
    if (instance.db) {
      instance.db.close()
      instance.db = null
    }

    await deleteDb('FlashcardDB')

    ;(getR2UploadQueue as jest.Mock).mockReturnValue({
      clearDeck: jest.fn(),
    })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(''),
    }) as any
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('disables R2 backup and cleans up remote data', async () => {
    const deck = buildDeck('deck-1')
    await ankiDeckManager.saveDeck(deck, userId, true, 'deck-1.apkg', true)

    const result = await ankiDeckManager.setR2BackupEnabled(deck.id, userId, true, false)

    expect(result).toBe('disabled')

    const stored = await ankiDeckManager.getDeck(deck.id, userId)
    expect(stored?.metadata?.r2BackupEnabled).toBe(false)

    const queue = (getR2UploadQueue as jest.Mock).mock.results[0]?.value
    expect(getR2UploadQueue).toHaveBeenCalledWith(userId)
    expect(queue.clearDeck).toHaveBeenCalledWith(deck.id, { markDeleted: true })

    const calls = (global.fetch as jest.Mock).mock.calls.map(call => call[0])
    expect(calls).toContain('/api/anki/r2/delete')
    expect(calls).toContain(`/api/anki/r2/metadata?deckId=${encodeURIComponent(deck.id)}`)
  })

  it('returns reimport_required when enabling backup without package', async () => {
    const deck = buildDeck('deck-2')
    await ankiDeckManager.saveDeck(deck, userId, true, 'deck-2.apkg', true)

    const db = await (ankiDeckManager as any).initDB()
    const stored = await db.get('decks', deck.id)
    await db.put('decks', {
      ...stored,
      metadata: {
        ...stored.metadata,
        r2BackupEnabled: false,
      },
    })

    const result = await ankiDeckManager.setR2BackupEnabled(deck.id, userId, true, true)

    expect(result).toBe('reimport_required')
    expect(getR2UploadQueue).not.toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns not_found for missing deck', async () => {
    const result = await ankiDeckManager.setR2BackupEnabled('missing', userId, true, false)
    expect(result).toBe('not_found')
  })
})
