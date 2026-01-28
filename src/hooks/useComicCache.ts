/**
 * useComicCache Hook
 * Provides cache-first episode fetching with automatic IndexedDB caching
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { getComicCacheManager } from '@/lib/comics/ComicCacheManager'
import type { CachedComicEpisode, ComicCacheStats } from '@/lib/comics/comic-cache.types'

interface UseComicCacheOptions {
  /** Whether to enable caching (default: true) */
  enabled?: boolean
}

interface UseComicCacheReturn {
  /** Fetch episode with cache-first strategy */
  getEpisode: (episodeId: string) => Promise<{
    episode: CachedComicEpisode | null
    fromCache: boolean
    error: string | null
  }>
  /** Check if episode is cached */
  isCached: (episodeId: string) => Promise<boolean>
  /** Get cache statistics */
  getStats: () => Promise<ComicCacheStats>
  /** Clear the cache */
  clearCache: () => Promise<void>
  /** Get list of cached episode IDs */
  getCachedIds: () => Promise<string[]>
  /** Prefetch multiple episodes for offline use */
  prefetchEpisodes: (
    episodeIds: string[],
    options?: {
      skipCached?: boolean
      onProgress?: (current: number, total: number) => void
    }
  ) => Promise<{ cached: number; failed: number; skipped: number }>
}

export function useComicCache(options: UseComicCacheOptions = {}): UseComicCacheReturn {
  const { enabled = true } = options
  const cacheManager = getComicCacheManager()

  /**
   * Fetch episode with cache-first strategy
   */
  const getEpisode = useCallback(
    async (
      episodeId: string
    ): Promise<{
      episode: CachedComicEpisode | null
      fromCache: boolean
      error: string | null
    }> => {
      // Try cache first if enabled
      if (enabled) {
        try {
          const cached = await cacheManager.get(episodeId)
          if (cached) {
            console.log('[useComicCache] Serving from cache:', episodeId)

            // Track view in background (lightweight, doesn't refetch episode data)
            // Don't await - let it run in background
            fetch('/api/track-view', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contentType: 'comics',
                contentId: episodeId
              })
            })
              .then(response => {
                if (response.ok) {
                  console.log('[useComicCache] View tracked')
                }
              })
              .catch(err => {
                console.warn('[useComicCache] Failed to track view:', err)
              })

            return { episode: cached, fromCache: true, error: null }
          }
        } catch (cacheError) {
          console.warn('[useComicCache] Cache read failed, falling back to network:', cacheError)
        }
      }

      // Fetch from network
      try {
        console.log('[useComicCache] Fetching from network:', episodeId)

        // Track view (same call whether from cache or network)
        fetch('/api/track-view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentType: 'comics',
            contentId: episodeId
          })
        }).catch(err => console.warn('[useComicCache] Failed to track view:', err))

        const response = await fetch(`/api/comics/episodes/${episodeId}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch episode: ${response.statusText}`)
        }

        const data = await response.json()

        if (!data.success || !data.episode) {
          throw new Error('Episode not found')
        }

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

        // Cache the episode for offline use
        if (enabled) {
          try {
            await cacheManager.set(episode)
          } catch (cacheError) {
            console.warn('[useComicCache] Failed to cache episode:', cacheError)
          }
        }

        return { episode, fromCache: false, error: null }
      } catch (networkError) {
        const errorMessage =
          networkError instanceof Error ? networkError.message : 'Failed to fetch episode'
        console.error('[useComicCache] Network fetch failed:', errorMessage)

        // Last resort: try cache again even if disabled (for offline scenarios)
        if (!enabled) {
          try {
            const cached = await cacheManager.get(episodeId)
            if (cached) {
              console.log('[useComicCache] Serving stale cache due to network error:', episodeId)
              return { episode: cached, fromCache: true, error: null }
            }
          } catch {
            // Cache also failed
          }
        }

        return { episode: null, fromCache: false, error: errorMessage }
      }
    },
    [enabled, cacheManager]
  )

  /**
   * Check if an episode is cached
   */
  const isCached = useCallback(
    async (episodeId: string): Promise<boolean> => {
      if (!enabled) return false
      return cacheManager.has(episodeId)
    },
    [enabled, cacheManager]
  )

  /**
   * Get cache statistics
   */
  const getStats = useCallback(async (): Promise<ComicCacheStats> => {
    return cacheManager.getStats()
  }, [cacheManager])

  /**
   * Clear all cached episodes
   */
  const clearCache = useCallback(async (): Promise<void> => {
    await cacheManager.clear()
  }, [cacheManager])

  /**
   * Get list of cached episode IDs
   */
  const getCachedIds = useCallback(async (): Promise<string[]> => {
    return cacheManager.getCachedIds()
  }, [cacheManager])

  /**
   * Prefetch multiple episodes for offline use
   */
  const prefetchEpisodes = useCallback(
    async (
      episodeIds: string[],
      options?: {
        skipCached?: boolean
        onProgress?: (current: number, total: number) => void
      }
    ): Promise<{ cached: number; failed: number; skipped: number }> => {
      if (!enabled) {
        return { cached: 0, failed: 0, skipped: episodeIds.length }
      }
      return cacheManager.prefetchEpisodes(episodeIds, options)
    },
    [enabled, cacheManager]
  )

  return {
    getEpisode,
    isCached,
    getStats,
    clearCache,
    getCachedIds,
    prefetchEpisodes,
  }
}

/**
 * Hook for fetching a single episode with cache-first strategy
 */
export function useCachedEpisode(episodeId: string | null, options: UseComicCacheOptions = {}) {
  const { getEpisode } = useComicCache(options)
  const [episode, setEpisode] = useState<CachedComicEpisode | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    if (!episodeId) {
      setEpisode(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    const loadEpisode = async () => {
      setLoading(true)
      setError(null)

      const result = await getEpisode(episodeId)

      if (cancelled) return

      setEpisode(result.episode)
      setFromCache(result.fromCache)
      setError(result.error)
      setLoading(false)
    }

    loadEpisode()

    return () => {
      cancelled = true
    }
  }, [episodeId, getEpisode])

  return { episode, loading, error, fromCache }
}

export default useComicCache
