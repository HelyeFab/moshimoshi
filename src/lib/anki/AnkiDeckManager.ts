/**
 * AnkiDeckManager - Persistence layer for imported Anki decks
 *
 * Storage Strategy:
 * - Free users: IndexedDB only (local persistence)
 * - Premium users: IndexedDB + Firebase (cross-device sync)
 *
 * This follows the same pattern as FlashcardManager for consistency.
 */

import { openDB, IDBPDatabase } from 'idb'
import { AnkiDeck, AnkiCard, AnkiDeckSettings, DEFAULT_ANKI_DECK_SETTINGS } from './importer'
import { AnkiMediaStore } from './mediaStore'

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
   */
  private async initDB(): Promise<IDBPDatabase<AnkiDeckDB>> {
    if (this.db) return this.db

    try {
      this.db = await openDB<AnkiDeckDB>('AnkiDecksDB', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('decks')) {
            const store = db.createObjectStore('decks', { keyPath: 'id' })
            store.createIndex('userId', 'userId')
            store.createIndex('updatedAt', 'updatedAt')
          }
        },
      })
      return this.db
    } catch (error) {
      console.error('[AnkiDeckManager] Failed to initialize IndexedDB:', error)
      throw new Error('Failed to initialize local storage for Anki decks')
    }
  }

  /**
   * Get all Anki decks for a user
   * Premium users fetch from Firebase first, then sync to IndexedDB
   * Free users use IndexedDB only
   */
  async getDecks(userId: string, isPremium: boolean): Promise<StoredAnkiDeck[]> {
    const db = await this.initDB()

    if (isPremium) {
      try {
        console.log('[AnkiDeckManager] Premium user - fetching from server')
        const response = await fetch('/api/anki/decks', {
          method: 'GET',
          credentials: 'include',
        })

        if (response.ok) {
          const { decks } = await response.json()
          console.log('[AnkiDeckManager] Server returned', decks?.length || 0, 'decks')

          // Sync all decks from server to IndexedDB
          const tx = db.transaction('decks', 'readwrite')
          const existingKeys = await tx.store.index('userId').getAllKeys(userId)
          for (const key of existingKeys) {
            await tx.store.delete(key)
          }
          if (decks && decks.length > 0) {
            for (const deck of decks) {
              await tx.store.put(deck)
            }
          }
          await tx.done

          return decks || []
        }
      } catch (error) {
        console.error('[AnkiDeckManager] Failed to fetch from server:', error)
        // Fall through to IndexedDB
      }
    }

    // Free users or offline: Use IndexedDB only
    console.log('[AnkiDeckManager] Using IndexedDB only')
    const decks = await db.getAllFromIndex('decks', 'userId', userId)
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
   * Premium users save to Firebase + IndexedDB
   * Free users save to IndexedDB only
   */
  async saveDeck(
    deck: AnkiDeck,
    userId: string,
    isPremium: boolean,
    filename?: string
  ): Promise<StoredAnkiDeck> {
    const db = await this.initDB()
    const now = Date.now()

    const storedDeck: StoredAnkiDeck = {
      ...deck,
      userId,
      cardCount: deck.cards.length,
      createdAt: now,
      updatedAt: now,
      settings: deck.settings || DEFAULT_ANKI_DECK_SETTINGS,
      source: 'anki', // Mark as Anki import for unified collection tracking
      metadata: {
        originalFilename: filename,
        importedAt: new Date().toISOString(),
        hasMedia: (deck.mediaUrls?.size || 0) > 0,
        ankiImport: true,
      },
    }

    // Convert Map to object for storage (Maps don't serialize well)
    const deckForStorage = {
      ...storedDeck,
      mediaUrls: storedDeck.mediaUrls ? Object.fromEntries(storedDeck.mediaUrls) : undefined,
    }

    // Save to Firebase for premium users
    if (isPremium && userId !== 'guest') {
      try {
        console.log('[AnkiDeckManager] Premium user - saving to Firebase')
        const response = await fetch('/api/anki/decks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(deckForStorage),
        })

        if (response.ok) {
          const responseData = await response.json()
          // API returns { success, data: { deck }, storage }
          const serverDeck = responseData.data?.deck || responseData.deck
          console.log('[AnkiDeckManager] Deck saved to Firebase:', serverDeck?.id)

          // Also save to IndexedDB for offline access
          if (serverDeck) {
            await db.put('decks', serverDeck)
            this.notifyListeners('decks-changed')
            return serverDeck
          }
        } else if (response.status === 403) {
          // Limit reached - throw error to be displayed to user
          const errorData = await response.json()
          console.error('[AnkiDeckManager] Import limit reached:', errorData)
          const error = new Error(errorData.message || 'Anki import limit reached')
          ;(error as any).code = 'LIMIT_REACHED'
          ;(error as any).currentCount = errorData.currentCount
          ;(error as any).limit = errorData.limit
          throw error
        } else {
          const error = await response.json()
          console.error('[AnkiDeckManager] Server error:', error)
          // Fall through to local-only save
        }
      } catch (error: any) {
        // Rethrow limit errors - don't fall through to local save
        if (error?.code === 'LIMIT_REACHED') {
          throw error
        }
        console.error('[AnkiDeckManager] Failed to save to server:', error)
        // Fall through to local-only save for other errors
      }
    }

    // Save to IndexedDB (for free users or as fallback)
    console.log('[AnkiDeckManager] Saving to IndexedDB only')
    await db.put('decks', deckForStorage as any)
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
      console.error('[AnkiDeckManager] Deck not found:', deckId)
      return null
    }

    const updatedDeck: StoredAnkiDeck = {
      ...deck,
      ...updates,
      updatedAt: Date.now(),
    }

    // Update on Firebase for premium users
    if (isPremium && userId !== 'guest') {
      try {
        const response = await fetch(`/api/anki/decks/${deckId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(updates),
        })

        if (response.ok) {
          const responseData = await response.json()
          const serverDeck = responseData.data?.deck || responseData.deck
          if (serverDeck) {
            await db.put('decks', serverDeck)
            this.notifyListeners('decks-changed')
            return serverDeck
          }
        }
      } catch (error) {
        console.error('[AnkiDeckManager] Failed to update on server:', error)
      }
    }

    // Update IndexedDB
    await db.put('decks', updatedDeck as any)
    this.notifyListeners('decks-changed')
    return updatedDeck
  }

  /**
   * Delete an Anki deck
   */
  async deleteDeck(deckId: string, userId: string, isPremium: boolean): Promise<boolean> {
    const db = await this.initDB()
    const deck = await this.getDeck(deckId, userId)

    if (!deck) {
      console.error('[AnkiDeckManager] Deck not found:', deckId)
      return false
    }

    // Delete from Firebase for premium users
    if (isPremium && userId !== 'guest') {
      try {
        const response = await fetch(`/api/anki/decks/${deckId}`, {
          method: 'DELETE',
          credentials: 'include',
        })

        if (response.ok) {
          await db.delete('decks', deckId)
          this.notifyListeners('decks-changed')
          return true
        }
      } catch (error) {
        console.error('[AnkiDeckManager] Failed to delete from server:', error)
      }
    }

    // Delete from IndexedDB
    await db.delete('decks', deckId)
    this.notifyListeners('decks-changed')
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
   * Sync all local decks to Firebase (for when user upgrades to premium)
   */
  async syncAllToFirebase(userId: string): Promise<{ synced: number; failed: number }> {
    const db = await this.initDB()
    const localDecks = await db.getAllFromIndex('decks', 'userId', userId)

    let synced = 0
    let failed = 0

    for (const deck of localDecks) {
      try {
        const response = await fetch('/api/anki/decks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(deck),
        })

        if (response.ok) {
          synced++
        } else {
          failed++
        }
      } catch (error) {
        console.error('[AnkiDeckManager] Failed to sync deck:', deck.id, error)
        failed++
      }
    }

    console.log(`[AnkiDeckManager] Sync complete: ${synced} synced, ${failed} failed`)
    return { synced, failed }
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
          console.log('[AnkiDeckManager] First card hydration:', {
            audioFilename: card.audioFilename,
            imageFilename: card.imageFilename,
            audioUrlHydrated: !!hydratedCard.audioUrl,
            imageUrlHydrated: !!hydratedCard.imageUrl,
          })
        }

        return hydratedCard
      })
    )

    console.log('[AnkiDeckManager] Media hydration complete:', {
      totalCards: deck.cards.length,
      hydratedAudio: hydratedAudioCount,
      hydratedImage: hydratedImageCount,
      missingAudio,
      missingImage,
    })

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
      console.error('[AnkiDeckManager] Deck not found:', deckId)
      return false
    }

    // Find and update the card
    const cardIndex = deck.cards.findIndex(c => c.id === cardId)
    if (cardIndex === -1) {
      console.error('[AnkiDeckManager] Card not found:', cardId)
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
        console.error('[AnkiDeckManager] Failed to update card on server:', error)
      }
    }

    // Update IndexedDB
    await db.put('decks', deck as any)
    return true
  }
}

// Export singleton instance
export const ankiDeckManager = AnkiDeckManager.getInstance()
