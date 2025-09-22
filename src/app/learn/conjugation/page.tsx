'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import LearningPageHeader from '@/components/learn/LearningPageHeader'
import { LoadingOverlay } from '@/components/ui/Loading'
import { ConjugationDisplay } from '@/components/conjugation/ConjugationDisplay'
import { getRandomConjugatableWords, preloadConjugatableWords } from '@/utils/jmdictLocalSearch'
import { JapaneseWord } from '@/types/vocabulary'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n/I18nContext'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, RefreshCw, BookOpen, Filter, Shuffle, Settings, ChevronDown, Search, X } from 'lucide-react'
import { enhanceWordWithType } from '@/utils/enhancedWordTypeDetection'

type ViewMode = 'browse' | 'study' | 'review'
type WordFilter = 'all' | 'verbs' | 'adjectives'

export default function ConjugationPracticePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t, strings } = useI18n()

  const [viewMode, setViewMode] = useState<ViewMode>('browse')
  const [loading, setLoading] = useState(true)
  const [practiceWords, setPracticeWords] = useState<JapaneseWord[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [wordFilter, setWordFilter] = useState<WordFilter>('all')
  const [showConjugations, setShowConjugations] = useState(true)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set())
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<JapaneseWord[]>([])

  // Preload cache on component mount
  useEffect(() => {
    // Start preloading in the background
    preloadConjugatableWords().catch(console.error)
  }, [])

  // Load practice words
  useEffect(() => {
    loadPracticeWords()
  }, [wordFilter])

  const loadPracticeWords = async () => {
    setLoading(true)
    try {
      const words = await getRandomConjugatableWords(wordFilter, 20)
      setPracticeWords(words)
      setCurrentIndex(0)
      setSelectedWords(new Set())
    } catch (error) {
      console.error('Failed to load practice words:', error)
    } finally {
      setLoading(false)
    }
  }

  const currentWord = useMemo(() => {
    return practiceWords[currentIndex] || null
  }, [practiceWords, currentIndex])

  const handleToggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  const handleExpandAll = () => {
    // This will be populated when ConjugationDisplay renders
    // For now, we'll create all possible group IDs
    const allGroups = new Set<string>()
    // Verbs have many groups, adjectives have 4
    const maxGroups = 30 // Conservative estimate
    for (let i = 0; i < maxGroups; i++) {
      allGroups.add(`Stems-${i}`)
      allGroups.add(`Plain Form-${i}`)
      allGroups.add(`Polite Form-${i}`)
      allGroups.add(`Basic Forms-${i}`)
      allGroups.add(`Polite Forms-${i}`)
      allGroups.add(`Conditional Forms-${i}`)
      allGroups.add(`Presumptive Forms-${i}`)
    }
    setExpandedGroups(allGroups)
  }

  const handleCollapseAll = () => {
    setExpandedGroups(new Set())
  }

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setIsSearching(false)
      setSearchResults([])
      return
    }

    setLoading(true)
    setIsSearching(true)
    try {
      // Search using local JMdict with the same algorithm as vocabulary page
      const { searchJMdictWords } = await import('@/utils/jmdictLocalSearch')
      const results = await searchJMdictWords(searchTerm, 50)

      // Filter for conjugatable words only
      const conjugatable = results.filter(word => {
        const enhanced = enhanceWordWithType(word)
        return enhanced.isConjugatable
      })

      setSearchResults(conjugatable)
      setPracticeWords(conjugatable)
      setCurrentIndex(0)
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleClearSearch = () => {
    setSearchTerm('')
    setIsSearching(false)
    setSearchResults([])
    loadPracticeWords() // Reload random words
  }

  const stats = useMemo(() => ({
    total: practiceWords.length,
    current: currentIndex + 1,
    selected: selectedWords.size,
    verbs: practiceWords.filter(w => {
      const enhanced = enhanceWordWithType(w)
      return enhanced.conjugationType === 'Godan' ||
             enhanced.conjugationType === 'Ichidan' ||
             enhanced.conjugationType === 'Irregular'
    }).length,
    adjectives: practiceWords.filter(w => {
      const enhanced = enhanceWordWithType(w)
      return enhanced.conjugationType === 'i-adjective' ||
             enhanced.conjugationType === 'na-adjective'
    }).length
  }), [practiceWords, currentIndex, selectedWords])

  const handleNext = () => {
    if (currentIndex < practiceWords.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setShowConjugations(true)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setShowConjugations(true)
    }
  }

  const handleShuffle = () => {
    const shuffled = [...practiceWords].sort(() => Math.random() - 0.5)
    setPracticeWords(shuffled)
    setCurrentIndex(0)
    setShowConjugations(true)
  }

  const handleToggleSelection = (wordId: string) => {
    const newSelected = new Set(selectedWords)
    if (newSelected.has(wordId)) {
      newSelected.delete(wordId)
    } else {
      newSelected.add(wordId)
    }
    setSelectedWords(newSelected)
  }

  const handleStartReview = () => {
    if (selectedWords.size > 0) {
      // Filter to only selected words
      const selected = practiceWords.filter(w => selectedWords.has(w.id))
      setPracticeWords(selected)
      setCurrentIndex(0)
      setSelectedWords(new Set())
      setSelectionMode(false)
      setViewMode('review')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingOverlay isLoading={true} message={t('common.loading')} showDoshi={true} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sakura-50 to-white dark:from-gray-900 dark:to-gray-800">
      <Navbar user={user} showUserMenu={true} />

      <LearningPageHeader
        title={t('conjugation.practiceTitle')}
        description={t('conjugation.practiceDescription')}
        mode={viewMode}
        onModeChange={setViewMode}
        stats={stats}
        selectionMode={selectionMode}
        onToggleSelection={() => setSelectionMode(!selectionMode)}
        onStartReview={handleStartReview}
        selectedCount={selectedWords.size}
      />

      <div className="container mx-auto px-4 py-6">
        {/* Search Bar */}
        <div className="mb-6">
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('conjugation.searchPlaceholder')}
                className="w-full px-4 py-2 pr-10 rounded-lg bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              {t('conjugation.searchButton')}
            </button>
          </form>

          {isSearching && searchResults.length === 0 && !loading && (
            <div className="mt-4 text-center text-gray-500 dark:text-gray-400">
              {t('conjugation.noSearchResults')}
            </div>
          )}

          {isSearching && searchResults.length > 0 && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {t('conjugation.searchResults')}: {searchResults.length}
            </div>
          )}
        </div>

        {/* Settings Dropdown */}
        <div className="mb-6 flex justify-end">
          <div className="relative">
            <button
              onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
              className="px-4 py-2 rounded-lg bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              {t('conjugation.settings')}
              <ChevronDown className={`w-4 h-4 transition-transform ${showSettingsDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showSettingsDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-dark-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-700 z-50">
                {/* Filter Section */}
                <div className="border-b border-gray-200 dark:border-dark-700 p-2">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 py-1">
                    {t('common.filter')}
                  </div>
                  <button
                    onClick={() => {
                      setWordFilter('all')
                      setShowSettingsDropdown(false)
                    }}
                    className={`w-full text-left px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors ${
                      wordFilter === 'all' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {t('conjugation.filters.all')}
                  </button>
                  <button
                    onClick={() => {
                      setWordFilter('verbs')
                      setShowSettingsDropdown(false)
                    }}
                    className={`w-full text-left px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors ${
                      wordFilter === 'verbs' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {t('conjugation.filters.verbs')}
                  </button>
                  <button
                    onClick={() => {
                      setWordFilter('adjectives')
                      setShowSettingsDropdown(false)
                    }}
                    className={`w-full text-left px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors ${
                      wordFilter === 'adjectives' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {t('conjugation.filters.adjectives')}
                  </button>
                </div>

                {/* Actions Section */}
                <div className="border-b border-gray-200 dark:border-dark-700 p-2">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 py-1">
                    {t('common.actions')}
                  </div>
                  <button
                    onClick={() => {
                      handleShuffle()
                      setShowSettingsDropdown(false)
                    }}
                    className="w-full text-left px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors text-gray-700 dark:text-gray-300"
                  >
                    <Shuffle className="w-4 h-4 inline mr-2" />
                    {t('conjugation.actions.shuffle')}
                  </button>
                  <button
                    onClick={() => {
                      loadPracticeWords()
                      setShowSettingsDropdown(false)
                    }}
                    className="w-full text-left px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors text-gray-700 dark:text-gray-300"
                  >
                    <RefreshCw className="w-4 h-4 inline mr-2" />
                    {t('conjugation.actions.loadNew')}
                  </button>
                </div>

                {/* Display Controls Section */}
                <div className="p-2">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 py-1">
                    {t('common.display')}
                  </div>
                  <button
                    onClick={() => {
                      handleExpandAll()
                      setShowSettingsDropdown(false)
                    }}
                    className="w-full text-left px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors text-gray-700 dark:text-gray-300"
                  >
                    {t('conjugation.expandAll')}
                  </button>
                  <button
                    onClick={() => {
                      handleCollapseAll()
                      setShowSettingsDropdown(false)
                    }}
                    className="w-full text-left px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors text-gray-700 dark:text-gray-300"
                  >
                    {t('conjugation.collapseAll')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        {viewMode === 'browse' && (
          <div className="max-w-4xl mx-auto">
            {/* Navigation Controls */}
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className={`p-3 rounded-lg transition-colors ${
                  currentIndex === 0
                    ? 'bg-gray-100 dark:bg-dark-700 text-gray-400 cursor-not-allowed'
                    : 'bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="text-center">
                <span className="text-lg font-medium text-gray-700 dark:text-gray-300">
                  {currentIndex + 1} / {practiceWords.length}
                </span>
              </div>

              <button
                onClick={handleNext}
                disabled={currentIndex === practiceWords.length - 1}
                className={`p-3 rounded-lg transition-colors ${
                  currentIndex === practiceWords.length - 1
                    ? 'bg-gray-100 dark:bg-dark-700 text-gray-400 cursor-not-allowed'
                    : 'bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700'
                }`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Word Display with Animation */}
            <AnimatePresence mode="wait">
              {currentWord && (
                <motion.div
                  key={currentWord.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Selection Checkbox */}
                  {selectionMode && (
                    <div className="mb-4 flex items-center justify-center">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedWords.has(currentWord.id)}
                          onChange={() => handleToggleSelection(currentWord.id)}
                          className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-gray-700 dark:text-gray-300">
                          {t('conjugation.actions.selectForReview')}
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Conjugation Display */}
                  <ConjugationDisplay
                    word={currentWord}
                    showFurigana={false}
                    expandedGroups={expandedGroups}
                    onToggleGroup={handleToggleGroup}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {viewMode === 'study' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg p-8">
              <div className="text-center space-y-4">
                <BookOpen className="w-16 h-16 mx-auto text-primary-500" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {t('conjugation.studyMode.title')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {t('conjugation.studyMode.description')}
                </p>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
                    <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {stats.verbs}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {t('conjugation.stats.verbs')}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
                    <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {stats.adjectives}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {t('conjugation.stats.adjectives')}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setViewMode('browse')}
                  className="mt-6 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  {t('conjugation.studyMode.startStudying')}
                </button>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'review' && (
          <div className="max-w-4xl mx-auto">
            {currentWord ? (
              <>
                {/* Progress Bar */}
                <div className="mb-6 bg-gray-200 dark:bg-dark-700 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all"
                    style={{ width: `${((currentIndex + 1) / practiceWords.length) * 100}%` }}
                  />
                </div>

                {/* Review Card */}
                <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg p-8">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                      {t('conjugation.reviewMode.practiceConjugation')}
                    </h3>
                    <p className="text-4xl font-bold text-primary-600 dark:text-primary-400 japanese-text">
                      {currentWord.kanji || currentWord.kana}
                    </p>
                    <p className="text-xl text-gray-600 dark:text-gray-400 mt-2">
                      {currentWord.meaning}
                    </p>
                  </div>

                  <button
                    onClick={() => setShowConjugations(!showConjugations)}
                    className="w-full mb-6 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    {showConjugations ? t('conjugation.actions.hideConjugations') : t('conjugation.actions.showConjugations')}
                  </button>

                  <AnimatePresence>
                    {showConjugations && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <ConjugationDisplay
                          word={currentWord}
                          showFurigana={false}
                          expandedGroups={expandedGroups}
                          onToggleGroup={handleToggleGroup}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Review Navigation */}
                  <div className="mt-6 flex justify-between">
                    <button
                      onClick={handlePrevious}
                      disabled={currentIndex === 0}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        currentIndex === 0
                          ? 'bg-gray-100 dark:bg-dark-700 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-dark-600'
                      }`}
                    >
                      {t('common.previous')}
                    </button>

                    {currentIndex === practiceWords.length - 1 ? (
                      <button
                        onClick={() => {
                          setViewMode('browse')
                          loadPracticeWords()
                        }}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        {t('conjugation.reviewMode.complete')}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          handleNext()
                          setShowConjugations(false)
                        }}
                        className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                      >
                        {t('common.next')}
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  {t('conjugation.reviewMode.noWords')}
                </p>
                <button
                  onClick={() => setViewMode('browse')}
                  className="mt-4 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  {t('common.back')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}