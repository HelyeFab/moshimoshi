'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/i18n/I18nContext'
// Navigation is now global via NavigationWrapper in root layout;
import LearningPageHeader from '@/components/learn/LearningPageHeader'
import { useAuth } from '@/hooks/useAuth'
import { LoadingOverlay } from '@/components/ui/Loading'
import NewsArticleFallbackImage from '@/components/news/NewsArticleFallbackImage'
import { useArticleCache } from '@/hooks/useArticleCache'

interface NewsArticle {
  id: string
  title: string
  content: string
  summary: string
  url: string
  imageUrl?: string
  publishDate: string | Date
  source: string
  category: string
  difficulty: string
  tags?: string[]
  metadata?: {
    wordCount?: number
    readingTime?: number
    hasFurigana?: boolean
  }
}

// Loading skeleton component
function ArticleCardSkeleton() {
  return (
    <div className="bg-soft-white dark:bg-dark-850 rounded-lg shadow-sm border border-gray-100 dark:border-dark-700 p-4 animate-pulse">
      <div className="flex gap-4">
        <div className="w-20 h-20 bg-gray-200 dark:bg-dark-700 rounded-lg flex-shrink-0"></div>
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-200 dark:bg-dark-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-full"></div>
          <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-2/3"></div>
          <div className="flex items-center gap-2 mt-3">
            <div className="h-6 bg-gray-200 dark:bg-dark-700 rounded-full w-12"></div>
            <div className="h-6 bg-gray-200 dark:bg-dark-700 rounded-full w-16"></div>
            <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-20"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Article card component
function ArticleCard({
  article,
  onClick,
}: {
  article: NewsArticle
  onClick: (article: NewsArticle) => void
}) {
  const { t } = useI18n()

  const formatDate = (date: string | Date) => {
    const d = new Date(date)
    return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
  }

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      N5: 'bg-success-100 text-success-700 border-success-200 dark:bg-success-900/20 dark:text-success-400 dark:border-success-800',
      N4: 'bg-info-100 text-info-700 border-info-200 dark:bg-info-900/20 dark:text-info-400 dark:border-info-800',
      N3: 'bg-warning-100 text-warning-700 border-warning-200 dark:bg-warning-900/20 dark:text-warning-400 dark:border-warning-800',
      N2: 'bg-accent-100 text-accent-700 border-accent-200 dark:bg-accent-900/20 dark:text-accent-400 dark:border-accent-800',
      N1: 'bg-danger-100 text-danger-700 border-danger-200 dark:bg-danger-900/20 dark:text-danger-400 dark:border-danger-800',
    }
    return colors[difficulty] || colors.N3
  }

  const getSourceIcon = (source: string) => {
    const icons: Record<string, string> = {
      'NHK Easy': '📺',
      Todaii: '📚',
      Watanoc: '🌸',
      'Mainichi News': '📰',
      'Mainichi Shogakusei': '🎒',
    }
    return icons[source] || '📄'
  }

  return (
    <article
      className="bg-soft-white dark:bg-dark-850 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-4 hover:shadow-md dark:hover:shadow-dark-900/50 transition-all cursor-pointer hover:border-primary-300 dark:hover:border-primary-600"
      onClick={() => onClick(article)}
    >
      <div className="flex gap-4">
        {/* Thumbnail with professional fallback */}
        <div className="w-20 h-20 rounded-lg flex-shrink-0 overflow-hidden">
          <NewsArticleFallbackImage
            imageUrl={article.imageUrl}
            title={article.title}
            source={article.source}
            category={article.category}
            difficulty={article.difficulty}
            height="h-20"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground dark:text-dark-100 line-clamp-2 mb-1">
            {article.title}
          </h3>

          {article.summary && (
            <p className="text-sm text-muted-foreground dark:text-dark-400 line-clamp-2 mb-3">
              {article.summary}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getDifficultyColor(article.difficulty)}`}
            >
              {article.difficulty}
            </span>

            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
              <span>{getSourceIcon(article.source)}</span>
              {article.source}
            </span>

            <span className="text-xs text-muted-foreground dark:text-dark-500 flex items-center gap-1">
              <span className="text-xs">📖</span>
              {article.metadata?.readingTime ||
                Math.ceil((article.metadata?.wordCount || 500) / 300)}
              {t('news.readingTime')}
            </span>

            {article.metadata?.hasFurigana && (
              <span className="text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 px-2 py-0.5 rounded-full">
                {t('news.reader.withFurigana')}
              </span>
            )}

            <span className="text-xs text-muted-foreground dark:text-dark-500">
              {formatDate(article.publishDate)}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

// Helper to get available months from articles
function getAvailableMonthsFromArticles(
  articles: NewsArticle[]
): { value: string; label: string }[] {
  const months = [{ value: 'All', label: 'All' }]
  const uniqueMonths = new Set<string>()

  articles.forEach(article => {
    const date = new Date(article.publishDate)
    const month = date.getMonth() + 1
    const year = date.getFullYear()
    const key = `${year}-${month.toString().padStart(2, '0')}`
    uniqueMonths.add(key)
  })

  // Sort months in descending order (most recent first)
  const sortedMonths = Array.from(uniqueMonths).sort((a, b) => b.localeCompare(a))

  sortedMonths.forEach(key => {
    const [year, month] = key.split('-').map(Number)
    months.push({
      value: key,
      label: `${month}月`,
    })
  })

  return months
}

// Helper to get days in a month
function getDaysInMonth(yearMonth: string): number {
  if (yearMonth === 'All') return 31
  const [year, month] = yearMonth.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

// Filter bar component
function FilterBar({
  selectedMonth,
  selectedDay,
  onMonthChange,
  onDayChange,
  onRefresh,
  isLoading,
  articles,
}: {
  selectedMonth: string
  selectedDay: string
  onMonthChange: (month: string) => void
  onDayChange: (day: string) => void
  onRefresh: () => void
  isLoading: boolean
  articles: NewsArticle[]
}) {
  const { t } = useI18n()
  const [showFilters, setShowFilters] = useState(false)

  const months = getAvailableMonthsFromArticles(articles)
  const daysInMonth = getDaysInMonth(selectedMonth)
  const days = ['All', ...Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString())]

  const hasFilters = selectedMonth !== 'All' || selectedDay !== 'All'

  return (
    <div className="bg-soft-white dark:bg-dark-850 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm font-medium text-foreground"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {t('news.filters.title')}
          {hasFilters && (
            <span className="ml-1 px-2 py-0.5 bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 rounded-full text-xs">
              {t('news.filters.applied')}
            </span>
          )}
        </button>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="px-3 py-1.5 bg-primary-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-600 transition-colors"
        >
          {isLoading ? t('news.loading') : t('news.refresh')}
        </button>
      </div>

      {showFilters && (
        <div className="pt-3 border-t border-gray-200 dark:border-dark-700 space-y-4">
          {/* Month filter */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              {t('news.filters.month')}
            </label>
            <div className="flex flex-wrap gap-2">
              {months.map(month => (
                <button
                  key={month.value}
                  onClick={() => {
                    onMonthChange(month.value)
                    if (month.value === 'All') onDayChange('All')
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedMonth === month.value
                      ? 'bg-primary-500 text-white'
                      : 'bg-soft-white dark:bg-dark-700 text-muted-foreground hover:bg-gray-100 dark:hover:bg-dark-600'
                  }`}
                >
                  {month.label}
                </button>
              ))}
            </div>
          </div>

          {/* Day filter - only show when a month is selected */}
          {selectedMonth !== 'All' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                {t('news.filters.day')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {days.map(day => (
                  <button
                    key={day}
                    onClick={() => onDayChange(day)}
                    className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                      selectedDay === day
                        ? 'bg-primary-500 text-white'
                        : 'bg-soft-white dark:bg-dark-700 text-muted-foreground hover:bg-gray-100 dark:hover:bg-dark-600'
                    }`}
                  >
                    {day === 'All' ? '全' : day}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const pageStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Japanese News Reader - Doshi',
  description:
    'Read real Japanese news with furigana, vocabulary lookup, and comprehension quizzes',
  url: 'https://doshi.app/news',
}

export default function NewsPage() {
  const router = useRouter()
  const { t } = useI18n()
  const { user, loading: authLoading, isGuest, isAuthenticated } = useAuth()
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [filteredArticles, setFilteredArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState('All')
  const [selectedDay, setSelectedDay] = useState('All')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  // Article cache for offline prefetching
  const { prefetchArticles } = useArticleCache()
  const [prefetchStatus, setPrefetchStatus] = useState<'idle' | 'prefetching' | 'done'>('idle')

  // Load articles
  useEffect(() => {
    loadArticles()
  }, [])

  // Prefetch top articles for offline use after articles load
  useEffect(() => {
    if (articles.length > 0 && prefetchStatus === 'idle') {
      // Get IDs of first 10 articles to prefetch for offline
      const articleIds = articles.slice(0, 10).map(a => a.id)

      // Prefetch in background (don't await - fire and forget)
      setPrefetchStatus('prefetching')
      prefetchArticles(articleIds, { skipCached: true })
        .then(results => {
          console.log('[NewsPage] Offline prefetch complete:', results)
          setPrefetchStatus('done')
        })
        .catch(err => {
          console.warn('[NewsPage] Offline prefetch failed:', err)
          setPrefetchStatus('done')
        })
    }
  }, [articles, prefetchStatus, prefetchArticles])

  // Filter articles when filters change
  useEffect(() => {
    filterArticles()
  }, [articles, selectedMonth, selectedDay])

  // Handle redirect if no user after auth has loaded
  useEffect(() => {
    if (!authLoading && !user && !isGuest) {
      const timer = setTimeout(() => {
        router.push('/auth/signin')
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [authLoading, user, isGuest, router])

  const loadArticles = async (pageNum: number = 0) => {
    try {
      setLoading(true)
      setError(null)

      const offset = pageNum * 20
      const response = await fetch(`/api/news/articles?limit=20&offset=${offset}`)
      if (!response.ok) throw new Error('Failed to fetch articles')

      const data = await response.json()
      console.log('[NewsPage] API response:', data)
      setArticles(data.articles || data.data || [])
      setHasMore(data.hasMore || false)
      setPage(pageNum)
    } catch (err) {
      console.error('Failed to load articles:', err)
      setError('ニュース記事の読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const loadNextPage = () => {
    loadArticles(page + 1)
  }

  const loadPreviousPage = () => {
    if (page > 0) {
      loadArticles(page - 1)
    }
  }

  const filterArticles = () => {
    let filtered = [...articles]

    if (selectedMonth !== 'All') {
      const [filterYear, filterMonth] = selectedMonth.split('-').map(Number)

      filtered = filtered.filter(a => {
        const articleDate = new Date(a.publishDate)
        const articleYear = articleDate.getFullYear()
        const articleMonth = articleDate.getMonth() + 1

        // Check month match
        if (articleYear !== filterYear || articleMonth !== filterMonth) {
          return false
        }

        // Check day match if specified
        if (selectedDay !== 'All') {
          const articleDay = articleDate.getDate()
          return articleDay === parseInt(selectedDay, 10)
        }

        return true
      })
    }

    setFilteredArticles(filtered)
  }

  const handleArticleClick = (article: NewsArticle) => {
    // Navigate to article reader
    router.push(`/news/${article.id}`)
  }

  // Show loading state while auth is loading
  if (authLoading) {
    return <LoadingOverlay isLoading={true} message={t('common.loading')} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-background to-background-dark dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(pageStructuredData),
        }}
      />

      {/* Navbar */}
      {/* Navigation is now global - rendered in root layout */}

      {/* LearningPageHeader */}
      <LearningPageHeader
        title={t('news.title')}
        description={t('news.description')}
        mobileExtra={
          <div className="space-y-3">
            {/* Month filter pills */}
            <div>
              <label className="text-xs font-medium text-white/80 mb-2 block">
                {t('news.filters.month')}
              </label>
              <div className="flex flex-wrap gap-2">
                {getAvailableMonthsFromArticles(articles).map(month => (
                  <button
                    key={month.value}
                    onClick={() => {
                      setSelectedMonth(month.value)
                      if (month.value === 'All') setSelectedDay('All')
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      selectedMonth === month.value
                        ? 'bg-white text-primary-600 shadow-sm'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    {month.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Day filter - only show when month selected */}
            {selectedMonth !== 'All' && (
              <div>
                <label className="text-xs font-medium text-white/80 mb-2 block">
                  {t('news.filters.day')}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'All',
                    ...Array.from({ length: getDaysInMonth(selectedMonth) }, (_, i) =>
                      (i + 1).toString()
                    ),
                  ].map(day => (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                        selectedDay === day
                          ? 'bg-white text-primary-600 shadow-sm'
                          : 'bg-white/20 text-white hover:bg-white/30'
                      }`}
                    >
                      {day === 'All' ? '全' : day}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Refresh button */}
            <button
              onClick={() => loadArticles(0)}
              disabled={loading}
              className="w-full px-4 py-2 bg-white/90 text-primary-600 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
            >
              {loading ? t('news.loading') : t('news.refresh')}
            </button>
          </div>
        }
      />

      <div className="px-4 pb-20 max-w-7xl mx-auto">
        {/* Filter Bar - hidden on mobile (filters shown in header instead) */}
        <div className="hidden sm:block">
          <FilterBar
            selectedMonth={selectedMonth}
            selectedDay={selectedDay}
            onMonthChange={setSelectedMonth}
            onDayChange={setSelectedDay}
            onRefresh={() => loadArticles(0)}
            isLoading={loading}
            articles={articles}
          />
        </div>

        {/* Articles List */}
        <div className="space-y-3">
          {loading ? (
            // Loading skeletons
            <>
              <ArticleCardSkeleton />
              <ArticleCardSkeleton />
              <ArticleCardSkeleton />
            </>
          ) : error ? (
            // Error state
            <div className="bg-soft-white dark:bg-dark-850 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-8 text-center">
              <p className="text-danger-600 dark:text-danger-400 mb-4">{error}</p>
              <button
                onClick={() => loadArticles()}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                {t('common.retry')}
              </button>
            </div>
          ) : filteredArticles.length === 0 ? (
            // Empty state
            <div className="bg-soft-white dark:bg-dark-850 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-8 text-center">
              <div className="text-4xl mb-4">📰</div>
              <p className="text-muted-foreground dark:text-dark-400 mb-2">
                {t('news.noArticles')}
              </p>
              <p className="text-sm text-muted-foreground/70 dark:text-dark-500">
                {t('news.noArticlesHint')}
              </p>
            </div>
          ) : (
            // Articles
            filteredArticles.map(article => (
              <ArticleCard key={article.id} article={article} onClick={handleArticleClick} />
            ))
          )}
        </div>

        {/* Pagination Buttons */}
        {!loading && (page > 0 || hasMore) && (
          <div className="mt-6 mb-8 flex justify-center items-center gap-4">
            {/* Previous Page Button */}
            {page > 0 && (
              <button
                onClick={loadPreviousPage}
                className="group flex items-center gap-2 px-4 py-3 bg-soft-white dark:bg-dark-850 border border-gray-200 dark:border-dark-700 text-foreground dark:text-dark-100 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-800 transition-all shadow-sm hover:shadow-md"
                aria-label="Previous page"
              >
                <svg
                  className="w-5 h-5 transition-transform group-hover:-translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}

            {/* Page Indicator */}
            <span className="text-sm text-muted-foreground dark:text-dark-400">
              {t('news.page')} {page + 1}
            </span>

            {/* Next Page Button */}
            {hasMore && (
              <button
                onClick={loadNextPage}
                className="group flex items-center gap-2 px-4 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-all shadow-sm hover:shadow-md"
                aria-label="Next page"
              >
                <svg
                  className="w-5 h-5 transition-transform group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
