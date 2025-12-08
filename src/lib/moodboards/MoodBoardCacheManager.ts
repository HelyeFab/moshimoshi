/**
 * MoodBoard Cache Manager
 * Handles automatic caching of kanji moodboards in IndexedDB for offline access
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'
import {
  CachedMoodBoard,
  MoodBoardCacheEntry,
  MoodBoardCacheStats,
  MOODBOARD_CACHE_CONFIG,
} from './moodboard-cache.types'
import type { MoodBoard } from '@/types/moodboard'

interface MoodBoardCacheDBSchema extends DBSchema {
  moodboards: {
    key: string // moodboard id
    value: MoodBoardCacheEntry
    indexes: {
      'by-cached-at': number
      'by-last-accessed': number
    }
  }
}

export class MoodBoardCacheManager {
  private static instance: MoodBoardCacheManager | null = null
  private db: IDBPDatabase<MoodBoardCacheDBSchema> | null = null
  private initPromise: Promise<void> | null = null

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): MoodBoardCacheManager {
    if (!MoodBoardCacheManager.instance) {
      MoodBoardCacheManager.instance = new MoodBoardCacheManager()
    }
    return MoodBoardCacheManager.instance
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
      this.db = await openDB<MoodBoardCacheDBSchema>(
        MOODBOARD_CACHE_CONFIG.DB_NAME,
        MOODBOARD_CACHE_CONFIG.DB_VERSION,
        {
          upgrade(db) {
            // Create moodboards store
            if (!db.objectStoreNames.contains(MOODBOARD_CACHE_CONFIG.STORE_NAME)) {
              const store = db.createObjectStore(MOODBOARD_CACHE_CONFIG.STORE_NAME, {
                keyPath: 'moodBoard.id',
              })
              store.createIndex('by-cached-at', 'cachedAt')
              store.createIndex('by-last-accessed', 'lastAccessedAt')
            }
          },
        }
      )
      console.log('[MoodBoardCacheManager] Database initialized')
    } catch (error) {
      console.error('[MoodBoardCacheManager] Failed to initialize database:', error)
      throw error
    }
  }

  /**
   * Convert MoodBoard to CachedMoodBoard (handles Date -> string conversion)
   */
  private toCachedMoodBoard(moodBoard: MoodBoard): CachedMoodBoard {
    return {
      id: moodBoard.id,
      title: moodBoard.title,
      emoji: moodBoard.emoji,
      jlpt: moodBoard.jlpt,
      background: moodBoard.background,
      description: moodBoard.description,
      kanji: moodBoard.kanji,
      createdAt:
        moodBoard.createdAt instanceof Date
          ? moodBoard.createdAt.toISOString()
          : String(moodBoard.createdAt),
      updatedAt:
        moodBoard.updatedAt instanceof Date
          ? moodBoard.updatedAt.toISOString()
          : moodBoard.updatedAt
            ? String(moodBoard.updatedAt)
            : undefined,
      createdBy: moodBoard.createdBy,
      isActive: moodBoard.isActive,
      sortOrder: moodBoard.sortOrder,
    }
  }

  /**
   * Get a moodboard from cache
   * Updates lastAccessedAt on retrieval
   */
  async get(boardId: string): Promise<CachedMoodBoard | null> {
    try {
      await this.init()
      if (!this.db) return null

      const entry = await this.db.get(MOODBOARD_CACHE_CONFIG.STORE_NAME, boardId)

      if (!entry) {
        console.log('[MoodBoardCacheManager] Cache miss:', boardId)
        return null
      }

      // Check if expired
      const age = Date.now() - entry.cachedAt
      if (age > MOODBOARD_CACHE_CONFIG.MAX_AGE_MS) {
        console.log('[MoodBoardCacheManager] Cache expired:', boardId)
        await this.delete(boardId)
        return null
      }

      // Update access stats
      const updatedEntry: MoodBoardCacheEntry = {
        ...entry,
        lastAccessedAt: Date.now(),
        accessCount: entry.accessCount + 1,
      }
      await this.db.put(MOODBOARD_CACHE_CONFIG.STORE_NAME, updatedEntry)

      console.log('[MoodBoardCacheManager] Cache hit:', boardId)
      return entry.moodBoard
    } catch (error) {
      console.error('[MoodBoardCacheManager] Error getting moodboard:', error)
      return null
    }
  }

  /**
   * Get all cached moodboards
   */
  async getAll(): Promise<CachedMoodBoard[]> {
    try {
      await this.init()
      if (!this.db) return []

      const allEntries = await this.db.getAll(MOODBOARD_CACHE_CONFIG.STORE_NAME)
      const now = Date.now()

      return allEntries
        .filter(entry => now - entry.cachedAt <= MOODBOARD_CACHE_CONFIG.MAX_AGE_MS)
        .map(entry => entry.moodBoard)
    } catch (error) {
      console.error('[MoodBoardCacheManager] Error getting all moodboards:', error)
      return []
    }
  }

  /**
   * Cache a moodboard
   */
  async set(moodBoard: MoodBoard | CachedMoodBoard): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      const cachedMoodBoard =
        'createdAt' in moodBoard && moodBoard.createdAt instanceof Date
          ? this.toCachedMoodBoard(moodBoard as MoodBoard)
          : (moodBoard as CachedMoodBoard)

      const now = Date.now()
      const existingEntry = await this.db.get(MOODBOARD_CACHE_CONFIG.STORE_NAME, cachedMoodBoard.id)

      const entry: MoodBoardCacheEntry = {
        moodBoard: cachedMoodBoard,
        cachedAt: existingEntry?.cachedAt ?? now,
        lastAccessedAt: now,
        accessCount: (existingEntry?.accessCount ?? 0) + 1,
      }

      await this.db.put(MOODBOARD_CACHE_CONFIG.STORE_NAME, entry)
      console.log('[MoodBoardCacheManager] Cached moodboard:', cachedMoodBoard.id)

      // Cleanup old entries if needed
      await this.cleanup()
    } catch (error) {
      console.error('[MoodBoardCacheManager] Error caching moodboard:', error)
    }
  }

  /**
   * Delete a moodboard from cache
   */
  async delete(boardId: string): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      await this.db.delete(MOODBOARD_CACHE_CONFIG.STORE_NAME, boardId)
      console.log('[MoodBoardCacheManager] Deleted moodboard:', boardId)
    } catch (error) {
      console.error('[MoodBoardCacheManager] Error deleting moodboard:', error)
    }
  }

  /**
   * Clear all cached moodboards
   */
  async clear(): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      await this.db.clear(MOODBOARD_CACHE_CONFIG.STORE_NAME)
      console.log('[MoodBoardCacheManager] Cache cleared')
    } catch (error) {
      console.error('[MoodBoardCacheManager] Error clearing cache:', error)
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<MoodBoardCacheStats> {
    try {
      await this.init()
      if (!this.db) {
        return { totalCached: 0, totalSizeEstimate: 0, oldestEntry: null, newestEntry: null }
      }

      const allEntries = await this.db.getAll(MOODBOARD_CACHE_CONFIG.STORE_NAME)

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
      console.error('[MoodBoardCacheManager] Error getting stats:', error)
      return { totalCached: 0, totalSizeEstimate: 0, oldestEntry: null, newestEntry: null }
    }
  }

  /**
   * Cleanup old/excess entries
   */
  private async cleanup(): Promise<void> {
    try {
      if (!this.db) return

      const allEntries = await this.db.getAll(MOODBOARD_CACHE_CONFIG.STORE_NAME)

      // Remove expired entries
      const now = Date.now()
      const expiredIds: string[] = []
      for (const entry of allEntries) {
        if (now - entry.cachedAt > MOODBOARD_CACHE_CONFIG.MAX_AGE_MS) {
          expiredIds.push(entry.moodBoard.id)
        }
      }

      for (const id of expiredIds) {
        await this.db.delete(MOODBOARD_CACHE_CONFIG.STORE_NAME, id)
      }

      if (expiredIds.length > 0) {
        console.log('[MoodBoardCacheManager] Removed expired entries:', expiredIds.length)
      }

      // Check if we still have too many entries
      const remainingEntries = await this.db.getAll(MOODBOARD_CACHE_CONFIG.STORE_NAME)

      if (remainingEntries.length > MOODBOARD_CACHE_CONFIG.MAX_CACHED_BOARDS) {
        // Sort by lastAccessedAt (oldest first)
        remainingEntries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)

        // Remove oldest entries to get under the limit
        const toRemove = remainingEntries.length - MOODBOARD_CACHE_CONFIG.MAX_CACHED_BOARDS
        const idsToRemove = remainingEntries.slice(0, toRemove).map(e => e.moodBoard.id)

        for (const id of idsToRemove) {
          await this.db.delete(MOODBOARD_CACHE_CONFIG.STORE_NAME, id)
        }

        console.log('[MoodBoardCacheManager] Removed LRU entries:', toRemove)
      }
    } catch (error) {
      console.error('[MoodBoardCacheManager] Error during cleanup:', error)
    }
  }

  /**
   * Check if a moodboard is cached
   */
  async has(boardId: string): Promise<boolean> {
    try {
      await this.init()
      if (!this.db) return false

      const entry = await this.db.get(MOODBOARD_CACHE_CONFIG.STORE_NAME, boardId)
      if (!entry) return false

      // Check if expired
      const age = Date.now() - entry.cachedAt
      return age <= MOODBOARD_CACHE_CONFIG.MAX_AGE_MS
    } catch (error) {
      console.error('[MoodBoardCacheManager] Error checking cache:', error)
      return false
    }
  }

  /**
   * Get all cached moodboard IDs
   */
  async getCachedIds(): Promise<string[]> {
    try {
      await this.init()
      if (!this.db) return []

      const allEntries = await this.db.getAll(MOODBOARD_CACHE_CONFIG.STORE_NAME)
      const now = Date.now()

      return allEntries
        .filter(entry => now - entry.cachedAt <= MOODBOARD_CACHE_CONFIG.MAX_AGE_MS)
        .map(entry => entry.moodBoard.id)
    } catch (error) {
      console.error('[MoodBoardCacheManager] Error getting cached IDs:', error)
      return []
    }
  }

  /**
   * Prefetch moodboards for offline use
   * Since moodboards are typically fetched all at once from the API,
   * this method takes an array of MoodBoard objects and caches them all
   */
  async prefetchMoodBoards(
    moodBoards: MoodBoard[],
    options: {
      skipCached?: boolean
      onProgress?: (current: number, total: number) => void
    } = {}
  ): Promise<{ cached: number; failed: number; skipped: number }> {
    const { skipCached = true, onProgress } = options
    const results = { cached: 0, failed: 0, skipped: 0 }

    console.log('[MoodBoardCacheManager] Starting prefetch for', moodBoards.length, 'moodboards')

    for (let i = 0; i < moodBoards.length; i++) {
      const moodBoard = moodBoards[i]

      // Check if already cached
      if (skipCached) {
        const isCached = await this.has(moodBoard.id)
        if (isCached) {
          console.log('[MoodBoardCacheManager] Skipping already cached:', moodBoard.id)
          results.skipped++
          onProgress?.(i + 1, moodBoards.length)
          continue
        }
      }

      try {
        // Cache the moodboard directly (already have the data from API)
        await this.set(moodBoard)
        results.cached++
        console.log('[MoodBoardCacheManager] Prefetched:', moodBoard.id)
      } catch (error) {
        console.warn('[MoodBoardCacheManager] Failed to prefetch:', moodBoard.id, error)
        results.failed++
      }

      onProgress?.(i + 1, moodBoards.length)
    }

    console.log('[MoodBoardCacheManager] Prefetch complete:', results)
    return results
  }
}

// Export singleton getter
export const getMoodBoardCacheManager = () => MoodBoardCacheManager.getInstance()
