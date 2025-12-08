/**
 * useStoryCache Hook
 * Provides cache-first story fetching with automatic IndexedDB caching
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { getStoryCacheManager } from '@/lib/stories/StoryCacheManager'
import type { CachedStory, StoryCacheStats } from '@/lib/stories/story-cache.types'
import type { Story } from '@/types/story'

interface UseStoryCacheOptions {
  /** Whether to enable caching (default: true) */
  enabled?: boolean
}

interface UseStoryCacheReturn {
  /** Get story from cache by ID */
  getStory: (storyId: string) => Promise<CachedStory | null>
  /** Get story from cache by slug */
  getStoryBySlug: (slug: string) => Promise<CachedStory | null>
  /** Cache a story */
  cacheStory: (story: Story) => Promise<void>
  /** Check if story is cached */
  isCached: (storyId: string) => Promise<boolean>
  /** Get cache statistics */
  getStats: () => Promise<StoryCacheStats>
  /** Clear the cache */
  clearCache: () => Promise<void>
  /** Get list of cached story IDs */
  getCachedIds: () => Promise<string[]>
  /** Prefetch multiple stories for offline use */
  prefetchStories: (
    stories: Story[],
    options?: {
      skipCached?: boolean
      onProgress?: (current: number, total: number) => void
    }
  ) => Promise<{ cached: number; failed: number; skipped: number }>
}

export function useStoryCache(options: UseStoryCacheOptions = {}): UseStoryCacheReturn {
  const { enabled = true } = options
  const cacheManager = getStoryCacheManager()

  /**
   * Get story from cache by ID
   */
  const getStory = useCallback(
    async (storyId: string): Promise<CachedStory | null> => {
      if (!enabled) return null
      try {
        return await cacheManager.get(storyId)
      } catch (error) {
        console.error('[useStoryCache] Error getting story:', error)
        return null
      }
    },
    [enabled, cacheManager]
  )

  /**
   * Get story from cache by slug
   */
  const getStoryBySlug = useCallback(
    async (slug: string): Promise<CachedStory | null> => {
      if (!enabled) return null
      try {
        return await cacheManager.getBySlug(slug)
      } catch (error) {
        console.error('[useStoryCache] Error getting story by slug:', error)
        return null
      }
    },
    [enabled, cacheManager]
  )

  /**
   * Cache a story
   */
  const cacheStory = useCallback(
    async (story: Story): Promise<void> => {
      if (!enabled) return
      try {
        await cacheManager.set(story)
      } catch (error) {
        console.error('[useStoryCache] Error caching story:', error)
      }
    },
    [enabled, cacheManager]
  )

  /**
   * Check if a story is cached
   */
  const isCached = useCallback(
    async (storyId: string): Promise<boolean> => {
      if (!enabled) return false
      return cacheManager.has(storyId)
    },
    [enabled, cacheManager]
  )

  /**
   * Get cache statistics
   */
  const getStats = useCallback(async (): Promise<StoryCacheStats> => {
    return cacheManager.getStats()
  }, [cacheManager])

  /**
   * Clear all cached stories
   */
  const clearCache = useCallback(async (): Promise<void> => {
    await cacheManager.clear()
  }, [cacheManager])

  /**
   * Get list of cached story IDs
   */
  const getCachedIds = useCallback(async (): Promise<string[]> => {
    return cacheManager.getCachedIds()
  }, [cacheManager])

  /**
   * Prefetch multiple stories for offline use
   * Since stories come from Firebase (not an API), we pass the Story objects directly
   */
  const prefetchStories = useCallback(
    async (
      stories: Story[],
      options?: {
        skipCached?: boolean
        onProgress?: (current: number, total: number) => void
      }
    ): Promise<{ cached: number; failed: number; skipped: number }> => {
      if (!enabled) {
        return { cached: 0, failed: 0, skipped: stories.length }
      }
      return cacheManager.prefetchStories(stories, options)
    },
    [enabled, cacheManager]
  )

  return {
    getStory,
    getStoryBySlug,
    cacheStory,
    isCached,
    getStats,
    clearCache,
    getCachedIds,
    prefetchStories,
  }
}

/**
 * Hook for fetching a single story with cache-first strategy
 * Tries cache first, then falls back to the provided fetchFn
 */
export function useCachedStory(
  storyId: string | null,
  fetchFn: () => Promise<Story | null>,
  options: UseStoryCacheOptions = {}
) {
  const { getStory, cacheStory } = useStoryCache(options)
  const [story, setStory] = useState<CachedStory | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    if (!storyId) {
      setStory(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    const loadStory = async () => {
      setLoading(true)
      setError(null)

      // Try cache first
      try {
        const cached = await getStory(storyId)
        if (cached && !cancelled) {
          console.log('[useCachedStory] Serving from cache:', storyId)
          setStory(cached)
          setFromCache(true)
          setLoading(false)
          return
        }
      } catch (cacheError) {
        console.warn('[useCachedStory] Cache read failed:', cacheError)
      }

      // Fetch from Firebase
      try {
        const fetchedStory = await fetchFn()
        if (cancelled) return

        if (fetchedStory) {
          // Cache for offline use
          await cacheStory(fetchedStory)

          // Convert to cached format for consistent return type
          const cachedFormat: CachedStory = {
            id: fetchedStory.id,
            title: fetchedStory.title,
            titleJa: fetchedStory.titleJa,
            description: fetchedStory.description,
            jlptLevel: fetchedStory.jlptLevel,
            theme: fetchedStory.theme,
            tags: fetchedStory.tags,
            coverImageUrl: fetchedStory.coverImageUrl,
            pages: fetchedStory.pages,
            quiz: fetchedStory.quiz,
            slug: fetchedStory.slug,
            authorId: fetchedStory.authorId,
            createdAt:
              fetchedStory.createdAt instanceof Date
                ? fetchedStory.createdAt.toISOString()
                : String(fetchedStory.createdAt),
            updatedAt:
              fetchedStory.updatedAt instanceof Date
                ? fetchedStory.updatedAt.toISOString()
                : String(fetchedStory.updatedAt),
            publishedAt:
              fetchedStory.publishedAt instanceof Date
                ? fetchedStory.publishedAt.toISOString()
                : fetchedStory.publishedAt
                  ? String(fetchedStory.publishedAt)
                  : undefined,
            status: fetchedStory.status,
            viewCount: fetchedStory.viewCount,
            completionCount: fetchedStory.completionCount,
            averageQuizScore: fetchedStory.averageQuizScore,
            seoTitle: fetchedStory.seoTitle,
            seoDescription: fetchedStory.seoDescription,
            moodBoardId: fetchedStory.moodBoardId,
            moodBoardTitle: fetchedStory.moodBoardTitle,
            moodBoardKanji: fetchedStory.moodBoardKanji,
            isAIGenerated: fetchedStory.isAIGenerated,
            aiModel: fetchedStory.aiModel,
            fullAudioUrl: fetchedStory.fullAudioUrl,
            audioGeneratedAt:
              fetchedStory.audioGeneratedAt instanceof Date
                ? fetchedStory.audioGeneratedAt.toISOString()
                : fetchedStory.audioGeneratedAt
                  ? String(fetchedStory.audioGeneratedAt)
                  : undefined,
            audioProvider: fetchedStory.audioProvider,
            audioVoice: fetchedStory.audioVoice,
            audioStatus: fetchedStory.audioStatus,
          }

          setStory(cachedFormat)
          setFromCache(false)
        } else {
          setError('Story not found')
        }
      } catch (fetchError) {
        if (cancelled) return
        const errorMessage =
          fetchError instanceof Error ? fetchError.message : 'Failed to fetch story'
        console.error('[useCachedStory] Fetch failed:', errorMessage)

        // Try cache again as last resort
        try {
          const cached = await getStory(storyId)
          if (cached) {
            console.log('[useCachedStory] Serving stale cache due to network error:', storyId)
            setStory(cached)
            setFromCache(true)
            setLoading(false)
            return
          }
        } catch {
          // Cache also failed
        }

        setError(errorMessage)
      }

      setLoading(false)
    }

    loadStory()

    return () => {
      cancelled = true
    }
  }, [storyId, fetchFn, getStory, cacheStory])

  return { story, loading, error, fromCache }
}

export default useStoryCache
