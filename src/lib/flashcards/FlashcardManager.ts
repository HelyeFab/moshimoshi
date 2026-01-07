import type {
  FlashcardDeck,
  FlashcardContent,
  CreateDeckRequest,
  UpdateDeckRequest,
  AddCardRequest,
  UpdateCardRequest,
  ImportDeckRequest,
  ExportDeckRequest,
  DeckStats,
  CardSide,
  CardStatus,
  SessionStats,
} from '@/types/flashcards'
import type { UserList, ListItem } from '@/types/userLists'
import type { AnkiDeck } from '@/lib/anki/importer'
import { AnkiMediaStore } from '@/lib/anki/mediaStore'
import { openDB, IDBPDatabase } from 'idb'
import { v4 as uuidv4 } from 'uuid'
import { syncManager } from './SyncManager'
import { storageManager } from './StorageManager'
import { FlashcardSRSHelper } from './SRSHelper'
import featuresConfig from '../../../config/features.v1.json'
import type { PlanType } from '@/lib/access/permissionMap'

interface FlashcardDB {
  decks: FlashcardDeck
}

export class FlashcardManager {
  private db: IDBPDatabase<FlashcardDB> | null = null
  private syncTimer: NodeJS.Timeout | null = null
  private listeners: Map<string, Set<() => void>> = new Map()

  /**
   * Hydrate media URLs for Anki deck cards from IndexedDB.
   * This recreates blob URLs from stored media files.
   *
   * @deprecated Use useMediaHydration hook for lazy loading instead.
   * This method hydrates all cards upfront which is slow for large decks.
   * Components should use useMediaHydration hook to hydrate media on-demand.
   */
  private async hydrateAnkiMedia(deck: FlashcardDeck): Promise<FlashcardDeck> {
    const mediaStore = AnkiMediaStore.getInstance()

    // Check media stats first
    const mediaStats = await mediaStore.getStats()
    console.log('[FlashcardManager.hydrateAnkiMedia] IndexedDB media stats:', mediaStats)

    let hydratedAudioCount = 0
    let hydratedImageCount = 0

    const hydratedCards = await Promise.all(
      deck.cards.map(async (card, index) => {
        const audioFilename = (card.metadata as any)?.audioFilename
        const imageFilename = (card.metadata as any)?.imageFilename

        let audioUrl: string | undefined
        let imageUrl: string | undefined

        if (audioFilename) {
          audioUrl = (await mediaStore.getMediaUrl(audioFilename)) || undefined
          if (audioUrl) hydratedAudioCount++
        }
        if (imageFilename) {
          imageUrl = (await mediaStore.getMediaUrl(imageFilename)) || undefined
          if (imageUrl) hydratedImageCount++

          // Debug first few cards
          if (index < 3) {
            console.log(`[FlashcardManager.hydrateAnkiMedia] Card ${index}:`, {
              imageFilename,
              imageUrl: imageUrl ? 'hydrated' : 'NOT FOUND',
              audioFilename,
              audioUrl: audioUrl ? 'hydrated' : 'NOT FOUND',
            })
          }
        }

        // Update card with hydrated URLs
        return {
          ...card,
          back: {
            ...card.back,
            media: audioUrl ? { type: 'audio' as const, url: audioUrl } : card.back.media,
          },
          front: {
            ...card.front,
            media: imageUrl ? { type: 'image' as const, url: imageUrl } : card.front.media,
          },
          metadata: {
            ...card.metadata,
            audioUrl,
            imageUrl,
          },
        }
      })
    )

    console.log('[FlashcardManager.hydrateAnkiMedia] Hydration complete:', {
      totalCards: deck.cards.length,
      hydratedAudioCount,
      hydratedImageCount,
    })

    return {
      ...deck,
      cards: hydratedCards,
    }
  }

  /**
   * Normalize an Anki card to match FlashcardContent structure.
   * Anki cards have front/back as strings, but FlashcardContent expects them as CardSide objects.
   * Note: blob URLs are not preserved as they expire. Use audioFilename/imageFilename to hydrate from IndexedDB.
   */
  private normalizeAnkiCard(card: any): FlashcardContent {
    // If already normalized (front is an object with text), return as-is
    if (card.front && typeof card.front === 'object' && 'text' in card.front) {
      return card
    }

    // Don't use blob URLs as they expire - media must be hydrated from IndexedDB using filenames
    const hasValidImageUrl = card.imageUrl && !card.imageUrl.startsWith('blob:')
    const hasValidAudioUrl = card.audioUrl && !card.audioUrl.startsWith('blob:')

    // Get the Japanese expression and meaning
    const expression = card.front || card.expression || ''
    const reading = card.reading || ''
    const meaning = card.back || card.meaning || ''

    // Transform Anki card structure to FlashcardContent
    // Front: Japanese word with reading
    // Back: Japanese word (prominent) with meaning as subtext
    return {
      id: card.id,
      front: {
        text: expression,
        subtext: reading || undefined,
        media: hasValidImageUrl ? { type: 'image', url: card.imageUrl } : undefined,
      },
      back: {
        text: expression,  // Japanese word first (prominent)
        subtext: meaning,  // English meaning below
        media: hasValidAudioUrl ? { type: 'audio', url: card.audioUrl } : undefined,
      },
      metadata: {
        status: card.metadata?.status || 'new',
        reading,  // Store reading for TTS/display
        meaning,  // Store meaning for reference
        // Store filenames for later hydration from IndexedDB
        audioFilename: card.audioFilename,
        imageFilename: card.imageFilename,
        audioUrl: hasValidAudioUrl ? card.audioUrl : undefined,
        imageUrl: hasValidImageUrl ? card.imageUrl : undefined,
        tags: card.tags,
        // Furigana support
        furiganaFront: card.furiganaFront,
        furiganaBack: card.furiganaBack,
        hasNativeFurigana: card.hasNativeFurigana,
        // Preserve Anki-specific metadata
        ...(card.metadata || {}),
      },
    }
  }

  // Initialize IndexedDB
  private async initDB(): Promise<IDBPDatabase<FlashcardDB>> {
    if (this.db) return this.db

    // Initialize storage manager first
    await storageManager.initialize()

    // Request persistent storage to protect flashcard data from eviction
    // This is especially important for users with large decks
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        const persisted = await navigator.storage.persisted()
        if (!persisted) {
          const granted = await navigator.storage.persist()
          if (granted) {
            console.log('[FlashcardManager] Persistent storage granted')
          } else {
            console.warn('[FlashcardManager] Persistent storage denied - data may be evicted under storage pressure')
          }
        }
      } catch (error) {
        console.warn('[FlashcardManager] Failed to request persistent storage:', error)
      }
    }

    try {
      this.db = await openDB<FlashcardDB>('FlashcardDB', 1, {
        upgrade(db) {
          // Decks store
          if (!db.objectStoreNames.contains('decks')) {
            const decksStore = db.createObjectStore('decks', { keyPath: 'id' })
            decksStore.createIndex('userId', 'userId')
            decksStore.createIndex('updatedAt', 'updatedAt')
            decksStore.createIndex('sourceListId', 'sourceListId')
          }

          // Note: Sync queue moved to SyncManager
        },
      })

      return this.db
    } catch (error) {
      const handled = storageManager.handleStorageError(error)
      throw new Error(handled.message)
    }
  }

  // Get all decks for a user
  async getDecks(
    userId: string,
    isPremium: boolean,
    retryOnAuthFailure: boolean = true
  ): Promise<FlashcardDeck[]> {
    console.log('🔥🔥🔥 [FlashcardManager.getDecks] CALLED with userId:', userId, 'isPremium:', isPremium)
    const db = await this.initDB()

    // Check if Firebase sync is enabled for Anki imports (feature flag)
    const ankiImportsFeature = featuresConfig.features.find(f => f.id === 'anki_imports')
    const enableFirebaseSync = ankiImportsFeature?.metadata?.enableFirebaseSync === true

    // Premium users: Try server first, sync to IndexedDB (only if Firebase sync is enabled)
    if (enableFirebaseSync && isPremium) {
      try {
        console.log('[FlashcardManager.getDecks] Premium user - fetching from server')
        const response = await fetch('/api/flashcards/decks', {
          method: 'GET',
          credentials: 'include',
        })

        if (response.ok) {
          let { decks } = await response.json()
          console.log('[FlashcardManager.getDecks] Server returned', decks?.length || 0, 'decks')

          // Normalize Anki-imported decks to match FlashcardContent structure
          decks = decks?.map((deck: any) => {
            if (deck.source === 'anki' && deck.cards?.length > 0) {
              console.log('[FlashcardManager.getDecks] Normalizing Anki deck:', deck.name)
              return {
                ...deck,
                cards: deck.cards.map((card: any) => this.normalizeAnkiCard(card))
              }
            }
            return deck
          }) || []

          // Note: Media hydration is now lazy-loaded by components using useMediaHydration hook
          // This improves deck load performance from 2-3s (100 cards) to <50ms
          // Components hydrate media on-demand as cards are displayed

          if (decks?.[0]) {
            console.log('[FlashcardManager.getDecks] First deck after normalization:', {
              id: decks[0].id,
              name: decks[0].name,
              source: decks[0].source,
              cardsLength: decks[0].cards?.length,
              firstCardFront: decks[0].cards?.[0]?.front
            })
          }

          // Sync all decks from server to IndexedDB
          try {
            const tx = db.transaction('decks', 'readwrite')
            // Clear existing decks for this user
            const existingDecks = await tx.store.index('userId').getAllKeys(userId)

            // Batch all operations with Promise.all for better performance
            await Promise.all([
              ...existingDecks.map(key => tx.store.delete(key)),
              ...(decks || []).map((deck: FlashcardDeck) => tx.store.put(deck))
            ])

            await tx.done
          } catch (error: any) {
            if (error?.name === 'QuotaExceededError') {
              const handled = storageManager.handleStorageError(error)
              throw new Error(handled.message)
            }
            throw error
          }

          return decks || []
        } else {
          // Auth race on first load: retry once after a short delay when unauthorized/forbidden
          if (retryOnAuthFailure && (response.status === 401 || response.status === 403)) {
            console.warn('[FlashcardManager.getDecks] Auth not ready (status', response.status, ') retrying after refresh...')
            // Try refreshing session (best-effort)
            try {
              await fetch('/api/auth/refresh-session', { method: 'POST', credentials: 'include' })
            } catch (refreshErr) {
              console.warn('[FlashcardManager.getDecks] Session refresh failed:', refreshErr)
            }
            await new Promise(resolve => setTimeout(resolve, 300))
            return this.getDecks(userId, isPremium, false)
          }
          console.error(
            '[FlashcardManager.getDecks] Server returned error:',
            response.status,
            await response.text()
          )
        }
      } catch (error) {
        console.error('[FlashcardManager.getDecks] Failed to fetch from server:', error)
        // Fall through to use IndexedDB for offline premium users
      }
    }

    // Free users, offline premium users, or Firebase sync disabled: Use IndexedDB only
    if (!enableFirebaseSync && isPremium) {
      console.log('[FlashcardManager.getDecks] ✅ Firebase sync is DISABLED - using IndexedDB only')
      console.log('[FlashcardManager.getDecks] 💡 This enables unlimited deck sizes without cloud storage costs')
      console.log('[FlashcardManager.getDecks] 💡 To enable Firebase sync, set enableFirebaseSync: true in config/features.v1.json')
    } else {
      console.log('[FlashcardManager.getDecks] Using IndexedDB only')
    }
    const decks = await db.getAllFromIndex('decks', 'userId', userId)
    return decks.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  // Get a single deck by ID
  async getDeck(deckId: string, userId: string): Promise<FlashcardDeck | null> {
    const db = await this.initDB()
    const deck = await db.get('decks', deckId)

    if (deck && deck.userId === userId) {
      return deck
    }

    return null
  }

  // Create a new deck
  async createDeck(
    request: CreateDeckRequest,
    userId: string,
    isPremium: boolean
  ): Promise<FlashcardDeck | null> {
    const db = await this.initDB()
    const now = Date.now()

    // Check storage quota before creating deck
    const estimatedSize = storageManager.calculateDeckSize({
      ...request,
      cards: request.initialCards || [],
      userId,
    })

    const hasSpace = await storageManager.hasEnoughSpace(estimatedSize)
    if (!hasSpace) {
      const error = new Error('QuotaExceededError: Insufficient storage space')
      error.name = 'QuotaExceededError'
      throw error
    }

    const deck: FlashcardDeck = {
      id: uuidv4(),
      userId,
      name: request.name,
      description: request.description,
      emoji: request.emoji || '🎴',
      color: request.color || 'primary',
      cardStyle: request.cardStyle || 'minimal',
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
        reviewsPerDay: 20,
        ...request.settings,
      },
      stats: this.createInitialStats(),
      createdAt: now,
      updatedAt: now,
      sourceListId: request.sourceListId,
    }

    // Add initial cards if provided
    if (request.initialCards) {
      deck.cards = request.initialCards.map(card => ({
        id: uuidv4(),
        front: card.front as CardSide,
        back: card.back as CardSide,
        metadata: card.metadata,
      }))
      deck.stats.totalCards = deck.cards.length
      deck.stats.newCards = deck.cards.length
    }

    // Save to server ONLY for premium users
    console.log('[FlashcardManager.createDeck] isPremium:', isPremium, 'userId:', userId)
    if (isPremium && userId !== 'guest') {
      try {
        console.log('[FlashcardManager.createDeck] Saving to Firebase...')
        const response = await fetch('/api/flashcards/decks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(request),
        })

        console.log('[FlashcardManager.createDeck] Response status:', response.status)
        if (response.ok) {
          const responseData = await response.json()
          // Response is wrapped by createStorageResponse: { success, data: { deck }, storage }
          const serverDeck = responseData.data?.deck || responseData.deck
          console.log('[FlashcardManager.createDeck] Deck saved to Firebase:', serverDeck?.id)
          try {
            await db.put('decks', serverDeck)
          } catch (error: any) {
            if (error?.name === 'QuotaExceededError') {
              const handled = storageManager.handleStorageError(error)
              throw new Error(handled.message)
            }
            throw error
          }
          this.notifyListeners('decks-changed')
          return serverDeck
        } else {
          let errorMessage = 'Failed to create deck on server'
          let parsedError: any = {}
          try {
            const errorData = await response.text()
            parsedError = errorData ? JSON.parse(errorData) : {}
            errorMessage = parsedError.error || errorMessage
            console.error('[FlashcardManager.createDeck] Server error:', {
              status: response.status,
              statusText: response.statusText,
              error: parsedError,
            })
          } catch (parseError) {
            console.error(
              '[FlashcardManager.createDeck] Failed to parse error response:',
              parseError
            )
          }

          // If it's a 403 (deck limit), throw an error with the limit data
          if (response.status === 403) {
            const limitError = new Error(errorMessage) as any
            limitError.code = 'LIMIT_REACHED'
            limitError.currentCount = parsedError.currentCount
            limitError.limit = parsedError.limit
            throw limitError
          }
        }
      } catch (error: any) {
        console.error('Failed to create deck on server:', error)

        // Re-throw limit errors - don't queue or save locally
        if (error?.code === 'LIMIT_REACHED') {
          throw error
        }

        // Queue for retry
        await syncManager.queueOperation({
          action: 'create',
          deckId: deck.id,
          data: request,
          userId,
        })

        // Still save locally for offline access
        try {
          await db.put('decks', deck)
        } catch (error: any) {
          if (error?.name === 'QuotaExceededError') {
            const handled = storageManager.handleStorageError(error)
            throw new Error(handled.message)
          }
          throw error
        }
        this.notifyListeners('decks-changed')
        return deck
      }
    } else {
      console.log('[FlashcardManager.createDeck] Guest user - saving to IndexedDB only')
    }

    // For free users and guests: Save to IndexedDB only
    try {
      await db.put('decks', deck)
      this.notifyListeners('decks-changed')
    } catch (error) {
      const handled = storageManager.handleStorageError(error)
      throw new Error(handled.message)
    }

    // Queue for future sync if user upgrades
    if (userId !== 'guest') {
      await syncManager.queueOperation({
        action: 'create',
        deckId: deck.id,
        data: deck,
        userId,
      })
    }

    return deck
  }

  // Update existing deck (renamed to avoid collision)
  async updateFullDeck(
    deckId: string,
    request: CreateDeckRequest,
    userId: string,
    isPremium: boolean
  ): Promise<FlashcardDeck | null> {
    const db = await this.initDB()
    const now = Date.now()

    // Get existing deck
    const existingDeck = await db.get('decks', deckId)
    if (!existingDeck || existingDeck.userId !== userId) {
      console.error('[FlashcardManager.updateDeck] Deck not found or unauthorized')
      return null
    }

    // Update deck properties
    const updatedDeck: FlashcardDeck = {
      ...existingDeck,
      name: request.name,
      description: request.description,
      emoji: request.emoji || existingDeck.emoji,
      color: request.color || existingDeck.color,
      cardStyle: request.cardStyle || existingDeck.cardStyle,
      settings: {
        ...existingDeck.settings,
        ...request.settings,
      },
      updatedAt: now,
    }

    // Update cards if provided
    if (request.initialCards && request.initialCards.length > 0) {
      updatedDeck.cards = request.initialCards.map(card => ({
        id: uuidv4(),
        front: card.front,
        back: card.back,
        metadata: card.metadata,
      }))
      updatedDeck.stats.totalCards = updatedDeck.cards.length
      updatedDeck.stats.newCards = updatedDeck.cards.length
    }

    // For premium users, also update on server
    if (isPremium && userId !== 'guest') {
      try {
        console.log('[FlashcardManager.updateDeck] Premium user - syncing with Firebase')
        const response = await fetch(`/api/flashcards/decks/${deckId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        })

        if (response.ok) {
          const responseData = await response.json()
          // Response is wrapped by createStorageResponse: { success, data: { deck }, storage }
          const serverDeck = responseData.data?.deck || responseData.deck
          console.log('[FlashcardManager.updateDeck] Deck updated on Firebase:', serverDeck?.id)
          try {
            await db.put('decks', serverDeck)
          } catch (error: any) {
            if (error?.name === 'QuotaExceededError') {
              const handled = storageManager.handleStorageError(error)
              throw new Error(handled.message)
            }
            throw error
          }
          this.notifyListeners('decks-changed')
          return serverDeck
        } else {
          const error = await response.json()
          console.error('[FlashcardManager.updateDeck] Server error:', error)
        }
      } catch (error) {
        console.error('Failed to update deck on server:', error)
      }
    }

    // Save to IndexedDB
    try {
      await db.put('decks', updatedDeck)
    } catch (error: any) {
      if (error?.name === 'QuotaExceededError') {
        const handled = storageManager.handleStorageError(error)
        throw new Error(handled.message)
      }
      throw error
    }
    this.notifyListeners('decks-changed')
    return updatedDeck
  }

  // Import deck from various sources
  async importDeck(
    request: ImportDeckRequest,
    userId: string,
    isPremium: boolean
  ): Promise<FlashcardDeck | null> {
    let cards: FlashcardContent[] = []
    let deckName = request.name
    let description = ''

    switch (request.format) {
      case 'list':
        // Import from existing UserList
        if (request.sourceListId) {
          cards = await this.convertListToCards(request.sourceListId, userId, isPremium)
        }
        break

      case 'anki':
        // Import from Anki deck (already parsed)
        if (request.ankiDeckId) {
          const ankiData = await this.getAnkiDeckData(request.ankiDeckId)
          if (ankiData) {
            cards = this.convertAnkiToCards(ankiData.cards)
            deckName = ankiData.name || deckName
            description = ankiData.description || ''
          }
        }
        break

      case 'csv':
        // Import from CSV
        if (request.data && typeof request.data === 'string') {
          cards = this.parseCSV(request.data)
        }
        break

      case 'json':
        // Import from JSON
        if (request.data && typeof request.data === 'string') {
          const jsonData = JSON.parse(request.data)
          cards = this.parseJSON(jsonData)
        }
        break
    }

    if (cards.length === 0) {
      return null
    }

    // Create the deck with imported cards
    const createRequest: CreateDeckRequest = {
      name: deckName,
      description,
      emoji: request.emoji || '📥',
      color: request.color || 'primary',
      sourceListId: request.sourceListId,
      initialCards: cards.map(card => ({
        front: card.front,
        back: card.back,
        metadata: card.metadata,
      })),
    }

    return this.createDeck(createRequest, userId, isPremium)
  }

  // Convert UserList to flashcards
  private async convertListToCards(
    listId: string,
    userId: string,
    isPremium: boolean = false
  ): Promise<FlashcardContent[]> {
    try {
      // Import ListManager to get the list
      const { listManager } = await import('@/lib/lists/ListManager')

      // Get all user lists
      const lists = await listManager.getLists(userId, isPremium)

      // Find the specific list
      const list = lists.find(l => l.id === listId)
      if (!list) {
        console.error('List not found:', listId)
        return []
      }

      // Filter out items without required metadata (reading OR meaning)
      // This prevents broken flashcards (empty backs or same front/back)
      const validItems = list.items.filter(item => {
        const hasReading = !!item.metadata?.reading?.trim()
        const hasMeaning = !!item.metadata?.meaning?.trim()
        return hasReading || hasMeaning
      })

      const skippedCount = list.items.length - validItems.length
      if (skippedCount > 0) {
        console.warn(
          `[FlashcardManager] Skipped ${skippedCount} item(s) from list "${list.name}" - missing reading or meaning`
        )
      }

      // Convert valid list items to flashcards
      return validItems.map(item => ({
        id: uuidv4(),
        front: {
          text: item.content, // The word/sentence/verb
          subtext: item.metadata?.reading || undefined, // Reading (for kanji)
        },
        back: {
          text: item.metadata?.meaning || item.content, // MEANING goes on the back!
          subtext: item.metadata?.notes || undefined, // Any notes
        },
        metadata: {
          tags: item.metadata?.tags || [list.type],
          difficulty: 0.5, // Default difficulty
          jlptLevel: item.metadata?.jlptLevel,
          source: `list:${list.name}`,
          originalListId: listId,
          itemId: item.id,
          skippedCount, // Track how many items were skipped
        },
      }))
    } catch (error) {
      console.error('Error converting list to flashcards:', error)
      return []
    }
  }

  // Convert Anki cards to flashcards
  private convertAnkiToCards(ankiCards: any[]): FlashcardContent[] {
    return ankiCards.map(card => ({
      id: uuidv4(),
      front: {
        text: card.front || card.fields?.[0] || '',
        subtext: card.fields?.[1],
      },
      back: {
        text: card.back || card.fields?.[2] || '',
        subtext: card.fields?.[3],
      },
      metadata: {
        tags: card.tags,
        difficulty: card.ease ? card.ease / 2500 : 0.5,
        srsLevel: card.interval,
        easeFactor: card.ease,
        reviewCount: card.reviews,
        notes: card.notes,
      },
    }))
  }

  // Parse CSV data
  private parseCSV(data: string): FlashcardContent[] {
    const lines = data.split('\n')
    const cards: FlashcardContent[] = []

    // Skip header if present
    const startIndex = lines[0].toLowerCase().includes('front') ? 1 : 0

    for (let i = startIndex; i < lines.length; i++) {
      if (!lines[i].trim()) continue

      const values = lines[i].match(/(".*?"|[^,]+)/g) || []
      const cleanValues = values.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'))

      if (cleanValues.length >= 2) {
        cards.push({
          id: uuidv4(),
          front: { text: cleanValues[0] },
          back: { text: cleanValues[1] },
          metadata: {
            notes: cleanValues[2],
            tags: cleanValues[3]?.split(';').filter(Boolean),
          },
        })
      }
    }

    return cards
  }

  // Parse JSON data
  private parseJSON(data: any): FlashcardContent[] {
    if (Array.isArray(data)) {
      return data.map(item => ({
        id: uuidv4(),
        front: {
          text: item.front || item.question || item.q || '',
          subtext: item.frontHint || item.reading,
        },
        back: {
          text: item.back || item.answer || item.a || '',
          subtext: item.backHint || item.meaning,
        },
        metadata: {
          tags: item.tags,
          notes: item.notes,
          difficulty: item.difficulty,
        },
      }))
    }
    return []
  }

  // Get Anki deck data (would integrate with AnkiImporter)
  private async getAnkiDeckData(deckId: string): Promise<AnkiDeck | null> {
    // This would integrate with the existing Anki import system
    // For now, return null
    return null
  }

  // Add card to deck
  async addCard(
    deckId: string,
    card: Omit<FlashcardContent, 'id'>,
    userId: string,
    isPremium: boolean
  ): Promise<FlashcardContent | null> {
    const db = await this.initDB()
    const deck = await this.getDeck(deckId, userId)

    if (!deck) return null

    const newCard: FlashcardContent = {
      id: uuidv4(),
      ...card,
    }

    // Update deck locally
    deck.cards.push(newCard)
    deck.stats.totalCards++
    deck.stats.newCards++
    deck.updatedAt = Date.now()

    // Save to server ONLY for premium users
    if (isPremium && userId !== 'guest') {
      try {
        const response = await fetch(`/api/flashcards/decks/${deckId}/cards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ...card, id: newCard.id }),
        })

        if (response.ok) {
          const responseData = await response.json()
          // Response is wrapped by createStorageResponse: { success, data: { card }, storage }
          const serverCard: FlashcardContent = responseData.data?.card || responseData.card
          const serverStats = responseData.data?.stats || responseData.stats
          if (serverCard) {
            deck.cards = deck.cards.map(c => (c.id === newCard.id ? serverCard : c))
          }
          if (serverStats) {
            deck.stats = serverStats
          }
          deck.updatedAt = Date.now()
          try {
            await db.put('decks', deck)
          } catch (error: any) {
            if (error?.name === 'QuotaExceededError') {
              const handled = storageManager.handleStorageError(error)
              throw new Error(handled.message)
            }
            throw error
          }
          this.notifyListeners(`deck-${deckId}`)
          return serverCard ?? newCard
        }
      } catch (error) {
        console.error('Failed to add card on server:', error)
      }
    }

    // Fallback to local storage
    try {
      await db.put('decks', deck)
    } catch (error: any) {
      if (error?.name === 'QuotaExceededError') {
        const handled = storageManager.handleStorageError(error)
        throw new Error(handled.message)
      }
      throw error
    }
    this.notifyListeners(`deck-${deckId}`)
    return newCard
  }

  // Update deck
  async updateDeck(
    deckId: string,
    updates: UpdateDeckRequest,
    userId: string,
    isPremium: boolean
  ): Promise<FlashcardDeck | null> {
    const db = await this.initDB()
    const deck = await this.getDeck(deckId, userId)

    if (!deck) return null

    // Apply updates
    Object.assign(deck, updates)
    deck.updatedAt = Date.now()

    // Save to server ONLY for premium users
    if (isPremium && userId !== 'guest') {
      try {
        const response = await fetch(`/api/flashcards/decks/${deckId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(updates),
        })

        if (response.ok) {
          const responseData = await response.json()
          // Response is wrapped by createStorageResponse: { success, data: { deck }, storage }
          const serverDeck = responseData.data?.deck || responseData.deck
          try {
            await db.put('decks', serverDeck)
          } catch (error: any) {
            if (error?.name === 'QuotaExceededError') {
              const handled = storageManager.handleStorageError(error)
              throw new Error(handled.message)
            }
            throw error
          }
          this.notifyListeners('decks-changed')
          return serverDeck
        }
      } catch (error) {
        console.error('Failed to update deck on server:', error)
      }
    }

    // Fallback to local storage
    try {
      await db.put('decks', deck)
    } catch (error: any) {
      if (error?.name === 'QuotaExceededError') {
        const handled = storageManager.handleStorageError(error)
        throw new Error(handled.message)
      }
      throw error
    }
    this.notifyListeners('decks-changed')
    return deck
  }

  // Delete deck
  async deleteDeck(deckId: string, userId: string, isPremium: boolean): Promise<boolean> {
    const db = await this.initDB()
    const deck = await this.getDeck(deckId, userId)

    if (!deck) return false

    // Delete from server ONLY for premium users
    if (isPremium && userId !== 'guest') {
      try {
        const response = await fetch(`/api/flashcards/decks/${deckId}`, {
          method: 'DELETE',
          credentials: 'include',
        })

        if (response.ok) {
          await db.delete('decks', deckId)

          // Clean up Anki media files from IndexedDB in background (non-blocking)
          if (deck.source === 'anki') {
            // Don't await - let it run in background to avoid blocking UI
            import('@/lib/anki/mediaStore').then(({ AnkiMediaStore }) => {
              const mediaStore = AnkiMediaStore.getInstance()
              mediaStore.deleteMediaByDeck(deckId).then(deletedCount => {
                console.log(`[FlashcardManager] Background cleanup: deleted ${deletedCount} media files for deck ${deckId}`)
              }).catch(error => {
                console.error(`[FlashcardManager] Background media cleanup failed for deck ${deckId}:`, error)
              })
            })
          }

          this.notifyListeners('decks-changed')
          return true
        }
      } catch (error) {
        console.error('Failed to delete deck on server:', error)
      }
    }

    // Fallback to local deletion
    await db.delete('decks', deckId)

    // Clean up Anki media files from IndexedDB in background (non-blocking)
    if (deck.source === 'anki') {
      // Don't await - let it run in background to avoid blocking UI
      import('@/lib/anki/mediaStore').then(({ AnkiMediaStore }) => {
        const mediaStore = AnkiMediaStore.getInstance()
        mediaStore.deleteMediaByDeck(deckId).then(deletedCount => {
          console.log(`[FlashcardManager] Background cleanup: deleted ${deletedCount} media files for deck ${deckId}`)
        }).catch(error => {
          console.error(`[FlashcardManager] Background media cleanup failed for deck ${deckId}:`, error)
        })
      })
    }

    this.notifyListeners('decks-changed')
    return true
  }

  // Get deck limits based on user tier (reads from centralized config)
  getDeckLimits(userTier: string): {
    maxDecks: number
    dailyReviews: number
    maxCardsPerDeck: number
  } {
    const plan = (userTier as PlanType) || 'free'
    const limits = featuresConfig.limits as Record<
      string,
      { daily?: Record<string, number>; monthly?: Record<string, number> }
    >
    const planLimits = limits[plan] || limits.free

    // Get flashcard_decks feature for maxCardsPerDeck metadata
    const flashcardDecksFeature = featuresConfig.features.find(f => f.id === 'flashcard_decks')
    const maxCardsPerDeckConfig = flashcardDecksFeature?.metadata?.maxCardsPerDeck as
      | Record<string, number>
      | undefined

    return {
      maxDecks: planLimits.monthly?.flashcard_decks ?? 0,
      dailyReviews: planLimits.daily?.flashcard_daily_reviews ?? 0,
      maxCardsPerDeck: maxCardsPerDeckConfig?.[plan] ?? 0,
    }
  }

  // Export deck
  async exportDeck(deckId: string, format: 'csv' | 'json'): Promise<string> {
    const db = await this.initDB()
    const deck = await db.get('decks', deckId)

    if (!deck) {
      throw new Error('Deck not found')
    }

    if (format === 'json') {
      return JSON.stringify(
        {
          name: deck.name,
          description: deck.description,
          cards: deck.cards.map((card: FlashcardContent) => ({
            front: card.front.text,
            frontHint: card.front.subtext,
            back: card.back.text,
            backHint: card.back.subtext,
            tags: card.metadata?.tags,
            notes: card.metadata?.notes,
          })),
        },
        null,
        2
      )
    }

    // CSV format
    const headers = ['Front', 'Back', 'Front Hint', 'Back Hint', 'Tags', 'Notes']
    const rows = deck.cards.map((card: FlashcardContent) => [
      card.front.text,
      card.back.text,
      card.front.subtext || '',
      card.back.subtext || '',
      (card.metadata?.tags || []).join(';'),
      card.metadata?.notes || '',
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row: string[]) =>
        row.map((cell: string) => `"${cell.replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n')

    return csvContent
  }

  // Create initial stats
  private createInitialStats(): DeckStats {
    return {
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
    }
  }

  // Subscribe to changes
  subscribe(event: string, callback: () => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }

    this.listeners.get(event)!.add(callback)

    return () => {
      this.listeners.get(event)?.delete(callback)
    }
  }

  // Notify listeners
  private notifyListeners(event: string): void {
    this.listeners.get(event)?.forEach(callback => callback())
  }

  // Sync a deck to Firebase (for premium users)
  async syncDeckToFirebase(deck: FlashcardDeck, userId: string): Promise<boolean> {
    try {
      console.log('[FlashcardManager.syncDeckToFirebase] Syncing deck to Firebase:', deck.id)

      // First, check if the deck exists in Firebase
      const checkResponse = await fetch(`/api/flashcards/decks/${deck.id}`, {
        method: 'GET',
        credentials: 'include',
      })

      let response

      if (checkResponse.ok) {
        // Deck exists, update it
        console.log('[FlashcardManager.syncDeckToFirebase] Deck exists, updating...')

        const updateRequest: UpdateDeckRequest = {
          name: deck.name,
          description: deck.description,
          emoji: deck.emoji,
          color: deck.color,
          cardStyle: deck.cardStyle,
          settings: deck.settings,
          cards: deck.cards,
        }

        response = await fetch(`/api/flashcards/decks/${deck.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(updateRequest),
        })
      } else if (checkResponse.status === 404) {
        // Deck doesn't exist, create it
        console.log('[FlashcardManager.syncDeckToFirebase] Deck not found, creating new...')

        const createRequest: CreateDeckRequest = {
          id: deck.id, // IMPORTANT: Pass the existing deck ID to prevent duplication
          name: deck.name,
          description: deck.description,
          emoji: deck.emoji,
          color: deck.color,
          cardStyle: deck.cardStyle,
          settings: deck.settings,
          initialCards: deck.cards,
          sourceListId: deck.sourceListId,
        }

        response = await fetch('/api/flashcards/decks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(createRequest),
        })
      } else {
        console.error('[FlashcardManager.syncDeckToFirebase] Failed to check deck existence')
        return false
      }

      if (response.ok) {
        console.log('[FlashcardManager.syncDeckToFirebase] Deck synced successfully')
        // Update local IndexedDB as well
        const db = await this.initDB()
        try {
          await db.put('decks', deck)
        } catch (error: any) {
          if (error?.name === 'QuotaExceededError') {
            const handled = storageManager.handleStorageError(error)
            throw new Error(handled.message)
          }
          throw error
        }
        this.notifyListeners('decks-changed')
        return true
      } else {
        const error = await response.json()
        console.error('[FlashcardManager.syncDeckToFirebase] Sync failed:', error)
        return false
      }
    } catch (error) {
      console.error('[FlashcardManager.syncDeckToFirebase] Error syncing deck:', error)
      return false
    }
  }

  // Get deck limits for user tier (reads from centralized config)
  static getDeckLimits(tier: string): { maxDecks: number; dailyReviews: number } {
    const plan = (tier as PlanType) || 'free'
    const limits = featuresConfig.limits as Record<
      string,
      { daily?: Record<string, number>; monthly?: Record<string, number> }
    >
    const planLimits = limits[plan] || limits.free

    return {
      maxDecks: planLimits.monthly?.flashcard_decks ?? 0,
      dailyReviews: planLimits.daily?.flashcard_daily_reviews ?? 0,
    }
  }

  // Get cards due for review from a specific deck
  async getDueCards(deckId: string, userId: string, limit?: number): Promise<FlashcardContent[]> {
    const db = await this.initDB()
    const deck = await this.getDeck(deckId, userId)

    if (!deck) return []

    // Initialize SRS metadata for cards that don't have it
    const cardsWithSRS = deck.cards.map(card => {
      if (!card.metadata?.status) {
        return FlashcardSRSHelper.initializeCardSRS(card)
      }
      return card
    })

    // Get due cards
    let dueCards = FlashcardSRSHelper.getDueCards(cardsWithSRS)

    // Sort by priority
    dueCards = FlashcardSRSHelper.sortByPriority(dueCards)

    // Apply daily limit for free users
    if (limit && limit > 0) {
      dueCards = dueCards.slice(0, limit)
    }

    return dueCards
  }

  // Get all due cards across all decks for a user
  async getAllDueCards(
    userId: string,
    isPremium: boolean
  ): Promise<{ deckId: string; cards: FlashcardContent[] }[]> {
    const decks = await this.getDecks(userId, isPremium)
    const limits = FlashcardManager.getDeckLimits(isPremium ? 'premium_yearly' : 'free')
    const dailyLimit = limits.dailyReviews === -1 ? undefined : limits.dailyReviews

    const allDueCards: { deckId: string; cards: FlashcardContent[] }[] = []
    let totalCards = 0

    for (const deck of decks) {
      // Calculate remaining limit
      const remainingLimit = dailyLimit ? Math.max(0, dailyLimit - totalCards) : undefined

      if (remainingLimit === 0) break

      const dueCards = await this.getDueCards(deck.id, userId, remainingLimit)

      if (dueCards.length > 0) {
        allDueCards.push({
          deckId: deck.id,
          cards: dueCards,
        })
        totalCards += dueCards.length
      }
    }

    return allDueCards
  }

  // Update a card after review with SRS algorithm
  async updateCardAfterReview(
    deckId: string,
    cardId: string,
    difficulty: 'again' | 'hard' | 'good' | 'easy',
    responseTime: number,
    userId: string,
    isPremium: boolean
  ): Promise<FlashcardContent | null> {
    const db = await this.initDB()
    const deck = await this.getDeck(deckId, userId)

    if (!deck) return null

    // Find the card
    const cardIndex = deck.cards.findIndex(c => c.id === cardId)
    if (cardIndex === -1) return null
    const previousStatus = deck.cards[cardIndex].metadata?.status

    // Update card with SRS algorithm
    const updatedCard = await FlashcardSRSHelper.updateCardAfterReview(
      deck.cards[cardIndex],
      difficulty,
      responseTime
    )

    // Update deck
    deck.cards[cardIndex] = updatedCard
    deck.updatedAt = Date.now()

    // Update deck stats based on card progress
    this.updateDeckStatsFromCard(deck, updatedCard, difficulty !== 'again', previousStatus)

    // Save to server ONLY for premium users
    if (isPremium && userId !== 'guest') {
      try {
        const response = await fetch(`/api/flashcards/decks/${deckId}/cards/${cardId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            metadata: updatedCard.metadata,
          }),
        })

        if (response.ok) {
          const responseData = await response.json()
          const serverStats = responseData.data?.stats || responseData.stats
          if (serverStats) {
            deck.stats = serverStats
          }
          try {
            await db.put('decks', deck)
          } catch (error: any) {
            if (error?.name === 'QuotaExceededError') {
              const handled = storageManager.handleStorageError(error)
              throw new Error(handled.message)
            }
            throw error
          }
          this.notifyListeners(`deck-${deckId}`)
          return updatedCard
        }
      } catch (error) {
        console.error('Failed to update card on server:', error)
      }
    }

    // Save to IndexedDB
    try {
      await db.put('decks', deck)
    } catch (error: any) {
      if (error?.name === 'QuotaExceededError') {
        const handled = storageManager.handleStorageError(error)
        throw new Error(handled.message)
      }
      throw error
    }
    this.notifyListeners(`deck-${deckId}`)
    return updatedCard
  }

  // Update deck stats based on card review
  private updateDeckStatsFromCard(
    deck: FlashcardDeck,
    card: FlashcardContent,
    wasCorrect: boolean,
    previousStatus?: CardStatus
  ): void {
    // Update card type counts
    if (card.metadata?.status) {
      const oldStatus = previousStatus ?? deck.cards.find(c => c.id === card.id)?.metadata?.status
      const newStatus = card.metadata.status

      if (oldStatus !== newStatus) {
        // Update counts when status changes
        switch (oldStatus) {
          case 'new':
            deck.stats.newCards = Math.max(0, deck.stats.newCards - 1)
            break
          case 'learning':
            deck.stats.learningCards = Math.max(0, deck.stats.learningCards - 1)
            break
          case 'review':
            deck.stats.reviewCards = Math.max(0, deck.stats.reviewCards - 1)
            break
          case 'mastered':
            deck.stats.masteredCards = Math.max(0, deck.stats.masteredCards - 1)
            break
        }

        switch (newStatus) {
          case 'new':
            deck.stats.newCards++
            break
          case 'learning':
            deck.stats.learningCards++
            break
          case 'review':
            deck.stats.reviewCards++
            break
          case 'mastered':
            deck.stats.masteredCards++
            break
        }
      }
    }

    // Update studied count
    deck.stats.totalStudied++
    deck.stats.lastStudied = Date.now()

    // Update accuracy (running average)
    const totalReviews = deck.stats.totalStudied
    const currentAccuracy = deck.stats.averageAccuracy
    deck.stats.averageAccuracy =
      (currentAccuracy * (totalReviews - 1) + (wasCorrect ? 1 : 0)) / totalReviews
  }

  // Clear all local IndexedDB data for a user (for logout or sync reset)
  async clearLocalData(userId?: string): Promise<void> {
    const db = await this.initDB()

    if (userId) {
      // Clear only this user's decks
      const tx = db.transaction('decks', 'readwrite')
      const existingDecks = await tx.store.index('userId').getAllKeys(userId)

      // Batch deletes for better performance
      await Promise.all(existingDecks.map(key => tx.store.delete(key)))

      await tx.done
      console.log(`[FlashcardManager] Cleared ${existingDecks.length} decks for user ${userId}`)
    } else {
      // Clear all decks
      await db.clear('decks')
      console.log('[FlashcardManager] Cleared all local decks')
    }

    this.notifyListeners('decks-changed')
  }

  // Force sync from server (clears local and fetches fresh)
  async forceSyncFromServer(userId: string): Promise<FlashcardDeck[]> {
    console.log('[FlashcardManager] Force sync from server for user:', userId)

    // Clear local data first
    await this.clearLocalData(userId)

    // Fetch from server (this will repopulate IndexedDB)
    // Pass isPremium=true to force server fetch
    return this.getDecks(userId, true)
  }

  // Save session statistics
  async saveSessionStats(session: SessionStats, userId: string, isPremium: boolean): Promise<void> {
    const db = await this.initDB()

    // Update deck stats with session data
    const deck = await this.getDeck(session.deckId, userId)
    if (deck) {
      // Update cumulative stats
      deck.stats.totalTimeSpent += session.duration

      // Update heatmap data
      const dateKey = new Date(session.timestamp).toISOString().split('T')[0]
      if (!deck.stats.heatmapData) {
        deck.stats.heatmapData = {}
      }
      deck.stats.heatmapData[dateKey] =
        (deck.stats.heatmapData[dateKey] || 0) + session.cardsStudied

      // Save updated deck
      try {
        await db.put('decks', deck)
      } catch (error: any) {
        if (error?.name === 'QuotaExceededError') {
          const handled = storageManager.handleStorageError(error)
          throw new Error(handled.message)
        }
        throw error
      }
    }

    // Always persist session locally for dashboard/insights
    try {
      const { sessionManager } = await import('./SessionManager')
      await sessionManager.saveSession(session)
      await sessionManager.saveSessionRemote(session, isPremium)
    } catch (err) {
      console.error('[FlashcardManager] Failed to persist session locally:', err)
    }

    // For premium users, also save to Firebase
    if (isPremium && userId !== 'guest') {
      try {
        await fetch('/api/flashcards/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(session),
        })
      } catch (error) {
        console.error('Failed to save session to server:', error)
      }
    }
  }

  /**
   * Sync server-fetched decks to IndexedDB for offline support.
   * Called when premium user's decks are loaded via SSR.
   */
  async syncDecksToIndexedDB(decks: FlashcardDeck[], userId: string): Promise<void> {
    if (!decks || decks.length === 0) return

    try {
      const db = await this.initDB()

      console.log('[FlashcardManager.syncDecksToIndexedDB] Syncing', decks.length, 'decks to IndexedDB')

      // Normalize Anki decks before storing (same as getDecks does)
      const normalizedDecks = decks.map((deck: any) => {
        if (deck.source === 'anki' && deck.cards?.length > 0) {
          console.log('[FlashcardManager.syncDecksToIndexedDB] Normalizing Anki deck:', deck.name)
          return {
            ...deck,
            cards: deck.cards.map((card: any) => this.normalizeAnkiCard(card))
          }
        }
        return deck
      })

      // Use a transaction for atomic updates
      try {
        const tx = db.transaction('decks', 'readwrite')

        for (const deck of normalizedDecks) {
          // Ensure the deck belongs to this user
          if (deck.userId === userId) {
            await tx.store.put(deck)
          }
        }

        await tx.done
      } catch (error: any) {
        if (error?.name === 'QuotaExceededError') {
          const handled = storageManager.handleStorageError(error)
          throw new Error(handled.message)
        }
        throw error
      }

      console.log('[FlashcardManager.syncDecksToIndexedDB] Sync complete')
      this.notifyListeners('decks-changed')
    } catch (error) {
      console.error('[FlashcardManager.syncDecksToIndexedDB] Failed:', error)
      // Don't throw - this is a background sync operation
    }
  }
}

// Export singleton instance
export const flashcardManager = new FlashcardManager()
