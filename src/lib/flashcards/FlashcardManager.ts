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
  SessionStats
} from '@/types/flashcards';
import type { UserList, ListItem } from '@/types/userLists';
import type { AnkiDeck } from '@/lib/anki/importer';
import { openDB, IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';
import { syncManager } from './SyncManager';
import { storageManager } from './StorageManager';
import { FlashcardSRSHelper } from './SRSHelper';

interface FlashcardDB {
  decks: FlashcardDeck;
}

export class FlashcardManager {
  private db: IDBPDatabase<FlashcardDB> | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private listeners: Map<string, Set<() => void>> = new Map();

  // Initialize IndexedDB
  private async initDB(): Promise<IDBPDatabase<FlashcardDB>> {
    if (this.db) return this.db;

    // Initialize storage manager first
    await storageManager.initialize();

    try {
      this.db = await openDB<FlashcardDB>('FlashcardDB', 1, {
        upgrade(db) {
          // Decks store
          if (!db.objectStoreNames.contains('decks')) {
            const decksStore = db.createObjectStore('decks', { keyPath: 'id' });
            decksStore.createIndex('userId', 'userId');
            decksStore.createIndex('updatedAt', 'updatedAt');
            decksStore.createIndex('sourceListId', 'sourceListId');
          }

          // Note: Sync queue moved to SyncManager
        }
      });

      return this.db;
    } catch (error) {
      const handled = storageManager.handleStorageError(error);
      throw new Error(handled.message);
    }
  }

  // Get all decks for a user
  async getDecks(userId: string, isPremium: boolean): Promise<FlashcardDeck[]> {
    const db = await this.initDB();

    // Premium users: Try server first, sync to IndexedDB
    if (isPremium) {
      try {
        console.log('[FlashcardManager.getDecks] Premium user - fetching from server');
        const response = await fetch('/api/flashcards/decks', {
          method: 'GET',
          credentials: 'include'
        });

        if (response.ok) {
          const { decks } = await response.json();
          console.log('[FlashcardManager.getDecks] Server returned', decks?.length || 0, 'decks');

          // Sync all decks from server to IndexedDB
          const tx = db.transaction('decks', 'readwrite');
          // Clear existing decks for this user
          const existingDecks = await tx.store.index('userId').getAllKeys(userId);
          for (const key of existingDecks) {
            await tx.store.delete(key);
          }
          // Add server decks
          if (decks && decks.length > 0) {
            for (const deck of decks) {
              await tx.store.put(deck);
            }
          }
          await tx.done;

          return decks || [];
        }
      } catch (error) {
        console.error('Failed to fetch decks from server:', error);
        // Fall through to use IndexedDB for offline premium users
      }
    }

    // Free users or offline premium users: Use IndexedDB only
    console.log('[FlashcardManager.getDecks] Using IndexedDB only');
    const decks = await db.getAllFromIndex('decks', 'userId', userId);
    return decks.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // Get a single deck by ID
  async getDeck(deckId: string, userId: string): Promise<FlashcardDeck | null> {
    const db = await this.initDB();
    const deck = await db.get('decks', deckId);

    if (deck && deck.userId === userId) {
      return deck;
    }

    return null;
  }

  // Create a new deck
  async createDeck(request: CreateDeckRequest, userId: string, isPremium: boolean): Promise<FlashcardDeck | null> {
    const db = await this.initDB();
    const now = Date.now();

    // Check storage quota before creating deck
    const estimatedSize = storageManager.calculateDeckSize({
      ...request,
      cards: request.initialCards || [],
      userId
    });

    const hasSpace = await storageManager.hasEnoughSpace(estimatedSize);
    if (!hasSpace) {
      const error = new Error('QuotaExceededError: Insufficient storage space');
      error.name = 'QuotaExceededError';
      throw error;
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
        ...request.settings
      },
      stats: this.createInitialStats(),
      createdAt: now,
      updatedAt: now,
      sourceListId: request.sourceListId
    };

    // Add initial cards if provided
    if (request.initialCards) {
      deck.cards = request.initialCards.map(card => ({
        id: uuidv4(),
        front: card.front as CardSide,
        back: card.back as CardSide,
        metadata: card.metadata
      }));
      deck.stats.totalCards = deck.cards.length;
      deck.stats.newCards = deck.cards.length;
    }

    // Save to server ONLY for premium users
    console.log('[FlashcardManager.createDeck] isPremium:', isPremium, 'userId:', userId);
    if (isPremium && userId !== 'guest') {
      try {
        console.log('[FlashcardManager.createDeck] Saving to Firebase...');
        const response = await fetch('/api/flashcards/decks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(request)
        });

        console.log('[FlashcardManager.createDeck] Response status:', response.status);
        if (response.ok) {
          const responseData = await response.json();
          const serverDeck = responseData.deck;
          console.log('[FlashcardManager.createDeck] Deck saved to Firebase:', serverDeck.id);
          await db.put('decks', serverDeck);
          this.notifyListeners('decks-changed');
          return serverDeck;
        } else {
          let errorMessage = 'Failed to create deck on server';
          try {
            const errorData = await response.text();
            const parsedError = errorData ? JSON.parse(errorData) : {};
            errorMessage = parsedError.error || errorMessage;
            console.error('[FlashcardManager.createDeck] Server error:', {
              status: response.status,
              statusText: response.statusText,
              error: parsedError
            });
          } catch (parseError) {
            console.error('[FlashcardManager.createDeck] Failed to parse error response:', parseError);
          }

          // If it's a 403 (deck limit), throw the error to surface it to the user
          if (response.status === 403) {
            throw new Error(errorMessage);
          }
        }
      } catch (error: any) {
        console.error('Failed to create deck on server:', error);

        // Queue for retry
        await syncManager.queueOperation({
          action: 'create',
          deckId: deck.id,
          data: request,
          userId
        });

        // Still save locally for offline access
        await db.put('decks', deck);
        this.notifyListeners('decks-changed');
        return deck;
      }
    } else {
      console.log('[FlashcardManager.createDeck] Guest user - saving to IndexedDB only');
    }

    // For free users and guests: Save to IndexedDB only
    try {
      await db.put('decks', deck);
      this.notifyListeners('decks-changed');
    } catch (error) {
      const handled = storageManager.handleStorageError(error);
      throw new Error(handled.message);
    }

    // Queue for future sync if user upgrades
    if (userId !== 'guest') {
      await syncManager.queueOperation({
        action: 'create',
        deckId: deck.id,
        data: deck,
        userId
      });
    }

    return deck;
  }

  // Update existing deck (renamed to avoid collision)
  async updateFullDeck(deckId: string, request: CreateDeckRequest, userId: string, isPremium: boolean): Promise<FlashcardDeck | null> {
    const db = await this.initDB();
    const now = Date.now();

    // Get existing deck
    const existingDeck = await db.get('decks', deckId);
    if (!existingDeck || existingDeck.userId !== userId) {
      console.error('[FlashcardManager.updateDeck] Deck not found or unauthorized');
      return null;
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
        ...request.settings
      },
      updatedAt: now
    };

    // Update cards if provided
    if (request.initialCards && request.initialCards.length > 0) {
      updatedDeck.cards = request.initialCards.map(card => ({
        id: uuidv4(),
        front: card.front,
        back: card.back,
        metadata: card.metadata
      }));
      updatedDeck.stats.totalCards = updatedDeck.cards.length;
      updatedDeck.stats.newCards = updatedDeck.cards.length;
    }

    // For premium users, also update on server
    if (isPremium && userId !== 'guest') {
      try {
        console.log('[FlashcardManager.updateDeck] Premium user - syncing with Firebase');
        const response = await fetch(`/api/flashcards/decks/${deckId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request)
        });

        if (response.ok) {
          const { deck: serverDeck } = await response.json();
          console.log('[FlashcardManager.updateDeck] Deck updated on Firebase:', serverDeck.id);
          await db.put('decks', serverDeck);
          this.notifyListeners('decks-changed');
          return serverDeck;
        } else {
          const error = await response.json();
          console.error('[FlashcardManager.updateDeck] Server error:', error);
        }
      } catch (error) {
        console.error('Failed to update deck on server:', error);
      }
    }

    // Save to IndexedDB
    await db.put('decks', updatedDeck);
    this.notifyListeners('decks-changed');
    return updatedDeck;
  }

  // Import deck from various sources
  async importDeck(request: ImportDeckRequest, userId: string, isPremium: boolean): Promise<FlashcardDeck | null> {
    let cards: FlashcardContent[] = [];
    let deckName = request.name;
    let description = '';

    switch (request.format) {
      case 'list':
        // Import from existing UserList
        if (request.sourceListId) {
          cards = await this.convertListToCards(request.sourceListId, userId, isPremium);
        }
        break;

      case 'anki':
        // Import from Anki deck (already parsed)
        if (request.ankiDeckId) {
          const ankiData = await this.getAnkiDeckData(request.ankiDeckId);
          if (ankiData) {
            cards = this.convertAnkiToCards(ankiData.cards);
            deckName = ankiData.name || deckName;
            description = ankiData.description || '';
          }
        }
        break;

      case 'csv':
        // Import from CSV
        if (request.data && typeof request.data === 'string') {
          cards = this.parseCSV(request.data);
        }
        break;

      case 'json':
        // Import from JSON
        if (request.data && typeof request.data === 'string') {
          const jsonData = JSON.parse(request.data);
          cards = this.parseJSON(jsonData);
        }
        break;
    }

    if (cards.length === 0) {
      return null;
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
        metadata: card.metadata
      }))
    };

    return this.createDeck(createRequest, userId, isPremium);
  }

  // Convert UserList to flashcards
  private async convertListToCards(listId: string, userId: string, isPremium: boolean = false): Promise<FlashcardContent[]> {
    try {
      // Import ListManager to get the list
      const { listManager } = await import('@/lib/lists/ListManager');

      // Get all user lists
      const lists = await listManager.getLists(userId, isPremium);

      // Find the specific list
      const list = lists.find(l => l.id === listId);
      if (!list) {
        console.error('List not found:', listId);
        return [];
      }

      // Convert list items to flashcards
      return list.items.map(item => ({
        id: uuidv4(),
        front: {
          text: item.content,  // The word/sentence/verb
          subtext: item.metadata?.reading || undefined  // Reading (for kanji)
        },
        back: {
          text: item.metadata?.meaning || item.content,  // MEANING goes on the back!
          subtext: item.metadata?.notes || undefined  // Any notes
        },
        metadata: {
          tags: item.metadata?.tags || [list.type],
          difficulty: 0.5,  // Default difficulty
          jlptLevel: item.metadata?.jlptLevel,
          source: `list:${list.name}`,
          originalListId: listId,
          itemId: item.id
        }
      }));
    } catch (error) {
      console.error('Error converting list to flashcards:', error);
      return [];
    }
  }

  // Convert Anki cards to flashcards
  private convertAnkiToCards(ankiCards: any[]): FlashcardContent[] {
    return ankiCards.map(card => ({
      id: uuidv4(),
      front: {
        text: card.front || card.fields?.[0] || '',
        subtext: card.fields?.[1]
      },
      back: {
        text: card.back || card.fields?.[2] || '',
        subtext: card.fields?.[3]
      },
      metadata: {
        tags: card.tags,
        difficulty: card.ease ? card.ease / 2500 : 0.5,
        srsLevel: card.interval,
        easeFactor: card.ease,
        reviewCount: card.reviews,
        notes: card.notes
      }
    }));
  }

  // Parse CSV data
  private parseCSV(data: string): FlashcardContent[] {
    const lines = data.split('\n');
    const cards: FlashcardContent[] = [];

    // Skip header if present
    const startIndex = lines[0].toLowerCase().includes('front') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = lines[i].match(/(".*?"|[^,]+)/g) || [];
      const cleanValues = values.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));

      if (cleanValues.length >= 2) {
        cards.push({
          id: uuidv4(),
          front: { text: cleanValues[0] },
          back: { text: cleanValues[1] },
          metadata: {
            notes: cleanValues[2],
            tags: cleanValues[3]?.split(';').filter(Boolean)
          }
        });
      }
    }

    return cards;
  }

  // Parse JSON data
  private parseJSON(data: any): FlashcardContent[] {
    if (Array.isArray(data)) {
      return data.map(item => ({
        id: uuidv4(),
        front: {
          text: item.front || item.question || item.q || '',
          subtext: item.frontHint || item.reading
        },
        back: {
          text: item.back || item.answer || item.a || '',
          subtext: item.backHint || item.meaning
        },
        metadata: {
          tags: item.tags,
          notes: item.notes,
          difficulty: item.difficulty
        }
      }));
    }
    return [];
  }

  // Get Anki deck data (would integrate with AnkiImporter)
  private async getAnkiDeckData(deckId: string): Promise<AnkiDeck | null> {
    // This would integrate with the existing Anki import system
    // For now, return null
    return null;
  }

  // Add card to deck
  async addCard(deckId: string, card: Omit<FlashcardContent, 'id'>, userId: string, isPremium: boolean): Promise<FlashcardContent | null> {
    const db = await this.initDB();
    const deck = await this.getDeck(deckId, userId);

    if (!deck) return null;

    const newCard: FlashcardContent = {
      id: uuidv4(),
      ...card
    };

    // Update deck
    deck.cards.push(newCard);
    deck.stats.totalCards++;
    deck.stats.newCards++;
    deck.updatedAt = Date.now();

    // Save to server ONLY for premium users
    if (isPremium && userId !== 'guest') {
      try {
        const response = await fetch(`/api/flashcards/decks/${deckId}/cards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(card)
        });

        if (response.ok) {
          const { card: serverCard } = await response.json();
          await db.put('decks', deck);
          this.notifyListeners(`deck-${deckId}`);
          return serverCard;
        }
      } catch (error) {
        console.error('Failed to add card on server:', error);
      }
    }

    // Fallback to local storage
    await db.put('decks', deck);
    this.notifyListeners(`deck-${deckId}`);
    return newCard;
  }

  // Update deck
  async updateDeck(deckId: string, updates: UpdateDeckRequest, userId: string, isPremium: boolean): Promise<FlashcardDeck | null> {
    const db = await this.initDB();
    const deck = await this.getDeck(deckId, userId);

    if (!deck) return null;

    // Apply updates
    Object.assign(deck, updates);
    deck.updatedAt = Date.now();

    // Save to server ONLY for premium users
    if (isPremium && userId !== 'guest') {
      try {
        const response = await fetch(`/api/flashcards/decks/${deckId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(updates)
        });

        if (response.ok) {
          const { deck: updatedDeck } = await response.json();
          await db.put('decks', updatedDeck);
          this.notifyListeners('decks-changed');
          return updatedDeck;
        }
      } catch (error) {
        console.error('Failed to update deck on server:', error);
      }
    }

    // Fallback to local storage
    await db.put('decks', deck);
    this.notifyListeners('decks-changed');
    return deck;
  }

  // Delete deck
  async deleteDeck(deckId: string, userId: string, isPremium: boolean): Promise<boolean> {
    const db = await this.initDB();
    const deck = await this.getDeck(deckId, userId);

    if (!deck) return false;

    // Delete from server ONLY for premium users
    if (isPremium && userId !== 'guest') {
      try {
        const response = await fetch(`/api/flashcards/decks/${deckId}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        if (response.ok) {
          await db.delete('decks', deckId);
          this.notifyListeners('decks-changed');
          return true;
        }
      } catch (error) {
        console.error('Failed to delete deck on server:', error);
      }
    }

    // Fallback to local deletion
    await db.delete('decks', deckId);
    this.notifyListeners('decks-changed');
    return true;
  }

  // Get deck limits based on user tier
  getDeckLimits(userTier: string): { maxDecks: number; dailyReviews: number; maxCardsPerDeck: number } {
    const limits: Record<string, { maxDecks: number; dailyReviews: number; maxCardsPerDeck: number }> = {
      guest: { maxDecks: 0, dailyReviews: 0, maxCardsPerDeck: 0 },
      free: { maxDecks: 10, dailyReviews: 50, maxCardsPerDeck: 100 },
      premium_monthly: { maxDecks: -1, dailyReviews: -1, maxCardsPerDeck: -1 },
      premium_yearly: { maxDecks: -1, dailyReviews: -1, maxCardsPerDeck: -1 }
    };
    return limits[userTier] || limits.free;
  }

  // Export deck
  async exportDeck(deckId: string, format: 'csv' | 'json'): Promise<string> {
    const db = await this.initDB();
    const deck = await db.get('decks', deckId);

    if (!deck) {
      throw new Error('Deck not found');
    }

    if (format === 'json') {
      return JSON.stringify({
        name: deck.name,
        description: deck.description,
        cards: deck.cards.map(card => ({
          front: card.front.text,
          frontHint: card.front.subtext,
          back: card.back.text,
          backHint: card.back.subtext,
          tags: card.metadata?.tags,
          notes: card.metadata?.notes
        }))
      }, null, 2);
    }

    // CSV format
    const headers = ['Front', 'Back', 'Front Hint', 'Back Hint', 'Tags', 'Notes'];
    const rows = deck.cards.map(card => [
      card.front.text,
      card.back.text,
      card.front.subtext || '',
      card.back.subtext || '',
      (card.metadata?.tags || []).join(';'),
      card.metadata?.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return csvContent;
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
      heatmapData: {}
    };
  }

  // Subscribe to changes
  subscribe(event: string, callback: () => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  // Notify listeners
  private notifyListeners(event: string): void {
    this.listeners.get(event)?.forEach(callback => callback());
  }

  // Sync a deck to Firebase (for premium users)
  async syncDeckToFirebase(deck: FlashcardDeck, userId: string): Promise<boolean> {
    try {
      console.log('[FlashcardManager.syncDeckToFirebase] Syncing deck to Firebase:', deck.id);

      // First, check if the deck exists in Firebase
      const checkResponse = await fetch(`/api/flashcards/decks/${deck.id}`, {
        method: 'GET',
        credentials: 'include'
      });

      let response;

      if (checkResponse.ok) {
        // Deck exists, update it
        console.log('[FlashcardManager.syncDeckToFirebase] Deck exists, updating...');

        const updateRequest: UpdateDeckRequest = {
          name: deck.name,
          description: deck.description,
          emoji: deck.emoji,
          color: deck.color,
          cardStyle: deck.cardStyle,
          settings: deck.settings,
          cards: deck.cards
        };

        response = await fetch(`/api/flashcards/decks/${deck.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(updateRequest)
        });
      } else if (checkResponse.status === 404) {
        // Deck doesn't exist, create it
        console.log('[FlashcardManager.syncDeckToFirebase] Deck not found, creating new...');

        const createRequest: CreateDeckRequest = {
          id: deck.id, // IMPORTANT: Pass the existing deck ID to prevent duplication
          name: deck.name,
          description: deck.description,
          emoji: deck.emoji,
          color: deck.color,
          cardStyle: deck.cardStyle,
          settings: deck.settings,
          initialCards: deck.cards,
          sourceListId: deck.sourceListId
        };

        response = await fetch('/api/flashcards/decks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(createRequest)
        });
      } else {
        console.error('[FlashcardManager.syncDeckToFirebase] Failed to check deck existence');
        return false;
      }

      if (response.ok) {
        console.log('[FlashcardManager.syncDeckToFirebase] Deck synced successfully');
        // Update local IndexedDB as well
        const db = await this.initDB();
        await db.put('decks', deck);
        this.notifyListeners('decks-changed');
        return true;
      } else {
        const error = await response.json();
        console.error('[FlashcardManager.syncDeckToFirebase] Sync failed:', error);
        return false;
      }
    } catch (error) {
      console.error('[FlashcardManager.syncDeckToFirebase] Error syncing deck:', error);
      return false;
    }
  }

  // Get deck limits for user tier
  static getDeckLimits(tier: string): { maxDecks: number; dailyReviews: number } {
    switch (tier) {
      case 'guest':
        return { maxDecks: 0, dailyReviews: 0 };
      case 'free':
        return { maxDecks: 10, dailyReviews: 50 };
      case 'premium_monthly':
      case 'premium_yearly':
        return { maxDecks: -1, dailyReviews: -1 }; // Unlimited
      default:
        return { maxDecks: 10, dailyReviews: 50 };
    }
  }

  // Get cards due for review from a specific deck
  async getDueCards(deckId: string, userId: string, limit?: number): Promise<FlashcardContent[]> {
    const db = await this.initDB();
    const deck = await this.getDeck(deckId, userId);

    if (!deck) return [];

    // Initialize SRS metadata for cards that don't have it
    const cardsWithSRS = deck.cards.map(card => {
      if (!card.metadata?.status) {
        return FlashcardSRSHelper.initializeCardSRS(card);
      }
      return card;
    });

    // Get due cards
    let dueCards = FlashcardSRSHelper.getDueCards(cardsWithSRS);

    // Sort by priority
    dueCards = FlashcardSRSHelper.sortByPriority(dueCards);

    // Apply daily limit for free users
    if (limit && limit > 0) {
      dueCards = dueCards.slice(0, limit);
    }

    return dueCards;
  }

  // Get all due cards across all decks for a user
  async getAllDueCards(userId: string, isPremium: boolean): Promise<{ deckId: string; cards: FlashcardContent[] }[]> {
    const decks = await this.getDecks(userId, isPremium);
    const limits = FlashcardManager.getDeckLimits(isPremium ? 'premium_yearly' : 'free');
    const dailyLimit = limits.dailyReviews === -1 ? undefined : limits.dailyReviews;

    const allDueCards: { deckId: string; cards: FlashcardContent[] }[] = [];
    let totalCards = 0;

    for (const deck of decks) {
      // Calculate remaining limit
      const remainingLimit = dailyLimit ? Math.max(0, dailyLimit - totalCards) : undefined;

      if (remainingLimit === 0) break;

      const dueCards = await this.getDueCards(deck.id, userId, remainingLimit);

      if (dueCards.length > 0) {
        allDueCards.push({
          deckId: deck.id,
          cards: dueCards
        });
        totalCards += dueCards.length;
      }
    }

    return allDueCards;
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
    const db = await this.initDB();
    const deck = await this.getDeck(deckId, userId);

    if (!deck) return null;

    // Find the card
    const cardIndex = deck.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return null;

    // Update card with SRS algorithm
    const updatedCard = await FlashcardSRSHelper.updateCardAfterReview(
      deck.cards[cardIndex],
      difficulty,
      responseTime
    );

    // Update deck
    deck.cards[cardIndex] = updatedCard;
    deck.updatedAt = Date.now();

    // Update deck stats based on card progress
    this.updateDeckStatsFromCard(deck, updatedCard, difficulty !== 'again');

    // Save to server ONLY for premium users
    if (isPremium && userId !== 'guest') {
      try {
        const response = await fetch(`/api/flashcards/decks/${deckId}/cards/${cardId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            metadata: updatedCard.metadata
          })
        });

        if (response.ok) {
          await db.put('decks', deck);
          this.notifyListeners(`deck-${deckId}`);
          return updatedCard;
        }
      } catch (error) {
        console.error('Failed to update card on server:', error);
      }
    }

    // Save to IndexedDB
    await db.put('decks', deck);
    this.notifyListeners(`deck-${deckId}`);
    return updatedCard;
  }

  // Update deck stats based on card review
  private updateDeckStatsFromCard(deck: FlashcardDeck, card: FlashcardContent, wasCorrect: boolean): void {
    // Update card type counts
    if (card.metadata?.status) {
      const oldStatus = deck.cards.find(c => c.id === card.id)?.metadata?.status;

      if (oldStatus !== card.metadata.status) {
        // Update counts when status changes
        switch (oldStatus) {
          case 'new': deck.stats.newCards = Math.max(0, deck.stats.newCards - 1); break;
          case 'learning': deck.stats.learningCards = Math.max(0, deck.stats.learningCards - 1); break;
          case 'review': deck.stats.reviewCards = Math.max(0, deck.stats.reviewCards - 1); break;
          case 'mastered': deck.stats.masteredCards = Math.max(0, deck.stats.masteredCards - 1); break;
        }

        switch (card.metadata.status) {
          case 'new': deck.stats.newCards++; break;
          case 'learning': deck.stats.learningCards++; break;
          case 'review': deck.stats.reviewCards++; break;
          case 'mastered': deck.stats.masteredCards++; break;
        }
      }
    }

    // Update studied count
    deck.stats.totalStudied++;
    deck.stats.lastStudied = Date.now();

    // Update accuracy (running average)
    const totalReviews = deck.stats.totalStudied;
    const currentAccuracy = deck.stats.averageAccuracy;
    deck.stats.averageAccuracy = ((currentAccuracy * (totalReviews - 1)) + (wasCorrect ? 1 : 0)) / totalReviews;
  }

  // Save session statistics
  async saveSessionStats(session: SessionStats, userId: string, isPremium: boolean): Promise<void> {
    const db = await this.initDB();

    // Update deck stats with session data
    const deck = await this.getDeck(session.deckId, userId);
    if (deck) {
      // Update cumulative stats
      deck.stats.totalTimeSpent += session.duration;

      // Update heatmap data
      const dateKey = new Date(session.timestamp).toISOString().split('T')[0];
      if (!deck.stats.heatmapData) {
        deck.stats.heatmapData = {};
      }
      deck.stats.heatmapData[dateKey] = (deck.stats.heatmapData[dateKey] || 0) + session.cardsStudied;

      // Save updated deck
      await db.put('decks', deck);
    }

    // For premium users, also save to Firebase
    if (isPremium && userId !== 'guest') {
      try {
        await fetch('/api/flashcards/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(session)
        });
      } catch (error) {
        console.error('Failed to save session to server:', error);
      }
    }
  }
}

// Export singleton instance
export const flashcardManager = new FlashcardManager();