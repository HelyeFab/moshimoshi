'use client'

import { useState, useEffect, Suspense, useMemo, useCallback } from 'react'
import { Kanji, JLPTLevel, KanjiByLevel } from '@/types/kanji'
import { kanjiService } from '@/services/kanjiService'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'
import Navbar from '@/components/layout/Navbar'
import LearningPageHeader from '@/components/learn/LearningPageHeader'
import { LoadingOverlay, LoadingSpinner } from '@/components/ui/Loading'
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { useTheme } from '@/lib/theme/ThemeContext'
import { motion } from 'framer-motion'
import { useKanjiBrowser } from '@/hooks/useKanjiBrowser'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import dynamic from 'next/dynamic'
import { KanjiBrowserAdapter } from '@/lib/review-engine/adapters/KanjiBrowserAdapter'
import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { SessionStatistics } from '@/lib/review-engine/core/session.types'
import { recordActivityAndSync } from '@/lib/sync/streakSync'
import { StreakActivity } from '@/stores/streakStore'

// Dynamically import ReviewEngine for review mode
const ReviewEngine = dynamic(() => import('@/components/review-engine/ReviewEngine'), {
  loading: () => <LoadingOverlay isLoading={true} />,
  ssr: false
})

// Dynamically import KanjiStudyMode for study mode
const KanjiStudyMode = dynamic(() => import('@/components/kanji/KanjiStudyMode'), {
  loading: () => <LoadingOverlay isLoading={true} />,
  ssr: false
})

type ViewMode = 'browse' | 'study' | 'review'

function KanjiBrowserContent() {
  const { strings } = useI18n()
  const { showToast } = useToast()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()
  const { isPremium } = useSubscription()

  const [kanjiData, setKanjiData] = useState<KanjiByLevel>({})
  const [loading, setLoading] = useState(true)
  const [loadingLevels, setLoadingLevels] = useState<Set<JLPTLevel>>(new Set())
  const [modalKanji, setModalKanji] = useState<Kanji | null>(null)
  const [expandedLevels, setExpandedLevels] = useState<Set<JLPTLevel>>(
    new Set(['N5'])
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Kanji[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('browse')
  const [selectedKanji, setSelectedKanji] = useState<Set<string>>(new Set())
  const [reviewContent, setReviewContent] = useState<ReviewableContent[]>([])
  const [reviewContentPool, setReviewContentPool] = useState<ReviewableContent[]>([])
  const [lastSessionStats, setLastSessionStats] = useState<SessionStatistics | null>(null)
  const [currentStudyIndex, setCurrentStudyIndex] = useState(0)
  const [selectedKanjiData, setSelectedKanjiData] = useState<Kanji[]>([])

  // Use the kanji browser hook for review system integration
  const {
    session,
    kanji: browseKanji,
    bookmarks,
    filters,
    loading: browseLoading,
    hasMore,
    dailyUsage,
    browseKanji: trackBrowse,
    applyFilters,
    addToReview,
    toggleBookmark,
    loadMore,
    getBrowseStats,
    canAddMore
  } = useKanjiBrowser()

  // Initialize kanji adapter for converting to ReviewableContent
  const kanjiAdapter = useMemo(() => new KanjiBrowserAdapter({
    contentType: 'kanji',
    availableModes: [
      {
        mode: 'recognition' as const,
        showPrimary: true,
        showSecondary: false,
        showTertiary: false,
        showMedia: false,
        inputType: 'multiple-choice' as const,
        optionCount: 4,
        allowHints: true
      },
      {
        mode: 'recall' as const,
        showPrimary: true,
        showSecondary: false,
        showTertiary: false,
        showMedia: false,
        inputType: 'text' as const,
        allowHints: true
      }
    ],
    defaultMode: 'recognition' as const,
    validationStrategy: 'exact' as const,
    features: {}
  }), [])

  // JLPT level info
  const levelInfo = {
    N5: {
      name: 'N5 (Beginner)',
      color: 'bg-green-500',
      borderColor: 'border-green-500',
      textColor: 'text-green-600 dark:text-green-400',
      bgGradient: 'from-green-400 to-emerald-500',
      description: 'Basic kanji for daily use',
      count: 80
    },
    N4: {
      name: 'N4 (Elementary)',
      color: 'bg-blue-500',
      borderColor: 'border-blue-500',
      textColor: 'text-blue-600 dark:text-blue-400',
      bgGradient: 'from-blue-400 to-indigo-500',
      description: 'Elementary level kanji',
      count: 170
    },
    N3: {
      name: 'N3 (Intermediate)',
      color: 'bg-yellow-500',
      borderColor: 'border-yellow-500',
      textColor: 'text-yellow-600 dark:text-yellow-400',
      bgGradient: 'from-yellow-400 to-amber-500',
      description: 'Intermediate level kanji',
      count: 370
    },
    N2: {
      name: 'N2 (Upper-Intermediate)',
      color: 'bg-orange-500',
      borderColor: 'border-orange-500',
      textColor: 'text-orange-600 dark:text-orange-400',
      bgGradient: 'from-orange-400 to-red-500',
      description: 'Upper-intermediate kanji',
      count: 380
    },
    N1: {
      name: 'N1 (Advanced)',
      color: 'bg-red-500',
      borderColor: 'border-red-500',
      textColor: 'text-red-600 dark:text-red-400',
      bgGradient: 'from-red-400 to-rose-500',
      description: 'Advanced level kanji',
      count: 1200
    }
  }

  // Track browse session when viewing kanji
  useEffect(() => {
    if (modalKanji && session) {
      // Only track once when modal opens, not on every render
      trackBrowse(modalKanji.kanji, modalKanji.kanji)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalKanji?.kanji]) // Only depend on the kanji character, not the whole object or trackBrowse function

  // Load kanji data on component mount
  useEffect(() => {
    loadKanjiData()
  }, [])

  // Handle search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch()
      } else {
        setSearchResults([])
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  const loadKanjiData = async () => {
    try {
      setLoading(true)

      // Load only N5 initially for fast initial render
      const n5Data = await kanjiService.loadKanjiByLevel('N5')
      setKanjiData({ N5: n5Data })
      setLoading(false)

      // Load other levels progressively
      const otherLevels: JLPTLevel[] = ['N4', 'N3', 'N2', 'N1']
      for (const level of otherLevels) {
        setLoadingLevels(prev => new Set([...prev, level]))
        const levelData = await kanjiService.loadKanjiByLevel(level)
        setKanjiData(prev => ({ ...prev, [level]: levelData }))
        setLoadingLevels(prev => {
          const newSet = new Set(prev)
          newSet.delete(level)
          return newSet
        })
      }
    } catch (error) {
      console.error('Error loading kanji data:', error)
      setLoading(false)
      showToast('Failed to load kanji data', 'error')
    }
  }

  const performSearch = async () => {
    try {
      setIsSearching(true)
      const results = await kanjiService.searchKanji(searchQuery.trim())
      setSearchResults(results)
    } catch (error) {
      console.error('Error searching kanji:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleKanjiClick = (kanji: Kanji) => {
    // Always open modal for kanji preview
    setModalKanji(kanji)
    // Track browse event
    if (session) {
      trackBrowse(kanji.kanji, kanji.kanji)
    }
  }

  const toggleSelection = (kanjiChar: string) => {
    setSelectedKanji(prev => {
      const newSet = new Set(prev)
      if (newSet.has(kanjiChar)) {
        newSet.delete(kanjiChar)
      } else {
        newSet.add(kanjiChar)
      }
      return newSet
    })
  }

  const handleSelectAll = (kanji: Kanji[]) => {
    const allChars = kanji.map(k => k.kanji)
    setSelectedKanji(new Set(allChars))
  }

  const handleDeselectAll = () => {
    setSelectedKanji(new Set())
  }

  const handleAddToReview = async () => {
    if (!user) {
      showToast('Please sign in to add kanji to review', 'warning')
      return
    }

    if (selectedKanji.size === 0) {
      showToast('Please select kanji to add to review', 'warning')
      return
    }

    const kanjiIds = Array.from(selectedKanji)
    const success = await addToReview(kanjiIds)

    if (success) {
      setSelectedKanji(new Set())
      }
  }

  const handleStartReview = () => {
    if (selectedKanji.size === 0) {
      showToast('Please select kanji to review', 'warning')
      return
    }

    // Convert selected kanji to ReviewableContent
    const kanjiDataArray: Kanji[] = []
    const jlptLevelsInUse = new Set<string>()

    // First, collect the selected kanji and their JLPT levels
    Object.entries(kanjiData).forEach(([level, levelKanji]) => {
      levelKanji.forEach(k => {
        if (selectedKanji.has(k.kanji)) {
          kanjiDataArray.push(k)
          jlptLevelsInUse.add(level)
        }
      })
    })

    // Also check search results
    searchResults.forEach(k => {
      if (selectedKanji.has(k.kanji) && !kanjiDataArray.some(sk => sk.kanji === k.kanji)) {
        kanjiDataArray.push(k)
        // Try to determine JLPT level from the kanji
        if (k.jlpt) {
          jlptLevelsInUse.add(k.jlpt)
        }
      }
    })

    // Now collect ALL kanji from the same JLPT levels for the pool
    const fullKanjiPool: Kanji[] = []
    jlptLevelsInUse.forEach(level => {
      const levelKanji = kanjiData[level] || []
      if (levelKanji.length > 100) {
        // If level has more than 100 kanji, randomly sample 100
        const shuffled = [...levelKanji].sort(() => Math.random() - 0.5)
        fullKanjiPool.push(...shuffled.slice(0, 100))
      } else {
        fullKanjiPool.push(...levelKanji)
      }
    })

    // Transform selected kanji to reviewable content for review
    const content = kanjiDataArray.map(k => kanjiAdapter.transform(k))
    // Transform full pool to reviewable content for distractors
    const poolContent = fullKanjiPool.map(k => kanjiAdapter.transform(k))

    // Store both the review content and the full pool
    setReviewContent(content)
    setReviewContentPool(poolContent)
    // Don't change view mode - let the review content trigger the review view
  }

  const handleStartStudy = () => {
    if (selectedKanji.size === 0) {
      showToast('Please select kanji to study', 'warning')
      return
    }

    // Convert selected kanji to array
    const kanjiDataArray: Kanji[] = []
    Object.values(kanjiData).forEach(levelKanji => {
      levelKanji.forEach(k => {
        if (selectedKanji.has(k.kanji)) {
          kanjiDataArray.push(k)
        }
      })
    })

    // Also check search results
    searchResults.forEach(k => {
      if (selectedKanji.has(k.kanji) && !kanjiDataArray.some(sk => sk.kanji === k.kanji)) {
        kanjiDataArray.push(k)
      }
    })

    if (kanjiDataArray.length === 0) {
      showToast('Could not find selected kanji data', 'error')
      return
    }

    setSelectedKanjiData(kanjiDataArray)
    setCurrentStudyIndex(0)
    setViewMode('study')
  }

  const handleReviewComplete = async (stats: SessionStatistics) => {
    // Record review session for streak
    await recordActivityAndSync(
      StreakActivity.REVIEW_SESSION,
      isPremium,
      Date.now()
    )

    setLastSessionStats(stats)
    setReviewContent([]) // Clear review content
    setReviewContentPool([]) // Clear pool
    setViewMode('browse')
    setSelectedKanji(new Set())
    showToast(`Review complete! Accuracy: ${stats.accuracy.toFixed(1)}%`, 'success')
  }

  // Progress statistics for navbar
  const progressStats = useMemo(() => {
    const stats = getBrowseStats()
    const total = Object.values(kanjiData).flat().length
    const learned = 0 // TODO: Track learned kanji
    return {
      total,
      learned,
      learnedPercentage: total > 0 ? Math.round((learned / total) * 100) : 0
    }
  }, [kanjiData, getBrowseStats])

  const handleToggleBookmark = async (kanjiChar: string) => {
    if (!user) {
      showToast('Please sign in to bookmark kanji', 'warning')
      return
    }
    await toggleBookmark(kanjiChar, kanjiChar)
  }

  const toggleLevel = (level: JLPTLevel) => {
    setExpandedLevels(prev => {
      const newSet = new Set(prev)
      if (newSet.has(level)) {
        newSet.delete(level)
      } else {
        newSet.add(level)
      }
      return newSet
    })
  }

  const renderKanjiGrid = (kanji: Kanji[]) => (
    <div className="grid grid-cols-3 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 mt-4">
      {kanji.map((kanjiItem, index) => {
        const isSelected = selectedKanji.has(kanjiItem.kanji)

        // Simple styling - no special selection state since we use pin emoji
        const borderStyle = 'border-2 border-gray-200 dark:border-dark-700'
        const bgStyle = 'bg-white dark:bg-dark-800'

        return (
          <motion.div
            key={`${kanjiItem.kanji}-${index}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.01 }}
            whileHover={{ scale: 1.1, zIndex: 10 }}
            whileTap={{ scale: 0.95 }}
            className="relative"
          >
            <div
              onClick={() => handleKanjiClick(kanjiItem)}
              className={`
                relative w-full aspect-square flex items-center justify-center text-2xl font-medium
                rounded-lg transition-all overflow-hidden cursor-pointer
                ${borderStyle} ${bgStyle}
                hover:shadow-lg
              `}
              style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
            >
              {/* Pin emoji for selection in study/review modes */}
              {(viewMode === 'study' || viewMode === 'review') && (
                <button
                  className="absolute top-1 right-1 z-20 text-base sm:text-xl transition-all hover:scale-110"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleSelection(kanjiItem.kanji)
                  }}
                  aria-label={isSelected ? "Unpin" : "Pin"}
                >
                  <span className={isSelected ? "" : "opacity-30 grayscale"}>
                    📌
                  </span>
                </button>
              )}

              <span className="text-gray-900 dark:text-gray-100">
                {kanjiItem.kanji}
              </span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )

  if (loading) {
    return (
      <LoadingOverlay
        isLoading={true}
        message="Loading kanji database..."
        showDoshi={true}
        fullScreen={true}
      />
    )
  }

  // Active study session (actually studying, not selecting)
  if (selectedKanjiData.length > 0 && selectedKanjiData[currentStudyIndex]) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
        <Navbar user={user} showUserMenu={true} />
        <LearningPageHeader
          title="Kanji Browser"
          description="Master Japanese kanji step by step through JLPT levels"
          subtitle="Select kanji and start studying"
          stats={{
            total: progressStats.total,
            learned: progressStats.learned,
            daily: user ? { used: dailyUsage.added, limit: dailyUsage.limit } : undefined
          }}
          mode={viewMode}
          onModeChange={setViewMode}
          selectedCount={selectedKanji.size}
          onSelectAll={() => {
            const allKanji = Object.values(kanjiData).flat()
            handleSelectAll(allKanji)
          }}
          onClearSelection={handleDeselectAll}
          onStartStudy={() => {
            if (selectedKanji.size === 0) {
              showToast('Please select kanji to study', 'warning')
              return
            }
            handleStartStudy()
          }}
        />
        <main className="container mx-auto px-4 py-8">
          <KanjiStudyMode
            kanji={selectedKanjiData[currentStudyIndex]}
            onNext={async () => {
              if (currentStudyIndex < selectedKanjiData.length - 1) {
                setCurrentStudyIndex(currentStudyIndex + 1)
              } else {
                // Record study session for streak
                await recordActivityAndSync(
                  StreakActivity.STUDY_SESSION,
                  isPremium,
                  Date.now()
                )

                showToast('Study session complete!', 'success')
                setViewMode('browse')
                setCurrentStudyIndex(0)
                setSelectedKanjiData([])
              }
            }}
            onPrevious={() => {
              if (currentStudyIndex > 0) {
                setCurrentStudyIndex(currentStudyIndex - 1)
              }
            }}
            onBack={() => {
              setViewMode('browse')
              setCurrentStudyIndex(0)
              setSelectedKanjiData([])
            }}
            currentIndex={currentStudyIndex + 1}
            totalKanji={selectedKanjiData.length}
          />
        </main>
      </div>
    )
  }

  // Active review session (actually reviewing, not selecting)
  if (reviewContent.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
        <Navbar user={user} showUserMenu={true} />
        <LearningPageHeader
          title="Kanji Browser"
          description="Master Japanese kanji step by step through JLPT levels"
          subtitle="Select kanji and start reviewing"
          stats={{
            total: progressStats.total,
            learned: progressStats.learned,
            daily: user ? { used: dailyUsage.added, limit: dailyUsage.limit } : undefined
          }}
          mode={viewMode}
          onModeChange={setViewMode}
          selectedCount={selectedKanji.size}
          onSelectAll={() => {
            const allKanji = Object.values(kanjiData).flat()
            handleSelectAll(allKanji)
          }}
          onClearSelection={handleDeselectAll}
          onStartReview={() => {
            if (selectedKanji.size === 0) {
              showToast('Please select kanji to review', 'warning')
              return
            }
            handleStartReview()
          }}
        />
        <main className="container mx-auto px-4 py-8">
          <ReviewEngine
            content={reviewContent}
            contentPool={reviewContentPool}
            mode="recall"
            onComplete={handleReviewComplete}
            onCancel={() => {
              setReviewContent([]) // Clear review content
              setReviewContentPool([]) // Clear pool
              setViewMode('browse')
              setSelectedKanji(new Set())
            }}
            userId={user?.uid || 'guest'}
          />
        </main>
      </div>
    )
  }

  // Main view for all modes (when not in active session)
  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
      <Navbar user={user} showUserMenu={true} />
      <LearningPageHeader
        title="Kanji Browser"
        description="Master Japanese kanji step by step through JLPT levels"
        subtitle={
          viewMode === 'browse'
            ? "Browse over 2,000 kanji organized from beginner (N5) to advanced (N1)"
            : viewMode === 'study'
            ? "Select kanji to study"
            : "Select kanji to review"
        }
        stats={{
          total: progressStats.total,
          learned: progressStats.learned,
          daily: user ? { used: dailyUsage.added, limit: dailyUsage.limit } : undefined
        }}
        mode={viewMode}
        onModeChange={setViewMode}
        selectedCount={selectedKanji.size}
        onSelectAll={viewMode !== 'browse' ? () => {
          const allKanji = searchQuery.trim()
            ? searchResults
            : Object.values(kanjiData).flat()
          handleSelectAll(allKanji)
        } : undefined}
        onClearSelection={viewMode !== 'browse' ? handleDeselectAll : undefined}
        onStartStudy={viewMode === 'study' ? () => {
          if (selectedKanji.size === 0) {
            showToast('Please select kanji to study', 'warning')
            return
          }
          handleStartStudy()
        } : undefined}
        onStartReview={viewMode === 'review' ? () => {
          if (selectedKanji.size === 0) {
            showToast('Please select kanji to review', 'warning')
            return
          }
          handleStartReview()
        } : undefined}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-7xl">

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Search kanji by character, meaning, or reading..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pr-12 rounded-xl bg-white dark:bg-dark-800 border-2 border-gray-200 dark:border-dark-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
            />
            <div className="absolute top-1/2 right-3 -translate-y-1/2">
              {isSearching ? (
                <LoadingSpinner size="small" />
              ) : (
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Search Results */}
        {searchQuery.trim() && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl p-6 shadow-lg"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Search Results
              {!isSearching && (
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  ({searchResults.length} found)
                </span>
              )}
            </h3>
            {isSearching ? (
              <div className="text-center py-8">
                <LoadingSpinner size="medium" />
              </div>
            ) : searchResults.length > 0 ? (
              renderKanjiGrid(searchResults)
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No kanji found matching "{searchQuery}"
              </p>
            )}
          </motion.div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
          {Object.entries(levelInfo).map(([level, info]) => (
            <motion.div
              key={level}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl p-4 text-center shadow-lg cursor-pointer"
              onClick={() => toggleLevel(level as JLPTLevel)}
            >
              <div className={`w-8 h-8 ${info.color} rounded-full mx-auto mb-2 flex items-center justify-center text-white text-sm font-bold`}>
                {level.replace('N', '')}
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {kanjiData[level as JLPTLevel]?.length || 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                kanji
              </div>
            </motion.div>
          ))}
        </div>

        {/* Kanji by Level */}
        <div className="space-y-6">
          {(['N5', 'N4', 'N3', 'N2', 'N1'] as JLPTLevel[]).map((level) => {
            const kanji = kanjiData[level] || []
            const isExpanded = expandedLevels.has(level)
            const info = levelInfo[level]

            return (
              <motion.div
                key={level}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg"
              >
                <button
                  onClick={() => toggleLevel(level)}
                  className="w-full px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 ${info.color} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                        {level.replace('N', '')}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {info.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {info.description} • {loadingLevels.has(level) ? 'Loading...' : `${kanji.length} kanji`}
                        </p>
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-6 pb-6">
                    {loadingLevels.has(level) ? (
                      <div className="flex items-center justify-center py-8">
                        <LoadingSpinner size="medium" />
                        <span className="ml-3 text-gray-500 dark:text-gray-400">
                          Loading {level} kanji...
                        </span>
                      </div>
                    ) : kanji.length > 0 ? (
                      renderKanjiGrid(kanji)
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                        No kanji available for {level}
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Kanji Detail Modal */}
        {modalKanji && (
          <KanjiDetailsModal
            kanji={modalKanji}
            isOpen={!!modalKanji}
            onClose={() => setModalKanji(null)}
          />
        )}
      </main>
    </div>
  )
}

export default function KanjiBrowserPage() {
  return (
    <Suspense fallback={
      <LoadingOverlay
        isLoading={true}
        message="Loading..."
        showDoshi={true}
        fullScreen={true}
      />
    }>
      <KanjiBrowserContent />
    </Suspense>
  )
}