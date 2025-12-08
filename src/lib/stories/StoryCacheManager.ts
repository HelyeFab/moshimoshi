/**
 * Story Cache Manager
 * Handles automatic caching of AI stories in IndexedDB for offline access
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'
import {
  CachedStory,
  StoryCacheEntry,
  StoryCacheStats,
  STORY_CACHE_CONFIG,
} from './story-cache.types'
import type { Story } from '@/types/story'

interface StoryCacheDBSchema extends DBSchema {
  stories: {
    key: string // story id
    value: StoryCacheEntry
    indexes: {
      'by-cached-at': number
      'by-last-accessed': number
      'by-slug': string
    }
  }
}

export class StoryCacheManager {
  private static instance: StoryCacheManager | null = null
  private db: IDBPDatabase<StoryCacheDBSchema> | null = null
  private initPromise: Promise<void> | null = null

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): StoryCacheManager {
    if (!StoryCacheManager.instance) {
      StoryCacheManager.instance = new StoryCacheManager()
    }
    return StoryCacheManager.instance
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
      this.db = await openDB<StoryCacheDBSchema>(
        STORY_CACHE_CONFIG.DB_NAME,
        STORY_CACHE_CONFIG.DB_VERSION,
        {
          upgrade(db) {
            // Create stories store
            if (!db.objectStoreNames.contains(STORY_CACHE_CONFIG.STORE_NAME)) {
              const store = db.createObjectStore(STORY_CACHE_CONFIG.STORE_NAME, {
                keyPath: 'story.id',
              })
              store.createIndex('by-cached-at', 'cachedAt')
              store.createIndex('by-last-accessed', 'lastAccessedAt')
              store.createIndex('by-slug', 'story.slug')
            }
          },
        }
      )
      console.log('[StoryCacheManager] Database initialized')
    } catch (error) {
      console.error('[StoryCacheManager] Failed to initialize database:', error)
      throw error
    }
  }

  /**
   * Convert Story to CachedStory (handles Date -> string conversion)
   */
  private toCachedStory(story: Story): CachedStory {
    return {
      id: story.id,
      title: story.title,
      titleJa: story.titleJa,
      description: story.description,
      jlptLevel: story.jlptLevel,
      theme: story.theme,
      tags: story.tags,
      coverImageUrl: story.coverImageUrl,
      pages: story.pages,
      quiz: story.quiz,
      slug: story.slug,
      authorId: story.authorId,
      createdAt:
        story.createdAt instanceof Date ? story.createdAt.toISOString() : String(story.createdAt),
      updatedAt:
        story.updatedAt instanceof Date ? story.updatedAt.toISOString() : String(story.updatedAt),
      publishedAt:
        story.publishedAt instanceof Date
          ? story.publishedAt.toISOString()
          : story.publishedAt
            ? String(story.publishedAt)
            : undefined,
      status: story.status,
      viewCount: story.viewCount,
      completionCount: story.completionCount,
      averageQuizScore: story.averageQuizScore,
      seoTitle: story.seoTitle,
      seoDescription: story.seoDescription,
      moodBoardId: story.moodBoardId,
      moodBoardTitle: story.moodBoardTitle,
      moodBoardKanji: story.moodBoardKanji,
      isAIGenerated: story.isAIGenerated,
      aiModel: story.aiModel,
      fullAudioUrl: story.fullAudioUrl,
      audioGeneratedAt:
        story.audioGeneratedAt instanceof Date
          ? story.audioGeneratedAt.toISOString()
          : story.audioGeneratedAt
            ? String(story.audioGeneratedAt)
            : undefined,
      audioProvider: story.audioProvider,
      audioVoice: story.audioVoice,
      audioStatus: story.audioStatus,
    }
  }

  /**
   * Get a story from cache by ID
   * Updates lastAccessedAt on retrieval
   */
  async get(storyId: string): Promise<CachedStory | null> {
    try {
      await this.init()
      if (!this.db) return null

      const entry = await this.db.get(STORY_CACHE_CONFIG.STORE_NAME, storyId)

      if (!entry) {
        console.log('[StoryCacheManager] Cache miss:', storyId)
        return null
      }

      // Check if expired
      const age = Date.now() - entry.cachedAt
      if (age > STORY_CACHE_CONFIG.MAX_AGE_MS) {
        console.log('[StoryCacheManager] Cache expired:', storyId)
        await this.delete(storyId)
        return null
      }

      // Update access stats
      const updatedEntry: StoryCacheEntry = {
        ...entry,
        lastAccessedAt: Date.now(),
        accessCount: entry.accessCount + 1,
      }
      await this.db.put(STORY_CACHE_CONFIG.STORE_NAME, updatedEntry)

      console.log('[StoryCacheManager] Cache hit:', storyId)
      return entry.story
    } catch (error) {
      console.error('[StoryCacheManager] Error getting story:', error)
      return null
    }
  }

  /**
   * Get a story from cache by slug
   */
  async getBySlug(slug: string): Promise<CachedStory | null> {
    try {
      await this.init()
      if (!this.db) return null

      const allEntries = await this.db.getAll(STORY_CACHE_CONFIG.STORE_NAME)
      const entry = allEntries.find(e => e.story.slug === slug)

      if (!entry) {
        console.log('[StoryCacheManager] Cache miss for slug:', slug)
        return null
      }

      // Check if expired
      const age = Date.now() - entry.cachedAt
      if (age > STORY_CACHE_CONFIG.MAX_AGE_MS) {
        console.log('[StoryCacheManager] Cache expired for slug:', slug)
        await this.delete(entry.story.id)
        return null
      }

      // Update access stats
      const updatedEntry: StoryCacheEntry = {
        ...entry,
        lastAccessedAt: Date.now(),
        accessCount: entry.accessCount + 1,
      }
      await this.db.put(STORY_CACHE_CONFIG.STORE_NAME, updatedEntry)

      console.log('[StoryCacheManager] Cache hit for slug:', slug)
      return entry.story
    } catch (error) {
      console.error('[StoryCacheManager] Error getting story by slug:', error)
      return null
    }
  }

  /**
   * Cache a story
   */
  async set(story: Story | CachedStory): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      const cachedStory =
        'pages' in story && story.createdAt instanceof Date
          ? this.toCachedStory(story as Story)
          : (story as CachedStory)

      const now = Date.now()
      const existingEntry = await this.db.get(STORY_CACHE_CONFIG.STORE_NAME, cachedStory.id)

      const entry: StoryCacheEntry = {
        story: cachedStory,
        cachedAt: existingEntry?.cachedAt ?? now,
        lastAccessedAt: now,
        accessCount: (existingEntry?.accessCount ?? 0) + 1,
      }

      await this.db.put(STORY_CACHE_CONFIG.STORE_NAME, entry)
      console.log('[StoryCacheManager] Cached story:', cachedStory.id)

      // Cleanup old entries if needed
      await this.cleanup()
    } catch (error) {
      console.error('[StoryCacheManager] Error caching story:', error)
    }
  }

  /**
   * Delete a story from cache
   */
  async delete(storyId: string): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      await this.db.delete(STORY_CACHE_CONFIG.STORE_NAME, storyId)
      console.log('[StoryCacheManager] Deleted story:', storyId)
    } catch (error) {
      console.error('[StoryCacheManager] Error deleting story:', error)
    }
  }

  /**
   * Clear all cached stories
   */
  async clear(): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      await this.db.clear(STORY_CACHE_CONFIG.STORE_NAME)
      console.log('[StoryCacheManager] Cache cleared')
    } catch (error) {
      console.error('[StoryCacheManager] Error clearing cache:', error)
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<StoryCacheStats> {
    try {
      await this.init()
      if (!this.db) {
        return { totalCached: 0, totalSizeEstimate: 0, oldestEntry: null, newestEntry: null }
      }

      const allEntries = await this.db.getAll(STORY_CACHE_CONFIG.STORE_NAME)

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
      console.error('[StoryCacheManager] Error getting stats:', error)
      return { totalCached: 0, totalSizeEstimate: 0, oldestEntry: null, newestEntry: null }
    }
  }

  /**
   * Cleanup old/excess entries
   */
  private async cleanup(): Promise<void> {
    try {
      if (!this.db) return

      const allEntries = await this.db.getAll(STORY_CACHE_CONFIG.STORE_NAME)

      // Remove expired entries
      const now = Date.now()
      const expiredIds: string[] = []
      for (const entry of allEntries) {
        if (now - entry.cachedAt > STORY_CACHE_CONFIG.MAX_AGE_MS) {
          expiredIds.push(entry.story.id)
        }
      }

      for (const id of expiredIds) {
        await this.db.delete(STORY_CACHE_CONFIG.STORE_NAME, id)
      }

      if (expiredIds.length > 0) {
        console.log('[StoryCacheManager] Removed expired entries:', expiredIds.length)
      }

      // Check if we still have too many entries
      const remainingEntries = await this.db.getAll(STORY_CACHE_CONFIG.STORE_NAME)

      if (remainingEntries.length > STORY_CACHE_CONFIG.MAX_CACHED_STORIES) {
        // Sort by lastAccessedAt (oldest first)
        remainingEntries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)

        // Remove oldest entries to get under the limit
        const toRemove = remainingEntries.length - STORY_CACHE_CONFIG.MAX_CACHED_STORIES
        const idsToRemove = remainingEntries.slice(0, toRemove).map(e => e.story.id)

        for (const id of idsToRemove) {
          await this.db.delete(STORY_CACHE_CONFIG.STORE_NAME, id)
        }

        console.log('[StoryCacheManager] Removed LRU entries:', toRemove)
      }
    } catch (error) {
      console.error('[StoryCacheManager] Error during cleanup:', error)
    }
  }

  /**
   * Check if a story is cached
   */
  async has(storyId: string): Promise<boolean> {
    try {
      await this.init()
      if (!this.db) return false

      const entry = await this.db.get(STORY_CACHE_CONFIG.STORE_NAME, storyId)
      if (!entry) return false

      // Check if expired
      const age = Date.now() - entry.cachedAt
      return age <= STORY_CACHE_CONFIG.MAX_AGE_MS
    } catch (error) {
      console.error('[StoryCacheManager] Error checking cache:', error)
      return false
    }
  }

  /**
   * Get all cached story IDs
   */
  async getCachedIds(): Promise<string[]> {
    try {
      await this.init()
      if (!this.db) return []

      const allEntries = await this.db.getAll(STORY_CACHE_CONFIG.STORE_NAME)
      const now = Date.now()

      return allEntries
        .filter(entry => now - entry.cachedAt <= STORY_CACHE_CONFIG.MAX_AGE_MS)
        .map(entry => entry.story.id)
    } catch (error) {
      console.error('[StoryCacheManager] Error getting cached IDs:', error)
      return []
    }
  }

  /**
   * Prefetch stories for offline use
   * Caches stories that are already loaded (from Firestore)
   * This is different from articles/books because stories come from Firebase, not an API
   */
  async prefetchStories(
    stories: Story[],
    options: {
      skipCached?: boolean
      onProgress?: (current: number, total: number) => void
    } = {}
  ): Promise<{ cached: number; failed: number; skipped: number }> {
    const { skipCached = true, onProgress } = options
    const results = { cached: 0, failed: 0, skipped: 0 }

    console.log('[StoryCacheManager] Starting prefetch for', stories.length, 'stories')

    for (let i = 0; i < stories.length; i++) {
      const story = stories[i]

      // Check if already cached
      if (skipCached) {
        const isCached = await this.has(story.id)
        if (isCached) {
          console.log('[StoryCacheManager] Skipping already cached:', story.id)
          results.skipped++
          onProgress?.(i + 1, stories.length)
          continue
        }
      }

      try {
        // Cache the story directly (already have the data from Firestore)
        await this.set(story)
        results.cached++
        console.log('[StoryCacheManager] Prefetched:', story.id)
      } catch (error) {
        console.warn('[StoryCacheManager] Failed to prefetch:', story.id, error)
        results.failed++
      }

      onProgress?.(i + 1, stories.length)
    }

    console.log('[StoryCacheManager] Prefetch complete:', results)
    return results
  }
}

// Export singleton getter
export const getStoryCacheManager = () => StoryCacheManager.getInstance()
