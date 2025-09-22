'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { useAchievementStore } from '@/stores/achievement-store'
import { kanaProgressManager, type CharacterProgress as ManagerProgress } from '@/utils/kanaProgressManager'
import { kanaProgressManagerV2 } from '@/utils/kanaProgressManagerV2'
import { kanaData, getBasicKana, playKanaAudio, type KanaCharacter } from '@/data/kanaData'
import KanaFilters from '@/components/learn/KanaFilters'
import Navbar from '@/components/layout/Navbar'
import LearningPageHeader from '@/components/learn/LearningPageHeader'
import { LoadingOverlay } from '@/components/ui/Loading'
import KanaDetailsModal from '@/components/learn/KanaDetailsModal'
import { KanaAdapter } from '@/lib/review-engine/adapters/kana.adapter'
import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { SessionStatistics } from '@/lib/review-engine/core/session.types'
import { recordActivityAndSync } from '@/lib/sync/streakSync'
import { StreakActivity } from '@/stores/streakStore'

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
  const [reviewContent, setReviewContent] = useState<ReviewableContent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastSessionStats, setLastSessionStats] = useState<SessionStatistics | null>(null)
  const [currentStudyIndex, setCurrentStudyIndex] = useState(0)
  const [modalCharacter, setModalCharacter] = useState<KanaCharacter | null>(null)
  
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
          filtered = sourceData.filter(k => k.type === 'dakuten' || k.type === 'handakuten')
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
            return k.type === 'dakuten'
          case 'handakuten':
            return k.type === 'handakuten'
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

  // Load progress from KanaProgressManager
  useEffect(() => {
    const loadProgress = async () => {
      if (!user) {
        // Guest users: clear any existing progress
        setProgress({})
        return
      }

      // Try to migrate from localStorage first (one-time operation)
      const migrationKey = `kana-progress-${defaultScript}-${user.uid}-migrated`
      if (!localStorage.getItem(migrationKey)) {
        await kanaProgressManager.migrateFromLocalStorage(defaultScript, user, isPremium)
      }

      // Load progress from KanaProgressManager (IndexedDB + Firebase for premium)
      const savedProgress = await kanaProgressManager.getProgress(defaultScript, user, isPremium)

      // Convert to component's expected format
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
    // In browse mode, always open modal
    // In study/review modes, clicking the card also opens modal (pin is for selection)
    setModalCharacter(character)
  }, [])

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
    // Record review session for streak
    await recordActivityAndSync(
      StreakActivity.REVIEW_SESSION,
      isPremium,
      Date.now()
    )

    setLastSessionStats(stats)
    setViewMode('browse')

    // Update achievements and streak
    const achievementStore = useAchievementStore.getState()
    await achievementStore.updateProgress({
      sessionType: 'kana',
      itemsReviewed: stats.totalItems,
      accuracy: stats.accuracy,
      duration: stats.duration,
      completedAt: new Date()
    })

    showToast(`${t('review.sessionComplete')} - ${t('common.accuracy')}: ${stats.accuracy.toFixed(1)}%`, 'success')
  }, [showToast, t])

  // Toggle character pin status
  const handleTogglePin = useCallback(async (characterId: string) => {
    const currentPinned = progress[characterId]?.pinned || false

    // Update local state immediately for UI responsiveness
    setProgress(prev => ({
      ...prev,
      [characterId]: {
        ...prev[characterId],
        pinned: !currentPinned
      }
    }))

    // Save to storage
    await saveProgressUpdate(characterId, { pinned: !currentPinned })
  }, [progress, saveProgressUpdate])

  // Batch toggle pin status for multiple characters
  const handleTogglePinBatch = useCallback(async (characterIds: string[], pinned: boolean) => {
    // Update local state immediately
    setProgress(prev => {
      const updated = { ...prev }
      characterIds.forEach(charId => {
        if (!updated[charId]) {
          updated[charId] = {
            status: 'not-started' as ProgressStatus,
            reviewCount: 0,
            correctCount: 0,
            pinned: false,
            updatedAt: new Date()
          }
        }
        updated[charId] = {
          ...updated[charId],
          pinned
        }
      })
      return updated
    })

    // Save all updates to storage
    for (const charId of characterIds) {
      await saveProgressUpdate(charId, { pinned })
    }
  }, [saveProgressUpdate])

  // Get progress stats
  const progressStats = useMemo(() => {
    const total = filteredKana.length
    const learned = filteredKana.filter(k => progress[k.id]?.status === 'learned').length
    const learning = filteredKana.filter(k => progress[k.id]?.status === 'learning').length
    const notStarted = total - learned - learning

    return {
      total,
      learned,
      learning,
      notStarted,
      learnedPercentage: total > 0 ? Math.round((learned / total) * 100) : 0,
      learningPercentage: total > 0 ? Math.round((learning / total) * 100) : 0
    }
  }, [filteredKana, progress])

  // Count pinned characters that are not already selected
  const pinnedCharacters = useMemo(() => {
    return filteredKana.filter(k =>
      progress[k.id]?.pinned &&
      !selectedCharacters.some(sc => sc.id === k.id)
    )
  }, [filteredKana, progress, selectedCharacters])

  // Total count for review/study (selected + pinned)
  const totalForReview = selectedCharacters.length + pinnedCharacters.length

  // Start study mode
  const handleStartStudy = useCallback(async () => {
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

    // Start a new session
    if (user) {
      const script = displayScript as 'hiragana' | 'katakana'
      await kanaProgressManagerV2.startKanaSession(script, user)
    }

    // Update selected characters to include pinned ones
    setSelectedCharacters(allCharacters)
    setCurrentStudyIndex(0) // Reset index when starting study
    setViewMode('study')
  }, [selectedCharacters, pinnedCharacters, showToast, t, user, displayScript])

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

    // Convert all characters to ReviewableContent
    const content = convertToReviewableContent(allCharacters)
    setReviewContent(content)
    setViewMode('review')
  }, [selectedCharacters, pinnedCharacters, showToast, t, convertToReviewableContent])

  // Quick review - review only struggling characters
  const handleQuickReview = useCallback(() => {
    const strugglingChars = filteredKana.filter(k => {
      const p = progress[k.id]
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

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-sakura-50 to-white dark:from-gray-900 dark:to-gray-800">
        <LoadingOverlay isLoading={isLoading} />

      {/* Header */}
      <Navbar user={user} showUserMenu={true} />
      <LearningPageHeader
        title={defaultScript === 'katakana' ? t('learn.katakana') : t('learn.hiragana')}
        description={defaultScript === 'katakana'
          ? 'Master the Japanese Katakana writing system'
          : 'Master the Japanese Hiragana writing system'}
        subtitle={`Learn all ${filteredKana.length} characters through interactive practice`}
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
          }
        }}
        selectedCount={selectedCharacters.length}
        onSelectAll={handleSelectAll}
        onClearSelection={handleDeselectAll}
        onStartStudy={handleStartStudy}
        onStartReview={handleStartReview}
      />
      
      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        {(viewMode === 'browse' ||
          (viewMode === 'study' && selectedCharacters.length === 0) ||
          (viewMode === 'review' && reviewContent.length === 0)) && (
          <>
            <KanaFilters
              filterType={filter}
              onFilterChange={setFilter}
              showLearned={false}
              onShowLearnedChange={() => {}}
              showNotStarted={true}
              onShowNotStartedChange={() => {}}
              showBothKana={showBothKana}
              onShowBothKanaChange={setShowBothKana}
              displayScript={displayScript}
              onDisplayScriptChange={setDisplayScript}
            />

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
            />
          </>
        )}

        {viewMode === 'study' && selectedCharacters.length > 0 && (
          <KanaStudyMode
            character={selectedCharacters[currentStudyIndex]}
            progress={progress[selectedCharacters[currentStudyIndex].id] || {}}
            onNext={async () => {
              if (currentStudyIndex < selectedCharacters.length - 1) {
                setCurrentStudyIndex(currentStudyIndex + 1)
              } else {
                // End the session
                if (user) {
                  await kanaProgressManagerV2.endKanaSession(isPremium)
                }

                // Record study session for streak
                await recordActivityAndSync(
                  StreakActivity.STUDY_SESSION,
                  isPremium,
                  Date.now()
                )

                // Update achievements and streak for study session
                const achievementStore = useAchievementStore.getState()
                await achievementStore.updateProgress({
                  sessionType: 'kana_study',
                  itemsReviewed: selectedCharacters.length,
                  accuracy: 100, // Study mode is practice, assume completion is success
                  duration: 0, // Duration tracking could be added if needed
                  completedAt: new Date()
                })

                // Reached the end - show completion feedback
                showToast(t('learn.studySessionComplete'), 'success')
                // Return to grid after completion
                setViewMode('browse')
                setCurrentStudyIndex(0)
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
            }}
            onUpdateProgress={async (characterId, updates) => {
              // Update local state immediately
              setProgress(prev => ({
                ...prev,
                [characterId]: { ...prev[characterId], ...updates }
              }))

              // Save to storage
              await saveProgressUpdate(characterId, updates)
            }}
            onTogglePin={() => handleTogglePin(selectedCharacters[currentStudyIndex].id)}
            showBothKana={showBothKana}
            currentIndex={currentStudyIndex + 1}
            totalCharacters={selectedCharacters.length}
            displayScript={displayScript}
          />
        )}
        
        {viewMode === 'review' && (
          <ReviewEngine
            content={reviewContent}
            userId={user?.uid || 'anonymous'}
            onComplete={handleReviewComplete}
            onCancel={() => setViewMode('browse')}
          />
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