'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { LoadingOverlay } from '@/components/ui/Loading'
import { useI18n } from '@/i18n/I18nContext'
import { motion } from 'framer-motion'
// Navigation is now global via NavigationWrapper in root layout
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
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
  const [searchHistory, setSearchHistory] = useState<
    Array<{
      term: string
      timestamp: Date
      resultCount: number
    }>
  >([])
  const [searchSource, setSearchSource] = useState<'wanikani' | 'jmdict'>('jmdict')
  const [isLoadingCache, setIsLoadingCache] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ term: string; timestamp: Date } | null>(null)

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
          tier: 'guest',
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
      const history = await vocabularyHistoryManager.loadHistory(user, isPremium ?? false)
      setSearchHistory(history)
    }

    // Only load history if user is actually logged in
    if (user && user.uid) {
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
      let usedFallback = false
      let actualSource: 'wanikani' | 'jmdict' = searchSource // Track actual source used

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

          // Fallback to JMDict if no results
          if (results.length === 0) {
            showToast('No results from WaniKani, trying JMDict...', 'info')
            results = await searchJMdictWords(term, 30)
            actualSource = 'jmdict' // Update actual source
            usedFallback = true
          }
        } catch (wanikaniError: any) {
          setIsLoadingCache(false)
          console.error('WaniKani search failed:', wanikaniError)

          // Always fallback to JMDict on error
          showToast('WaniKani unavailable, trying JMDict...', 'info')
          results = await searchJMdictWords(term, 30)
          actualSource = 'jmdict' // Update actual source
          usedFallback = true
        }
      } else {
        // Using JMDict as primary
        try {
          results = await searchJMdictWords(term, 30)

          // Fallback to WaniKani if no results
          if (results.length === 0) {
            showToast('No results from JMDict, trying WaniKani...', 'info')
            try {
              results = await searchWords(term, 30)
              actualSource = 'wanikani' // Update actual source
              usedFallback = true
            } catch (wanikaniError) {
              console.error('WaniKani fallback failed:', wanikaniError)
              // If WaniKani fallback also fails, results stay empty
            }
          }
        } catch (jmdictError) {
          console.error('JMDict search failed:', jmdictError)

          // Fallback to WaniKani on error
          showToast('JMDict unavailable, trying WaniKani...', 'info')
          try {
            results = await searchWords(term, 30)
            actualSource = 'wanikani' // Update actual source
            usedFallback = true
          } catch (wanikaniError) {
            console.error('WaniKani fallback failed:', wanikaniError)
            // Both failed, show error
            showToast('Failed to search. Please try again.', 'error')
          }
        }
      }

      setSearchResults(results)

      // Save search using the manager (handles localStorage and Firebase for premium)
      // Use actualSource to record which provider really returned the results
      await vocabularyHistoryManager.saveSearch(
        term,
        results.length,
        actualSource,
        user,
        isPremium ?? false
      )

      // Reload history to show the new entry
      const updatedHistory = await vocabularyHistoryManager.loadHistory(user, isPremium ?? false)
      setSearchHistory(updatedHistory)

      if (results.length === 0 && !usedFallback) {
        showToast('No results found. Try a different search term.', 'info')
      }
    } catch (error) {
      console.error('Search error:', error)
      showToast('Failed to search. Please try again.', 'error')
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
        word.kanji || word.kana,
        user,
        isPremium ?? false
      )
    }
  }

  const handleSearchHistoryClick = (term: string) => {
    setSearchTerm(term)
    handleSearch(term)
  }

  const clearSearchHistory = async () => {
    await vocabularyHistoryManager.clearHistory(user, isPremium ?? false)
    setSearchHistory([])
    showToast('Search history cleared', 'success')
  }

  const handleDeleteHistoryItem = (term: string, timestamp: Date) => {
    setItemToDelete({ term, timestamp })
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteHistoryItem = async () => {
    if (!itemToDelete) return

    try {
      await vocabularyHistoryManager.deleteHistoryEntry(
        itemToDelete.term,
        itemToDelete.timestamp,
        user,
        isPremium ?? false
      )

      // Reload history to show the updated list
      const updatedHistory = await vocabularyHistoryManager.loadHistory(user, isPremium ?? false)
      setSearchHistory(updatedHistory)

      showToast('Search entry deleted', 'success')
    } catch (error) {
      console.error('Failed to delete search entry:', error)
      showToast('Failed to delete entry', 'error')
    } finally {
      setDeleteConfirmOpen(false)
      setItemToDelete(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      {/* Navbar */}
      {/* Navigation is now global - rendered in root layout */}

      {/* Page Header */}
      <PageHeader
        title={strings.vocabulary?.title || 'Vocabulary'}
        description={strings.vocabulary?.description || 'Search and explore Japanese vocabulary'}
        showDoshi
      />

      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-6xl">
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
                  Search Source:
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
                    JMDict (Offline)
                  </button>
                  <button
                    onClick={() => setSearchSource('wanikani')}
                    className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      searchSource === 'wanikani'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                    }`}
                  >
                    WaniKani
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
                    Loading WaniKani vocabulary database for the first time... This may take a
                    moment.
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
                  {`Search Results (${searchResults.length})`}
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
                              <span
                                className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100"
                                style={{
                                  fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif',
                                }}
                              >
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
              onDeleteItem={handleDeleteHistoryItem}
            />
          </div>
        </div>

        {/* Mobile Search History - Shown below main content on mobile */}
        <div className="lg:hidden mt-6">
          <SearchHistory
            history={searchHistory}
            onHistoryClick={handleSearchHistoryClick}
            onClear={clearSearchHistory}
            onDeleteItem={handleDeleteHistoryItem}
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Delete Search Entry"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete this search entry?
          </p>
          {itemToDelete && (
            <div className="p-3 bg-gray-100 dark:bg-dark-700 rounded-lg">
              <p className="font-medium text-gray-900 dark:text-gray-100">{itemToDelete.term}</p>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setDeleteConfirmOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              {strings.common?.cancel || 'Cancel'}
            </button>
            <button
              onClick={confirmDeleteHistoryItem}
              className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-lg transition-colors"
            >
              {strings.common?.delete || 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function VocabularyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <LoadingOverlay
            isLoading={true}
            message="Loading vocabulary search..."
            showDoshi={true}
          />
        </div>
      }
    >
      <VocabularyContent />
    </Suspense>
  )
}
