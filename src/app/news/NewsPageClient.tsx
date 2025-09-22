/**
 * Enhanced News Page Client Component
 * Includes pagination, stats, filters, and all missing features
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  Newspaper, Calendar, Clock, Tag, ChevronRight, ChevronLeft, 
  RefreshCw, Filter, X, BarChart3, Globe, BookOpen, TrendingUp,
  Lock, User, Search, ChevronDown, ChevronUp
} from 'lucide-react'
import { NewsArticle } from '@/types/news'
import { useUser } from '@/contexts/UserContext'
import { useEntitlements } from '@/hooks/useEntitlements'
import { newsService, DifficultyLevel, NewsCategory, NewsSource } from '@/services/newsService'
import { AddToReviewButton } from '@/components/review/AddToReviewButton'
import { rdaTrack, trackScreen } from '@/lib/rda'
import { cn } from '@/utils/cn'

const ARTICLES_PER_PAGE = 12

export default function NewsPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const { hasFeatureAccess, getRemaining } = useEntitlements()
  
  // State
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalArticles, setTotalArticles] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  
  // Filters
  const [selectedSource, setSelectedSource] = useState<NewsSource>('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('all')
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  
  // Stats
  const [stats, setStats] = useState({
    totalArticles: 0,
    lastUpdated: null as Date | null,
    articlesBySource: {} as Record<string, number>,
    articlesByDifficulty: {} as Record<string, number>
  })
  
  // Usage tracking
  const [articlesRead, setArticlesRead] = useState(0)
  const articlesLimit = useMemo(() => {
    if (!user) return 3 // Guest limit
    if (user.subscriptionType === 'premium') return Infinity
    return 10 // Free user limit
  }, [user])
  
  // Check for review mode
  const isReviewMode = searchParams.get('mode') === 'review'

  // Load articles
  const loadArticles = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      setError(null)
      
      const offset = (page - 1) * ARTICLES_PER_PAGE
      const result = await newsService.getArticles({
        source: selectedSource,
        difficulty: selectedDifficulty,
        category: selectedCategory,
        limit: ARTICLES_PER_PAGE,
        offset,
        searchQuery: searchQuery || undefined
      })
      
      setArticles(result.articles)
      setTotalArticles(result.totalCount)
      setHasMore(result.hasMore)
      setCurrentPage(page)
    } catch (err) {
      console.error('Error loading articles:', err)
      setError('Failed to load articles')
    } finally {
      setLoading(false)
    }
  }, [selectedSource, selectedDifficulty, selectedCategory, searchQuery])

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const statsData = await newsService.getStats()
      setStats(statsData)
    } catch (err) {
      console.error('Error loading stats:', err)
    }
  }, [])

  // Track screen view
  useEffect(() => {
    trackScreen('news_page', document.referrer)
  }, [])

  // Load initial data
  useEffect(() => {
    loadArticles(1)
    loadStats()
  }, [loadArticles, loadStats])

  // Trigger scraping
  const triggerScraping = async () => {
    try {
      setRefreshing(true)
      const success = await newsService.triggerScraping(selectedSource === 'all' ? 'nhk-easy' : selectedSource)
      
      if (success) {
        await loadArticles(currentPage)
        await loadStats()
      }
    } catch (err) {
      console.error('Error scraping news:', err)
      setError('Failed to scrape new articles')
    } finally {
      setRefreshing(false)
    }
  }

  // Handle article click
  const handleArticleClick = (article: NewsArticle) => {
    // Check usage limits
    if (articlesRead >= articlesLimit) {
      // Show upgrade modal
      rdaTrack({
        event_name: 'feature_used',
        payload: {
          feature: 'news_reader',
          action: 'limit_reached',
          extra: { articles_read: articlesRead, limit: articlesLimit }
        }
      })
      return
    }
    
    // Track article read
    newsService.markArticleRead(article.id)
    setArticlesRead(prev => prev + 1)
    
    // Navigate to article
    router.push(`/news/${article.id}${isReviewMode ? '?mode=review' : ''}`)
  }

  // Pagination
  const totalPages = Math.ceil(totalArticles / ARTICLES_PER_PAGE)
  
  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return
    loadArticles(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Format date
  const formatDate = (date: Date | string) => {
    const d = new Date(date)
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Get difficulty color
  const getDifficultyColor = (difficulty: string) => {
    const colors = {
      N5: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
      N4: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
      N3: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
      N2: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
      N1: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
    }
    return colors[difficulty as keyof typeof colors] || colors.N3
  }

  // Convert article to review item
  const convertArticleToReviewItem = (article: NewsArticle) => ({
    type: 'custom' as const,
    id: article.id,
    content: article.title,
    data: {
      title: article.title,
      content: article.content,
      difficulty: article.difficulty,
      source: article.source
    }
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Stats */}
      <div className="bg-card border-b border-border">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Newspaper className="w-8 h-8 text-primary" />
                Japanese News Reader
              </h1>
              <p className="text-muted-foreground mt-2">
                Read real Japanese news articles adapted for learners
              </p>
            </div>
            
            {/* Stats Summary */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Total:</span>
                <span className="font-semibold">{stats.totalArticles}</span>
              </div>
              
              {stats.lastUpdated && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Updated:</span>
                  <span>{formatDate(stats.lastUpdated)}</span>
                </div>
              )}
              
              {user && (
                <div className="flex items-center gap-2 text-sm">
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Read today:</span>
                  <span className={cn(
                    "font-semibold",
                    articlesRead >= articlesLimit && "text-destructive"
                  )}>
                    {articlesRead}/{articlesLimit === Infinity ? '∞' : articlesLimit}
                  </span>
                </div>
              )}
              
              <button
                onClick={triggerScraping}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-muted/50 border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-4">
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filters
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {/* Expandable Filter Panel */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search articles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                
                {/* Source Filter */}
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value as NewsSource)}
                  className="px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Sources</option>
                  <option value="nhk-easy">NHK Easy</option>
                  <option value="watanoc">Watanoc</option>
                  <option value="todaii">Todaii</option>
                  <option value="mainichi">Mainichi</option>
                </select>
                
                {/* Difficulty Filter */}
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value as DifficultyLevel)}
                  className="px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Levels</option>
                  <option value="N5">N5 (Beginner)</option>
                  <option value="N4">N4 (Elementary)</option>
                  <option value="N3">N3 (Intermediate)</option>
                  <option value="N2">N2 (Advanced)</option>
                  <option value="N1">N1 (Expert)</option>
                </select>
                
                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as NewsCategory)}
                  className="px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Categories</option>
                  <option value="general">General</option>
                  <option value="culture">Culture</option>
                  <option value="technology">Technology</option>
                  <option value="business">Business</option>
                  <option value="sports">Sports</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {loading && !refreshing ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-destructive mb-4">{error}</p>
            <button
              onClick={() => loadArticles(currentPage)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20">
            <Newspaper className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No articles found</p>
            <button
              onClick={triggerScraping}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Fetch New Articles
            </button>
          </div>
        ) : (
          <>
            {/* Articles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article) => (
                <article
                  key={article.id}
                  className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition-all group"
                >
                  {/* Article Thumbnail */}
                  {article.thumbnail && (
                    <div className="relative h-48 bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
                      <img
                        src={article.thumbnail}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    </div>
                  )}
                  
                  <div className="p-4">
                    {/* Meta Info */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn(
                        "px-2 py-0.5 text-xs rounded",
                        getDifficultyColor(article.difficulty || 'N3')
                      )}>
                        {article.difficulty || 'N3'}
                      </span>
                      {article.category && (
                        <span className="px-2 py-0.5 text-xs bg-muted rounded">
                          {article.category}
                        </span>
                      )}
                      {article.source && (
                        <span className="px-2 py-0.5 text-xs bg-muted rounded flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {article.source}
                        </span>
                      )}
                    </div>
                    
                    {/* Title */}
                    <h3 className="font-semibold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                      {article.title}
                    </h3>
                    
                    {/* Summary */}
                    {article.summary && (
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                        {article.summary}
                      </p>
                    )}
                    
                    {/* Date */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <Calendar className="w-3 h-3" />
                      {formatDate(article.publishedAt)}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleArticleClick(article)}
                        className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        Read Article
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      
                      {user && (
                        <AddToReviewButton
                          item={convertArticleToReviewItem(article)}
                          size="sm"
                        />
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={cn(
                          "w-10 h-10 rounded-lg transition-colors",
                          pageNum === currentPage
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        )}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Usage Limit Warning */}
      {articlesRead >= articlesLimit && (
        <div className="fixed bottom-4 right-4 max-w-sm bg-card border border-border rounded-lg shadow-lg p-4">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Article limit reached</p>
              <p className="text-sm text-muted-foreground mt-1">
                {user ? 'Upgrade to Premium for unlimited access' : 'Sign in to read more articles'}
              </p>
              <button
                onClick={() => router.push(user ? '/pricing' : '/login')}
                className="mt-2 text-sm text-primary hover:text-primary/80 font-medium"
              >
                {user ? 'Upgrade Now' : 'Sign In'} →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}