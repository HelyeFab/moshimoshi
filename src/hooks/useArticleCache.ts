/**
 * useArticleCache Hook
 * Provides cache-first article fetching with automatic IndexedDB caching
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { getArticleCacheManager } from '@/lib/news/ArticleCacheManager'
import type { CachedArticle, ArticleCacheStats } from '@/lib/news/article-cache.types'

interface UseArticleCacheOptions {
  /** Whether to enable caching (default: true) */
  enabled?: boolean
}

interface UseArticleCacheReturn {
  /** Fetch article with cache-first strategy */
  getArticle: (articleId: string) => Promise<{
    article: CachedArticle | null
    fromCache: boolean
    error: string | null
  }>
  /** Check if article is cached */
  isCached: (articleId: string) => Promise<boolean>
  /** Get cache statistics */
  getStats: () => Promise<ArticleCacheStats>
  /** Clear the cache */
  clearCache: () => Promise<void>
  /** Get list of cached article IDs */
  getCachedIds: () => Promise<string[]>
  /** Prefetch multiple articles for offline use */
  prefetchArticles: (
    articleIds: string[],
    options?: {
      skipCached?: boolean
      onProgress?: (current: number, total: number) => void
    }
  ) => Promise<{ cached: number; failed: number; skipped: number }>
}

export function useArticleCache(options: UseArticleCacheOptions = {}): UseArticleCacheReturn {
  const { enabled = true } = options
  const cacheManager = getArticleCacheManager()

  /**
   * Fetch article with cache-first strategy
   * 1. Check IndexedDB cache first
   * 2. If not cached or expired, fetch from API
   * 3. Cache the fresh response
   */
  const getArticle = useCallback(
    async (
      articleId: string
    ): Promise<{
      article: CachedArticle | null
      fromCache: boolean
      error: string | null
    }> => {
      // Try cache first if enabled
      if (enabled) {
        try {
          const cached = await cacheManager.get(articleId)
          if (cached) {
            console.log('[useArticleCache] Serving from cache:', articleId)
            return { article: cached, fromCache: true, error: null }
          }
        } catch (cacheError) {
          console.warn('[useArticleCache] Cache read failed, falling back to network:', cacheError)
        }
      }

      // Fetch from network
      try {
        console.log('[useArticleCache] Fetching from network:', articleId)
        const response = await fetch(`/api/news/article/${articleId}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch article: ${response.statusText}`)
        }

        const data = await response.json()

        if (!data.success || !data.article) {
          throw new Error('Article not found')
        }

        const article: CachedArticle = {
          id: data.article.id,
          title: data.article.title,
          content: data.article.content,
          summary: data.article.summary,
          url: data.article.url,
          imageUrl: data.article.imageUrl,
          publishDate:
            typeof data.article.publishDate === 'string'
              ? data.article.publishDate
              : new Date(data.article.publishDate).toISOString(),
          source: data.article.source,
          category: data.article.category,
          difficulty: data.article.difficulty,
          tags: data.article.tags,
          metadata: data.article.metadata,
          nhkAudioUrl: data.article.nhkAudioUrl,
          generatedTitleAudioUrl: data.article.generatedTitleAudioUrl,
          generatedSummaryAudioUrl: data.article.generatedSummaryAudioUrl,
          generatedContentAudioUrl: data.article.generatedContentAudioUrl,
          audioProvider: data.article.audioProvider as
            | 'kokoro'
            | 'elevenlabs'
            | 'voicevox'
            | undefined,
          audioVoice: data.article.audioVoice,
          audioStatus: data.article.audioStatus as
            | 'pending'
            | 'generated'
            | 'failed'
            | 'partial'
            | undefined,
        }

        // Cache the article for offline use
        if (enabled) {
          try {
            await cacheManager.set(article)
          } catch (cacheError) {
            console.warn('[useArticleCache] Failed to cache article:', cacheError)
            // Don't fail the request if caching fails
          }
        }

        return { article, fromCache: false, error: null }
      } catch (networkError) {
        const errorMessage =
          networkError instanceof Error ? networkError.message : 'Failed to fetch article'
        console.error('[useArticleCache] Network fetch failed:', errorMessage)

        // Last resort: try cache again even if disabled (for offline scenarios)
        if (!enabled) {
          try {
            const cached = await cacheManager.get(articleId)
            if (cached) {
              console.log('[useArticleCache] Serving stale cache due to network error:', articleId)
              return { article: cached, fromCache: true, error: null }
            }
          } catch {
            // Cache also failed
          }
        }

        return { article: null, fromCache: false, error: errorMessage }
      }
    },
    [enabled, cacheManager]
  )

  /**
   * Check if an article is cached
   */
  const isCached = useCallback(
    async (articleId: string): Promise<boolean> => {
      if (!enabled) return false
      return cacheManager.has(articleId)
    },
    [enabled, cacheManager]
  )

  /**
   * Get cache statistics
   */
  const getStats = useCallback(async (): Promise<ArticleCacheStats> => {
    return cacheManager.getStats()
  }, [cacheManager])

  /**
   * Clear all cached articles
   */
  const clearCache = useCallback(async (): Promise<void> => {
    await cacheManager.clear()
  }, [cacheManager])

  /**
   * Get list of cached article IDs
   */
  const getCachedIds = useCallback(async (): Promise<string[]> => {
    return cacheManager.getCachedIds()
  }, [cacheManager])

  /**
   * Prefetch multiple articles for offline use
   * Silently downloads and caches articles in the background
   */
  const prefetchArticles = useCallback(
    async (
      articleIds: string[],
      options?: {
        skipCached?: boolean
        onProgress?: (current: number, total: number) => void
      }
    ): Promise<{ cached: number; failed: number; skipped: number }> => {
      if (!enabled) {
        return { cached: 0, failed: 0, skipped: articleIds.length }
      }
      return cacheManager.prefetchArticles(articleIds, options)
    },
    [enabled, cacheManager]
  )

  return {
    getArticle,
    isCached,
    getStats,
    clearCache,
    getCachedIds,
    prefetchArticles,
  }
}

/**
 * Hook for fetching a single article with cache-first strategy
 * Provides loading/error states for easier component integration
 */
export function useCachedArticle(articleId: string | null, options: UseArticleCacheOptions = {}) {
  const { getArticle } = useArticleCache(options)
  const [article, setArticle] = useState<CachedArticle | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    if (!articleId) {
      setArticle(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    const loadArticle = async () => {
      setLoading(true)
      setError(null)

      const result = await getArticle(articleId)

      if (cancelled) return

      setArticle(result.article)
      setFromCache(result.fromCache)
      setError(result.error)
      setLoading(false)
    }

    loadArticle()

    return () => {
      cancelled = true
    }
  }, [articleId, getArticle])

  return { article, loading, error, fromCache }
}

export default useArticleCache
