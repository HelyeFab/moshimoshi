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
import type { DeckOrigin, DeckStats } from '@/types/flashcards'
import type { FeatureId } from '@/types/FeatureId'
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
  origin?: DeckOrigin
  stats: DeckStats // Stats for UI display
  metadata?: {
    originalFilename?: string
    importedAt: string
    hasMedia: boolean
    ankiImport?: boolean
    r2BackupEnabled?: boolean
    origin?: 'deckmarket'
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
      // IMPORTANT: Must match FlashcardManager version (currently 2)
      this.db = await openDB<AnkiDeckDB>('FlashcardDB', 3, {
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
      console.error('[AnkiDeckManager] Failed to initialize IndexedDB:', error)
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
    filename?: string,
    r2BackupEnabled: boolean = true
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

    if (!isPremium) {
      const isDeckMarketDeck = deck.origin === 'deckmarket'
      if (!isDeckMarketDeck) {
        const error = new Error('FREE_DECKMARKET_ONLY')
        ;(error as any).code = 'FREE_DECKMARKET_ONLY'
        throw error
      }

      const hasAnotherDeckMarketDeck = existingDecks.some(existing => {
        const existingOrigin = (existing as StoredAnkiDeck).origin
        return existingOrigin === 'deckmarket' && existing.id !== deck.id
      })

      if (hasAnotherDeckMarketDeck) {
        const error = new Error('DECKMARKET_LIMIT_REACHED')
        ;(error as any).code = 'DECKMARKET_LIMIT_REACHED'
        throw error
      }
    }

    const isNewDeck = !existingDecks.some(existing => existing.id === deck.id)
    const shouldCountDeckMarketUsage =
      isPremium && isNewDeck && deck.origin === 'deckmarket' && userId !== 'guest'
    if (shouldCountDeckMarketUsage) {
      await this.assertDeckMarketImportAllowed()
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
      origin: deck.origin,
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
        r2BackupEnabled,
        origin: deck.origin,
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

    if (shouldCountDeckMarketUsage) {
      // Do not block a successful import if usage increment fails.
      // A stable idempotency key keeps retries safe from double counting.
      try {
        await this.incrementDeckMarketImportUsage(deck.id)
      } catch (error) {
        debugLogger.error('Failed to increment deckmarket anki_imports usage', {
          deckId: deck.id,
          error,
        })
      }
    }

    debugLogger.success('Deck saved to IndexedDB!', {
      deckId: deck.id,
      deckName: deck.name,
      location: 'IndexedDB - Local Storage'
    })

    this.notifyListeners('decks-changed')

    return storedDeck
  }

  private async checkFeatureAccess(featureId: FeatureId): Promise<{ allow: boolean; reason?: string }> {
    const response = await fetch(`/api/usage/${featureId}/check`, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`Failed to check ${featureId} entitlement`)
    }

    const decision = await response.json()
    return {
      allow: !!decision?.allow,
      reason: typeof decision?.reason === 'string' ? decision.reason : undefined,
    }
  }

  private async trackFeatureUsage(featureId: FeatureId, idempotencyKey: string): Promise<void> {
    const response = await fetch(`/api/usage/${featureId}/increment`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey }),
    })

    if (!response.ok) {
      throw new Error(`Failed to increment ${featureId} usage`)
    }

    const decision = await response.json()
    if (!decision?.allow) {
      const errorCode =
        featureId === 'flashcard_decks' ? 'DECK_LIMIT_REACHED' : 'ANKI_IMPORT_LIMIT_REACHED'
      const error = new Error(errorCode)
      ;(error as any).code = errorCode
      ;(error as any).reason = decision?.reason
      throw error
    }
  }

  private async assertDeckMarketImportAllowed(): Promise<void> {
    const importLimitDecision = await this.checkFeatureAccess('anki_imports')
    if (!importLimitDecision.allow) {
      const error = new Error('ANKI_IMPORT_LIMIT_REACHED')
      ;(error as any).code = 'ANKI_IMPORT_LIMIT_REACHED'
      ;(error as any).reason = importLimitDecision.reason
      throw error
    }
  }

  private async incrementDeckMarketImportUsage(deckId: string): Promise<void> {
    const stableIdempotencyKey = `deckmarket-${deckId}`
    await this.trackFeatureUsage('anki_imports', stableIdempotencyKey)
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
    let deck = await this.getDeck(deckId, userId)

    if (!deck) {
      let fallback = await db.get('decks', deckId)
      if (!fallback && typeof deckId === 'string' && /^\d+$/.test(deckId)) {
        fallback = await db.get('decks', Number(deckId))
      }
      if (fallback) {
        debugLogger.error('Deck userId mismatch during deletion - using fallback by id', {
          deckId,
          requestedUserId: userId,
          deckUserId: (fallback as any).userId
        })
        deck = fallback as StoredAnkiDeck
      } else {
        debugLogger.error('Deck not found for deletion!', { deckId })
        return false
      }
    }

    debugLogger.step(1, 'Deleting from IndexedDB...', { deckName: deck.name })

    // Delete from IndexedDB
    await db.delete('decks', deckId)

    debugLogger.success('Deck deleted from IndexedDB!', { deckId, deckName: deck.name })

    debugLogger.queueStatus('Deleting local media files...', { deckId })
    const mediaStore = AnkiMediaStore.getInstance()
    const deletedMedia = await mediaStore.deleteMediaByDeck(deckId)
    debugLogger.success('Local media deleted!', { deckId, deletedMedia })

    // Fallback: legacy Anki media stored without deckId (unprefixed keys).
    if (deletedMedia === 0 && deck.source === 'anki') {
      const stripAnkiMediaKey = (key: string) => {
        const separatorIndex = key.indexOf('::')
        return separatorIndex >= 0 ? key.slice(separatorIndex + 2) : key
      }

      const collectRawFilenames = (cards: AnkiCard[]) => {
        const names = new Set<string>()
        for (const card of cards) {
          if (Array.isArray(card.media)) {
            for (const mediaKey of card.media) {
              if (typeof mediaKey === 'string') {
                names.add(stripAnkiMediaKey(mediaKey))
              }
            }
          }
          if (typeof (card as any).audioFilename === 'string') {
            names.add(stripAnkiMediaKey((card as any).audioFilename))
          }
          if (typeof (card as any).imageFilename === 'string') {
            names.add(stripAnkiMediaKey((card as any).imageFilename))
          }
        }
        return names
      }

      try {
        const otherDecks = await db.getAllFromIndex('decks', 'userId', userId)
        const otherReferenced = new Set<string>()

        for (const other of otherDecks) {
          if (other.id === deckId) continue
          const otherCards = (other as StoredAnkiDeck).cards || []
          for (const name of collectRawFilenames(otherCards)) {
            otherReferenced.add(name)
          }
        }

        const targetNames = collectRawFilenames(deck.cards)
        const safeDelete = new Set<string>()
        for (const name of targetNames) {
          if (!otherReferenced.has(name)) {
            safeDelete.add(name)
          }
        }

        if (safeDelete.size > 0) {
          const deletedLegacy = await mediaStore.deleteMediaByIds(safeDelete)
          if (deletedLegacy > 0) {
            debugLogger.success('Legacy media cleanup deleted unprefixed files', {
              deckId,
              deletedLegacy,
            })
          }
        }
      } catch (error) {
        debugLogger.error('Legacy media cleanup failed', { deckId, error })
      }
    }

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
            const cleanupStatus = result?.status || 'complete'
            debugLogger.success('Remote Anki backup cleanup completed!', {
              status: cleanupStatus,
              deletedCount: result.deletedCount,
              metadataDeleted: result.metadataDeleted,
              tombstoneWritten: result.tombstoneWritten,
              deckId
            })
            if (cleanupStatus === 'partial' || Array.isArray(result.errors) && result.errors.length > 0) {
              debugLogger.error('R2 delete completed with partial errors', {
                deckId,
                status: cleanupStatus,
                r2Error: result.r2Error,
                errors: result.errors,
              })
            }
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
   * Enable or disable R2 backup for a single Anki deck.
   * Disabling deletes the existing backup and clears queued uploads.
   * Enabling requires re-importing the deck to regenerate the .apkg.
   */
  async setR2BackupEnabled(
    deckId: string,
    userId: string,
    isPremium: boolean,
    enabled: boolean
  ): Promise<'disabled' | 'reimport_required' | 'not_found' | 'unchanged' | 'cleanup_failed'> {
    const db = await this.initDB()
    const deck = await this.getDeck(deckId, userId)

    if (!deck) {
      return 'not_found'
    }

    const currentEnabled = deck.metadata?.r2BackupEnabled !== false
    if (enabled === currentEnabled) {
      return 'unchanged'
    }

    if (!enabled) {
      const updatedDeck: StoredAnkiDeck = {
        ...deck,
        updatedAt: Date.now(),
        metadata: {
          originalFilename: deck.metadata?.originalFilename,
          importedAt: deck.metadata?.importedAt ?? new Date().toISOString(),
          hasMedia: deck.metadata?.hasMedia ?? false,
          ankiImport: deck.metadata?.ankiImport,
          r2BackupEnabled: false,
          origin: deck.metadata?.origin,
        },
      }

      await db.put('decks', updatedDeck as any)

      if (isPremium) {
        const cleaned = await this.cleanupR2Backup(deckId, userId)
        if (!cleaned) {
          this.notifyListeners('decks-changed')
          return 'cleanup_failed'
        }
      }

      this.notifyListeners('decks-changed')
      return 'disabled'
    }

    return 'reimport_required'
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

  private async cleanupR2Backup(deckId: string, userId: string): Promise<boolean> {
    try {
      const { getR2UploadQueue } = await import('@/lib/r2/R2UploadQueue')
      const queue = getR2UploadQueue(userId)
      await queue.clearDeck(deckId, { markDeleted: true })

      const deleteResponse = await fetch('/api/anki/r2/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ deckId }),
      })

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text()
        debugLogger.error('R2 delete API failed!', errorText)
      }
      let deleteResult: any = null
      if (deleteResponse.ok) {
        deleteResult = await deleteResponse.json().catch(() => null)
        if (deleteResult?.status === 'partial' || deleteResult?.errors?.length) {
          debugLogger.error('R2 delete completed with partial errors', {
            deckId,
            status: deleteResult?.status,
            r2Error: deleteResult?.r2Error,
            errors: deleteResult.errors,
          })
        }
      }
      return (
        deleteResponse.ok &&
        deleteResult?.status === 'complete' &&
        deleteResult?.metadataDeleted === true &&
        deleteResult?.tombstoneWritten === true &&
        !(Array.isArray(deleteResult?.errors) && deleteResult.errors.length > 0)
      )
    } catch (error) {
      debugLogger.error('R2 cleanup error!', error)
      return false
    }
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
