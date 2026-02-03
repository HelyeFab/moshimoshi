/**
 * AnkiDeckManager - Persistence layer for imported Anki decks
 *
 * Storage Strategy:
 * - IndexedDB only (local persistence)
 *
 * This provides unlimited deck sizes without cloud storage costs.
 */

import { openDB, IDBPDatabase } from 'idb'
import { AnkiDeck, AnkiCard, AnkiDeckSettings, DEFAULT_ANKI_DECK_SETTINGS } from './importer'
import { AnkiMediaStore } from './mediaStore'
import type { DeckStats } from '@/types/flashcards'
import { debugLogger } from '@/lib/debug-logger'

interface AnkiDeckDB {
  decks: AnkiDeck & { userId: string; createdAt: number; updatedAt: number }
}

export interface StoredAnkiDeck extends AnkiDeck {
  userId: string
  createdAt: number
  updatedAt: number
  cardCount: number
  settings: AnkiDeckSettings
  source: 'anki' // Track that this deck was imported from Anki
  stats: DeckStats // Stats for UI display
  metadata?: {
    originalFilename?: string
    importedAt: string
    hasMedia: boolean
    ankiImport?: boolean
  }
}

export class AnkiDeckManager {
  private static instance: AnkiDeckManager
  private db: IDBPDatabase<AnkiDeckDB> | null = null
  private listeners: Map<string, Set<() => void>> = new Map()

  private constructor() {}

  static getInstance(): AnkiDeckManager {
    if (!this.instance) {
      this.instance = new AnkiDeckManager()
    }
    return this.instance
  }

  /**
   * Initialize IndexedDB for Anki deck storage
   * Uses the same database as FlashcardManager ('FlashcardDB') for unified storage
   */
  private async initDB(): Promise<IDBPDatabase<AnkiDeckDB>> {
    if (this.db) return this.db

    try {
      // Use the same database as FlashcardManager for unified local storage
      this.db = await openDB<AnkiDeckDB>('FlashcardDB', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('decks')) {
            const store = db.createObjectStore('decks', { keyPath: 'id' })
            store.createIndex('userId', 'userId')
            store.createIndex('updatedAt', 'updatedAt')
            store.createIndex('sourceListId', 'sourceListId')
          }
        },
      })
      return this.db
    } catch (error) {
      throw new Error('Failed to initialize local storage for Anki decks')
    }
  }

  /**
   * Get all Anki decks for a user
   * Uses IndexedDB only for local persistence
   */
  async getDecks(userId: string, isPremium: boolean): Promise<StoredAnkiDeck[]> {
    const db = await this.initDB()
    const decks = await db.getAllFromIndex('decks', 'userId', userId)

    // Debug: Log deck structure from IndexedDB
    if (decks.length > 0) {
      const firstDeck = decks[0]
    }

    return decks.sort((a, b) => b.updatedAt - a.updatedAt) as StoredAnkiDeck[]
  }

  /**
   * Get a single deck by ID
   */
  async getDeck(deckId: string, userId: string): Promise<StoredAnkiDeck | null> {
    const db = await this.initDB()
    const deck = await db.get('decks', deckId)

    if (deck && deck.userId === userId) {
      return deck as StoredAnkiDeck
    }

    return null
  }

  /**
   * Save a newly imported Anki deck
   * Saves to IndexedDB only for local persistence
   */
  async saveDeck(
    deck: AnkiDeck,
    userId: string,
    isPremium: boolean,
    filename?: string
  ): Promise<StoredAnkiDeck> {
    debugLogger.step(1, 'Starting deck save', {
      deckId: deck.id,
      deckName: deck.name,
      cardCount: deck.cards.length,
      userId,
      isPremium
    })

    const db = await this.initDB()
    const now = Date.now()

    // Prevent duplicate deck names across all flashcard decks for this user.
    const existingDecks = await db.getAllFromIndex('decks', 'userId', userId)
    const hasNameConflict = existingDecks.some(existing =>
      existing.name === deck.name && existing.id !== deck.id
    )
    if (hasNameConflict) {
      debugLogger.error('Duplicate deck name detected!', { deckName: deck.name })
      const error = new Error('Deck name already exists')
      ;(error as any).code = 'DUPLICATE_DECK_NAME'
      throw error
    }

    debugLogger.step(2, 'No name conflicts, proceeding with save')

    const storedDeck: StoredAnkiDeck = {
      ...deck,
      userId,
      cardCount: deck.cards.length,
      createdAt: now,
      updatedAt: now,
      settings: deck.settings || DEFAULT_ANKI_DECK_SETTINGS,
      source: 'anki', // Mark as Anki import for unified collection tracking
      stats: {
        totalCards: deck.cards.length,
        newCards: deck.cards.length, // All cards are new on import
        learningCards: 0,
        reviewCards: 0,
        masteredCards: 0,
        totalStudied: 0,
        lastStudied: undefined,
        averageAccuracy: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalTimeSpent: 0,
      },
      metadata: {
        originalFilename: filename,
        importedAt: new Date().toISOString(),
        hasMedia: (deck.mediaBlobs?.size || 0) > 0,
        ankiImport: true,
      },
    }

    // Convert Map to object for storage (Maps don't serialize well)
    // Remove mediaBlobs Map but keep all other properties including cards
    const deckForStorage = {
      ...storedDeck,
      mediaBlobs: undefined, // Remove non-serializable Map
    }

    debugLogger.deckImport('Saving to IndexedDB...', {
      id: deck.id,
      name: deck.name,
      cards: deckForStorage.cards.length,
      hasMedia: storedDeck.metadata?.hasMedia
    })

    // Save to IndexedDB (local-only storage)
    await db.put('decks', deckForStorage as any)

    debugLogger.success('Deck saved to IndexedDB!', {
      deckId: deck.id,
      deckName: deck.name,
      location: 'IndexedDB - Local Storage'
    })

    this.notifyListeners('decks-changed')

    return storedDeck
  }

  /**
   * Update an existing deck
   */
  async updateDeck(
    deckId: string,
    updates: Partial<Pick<AnkiDeck, 'name' | 'description' | 'settings'>>,
    userId: string,
    isPremium: boolean
  ): Promise<StoredAnkiDeck | null> {
    const db = await this.initDB()
    const deck = await this.getDeck(deckId, userId)

    if (!deck) {
      return null
    }

    if (updates.name) {
      const existingDecks = await db.getAllFromIndex('decks', 'userId', userId)
      const hasNameConflict = existingDecks.some(existing =>
        existing.name === updates.name && existing.id !== deckId
      )
      if (hasNameConflict) {
        const error = new Error('Deck name already exists')
        ;(error as any).code = 'DUPLICATE_DECK_NAME'
        throw error
      }
    }

    const updatedDeck: StoredAnkiDeck = {
      ...deck,
      ...updates,
      updatedAt: Date.now(),
    }

    // Update IndexedDB
    await db.put('decks', updatedDeck as any)
    this.notifyListeners('decks-changed')
    return updatedDeck
  }

  /**
   * Delete an Anki deck
   */
  async deleteDeck(
    deckId: string,
    userId: string,
    isPremium: boolean,
    options: { skipRemote?: boolean } = {}
  ): Promise<boolean> {
    debugLogger.deckDelete('Starting deck deletion', {
      deckId,
      userId,
      isPremium,
      willDeleteR2: isPremium && !options.skipRemote
    })

    const db = await this.initDB()
    const deck = await this.getDeck(deckId, userId)

    if (!deck) {
      debugLogger.error('Deck not found for deletion!', { deckId })
      return false
    }

    debugLogger.step(1, 'Deleting from IndexedDB...', { deckName: deck.name })

    // Delete from IndexedDB
    await db.delete('decks', deckId)

    debugLogger.success('Deck deleted from IndexedDB!', { deckId, deckName: deck.name })

    debugLogger.queueStatus('Deleting local media files...', { deckId })
    const mediaStore = AnkiMediaStore.getInstance()
    const deletedMedia = await mediaStore.deleteMediaByDeck(deckId)
    debugLogger.success('Local media deleted!', { deckId, deletedMedia })

    // If premium user, delete R2 backup files and metadata
    if (isPremium) {
      debugLogger.step(2, 'User is premium - starting R2 cleanup...')

      try {
        // Clear upload queue jobs
        const { getR2UploadQueue } = await import('@/lib/r2/R2UploadQueue')
        const queue = getR2UploadQueue(userId)
        await queue.clearDeck(deckId, { markDeleted: true })
        debugLogger.success('Upload queue cleared!', { deckId })

        if (!options.skipRemote) {
          // Delete R2 files via API
          debugLogger.r2Delete('Calling R2 delete API...', { deckId })

          const deleteResponse = await fetch('/api/anki/r2/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ deckId }),
          })

          if (!deleteResponse.ok) {
            const errorText = await deleteResponse.text()
            debugLogger.error('R2 delete API failed!', errorText)
          } else {
            const result = await deleteResponse.json()
            debugLogger.success('R2 files deleted!', {
              deletedCount: result.deletedCount,
              deckId
            })
          }

          // Delete metadata from Firestore
          debugLogger.step(3, 'Deleting Firestore metadata...')

          const metadataResponse = await fetch('/api/anki/r2/metadata', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ deckId }),
          })

          if (!metadataResponse.ok) {
            const errorText = await metadataResponse.text()
            debugLogger.error('Metadata delete failed!', errorText)
          } else {
            debugLogger.success('Metadata deleted from Firestore!', { deckId })
          }
        } else {
          debugLogger.queueStatus('Skipping remote delete (tombstone-driven cleanup)', { deckId })
        }
      } catch (error) {
        debugLogger.error('R2 cleanup error!', error)
        // Don't fail the whole operation if R2 delete fails
      }
    } else {
      debugLogger.queueStatus('User is free tier - skipping R2 cleanup')
    }

    this.notifyListeners('decks-changed')

    debugLogger.success('DECK DELETION COMPLETE!', {
      deckId,
      deckName: deck.name,
      r2Cleaned: isPremium
    })

    return true
  }

  /**
   * Subscribe to deck changes
   */
  subscribe(event: string, callback: () => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)

    return () => {
      this.listeners.get(event)?.delete(callback)
    }
  }

  /**
   * Notify all listeners of a change
   */
  private notifyListeners(event: string): void {
    this.listeners.get(event)?.forEach(callback => callback())
  }


  /**
   * Clear all local data (for logout)
   */
  async clearLocalData(): Promise<void> {
    const db = await this.initDB()
    await db.clear('decks')
    this.notifyListeners('decks-changed')
  }

  /**
   * Hydrate media URLs for a deck's cards
   * This re-creates blob URLs from stored media files
   */
  async hydrateMediaUrls(deck: StoredAnkiDeck): Promise<StoredAnkiDeck> {
    const mediaStore = AnkiMediaStore.getInstance()

    let hydratedAudioCount = 0
    let hydratedImageCount = 0
    let missingAudio = 0
    let missingImage = 0

    const hydratedCards = await Promise.all(
      deck.cards.map(async (card, index) => {
        const hydratedCard = { ...card }

        // Re-hydrate audio URL from stored filename
        if (card.audioFilename) {
          const audioUrl = await mediaStore.getMediaUrl(card.audioFilename)
          if (audioUrl) {
            hydratedCard.audioUrl = audioUrl
            hydratedAudioCount++
          } else {
            missingAudio++
          }
        }

        // Re-hydrate image URL from stored filename
        if (card.imageFilename) {
          const imageUrl = await mediaStore.getMediaUrl(card.imageFilename)
          if (imageUrl) {
            hydratedCard.imageUrl = imageUrl
            hydratedImageCount++
          } else {
            missingImage++
          }
        }

        // Log first card
        if (index === 0) {
        }

        return hydratedCard
      })
    )


    return {
      ...deck,
      cards: hydratedCards,
    }
  }

  /**
   * Get a deck with hydrated media URLs
   */
  async getDeckWithMedia(deckId: string, userId: string): Promise<StoredAnkiDeck | null> {
    const deck = await this.getDeck(deckId, userId)
    if (!deck) return null

    return this.hydrateMediaUrls(deck)
  }

  /**
   * Update a card's SRS data after review
   */
  async updateCard(
    deckId: string,
    cardId: string,
    updates: Partial<AnkiCard>,
    userId: string,
    isPremium: boolean
  ): Promise<boolean> {
    const db = await this.initDB()
    const deck = await this.getDeck(deckId, userId)

    if (!deck) {
      return false
    }

    // Find and update the card
    const cardIndex = deck.cards.findIndex(c => c.id === cardId)
    if (cardIndex === -1) {
      return false
    }

    deck.cards[cardIndex] = {
      ...deck.cards[cardIndex],
      ...updates,
    }
    deck.updatedAt = Date.now()

    // Save updated deck
    if (isPremium && userId !== 'guest') {
      try {
        const response = await fetch(`/api/anki/decks/${deckId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ cards: deck.cards }),
        })

        if (response.ok) {
          await db.put('decks', deck as any)
          return true
        }
      } catch (error) {
      }
    }

    // Update IndexedDB
    await db.put('decks', deck as any)
    return true
  }
}

// Export singleton instance
export const ankiDeckManager = AnkiDeckManager.getInstance()
