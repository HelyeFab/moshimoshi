/**
 * useMoodBoardCache Hook
 * Provides cache-first moodboard fetching with automatic IndexedDB caching
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { getMoodBoardCacheManager } from '@/lib/moodboards/MoodBoardCacheManager'
import type { CachedMoodBoard, MoodBoardCacheStats } from '@/lib/moodboards/moodboard-cache.types'
import type { MoodBoard } from '@/types/moodboard'

interface UseMoodBoardCacheOptions {
  /** Whether to enable caching (default: true) */
  enabled?: boolean
}

interface UseMoodBoardCacheReturn {
  /** Get moodboard from cache by ID */
  getMoodBoard: (boardId: string) => Promise<CachedMoodBoard | null>
  /** Get all cached moodboards */
  getAllMoodBoards: () => Promise<CachedMoodBoard[]>
  /** Cache a moodboard */
  cacheMoodBoard: (moodBoard: MoodBoard) => Promise<void>
  /** Check if moodboard is cached */
  isCached: (boardId: string) => Promise<boolean>
  /** Get cache statistics */
  getStats: () => Promise<MoodBoardCacheStats>
  /** Clear the cache */
  clearCache: () => Promise<void>
  /** Get list of cached moodboard IDs */
  getCachedIds: () => Promise<string[]>
  /** Prefetch all moodboards for offline use */
  prefetchMoodBoards: (
    moodBoards: MoodBoard[],
    options?: {
      skipCached?: boolean
      onProgress?: (current: number, total: number) => void
    }
  ) => Promise<{ cached: number; failed: number; skipped: number }>
}

export function useMoodBoardCache(options: UseMoodBoardCacheOptions = {}): UseMoodBoardCacheReturn {
  const { enabled = true } = options
  const cacheManager = getMoodBoardCacheManager()

  /**
   * Get moodboard from cache by ID
   */
  const getMoodBoard = useCallback(
    async (boardId: string): Promise<CachedMoodBoard | null> => {
      if (!enabled) return null
      try {
        return await cacheManager.get(boardId)
      } catch (error) {
        console.error('[useMoodBoardCache] Error getting moodboard:', error)
        return null
      }
    },
    [enabled, cacheManager]
  )

  /**
   * Get all cached moodboards
   */
  const getAllMoodBoards = useCallback(async (): Promise<CachedMoodBoard[]> => {
    if (!enabled) return []
    try {
      return await cacheManager.getAll()
    } catch (error) {
      console.error('[useMoodBoardCache] Error getting all moodboards:', error)
      return []
    }
  }, [enabled, cacheManager])

  /**
   * Cache a moodboard
   */
  const cacheMoodBoard = useCallback(
    async (moodBoard: MoodBoard): Promise<void> => {
      if (!enabled) return
      try {
        await cacheManager.set(moodBoard)
      } catch (error) {
        console.error('[useMoodBoardCache] Error caching moodboard:', error)
      }
    },
    [enabled, cacheManager]
  )

  /**
   * Check if a moodboard is cached
   */
  const isCached = useCallback(
    async (boardId: string): Promise<boolean> => {
      if (!enabled) return false
      return cacheManager.has(boardId)
    },
    [enabled, cacheManager]
  )

  /**
   * Get cache statistics
   */
  const getStats = useCallback(async (): Promise<MoodBoardCacheStats> => {
    return cacheManager.getStats()
  }, [cacheManager])

  /**
   * Clear all cached moodboards
   */
  const clearCache = useCallback(async (): Promise<void> => {
    await cacheManager.clear()
  }, [cacheManager])

  /**
   * Get list of cached moodboard IDs
   */
  const getCachedIds = useCallback(async (): Promise<string[]> => {
    return cacheManager.getCachedIds()
  }, [cacheManager])

  /**
   * Prefetch all moodboards for offline use
   * Since moodboards are small enough, we prefetch ALL of them
   */
  const prefetchMoodBoards = useCallback(
    async (
      moodBoards: MoodBoard[],
      options?: {
        skipCached?: boolean
        onProgress?: (current: number, total: number) => void
      }
    ): Promise<{ cached: number; failed: number; skipped: number }> => {
      if (!enabled) {
        return { cached: 0, failed: 0, skipped: moodBoards.length }
      }
      return cacheManager.prefetchMoodBoards(moodBoards, options)
    },
    [enabled, cacheManager]
  )

  return {
    getMoodBoard,
    getAllMoodBoards,
    cacheMoodBoard,
    isCached,
    getStats,
    clearCache,
    getCachedIds,
    prefetchMoodBoards,
  }
}

/**
 * Hook for using cached moodboards with fallback to network
 * Tries cache first, then falls back to API if offline
 */
export function useCachedMoodBoards(
  moodBoards: MoodBoard[],
  loading: boolean,
  options: UseMoodBoardCacheOptions = {}
) {
  const { prefetchMoodBoards, getAllMoodBoards } = useMoodBoardCache(options)
  const [prefetchStatus, setPrefetchStatus] = useState<'idle' | 'prefetching' | 'done'>('idle')
  const [cachedBoards, setCachedBoards] = useState<CachedMoodBoard[]>([])

  // Prefetch all moodboards when they're loaded
  useEffect(() => {
    if (moodBoards.length > 0 && prefetchStatus === 'idle' && !loading) {
      setPrefetchStatus('prefetching')
      prefetchMoodBoards(moodBoards, { skipCached: true })
        .then(results => {
          console.log('[KanjiMoodsPage] Offline prefetch complete:', results)
          setPrefetchStatus('done')
        })
        .catch(error => {
          console.warn('[KanjiMoodsPage] Prefetch failed:', error)
          setPrefetchStatus('done')
        })
    }
  }, [moodBoards, prefetchStatus, loading, prefetchMoodBoards])

  // Load from cache if we're offline
  useEffect(() => {
    const checkOffline = async () => {
      if (!navigator.onLine && moodBoards.length === 0) {
        const cached = await getAllMoodBoards()
        if (cached.length > 0) {
          setCachedBoards(cached)
        }
      }
    }
    checkOffline()
  }, [moodBoards, getAllMoodBoards])

  return {
    prefetchStatus,
    cachedBoards,
    isUsingCache: cachedBoards.length > 0 && moodBoards.length === 0,
  }
}

export default useMoodBoardCache
