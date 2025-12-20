/**
 * useTatoebaCache Hook
 * Provides cache-first Tatoeba sentence fetching with automatic IndexedDB caching
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { getTatoebaCacheManager } from '@/lib/tatoeba/TatoebaCacheManager'
import type {
  CachedTatoebaData,
  TatoebaCacheStats,
} from '@/lib/tatoeba/tatoeba-cache.types'
import { TATOEBA_CACHE_CONFIG } from '@/lib/tatoeba/tatoeba-cache.types'

interface UseTatoebaCacheOptions {
  /** Whether to enable caching (default: true) */
  enabled?: boolean
  /** Number of sentences to fetch per kanji (default: 2) */
  limit?: number
}

interface UseTatoebaCacheReturn {
  /** Fetch sentences with cache-first strategy */
  getSentences: (kanji: string) => Promise<{
    data: CachedTatoebaData | null
    fromCache: boolean
    error: string | null
  }>
  /** Check if kanji's sentences are cached */
  isCached: (kanji: string) => Promise<boolean>
  /** Get cache statistics */
  getStats: () => Promise<TatoebaCacheStats>
  /** Clear the cache */
  clearCache: () => Promise<void>
  /** Get list of cached kanji */
  getCachedKanji: () => Promise<string[]>
  /** Prefetch sentences for multiple kanji */
  prefetch: (
    kanjiList: string[],
    options?: {
      skipCached?: boolean
      onProgress?: (current: number, total: number) => void
    }
  ) => Promise<{ cached: number; failed: number; skipped: number }>
}

export function useTatoebaCache(options: UseTatoebaCacheOptions = {}): UseTatoebaCacheReturn {
  const { enabled = true, limit = TATOEBA_CACHE_CONFIG.DEFAULT_SENTENCE_LIMIT } = options
  const cacheManager = getTatoebaCacheManager()

  /**
   * Fetch sentences with cache-first strategy
   * 1. Check IndexedDB cache first
   * 2. If not cached or expired, fetch from API and generate furigana
   * 3. Cache the result
   */
  const getSentences = useCallback(
    async (
      kanji: string
    ): Promise<{
      data: CachedTatoebaData | null
      fromCache: boolean
      error: string | null
    }> => {
      if (!enabled) {
        return { data: null, fromCache: false, error: 'Caching disabled' }
      }

      try {
        // Try cache first
        const cached = await cacheManager.get(kanji)
        if (cached) {
          console.log('[useTatoebaCache] Serving from cache:', kanji)
          return { data: cached, fromCache: true, error: null }
        }

        // Fetch and cache (includes furigana generation)
        console.log('[useTatoebaCache] Fetching from network:', kanji)
        const data = await cacheManager.fetchAndCache(kanji, limit)
        return { data, fromCache: false, error: null }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to fetch sentences'
        console.error('[useTatoebaCache] Error:', errorMessage)
        return { data: null, fromCache: false, error: errorMessage }
      }
    },
    [enabled, cacheManager, limit]
  )

  /**
   * Check if a kanji's sentences are cached
   */
  const isCached = useCallback(
    async (kanji: string): Promise<boolean> => {
      if (!enabled) return false
      return cacheManager.has(kanji)
    },
    [enabled, cacheManager]
  )

  /**
   * Get cache statistics
   */
  const getStats = useCallback(async (): Promise<TatoebaCacheStats> => {
    return cacheManager.getStats()
  }, [cacheManager])

  /**
   * Clear all cached sentences
   */
  const clearCache = useCallback(async (): Promise<void> => {
    await cacheManager.clear()
  }, [cacheManager])

  /**
   * Get list of cached kanji
   */
  const getCachedKanji = useCallback(async (): Promise<string[]> => {
    return cacheManager.getCachedKanji()
  }, [cacheManager])

  /**
   * Prefetch sentences for multiple kanji
   * Silently downloads and caches sentences in the background
   */
  const prefetch = useCallback(
    async (
      kanjiList: string[],
      options?: {
        skipCached?: boolean
        onProgress?: (current: number, total: number) => void
      }
    ): Promise<{ cached: number; failed: number; skipped: number }> => {
      if (!enabled) {
        return { cached: 0, failed: 0, skipped: kanjiList.length }
      }
      return cacheManager.prefetch(kanjiList, { ...options, limit })
    },
    [enabled, cacheManager, limit]
  )

  return {
    getSentences,
    isCached,
    getStats,
    clearCache,
    getCachedKanji,
    prefetch,
  }
}

/**
 * Hook for fetching Tatoeba sentences for a single kanji
 * Provides loading/error states for easier component integration
 */
export function useCachedTatoebaSentences(
  kanji: string | null,
  options: UseTatoebaCacheOptions = {}
) {
  const { getSentences } = useTatoebaCache(options)
  const [data, setData] = useState<CachedTatoebaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    if (!kanji) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    const loadSentences = async () => {
      setLoading(true)
      setError(null)

      const result = await getSentences(kanji)

      if (cancelled) return

      setData(result.data)
      setFromCache(result.fromCache)
      setError(result.error)
      setLoading(false)
    }

    loadSentences()

    return () => {
      cancelled = true
    }
  }, [kanji, getSentences])

  return { data, loading, error, fromCache }
}

export default useTatoebaCache
