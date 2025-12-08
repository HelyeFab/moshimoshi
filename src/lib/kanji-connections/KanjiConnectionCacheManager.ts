/**
 * Kanji Connection Cache Manager
 * Handles caching of kanji connection queries (families, radicals, SKIP) in IndexedDB
 * Supports prefetching ALL combinations for complete offline access
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'
import {
  CachedConnectionResponse,
  ConnectionCacheEntry,
  ConnectionCacheStats,
  ConnectionType,
  CONNECTION_CACHE_CONFIG,
  ALL_FAMILY_IDS,
  ALL_RADICAL_IDS,
  ALL_SKIP_PATTERNS,
} from './kanji-connection-cache.types'

interface ConnectionCacheDBSchema extends DBSchema {
  connections: {
    key: string // cacheKey
    value: ConnectionCacheEntry
    indexes: {
      'by-cached-at': number
      'by-last-accessed': number
      'by-type': ConnectionType
    }
  }
}

export class KanjiConnectionCacheManager {
  private static instance: KanjiConnectionCacheManager | null = null
  private db: IDBPDatabase<ConnectionCacheDBSchema> | null = null
  private initPromise: Promise<void> | null = null

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): KanjiConnectionCacheManager {
    if (!KanjiConnectionCacheManager.instance) {
      KanjiConnectionCacheManager.instance = new KanjiConnectionCacheManager()
    }
    return KanjiConnectionCacheManager.instance
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
      this.db = await openDB<ConnectionCacheDBSchema>(
        CONNECTION_CACHE_CONFIG.DB_NAME,
        CONNECTION_CACHE_CONFIG.DB_VERSION,
        {
          upgrade(db) {
            if (!db.objectStoreNames.contains(CONNECTION_CACHE_CONFIG.STORE_NAME)) {
              const store = db.createObjectStore(CONNECTION_CACHE_CONFIG.STORE_NAME, {
                keyPath: 'response.cacheKey',
              })
              store.createIndex('by-cached-at', 'cachedAt')
              store.createIndex('by-last-accessed', 'lastAccessedAt')
              store.createIndex('by-type', 'response.type')
            }
          },
        }
      )
      console.log('[KanjiConnectionCacheManager] Database initialized')
    } catch (error) {
      console.error('[KanjiConnectionCacheManager] Failed to initialize database:', error)
      throw error
    }
  }

  /**
   * Generate cache key for a connection query
   */
  private getCacheKey(type: ConnectionType, id: string, queryParams?: Record<string, any>): string {
    const baseKey = `${type}:${id}`
    if (!queryParams || Object.keys(queryParams).length === 0) {
      return baseKey
    }
    // Include relevant query params in key
    const paramStr = Object.entries(queryParams)
      .filter(([_, v]) => v !== undefined && v !== false)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&')
    return paramStr ? `${baseKey}?${paramStr}` : baseKey
  }

  /**
   * Get a cached connection response
   */
  async get(
    type: ConnectionType,
    id: string,
    queryParams?: Record<string, any>
  ): Promise<any | null> {
    try {
      await this.init()
      if (!this.db) return null

      const cacheKey = this.getCacheKey(type, id, queryParams)
      const entry = await this.db.get(CONNECTION_CACHE_CONFIG.STORE_NAME, cacheKey)

      if (!entry) {
        console.log('[KanjiConnectionCacheManager] Cache miss:', cacheKey)
        return null
      }

      // Check if expired
      const age = Date.now() - entry.cachedAt
      if (age > CONNECTION_CACHE_CONFIG.MAX_AGE_MS) {
        console.log('[KanjiConnectionCacheManager] Cache expired:', cacheKey)
        await this.delete(cacheKey)
        return null
      }

      // Update access stats
      const updatedEntry: ConnectionCacheEntry = {
        ...entry,
        lastAccessedAt: Date.now(),
        accessCount: entry.accessCount + 1,
      }
      await this.db.put(CONNECTION_CACHE_CONFIG.STORE_NAME, updatedEntry)

      console.log('[KanjiConnectionCacheManager] Cache hit:', cacheKey)
      return entry.response.data
    } catch (error) {
      console.error('[KanjiConnectionCacheManager] Error getting cached data:', error)
      return null
    }
  }

  /**
   * Cache a connection response
   */
  async set(
    type: ConnectionType,
    id: string,
    data: any,
    queryParams?: Record<string, any>
  ): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      const cacheKey = this.getCacheKey(type, id, queryParams)
      const now = Date.now()

      const existingEntry = await this.db.get(CONNECTION_CACHE_CONFIG.STORE_NAME, cacheKey)

      const response: CachedConnectionResponse = {
        cacheKey,
        type,
        id,
        data,
        queryParams: queryParams || {},
      }

      const entry: ConnectionCacheEntry = {
        response,
        cachedAt: existingEntry?.cachedAt ?? now,
        lastAccessedAt: now,
        accessCount: (existingEntry?.accessCount ?? 0) + 1,
      }

      await this.db.put(CONNECTION_CACHE_CONFIG.STORE_NAME, entry)
      console.log('[KanjiConnectionCacheManager] Cached:', cacheKey)

      // Cleanup if needed
      await this.cleanup()
    } catch (error) {
      console.error('[KanjiConnectionCacheManager] Error caching data:', error)
    }
  }

  /**
   * Delete a cached entry
   */
  async delete(cacheKey: string): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      await this.db.delete(CONNECTION_CACHE_CONFIG.STORE_NAME, cacheKey)
      console.log('[KanjiConnectionCacheManager] Deleted:', cacheKey)
    } catch (error) {
      console.error('[KanjiConnectionCacheManager] Error deleting:', error)
    }
  }

  /**
   * Clear all cached connections
   */
  async clear(): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      await this.db.clear(CONNECTION_CACHE_CONFIG.STORE_NAME)
      console.log('[KanjiConnectionCacheManager] Cache cleared')
    } catch (error) {
      console.error('[KanjiConnectionCacheManager] Error clearing cache:', error)
    }
  }

  /**
   * Check if a connection is cached
   */
  async has(type: ConnectionType, id: string, queryParams?: Record<string, any>): Promise<boolean> {
    try {
      await this.init()
      if (!this.db) return false

      const cacheKey = this.getCacheKey(type, id, queryParams)
      const entry = await this.db.get(CONNECTION_CACHE_CONFIG.STORE_NAME, cacheKey)
      if (!entry) return false

      const age = Date.now() - entry.cachedAt
      return age <= CONNECTION_CACHE_CONFIG.MAX_AGE_MS
    } catch (error) {
      console.error('[KanjiConnectionCacheManager] Error checking cache:', error)
      return false
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<ConnectionCacheStats> {
    try {
      await this.init()
      if (!this.db) {
        return {
          totalCached: 0,
          totalSizeEstimate: 0,
          oldestEntry: null,
          newestEntry: null,
          byType: { family: 0, radical: 0, skip: 0 },
        }
      }

      const allEntries = await this.db.getAll(CONNECTION_CACHE_CONFIG.STORE_NAME)

      if (allEntries.length === 0) {
        return {
          totalCached: 0,
          totalSizeEstimate: 0,
          oldestEntry: null,
          newestEntry: null,
          byType: { family: 0, radical: 0, skip: 0 },
        }
      }

      let oldestEntry = allEntries[0].cachedAt
      let newestEntry = allEntries[0].cachedAt
      let totalSizeEstimate = 0
      const byType = { family: 0, radical: 0, skip: 0 }

      for (const entry of allEntries) {
        if (entry.cachedAt < oldestEntry) oldestEntry = entry.cachedAt
        if (entry.cachedAt > newestEntry) newestEntry = entry.cachedAt
        totalSizeEstimate += JSON.stringify(entry).length * 2
        byType[entry.response.type]++
      }

      return {
        totalCached: allEntries.length,
        totalSizeEstimate,
        oldestEntry,
        newestEntry,
        byType,
      }
    } catch (error) {
      console.error('[KanjiConnectionCacheManager] Error getting stats:', error)
      return {
        totalCached: 0,
        totalSizeEstimate: 0,
        oldestEntry: null,
        newestEntry: null,
        byType: { family: 0, radical: 0, skip: 0 },
      }
    }
  }

  /**
   * Cleanup old/excess entries
   */
  private async cleanup(): Promise<void> {
    try {
      if (!this.db) return

      const allEntries = await this.db.getAll(CONNECTION_CACHE_CONFIG.STORE_NAME)
      const now = Date.now()

      // Remove expired entries
      const expiredKeys: string[] = []
      for (const entry of allEntries) {
        if (now - entry.cachedAt > CONNECTION_CACHE_CONFIG.MAX_AGE_MS) {
          expiredKeys.push(entry.response.cacheKey)
        }
      }

      for (const key of expiredKeys) {
        await this.db.delete(CONNECTION_CACHE_CONFIG.STORE_NAME, key)
      }

      if (expiredKeys.length > 0) {
        console.log('[KanjiConnectionCacheManager] Removed expired entries:', expiredKeys.length)
      }

      // Check if we still have too many entries
      const remainingEntries = await this.db.getAll(CONNECTION_CACHE_CONFIG.STORE_NAME)

      if (remainingEntries.length > CONNECTION_CACHE_CONFIG.MAX_CACHED_ENTRIES) {
        remainingEntries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)
        const toRemove = remainingEntries.length - CONNECTION_CACHE_CONFIG.MAX_CACHED_ENTRIES
        const keysToRemove = remainingEntries.slice(0, toRemove).map(e => e.response.cacheKey)

        for (const key of keysToRemove) {
          await this.db.delete(CONNECTION_CACHE_CONFIG.STORE_NAME, key)
        }

        console.log('[KanjiConnectionCacheManager] Removed LRU entries:', toRemove)
      }
    } catch (error) {
      console.error('[KanjiConnectionCacheManager] Error during cleanup:', error)
    }
  }

  /**
   * Prefetch ALL kanji connections for complete offline access
   * This is the "twist" - fetches everything upfront since total size is small (~300KB)
   */
  async prefetchAll(
    options: {
      skipCached?: boolean
      onProgress?: (current: number, total: number, type: string) => void
    } = {}
  ): Promise<{ cached: number; failed: number; skipped: number }> {
    const { skipCached = true, onProgress } = options
    const results = { cached: 0, failed: 0, skipped: 0 }

    // Calculate total items to prefetch
    const totalItems = ALL_FAMILY_IDS.length + ALL_RADICAL_IDS.length + ALL_SKIP_PATTERNS.length
    let currentItem = 0

    console.log('[KanjiConnectionCacheManager] Starting prefetch for ALL connections:', totalItems)

    // Prefetch all families
    for (const familyId of ALL_FAMILY_IDS) {
      currentItem++
      const queryParams = { details: true, crossFamilies: true }

      if (skipCached) {
        const isCached = await this.has('family', familyId, queryParams)
        if (isCached) {
          results.skipped++
          onProgress?.(currentItem, totalItems, `family:${familyId}`)
          continue
        }
      }

      try {
        const response = await fetch(
          `/api/kanji/by-family?family=${familyId}&details=true&crossFamilies=true`
        )
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        await this.set('family', familyId, data, queryParams)
        results.cached++
      } catch (error) {
        console.warn('[KanjiConnectionCacheManager] Failed to prefetch family:', familyId, error)
        results.failed++
      }

      onProgress?.(currentItem, totalItems, `family:${familyId}`)
    }

    // Prefetch all radicals
    for (const radicalId of ALL_RADICAL_IDS) {
      currentItem++
      const queryParams = { subThemes: true }

      if (skipCached) {
        const isCached = await this.has('radical', radicalId, queryParams)
        if (isCached) {
          results.skipped++
          onProgress?.(currentItem, totalItems, `radical:${radicalId}`)
          continue
        }
      }

      try {
        const response = await fetch(`/api/kanji/by-radical?radical=${radicalId}&subThemes=true`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        await this.set('radical', radicalId, data, queryParams)
        results.cached++
      } catch (error) {
        console.warn('[KanjiConnectionCacheManager] Failed to prefetch radical:', radicalId, error)
        results.failed++
      }

      onProgress?.(currentItem, totalItems, `radical:${radicalId}`)
    }

    // Prefetch all SKIP patterns
    for (const pattern of ALL_SKIP_PATTERNS) {
      currentItem++
      const queryParams = { subcategories: true }

      if (skipCached) {
        const isCached = await this.has('skip', pattern, queryParams)
        if (isCached) {
          results.skipped++
          onProgress?.(currentItem, totalItems, `skip:${pattern}`)
          continue
        }
      }

      try {
        const response = await fetch(`/api/kanji/by-skip?pattern=${pattern}&subcategories=true`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        await this.set('skip', pattern, data, queryParams)
        results.cached++
      } catch (error) {
        console.warn('[KanjiConnectionCacheManager] Failed to prefetch SKIP:', pattern, error)
        results.failed++
      }

      onProgress?.(currentItem, totalItems, `skip:${pattern}`)
    }

    console.log('[KanjiConnectionCacheManager] Prefetch complete:', results)
    return results
  }
}

// Export singleton getter
export const getKanjiConnectionCacheManager = () => KanjiConnectionCacheManager.getInstance()
