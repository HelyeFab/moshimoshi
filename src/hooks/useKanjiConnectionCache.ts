/**
 * useKanjiConnectionCache Hook
 * Provides cache-first fetching for kanji connections (families, radicals, SKIP)
 * Supports prefetching ALL connections for complete offline access
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { getKanjiConnectionCacheManager } from '@/lib/kanji-connections/KanjiConnectionCacheManager'
import type {
  ConnectionType,
  ConnectionCacheStats,
} from '@/lib/kanji-connections/kanji-connection-cache.types'

interface UseKanjiConnectionCacheOptions {
  /** Whether to enable caching (default: true) */
  enabled?: boolean
}

interface UseKanjiConnectionCacheReturn {
  /** Get cached connection data */
  getConnection: (
    type: ConnectionType,
    id: string,
    queryParams?: Record<string, any>
  ) => Promise<any | null>

  /** Cache connection data */
  cacheConnection: (
    type: ConnectionType,
    id: string,
    data: any,
    queryParams?: Record<string, any>
  ) => Promise<void>

  /** Check if connection is cached */
  isCached: (
    type: ConnectionType,
    id: string,
    queryParams?: Record<string, any>
  ) => Promise<boolean>

  /** Prefetch ALL kanji connections for complete offline access */
  prefetchAll: (options?: {
    skipCached?: boolean
    onProgress?: (current: number, total: number, type: string) => void
  }) => Promise<{ cached: number; failed: number; skipped: number }>

  /** Get cache statistics */
  getStats: () => Promise<ConnectionCacheStats>

  /** Clear the cache */
  clearCache: () => Promise<void>
}

export function useKanjiConnectionCache(
  options: UseKanjiConnectionCacheOptions = {}
): UseKanjiConnectionCacheReturn {
  const { enabled = true } = options
  const cacheManager = getKanjiConnectionCacheManager()

  /**
   * Get cached connection data
   */
  const getConnection = useCallback(
    async (
      type: ConnectionType,
      id: string,
      queryParams?: Record<string, any>
    ): Promise<any | null> => {
      if (!enabled) return null
      try {
        return await cacheManager.get(type, id, queryParams)
      } catch (error) {
        console.error('[useKanjiConnectionCache] Error getting connection:', error)
        return null
      }
    },
    [enabled, cacheManager]
  )

  /**
   * Cache connection data
   */
  const cacheConnection = useCallback(
    async (
      type: ConnectionType,
      id: string,
      data: any,
      queryParams?: Record<string, any>
    ): Promise<void> => {
      if (!enabled) return
      try {
        await cacheManager.set(type, id, data, queryParams)
      } catch (error) {
        console.error('[useKanjiConnectionCache] Error caching connection:', error)
      }
    },
    [enabled, cacheManager]
  )

  /**
   * Check if a connection is cached
   */
  const isCached = useCallback(
    async (
      type: ConnectionType,
      id: string,
      queryParams?: Record<string, any>
    ): Promise<boolean> => {
      if (!enabled) return false
      return cacheManager.has(type, id, queryParams)
    },
    [enabled, cacheManager]
  )

  /**
   * Prefetch ALL kanji connections for complete offline access
   * This is the key feature - downloads all families, radicals, and SKIP patterns
   */
  const prefetchAll = useCallback(
    async (options?: {
      skipCached?: boolean
      onProgress?: (current: number, total: number, type: string) => void
    }): Promise<{ cached: number; failed: number; skipped: number }> => {
      if (!enabled) {
        return { cached: 0, failed: 0, skipped: 0 }
      }
      return cacheManager.prefetchAll(options)
    },
    [enabled, cacheManager]
  )

  /**
   * Get cache statistics
   */
  const getStats = useCallback(async (): Promise<ConnectionCacheStats> => {
    return cacheManager.getStats()
  }, [cacheManager])

  /**
   * Clear all cached connections
   */
  const clearCache = useCallback(async (): Promise<void> => {
    await cacheManager.clear()
  }, [cacheManager])

  return {
    getConnection,
    cacheConnection,
    isCached,
    prefetchAll,
    getStats,
    clearCache,
  }
}

/**
 * Hook for fetching a specific kanji connection with cache-first strategy
 * Tries cache first, then falls back to API
 */
export function useCachedConnection(
  type: ConnectionType | null,
  id: string | null,
  queryParams?: Record<string, any>,
  options: UseKanjiConnectionCacheOptions = {}
) {
  const { getConnection, cacheConnection } = useKanjiConnectionCache(options)
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    if (!type || !id) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    const loadData = async () => {
      setLoading(true)
      setError(null)

      // Try cache first
      try {
        const cached = await getConnection(type, id, queryParams)
        if (cached && !cancelled) {
          console.log(`[useCachedConnection] Serving from cache: ${type}:${id}`)
          setData(cached)
          setFromCache(true)
          setLoading(false)
          return
        }
      } catch (cacheError) {
        console.warn('[useCachedConnection] Cache read failed:', cacheError)
      }

      // Fetch from API
      try {
        let url = ''
        const params = new URLSearchParams()

        switch (type) {
          case 'family':
            url = '/api/kanji/by-family'
            params.set('family', id)
            if (queryParams?.details) params.set('details', 'true')
            if (queryParams?.crossFamilies) params.set('crossFamilies', 'true')
            break
          case 'radical':
            url = '/api/kanji/by-radical'
            params.set('radical', id)
            if (queryParams?.subThemes) params.set('subThemes', 'true')
            break
          case 'skip':
            url = '/api/kanji/by-skip'
            params.set('pattern', id)
            if (queryParams?.subcategories) params.set('subcategories', 'true')
            break
        }

        const response = await fetch(`${url}?${params}`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const fetchedData = await response.json()

        if (cancelled) return

        // Cache for offline use
        await cacheConnection(type, id, fetchedData, queryParams)

        setData(fetchedData)
        setFromCache(false)
      } catch (fetchError) {
        if (cancelled) return
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Failed to fetch'
        console.error('[useCachedConnection] Fetch failed:', errorMessage)

        // Try cache again as last resort
        try {
          const cached = await getConnection(type, id, queryParams)
          if (cached) {
            console.log(`[useCachedConnection] Serving stale cache: ${type}:${id}`)
            setData(cached)
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

    loadData()

    return () => {
      cancelled = true
    }
  }, [type, id, JSON.stringify(queryParams), getConnection, cacheConnection])

  return { data, loading, error, fromCache }
}

export default useKanjiConnectionCache
