'use client'

import { useState, useEffect, useCallback } from 'react'
import { Book, JLPTLevel } from '@/types/book'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Search, BookOpen, Clock, TrendingUp } from 'lucide-react'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import Navbar from '@/components/layout/Navbar'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import PageHeader from '@/components/ui/PageHeader'
import { useI18n } from '@/i18n/I18nContext'
import { getGradientForBook } from '@/lib/utils/gradients'
import { useBookCache } from '@/hooks/useBookCache'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { EntitlementGate } from '@/components/review-engine/EntitlementGate'
import { getValidatedEntitlementsSnapshot, isOffline } from '@/lib/pwa/offline-entitlements'

const JLPT_LEVELS: Array<{ value: JLPTLevel | 'all'; label: string }> = [
  { value: 'all', label: 'All Levels' },
  { value: 'N5', label: 'N5 (Beginner)' },
  { value: 'N4', label: 'N4 (Elementary)' },
  { value: 'N3', label: 'N3 (Intermediate)' },
  { value: 'N2', label: 'N2 (Upper Int.)' },
  { value: 'N1', label: 'N1 (Advanced)' },
]

export default function LibraryPage() {
  const { strings } = useI18n()
  const { user, loading: authLoading } = useAuth()
  const { isPremium } = useSubscription()
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const limit = 12

  // Offline caching
  const { prefetchBooks, getCachedIds, getBook } = useBookCache()
  const [prefetchStatus, setPrefetchStatus] = useState<'idle' | 'prefetching' | 'done'>('idle')
  const offlineLimit = 10

  const loadCachedBooks = async () => {
    const cachedIds = await getCachedIds()
    if (cachedIds.length === 0) return []

    const cached = await Promise.all(
      cachedIds.map(async (id) => {
        const result = await getBook(id)
        return result.book
      })
    )

    const normalized = cached.filter(Boolean) as Book[]
    return normalized
      .sort((a, b) => {
        const bTime = new Date(b.updatedAt ?? b.createdAt).getTime()
        const aTime = new Date(a.updatedAt ?? a.createdAt).getTime()
        return bTime - aTime
      })
      .slice(0, offlineLimit)
  }

  const getPrefetchBudget = async (desiredCount: number): Promise<number> => {
    if (desiredCount <= 0) return 0

    try {
      const response = await fetch('/api/usage/books/check')
      if (!response.ok) {
        return 0
      }

      const data = await response.json()
      if (!data?.allow) return 0
      if (data?.remaining === -1) return desiredCount

      const remaining = typeof data?.remaining === 'number' ? data.remaining : 0
      return Math.max(0, Math.min(desiredCount, remaining))
    } catch (prefetchError) {
      console.warn('[LibraryPage] Prefetch budget check failed:', prefetchError)
      return 0
    }
  }

  const loadBooks = useCallback(
    async (reset: boolean = false) => {
      try {
        setLoading(true)
        const currentOffset = reset ? 0 : offset
        const snapshot = await getValidatedEntitlementsSnapshot()
        const offlineTier = snapshot?.tier || null

        if (isOffline()) {
          if (offlineTier !== 'premium') {
            setBooks([])
            setHasMore(false)
            setLoading(false)
            return
          }

          const cachedBooks = await loadCachedBooks()
          if (cachedBooks.length > 0) {
            setBooks(cachedBooks)
            setHasMore(false)
            setOffset(0)
            setLoading(false)
            return
          }
          throw new Error('Offline with no cached books')
        }

        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: currentOffset.toString(),
        })

        if (selectedLevel !== 'all') {
          params.append('jlptLevel', selectedLevel)
        }

        if (searchQuery) {
          params.append('search', searchQuery)
        }

        const response = await fetch(`/api/library/books?${params}`)

        if (!response.ok) {
          throw new Error('Failed to fetch books')
        }

        const data = await response.json()

        if (reset) {
          setBooks(data.books || [])
          setOffset(0)
        } else {
          setBooks(prev => [...prev, ...(data.books || [])])
        }

        setHasMore(data.hasMore || false)
      } catch (error) {
        console.error('Error loading books:', error)
        const snapshot = await getValidatedEntitlementsSnapshot()
        if (snapshot?.tier === 'premium') {
          const cachedBooks = await loadCachedBooks()
          if (cachedBooks.length > 0) {
            setBooks(cachedBooks)
            setHasMore(false)
            setOffset(0)
            return
          }
        }
        setBooks([])
      } finally {
        setLoading(false)
      }
    },
    [selectedLevel, searchQuery, offset, limit]
  )

  // Load books on mount and when filters change
  useEffect(() => {
    loadBooks(true)
  }, [selectedLevel, searchQuery])

  // Auto-prefetch top 10 books for offline use
  useEffect(() => {
    if (!isPremium) return
    if (books.length > 0 && prefetchStatus === 'idle' && offset === 0) {
      // Only prefetch on initial load (not when loading more)
      setPrefetchStatus('prefetching')
      const desiredIds = books.slice(0, offlineLimit).map(b => b.id)
      getPrefetchBudget(desiredIds.length)
        .then((budget) => {
          const bookIds = budget > 0 ? desiredIds.slice(0, budget) : []
          if (bookIds.length === 0) {
            setPrefetchStatus('done')
            return
          }
          return prefetchBooks(bookIds, { skipCached: true })
            .then(results => {
              console.log('[LibraryPage] Offline prefetch complete:', results)
              setPrefetchStatus('done')
            })
        })
        .catch(error => {
          console.warn('[LibraryPage] Prefetch failed:', error)
          setPrefetchStatus('done')
        })
    }
  }, [books, prefetchStatus, offset, prefetchBooks, isPremium, offlineLimit])

  const handleLoadMore = () => {
    setOffset(prev => prev + limit)
    loadBooks(false)
  }

  const handleLevelChange = (level: JLPTLevel | 'all') => {
    setSelectedLevel(level)
    setOffset(0)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setOffset(0)
  }

  // Wait for auth to load before rendering
  if (authLoading) {
    return (
      <LoadingOverlay
        isLoading={true}
        message={strings.common?.loading || 'Loading...'}
      />
    )
  }

  return (
    <EntitlementGate featureId="books">
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-dark-900 dark:to-dark-850">
        {/* Desktop Navbar */}
        <div className="hidden sm:block">
          <Navbar user={user} showUserMenu={true} />
        </div>

        {/* Page Header */}
        <PageHeader
          title={strings.library?.title || 'Library'}
          description={
            strings.library?.pageDescription ||
            'Read condensed summaries of popular books in Japanese'
          }
          backHref="/dashboard"
        />

        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 space-y-4"
          >
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search books by title, author, or keywords..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
              />
            </div>

            {/* JLPT Level Filter */}
            <div className="relative">
              {/* Mobile: Horizontal scroll */}
              <div className="flex md:hidden gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
                {JLPT_LEVELS.map(level => (
                  <button
                    key={level.value}
                    onClick={() => handleLevelChange(level.value)}
                    className={`flex-shrink-0 snap-start px-4 py-2.5 rounded-full font-medium transition-all whitespace-nowrap ${
                      selectedLevel === level.value
                        ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg ring-2 ring-primary-300 dark:ring-primary-700'
                        : 'bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
                    }`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>

              {/* Desktop: Flex wrap */}
              <div className="hidden md:flex flex-wrap gap-2">
                {JLPT_LEVELS.map(level => (
                  <button
                    key={level.value}
                    onClick={() => handleLevelChange(level.value)}
                    className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                      selectedLevel === level.value
                        ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg scale-105'
                        : 'bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-700'
                    }`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Loading State */}
          {loading && offset === 0 && <LoadingOverlay />}

          {/* Books Grid */}
          {!loading && books.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
            <BookOpen className="w-20 h-20 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No books found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Try adjusting your filters or search query
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {books.map((book, index) => (
              <motion.div
                key={book.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={`/library/${book.id}`} className="block group">
                  <div className="bg-white dark:bg-dark-850 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow border border-gray-200 dark:border-dark-700 h-full flex flex-col">
                    {/* Cover Image or Gradient */}
                    <div className="relative h-48 overflow-hidden">
                      {book.coverImageUrl ? (
                        <img
                          src={book.coverImageUrl}
                          alt={book.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div
                          className={`w-full h-full bg-gradient-to-br ${getGradientForBook(book.id)} flex items-center justify-center p-6 group-hover:scale-105 transition-transform duration-300`}
                        >
                          <div className="text-center">
                            <BookOpen className="w-12 h-12 text-white/80 mb-2 mx-auto" />
                            <p className="text-white font-bold text-lg line-clamp-2">
                              {book.titleJa}
                            </p>
                          </div>
                        </div>
                      )}
                      {/* JLPT Level Badge */}
                      <div className="absolute top-3 right-3 bg-primary-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                        {book.jlptLevel}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex-1 flex flex-col">
                      {/* Title */}
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {book.titleJa}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{book.title}</p>

                      {/* Book Name & Author */}
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {book.bookName}
                        </p>
                        {book.author && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            by {book.author}
                          </p>
                        )}
                      </div>

                      {/* Summary */}
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 flex-1">
                        {book.summary}
                      </p>

                      {/* Meta Info */}
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-200 dark:border-dark-700">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{book.metadata?.readingTime || 3} min</span>
                        </div>
                        {book.viewCount && book.viewCount > 0 && (
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            <span>{book.viewCount} views</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {hasMore && !loading && (
          <div className="text-center">
            <button
              onClick={handleLoadMore}
              className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors shadow-md"
            >
              Load More Books
            </button>
          </div>
        )}

        {/* Loading indicator for load more */}
        {loading && offset > 0 && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        )}
        <MobileNavSpacer />
      </div>
    </div>
    </EntitlementGate>
  )
}
