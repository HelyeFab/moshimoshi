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
          back: typeof card.back === 'string' ? card.back : {
            ...card.back,
            media: audioUrl ? { type: 'audio' as const, url: audioUrl } : card.back.media,
          },
          front: typeof card.front === 'string' ? card.front : {
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

    // DON'T normalize Anki cards - they have complex HTML that shouldn't be split into text/subtext
    // Just return the card as-is
    return card as FlashcardContent;
  }

  // Initialize IndexedDB
  private async initDB(): Promise<IDBPDatabase<FlashcardDB>> {
    if (this.db) return this.db

    // Initialize storage manager without auto-requesting persistence.
    // Persistence is requested via an explicit user action in the UI.
    await storageManager.initialize({ requestPersistence: false })

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
    const db = await this.initDB()

    // Load all decks from IndexedDB (local-only storage)
    let decks = await db.getAllFromIndex('decks', 'userId', userId)

    // Normalize Anki-imported decks to match FlashcardContent structure
    decks = decks.map((deck: any) => {
      if (deck.source === 'anki' && deck.cards?.length > 0) {
        return {
          ...deck,
          cards: deck.cards.map((card: any) => this.normalizeAnkiCard(card))
        }
      }
      return deck
    })

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

    // Check deck limit before creating deck
    const userTier = isPremium ? 'premium_yearly' : 'free'
    const limits = FlashcardManager.getDeckLimits(userTier)

    // Get existing user decks (exclude Anki decks from count)
    const existingDecks = await this.getDecks(userId, isPremium)
    const userDecks = existingDecks.filter(d => d.source !== 'anki')

    if (limits.maxDecks !== -1 && userDecks.length >= limits.maxDecks) {
      const error = new Error(`DECK_LIMIT_REACHED: You've reached the maximum of ${limits.maxDecks} decks for your plan`)
      error.name = 'DECK_LIMIT_REACHED'
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
        reviewsPerDay: 100,
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

    console.log('💾 [FlashcardManager.createDeck] Saving deck to IndexedDB:', {
      id: deck.id,
      name: deck.name,
      cardCount: deck.cards.length,
      userId,
      deckStructure: {
        hasCards: !!deck.cards,
        cards: deck.cards.length,
        firstCard: deck.cards[0]
      }
    })

    // Save to IndexedDB only (local-only storage)
    try {
      await db.put('decks', deck)
      console.log('✅ [FlashcardManager.createDeck] Deck saved successfully to IndexedDB')
      this.notifyListeners('decks-changed')
    } catch (error) {
      console.error('❌ [FlashcardManager.createDeck] Failed to save deck:', error)
      const handled = storageManager.handleStorageError(error)
      throw new Error(handled.message)
    }

    // Sync to Firebase for premium users (non-blocking)
    if (isPremium && userId !== 'guest' && deck.source !== 'anki') {
      this.syncDeckToFirebase(deck, userId).catch(err => {
        console.error('[FlashcardManager.createDeck] Firebase sync failed:', err)
        // Don't throw - local deck is already created
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

      // Convert list items to flashcards
      return list.items.map(item => ({
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

    if (updates.cards) {
      const statusCounts = {
        new: 0,
        learning: 0,
        review: 0,
        mastered: 0,
      }

      for (const card of updates.cards) {
        const status = card.metadata?.status || 'new'
        switch (status) {
          case 'learning':
            statusCounts.learning += 1
            break
          case 'review':
            statusCounts.review += 1
            break
          case 'mastered':
            statusCounts.mastered += 1
            break
          default:
            statusCounts.new += 1
            break
        }
      }

      deck.stats.totalCards = updates.cards.length
      deck.stats.newCards = statusCounts.new
      deck.stats.learningCards = statusCounts.learning
      deck.stats.reviewCards = statusCounts.review
      deck.stats.masteredCards = statusCounts.mastered
    }

    // Save to local storage
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

    // Sync to Firebase for premium users (non-blocking)
    if (isPremium && userId !== 'guest' && deck.source !== 'anki') {
      this.syncDeckToFirebase(deck, userId).catch(err => {
        console.error('[FlashcardManager.updateDeck] Firebase sync failed:', err)
        // Don't throw - local deck is already updated
      })
    }

    return deck
  }

  // Upsert a deck locally without touching the server (used for restore stubs)
  async upsertLocalDeck(deck: FlashcardDeck): Promise<void> {
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
    this.notifyListeners(`deck-${deck.id}`)
  }

  // Delete deck
  async deleteDeck(deckId: string, userId: string, isPremium: boolean): Promise<boolean> {
    const db = await this.initDB()
    const deck = await this.getDeck(deckId, userId)

    if (!deck) return false

    // Delete from local storage first
    await db.delete('decks', deckId)
    this.notifyListeners('decks-changed')

    // Sync deletion to Firebase for premium users with non-Anki decks
    if (isPremium && userId !== 'guest' && deck.source !== 'anki') {
      console.log('[FlashcardManager.deleteDeck] Syncing deletion to Firebase:', deck.name)

      try {
        const response = await fetch(`/api/flashcards/decks/${deckId}`, {
          method: 'DELETE',
          credentials: 'include',
        })

        if (response.ok) {
          console.log('[FlashcardManager.deleteDeck] Deck deleted from Firebase successfully')
        } else {
          const error = await response.text()
          console.error('[FlashcardManager.deleteDeck] Failed to delete from Firebase:', error)
          // Don't throw - local deletion already succeeded
        }
      } catch (error) {
        console.error('[FlashcardManager.deleteDeck] Error syncing deletion to Firebase:', error)
        // Don't throw - local deletion already succeeded
      }
    }

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
            front: typeof card.front === 'string' ? card.front : card.front.text,
            frontHint: typeof card.front === 'string' ? undefined : card.front.subtext,
            back: typeof card.back === 'string' ? card.back : card.back.text,
            backHint: typeof card.back === 'string' ? undefined : card.back.subtext,
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
      typeof card.front === 'string' ? card.front : card.front.text,
      typeof card.back === 'string' ? card.back : card.back.text,
      typeof card.front === 'string' ? '' : (card.front.subtext || ''),
      typeof card.back === 'string' ? '' : (card.back.subtext || ''),
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

  /**
   * Sync a single deck to Firebase (for premium users)
   * Used for incremental sync after create/update operations
   * Private method - called internally after CRUD operations
   */
  private async syncDeckToFirebase(deck: FlashcardDeck, userId: string): Promise<void> {
    try {
      // CRITICAL: Skip Anki decks
      if (deck.source === 'anki') {
        console.log('[FlashcardManager.syncDeckToFirebase] Skipping Anki deck:', deck.name)
        return
      }

      console.log('[FlashcardManager.syncDeckToFirebase] Syncing single deck to Firebase:', deck.name)

      // Use batch endpoint for simplicity (handles both create and update)
      const response = await fetch('/api/flashcards/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ decks: [deck] })
      })

      if (!response.ok) {
        console.error('[FlashcardManager.syncDeckToFirebase] Sync failed:', await response.text())
      } else {
        console.log('[FlashcardManager.syncDeckToFirebase] Deck synced successfully')
      }
    } catch (error) {
      console.error('[FlashcardManager.syncDeckToFirebase] Error syncing deck:', error)
      // Don't throw - local deck is already created/updated
    }
  }

  /**
   * Upload all user-created decks to Firebase
   * Filters out Anki decks (source !== 'anki')
   * Used for bulk sync operation
   */
  async syncAllDecksToFirebase(
    userId: string,
    isPremium: boolean
  ): Promise<{ synced: number; failed: number; conflicts: number }> {
    if (!isPremium) {
      throw new Error('Premium required for sync')
    }

    console.log('[FlashcardManager.syncAllDecksToFirebase] Starting bulk sync to Firebase...')

    // Get all local decks
    const localDecks = await this.getDecks(userId, isPremium)

    // CRITICAL: Filter out Anki decks
    const userDecks = localDecks.filter(d => d.source !== 'anki')

    console.log('[FlashcardManager.syncAllDecksToFirebase] Decks to sync:', {
      total: localDecks.length,
      userDecks: userDecks.length,
      ankiDecks: localDecks.length - userDecks.length
    })

    if (userDecks.length === 0) {
      return { synced: 0, failed: 0, conflicts: 0 }
    }

    try {
      // Batch sync to Firebase
      const response = await fetch('/api/flashcards/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ decks: userDecks })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Sync failed: ${errorText}`)
      }

      const result = await response.json()
      console.log('[FlashcardManager.syncAllDecksToFirebase] Bulk sync complete:', result)
      return result
    } catch (error) {
      console.error('[FlashcardManager.syncAllDecksToFirebase] Error:', error)
      throw error
    }
  }

  /**
   * Download decks from Firebase and merge into IndexedDB
   * Uses Last-Write-Wins (LWW) conflict resolution
   */
  async syncDecksFromFirebase(
    userId: string,
    isPremium: boolean
  ): Promise<{ downloaded: number; merged: number; localWins: number }> {
    if (!isPremium) {
      throw new Error('Premium required for sync')
    }

    console.log('[FlashcardManager.syncDecksFromFirebase] Starting download from Firebase...')

    try {
      // Fetch remote decks
      const response = await fetch('/api/flashcards/decks', {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch remote decks: ${errorText}`)
      }

      const { decks: remoteDecks } = await response.json()

      console.log('[FlashcardManager.syncDecksFromFirebase] Fetched from Firebase:', {
        count: remoteDecks.length
      })

      // Get local decks for comparison
      const localDecks = await this.getDecks(userId, isPremium)
      const localDeckMap = new Map(localDecks.map(d => [d.id, d]))

      const db = await this.initDB()
      let downloaded = 0,
        merged = 0,
        localWins = 0

      // LWW conflict resolution
      for (const remoteDeck of remoteDecks) {
        const localDeck = localDeckMap.get(remoteDeck.id)

        if (!localDeck) {
          // New deck from remote - insert
          console.log('[FlashcardManager.syncDecksFromFirebase] New deck from remote:', remoteDeck.name)
          await db.put('decks', remoteDeck)
          downloaded++
        } else {
          // Conflict - compare updatedAt timestamps (LWW)
          if (remoteDeck.updatedAt > localDeck.updatedAt) {
            // Remote is newer - overwrite local
            console.log('[FlashcardManager.syncDecksFromFirebase] Remote newer, merging:', remoteDeck.name)
            await db.put('decks', remoteDeck)
            merged++
          } else {
            // Local is newer - will be pushed in upload phase
            console.log('[FlashcardManager.syncDecksFromFirebase] Local newer, keeping:', localDeck.name)
            localWins++
          }
        }
      }

      // Note: Automatic deletion sync removed to prevent data loss
      // Issue: Can't distinguish between "deleted in Firebase" vs "new offline deck not yet uploaded"
      // Trade-off: Only support Local delete → Firebase (via DELETE API), not Firebase delete → Local auto-delete
      // This prevents accidentally deleting offline-created decks that haven't been uploaded yet

      if (downloaded > 0 || merged > 0) {
        this.notifyListeners('decks-changed')
      }

      const result = { downloaded, merged, localWins }
      console.log('[FlashcardManager.syncDecksFromFirebase] Download complete:', result)
      return result
    } catch (error) {
      console.error('[FlashcardManager.syncDecksFromFirebase] Error:', error)
      throw error
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

    // Save to IndexedDB (local-only storage)
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
    console.log('💾 [FlashcardManager.saveSessionStats] Received session:', {
      deckId: session.deckId,
      cardsStudied: session.cardsStudied,
      accuracy: session.accuracy,
      duration: session.duration,
      userId
    })
    const db = await this.initDB()

    // Update deck stats with session data
    const deck = await this.getDeck(session.deckId, userId)
    console.log('📊 [FlashcardManager.saveSessionStats] Found deck:', deck ? `${deck.name} (${deck.cards.length} cards)` : 'NOT FOUND')
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
        console.log('✅ [FlashcardManager.saveSessionStats] Deck stats updated in IndexedDB:', {
          deckName: deck.name,
          totalTimeSpent: deck.stats.totalTimeSpent,
          totalCards: deck.stats.totalCards,
          masteredCards: deck.stats.masteredCards
        })
      } catch (error: any) {
        console.error('❌ [FlashcardManager.saveSessionStats] Failed to update deck:', error)
        if (error?.name === 'QuotaExceededError') {
          const handled = storageManager.handleStorageError(error)
          throw new Error(handled.message)
        }
        throw error
      }
    }

    // Always persist session locally for dashboard/insights
    try {
      console.log('💾 [FlashcardManager.saveSessionStats] Persisting session to SessionManager...')
      const { sessionManager } = await import('./SessionManager')
      await sessionManager.saveSession(session)
      await sessionManager.saveSessionRemote(session, isPremium)
      console.log('✅ [FlashcardManager.saveSessionStats] Session persisted to SessionManager')
    } catch (err) {
      console.error('❌ [FlashcardManager] Failed to persist session locally:', err)
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
