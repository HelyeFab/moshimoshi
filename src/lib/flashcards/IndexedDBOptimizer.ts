import { openDB, IDBPDatabase, DBSchema } from 'idb';
import type { FlashcardDeck } from '@/types/flashcards';

interface OptimizedFlashcardDB extends DBSchema {
  decks: {
    key: string;
    value: FlashcardDeck;
    indexes: {
      'userId': string;
      'updatedAt': number;
      'sourceListId': string;
      'userId-updatedAt': [string, number];
      'cardCount': number;
    };
  };
  deckCache: {
    key: string;
    value: {
      id: string;
      data: FlashcardDeck;
      timestamp: number;
      size: number;
    };
  };
  queryCache: {
    key: string;
    value: {
      query: string;
      results: string[];
      timestamp: number;
    };
  };
}

export class IndexedDBOptimizer {
  private db: IDBPDatabase<OptimizedFlashcardDB> | null = null;
  private memoryCache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private maxMemoryCacheSize = 50; // Maximum items in memory cache
  private queryBatchSize = 20; // Items per batch for pagination
  private indexHints: Map<string, string> = new Map();

  constructor() {
    // Setup index hints for common queries
    this.indexHints.set('getByUser', 'userId');
    this.indexHints.set('getRecent', 'userId-updatedAt');
    this.indexHints.set('getLarge', 'cardCount');
  }

  // Initialize optimized database
  async initDB(): Promise<IDBPDatabase<OptimizedFlashcardDB>> {
    if (this.db) return this.db;

    this.db = await openDB<OptimizedFlashcardDB>('OptimizedFlashcardDB', 2, {
      upgrade(db, oldVersion) {
        // Main decks store
        if (!db.objectStoreNames.contains('decks')) {
          const decksStore = db.createObjectStore('decks', { keyPath: 'id' });
          decksStore.createIndex('userId', 'userId');
          decksStore.createIndex('updatedAt', 'updatedAt');
          decksStore.createIndex('sourceListId', 'sourceListId');
          // Compound index for efficient user + date queries
          decksStore.createIndex('userId-updatedAt', ['userId', 'updatedAt']);
          decksStore.createIndex('cardCount', 'stats.totalCards');
        }

        // Cache store for frequently accessed decks
        if (!db.objectStoreNames.contains('deckCache')) {
          const cacheStore = db.createObjectStore('deckCache', { keyPath: 'id' });
          cacheStore.createIndex('timestamp', 'timestamp');
        }

        // Query result cache
        if (!db.objectStoreNames.contains('queryCache')) {
          const queryStore = db.createObjectStore('queryCache', { keyPath: 'query' });
          queryStore.createIndex('timestamp', 'timestamp');
        }

        // Migrate existing data if needed
        if (oldVersion === 1) {
          // Add cardCount index to existing data
          const tx = db.transaction('decks', 'readwrite');
          tx.objectStore('decks').createIndex('cardCount', 'stats.totalCards');
        }
      }
    });

    // Setup periodic cache cleanup
    this.startCacheCleanup();

    return this.db;
  }

  // Optimized get decks for user with pagination
  async getDecksOptimized(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'updatedAt' | 'name' | 'cardCount';
      sortOrder?: 'asc' | 'desc';
      useCache?: boolean;
    } = {}
  ): Promise<{ decks: FlashcardDeck[]; hasMore: boolean; total: number }> {
    const {
      limit = this.queryBatchSize,
      offset = 0,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      useCache = true
    } = options;

    // Check memory cache first
    const cacheKey = `decks:${userId}:${sortBy}:${sortOrder}:${limit}:${offset}`;
    if (useCache) {
      const cached = this.getFromMemoryCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const db = await this.initDB();

    // Use compound index for efficient querying
    const tx = db.transaction('decks', 'readonly');
    const store = tx.objectStore('decks');

    let decks: FlashcardDeck[];
    let total: number;

    // Use appropriate index based on query
    if (sortBy === 'updatedAt') {
      // Use compound index for user + date queries
      const index = store.index('userId-updatedAt');
      const range = IDBKeyRange.bound([userId, -Infinity], [userId, Infinity]);

      const allDecks = await index.getAll(range);
      total = allDecks.length;

      // Sort and paginate in memory
      if (sortOrder === 'desc') {
        allDecks.sort((a, b) => b.updatedAt - a.updatedAt);
      }

      decks = allDecks.slice(offset, offset + limit);
    } else if (sortBy === 'cardCount') {
      // Query by card count
      const index = store.index('cardCount');
      const allDecks = await index.getAll();

      // Filter by user
      const userDecks = allDecks.filter(d => d.userId === userId);
      total = userDecks.length;

      // Sort if needed
      if (sortOrder === 'desc') {
        userDecks.sort((a, b) => b.stats.totalCards - a.stats.totalCards);
      } else {
        userDecks.sort((a, b) => a.stats.totalCards - b.stats.totalCards);
      }

      decks = userDecks.slice(offset, offset + limit);
    } else {
      // Fallback to regular index
      const index = store.index('userId');
      const allDecks = await index.getAll(userId);
      total = allDecks.length;

      // Sort by name
      if (sortBy === 'name') {
        allDecks.sort((a, b) => {
          const comparison = a.name.localeCompare(b.name);
          return sortOrder === 'desc' ? -comparison : comparison;
        });
      }

      decks = allDecks.slice(offset, offset + limit);
    }

    await tx.done;

    const result = {
      decks,
      hasMore: offset + limit < total,
      total
    };

    // Cache result
    if (useCache) {
      this.setInMemoryCache(cacheKey, result);
    }

    return result;
  }

  // Bulk operations for better performance
  async bulkCreateDecks(decks: FlashcardDeck[]): Promise<void> {
    const db = await this.initDB();
    const tx = db.transaction('decks', 'readwrite');

    // Use Promise.all for parallel inserts
    await Promise.all(decks.map(deck => tx.store.put(deck)));
    await tx.done;

    // Clear relevant caches
    this.clearUserCache(decks[0]?.userId);
  }

  async bulkUpdateDecks(updates: Array<{ id: string; changes: Partial<FlashcardDeck> }>): Promise<void> {
    const db = await this.initDB();
    const tx = db.transaction('decks', 'readwrite');

    await Promise.all(
      updates.map(async ({ id, changes }) => {
        const deck = await tx.store.get(id);
        if (deck) {
          Object.assign(deck, changes, { updatedAt: Date.now() });
          await tx.store.put(deck);
        }
      })
    );

    await tx.done;

    // Clear caches
    this.clearMemoryCache();
  }

  async bulkDeleteDecks(deckIds: string[]): Promise<void> {
    const db = await this.initDB();
    const tx = db.transaction('decks', 'readwrite');

    await Promise.all(deckIds.map(id => tx.store.delete(id)));
    await tx.done;

    // Clear caches
    this.clearMemoryCache();
  }

  // Optimized search with full-text capability
  async searchDecks(
    userId: string,
    searchTerm: string,
    options: {
      searchIn?: ('name' | 'description' | 'cards')[];
      limit?: number;
    } = {}
  ): Promise<FlashcardDeck[]> {
    const {
      searchIn = ['name', 'description'],
      limit = 20
    } = options;

    const cacheKey = `search:${userId}:${searchTerm}:${searchIn.join(',')}`;
    const cached = this.getFromMemoryCache(cacheKey);
    if (cached) {
      return cached;
    }

    const db = await this.initDB();
    const index = db.transaction('decks').objectStore('decks').index('userId');
    const allDecks = await index.getAll(userId);

    const searchLower = searchTerm.toLowerCase();
    const results = allDecks.filter(deck => {
      // Search in name
      if (searchIn.includes('name') && deck.name.toLowerCase().includes(searchLower)) {
        return true;
      }

      // Search in description
      if (searchIn.includes('description') && deck.description?.toLowerCase().includes(searchLower)) {
        return true;
      }

      // Search in cards
      if (searchIn.includes('cards')) {
        return deck.cards.some(card =>
          card.front.text.toLowerCase().includes(searchLower) ||
          card.back.text.toLowerCase().includes(searchLower)
        );
      }

      return false;
    }).slice(0, limit);

    // Cache results
    this.setInMemoryCache(cacheKey, results);

    return results;
  }

  // Prefetch and cache frequently accessed decks
  async prefetchPopularDecks(userId: string): Promise<void> {
    const db = await this.initDB();
    const tx = db.transaction('decks', 'readonly');
    const index = tx.objectStore('decks').index('userId-updatedAt');

    // Get 5 most recently updated decks
    const range = IDBKeyRange.bound([userId, -Infinity], [userId, Infinity]);
    const recentDecks = await index.getAll(range, 5);

    // Cache them
    for (const deck of recentDecks) {
      const cacheEntry = {
        id: deck.id,
        data: deck,
        timestamp: Date.now(),
        size: JSON.stringify(deck).length
      };

      const cacheDb = await this.initDB();
      await cacheDb.put('deckCache', cacheEntry);
    }
  }

  // Get deck with caching
  async getDeckOptimized(deckId: string): Promise<FlashcardDeck | null> {
    // Check memory cache
    const cached = this.getFromMemoryCache(`deck:${deckId}`);
    if (cached) {
      return cached;
    }

    const db = await this.initDB();

    // Check persistent cache
    const cacheEntry = await db.get('deckCache', deckId);
    if (cacheEntry && Date.now() - cacheEntry.timestamp < this.cacheTimeout) {
      this.setInMemoryCache(`deck:${deckId}`, cacheEntry.data);
      return cacheEntry.data;
    }

    // Get from main store
    const deck = await db.get('decks', deckId);
    if (deck) {
      // Update caches
      this.setInMemoryCache(`deck:${deckId}`, deck);
      await db.put('deckCache', {
        id: deckId,
        data: deck,
        timestamp: Date.now(),
        size: JSON.stringify(deck).length
      });
    }

    return deck;
  }

  // Memory cache management
  private getFromMemoryCache(key: string): any {
    const entry = this.memoryCache.get(key);
    if (entry && Date.now() - entry.timestamp < this.cacheTimeout) {
      return entry.data;
    }
    this.memoryCache.delete(key);
    return null;
  }

  private setInMemoryCache(key: string, data: any): void {
    // Implement LRU eviction if cache is full
    if (this.memoryCache.size >= this.maxMemoryCacheSize) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }

    this.memoryCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private clearMemoryCache(): void {
    this.memoryCache.clear();
  }

  private clearUserCache(userId?: string): void {
    if (!userId) {
      this.clearMemoryCache();
      return;
    }

    // Clear only user-specific entries
    for (const [key] of this.memoryCache) {
      if (key.includes(userId)) {
        this.memoryCache.delete(key);
      }
    }
  }

  // Periodic cache cleanup
  private startCacheCleanup(): void {
    setInterval(async () => {
      // Clean memory cache
      const now = Date.now();
      for (const [key, entry] of this.memoryCache) {
        if (now - entry.timestamp > this.cacheTimeout) {
          this.memoryCache.delete(key);
        }
      }

      // Clean persistent cache
      if (this.db) {
        const tx = this.db.transaction(['deckCache', 'queryCache'], 'readwrite');

        // Clean old deck cache entries
        const deckCacheIndex = tx.objectStore('deckCache').index('timestamp');
        const oldTime = now - this.cacheTimeout;
        const range = IDBKeyRange.upperBound(oldTime);
        const oldEntries = await deckCacheIndex.getAllKeys(range);

        await Promise.all(oldEntries.map(key =>
          tx.objectStore('deckCache').delete(key)
        ));

        // Clean old query cache entries
        const queryCacheIndex = tx.objectStore('queryCache').index('timestamp');
        const oldQueries = await queryCacheIndex.getAllKeys(range);

        await Promise.all(oldQueries.map(key =>
          tx.objectStore('queryCache').delete(key)
        ));

        await tx.done;
      }
    }, 60000); // Run every minute
  }

  // Database size management
  async getDatabaseSize(): Promise<{
    deckCount: number;
    cacheSize: number;
    estimatedBytes: number;
  }> {
    const db = await this.initDB();

    const deckCount = await db.count('decks');
    const cacheCount = await db.count('deckCache');

    // Estimate storage size
    let estimatedBytes = 0;
    const tx = db.transaction('deckCache', 'readonly');
    const cacheEntries = await tx.store.getAll();

    for (const entry of cacheEntries) {
      estimatedBytes += entry.size;
    }

    return {
      deckCount,
      cacheSize: cacheCount,
      estimatedBytes
    };
  }

  // Cleanup and optimization
  async optimizeDatabase(): Promise<void> {
    const db = await this.initDB();

    // Clear all caches
    const tx = db.transaction(['deckCache', 'queryCache'], 'readwrite');
    await tx.objectStore('deckCache').clear();
    await tx.objectStore('queryCache').clear();
    await tx.done;

    // Clear memory cache
    this.clearMemoryCache();

    console.log('[IndexedDBOptimizer] Database optimized and caches cleared');
  }

  // Close database connection
  destroy(): void {
    this.clearMemoryCache();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Export singleton
export const dbOptimizer = new IndexedDBOptimizer();