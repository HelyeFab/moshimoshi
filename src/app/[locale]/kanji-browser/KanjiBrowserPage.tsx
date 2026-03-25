'use client'

import { useState, useEffect, Suspense, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Kanji, JLPTLevel, KanjiByLevel } from '@/types/kanji'
import {
  KanjiStudySessionState,
  StudySessionSource,
  isLegacySession,
  isCurrentSession,
  getSessionPosition,
  advanceToNextCard,
  goToPreviousCard,
  StudySessionKanjiItem,
  MeaningCard,
  VocabularyCard,
  StudyMode,
} from '@/types/kanji-study'
import { kanjiService } from '@/services/kanjiService'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'
// Navigation is now global via NavigationWrapper in root layout
import LearningPageHeader from '@/components/learn/LearningPageHeader'
import { LoadingOverlay, LoadingSpinner } from '@/components/ui/Loading'
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { useTheme } from '@/lib/theme/ThemeContext'
import { motion } from 'framer-motion'
import { useKanjiBrowser } from '@/hooks/useKanjiBrowser'
import { useAuth } from '@/hooks/useAuth'
import { Pencil, Pin, Search, X, BookOpen, RotateCw } from 'lucide-react'
import { useSubscription } from '@/hooks/useSubscription'
import dynamic from 'next/dynamic'
import { KanjiBrowserAdapter } from '@/lib/review-engine/adapters/KanjiBrowserAdapter'
import { ReviewEventType } from '@/lib/review-engine/core/events'
import { getEventHub, initializeEventHub } from '@/lib/review-engine/core/event-hub'
import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { SessionStatistics } from '@/lib/review-engine/core/session.types'
import { kanjiProgressManager, type KanjiProgressData } from '@/utils/kanjiProgressManager'
import Navbar from '@/components/layout/Navbar'
import { FeatureUsageIndicator } from '@/components/entitlements/FeatureUsageIndicator'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { useFeature } from '@/hooks/useFeature'
import { hasSeenKanjiLookup } from '@/utils/kanjiLookupSeen'
import KanjiStudySlotsIndicator from '@/components/kanji/KanjiStudySlotsIndicator'
import { isKanjiBrowserStudyEnabledForEmail } from '@/lib/features/kanjiBrowserStudyRollout'

// All gamification uses Event Hub (global singleton)
// ReviewSessionUI handles initialization automatically

// Dynamically import ReviewSessionUI for review mode
const ReviewSessionUI = dynamic(() => import('@/components/review-engine/ReviewSessionUI'), {
  loading: () => <LoadingOverlay isLoading={true} />,
  ssr: false,
})

// Dynamically import KanjiStudyMode for study mode
const KanjiStudyMode = dynamic(() => import('@/components/kanji/KanjiStudyMode'), {
  loading: () => <LoadingOverlay isLoading={true} />,
  ssr: false,
})

// Dynamically import DrawingSearchModal for drawing search
const DrawingSearchModal = dynamic(
  () => import('@/components/drawing-practice/DrawingSearchModal'),
  { ssr: false }
)

type ViewMode = 'browse' | 'study' | 'review'
type KanjiBrowseFilter = 'all' | 'unlocked' | 'learned'

interface KanjiStudySlotsStatus {
  plan: string
  unlockedCount: number
  unlockedKanji: string[]
  remaining: number
  limit: number
  isUnlimited: boolean
  canStudy: boolean
}

function KanjiBrowserContent() {
  const { strings } = useI18n()
  const { showToast } = useToast()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()
  const { isPremium } = useSubscription()
  const router = useRouter()
  const { checkOnly: checkKanjiLookupOnly } = useFeature('kanji_lookup')
  const isKanjiBrowserStudyEnabled = isKanjiBrowserStudyEnabledForEmail(user?.email)

  const [kanjiData, setKanjiData] = useState<KanjiByLevel>({})
  const [loading, setLoading] = useState(true)
  const [loadingLevels, setLoadingLevels] = useState<Set<JLPTLevel>>(new Set())
  const [modalKanji, setModalKanji] = useState<Kanji | null>(null)
  const [expandedLevels, setExpandedLevels] = useState<Set<JLPTLevel>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Kanji[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [showDrawingSearch, setShowDrawingSearch] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('browse')
  const [selectedKanji, setSelectedKanji] = useState<Set<string>>(new Set())
  const [reviewContent, setReviewContent] = useState<ReviewableContent[]>([])
  const [reviewContentPool, setReviewContentPool] = useState<ReviewableContent[]>([])
  const [lastSessionStats, setLastSessionStats] = useState<SessionStatistics | null>(null)
  const [studySession, setStudySession] = useState<KanjiStudySessionState | null>(null)
  const [restoredStudySessionForUser, setRestoredStudySessionForUser] = useState<string | null>(null)
  const [preferredStudyMode, setPreferredStudyMode] = useState<StudyMode>('vocabulary-first')
  const [masteredDashboardExpanded, setMasteredDashboardExpanded] = useState(true)
  const [studySlotsStatus, setStudySlotsStatus] = useState<KanjiStudySlotsStatus | null>(null)
  const [studySlotsLoading, setStudySlotsLoading] = useState(false)
  const [browseFilter, setBrowseFilter] = useState<KanjiBrowseFilter>('all')

  const markVocabularyCardTracked = useCallback(
    (session: KanjiStudySessionState, cardId: string): KanjiStudySessionState => {
      if (session.trackedVocabularyCardIds.includes(cardId)) {
        return session
      }

      return {
        ...session,
        trackedVocabularyCardIds: [...session.trackedVocabularyCardIds, cardId],
      }
    },
    []
  )

  // Handler to safely change view mode and clear session state
  const handleModeChange = (mode: ViewMode) => {
    if (mode === 'study' && !isKanjiBrowserStudyEnabled) {
      setViewMode('browse')
      return
    }
    setViewMode(mode)
    // Clear session data when switching modes to prevent leftover state
    setSelectedKanji(new Set())
    setStudySession(null)
    setReviewContent([])
    setReviewContentPool([])
  }

  // Progress tracking for visual indicators
  const [kanjiProgress, setKanjiProgress] = useState<Map<string, KanjiProgressData>>(new Map())

  // Use the kanji browser hook for review system integration
  const {
    session,
    kanji: browseKanji,
    bookmarks,
    filters,
    loading: browseLoading,
    hasMore,
    dailyUsage,
    applyFilters,
    addToReview,
    toggleBookmark,
    loadMore,
    getBrowseStats,
    canAddMore,
  } = useKanjiBrowser()

  // No page-level entitlement gate: allow page load, gate actions only.

  // Initialize kanji adapter for converting to ReviewableContent
  const kanjiAdapter = useMemo(
    () =>
      new KanjiBrowserAdapter({
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
        validationStrategy: 'exact' as const,
        features: {},
      }),
    []
  )

  // JLPT level info
  const levelInfo = {
    N5: {
      name: 'N5 (Beginner)',
      color: 'bg-green-500',
      borderColor: 'border-green-500',
      textColor: 'text-green-600 dark:text-green-400',
      bgGradient: 'from-green-400 to-emerald-500',
      description: 'Basic kanji for daily use',
      count: 80,
    },
    N4: {
      name: 'N4 (Elementary)',
      color: 'bg-blue-500',
      borderColor: 'border-blue-500',
      textColor: 'text-blue-600 dark:text-blue-400',
      bgGradient: 'from-blue-400 to-indigo-500',
      description: 'Elementary level kanji',
      count: 170,
    },
    N3: {
      name: 'N3 (Intermediate)',
      color: 'bg-yellow-500',
      borderColor: 'border-yellow-500',
      textColor: 'text-yellow-600 dark:text-yellow-400',
      bgGradient: 'from-yellow-400 to-amber-500',
      description: 'Intermediate level kanji',
      count: 370,
    },
    N2: {
      name: 'N2 (Upper-Intermediate)',
      color: 'bg-orange-500',
      borderColor: 'border-orange-500',
      textColor: 'text-orange-600 dark:text-orange-400',
      bgGradient: 'from-orange-400 to-red-500',
      description: 'Upper-intermediate kanji',
      count: 380,
    },
    N1: {
      name: 'N1 (Advanced)',
      color: 'bg-red-500',
      borderColor: 'border-red-500',
      textColor: 'text-red-600 dark:text-red-400',
      bgGradient: 'from-red-400 to-rose-500',
      description: 'Advanced level kanji',
      count: 1200,
    },
  }

  const getStudySessionStorageKey = useCallback(
    (userId: string) => `kanji-browser-study-session:${userId}`,
    []
  )

  const activeStudyKanji = useMemo(() => {
    if (!studySession) return []
    return studySession.kanji.map(item => item.kanjiData)
  }, [studySession])

  const currentStudyKanji = studySession
    ? studySession.kanji[studySession.currentKanjiIndex]?.kanjiData ?? null
    : null

  const clearPersistedStudySession = useCallback(() => {
    if (typeof window === 'undefined' || !user?.uid) return
    window.localStorage.removeItem(getStudySessionStorageKey(user.uid))
  }, [getStudySessionStorageKey, user?.uid])

  const loadKanjiStudySlotsStatus = useCallback(async () => {
    setStudySlotsLoading(true)
    try {
      const response = await fetch('/api/kanji-browser/study/status', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`Status request failed: ${response.status}`)
      }

      const result = await response.json()
      setStudySlotsStatus(result)
    } catch (error) {
      console.error('[Kanji Browser] Failed to load study slots status:', error)
      setStudySlotsStatus(null)
    } finally {
      setStudySlotsLoading(false)
    }
  }, [])

  const emitKanjiStudyAnalytics = useCallback(
    (eventName: string, properties: Record<string, unknown>) => {
      try {
        getEventHub().emit(ReviewEventType.ANALYTICS_TRACKED, {
          eventName,
          category: 'kanji-browser-study',
          properties,
        })
        void fetch('/api/kanji-study/analytics', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eventName,
            category: 'kanji-browser-study',
            properties,
          }),
        }).catch(error => {
          console.error('[Kanji Browser] Failed to persist analytics event:', error)
        })
      } catch (error) {
        console.error('[Kanji Browser] Failed to emit analytics event:', error)
      }
    },
    []
  )

  const buildKanjiSelectionData = useCallback(
    (selectedIds: Iterable<string>) => {
      const ids = new Set(selectedIds)
      const kanjiItems: Kanji[] = []

      Object.values(kanjiData).forEach(levelKanji => {
        if (!levelKanji) return
        levelKanji.forEach((item: Kanji) => {
          if (ids.has(item.kanji)) {
            kanjiItems.push(item)
          }
        })
      })

      searchResults.forEach(item => {
        if (ids.has(item.kanji) && !kanjiItems.some(existing => existing.kanji === item.kanji)) {
          kanjiItems.push(item)
        }
      })

      return kanjiItems
    },
    [kanjiData, searchResults]
  )

  const startStudySession = useCallback(
    async (kanjiItems: Kanji[], source: StudySessionSource) => {
      if (kanjiItems.length === 0) {
        showToast('Could not find selected kanji data', 'error')
        return false
      }

      // Create card-based session structure
      let sessionKanji: StudySessionKanjiItem[]

      if (preferredStudyMode === 'vocabulary-first') {
        // Vocabulary-first mode: Generate full card sequences using Agent 1's adapter
        const adapter = new KanjiBrowserAdapter()
        sessionKanji = []

        for (const kanji of kanjiItems) {
          try {
            const sequence = await adapter.generateStudySequence(kanji)
            sessionKanji.push({
              kanjiId: kanji.kanji,
              kanjiData: kanji,
              cards: sequence.cards,
              currentCardIndex: 0,
              completed: false,
            })
          } catch (error) {
            console.error(`[KanjiBrowserPage] Failed to generate vocabulary-first cards for ${kanji.kanji}:`, error)
            // Fallback to traditional mode for this kanji
            const meaningCard: MeaningCard = {
              id: `${kanji.kanji}-meaning`,
              type: 'meaning',
              kanjiCharacter: kanji.kanji,
              primaryMeaning: kanji.meanings[0] || '',
              allMeanings: kanji.meanings,
              strokeCount: kanji.strokeCount,
              jlptLevel: kanji.jlpt,
            }
            sessionKanji.push({
              kanjiId: kanji.kanji,
              kanjiData: kanji,
              cards: [meaningCard],
              currentCardIndex: 0,
              completed: false,
            })
          }
        }
      } else {
        // Traditional mode: Single meaning card per kanji
        sessionKanji = kanjiItems.map(kanji => {
          const meaningCard: MeaningCard = {
            id: `${kanji.kanji}-meaning`,
            type: 'meaning',
            kanjiCharacter: kanji.kanji,
            primaryMeaning: kanji.meanings[0] || '',
            allMeanings: kanji.meanings,
            strokeCount: kanji.strokeCount,
            jlptLevel: kanji.jlpt,
          }

          return {
            kanjiId: kanji.kanji,
            kanjiData: kanji,
            cards: [meaningCard],
            currentCardIndex: 0,
            completed: false,
          }
        })
      }

      const totalCards = sessionKanji.reduce((sum, item) => sum + item.cards.length, 0)

      setStudySession({
        version: 1,
        mode: preferredStudyMode,
        kanji: sessionKanji,
        currentKanjiIndex: 0,
        startedAt: Date.now(),
        source,
        totalCards,
        completedCards: 0,
        trackedVocabularyCardIds: [],
      })
      emitKanjiStudyAnalytics('kanji_study_session_started', {
        mode: preferredStudyMode,
        source,
        kanjiCount: sessionKanji.length,
        totalCards,
        vocabularyCardCount: sessionKanji.reduce(
          (sum, item) => sum + item.cards.filter(card => card.type === 'vocabulary').length,
          0
        ),
      })
      setViewMode('study')
      return true
    },
    [emitKanjiStudyAnalytics, showToast, preferredStudyMode]
  )

  const resumeStudySession = useCallback(() => {
    if (!studySession || studySession.kanji.length === 0) {
      return false
    }

    const position = getSessionPosition(studySession)
    emitKanjiStudyAnalytics('kanji_study_session_resumed', {
      mode: studySession.mode,
      source: studySession.source,
      totalCards: studySession.totalCards,
      completedCards: studySession.completedCards,
      currentKanjiIndex: studySession.currentKanjiIndex,
      currentCardIndex: position.cardIndex,
      currentCardType: position.currentCard?.type || null,
    })
    setViewMode('study')
    return true
  }, [emitKanjiStudyAnalytics, studySession])

  // Event Hub initialization removed - ReviewSessionUI handles this automatically

  useEffect(() => {
    void loadKanjiStudySlotsStatus()
  }, [loadKanjiStudySlotsStatus, user?.uid])

  useEffect(() => {
    if (isKanjiBrowserStudyEnabled) return
    if (viewMode === 'study') {
      setViewMode('browse')
    }
    if (studySession) {
      setStudySession(null)
      clearPersistedStudySession()
    }
  }, [clearPersistedStudySession, isKanjiBrowserStudyEnabled, studySession, viewMode])

  // Load kanji progress for visual indicators (local IndexedDB + premium sync)
  const refreshKanjiProgress = useCallback(async () => {
    if (!user?.uid) {
      setKanjiProgress(new Map())
      return
    }

    const progressMap = await kanjiProgressManager.getKanjiProgressMap(user, isPremium ?? false)

    // Normalize statuses so UI stays consistent even if status is missing
    const normalized = new Map<string, KanjiProgressData>()
    for (const [kanjiId, data] of progressMap.entries()) {
      const viewCount = data.viewCount || 0
      const status =
        data.status ||
        (viewCount >= 6 ? 'learned' : viewCount > 0 ? 'learning' : 'not-started')
      normalized.set(kanjiId, { ...data, status })
    }

    // Fallback: if nothing loaded from manager but user is premium, try direct API fetch
    if (normalized.size === 0 && (isPremium ?? false) && typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/progress/track?contentType=kanji')
        if (res.ok) {
          const json = await res.json()
          const items = (json && json.items) || {}
          Object.entries(items).forEach(([kanjiId, data]) => {
            const viewCount = (data as any).viewCount || 0
            const status =
              (data as any).status ||
              (viewCount >= 6 ? 'learned' : viewCount > 0 ? 'learning' : 'not-started')
            normalized.set(kanjiId, { ...(data as any), status } as KanjiProgressData)
          })
        }
      } catch (err) {
        console.error('[Kanji Progress] Fallback API fetch failed:', err)
      }
    }

    setKanjiProgress(normalized)
  }, [user, isPremium])

  const updateKanjiProgressState = useCallback(
    (kanjiId: string, updates: Partial<KanjiProgressData>) => {
      setKanjiProgress(prev => {
        const next = new Map(prev)
        const existing = next.get(kanjiId) || ({} as KanjiProgressData)
        next.set(kanjiId, {
          ...existing,
          ...updates,
          contentId: kanjiId,
          contentType: 'kanji',
        })
        return next
      })
    },
    []
  )

  const handleProgressUpdate = useCallback(
    (kanjiId: string, updates?: Partial<KanjiProgressData>) => {
      if (updates) {
        updateKanjiProgressState(kanjiId, updates)
      }
      // Refresh from manager to stay in sync with IndexedDB/Firebase
      refreshKanjiProgress()
    },
    [refreshKanjiProgress, updateKanjiProgressState]
  )

  // Initialize Event Hub for gamification (required for study mode XP)
  // Review mode uses ReviewSessionUI which also initializes the hub
  useEffect(() => {
    if (user?.uid) {
      initializeEventHub(user.uid)
      console.log('[Kanji Browser] Event Hub initialized for user:', user.uid)
    }
  }, [user?.uid])

  useEffect(() => {
    refreshKanjiProgress()
  }, [refreshKanjiProgress])

  useEffect(() => {
    if (!user?.uid) {
      setRestoredStudySessionForUser(null)
      return
    }

    if (restoredStudySessionForUser === user.uid) return
    if (studySession) {
      setRestoredStudySessionForUser(user.uid)
      return
    }
    if (typeof window === 'undefined') return

    const raw = window.localStorage.getItem(getStudySessionStorageKey(user.uid))
    setRestoredStudySessionForUser(user.uid)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw)

      // Check for legacy session (no version field)
      if (isLegacySession(parsed)) {
        console.log('[Kanji Browser] Detected legacy session, clearing...')
        clearPersistedStudySession()
        showToast(
          'Previous study session format is outdated and has been cleared. Please start a new session.',
          'info'
        )
        return
      }

      // Validate current session format
      if (!isCurrentSession(parsed)) {
        console.error('[Kanji Browser] Invalid session format:', parsed)
        clearPersistedStudySession()
        return
      }

      // Validate session data
      if (!Array.isArray(parsed.kanji) || parsed.kanji.length === 0) {
        clearPersistedStudySession()
        return
      }

      // Normalize indices to prevent out-of-bounds
      const currentKanjiIndex = Math.min(
        Math.max(Number(parsed.currentKanjiIndex) || 0, 0),
        parsed.kanji.length - 1
      )

      // Normalize current card index for the current kanji
      const currentKanji = parsed.kanji[currentKanjiIndex]
      if (currentKanji) {
        currentKanji.currentCardIndex = Math.min(
          Math.max(Number(currentKanji.currentCardIndex) || 0, 0),
          currentKanji.cards.length - 1
        )
      }

      const restoredSession: KanjiStudySessionState = {
        version: 1,
        mode: parsed.mode || 'traditional',
        kanji: parsed.kanji,
        currentKanjiIndex,
        startedAt: Number(parsed.startedAt) || Date.now(),
        source: parsed.source === 'collection' ? 'collection' : 'manual-selection',
        totalCards: parsed.totalCards || 0,
        completedCards: parsed.completedCards || 0,
        trackedVocabularyCardIds: Array.isArray(parsed.trackedVocabularyCardIds)
          ? parsed.trackedVocabularyCardIds.filter((id): id is string => typeof id === 'string')
          : [],
      }

      setStudySession(restoredSession)
      emitKanjiStudyAnalytics('kanji_study_session_restored_to_dashboard', {
        mode: restoredSession.mode,
        source: restoredSession.source,
        totalCards: restoredSession.totalCards,
        completedCards: restoredSession.completedCards,
        currentKanjiIndex: restoredSession.currentKanjiIndex,
      })
      showToast(
        strings.kanjiBrowser?.collection?.resumeStudySession ||
          'Found your previous kanji study session. Resume when you are ready.',
        'info'
      )
    } catch (error) {
      console.error('[Kanji Browser] Failed to restore study session:', error)
      clearPersistedStudySession()
    }
  }, [
    clearPersistedStudySession,
    getStudySessionStorageKey,
    restoredStudySessionForUser,
    showToast,
    strings.kanjiBrowser?.collection?.resumeStudySession,
    studySession,
    user?.uid,
  ])

  useEffect(() => {
    if (typeof window === 'undefined' || !user?.uid) return

    const storageKey = getStudySessionStorageKey(user.uid)
    if (!studySession || studySession.kanji.length === 0) {
      window.localStorage.removeItem(storageKey)
      return
    }

    window.localStorage.setItem(storageKey, JSON.stringify(studySession))
  }, [getStudySessionStorageKey, studySession, user?.uid])

  // Load kanji data on component mount
  useEffect(() => {
    loadKanjiData()
  }, [])

  // Handle search - pass query directly to avoid stale closure
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.trim()) {
      try {
        setIsSearching(true)
        setHasSearched(true)
        const results = await kanjiService.searchKanji(query.trim())
        setSearchResults(results)
      } catch (error) {
        console.error('Error searching kanji:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    } else {
      setSearchResults([])
      setIsSearching(false)
      setHasSearched(false)
    }
  }, [])

  // Handle drawing search - when a character is selected from the modal
  const handleDrawingCharacterSelect = useCallback((character: string) => {
    // Find the kanji in our data and show its details
    const allKanji = Object.values(kanjiData).flat().filter(Boolean) as Kanji[]
    const foundKanji = allKanji.find(k => k.kanji === character)

    if (foundKanji) {
      setModalKanji(foundKanji)
    } else {
      // If not found in loaded data, set as search query to trigger search
      setSearchQuery(character)
    }

    setShowDrawingSearch(false)
  }, [kanjiData])

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


  const handleKanjiClick = async (kanji: Kanji) => {
    if (!hasSeenKanjiLookup(kanji.kanji)) {
      const decision = await checkKanjiLookupOnly({ failOpen: false })
      if (!decision.allow) {
        const upgradeAction = !isPremium
          ? {
              label: strings?.subscription?.actions?.upgrade || 'Upgrade',
              onClick: () => router.push('/pricing'),
            }
          : undefined
        showToast(strings?.entitlements?.messages?.lookupLimitReached || 'Limit reached', 'warning', 5000, upgradeAction)
        return
      }
    }
    // Always open modal for kanji preview
    setModalKanji(kanji)

    // Track views ONLY in browse mode (not during study/review sessions)
    if (user && viewMode === 'browse') {
      kanjiProgressManager
        .trackKanjiView(kanji.kanji, user, isPremium ?? false)
        .then(() => refreshKanjiProgress())
        .catch(err => console.error('[Kanji Browser] Failed to track kanji view:', err))
      // Optimistic local update for UI feedback
      const existing = kanjiProgress.get(kanji.kanji)
      const viewCount = (existing?.viewCount || 0) + 1
      const status = viewCount >= 6 ? 'learned' : viewCount > 0 ? 'learning' : 'not-started'
      updateKanjiProgressState(kanji.kanji, { viewCount, status })
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
      if (!levelKanji) return
      levelKanji.forEach((k: Kanji) => {
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

  /**
   * Check kanji study access for the given kanji characters
   * Calls the batch API to atomically evaluate and unlock all kanji together
   */
  const checkKanjiStudyAccess = async (
    kanjiCharacters: string[]
  ): Promise<{
    allowed: boolean
    reason?: 'guest' | 'limit_reached' | 'error'
    totalUnlockedCount?: number
    remaining?: number
    newKanjiCount?: number
    alreadyUnlockedCount?: number
  }> => {
    // Guest check
    if (!user) {
      return { allowed: false, reason: 'guest' }
    }

    const sanitizedKanji = Array.from(
      new Set(
        kanjiCharacters.filter(
          (value): value is string => typeof value === 'string' && Array.from(value).length === 1
        )
      )
    )

    if (sanitizedKanji.length === 0) {
      console.warn('[Kanji Browser] Skipping study access check because no valid kanji characters were provided')
      return { allowed: false, reason: 'error' }
    }

    try {
      // Call batch access API to check all kanji together
      const response = await fetch('/api/kanji-browser/study/access/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kanji: sanitizedKanji })
      })

      if (!response.ok) {
        console.error('[Kanji Browser] Batch access check failed:', response.status)
        return { allowed: false, reason: 'error' }
      }

      const result = await response.json()

      if (!result.allow) {
        return {
          allowed: false,
          reason: result.reason === 'Authentication required' ? 'guest' : 'limit_reached',
          totalUnlockedCount: result.totalUnlockedCount,
          remaining: result.remaining,
          newKanjiCount: result.newUnlockCount,
          alreadyUnlockedCount: result.alreadyUnlockedCount
        }
      }

      return {
        allowed: true,
        totalUnlockedCount: result.totalUnlockedCount,
        remaining: result.remaining,
        newKanjiCount: result.newUnlockCount,
        alreadyUnlockedCount: result.alreadyUnlockedCount
      }
    } catch (error) {
      console.error('[Kanji Browser] Error checking study access:', error)
      return { allowed: false, reason: 'error' }
    }
  }

  const handleStartStudy = async () => {
    if (!isKanjiBrowserStudyEnabled) {
      showToast('Kanji Browser study is not available yet on this account', 'info')
      return
    }

    if (selectedKanji.size === 0) {
      showToast('Please select kanji to study', 'warning')
      return
    }

    // Check study access for all selected kanji
    const accessCheckResult = await checkKanjiStudyAccess(Array.from(selectedKanji))
    if (!accessCheckResult.allowed) {
      // Show appropriate error message based on the reason
      if (accessCheckResult.reason === 'guest') {
        showToast(
          strings.kanjiBrowser?.studyGating?.guestDenied || 'Please sign in to study kanji',
          'warning',
          5000,
          {
            label: strings.kanjiBrowser?.studyGating?.signIn || 'Sign In',
            onClick: () => router.push('/login')
          }
        )
      } else if (accessCheckResult.reason === 'limit_reached') {
        const totalNewKanji = accessCheckResult.newKanjiCount || 0
        const alreadyUnlocked = accessCheckResult.alreadyUnlockedCount || 0
        showToast(
          (strings.kanjiBrowser?.studyGating?.limitReached ||
            'You have unlocked all {unlocked} free kanji study slots. Selected kanji includes {new} new kanji. Upgrade to unlock unlimited kanji study.')
            .replace('{unlocked}', (accessCheckResult.totalUnlockedCount || 10).toString())
            .replace('{new}', totalNewKanji.toString()),
          'warning',
          7000,
          !isPremium ? {
            label: strings.kanjiBrowser?.studyGating?.upgradeToPremium || 'Upgrade to Premium',
            onClick: () => router.push('/pricing')
          } : undefined
        )
      }
      return
    }

    const kanjiDataArray = buildKanjiSelectionData(selectedKanji)
    await loadKanjiStudySlotsStatus()
    await startStudySession(kanjiDataArray, 'manual-selection')
  }

  const handleStudyAllMastered = async () => {
    if (!isKanjiBrowserStudyEnabled) {
      showToast('Kanji Browser study is not available yet on this account', 'info')
      return
    }

    if (studySession?.source === 'collection' && studySession.currentKanjiIndex < studySession.kanji.length) {
      const resumed = resumeStudySession()
      if (resumed) {
        showToast(
          strings.kanjiBrowser?.collection?.resumeStudySession || 'Resumed your kanji study session',
          'info'
        )
        return
      }
    }

    const learnedKanji = (Object.values(masteredKanjiByLevel).flat() as Kanji[])
      .filter((item, index, array) => array.findIndex(existing => existing.kanji === item.kanji) === index)

    if (learnedKanji.length === 0) {
      showToast(strings.kanjiBrowser?.collection?.noLearnedKanji || 'No learned kanji to study', 'warning')
      return
    }

    // Check study access for all learned kanji
    const accessCheckResult = await checkKanjiStudyAccess(learnedKanji.map(item => item.kanji))
    if (!accessCheckResult.allowed) {
      // Show appropriate error message based on the reason
      if (accessCheckResult.reason === 'guest') {
        showToast(
          strings.kanjiBrowser?.studyGating?.guestDenied || 'Please sign in to study kanji',
          'warning',
          5000,
          {
            label: strings.kanjiBrowser?.studyGating?.signIn || 'Sign In',
            onClick: () => router.push('/login')
          }
        )
      } else if (accessCheckResult.reason === 'limit_reached') {
        const totalNewKanji = accessCheckResult.newKanjiCount || 0
        const alreadyUnlocked = accessCheckResult.alreadyUnlockedCount || 0
        showToast(
          (strings.kanjiBrowser?.studyGating?.limitReached ||
            'You have unlocked all {unlocked} free kanji study slots. Selected kanji includes {new} new kanji. Upgrade to unlock unlimited kanji study.')
            .replace('{unlocked}', (accessCheckResult.totalUnlockedCount || 10).toString())
            .replace('{new}', totalNewKanji.toString()),
          'warning',
          7000,
          !isPremium ? {
            label: strings.kanjiBrowser?.studyGating?.upgradeToPremium || 'Upgrade to Premium',
            onClick: () => router.push('/pricing')
          } : undefined
        )
      }
      return
    }

    await loadKanjiStudySlotsStatus()
    const didStart = await startStudySession(learnedKanji, 'collection')
    if (!didStart) return

    // Show confirmation toast
    const message = (strings.kanjiBrowser?.collection?.studyAllSuccess || 'Started studying {count} learned kanji').replace('{count}', learnedKanji.length.toString())
    showToast(message, 'success')
  }

  const handleReviewAllMastered = () => {
    // Get all learned kanji IDs
    const learnedKanjiIds = new Set(
      Array.from(kanjiProgress.entries())
        .filter(([, progress]) => progress.status === 'learned')
        .map(([kanjiId]) => kanjiId)
    )

    if (learnedKanjiIds.size === 0) {
      showToast(strings.kanjiBrowser?.collection?.noLearnedKanjiReview || 'No learned kanji to review', 'warning')
      return
    }

    // Select all learned kanji
    setSelectedKanji(learnedKanjiIds)

    // Switch to review mode to show selection UI
    setViewMode('review')

    // Show confirmation toast
    const message = (strings.kanjiBrowser?.collection?.reviewAllSuccess || '{count} learned kanji selected for review').replace('{count}', learnedKanjiIds.size.toString())
    showToast(message, 'success')
  }

  const handleReviewComplete = async (stats: SessionStatistics) => {
    // SessionManager emits SESSION_COMPLETED automatically via Event Hub
    // No manual event emission needed - gamification happens automatically!
    console.log('[Kanji Browser] Session completed:', {
      correctItems: stats.correctItems,
      accuracy: stats.accuracy,
      totalTime: stats.totalTime,
    })

    setLastSessionStats(stats)
    showToast(`Review complete! Accuracy: ${stats.accuracy.toFixed(1)}%`, 'success')
    handleModeChange('browse')
  }

  // Progress statistics for navbar
  const progressStats = useMemo(() => {
    const total = Object.values(kanjiData).flat().length
    const learnedCount = Array.from(kanjiProgress.values()).filter(
      p => p.status === 'learned'
    ).length
    return {
      total,
      learned: learnedCount,
      learnedPercentage: total > 0 ? Math.round((learnedCount / total) * 100) : 0,
    }
  }, [kanjiData, kanjiProgress])

  // Mastered kanji grouped by level
  const masteredKanjiByLevel = useMemo(() => {
    const grouped: Record<JLPTLevel, Kanji[]> = {
      N5: [],
      N4: [],
      N3: [],
      N2: [],
      N1: [],
    }

    // Get all learned kanji IDs
    const learnedKanjiIds = new Set(
      Array.from(kanjiProgress.entries())
        .filter(([, progress]) => progress.status === 'learned')
        .map(([kanjiId]) => kanjiId)
    )

    // Group learned kanji by their JLPT level
    Object.entries(kanjiData).forEach(([level, levelKanji]) => {
      if (!levelKanji) return
      levelKanji.forEach((k: Kanji) => {
        if (learnedKanjiIds.has(k.kanji)) {
          grouped[level as JLPTLevel].push(k)
        }
      })
    })

    return grouped
  }, [kanjiData, kanjiProgress])

  const unlockedKanjiSet = useMemo(
    () => new Set(studySlotsStatus?.unlockedKanji || []),
    [studySlotsStatus?.unlockedKanji]
  )

  const learnedKanjiSet = useMemo(
    () =>
      new Set(
        Array.from(kanjiProgress.entries())
          .filter(([, progress]) => progress.status === 'learned')
          .map(([kanjiId]) => kanjiId)
      ),
    [kanjiProgress]
  )

  const filterKanjiList = useCallback(
    (kanji: Kanji[]) => {
      if (browseFilter === 'unlocked') {
        return kanji.filter(item => unlockedKanjiSet.has(item.kanji))
      }
      if (browseFilter === 'learned') {
        return kanji.filter(item => learnedKanjiSet.has(item.kanji))
      }
      return kanji
    },
    [browseFilter, learnedKanjiSet, unlockedKanjiSet]
  )

  const unlockedVisibleCount = useMemo(
    () =>
      Object.values(kanjiData)
        .flat()
        .filter((item): item is Kanji => Boolean(item))
        .filter(item => unlockedKanjiSet.has(item.kanji)).length,
    [kanjiData, unlockedKanjiSet]
  )

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

  const scrollToLevel = (level: JLPTLevel) => {
    // Expand the level if it's not already expanded
    setExpandedLevels(prev => {
      const newSet = new Set(prev)
      newSet.add(level)
      return newSet
    })

    // Scroll to the level section
    setTimeout(() => {
      const element = document.getElementById(`level-${level}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  const renderKanjiGrid = (kanji: Kanji[]) => (
    <div className="grid grid-cols-3 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 mt-4">
      {kanji.map((kanjiItem, index) => {
        const isSelected = selectedKanji.has(kanjiItem.kanji)
        const progress = kanjiProgress.get(kanjiItem.kanji)
        const isLearned = progress?.status === 'learned'
        const isSelectionMode = viewMode === 'study' || viewMode === 'review'

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
              onClick={() => {
                if (isSelectionMode) {
                  toggleSelection(kanjiItem.kanji)
                } else {
                  // In Browse mode, clicking the card opens the modal
                  handleKanjiClick(kanjiItem)
                }
              }}
              className={`
                relative w-full aspect-square flex items-center justify-center text-2xl font-medium
                rounded-lg transition-all overflow-hidden cursor-pointer
                bg-white dark:bg-dark-800 border-2
                hover:shadow-lg
                ${
                  isSelectionMode && isSelected
                    ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
                    : isLearned
                      ? 'border-green-500 dark:border-green-600'
                      : 'border-gray-200 dark:border-dark-700'
                }
              `}
              style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif' }}
            >
              {/* Half-circle selection button - only visible in Study/Review modes */}
              {isSelectionMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleSelection(kanjiItem.kanji)
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full shadow-lg z-20 transition-all hover:scale-110"
                  style={{
                    backgroundColor: isSelected ? '#6366f1' : '#9ca3af',
                    opacity: isSelected ? 1 : 0.5,
                  }}
                  title={isSelected ? 'Unselect' : 'Select for study/review'}
                />
              )}

              {/* Clickable center area for modal - only in Study/Review modes */}
              {isSelectionMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleKanjiClick(kanjiItem)
                  }}
                  className="absolute inset-[25%] rounded-lg hover:bg-white/10 dark:hover:bg-white/5 transition-colors z-10"
                  title="View details"
                />
              )}

              {/* Learned indicator - bottom right corner */}
              {isLearned && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg z-20">
                  ✓
                </div>
              )}

              <span className="text-gray-900 dark:text-gray-100 pointer-events-none">{kanjiItem.kanji}</span>
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
  if (viewMode === 'study' && studySession && currentStudyKanji) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
        {/* Navigation is now global - rendered in root layout */}
        <main className="container mx-auto px-4 py-8">
          <KanjiStudyMode
            kanji={currentStudyKanji}
            isKanjiLearned={kanjiProgress.get(currentStudyKanji.kanji)?.status === 'learned'}
            onNext={async () => {
              const position = getSessionPosition(studySession)
              const currentCardId = position.currentCard?.id
              const shouldTrackVocabularyExposure =
                studySession.mode === 'vocabulary-first' &&
                position.currentCard?.type === 'vocabulary' &&
                !!currentCardId &&
                !studySession.trackedVocabularyCardIds.includes(currentCardId)

              // Track vocabulary exposure BEFORE advancing (Agent 4)
              // Count each vocabulary card only once per session, including after refresh/resume.
              if (shouldTrackVocabularyExposure) {
                const vocabCard = position.currentCard as VocabularyCard
                try {
                  await kanjiProgressManager.trackVocabularyExposure(
                    vocabCard.kanjiCharacter,
                    vocabCard.targetReading,
                    vocabCard.readingType,
                    vocabCard.word,
                    vocabCard.wordMeaning,
                    user,
                    isPremium ?? false
                  )
                  console.log('[Kanji Study] Vocabulary exposure tracked:', {
                    kanji: vocabCard.kanjiCharacter,
                    reading: vocabCard.targetReading,
                    word: vocabCard.word,
                  })
                  emitKanjiStudyAnalytics('kanji_vocabulary_card_completed', {
                    kanji: vocabCard.kanjiCharacter,
                    word: vocabCard.word,
                    reading: vocabCard.targetReading,
                    readingType: vocabCard.readingType,
                    source: vocabCard.source || 'unknown',
                    sessionMode: studySession.mode,
                    completedCardsBeforeAdvance: studySession.completedCards,
                  })
                  setStudySession(prev => (
                    prev && currentCardId ? markVocabularyCardTracked(prev, currentCardId) : prev
                  ))
                } catch (error) {
                  console.error('[Kanji Study] Failed to track vocabulary exposure:', error)
                  // Don't block progression on tracking failure
                }
              }

              // Check if session is complete
              if (position.isSessionComplete) {
                // Study mode awards XP - PRODUCT REQUIREMENT
                // While architecturally study mode is "passive learning",
                // users expect XP for completing study sessions.
                // This is intentional user-facing behavior, not a bug.
                const sessionDuration = Date.now() - studySession.startedAt
                const totalKanji = studySession.kanji.length

                const sessionId = `study_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

                getEventHub().emit(ReviewEventType.SESSION_COMPLETED, {
                  data: {
                    sessionId,
                    statistics: {
                      correctItems: totalKanji,
                      accuracy: 100, // Study mode assumes completion = success
                      averageResponseTime: totalKanji > 0 ? sessionDuration / totalKanji : 0,
                      bestStreak: totalKanji,
                    },
                    duration: sessionDuration,
                  },
                })

                console.log('[Kanji Study] SESSION_COMPLETED emitted (Product Requirement):', {
                  sessionId,
                  items: totalKanji,
                  duration: sessionDuration,
                })

                showToast('Study session complete!', 'success')
                emitKanjiStudyAnalytics('kanji_study_session_completed', {
                  mode: studySession.mode,
                  source: studySession.source,
                  kanjiCount: totalKanji,
                  totalCards: studySession.totalCards,
                  trackedVocabularyCards: studySession.trackedVocabularyCardIds.length,
                  durationMs: sessionDuration,
                })
                refreshKanjiProgress()
                clearPersistedStudySession()
                handleModeChange('browse')
              } else {
                // Advance to next card using helper function
                setStudySession(prev => (prev ? advanceToNextCard(prev) : prev))
              }
            }}
            onPrevious={() => {
              // Go to previous card using helper function
              setStudySession(prev => (prev ? goToPreviousCard(prev) : prev))
            }}
            onBack={() => {
              const position = getSessionPosition(studySession)
              const currentCard = position.currentCard
              emitKanjiStudyAnalytics('kanji_study_session_exited', {
                mode: studySession.mode,
                source: studySession.source,
                totalCards: studySession.totalCards,
                completedCards: studySession.completedCards,
                trackedVocabularyCards: studySession.trackedVocabularyCardIds.length,
                currentKanjiIndex: studySession.currentKanjiIndex,
                currentCardIndex: position.cardIndex,
                currentCardType: position.currentCard?.type || null,
                currentKanji: currentStudyKanji.kanji,
                currentWord: currentCard?.type === 'vocabulary' ? currentCard.word : null,
                currentReading: currentCard?.type === 'vocabulary' ? currentCard.targetReading : null,
                sessionAgeMs: Date.now() - studySession.startedAt,
              })
              refreshKanjiProgress()
              setViewMode('browse')
            }}
            currentIndex={studySession.currentKanjiIndex + 1}
            totalKanji={studySession.kanji.length}
            onProgressUpdate={handleProgressUpdate}
            // Card-level context for vocabulary-first mode support
            currentCard={getSessionPosition(studySession).currentCard || undefined}
            studyMode={studySession.mode}
            cardIndex={studySession.kanji[studySession.currentKanjiIndex]?.currentCardIndex || 0}
            totalCards={studySession.kanji[studySession.currentKanjiIndex]?.cards.length || 1}
            onReadingMatchStarted={({ kanji, pairCount }) => {
              emitKanjiStudyAnalytics('kanji_reading_match_started', {
                kanji,
                pairCount,
                sessionMode: studySession.mode,
                completedCards: studySession.completedCards,
              })
            }}
            onReadingMatchMismatch={({ kanji, word, selectedReading }) => {
              emitKanjiStudyAnalytics('kanji_reading_match_mismatch', {
                kanji,
                word,
                selectedReading,
                sessionMode: studySession.mode,
                completedCards: studySession.completedCards,
              })
            }}
            onReadingMatchCompleted={({ kanji, mismatchCount, durationMs, pairCount }) => {
              emitKanjiStudyAnalytics('kanji_reading_match_completed', {
                kanji,
                pairCount,
                mismatchCount,
                durationMs,
                sessionMode: studySession.mode,
                completedCards: studySession.completedCards,
              })
            }}
          />
        </main>
      </div>
    )
  }

  // Active review session (actually reviewing, not selecting)
  if (reviewContent.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
        {/* Navigation is now global - rendered in root layout */}
        <main className="container mx-auto px-4 py-8">
          <ReviewSessionUI
            content={reviewContent}
            contentPool={reviewContentPool}
            mode="recognition"
            onComplete={handleReviewComplete}
            onCancel={() => handleModeChange('browse')}
            userId={user?.uid || 'guest'}
            shuffle={false}
            config={{ showHints: false }}
          />
        </main>
      </div>
    )
  }

  // Main view for all modes (when not in active session)
  // Calculate total kanji count
  const totalKanjiCount = Object.values(kanjiData).reduce((sum, arr) => sum + (arr?.length || 0), 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
      {/* Navigation */}
      <Navbar user={user} showUserMenu={true} />

      {/* Page Header */}
      <LearningPageHeader
        title={strings.kanjiBrowser?.title || 'Kanji Browser'}
        description={strings.kanjiBrowser?.subtitle || 'Browse and learn kanji by JLPT level'}
        className="mb-2 sm:mb-3"
        stats={{
          total: totalKanjiCount,
          learned: progressStats.learned,
        }}
        mode={viewMode}
        onModeChange={handleModeChange}
        availableModes={isKanjiBrowserStudyEnabled ? ['browse', 'study', 'review'] : ['browse', 'review']}
        selectedCount={selectedKanji.size}
        onSelectAll={() => {
          // Select all kanji from expanded levels
          const allKanji = Object.entries(kanjiData)
            .filter(([level]) => expandedLevels.has(level as JLPTLevel))
            .flatMap(([, kanji]) => kanji?.map(k => k.kanji) || [])
          setSelectedKanji(new Set(allKanji))
        }}
        onClearSelection={() => setSelectedKanji(new Set())}
        onStartStudy={handleStartStudy}
        onStartReview={handleStartReview}
        hideBottomBar={isSearchFocused || showDrawingSearch}
      />

      {isKanjiBrowserStudyEnabled && studySession && viewMode !== 'study' && (
        <div className="container mx-auto px-4 pt-6 max-w-7xl">
          <div className="rounded-2xl border border-primary-200 bg-white/95 p-5 shadow-sm dark:border-primary-900/50 dark:bg-dark-800/95">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">
                  Study Session Ready
                </div>
                <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Resume your {studySession.mode === 'vocabulary-first' ? 'vocabulary-first' : 'traditional'} kanji session
                </div>
                <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {studySession.kanji.length} kanji · {studySession.completedCards} / {studySession.totalCards} cards completed
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    clearPersistedStudySession()
                    setStudySession(null)
                    showToast('Cleared the saved kanji study session', 'info')
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-dark-600 dark:text-gray-200 dark:hover:bg-dark-700"
                >
                  Discard
                </button>
                <button
                  onClick={() => {
                    const resumed = resumeStudySession()
                    if (resumed) {
                      showToast(
                        strings.kanjiBrowser?.collection?.resumeStudySession || 'Resumed your kanji study session',
                        'info'
                      )
                    }
                  }}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                >
                  Resume Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <FeatureUsageIndicator featureId="kanji_browser" className="-mt-20" />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {isKanjiBrowserStudyEnabled && progressStats.learned === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <KanjiStudySlotsIndicator
              status={studySlotsStatus}
              loading={studySlotsLoading}
              title={strings.kanjiBrowser?.studyGating?.slotsTitle || 'Kanji Study Slots'}
              helper={
                strings.kanjiBrowser?.studyGating?.slotsHelper ||
                'Unlocked kanji can always be studied again'
              }
              guestMessage={
                strings.kanjiBrowser?.studyGating?.guestSlotsHelper ||
                'Sign in to unlock kanji for study'
              }
              unlimitedLabel={
                strings.kanjiBrowser?.studyGating?.unlimited || 'Unlimited kanji study'
              }
              unlockedLabel={strings.kanjiBrowser?.studyGating?.unlockedLabel || 'unlocked'}
              remainingLabel={strings.kanjiBrowser?.studyGating?.remainingLabel || 'remaining'}
              usedLabel={strings.kanjiBrowser?.studyGating?.usedLabel || 'used'}
            />
          </motion.div>
        )}

        {isKanjiBrowserStudyEnabled && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {([
            {
              key: 'all' as const,
              label: strings.kanjiBrowser?.browseFilters?.all || 'All',
              count: totalKanjiCount,
            },
            {
              key: 'unlocked' as const,
              label: strings.kanjiBrowser?.browseFilters?.unlocked || 'Unlocked',
              count: unlockedVisibleCount,
            },
            {
              key: 'learned' as const,
              label: strings.kanjiBrowser?.browseFilters?.learned || 'Learned',
              count: progressStats.learned,
            },
          ] as const).map(tab => {
            const active = browseFilter === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setBrowseFilter(tab.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'border-primary-500 bg-primary-500 text-white'
                    : 'border-gray-200 bg-white/70 text-gray-700 hover:bg-gray-50 dark:border-dark-700 dark:bg-dark-800/70 dark:text-gray-200 dark:hover:bg-dark-700'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-gray-300'}`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
        )}

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-6"
        >
          <div className="space-y-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch(searchQuery)
                  }
                }}
                placeholder={
                  strings.kanjiBrowser?.searchPlaceholder ||
                  'Search kanji by character, meaning, or reading...'
                }
                disabled={isSearching}
                className="w-full px-4 py-2.5 pr-10 rounded-lg bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              />

              {/* Clear button */}
              {searchQuery && !isSearching && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setSearchResults([])
                    setHasSearched(false)
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
              )}
            </div>

            {/* Action Buttons Row */}
            <div className="flex gap-2">
              {/* Search button */}
              <button
                onClick={() => handleSearch(searchQuery)}
                disabled={isSearching || !searchQuery.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
                <span>{isSearching ? 'Searching...' : 'Search'}</span>
                {isSearching && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
              </button>

              {/* Drawing Search Button */}
              <button
                onClick={() => setShowDrawingSearch(true)}
                className="p-2.5 rounded-lg transition-colors bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-600"
                title="Search by drawing"
                aria-label="Search by drawing"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Drawing Search Modal */}
          <DrawingSearchModal
            isOpen={showDrawingSearch}
            onClose={() => setShowDrawingSearch(false)}
            onSelectCharacter={handleDrawingCharacterSelect}
          />
        </motion.div>

        {/* Mastered Kanji Dashboard */}
        {progressStats.learned > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl shadow-lg border-2 border-green-200 dark:border-green-800 overflow-hidden"
          >
            <div className="px-4 py-4 sm:px-6 bg-green-100 dark:bg-green-900/30 border-b border-green-200 dark:border-green-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                {/* Title Section - Clickable area */}
                <div
                  onClick={() => setMasteredDashboardExpanded(!masteredDashboardExpanded)}
                  className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity flex-1 min-w-0"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setMasteredDashboardExpanded(!masteredDashboardExpanded)
                    }
                  }}
                  aria-label={masteredDashboardExpanded ? 'Collapse collection' : 'Expand collection'}
                >
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white text-xl flex-shrink-0">
                    🎯
                  </div>
                  <div className="text-left flex-1 min-w-0 pointer-events-none">
                    <h3 className="text-lg font-bold text-green-900 dark:text-green-100">
                      {strings.kanjiBrowser?.collection?.title || 'My Kanji Collection'}
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300 truncate sm:whitespace-normal">
                      {(strings.kanjiBrowser?.collection?.subtitle || '{count} kanji learned • Keep up the great work!').replace('{count}', progressStats.learned.toString())}
                    </p>
                  </div>
                  {/* Mobile collapse toggle - shown on the right of title */}
                  <div className="sm:hidden p-2 hover:bg-green-200 dark:hover:bg-green-900/40 rounded-lg transition-colors flex-shrink-0 pointer-events-none">
                    <svg
                      className={`w-5 h-5 text-green-700 dark:text-green-300 transform transition-transform ${masteredDashboardExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

              {/* Desktop collapse toggle - Always visible on desktop */}
                <div className="hidden sm:flex items-center gap-3 self-center">
                  {isKanjiBrowserStudyEnabled && (
                    <div>
                      <KanjiStudySlotsIndicator
                        compact
                        status={studySlotsStatus}
                        loading={studySlotsLoading}
                        title={strings.kanjiBrowser?.studyGating?.slotsTitle || 'Kanji Study Slots'}
                        helper={
                          strings.kanjiBrowser?.studyGating?.slotsHelper ||
                          'Unlocked kanji can always be studied again'
                        }
                        guestMessage={
                          strings.kanjiBrowser?.studyGating?.guestSlotsHelper ||
                          'Sign in to unlock kanji for study'
                        }
                        unlimitedLabel={
                          strings.kanjiBrowser?.studyGating?.unlimited || 'Unlimited kanji study'
                        }
                        unlockedLabel={strings.kanjiBrowser?.studyGating?.unlockedLabel || 'unlocked'}
                        remainingLabel={strings.kanjiBrowser?.studyGating?.remainingLabel || 'remaining'}
                        usedLabel={strings.kanjiBrowser?.studyGating?.usedLabel || 'used'}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => setMasteredDashboardExpanded(!masteredDashboardExpanded)}
                    className="hidden sm:block p-2 hover:bg-green-200 dark:hover:bg-green-900/40 rounded-lg transition-colors flex-shrink-0"
                    title={masteredDashboardExpanded ? 'Collapse' : 'Expand'}
                  >
                    <svg
                      className={`w-5 h-5 text-green-700 dark:text-green-300 transform transition-transform ${masteredDashboardExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {masteredDashboardExpanded && (
              <div className="px-4 sm:px-6 py-6 space-y-6">
                {/* Action Buttons - Only visible when expanded */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pb-2 border-b border-green-200 dark:border-green-800">
                  {isKanjiBrowserStudyEnabled && (
                    <button
                      onClick={handleStudyAllMastered}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      title={strings.kanjiBrowser?.collection?.studyAllTooltip || 'Study all learned kanji'}
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>{strings.kanjiBrowser?.collection?.studyAll || 'Study All'}</span>
                    </button>
                  )}
                  <button
                    onClick={handleReviewAllMastered}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    title={strings.kanjiBrowser?.collection?.reviewAllTooltip || 'Review all learned kanji'}
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>{strings.kanjiBrowser?.collection?.reviewAll || 'Review All'}</span>
                  </button>
                </div>

              {(['N5', 'N4', 'N3', 'N2', 'N1'] as JLPTLevel[]).map(level => {
                const masteredKanji = masteredKanjiByLevel[level]
                if (masteredKanji.length === 0) return null

                const info = levelInfo[level]
                const isLevelExpanded = expandedLevels.has(level)

                return (
                  <div key={level} className="space-y-3">
                    {/* Level Header - Clickable */}
                    <button
                      onClick={() => {
                        const newExpanded = new Set(expandedLevels)
                        if (isLevelExpanded) {
                          newExpanded.delete(level)
                        } else {
                          newExpanded.add(level)
                        }
                        setExpandedLevels(newExpanded)
                      }}
                      className="flex items-center gap-2 w-full hover:opacity-80 transition-opacity"
                    >
                      <div
                        className={`w-6 h-6 ${info.color} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
                      >
                        {level.replace('N', '')}
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {info.name}
                      </h4>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({masteredKanji.length} mastered)
                      </span>
                      {/* Chevron indicator */}
                      <svg
                        className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ml-auto ${isLevelExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {/* Kanji Grid - Collapsible */}
                    {isLevelExpanded && (
                      <div className="grid grid-cols-6 sm:grid-cols-12 md:grid-cols-16 lg:grid-cols-20 gap-2">
                        {masteredKanji.map((kanjiItem, index) => (
                          <motion.div
                            key={`mastered-${kanjiItem.kanji}-${index}`}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.01 }}
                            whileHover={{ scale: 1.15, zIndex: 10 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleKanjiClick(kanjiItem)}
                            className="relative w-full aspect-square flex items-center justify-center text-lg font-medium
                              rounded-lg transition-all cursor-pointer
                              bg-white dark:bg-dark-800 border-2 border-green-500 dark:border-green-600
                              hover:shadow-lg hover:border-green-600 dark:hover:border-green-500"
                            style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
                            title={`${kanjiItem.kanji} - Click to view details`}
                          >
                            <span className="text-gray-900 dark:text-gray-100">{kanjiItem.kanji}</span>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-lg">
                              ✓
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              </div>
            )}
          </motion.div>
        )}

        {/* Search Results - only show after user has searched */}
        {hasSearched && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl p-6 shadow-lg"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Search Results
              {!isSearching && (
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  ({filterKanjiList(searchResults).length} found)
                </span>
              )}
            </h3>
            {isSearching ? (
              <div className="text-center py-8">
                <LoadingSpinner size="medium" />
              </div>
            ) : filterKanjiList(searchResults).length > 0 ? (
              renderKanjiGrid(filterKanjiList(searchResults))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                {browseFilter === 'all'
                  ? `No kanji found matching "${searchQuery}"`
                  : `No ${browseFilter} kanji found matching "${searchQuery}"`}
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
              onClick={() => scrollToLevel(level as JLPTLevel)}
            >
              <div
                className={`w-8 h-8 ${info.color} rounded-full mx-auto mb-2 flex items-center justify-center text-white text-sm font-bold`}
              >
                {level.replace('N', '')}
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {kanjiData[level as JLPTLevel]?.length || 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">kanji</div>
            </motion.div>
          ))}
        </div>

        {/* Kanji by Level */}
        <div className="space-y-6">
          {(['N5', 'N4', 'N3', 'N2', 'N1'] as JLPTLevel[]).map(level => {
            const kanji = filterKanjiList(kanjiData[level] || [])
            const isExpanded = expandedLevels.has(level)
            const info = levelInfo[level]

            return (
              <motion.div
                key={level}
                id={`level-${level}`}
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
                      <div
                        className={`w-8 h-8 ${info.color} rounded-full flex items-center justify-center text-white text-sm font-bold`}
                      >
                        {level.replace('N', '')}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {info.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {info.description} •{' '}
                          {loadingLevels.has(level) ? 'Loading...' : `${kanji.length} kanji`}
                        </p>
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
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

      <MobileNavSpacer />
    </div>
  )
}

export default function KanjiBrowserPage() {
  return (
    <Suspense
      fallback={
        <LoadingOverlay isLoading={true} message="Loading..." showDoshi={true} fullScreen={true} />
      }
    >
      <KanjiBrowserContent />
    </Suspense>
  )
}
