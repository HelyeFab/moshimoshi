/**
 * Book Cache Manager
 * Handles automatic caching of library books in IndexedDB for offline access
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { CachedBook, BookCacheEntry, BookCacheStats, BOOK_CACHE_CONFIG } from './book-cache.types'

interface BookCacheDBSchema extends DBSchema {
  books: {
    key: string // book id
    value: BookCacheEntry
    indexes: {
      'by-cached-at': number
      'by-last-accessed': number
    }
  }
}

export class BookCacheManager {
  private static instance: BookCacheManager | null = null
  private db: IDBPDatabase<BookCacheDBSchema> | null = null
  private initPromise: Promise<void> | null = null

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): BookCacheManager {
    if (!BookCacheManager.instance) {
      BookCacheManager.instance = new BookCacheManager()
    }
    return BookCacheManager.instance
  }

  /**
   * Initialize the database
   */
  private async init(): Promise<void> {
    if (this.db) return

    if (this.initPromise) {
      await this.initPromise
      return
    }

    this.initPromise = this.initDB()
    await this.initPromise
  }

  private async initDB(): Promise<void> {
    try {
      this.db = await openDB<BookCacheDBSchema>(
        BOOK_CACHE_CONFIG.DB_NAME,
        BOOK_CACHE_CONFIG.DB_VERSION,
        {
          upgrade(db) {
            // Create books store
            if (!db.objectStoreNames.contains(BOOK_CACHE_CONFIG.STORE_NAME)) {
              const store = db.createObjectStore(BOOK_CACHE_CONFIG.STORE_NAME, {
                keyPath: 'book.id',
              })
              store.createIndex('by-cached-at', 'cachedAt')
              store.createIndex('by-last-accessed', 'lastAccessedAt')
            }
          },
        }
      )
      console.log('[BookCacheManager] Database initialized')
    } catch (error) {
      console.error('[BookCacheManager] Failed to initialize database:', error)
      throw error
    }
  }

  /**
   * Get a book from cache
   * Updates lastAccessedAt on retrieval
   */
  async get(bookId: string): Promise<CachedBook | null> {
    try {
      await this.init()
      if (!this.db) return null

      const entry = await this.db.get(BOOK_CACHE_CONFIG.STORE_NAME, bookId)

      if (!entry) {
        console.log('[BookCacheManager] Cache miss:', bookId)
        return null
      }

      // Check if expired
      const age = Date.now() - entry.cachedAt
      if (age > BOOK_CACHE_CONFIG.MAX_AGE_MS) {
        console.log('[BookCacheManager] Cache expired:', bookId)
        await this.delete(bookId)
        return null
      }

      // Update access stats
      const updatedEntry: BookCacheEntry = {
        ...entry,
        lastAccessedAt: Date.now(),
        accessCount: entry.accessCount + 1,
      }
      await this.db.put(BOOK_CACHE_CONFIG.STORE_NAME, updatedEntry)

      console.log('[BookCacheManager] Cache hit:', bookId)
      return entry.book
    } catch (error) {
      console.error('[BookCacheManager] Error getting book:', error)
      return null
    }
  }

  /**
   * Cache a book
   */
  async set(book: CachedBook): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      const now = Date.now()
      const existingEntry = await this.db.get(BOOK_CACHE_CONFIG.STORE_NAME, book.id)

      const entry: BookCacheEntry = {
        book,
        cachedAt: existingEntry?.cachedAt ?? now,
        lastAccessedAt: now,
        accessCount: (existingEntry?.accessCount ?? 0) + 1,
      }

      await this.db.put(BOOK_CACHE_CONFIG.STORE_NAME, entry)
      console.log('[BookCacheManager] Cached book:', book.id)

      // Cleanup old entries if needed
      await this.cleanup()
    } catch (error) {
      console.error('[BookCacheManager] Error caching book:', error)
    }
  }

  /**
   * Delete a book from cache
   */
  async delete(bookId: string): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      await this.db.delete(BOOK_CACHE_CONFIG.STORE_NAME, bookId)
      console.log('[BookCacheManager] Deleted book:', bookId)
    } catch (error) {
      console.error('[BookCacheManager] Error deleting book:', error)
    }
  }

  /**
   * Clear all cached books
   */
  async clear(): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      await this.db.clear(BOOK_CACHE_CONFIG.STORE_NAME)
      console.log('[BookCacheManager] Cache cleared')
    } catch (error) {
      console.error('[BookCacheManager] Error clearing cache:', error)
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<BookCacheStats> {
    try {
      await this.init()
      if (!this.db) {
        return { totalCached: 0, totalSizeEstimate: 0, oldestEntry: null, newestEntry: null }
      }

      const allEntries = await this.db.getAll(BOOK_CACHE_CONFIG.STORE_NAME)

      if (allEntries.length === 0) {
        return { totalCached: 0, totalSizeEstimate: 0, oldestEntry: null, newestEntry: null }
      }

      let oldestEntry = allEntries[0].cachedAt
      let newestEntry = allEntries[0].cachedAt
      let totalSizeEstimate = 0

      for (const entry of allEntries) {
        if (entry.cachedAt < oldestEntry) oldestEntry = entry.cachedAt
        if (entry.cachedAt > newestEntry) newestEntry = entry.cachedAt
        // Rough estimate: JSON stringify length * 2 (UTF-16)
        totalSizeEstimate += JSON.stringify(entry).length * 2
      }

      return {
        totalCached: allEntries.length,
        totalSizeEstimate,
        oldestEntry,
        newestEntry,
      }
    } catch (error) {
      console.error('[BookCacheManager] Error getting stats:', error)
      return { totalCached: 0, totalSizeEstimate: 0, oldestEntry: null, newestEntry: null }
    }
  }

  /**
   * Cleanup old/excess entries
   */
  private async cleanup(): Promise<void> {
    try {
      if (!this.db) return

      const allEntries = await this.db.getAll(BOOK_CACHE_CONFIG.STORE_NAME)

      // Remove expired entries
      const now = Date.now()
      const expiredIds: string[] = []
      for (const entry of allEntries) {
        if (now - entry.cachedAt > BOOK_CACHE_CONFIG.MAX_AGE_MS) {
          expiredIds.push(entry.book.id)
        }
      }

      for (const id of expiredIds) {
        await this.db.delete(BOOK_CACHE_CONFIG.STORE_NAME, id)
      }

      if (expiredIds.length > 0) {
        console.log('[BookCacheManager] Removed expired entries:', expiredIds.length)
      }

      // Check if we still have too many entries
      const remainingEntries = await this.db.getAll(BOOK_CACHE_CONFIG.STORE_NAME)

      if (remainingEntries.length > BOOK_CACHE_CONFIG.MAX_CACHED_BOOKS) {
        // Sort by lastAccessedAt (oldest first)
        remainingEntries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)

        // Remove oldest entries to get under the limit
        const toRemove = remainingEntries.length - BOOK_CACHE_CONFIG.MAX_CACHED_BOOKS
        const idsToRemove = remainingEntries.slice(0, toRemove).map(e => e.book.id)

        for (const id of idsToRemove) {
          await this.db.delete(BOOK_CACHE_CONFIG.STORE_NAME, id)
        }

        console.log('[BookCacheManager] Removed LRU entries:', toRemove)
      }
    } catch (error) {
      console.error('[BookCacheManager] Error during cleanup:', error)
    }
  }

  /**
   * Check if a book is cached
   */
  async has(bookId: string): Promise<boolean> {
    try {
      await this.init()
      if (!this.db) return false

      const entry = await this.db.get(BOOK_CACHE_CONFIG.STORE_NAME, bookId)
      if (!entry) return false

      // Check if expired
      const age = Date.now() - entry.cachedAt
      return age <= BOOK_CACHE_CONFIG.MAX_AGE_MS
    } catch (error) {
      console.error('[BookCacheManager] Error checking cache:', error)
      return false
    }
  }

  /**
   * Get all cached book IDs
   */
  async getCachedIds(): Promise<string[]> {
    try {
      await this.init()
      if (!this.db) return []

      const allEntries = await this.db.getAll(BOOK_CACHE_CONFIG.STORE_NAME)
      const now = Date.now()

      return allEntries
        .filter(entry => now - entry.cachedAt <= BOOK_CACHE_CONFIG.MAX_AGE_MS)
        .map(entry => entry.book.id)
    } catch (error) {
      console.error('[BookCacheManager] Error getting cached IDs:', error)
      return []
    }
  }

  /**
   * Prefetch books for offline use
   * Fetches and caches multiple books in the background
   */
  async prefetchBooks(
    bookIds: string[],
    options: {
      skipCached?: boolean
      onProgress?: (current: number, total: number) => void
    } = {}
  ): Promise<{ cached: number; failed: number; skipped: number }> {
    const { skipCached = true, onProgress } = options
    const results = { cached: 0, failed: 0, skipped: 0 }

    console.log('[BookCacheManager] Starting prefetch for', bookIds.length, 'books')

    for (let i = 0; i < bookIds.length; i++) {
      const bookId = bookIds[i]

      // Check if already cached
      if (skipCached) {
        const isCached = await this.has(bookId)
        if (isCached) {
          console.log('[BookCacheManager] Skipping already cached:', bookId)
          results.skipped++
          onProgress?.(i + 1, bookIds.length)
          continue
        }
      }

      try {
        // Fetch from API
        const response = await fetch(`/api/library/books?id=${bookId}`)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()

        if (!data.success || !data.book) {
          throw new Error('Book not found')
        }

        // Transform to CachedBook format
        const book: CachedBook = {
          id: data.book.id,
          title: data.book.title,
          titleJa: data.book.titleJa,
          bookName: data.book.bookName,
          author: data.book.author,
          content: data.book.content,
          summary: data.book.summary,
          coverImageUrl: data.book.coverImageUrl,
          audioUrl: data.book.audioUrl,
          jlptLevel: data.book.jlptLevel,
          category: data.book.category,
          tags: data.book.tags,
          createdAt: data.book.createdAt,
          updatedAt: data.book.updatedAt,
          status: data.book.status,
          viewCount: data.book.viewCount,
          readCount: data.book.readCount,
          metadata: data.book.metadata,
        }

        // Cache the book
        await this.set(book)
        results.cached++
        console.log('[BookCacheManager] Prefetched:', bookId)
      } catch (error) {
        console.warn('[BookCacheManager] Failed to prefetch:', bookId, error)
        results.failed++
      }

      onProgress?.(i + 1, bookIds.length)

      // Small delay to avoid hammering the server
      if (i < bookIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log('[BookCacheManager] Prefetch complete:', results)
    return results
  }
}

// Export singleton getter
export const getBookCacheManager = () => BookCacheManager.getInstance()
