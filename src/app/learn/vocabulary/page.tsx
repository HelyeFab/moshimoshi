'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { LoadingOverlay } from '@/components/ui/Loading'
import { useI18n } from '@/i18n/I18nContext'
import { motion } from 'framer-motion'
import Navbar from '@/components/layout/Navbar'
import VocabularySearch from './components/VocabularySearch'
import WordDetailsModal from './components/WordDetailsModal'
import SearchHistory from './components/SearchHistory'
import { searchWords, initWanikaniApi } from '@/utils/api'
import { searchJMdictWords, loadJMdictData } from '@/utils/jmdictLocalSearch'
import type { JapaneseWord } from '@/types/vocabulary'
import { useSubscription } from '@/hooks/useSubscription'
import { vocabularyHistoryManager } from '@/utils/vocabularyHistoryManager'

function VocabularyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { strings } = useI18n()
  const { showToast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { isPremium } = useSubscription()

  // Check if we're in review mode from Review Hub
  const isReviewMode = searchParams.get('mode') === 'review'
  const returnTo = searchParams.get('returnTo') || '/dashboard'

  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<JapaneseWord[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedWord, setSelectedWord] = useState<JapaneseWord | null>(null)
  const [searchHistory, setSearchHistory] = useState<Array<{
    term: string
    timestamp: Date
    resultCount: number
  }>>([])
  const [searchSource, setSearchSource] = useState<'wanikani' | 'jmdict'>('jmdict')
  const [isLoadingCache, setIsLoadingCache] = useState(false)

  // Check session on mount
  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      // Check if this is a guest user
      const isGuest = sessionStorage.getItem('isGuestUser') === 'true'

      if (isGuest) {
        setUser({
          uid: 'guest',
          email: 'guest@user',
          displayName: 'Guest User',
          isGuest: true,
          tier: 'guest'
        })
        setLoading(false)
        return
      }

      // Check for authenticated user
      const response = await fetch('/api/auth/session')
      const data = await response.json()

      if (data.authenticated) {
        setUser(data.user)
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to check session:', error)
      setLoading(false)
    }
  }

  // Load saved search source preference after mount
  useEffect(() => {
    const saved = localStorage.getItem('vocab_search_source') as 'wanikani' | 'jmdict'
    if (saved) {
      setSearchSource(saved)
    }
  }, [])

  // Initialize APIs on mount
  useEffect(() => {
    initWanikaniApi()
    if (searchSource === 'jmdict') {
      loadJMdictData()
    }
  }, [searchSource])

  // Load search history using the manager
  useEffect(() => {
    const loadHistory = async () => {
      const history = await vocabularyHistoryManager.loadHistory(user, isPremium)
      setSearchHistory(history)
    }

    if (user !== undefined) {
      loadHistory()
    }
  }, [user, isPremium])

  // Save search source preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vocab_search_source', searchSource)
    }
  }, [searchSource])

  const handleSearch = async (term: string) => {
    if (!term.trim()) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      let results: JapaneseWord[] = []

      if (searchSource === 'wanikani') {
        try {
          // Check if this is the first search (cache might need to be populated)
          const isFirstSearch = !localStorage.getItem('wanikani_cache_populated')
          if (isFirstSearch) {
            setIsLoadingCache(true)
            showToast(strings.common?.loading || 'Loading WaniKani vocabulary database...', 'info')
          }

          results = await searchWords(term, 30)

          // Mark cache as populated after successful first search
          if (isFirstSearch) {
            localStorage.setItem('wanikani_cache_populated', 'true')
            setIsLoadingCache(false)
          }
        } catch (wanikaniError: any) {
          setIsLoadingCache(false)
          // If WaniKani fails (403 = invalid API key), fall back to JMdict
          console.error('WaniKani search failed:', wanikaniError)

          // Check if it's mock data error
          if (wanikaniError?.message?.includes('mock data')) {
            showToast(strings.reviewPrompts?.vocabulary?.wanikaniMockData || 'WaniKani API configuration error', 'error')
            // Don't auto-switch, let user decide
            results = []
          } else if (wanikaniError?.response?.status === 403 || wanikaniError?.response?.status === 401) {
            showToast(strings.reviewPrompts?.vocabulary?.wanikaniInvalidKey || 'WaniKani API key invalid', 'error')
            results = []
          } else if (wanikaniError?.response?.status === 503) {
            showToast(strings.reviewPrompts?.vocabulary?.wanikaniServiceDown || 'WaniKani service unavailable', 'warning')
            results = []
          } else {
            // For other errors, offer to fall back
            showToast(strings.reviewPrompts?.vocabulary?.wanikaniSearchFailed || 'WaniKani search failed', 'warning')
            setSearchSource('jmdict')
            // Fall back to JMdict
            results = await searchJMdictWords(term, 30)
          }
        }
      } else {
        results = await searchJMdictWords(term, 30)
      }

      setSearchResults(results)

      // Save search using the manager (handles localStorage and Firebase for premium)
      await vocabularyHistoryManager.saveSearch(
        term,
        results.length,
        searchSource,
        user,
        isPremium
      )

      // Reload history to show the new entry
      const updatedHistory = await vocabularyHistoryManager.loadHistory(user, isPremium)
      setSearchHistory(updatedHistory)

      if (results.length === 0) {
        showToast(strings.reviewPrompts?.vocabulary?.noResultsFound || 'No results found. Try a different search term.', 'info')
      }
    } catch (error) {
      console.error('Search error:', error)
      showToast(strings.reviewPrompts?.vocabulary?.searchFailed || 'Failed to search. Please try again.', 'error')
    } finally {
      setSearching(false)
    }
  }

  const handleWordClick = async (word: JapaneseWord) => {
    setSelectedWord(word)

    // Track clicked result for premium users
    if (searchTerm && user && isPremium) {
      await vocabularyHistoryManager.trackResultClick(
        searchTerm,
        word.word || word.japanese,
        user,
        isPremium
      )
    }
  }

  const handleSearchHistoryClick = (term: string) => {
    setSearchTerm(term)
    handleSearch(term)
  }

  const clearSearchHistory = async () => {
    await vocabularyHistoryManager.clearHistory(user, isPremium)
    setSearchHistory([])
    showToast(strings.reviewPrompts?.vocabulary?.searchHistoryCleared || 'Search history cleared', 'success')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      {/* Navbar */}
      <Navbar user={user} showUserMenu={true} />

      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-6xl">
        {/* Page Title */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {strings.reviewPrompts?.vocabulary?.searchTitle || 'Vocabulary Search'}
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            {strings.reviewPrompts?.vocabulary?.searchDescription || 'Search Japanese words with meanings and examples'}
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Search Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search Source Toggle */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {strings.reviewPrompts?.vocabulary?.searchSource || 'Search Source:'}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSearchSource('jmdict')}
                    className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      searchSource === 'jmdict'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                    }`}
                  >
                    {strings.reviewPrompts?.vocabulary?.searchSourceJMDict || 'JMDict (Offline)'}
                  </button>
                  <button
                    onClick={() => setSearchSource('wanikani')}
                    className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      searchSource === 'wanikani'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                    }`}
                  >
                    {strings.reviewPrompts?.vocabulary?.searchSourceWaniKani || 'WaniKani'}
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Search Component */}
            <VocabularySearch
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onSearch={handleSearch}
              searching={searching || isLoadingCache}
            />

            {/* Cache Loading Indicator */}
            {isLoadingCache && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {strings.reviewPrompts?.vocabulary?.loadingCache || 'Loading WaniKani vocabulary database for the first time... This may take a moment.'}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-6"
              >
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  {(strings.reviewPrompts?.vocabulary?.searchResultsCount || 'Search Results ({{count}})').replace('{{count}}', searchResults.length.toString())}
                </h2>
                <div className="space-y-3 max-h-[400px] sm:max-h-[600px] overflow-y-auto">
                  {searchResults.map((word, index) => (
                    <motion.div
                      key={`${word.id}-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleWordClick(word)}
                      className="p-3 sm:p-4 bg-gray-50 dark:bg-dark-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            {word.kanji && (
                              <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100"
                                    style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                                {word.kanji}
                              </span>
                            )}
                            <span className="text-base sm:text-lg text-gray-700 dark:text-gray-300">
                              {word.kana}
                            </span>
                            {word.jlpt && (
                              <span className="px-2 py-0.5 sm:py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded">
                                {word.jlpt}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                            {word.meaning}
                          </p>
                          {word.type && (
                            <span className="inline-block mt-2 px-2 py-1 bg-gray-200 dark:bg-dark-600 text-gray-700 dark:text-gray-300 text-xs rounded">
                              {word.type}
                            </span>
                          )}
                        </div>
                        <button className="text-primary-500 hover:text-primary-600 flex-shrink-0 ml-2">
                          <span className="text-lg sm:text-xl">→</span>
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Sidebar with Search History - Hidden on mobile, shown in accordion on small screens */}
          <div className="hidden lg:block space-y-6">
            <SearchHistory
              history={searchHistory}
              onHistoryClick={handleSearchHistoryClick}
              onClear={clearSearchHistory}
            />
          </div>
        </div>

        {/* Mobile Search History - Shown below main content on mobile */}
        <div className="lg:hidden mt-6">
          <SearchHistory
            history={searchHistory}
            onHistoryClick={handleSearchHistoryClick}
            onClear={clearSearchHistory}
          />
        </div>
      </div>

      {/* Word Details Modal */}
      {selectedWord && (
        <WordDetailsModal
          word={selectedWord}
          isOpen={!!selectedWord}
          onClose={() => setSelectedWord(null)}
          user={user}
        />
      )}
    </div>
  )
}

export default function VocabularyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <LoadingOverlay isLoading={true} message="Loading vocabulary search..." showDoshi={true} />
      </div>
    }>
      <VocabularyContent />
    </Suspense>
  )
}