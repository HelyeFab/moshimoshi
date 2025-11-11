'use client'

import { useToast } from '@/components/ui/Toast/ToastContext'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { useI18n } from '@/i18n/I18nContext'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
// Gamification removed
import Navbar from '@/components/layout/Navbar'
import KanaDetailsModal from '@/components/learn/KanaDetailsModal'
import KanaFilters from '@/components/learn/KanaFilters'
import LearningPageHeader from '@/components/learn/LearningPageHeader'
import { LoadingOverlay } from '@/components/ui/Loading'
import { getBasicKana, kanaData, type KanaCharacter } from '@/data/kanaData'
import { gamificationListener } from '@/lib/gamification/gamificationListener'
import { KanaAdapter } from '@/lib/review-engine/adapters/kana.adapter'
import { ReviewEventType } from '@/lib/review-engine/core/events'
import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { SessionStatistics } from '@/lib/review-engine/core/session.types'
import { kanaProgressManager, type CharacterProgress as ManagerProgress } from '@/utils/kanaProgressManager'
import { kanaProgressManagerV2 } from '@/utils/kanaProgressManagerV2'
import { EventEmitter } from 'events'

// Global URE event emitter for gamification integration
const ureEventEmitter = new EventEmitter()

// Flag to ensure listener is only initialized once
let listenerInitialized = false

// Dynamically import components that use animations or client-side features
const KanaGrid = dynamic(() => import('@/components/learn/KanaGrid'), {
  loading: () => <LoadingOverlay isLoading={true} />,
  ssr: false
})

const KanaStudyMode = dynamic(() => import('@/components/learn/KanaStudyMode'), {
  loading: () => <LoadingOverlay isLoading={true} />,
  ssr: false
})

const ReviewEngine = dynamic(() => import('@/components/review-engine/ReviewEngine'), {
  loading: () => <LoadingOverlay isLoading={true} />,
  ssr: false
})


type ViewMode = 'browse' | 'study' | 'review'
type FilterType = 'all' | 'vowel' | 'consonant' | 'dakuten' | 'handakuten' | 'digraph'
type ProgressStatus = 'not-started' | 'learning' | 'learned'

interface CharacterProgress {
  [characterId: string]: {
    status: ProgressStatus
    reviewCount: number
    correctCount: number
    lastReviewed?: Date
    pinned: boolean
    updatedAt?: Date
  }
}

export function KanaLearningComponent({ defaultScript = 'hiragana' }: { defaultScript?: 'hiragana' | 'katakana' } = {}) {
  const router = useRouter()
  const { t } = useI18n()
  const { showToast } = useToast()
  const { user } = useAuth()
  const { isPremium } = useSubscription()


  // Initialize kana adapter for converting to ReviewableContent
  const kanaAdapter = useMemo(() => new KanaAdapter({
    contentType: 'kana',
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
      },
      {
        mode: 'listening' as const,
        showPrimary: false,
        showSecondary: false,
        showTertiary: false,
        showMedia: true,
        inputType: 'text' as const,
        allowHints: false
      }
    ],
    defaultMode: 'recognition' as const,
    validationStrategy: 'fuzzy' as const,
    features: { displayScript: defaultScript }
  }), [defaultScript])

  // Convert KanaCharacter to ReviewableContent format
  const convertToReviewableContent = useCallback((characters: KanaCharacter[]): ReviewableContent[] => {
    return characters.map(char => kanaAdapter.transform(char))
  }, [kanaAdapter])

  // State Management
  const [viewMode, setViewMode] = useState<ViewMode>('browse')
  const [selectedCharacters, setSelectedCharacters] = useState<KanaCharacter[]>([])
  const [studyCharacters, setStudyCharacters] = useState<KanaCharacter[]>([]) // Separate state for actual study session
  const [reviewContent, setReviewContent] = useState<ReviewableContent[]>([])
  const [reviewContentPool, setReviewContentPool] = useState<ReviewableContent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastSessionStats, setLastSessionStats] = useState<SessionStatistics | null>(null)
  const [currentStudyIndex, setCurrentStudyIndex] = useState(0)
  const [modalCharacter, setModalCharacter] = useState<KanaCharacter | null>(null)

  // Study session tracking for gamification
  const [studySessionStartTime, setStudySessionStartTime] = useState<number>(0)
  const [studyCharactersLearned, setStudyCharactersLearned] = useState<number>(0)

  // Filter state
  const [filter, setFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<'basic' | 'dakuten' | 'digraph' | 'all'>('all')

  // UI preferences
  const [showRomaji, setShowRomaji] = useState(true)
  const [showMnemonics, setShowMnemonics] = useState(false)
  const [showStrokeOrder, setShowStrokeOrder] = useState(false)
  const [progress, setProgress] = useState<CharacterProgress>({})
  const [showBothKana, setShowBothKana] = useState(defaultScript === 'hiragana') // Show both for hiragana, single for katakana
  const [displayScript, setDisplayScript] = useState<'hiragana' | 'katakana'>(defaultScript)

  // Helper to get consistent character ID format
  const getCharacterId = useCallback((charId: string) => {
    // If already has script prefix, return as-is
    if (charId.startsWith('hiragana-') || charId.startsWith('katakana-')) {
      return charId
    }
    // Otherwise add the script prefix
    return `${defaultScript}-${charId}`
  }, [defaultScript])

  // Filter logic
  const filteredKana = useMemo(() => {
    const scriptKey = displayScript
    const sourceData = kanaData

    let filtered = sourceData

    // Category filter
    if (selectedCategory !== 'all') {
      switch (selectedCategory) {
        case 'basic':
          filtered = getBasicKana()
          break
        case 'dakuten':
          // Dakuten (゛) and Handakuten (゜) characters are in rows g, z, d, b, p
          filtered = sourceData.filter(k => ['g', 'z', 'd', 'b', 'p'].includes(k.row))
          break
        case 'digraph':
          filtered = sourceData.filter(k => k.type === 'digraph')
          break
      }
    }

    // Type filter
    if (filter !== 'all') {
      filtered = filtered.filter(k => {
        switch (filter) {
          case 'vowel':
            return k.type === 'vowel'
          case 'consonant':
            return k.type === 'consonant'
          case 'dakuten':
            // Dakuten characters are in rows g, z, d, b
            return ['g', 'z', 'd', 'b'].includes(k.row)
          case 'handakuten':
            // Handakuten characters are in row p
            return k.row === 'p'
          case 'digraph':
            return k.type === 'digraph'
          default:
            return true
        }
      })
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(k =>
        k.romaji.toLowerCase().includes(query) ||
        k.hiragana.includes(searchQuery) ||
        k.katakana.includes(searchQuery)
      )
    }

    return filtered
  }, [displayScript, selectedCategory, filter, searchQuery])

  // Initialize gamification listener (once per user session)
  useEffect(() => {
    if (user?.uid && !listenerInitialized) {
      console.log('[Kana Review] Initializing gamification listener for user:', user.uid)
      gamificationListener.initialize(user.uid, ureEventEmitter)
      listenerInitialized = true
    }
  }, [user?.uid])

  // Load progress from KanaProgressManager
  useEffect(() => {
    const loadProgress = async () => {
      if (!user) {
        // Guest users: clear any existing progress
        setProgress({})
        return
      }

      // Achievement store initialization removed (degamified)
      // Kana progress is now managed independently

      // Try to migrate from localStorage first (one-time operation)
      const migrationKey = `kana-progress-${defaultScript}-${user.uid}-migrated`
      if (!localStorage.getItem(migrationKey)) {
        await kanaProgressManager.migrateFromLocalStorage(defaultScript, user, isPremium)
      }

      // Load progress from KanaProgressManager (IndexedDB + Firebase for premium)
      const savedProgress = await kanaProgressManager.getProgress(defaultScript, user, isPremium)

      // Migrate non-prefixed IDs to prefixed format (one-time fix for existing data)
      const prefixMigrationKey = `kana-progress-prefix-migration-${defaultScript}-${user.uid}`
      if (!localStorage.getItem(prefixMigrationKey)) {
        for (const [charId, progressData] of Object.entries(savedProgress)) {
          // If ID doesn't have script prefix, migrate it
          if (!charId.startsWith('hiragana-') && !charId.startsWith('katakana-')) {
            const prefixedId = `${defaultScript}-${charId}`
            // Save with correct prefixed ID
            await kanaProgressManager.saveProgress(
              defaultScript,
              prefixedId,
              progressData,
              user,
              isPremium
            )
          }
        }
        localStorage.setItem(prefixMigrationKey, 'true')

        // Reload progress after migration
        const migratedProgress = await kanaProgressManager.getProgress(defaultScript, user, isPremium)
        const formattedProgress: CharacterProgress = {}
        for (const [charId, progress] of Object.entries(migratedProgress)) {
          formattedProgress[charId] = {
            status: progress.status,
            reviewCount: progress.reviewCount,
            correctCount: progress.correctCount,
            lastReviewed: progress.lastReviewed,
            pinned: progress.pinned,
            updatedAt: progress.updatedAt
          }
        }
        setProgress(formattedProgress)
      } else {
        // No migration needed, use loaded progress
        const formattedProgress: CharacterProgress = {}
        for (const [charId, progress] of Object.entries(savedProgress)) {
          formattedProgress[charId] = {
            status: progress.status,
            reviewCount: progress.reviewCount,
            correctCount: progress.correctCount,
            lastReviewed: progress.lastReviewed,
            pinned: progress.pinned,
            updatedAt: progress.updatedAt
          }
        }
        setProgress(formattedProgress)
      }
    }

    loadProgress()
  }, [defaultScript, user, isPremium])

  // Save progress updates to KanaProgressManager
  const saveProgressUpdate = useCallback(async (
    characterId: string,
    update: Partial<CharacterProgress[string]>
  ) => {
    if (!user) return // Guest users: no storage

    const currentProgress = progress[characterId] || {
      status: 'not-started' as ProgressStatus,
      reviewCount: 0,
      correctCount: 0,
      pinned: false,
      updatedAt: new Date()
    }

    const updatedProgress: ManagerProgress = {
      status: update.status ?? currentProgress.status,
      reviewCount: update.reviewCount ?? currentProgress.reviewCount,
      correctCount: update.correctCount ?? currentProgress.correctCount,
      lastReviewed: update.lastReviewed ?? currentProgress.lastReviewed,
      pinned: update.pinned ?? currentProgress.pinned,
      updatedAt: new Date()
    }

    await kanaProgressManager.saveProgress(
      defaultScript,
      characterId,
      updatedProgress,
      user,
      isPremium
    )
  }, [defaultScript, user, isPremium, progress])

  // Handle character selection for study/review
  const handleCharacterSelect = useCallback((character: KanaCharacter) => {
    // Only open modal in browse mode
    // In study/review modes, only the pin button should work
    if (viewMode === 'browse') {
      setModalCharacter(character)
    }
  }, [viewMode])

  // Handle toggling selection with pin emoji
  const handleToggleSelection = useCallback((character: KanaCharacter) => {
    setSelectedCharacters(prev => {
      const isSelected = prev.some(c => c.id === character.id)
      if (isSelected) {
        return prev.filter(c => c.id !== character.id)
      } else {
        return [...prev, character]
      }
    })
  }, [])

  // Handle bulk selection
  const handleSelectAll = useCallback(() => {
    setSelectedCharacters(filteredKana)
  }, [filteredKana])

  const handleDeselectAll = useCallback(() => {
    setSelectedCharacters([])
  }, [])

  // Handle review completion
  const handleReviewComplete = useCallback(async (stats: SessionStatistics) => {
    console.log('[Kana Review] handleReviewComplete called with stats:', stats)

    const sessionStartTime = Date.now() - (stats.duration || 0)
    const sessionEndTime = Date.now()

    // Save individual character progress and session data to Firebase
    if (user && user.uid && isPremium) {
      // Generate session ID for tracking
      const sessionId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Prepare character data for session tracking
      const sessionCharacters = selectedCharacters.map(character => ({
        id: getCharacterId(character.id),
        character: character[defaultScript],
        romaji: character.romaji,
        script: defaultScript,
        // These would be more accurate with per-character tracking
        correct: stats.accuracy >= 80,
        attempts: 1,
        responseTime: stats.avgResponseTime || 0
      }))

      // Save complete session data
      try {
        const response = await fetch('/api/sessions/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            sessionType: 'review',
            sessionId,
            characters: sessionCharacters,
            stats: {
              totalItems: stats.totalItems,
              correctItems: stats.correctItems,
              accuracy: stats.accuracy,
              avgResponseTime: stats.avgResponseTime,
              duration: stats.duration
            },
            startedAt: new Date(sessionStartTime).toISOString(),
            completedAt: new Date(sessionEndTime).toISOString()
          })
        })

        if (!response.ok) {
          console.error('[Session Save] Failed to save review session:', response.statusText)
        } else {
          console.log('[Session Save] Review session saved successfully:', sessionId)
        }
      } catch (error) {
        console.error('[Session Save] Error saving review session:', error)
      }

      // Update individual character progress
      for (const character of selectedCharacters) {
        // Use proper character ID format with script prefix
        const characterId = getCharacterId(character.id)

        const currentProgress = progress[characterId] || {
          status: 'not-started' as ProgressStatus,
          reviewCount: 0,
          correctCount: 0,
          pinned: false,
          updatedAt: new Date()
        }

        // Calculate new progress based on review performance
        // Note: This is simplified - ideally we'd track individual character performance
        const wasCorrect = stats.accuracy >= 80 // Simplified for now

        const newProgress: Partial<CharacterProgress[string]> = {
          status: wasCorrect ? 'learned' : 'learning',
          reviewCount: currentProgress.reviewCount + 1,
          correctCount: currentProgress.correctCount + (wasCorrect ? 1 : 0),
          lastReviewed: new Date(),
          lastReviewSessionId: sessionId,
          updatedAt: new Date()
        }

        // Save to Firebase via KanaProgressManager with proper ID
        await saveProgressUpdate(characterId, newProgress)
      }
    }

    // Emit URE SESSION_COMPLETED event for gamification system
    console.log('[Kana Review] About to emit SESSION_COMPLETED event...')
    console.log('[Kana Review] ureEventEmitter:', ureEventEmitter)
    console.log('[Kana Review] ReviewEventType.SESSION_COMPLETED:', ReviewEventType.SESSION_COMPLETED)
    console.log('[Kana Review] Listener count:', ureEventEmitter.listenerCount(ReviewEventType.SESSION_COMPLETED))

    const sessionId = `kana_review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    ureEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, {
      data: {
        sessionId,
        statistics: {
          correctItems: stats.correctItems,
          accuracy: stats.accuracy,
          averageResponseTime: stats.averageResponseTime || 0,
          bestStreak: stats.bestStreak || 0
        },
        duration: stats.duration || 0
      }
    })

    console.log('[Kana Review] Emitted SESSION_COMPLETED event for gamification:', {
      sessionId,
      correctItems: stats.correctItems,
      accuracy: stats.accuracy,
      averageResponseTime: stats.averageResponseTime,
      bestStreak: stats.bestStreak,
      duration: stats.duration
    })

    setLastSessionStats(stats)
    setViewMode('browse')

    showToast(`${t('review.sessionComplete')} - ${t('common.accuracy')}: ${stats.accuracy.toFixed(1)}%`, 'success')
  }, [showToast, t, user, isPremium, selectedCharacters, progress, saveProgressUpdate, getCharacterId, defaultScript])

  // Toggle character pin status
  const handleTogglePin = useCallback(async (characterId: string) => {
    const formattedId = getCharacterId(characterId)
    const currentPinned = progress[formattedId]?.pinned || false

    // Update local state immediately for UI responsiveness
    setProgress(prev => ({
      ...prev,
      [formattedId]: {
        ...prev[formattedId],
        pinned: !currentPinned
      }
    }))

    // Save to storage with proper ID format
    await saveProgressUpdate(formattedId, { pinned: !currentPinned })
  }, [progress, saveProgressUpdate, getCharacterId])

  // Batch toggle pin status for multiple characters
  const handleTogglePinBatch = useCallback(async (characterIds: string[], pinned: boolean) => {
    // Update local state immediately
    setProgress(prev => {
      const updated = { ...prev }
      characterIds.forEach(charId => {
        const formattedId = getCharacterId(charId)
        if (!updated[formattedId]) {
          updated[formattedId] = {
            status: 'not-started' as ProgressStatus,
            reviewCount: 0,
            correctCount: 0,
            pinned: false,
            updatedAt: new Date()
          }
        }
        updated[formattedId] = {
          ...updated[formattedId],
          pinned
        }
      })
      return updated
    })

    // Save all updates to storage with proper ID format
    for (const charId of characterIds) {
      await saveProgressUpdate(getCharacterId(charId), { pinned })
    }
  }, [saveProgressUpdate, getCharacterId])

  // Get progress stats
  const progressStats = useMemo(() => {
    const total = filteredKana.length
    const learned = filteredKana.filter(k => progress[getCharacterId(k.id)]?.status === 'learned').length
    const learning = filteredKana.filter(k => progress[getCharacterId(k.id)]?.status === 'learning').length
    const notStarted = total - learned - learning

    return {
      total,
      learned,
      learning,
      notStarted,
      learnedPercentage: total > 0 ? Math.round((learned / total) * 100) : 0,
      learningPercentage: total > 0 ? Math.round((learning / total) * 100) : 0
    }
  }, [filteredKana, progress, getCharacterId])

  // Count pinned characters that are not already selected
  const pinnedCharacters = useMemo(() => {
    return filteredKana.filter(k =>
      progress[getCharacterId(k.id)]?.pinned &&
      !selectedCharacters.some(sc => sc.id === k.id)
    )
  }, [filteredKana, progress, selectedCharacters, getCharacterId])

  // Total count for review/study (selected + pinned)
  const totalForReview = selectedCharacters.length + pinnedCharacters.length

  // Start study mode
  const handleStartStudy = useCallback(async () => {
    // Only use explicitly selected characters for study mode
    if (selectedCharacters.length === 0) {
      showToast(t('learn.selectCharacters'), 'warning')
      return
    }

    // Start a new session
    if (user) {
      const script = displayScript as 'hiragana' | 'katakana'
      await kanaProgressManagerV2.startKanaSession(script, user)
    }

    // Track study session start time for gamification
    setStudySessionStartTime(Date.now())
    setStudyCharactersLearned(0)

    // Set the study characters (only selected, not pinned)
    setStudyCharacters(selectedCharacters)
    setCurrentStudyIndex(0) // Reset index when starting study
    setViewMode('study')
  }, [selectedCharacters, showToast, t, user, displayScript])

  // Start review mode
  const handleStartReview = useCallback(() => {
    // Combine selected and pinned characters (removing duplicates)
    const allCharacters = [...selectedCharacters]
    pinnedCharacters.forEach(pc => {
      if (!allCharacters.some(c => c.id === pc.id)) {
        allCharacters.push(pc)
      }
    })

    if (allCharacters.length === 0) {
      showToast(t('learn.selectCharacters'), 'warning')
      return
    }

    // Update selected characters to include pinned ones
    setSelectedCharacters(allCharacters)

    // Build a larger pool including all characters from the same rows
    const rowsIncluded = new Set<string>()
    allCharacters.forEach(char => {
      rowsIncluded.add(char.row)
    })

    // Get all characters from the included rows for the content pool
    const contentPool: KanaCharacter[] = []
    filteredKana.forEach(char => {
      if (rowsIncluded.has(char.row)) {
        contentPool.push(char)
      }
    })

    // Convert characters to ReviewableContent
    const content = convertToReviewableContent(allCharacters)
    const pool = convertToReviewableContent(contentPool)

    setReviewContent(content)
    setReviewContentPool(pool)
    setViewMode('review')
  }, [selectedCharacters, pinnedCharacters, filteredKana, showToast, t, convertToReviewableContent])

  // Quick review - review only struggling characters
  const handleQuickReview = useCallback(() => {
    const strugglingChars = filteredKana.filter(k => {
      const p = progress[getCharacterId(k.id)]
      if (!p) return false
      const accuracy = p.reviewCount > 0 ? p.correctCount / p.reviewCount : 0
      return p.status === 'learning' && accuracy < 0.7
    })

    if (strugglingChars.length === 0) {
      showToast(t('learn.noStrugglingCharacters'), 'info')
      return
    }

    setSelectedCharacters(strugglingChars)
    handleStartReview()
  }, [filteredKana, progress, showToast, t, handleStartReview])

  // Clear all selections and unpin all characters
  const handleClearSelection = useCallback(async () => {
    // Clear selected characters
    setSelectedCharacters([])

    // Collect all pinned characters to unpin
    const pinnedCharIds = Object.keys(progress).filter(key => progress[key]?.pinned)

    // Update local state immediately
    const updatedProgress = { ...progress }
    pinnedCharIds.forEach(key => {
      if (updatedProgress[key]) {
        updatedProgress[key] = {
          ...updatedProgress[key],
          pinned: false
        }
      }
    })
    setProgress(updatedProgress)

    // Save updates to storage (batch update)
    for (const charId of pinnedCharIds) {
      await saveProgressUpdate(charId, { pinned: false })
    }

    // Show feedback
    showToast(t('learn.selectionCleared'), 'success')
  }, [progress, saveProgressUpdate, showToast, t])

  // Main browse view (when not in active session)
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
        <LoadingOverlay isLoading={isLoading} />

      {/* Header */}
      <Navbar user={user} showUserMenu={true} />
      <LearningPageHeader
        title={defaultScript === 'katakana' ? t('learn.katakana') : t('learn.hiragana')}
        description={defaultScript === 'katakana'
          ? 'Master the Japanese Katakana writing system'
          : 'Master the Japanese Hiragana writing system'}
        subtitle={
          viewMode === 'browse'
            ? t('kana.browse.browseAll', { count: filteredKana.length })
            : viewMode === 'study'
            ? t('kana.browse.selectToStudy')
            : t('kana.browse.selectToReview')
        }
        stats={{
          total: progressStats.total,
          learned: progressStats.learned
        }}
        mode={viewMode}
        onModeChange={(newMode) => {
          setViewMode(newMode)
          // Clear selections when switching modes
          if (newMode === 'browse') {
            setSelectedCharacters([])
            setStudyCharacters([])
          }
        }}
        selectedCount={selectedCharacters.length}
        onSelectAll={viewMode !== 'browse' ? handleSelectAll : undefined}
        onClearSelection={viewMode !== 'browse' ? handleDeselectAll : undefined}
        onStartStudy={viewMode === 'study' ? () => {
          if (selectedCharacters.length === 0) {
            showToast(t('learn.selectCharacters'), 'warning')
            return
          }
          handleStartStudy()
        } : undefined}
        onStartReview={viewMode === 'review' ? () => {
          if (selectedCharacters.length === 0) {
            showToast(t('learn.selectCharacters'), 'warning')
            return
          }
          handleStartReview()
        } : undefined}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-7xl">

        {/* Search Bar */}
        {(viewMode === 'browse' ||
          (viewMode === 'study' && studyCharacters.length === 0) ||
          (viewMode === 'review' && reviewContent.length === 0)) && (
          <div className="mb-8">
            <div className="relative">
              <input
                type="text"
                placeholder={t('kana.browse.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-xl bg-white dark:bg-dark-800 border-2 border-gray-200 dark:border-dark-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
              />
              <div className="absolute top-1/2 right-3 -translate-y-1/2">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Search Results */}
        {searchQuery.trim() && (viewMode === 'browse' ||
          (viewMode === 'study' && studyCharacters.length === 0) ||
          (viewMode === 'review' && reviewContent.length === 0)) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl p-6 shadow-lg"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('kana.browse.searchResults')}
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                ({t('kana.browse.resultsFound', { count: filteredKana.length })})
              </span>
            </h3>
            {filteredKana.length > 0 ? (
              <KanaGrid
                characters={filteredKana}
                progress={progress}
                selectedCharacters={selectedCharacters}
                onCharacterSelect={handleCharacterSelect}
                onTogglePin={handleTogglePin}
                onTogglePinBatch={handleTogglePinBatch}
                onToggleSelection={handleToggleSelection}
                showBothKana={showBothKana}
                displayScript={displayScript}
                viewMode={viewMode}
                getCharacterId={getCharacterId}
              />
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                {t('kana.browse.noResultsFound', { query: searchQuery })}
              </p>
            )}
          </motion.div>
        )}

        {/* Quick Stats */}
        {!searchQuery.trim() && (viewMode === 'browse' ||
          (viewMode === 'study' && studyCharacters.length === 0) ||
          (viewMode === 'review' && reviewContent.length === 0)) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl p-4 text-center shadow-lg cursor-pointer"
              onClick={() => setSelectedCategory('all')}
            >
              <div className="w-8 h-8 bg-blue-500 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-[10px] font-bold">
                ALL
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {kanaData.length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t('kana.browse.charactersLabel')}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl p-4 text-center shadow-lg cursor-pointer"
              onClick={() => setSelectedCategory('basic')}
            >
              <div className="w-8 h-8 bg-green-500 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-sm font-bold">
                基
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {getBasicKana().length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t('kana.browse.basicLabel')}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl p-4 text-center shadow-lg cursor-pointer"
              onClick={() => setSelectedCategory('dakuten')}
            >
              <div className="w-8 h-8 bg-yellow-500 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-lg font-bold">
                が
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {kanaData.filter(k => ['g', 'z', 'd', 'b', 'p'].includes(k.row)).length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t('kana.browse.dakutenLabel')}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl p-4 text-center shadow-lg cursor-pointer"
              onClick={() => setSelectedCategory('digraph')}
            >
              <div className="w-8 h-8 bg-purple-500 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-sm font-bold">
                拗
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {kanaData.filter(k => k.type === 'digraph').length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t('kana.browse.digraphsLabel')}
              </div>
            </motion.div>
          </div>
        )}

        {/* Kana Grid - Only show when not searching */}
        {!searchQuery.trim() && (viewMode === 'browse' ||
          (viewMode === 'study' && studyCharacters.length === 0) ||
          (viewMode === 'review' && reviewContent.length === 0)) && (
            <KanaGrid
              characters={filteredKana}
              progress={progress}
              selectedCharacters={selectedCharacters}
              onCharacterSelect={handleCharacterSelect}
              onTogglePin={handleTogglePin}
              onTogglePinBatch={handleTogglePinBatch}
              onToggleSelection={handleToggleSelection}
              showBothKana={showBothKana}
              displayScript={displayScript}
              viewMode={viewMode}
              getCharacterId={getCharacterId}
            />
        )}

        {viewMode === 'study' && studyCharacters.length > 0 && (
          <div className="flex justify-center py-8">
            <KanaStudyMode
                character={studyCharacters[currentStudyIndex]}
                progress={progress[getCharacterId(studyCharacters[currentStudyIndex].id)] || {}}
                onNext={async () => {
              if (currentStudyIndex < studyCharacters.length - 1) {
                setCurrentStudyIndex(currentStudyIndex + 1)
              } else {
                // End the session - this will save to Firebase via UniversalProgressManager
                if (user) {
                  await kanaProgressManagerV2.endKanaSession(isPremium)
                  // The session is saved automatically by UniversalProgressManager
                  // No need for duplicate saving here
                }

                // Emit URE SESSION_COMPLETED event for NEW gamification system
                const sessionDuration = Date.now() - studySessionStartTime
                const totalCharacters = studyCharacters.length
                const averageTimePerCharacter = totalCharacters > 0 ? sessionDuration / totalCharacters : 0
                const accuracy = totalCharacters > 0 ? (studyCharactersLearned / totalCharacters) * 100 : 0

                const sessionId = `kana_study_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

                ureEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, {
                  data: {
                    sessionId,
                    statistics: {
                      correctItems: studyCharactersLearned,
                      accuracy: accuracy,
                      averageResponseTime: averageTimePerCharacter,
                      bestStreak: studyCharactersLearned // Use learned count as streak for study mode
                    },
                    duration: sessionDuration
                  }
                })

                console.log('[Kana Study] Emitted SESSION_COMPLETED event for gamification:', {
                  sessionId,
                  correctItems: studyCharactersLearned,
                  totalCharacters,
                  accuracy,
                  duration: sessionDuration
                })

                // Reached the end - show completion feedback
                showToast(t('learn.studySessionComplete'), 'success')
                // Return to grid after completion
                setViewMode('browse')
                setCurrentStudyIndex(0)
                setStudyCharacters([])  // Clear study characters
                setSelectedCharacters([]) // Clear selection
                // Reset study session tracking
                setStudySessionStartTime(0)
                setStudyCharactersLearned(0)
              }
            }}
            onPrevious={() => {
              if (currentStudyIndex > 0) {
                setCurrentStudyIndex(currentStudyIndex - 1)
              }
            }}
            onBack={async () => {
              // End session when going back
              if (user) {
                await kanaProgressManagerV2.endKanaSession(isPremium)
              }
              setViewMode('browse')
              setCurrentStudyIndex(0) // Reset index when going back
              setStudyCharacters([])  // Clear study characters
              setSelectedCharacters([]) // Clear selection
              // Reset study session tracking
              setStudySessionStartTime(0)
              setStudyCharactersLearned(0)
            }}
            onUpdateProgress={async (characterId, updates) => {
              // Ensure we use the prefixed character ID for consistency
              const prefixedId = getCharacterId(characterId)

              // Track if character was marked as learned for gamification
              if (updates.status === 'learned') {
                setStudyCharactersLearned(prev => prev + 1)
              }

              // Update local state immediately
              setProgress(prev => ({
                ...prev,
                [prefixedId]: { ...prev[prefixedId], ...updates }
              }))

              // Save to storage
              await saveProgressUpdate(prefixedId, updates)
            }}
            onTogglePin={() => handleTogglePin(studyCharacters[currentStudyIndex].id)}
            showBothKana={showBothKana}
            currentIndex={currentStudyIndex + 1}
            totalCharacters={studyCharacters.length}
            displayScript={displayScript}
          />
          </div>
        )}

        {viewMode === 'review' && (
          <div className="flex justify-center py-8">
            <ReviewEngine
              content={reviewContent}
              contentPool={reviewContentPool.length > 0 ? reviewContentPool : reviewContent}
              userId={user?.uid || 'anonymous'}
              onComplete={handleReviewComplete}
              onCancel={() => setViewMode('browse')}
            />
          </div>
        )}
      </main>

      </div>

      {/* Kana Details Modal */}
      <KanaDetailsModal
        character={modalCharacter}
        isOpen={!!modalCharacter}
        onClose={() => setModalCharacter(null)}
        displayScript={displayScript}
      />
    </>
  )
}
