/**
 * useBookCache Hook
 * Provides cache-first book fetching with automatic IndexedDB caching
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { getBookCacheManager } from '@/lib/library/BookCacheManager'
import type { CachedBook, BookCacheStats } from '@/lib/library/book-cache.types'

interface UseBookCacheOptions {
  /** Whether to enable caching (default: true) */
  enabled?: boolean
}

interface UseBookCacheReturn {
  /** Fetch book with cache-first strategy */
  getBook: (bookId: string) => Promise<{
    book: CachedBook | null
    fromCache: boolean
    error: string | null
  }>
  /** Check if book is cached */
  isCached: (bookId: string) => Promise<boolean>
  /** Get cache statistics */
  getStats: () => Promise<BookCacheStats>
  /** Clear the cache */
  clearCache: () => Promise<void>
  /** Get list of cached book IDs */
  getCachedIds: () => Promise<string[]>
  /** Prefetch multiple books for offline use */
  prefetchBooks: (
    bookIds: string[],
    options?: {
      skipCached?: boolean
      onProgress?: (current: number, total: number) => void
    }
  ) => Promise<{ cached: number; failed: number; skipped: number }>
}

export function useBookCache(options: UseBookCacheOptions = {}): UseBookCacheReturn {
  const { enabled = true } = options
  const cacheManager = getBookCacheManager()

  /**
   * Fetch book with cache-first strategy
   */
  const getBook = useCallback(
    async (
      bookId: string
    ): Promise<{
      book: CachedBook | null
      fromCache: boolean
      error: string | null
    }> => {
      // Try cache first if enabled
      if (enabled) {
        try {
          const cached = await cacheManager.get(bookId)
          if (cached) {
            console.log('[useBookCache] Serving from cache:', bookId)
            return { book: cached, fromCache: true, error: null }
          }
        } catch (cacheError) {
          console.warn('[useBookCache] Cache read failed, falling back to network:', cacheError)
        }
      }

      // Fetch from network
      try {
        console.log('[useBookCache] Fetching from network:', bookId)
        const response = await fetch(`/api/library/books?id=${bookId}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch book: ${response.statusText}`)
        }

        const data = await response.json()

        if (!data.success || !data.book) {
          throw new Error('Book not found')
        }

        const book: CachedBook = {
          id: data.book.id,
          title: data.book.title,
          titleJa: data.book.titleJa,
          bookName: data.book.bookName,
          author: data.book.author,
          content: data.book.content,
          summary: data.book.summary,
          coverImageUrl: data.book.coverImageUrl,
          audioUrl: data.book.audioUrl,
          jlptLevel: data.book.jlptLevel,
          category: data.book.category,
          tags: data.book.tags,
          createdAt: data.book.createdAt,
          updatedAt: data.book.updatedAt,
          status: data.book.status,
          viewCount: data.book.viewCount,
          readCount: data.book.readCount,
          metadata: data.book.metadata,
        }

        // Cache the book for offline use
        if (enabled) {
          try {
            await cacheManager.set(book)
          } catch (cacheError) {
            console.warn('[useBookCache] Failed to cache book:', cacheError)
          }
        }

        return { book, fromCache: false, error: null }
      } catch (networkError) {
        const errorMessage =
          networkError instanceof Error ? networkError.message : 'Failed to fetch book'
        console.error('[useBookCache] Network fetch failed:', errorMessage)

        // Last resort: try cache again even if disabled (for offline scenarios)
        if (!enabled) {
          try {
            const cached = await cacheManager.get(bookId)
            if (cached) {
              console.log('[useBookCache] Serving stale cache due to network error:', bookId)
              return { book: cached, fromCache: true, error: null }
            }
          } catch {
            // Cache also failed
          }
        }

        return { book: null, fromCache: false, error: errorMessage }
      }
    },
    [enabled, cacheManager]
  )

  /**
   * Check if a book is cached
   */
  const isCached = useCallback(
    async (bookId: string): Promise<boolean> => {
      if (!enabled) return false
      return cacheManager.has(bookId)
    },
    [enabled, cacheManager]
  )

  /**
   * Get cache statistics
   */
  const getStats = useCallback(async (): Promise<BookCacheStats> => {
    return cacheManager.getStats()
  }, [cacheManager])

  /**
   * Clear all cached books
   */
  const clearCache = useCallback(async (): Promise<void> => {
    await cacheManager.clear()
  }, [cacheManager])

  /**
   * Get list of cached book IDs
   */
  const getCachedIds = useCallback(async (): Promise<string[]> => {
    return cacheManager.getCachedIds()
  }, [cacheManager])

  /**
   * Prefetch multiple books for offline use
   */
  const prefetchBooks = useCallback(
    async (
      bookIds: string[],
      options?: {
        skipCached?: boolean
        onProgress?: (current: number, total: number) => void
      }
    ): Promise<{ cached: number; failed: number; skipped: number }> => {
      if (!enabled) {
        return { cached: 0, failed: 0, skipped: bookIds.length }
      }
      return cacheManager.prefetchBooks(bookIds, options)
    },
    [enabled, cacheManager]
  )

  return {
    getBook,
    isCached,
    getStats,
    clearCache,
    getCachedIds,
    prefetchBooks,
  }
}

/**
 * Hook for fetching a single book with cache-first strategy
 */
export function useCachedBook(bookId: string | null, options: UseBookCacheOptions = {}) {
  const { getBook } = useBookCache(options)
  const [book, setBook] = useState<CachedBook | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    if (!bookId) {
      setBook(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    const loadBook = async () => {
      setLoading(true)
      setError(null)

      const result = await getBook(bookId)

      if (cancelled) return

      setBook(result.book)
      setFromCache(result.fromCache)
      setError(result.error)
      setLoading(false)
    }

    loadBook()

    return () => {
      cancelled = true
    }
  }, [bookId, getBook])

  return { book, loading, error, fromCache }
}

export default useBookCache
