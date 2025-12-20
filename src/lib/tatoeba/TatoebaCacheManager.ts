/**
 * Tatoeba Cache Manager
 * Handles automatic caching of Tatoeba example sentences in IndexedDB for offline access
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'
import {
  CachedTatoebaData,
  TatoebaCacheEntry,
  TatoebaCacheStats,
  TATOEBA_CACHE_CONFIG,
} from './tatoeba-cache.types'
import { TatoebaSentence, fetchTatoebaSentences } from '@/utils/tatoeba-client'
import KuromojiService from '@/utils/kuromojiService'

interface TatoebaCacheDBSchema extends DBSchema {
  sentences: {
    key: string // kanji character
    value: TatoebaCacheEntry
    indexes: {
      'by-cached-at': number
      'by-last-accessed': number
    }
  }
}

export class TatoebaCacheManager {
  private static instance: TatoebaCacheManager | null = null
  private db: IDBPDatabase<TatoebaCacheDBSchema> | null = null
  private initPromise: Promise<void> | null = null

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): TatoebaCacheManager {
    if (!TatoebaCacheManager.instance) {
      TatoebaCacheManager.instance = new TatoebaCacheManager()
    }
    return TatoebaCacheManager.instance
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
      this.db = await openDB<TatoebaCacheDBSchema>(
        TATOEBA_CACHE_CONFIG.DB_NAME,
        TATOEBA_CACHE_CONFIG.DB_VERSION,
        {
          upgrade(db) {
            // Create sentences store
            if (!db.objectStoreNames.contains(TATOEBA_CACHE_CONFIG.STORE_NAME)) {
              const store = db.createObjectStore(TATOEBA_CACHE_CONFIG.STORE_NAME, {
                keyPath: 'data.kanji',
              })
              store.createIndex('by-cached-at', 'cachedAt')
              store.createIndex('by-last-accessed', 'lastAccessedAt')
            }
          },
        }
      )
      console.log('[TatoebaCacheManager] Database initialized')
    } catch (error) {
      console.error('[TatoebaCacheManager] Failed to initialize database:', error)
      throw error
    }
  }

  /**
   * Get cached Tatoeba data for a kanji
   * Updates lastAccessedAt on retrieval
   */
  async get(kanji: string): Promise<CachedTatoebaData | null> {
    try {
      await this.init()
      if (!this.db) return null

      const entry = await this.db.get(TATOEBA_CACHE_CONFIG.STORE_NAME, kanji)

      if (!entry) {
        console.log('[TatoebaCacheManager] Cache miss:', kanji)
        return null
      }

      // Check if expired
      const age = Date.now() - entry.cachedAt
      if (age > TATOEBA_CACHE_CONFIG.MAX_AGE_MS) {
        console.log('[TatoebaCacheManager] Cache expired:', kanji)
        await this.delete(kanji)
        return null
      }

      // Update access stats
      const updatedEntry: TatoebaCacheEntry = {
        ...entry,
        lastAccessedAt: Date.now(),
        accessCount: entry.accessCount + 1,
      }
      await this.db.put(TATOEBA_CACHE_CONFIG.STORE_NAME, updatedEntry)

      console.log('[TatoebaCacheManager] Cache hit:', kanji)
      return entry.data
    } catch (error) {
      console.error('[TatoebaCacheManager] Error getting cache:', error)
      return null
    }
  }

  /**
   * Cache Tatoeba data for a kanji
   */
  async set(data: CachedTatoebaData): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      const now = Date.now()
      const existingEntry = await this.db.get(TATOEBA_CACHE_CONFIG.STORE_NAME, data.kanji)

      const entry: TatoebaCacheEntry = {
        data,
        cachedAt: existingEntry?.cachedAt ?? now,
        lastAccessedAt: now,
        accessCount: (existingEntry?.accessCount ?? 0) + 1,
      }

      await this.db.put(TATOEBA_CACHE_CONFIG.STORE_NAME, entry)
      console.log('[TatoebaCacheManager] Cached sentences for:', data.kanji)

      // Cleanup old entries if needed
      await this.cleanup()
    } catch (error) {
      console.error('[TatoebaCacheManager] Error caching:', error)
    }
  }

  /**
   * Delete a kanji's cached data
   */
  async delete(kanji: string): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      await this.db.delete(TATOEBA_CACHE_CONFIG.STORE_NAME, kanji)
      console.log('[TatoebaCacheManager] Deleted cache for:', kanji)
    } catch (error) {
      console.error('[TatoebaCacheManager] Error deleting:', error)
    }
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      await this.db.clear(TATOEBA_CACHE_CONFIG.STORE_NAME)
      console.log('[TatoebaCacheManager] Cache cleared')
    } catch (error) {
      console.error('[TatoebaCacheManager] Error clearing cache:', error)
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<TatoebaCacheStats> {
    try {
      await this.init()
      if (!this.db) {
        return { totalCached: 0, totalSizeEstimate: 0, oldestEntry: null, newestEntry: null }
      }

      const allEntries = await this.db.getAll(TATOEBA_CACHE_CONFIG.STORE_NAME)

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
      console.error('[TatoebaCacheManager] Error getting stats:', error)
      return { totalCached: 0, totalSizeEstimate: 0, oldestEntry: null, newestEntry: null }
    }
  }

  /**
   * Cleanup old/excess entries
   */
  private async cleanup(): Promise<void> {
    try {
      if (!this.db) return

      const allEntries = await this.db.getAll(TATOEBA_CACHE_CONFIG.STORE_NAME)

      // Remove expired entries
      const now = Date.now()
      const expiredKanji: string[] = []
      for (const entry of allEntries) {
        if (now - entry.cachedAt > TATOEBA_CACHE_CONFIG.MAX_AGE_MS) {
          expiredKanji.push(entry.data.kanji)
        }
      }

      for (const kanji of expiredKanji) {
        await this.db.delete(TATOEBA_CACHE_CONFIG.STORE_NAME, kanji)
      }

      if (expiredKanji.length > 0) {
        console.log('[TatoebaCacheManager] Removed expired entries:', expiredKanji.length)
      }

      // Check if we still have too many entries
      const remainingEntries = await this.db.getAll(TATOEBA_CACHE_CONFIG.STORE_NAME)

      if (remainingEntries.length > TATOEBA_CACHE_CONFIG.MAX_CACHED_KANJI) {
        // Sort by lastAccessedAt (oldest first)
        remainingEntries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)

        // Remove oldest entries to get under the limit
        const toRemove = remainingEntries.length - TATOEBA_CACHE_CONFIG.MAX_CACHED_KANJI
        const kanjiToRemove = remainingEntries.slice(0, toRemove).map(e => e.data.kanji)

        for (const kanji of kanjiToRemove) {
          await this.db.delete(TATOEBA_CACHE_CONFIG.STORE_NAME, kanji)
        }

        console.log('[TatoebaCacheManager] Removed LRU entries:', toRemove)
      }
    } catch (error) {
      console.error('[TatoebaCacheManager] Error during cleanup:', error)
    }
  }

  /**
   * Check if a kanji's sentences are cached
   */
  async has(kanji: string): Promise<boolean> {
    try {
      await this.init()
      if (!this.db) return false

      const entry = await this.db.get(TATOEBA_CACHE_CONFIG.STORE_NAME, kanji)
      if (!entry) return false

      // Check if expired
      const age = Date.now() - entry.cachedAt
      return age <= TATOEBA_CACHE_CONFIG.MAX_AGE_MS
    } catch (error) {
      console.error('[TatoebaCacheManager] Error checking cache:', error)
      return false
    }
  }

  /**
   * Get all cached kanji characters
   */
  async getCachedKanji(): Promise<string[]> {
    try {
      await this.init()
      if (!this.db) return []

      const allEntries = await this.db.getAll(TATOEBA_CACHE_CONFIG.STORE_NAME)
      const now = Date.now()

      return allEntries
        .filter(entry => now - entry.cachedAt <= TATOEBA_CACHE_CONFIG.MAX_AGE_MS)
        .map(entry => entry.data.kanji)
    } catch (error) {
      console.error('[TatoebaCacheManager] Error getting cached kanji:', error)
      return []
    }
  }

  /**
   * Fetch and cache Tatoeba sentences for a kanji
   * This is the main method for getting sentences with automatic caching
   */
  async fetchAndCache(
    kanji: string,
    limit: number = TATOEBA_CACHE_CONFIG.DEFAULT_SENTENCE_LIMIT
  ): Promise<CachedTatoebaData> {
    // Try cache first
    const cached = await this.get(kanji)
    if (cached) {
      return cached
    }

    // Fetch from Tatoeba API
    console.log('[TatoebaCacheManager] Fetching from Tatoeba API:', kanji)
    const sentences = await fetchTatoebaSentences(kanji, limit)

    // Generate furigana for each sentence
    const furiganaTexts: Record<string, string> = {}

    if (sentences.length > 0) {
      try {
        const kuromoji = KuromojiService.getInstance()
        for (const sentence of sentences) {
          try {
            const withFurigana = await kuromoji.addFurigana(sentence.japanese)
            furiganaTexts[sentence.japanese] = withFurigana
          } catch (error) {
            console.error('[TatoebaCacheManager] Error generating furigana:', error)
            furiganaTexts[sentence.japanese] = sentence.japanese
          }
        }
      } catch (error) {
        console.error('[TatoebaCacheManager] Kuromoji service error:', error)
        // Fallback: use raw text without furigana
        for (const sentence of sentences) {
          furiganaTexts[sentence.japanese] = sentence.japanese
        }
      }
    }

    // Create cache data
    const data: CachedTatoebaData = {
      kanji,
      sentences,
      furiganaTexts,
    }

    // Cache the result (even if empty - to avoid repeated failed lookups)
    await this.set(data)

    return data
  }

  /**
   * Prefetch Tatoeba sentences for multiple kanji
   * Useful for pre-loading sentences for upcoming study items
   */
  async prefetch(
    kanjiList: string[],
    options: {
      skipCached?: boolean
      limit?: number
      onProgress?: (current: number, total: number) => void
    } = {}
  ): Promise<{ cached: number; failed: number; skipped: number }> {
    const {
      skipCached = true,
      limit = TATOEBA_CACHE_CONFIG.DEFAULT_SENTENCE_LIMIT,
      onProgress,
    } = options
    const results = { cached: 0, failed: 0, skipped: 0 }

    console.log('[TatoebaCacheManager] Starting prefetch for', kanjiList.length, 'kanji')

    for (let i = 0; i < kanjiList.length; i++) {
      const kanji = kanjiList[i]

      // Check if already cached
      if (skipCached) {
        const isCached = await this.has(kanji)
        if (isCached) {
          console.log('[TatoebaCacheManager] Skipping already cached:', kanji)
          results.skipped++
          onProgress?.(i + 1, kanjiList.length)
          continue
        }
      }

      try {
        await this.fetchAndCache(kanji, limit)
        results.cached++
      } catch (error) {
        console.warn('[TatoebaCacheManager] Failed to prefetch:', kanji, error)
        results.failed++
      }

      onProgress?.(i + 1, kanjiList.length)

      // Small delay to avoid hammering the server
      if (i < kanjiList.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log('[TatoebaCacheManager] Prefetch complete:', results)
    return results
  }
}

// Export singleton getter
export const getTatoebaCacheManager = () => TatoebaCacheManager.getInstance()
