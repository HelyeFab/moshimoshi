'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'
import LearningPageHeader from '@/components/learn/LearningPageHeader'
import Navbar from '@/components/layout/Navbar'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { TextbookSelector } from './components/TextbookSelector'
import { VocabularyDisplay, VocabularyItem } from './components/VocabularyDisplay'
import dynamic from 'next/dynamic'
import { TextbookVocabularyAdapter } from '@/lib/review-engine/adapters/TextbookVocabularyAdapter'
import { ReviewEventType } from '@/lib/review-engine/core/events'
import { getEventHub, initializeEventHub } from '@/lib/review-engine/core/event-hub'
import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { SessionStatistics } from '@/lib/review-engine/core/session.types'
import {
  textbookVocabularyProgressManager,
  TextbookVocabProgressData
} from '@/utils/textbookVocabularyProgressManager'

// All gamification uses Event Hub (global singleton)
// ReviewSessionUI handles initialization automatically

// Dynamically import ReviewSessionUI for review mode
const ReviewSessionUI = dynamic(() => import('@/components/review-engine/ReviewSessionUI'), {
  loading: () => <LoadingOverlay isLoading={true} />,
  ssr: false,
})

// Dynamically import TextbookVocabularyStudyMode for study mode
const TextbookVocabularyStudyMode = dynamic(
  () => import('@/components/textbook-vocabulary/TextbookVocabularyStudyMode'),
  {
    loading: () => <LoadingOverlay isLoading={true} />,
    ssr: false,
  }
)

type ViewMode = 'browse' | 'study' | 'review'

export default function TextbookVocabularyPage() {
  const { user } = useAuth()
  const { isPremium } = useSubscription()
  const { strings } = useI18n()
  const { showToast } = useToast()

  // Core state
  const [selectedTextbook, setSelectedTextbook] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('browse')

  // Vocabulary data
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([])
  const [filteredVocabulary, setFilteredVocabulary] = useState<VocabularyItem[]>([])
  const [currentLesson, setCurrentLesson] = useState<number | 'all'>('all')

  // Selection state
  const [selectedVocab, setSelectedVocab] = useState<Set<string>>(new Set())

  // Review state
  const [reviewContent, setReviewContent] = useState<ReviewableContent[]>([])
  const [reviewContentPool, setReviewContentPool] = useState<ReviewableContent[]>([])

  // Study state
  const [selectedVocabData, setSelectedVocabData] = useState<VocabularyItem[]>([])
  const [currentStudyIndex, setCurrentStudyIndex] = useState(0)
  const [studySessionStartTime, setStudySessionStartTime] = useState<number>(0)

  // Progress tracking
  const [vocabProgress, setVocabProgress] = useState<Map<string, TextbookVocabProgressData>>(
    new Map()
  )

  // Initialize adapter
  const vocabAdapter = useMemo(
    () =>
      new TextbookVocabularyAdapter({
        contentType: 'textbook_vocabulary',
        availableModes: [
          {
            mode: 'recognition' as const,
            showPrimary: true,
            showSecondary: false,
            showTertiary: false,
            showMedia: false,
            inputType: 'multiple-choice' as const,
            optionCount: 4,
            allowHints: true,
          },
          {
            mode: 'listening' as const,
            showPrimary: false,
            showSecondary: false,
            showTertiary: false,
            showMedia: true,
            inputType: 'multiple-choice' as const,
            optionCount: 4,
            allowHints: false,
          },
        ],
        defaultMode: 'recognition' as const,
        validationStrategy: 'fuzzy' as const,
        features: {},
      }),
    []
  )

  // Event Hub initialization removed - ReviewSessionUI handles this automatically

  // Load progress when textbook changes
  const refreshProgress = useCallback(async () => {
    if (user && selectedTextbook) {
      const progress = await textbookVocabularyProgressManager.getTextbookProgress(
        user,
        isPremium ?? false,
        selectedTextbook
      )
      setVocabProgress(progress)
    }
  }, [user, isPremium, selectedTextbook])

  // Initialize Event Hub for gamification (required for study mode XP)
  // Review mode uses ReviewSessionUI which also initializes the hub
  useEffect(() => {
    if (user?.uid) {
      initializeEventHub(user.uid)
      console.log('[Textbook Vocabulary] Event Hub initialized for user:', user.uid)
    }
  }, [user?.uid])

  useEffect(() => {
    if (selectedTextbook) {
      refreshProgress()
    }
  }, [selectedTextbook, refreshProgress])

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredVocabulary.length
    let learned = 0
    vocabProgress.forEach((progress) => {
      if (progress.status === 'learned' || progress.status === 'mastered') {
        learned++
      }
    })
    return { total, learned }
  }, [filteredVocabulary, vocabProgress])

  // Handlers
  const handleTextbookSelect = (textbookId: string) => {
    setIsLoading(true)
    setSelectedTextbook(textbookId)
    setSelectedVocab(new Set())
    setViewMode('browse')
    setTimeout(() => setIsLoading(false), 500)
  }

  const handleBack = () => {
    if (viewMode !== 'browse') {
      setViewMode('browse')
    } else {
      setSelectedTextbook(null)
      setVocabulary([])
      setFilteredVocabulary([])
      setSelectedVocab(new Set())
      setVocabProgress(new Map())
    }
  }

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    // Clear selections when switching back to browse
    if (mode === 'browse') {
      setSelectedVocab(new Set())
      setSelectedVocabData([])
    }
  }

  const handleVocabularyLoaded = useCallback((loadedVocab: VocabularyItem[]) => {
    setVocabulary(loadedVocab)
  }, [])

  const handleFilteredVocabularyChange = useCallback((filtered: VocabularyItem[]) => {
    setFilteredVocabulary(filtered)
  }, [])

  const handleLessonChange = useCallback((lesson: number | 'all') => {
    setCurrentLesson(lesson)
    // Clear selection when lesson changes
    setSelectedVocab(new Set())
  }, [])

  const handleToggleSelection = useCallback((id: string) => {
    setSelectedVocab((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    const allIds = filteredVocabulary.map((v) => v.id)
    setSelectedVocab(new Set(allIds))
  }, [filteredVocabulary])

  const handleClearSelection = useCallback(() => {
    setSelectedVocab(new Set())
  }, [])

  // Start Study Mode
  const handleStartStudy = useCallback(() => {
    if (selectedVocab.size === 0) {
      showToast('Please select vocabulary items to study', 'warning')
      return
    }

    const vocabToStudy = vocabulary.filter((v) => selectedVocab.has(v.id))
    setSelectedVocabData(vocabToStudy)
    setCurrentStudyIndex(0)
    setStudySessionStartTime(Date.now())
    setViewMode('study')
  }, [selectedVocab, vocabulary, showToast])

  // Start Review Mode
  const handleStartReview = useCallback(() => {
    if (selectedVocab.size === 0) {
      showToast('Please select vocabulary items to review', 'warning')
      return
    }

    const vocabToReview = vocabulary.filter((v) => selectedVocab.has(v.id))

    // Transform selected items to ReviewableContent
    const content = vocabToReview.map((v) => vocabAdapter.transform(v))
    setReviewContent(content)

    // Create pool from filtered vocabulary (same lesson/chapter) for distractors
    const poolItems = filteredVocabulary.map((v) => vocabAdapter.transform(v))
    setReviewContentPool(poolItems)

    setViewMode('review')
  }, [selectedVocab, vocabulary, filteredVocabulary, vocabAdapter, showToast])

  // Study navigation
  const handleStudyNext = useCallback(() => {
    if (currentStudyIndex < selectedVocabData.length - 1) {
      setCurrentStudyIndex((prev) => prev + 1)
    } else {
      // Study mode awards XP - PRODUCT REQUIREMENT
      // While architecturally study mode is "passive learning",
      // users expect XP for completing study sessions.
      // This is intentional user-facing behavior, not a bug.
      const sessionDuration = Date.now() - studySessionStartTime
      const totalItems = selectedVocabData.length

      const sessionId = `study_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      getEventHub().emit(ReviewEventType.SESSION_COMPLETED, {
        data: {
          sessionId,
          statistics: {
            correctItems: totalItems,
            accuracy: 100, // Study mode assumes completion = success
            averageResponseTime: totalItems > 0 ? sessionDuration / totalItems : 0,
            bestStreak: totalItems,
          },
          duration: sessionDuration,
        },
      })

      console.log('[Textbook Vocabulary Study] SESSION_COMPLETED emitted (Product Requirement):', {
        sessionId,
        items: totalItems,
        duration: sessionDuration,
      })

      showToast('Study session complete!', 'success')
      setViewMode('browse')
      refreshProgress()
    }
  }, [currentStudyIndex, selectedVocabData.length, studySessionStartTime, showToast, refreshProgress])

  const handleStudyPrevious = useCallback(() => {
    if (currentStudyIndex > 0) {
      setCurrentStudyIndex((prev) => prev - 1)
    }
  }, [currentStudyIndex])

  const handleStudyBack = useCallback(() => {
    setViewMode('browse')
  }, [])

  const handleProgressUpdate = useCallback(
    (vocabId: string, updates?: Partial<any>) => {
      refreshProgress()
    },
    [refreshProgress]
  )

  // Review complete
  const handleReviewComplete = useCallback(
    (statistics: SessionStatistics) => {
      // SessionManager emits SESSION_COMPLETED automatically via Event Hub
      // No manual event emission needed - gamification happens automatically!
      console.log('[Textbook Vocabulary] Session completed:', {
        correctItems: statistics.correctItems,
        accuracy: statistics.accuracy,
        totalTime: statistics.totalTime,
      })

      showToast('Review session complete!', 'success')
      setViewMode('browse')
      refreshProgress()
    },
    [showToast, refreshProgress]
  )

  const handleReviewCancel = useCallback(() => {
    setViewMode('browse')
  }, [])

  // Determine if in selection mode (browse, study, or review mode before session starts)
  const isSelectionMode = selectedTextbook !== null && (
    viewMode === 'browse' ||
    (viewMode === 'study' && selectedVocabData.length === 0) ||
    (viewMode === 'review' && reviewContent.length === 0)
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-sakura-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Desktop Navbar - hidden during active study/review sessions */}
      {!(viewMode === 'review' && reviewContent.length > 0) &&
        !(viewMode === 'study' && selectedVocabData.length > 0) && (
        <div className="hidden sm:block">
          <Navbar user={user} showUserMenu={true} />
        </div>
      )}

      {/* Header with mode switching - OUTSIDE container for full width */}
      {selectedTextbook && isSelectionMode && (
        <LearningPageHeader
          title={'Textbook Vocabulary'}
          description={'Study vocabulary from your textbook'}
          stats={stats}
          mode={viewMode}
          onModeChange={handleModeChange}
          selectionMode={isSelectionMode}
          selectedCount={selectedVocab.size}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onStartStudy={handleStartStudy}
          onStartReview={handleStartReview}
          backHref="/dashboard"
        />
      )}

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <AnimatePresence mode="wait">
          {isLoading && <LoadingOverlay />}

          {/* Textbook Selection */}
          {!selectedTextbook && (
            <motion.div
              key="selector"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <TextbookSelector onSelectTextbook={handleTextbookSelect} />
            </motion.div>
          )}

          {/* Browse/Selection Mode - show vocabulary grid for selection */}
          {selectedTextbook && isSelectionMode && (
            <motion.div
              key="browse"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <VocabularyDisplay
                textbookId={selectedTextbook}
                onBack={handleBack}
                selectionMode={isSelectionMode}
                selectedItems={selectedVocab}
                onToggleSelection={handleToggleSelection}
                progressMap={vocabProgress}
                onVocabularyLoaded={handleVocabularyLoaded}
                onFilteredVocabularyChange={handleFilteredVocabularyChange}
                onLessonChange={handleLessonChange}
              />
            </motion.div>
          )}

          {/* Study Mode */}
          {selectedTextbook && viewMode === 'study' && selectedVocabData.length > 0 && (
            <motion.div
              key="study"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <TextbookVocabularyStudyMode
                vocabulary={selectedVocabData[currentStudyIndex]}
                onNext={handleStudyNext}
                onPrevious={handleStudyPrevious}
                onBack={handleStudyBack}
                currentIndex={currentStudyIndex + 1}
                totalItems={selectedVocabData.length}
                onProgressUpdate={handleProgressUpdate}
              />
            </motion.div>
          )}

          {/* Review Mode */}
          {selectedTextbook && viewMode === 'review' && reviewContent.length > 0 && user && (
            <motion.div
              key="review"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ReviewSessionUI
                content={reviewContent}
                contentPool={reviewContentPool}
                mode="recognition"
                onComplete={handleReviewComplete}
                onCancel={handleReviewCancel}
                userId={user.uid}
                shuffle={false}
              />
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      <MobileNavSpacer />
    </div>
  )
}
