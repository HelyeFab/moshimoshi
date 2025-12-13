/**
 * Comic Cache Manager
 * Handles automatic caching of comic episodes in IndexedDB for offline access
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'
import {
  CachedComicEpisode,
  ComicCacheEntry,
  ComicCacheStats,
  COMIC_CACHE_CONFIG,
} from './comic-cache.types'

interface ComicCacheDBSchema extends DBSchema {
  episodes: {
    key: string // episode id
    value: ComicCacheEntry
    indexes: {
      'by-cached-at': number
      'by-last-accessed': number
    }
  }
}

export class ComicCacheManager {
  private static instance: ComicCacheManager | null = null
  private db: IDBPDatabase<ComicCacheDBSchema> | null = null
  private initPromise: Promise<void> | null = null

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ComicCacheManager {
    if (!ComicCacheManager.instance) {
      ComicCacheManager.instance = new ComicCacheManager()
    }
    return ComicCacheManager.instance
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
      this.db = await openDB<ComicCacheDBSchema>(
        COMIC_CACHE_CONFIG.DB_NAME,
        COMIC_CACHE_CONFIG.DB_VERSION,
        {
          upgrade(db) {
            // Create episodes store
            if (!db.objectStoreNames.contains(COMIC_CACHE_CONFIG.STORE_NAME)) {
              const store = db.createObjectStore(COMIC_CACHE_CONFIG.STORE_NAME, {
                keyPath: 'episode.id',
              })
              store.createIndex('by-cached-at', 'cachedAt')
              store.createIndex('by-last-accessed', 'lastAccessedAt')
            }
          },
        }
      )
      console.log('[ComicCacheManager] Database initialized')
    } catch (error) {
      console.error('[ComicCacheManager] Failed to initialize database:', error)
      throw error
    }
  }

  /**
   * Get an episode from cache
   * Updates lastAccessedAt on retrieval
   */
  async get(episodeId: string): Promise<CachedComicEpisode | null> {
    try {
      await this.init()
      if (!this.db) return null

      const entry = await this.db.get(COMIC_CACHE_CONFIG.STORE_NAME, episodeId)

      if (!entry) {
        console.log('[ComicCacheManager] Cache miss:', episodeId)
        return null
      }

      // Check if expired
      const age = Date.now() - entry.cachedAt
      if (age > COMIC_CACHE_CONFIG.MAX_AGE_MS) {
        console.log('[ComicCacheManager] Cache expired:', episodeId)
        await this.delete(episodeId)
        return null
      }

      // Update access stats
      const updatedEntry: ComicCacheEntry = {
        ...entry,
        lastAccessedAt: Date.now(),
        accessCount: entry.accessCount + 1,
      }
      await this.db.put(COMIC_CACHE_CONFIG.STORE_NAME, updatedEntry)

      console.log('[ComicCacheManager] Cache hit:', episodeId)
      return entry.episode
    } catch (error) {
      console.error('[ComicCacheManager] Error getting episode:', error)
      return null
    }
  }

  /**
   * Cache an episode
   */
  async set(episode: CachedComicEpisode): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      const now = Date.now()
      const existingEntry = await this.db.get(COMIC_CACHE_CONFIG.STORE_NAME, episode.id)

      const entry: ComicCacheEntry = {
        episode,
        cachedAt: existingEntry?.cachedAt ?? now,
        lastAccessedAt: now,
        accessCount: (existingEntry?.accessCount ?? 0) + 1,
      }

      await this.db.put(COMIC_CACHE_CONFIG.STORE_NAME, entry)
      console.log('[ComicCacheManager] Cached episode:', episode.id)

      // Cleanup old entries if needed
      await this.cleanup()
    } catch (error) {
      console.error('[ComicCacheManager] Error caching episode:', error)
    }
  }

  /**
   * Delete an episode from cache
   */
  async delete(episodeId: string): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      await this.db.delete(COMIC_CACHE_CONFIG.STORE_NAME, episodeId)
      console.log('[ComicCacheManager] Deleted episode:', episodeId)
    } catch (error) {
      console.error('[ComicCacheManager] Error deleting episode:', error)
    }
  }

  /**
   * Clear all cached episodes
   */
  async clear(): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      await this.db.clear(COMIC_CACHE_CONFIG.STORE_NAME)
      console.log('[ComicCacheManager] Cache cleared')
    } catch (error) {
      console.error('[ComicCacheManager] Error clearing cache:', error)
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<ComicCacheStats> {
    try {
      await this.init()
      if (!this.db) {
        return { totalCached: 0, totalSizeEstimate: 0, oldestEntry: null, newestEntry: null }
      }

      const allEntries = await this.db.getAll(COMIC_CACHE_CONFIG.STORE_NAME)

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
      console.error('[ComicCacheManager] Error getting stats:', error)
      return { totalCached: 0, totalSizeEstimate: 0, oldestEntry: null, newestEntry: null }
    }
  }

  /**
   * Cleanup old/excess entries
   */
  private async cleanup(): Promise<void> {
    try {
      if (!this.db) return

      const allEntries = await this.db.getAll(COMIC_CACHE_CONFIG.STORE_NAME)

      // Remove expired entries
      const now = Date.now()
      const expiredIds: string[] = []
      for (const entry of allEntries) {
        if (now - entry.cachedAt > COMIC_CACHE_CONFIG.MAX_AGE_MS) {
          expiredIds.push(entry.episode.id)
        }
      }

      for (const id of expiredIds) {
        await this.db.delete(COMIC_CACHE_CONFIG.STORE_NAME, id)
      }

      if (expiredIds.length > 0) {
        console.log('[ComicCacheManager] Removed expired entries:', expiredIds.length)
      }

      // Check if we still have too many entries
      const remainingEntries = await this.db.getAll(COMIC_CACHE_CONFIG.STORE_NAME)

      if (remainingEntries.length > COMIC_CACHE_CONFIG.MAX_CACHED_EPISODES) {
        // Sort by lastAccessedAt (oldest first)
        remainingEntries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)

        // Remove oldest entries to get under the limit
        const toRemove = remainingEntries.length - COMIC_CACHE_CONFIG.MAX_CACHED_EPISODES
        const idsToRemove = remainingEntries.slice(0, toRemove).map(e => e.episode.id)

        for (const id of idsToRemove) {
          await this.db.delete(COMIC_CACHE_CONFIG.STORE_NAME, id)
        }

        console.log('[ComicCacheManager] Removed LRU entries:', toRemove)
      }
    } catch (error) {
      console.error('[ComicCacheManager] Error during cleanup:', error)
    }
  }

  /**
   * Check if an episode is cached
   */
  async has(episodeId: string): Promise<boolean> {
    try {
      await this.init()
      if (!this.db) return false

      const entry = await this.db.get(COMIC_CACHE_CONFIG.STORE_NAME, episodeId)
      if (!entry) return false

      // Check if expired
      const age = Date.now() - entry.cachedAt
      return age <= COMIC_CACHE_CONFIG.MAX_AGE_MS
    } catch (error) {
      console.error('[ComicCacheManager] Error checking cache:', error)
      return false
    }
  }

  /**
   * Get all cached episode IDs
   */
  async getCachedIds(): Promise<string[]> {
    try {
      await this.init()
      if (!this.db) return []

      const allEntries = await this.db.getAll(COMIC_CACHE_CONFIG.STORE_NAME)
      const now = Date.now()

      return allEntries
        .filter(entry => now - entry.cachedAt <= COMIC_CACHE_CONFIG.MAX_AGE_MS)
        .map(entry => entry.episode.id)
    } catch (error) {
      console.error('[ComicCacheManager] Error getting cached IDs:', error)
      return []
    }
  }

  /**
   * Prefetch episodes for offline use
   * Fetches and caches multiple episodes in the background
   */
  async prefetchEpisodes(
    episodeIds: string[],
    options: {
      skipCached?: boolean
      onProgress?: (current: number, total: number) => void
    } = {}
  ): Promise<{ cached: number; failed: number; skipped: number }> {
    const { skipCached = true, onProgress } = options
    const results = { cached: 0, failed: 0, skipped: 0 }

    console.log('[ComicCacheManager] Starting prefetch for', episodeIds.length, 'episodes')

    for (let i = 0; i < episodeIds.length; i++) {
      const episodeId = episodeIds[i]

      // Check if already cached
      if (skipCached) {
        const isCached = await this.has(episodeId)
        if (isCached) {
          console.log('[ComicCacheManager] Skipping already cached:', episodeId)
          results.skipped++
          onProgress?.(i + 1, episodeIds.length)
          continue
        }
      }

      try {
        // Fetch from API
        const response = await fetch(`/api/comics/episodes/${episodeId}`)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()

        if (!data.success || !data.episode) {
          throw new Error('Episode not found')
        }

        // Transform to CachedComicEpisode format
        const episode: CachedComicEpisode = {
          id: data.episode.id,
          seriesId: data.episode.seriesId,
          slug: data.episode.slug,
          episodeNumber: data.episode.episodeNumber,
          title: data.episode.title,
          titleJa: data.episode.titleJa,
          description: data.episode.description,
          descriptionJa: data.episode.descriptionJa,
          coverImageUrl: data.episode.coverImageUrl,
          jlptLevel: data.episode.jlptLevel,
          theme: data.episode.theme,
          location: data.episode.location,
          panels: data.episode.panels || [],
          vocabulary: data.episode.vocabulary || [],
          grammarPoints: data.episode.grammarPoints || [],
          culturalNotes: data.episode.culturalNotes || [],
          quiz: data.episode.quiz,
          metadata: data.episode.metadata,
          status: data.episode.status,
          publishedAt: data.episode.publishedAt,
          createdAt: data.episode.createdAt,
          updatedAt: data.episode.updatedAt,
          audioStatus: data.episode.audioStatus,
          audioProvider: data.episode.audioProvider,
          fullAudioUrl: data.episode.fullAudioUrl,
          viewCount: data.episode.viewCount,
          completionCount: data.episode.completionCount,
        }

        // Cache the episode
        await this.set(episode)
        results.cached++
        console.log('[ComicCacheManager] Prefetched:', episodeId)
      } catch (error) {
        console.warn('[ComicCacheManager] Failed to prefetch:', episodeId, error)
        results.failed++
      }

      onProgress?.(i + 1, episodeIds.length)

      // Small delay to avoid hammering the server
      if (i < episodeIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log('[ComicCacheManager] Prefetch complete:', results)
    return results
  }
}

// Export singleton getter
export const getComicCacheManager = () => ComicCacheManager.getInstance()
