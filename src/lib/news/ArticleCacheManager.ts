/**
 * Article Cache Manager
 * Handles automatic caching of news articles in IndexedDB for offline access
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'
import {
  CachedArticle,
  ArticleCacheEntry,
  ArticleCacheStats,
  ARTICLE_CACHE_CONFIG,
} from './article-cache.types'

interface ArticleCacheDBSchema extends DBSchema {
  articles: {
    key: string // article id
    value: ArticleCacheEntry
    indexes: {
      'by-cached-at': number
      'by-last-accessed': number
    }
  }
}

export class ArticleCacheManager {
  private static instance: ArticleCacheManager | null = null
  private db: IDBPDatabase<ArticleCacheDBSchema> | null = null
  private initPromise: Promise<void> | null = null

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ArticleCacheManager {
    if (!ArticleCacheManager.instance) {
      ArticleCacheManager.instance = new ArticleCacheManager()
    }
    return ArticleCacheManager.instance
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
      this.db = await openDB<ArticleCacheDBSchema>(
        ARTICLE_CACHE_CONFIG.DB_NAME,
        ARTICLE_CACHE_CONFIG.DB_VERSION,
        {
          upgrade(db) {
            // Create articles store
            if (!db.objectStoreNames.contains(ARTICLE_CACHE_CONFIG.STORE_NAME)) {
              const store = db.createObjectStore(ARTICLE_CACHE_CONFIG.STORE_NAME, {
                keyPath: 'article.id',
              })
              store.createIndex('by-cached-at', 'cachedAt')
              store.createIndex('by-last-accessed', 'lastAccessedAt')
            }
          },
        }
      )
      console.log('[ArticleCacheManager] Database initialized')
    } catch (error) {
      console.error('[ArticleCacheManager] Failed to initialize database:', error)
      throw error
    }
  }

  /**
   * Get an article from cache
   * Updates lastAccessedAt on retrieval
   */
  async get(articleId: string): Promise<CachedArticle | null> {
    try {
      await this.init()
      if (!this.db) return null

      const entry = await this.db.get(ARTICLE_CACHE_CONFIG.STORE_NAME, articleId)

      if (!entry) {
        console.log('[ArticleCacheManager] Cache miss:', articleId)
        return null
      }

      // Check if expired
      const age = Date.now() - entry.cachedAt
      if (age > ARTICLE_CACHE_CONFIG.MAX_AGE_MS) {
        console.log('[ArticleCacheManager] Cache expired:', articleId)
        await this.delete(articleId)
        return null
      }

      // Update access stats
      const updatedEntry: ArticleCacheEntry = {
        ...entry,
        lastAccessedAt: Date.now(),
        accessCount: entry.accessCount + 1,
      }
      await this.db.put(ARTICLE_CACHE_CONFIG.STORE_NAME, updatedEntry)

      console.log('[ArticleCacheManager] Cache hit:', articleId)
      return entry.article
    } catch (error) {
      console.error('[ArticleCacheManager] Error getting article:', error)
      return null
    }
  }

  /**
   * Cache an article
   */
  async set(article: CachedArticle): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      const now = Date.now()
      const existingEntry = await this.db.get(ARTICLE_CACHE_CONFIG.STORE_NAME, article.id)

      const entry: ArticleCacheEntry = {
        article,
        cachedAt: existingEntry?.cachedAt ?? now,
        lastAccessedAt: now,
        accessCount: (existingEntry?.accessCount ?? 0) + 1,
      }

      await this.db.put(ARTICLE_CACHE_CONFIG.STORE_NAME, entry)
      console.log('[ArticleCacheManager] Cached article:', article.id)

      // Cleanup old entries if needed
      await this.cleanup()
    } catch (error) {
      console.error('[ArticleCacheManager] Error caching article:', error)
    }
  }

  /**
   * Delete an article from cache
   */
  async delete(articleId: string): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      await this.db.delete(ARTICLE_CACHE_CONFIG.STORE_NAME, articleId)
      console.log('[ArticleCacheManager] Deleted article:', articleId)
    } catch (error) {
      console.error('[ArticleCacheManager] Error deleting article:', error)
    }
  }

  /**
   * Clear all cached articles
   */
  async clear(): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      await this.db.clear(ARTICLE_CACHE_CONFIG.STORE_NAME)
      console.log('[ArticleCacheManager] Cache cleared')
    } catch (error) {
      console.error('[ArticleCacheManager] Error clearing cache:', error)
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<ArticleCacheStats> {
    try {
      await this.init()
      if (!this.db) {
        return { totalCached: 0, totalSizeEstimate: 0, oldestEntry: null, newestEntry: null }
      }

      const allEntries = await this.db.getAll(ARTICLE_CACHE_CONFIG.STORE_NAME)

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
      console.error('[ArticleCacheManager] Error getting stats:', error)
      return { totalCached: 0, totalSizeEstimate: 0, oldestEntry: null, newestEntry: null }
    }
  }

  /**
   * Cleanup old/excess entries
   */
  private async cleanup(): Promise<void> {
    try {
      if (!this.db) return

      const allEntries = await this.db.getAll(ARTICLE_CACHE_CONFIG.STORE_NAME)

      // Remove expired entries
      const now = Date.now()
      const expiredIds: string[] = []
      for (const entry of allEntries) {
        if (now - entry.cachedAt > ARTICLE_CACHE_CONFIG.MAX_AGE_MS) {
          expiredIds.push(entry.article.id)
        }
      }

      for (const id of expiredIds) {
        await this.db.delete(ARTICLE_CACHE_CONFIG.STORE_NAME, id)
      }

      if (expiredIds.length > 0) {
        console.log('[ArticleCacheManager] Removed expired entries:', expiredIds.length)
      }

      // Check if we still have too many entries
      const remainingEntries = await this.db.getAll(ARTICLE_CACHE_CONFIG.STORE_NAME)

      if (remainingEntries.length > ARTICLE_CACHE_CONFIG.MAX_CACHED_ARTICLES) {
        // Sort by lastAccessedAt (oldest first)
        remainingEntries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)

        // Remove oldest entries to get under the limit
        const toRemove = remainingEntries.length - ARTICLE_CACHE_CONFIG.MAX_CACHED_ARTICLES
        const idsToRemove = remainingEntries.slice(0, toRemove).map(e => e.article.id)

        for (const id of idsToRemove) {
          await this.db.delete(ARTICLE_CACHE_CONFIG.STORE_NAME, id)
        }

        console.log('[ArticleCacheManager] Removed LRU entries:', toRemove)
      }
    } catch (error) {
      console.error('[ArticleCacheManager] Error during cleanup:', error)
    }
  }

  /**
   * Check if an article is cached
   */
  async has(articleId: string): Promise<boolean> {
    try {
      await this.init()
      if (!this.db) return false

      const entry = await this.db.get(ARTICLE_CACHE_CONFIG.STORE_NAME, articleId)
      if (!entry) return false

      // Check if expired
      const age = Date.now() - entry.cachedAt
      return age <= ARTICLE_CACHE_CONFIG.MAX_AGE_MS
    } catch (error) {
      console.error('[ArticleCacheManager] Error checking cache:', error)
      return false
    }
  }

  /**
   * Get all cached article IDs
   */
  async getCachedIds(): Promise<string[]> {
    try {
      await this.init()
      if (!this.db) return []

      const allEntries = await this.db.getAll(ARTICLE_CACHE_CONFIG.STORE_NAME)
      const now = Date.now()

      return allEntries
        .filter(entry => now - entry.cachedAt <= ARTICLE_CACHE_CONFIG.MAX_AGE_MS)
        .map(entry => entry.article.id)
    } catch (error) {
      console.error('[ArticleCacheManager] Error getting cached IDs:', error)
      return []
    }
  }
}

// Export singleton getter
export const getArticleCacheManager = () => ArticleCacheManager.getInstance()
