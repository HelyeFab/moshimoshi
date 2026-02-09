'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import { DeckGrid } from '@/components/flashcards/DeckGrid'
import { DeckCreator } from '@/components/flashcards/DeckCreator'
import { StudySession } from '@/components/flashcards/StudySession'
import { FlashcardViewer } from '@/components/flashcards/FlashcardViewer'
import { StudyModeSelector } from '@/components/flashcards/StudyModeSelector'
import { SessionSettingsModal } from '@/components/flashcards/SessionSettingsModal'
import { StatsDashboard } from '@/components/flashcards/StatsDashboard'
import { StudyRecommendations } from '@/components/flashcards/StudyRecommendations'
import { DailyGoals } from '@/components/flashcards/DailyGoals'
import { ComebackMessage, checkForComeback } from '@/components/flashcards/ComebackMessage'
import { FlashcardsStoragePermissionModal } from '@/components/flashcards/FlashcardsStoragePermissionModal'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import Dialog from '@/components/ui/Dialog'
import Modal from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { flashcardManager, FlashcardManager } from '@/lib/flashcards/FlashcardManager'
import { FlashcardSRSHelper } from '@/lib/flashcards/SRSHelper'
import { ankiDeckManager } from '@/lib/anki/AnkiDeckManager'
import { RestoreOrchestrator } from '@/lib/r2/RestoreOrchestrator'
import { RestoreQueue } from '@/lib/r2/RestoreQueue'
import type { BackupInfo, RestoreProgress } from '@/types/r2'
import { getR2UploadQueue } from '@/lib/r2/R2UploadQueue'
import { useGamificationStore } from '@/state/userGamification'
import { ReviewEventType } from '@/lib/review-engine/core/events'
import { getEventHub, initializeEventHub } from '@/lib/review-engine/core/event-hub'
import { listManager } from '@/lib/lists/ListManager'
import { storageManager } from '@/lib/flashcards/StorageManager'
import { migrationManager } from '@/lib/flashcards/MigrationManager'
import { sessionManager } from '@/lib/flashcards/SessionManager'
import type {
  FlashcardDeck,
  CreateDeckRequest,
  SessionSummary,
  SessionStats,
  PersistedStudySession,
  FlashcardContent,
  FlashcardStreakSnapshot,
} from '@/types/flashcards'
import type { StudyRecommendation, LearningInsights } from '@/lib/flashcards/SessionManager'
import type { UserList } from '@/types/userLists'
import type { FlashcardsInitialData } from '@/lib/flashcards/server'
import { Trophy, TrendingUp, Target, Clock, BookOpen, BarChart3, AlertTriangle, Plus, PieChart, RefreshCw, ChevronDown, ChevronRight, Trash2, CheckSquare, Square, Download, Store } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import ActionMenu from '@/components/ui/ActionMenu'
import { getFlashcardsDeviceId } from '@/lib/flashcards/deviceId'
import { weakCardsStore, type WeakCardEntry } from '@/lib/flashcards/weakCards'
import { buildStreakSnapshot, getLastNDates } from '@/lib/flashcards/streakSnapshots'
import { FlashcardMasteryWidget } from '@/components/flashcards/FlashcardMasteryWidget'
import { MomentumCoach } from '@/components/flashcards/MomentumCoach'
import { HeatFocusWidget } from '@/components/flashcards/HeatFocusWidget'
import { isFeatureEnabled } from '@/lib/features/featureFlags'

interface FlashcardsContentProps {
  initialData: FlashcardsInitialData
}

interface MigrationProgress {
  status: 'syncing-decks' | 'preparing' | 'migrating' | 'complete'
  phase?: 'download' | 'upload' | 'r2'
  total: number
  completed: number
  failed: number
  currentDeck: string | null
  currentProgress?: number
  errors?: string[]
}

export default function FlashcardsContent({ initialData }: FlashcardsContentProps) {
  const { t, strings } = useI18n()
  const router = useRouter()
  const params = useParams<{ locale?: string }>()
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const locale = params?.locale || 'en'
  const pricingPath = `/${locale}/pricing?from=flashcards`

  const redirectToPricing = (message: string) => {
    showToast(message, 'error')
    router.push(pricingPath)
  }

  // Initialize state with server data (will be empty for local-only mode)
  const [decks, setDecks] = useState<FlashcardDeck[]>(initialData.decks)

  const [sessions, setSessions] = useState<SessionStats[]>(initialData.sessions)
  const [userLists, setUserLists] = useState<UserList[]>([])

  // For premium users with server data, skip initial loading
  const hasServerData = initialData.isPremium && initialData.decks.length > 0
  const [loading, setLoading] = useState(!hasServerData)

  const [showCreator, setShowCreator] = useState(false)
  const [editingDeck, setEditingDeck] = useState<FlashcardDeck | null>(null)
  const [studyingDeck, setStudyingDeck] = useState<FlashcardDeck | null>(null)
  const [resumeSessionState, setResumeSessionState] = useState<PersistedStudySession | null>(null)
  const [deckToDelete, setDeckToDelete] = useState<FlashcardDeck | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [showCancelSyncDialog, setShowCancelSyncDialog] = useState(false)
  const [deckToDisableAnkiBackup, setDeckToDisableAnkiBackup] = useState<FlashcardDeck | null>(null)
  const [showDisableAnkiBackupDialog, setShowDisableAnkiBackupDialog] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showInsights, setShowInsights] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('flashcards_show_insights')
      if (saved === null) return true
      return saved === 'true'
    }
    return true
  })
  const [storageInfo, setStorageInfo] = useState<any>(null)
  const [showMigration, setShowMigration] = useState(false)
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null)
  const [deckToStudy, setDeckToStudy] = useState<FlashcardDeck | null>(null)
  const [showModeSelector, setShowModeSelector] = useState(false)
  const [showSessionSettings, setShowSessionSettings] = useState(false)
  const [recommendations, setRecommendations] = useState<StudyRecommendation[]>([])
  const [insights, setInsights] = useState<LearningInsights | null>(null)
  const [currentStreak, setCurrentStreak] = useState(0)
  const [weakCardCountsByDeckId, setWeakCardCountsByDeckId] = useState<Record<string, number>>({})
  const [showWeakCardsModal, setShowWeakCardsModal] = useState(false)
  const [weakCardsDeck, setWeakCardsDeck] = useState<FlashcardDeck | null>(null)
  const [weakCards, setWeakCards] = useState<FlashcardContent[]>([])
  const [weakCardIndex, setWeakCardIndex] = useState(0)
  const [weakCardEntries, setWeakCardEntries] = useState<WeakCardEntry[]>([])
  const [showAgainOnly, setShowAgainOnly] = useState(false)
  const [streakSnapshots, setStreakSnapshots] = useState<FlashcardStreakSnapshot[]>([])
  const [comebackInfo, setComebackInfo] = useState<{
    daysAway: number
    lastStudyDate: Date
  } | null>(null)
  const [limitError, setLimitError] = useState<{ currentCount: number; limit: number } | null>(null)
  const [isSyncingMedia, setIsSyncingMedia] = useState(false)
  const [r2Usage, setR2Usage] = useState<{ usedBytes: number; limitBytes: number } | null>(null)
  const [restoreProgressByDeckId, setRestoreProgressByDeckId] = useState<Record<string, RestoreProgress>>({})
  const [showSyncInfoModal, setShowSyncInfoModal] = useState(false)
  const [selectedDeckIds, setSelectedDeckIds] = useState<Set<string>>(new Set())
  const [selectAllMode, setSelectAllMode] = useState(false)
  const [pendingRemoteSession, setPendingRemoteSession] = useState<PersistedStudySession | null>(null)
  const [showRemoteSessionDialog, setShowRemoteSessionDialog] = useState(false)
  const [multiDeckQueue, setMultiDeckQueue] = useState<Array<{ deck: FlashcardDeck; cards: FlashcardContent[] }>>([])

  // Prevent race conditions
  const loadingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const initialSyncDone = useRef(false)
  const syncModalResolverRef = useRef<((value: boolean) => void) | null>(null)
  const lastAutoSyncRef = useRef(0)

  // Use tier from server - no more race condition!
  const isPremium = initialData.isPremium
  const userTier = initialData.tier
  const limits = FlashcardManager.getDeckLimits(userTier)
  const effectiveUserId = initialData.userId || user?.uid || (userTier === 'guest' ? 'guest' : null)
  const showFlashcardsTestButton = process.env.NODE_ENV !== 'production'

  // Debug logging

  // Sync server data to IndexedDB for offline support (premium users)
  // Then reload decks with hydrated media from IndexedDB
  const syncServerDataToIndexedDB = useCallback(async () => {
    if (!initialData.isPremium || !initialData.userId || initialSyncDone.current) return
    if (initialData.decks.length === 0) return

    initialSyncDone.current = true

    try {
      // Use consistent userId
      const effectiveUserId = initialData.userId || 'guest'
      await flashcardManager.syncDecksToIndexedDB(initialData.decks, effectiveUserId)

      // After sync, reload decks via getDecks which will hydrate media from IndexedDB
      // This is necessary because server URLs might be expired blob URLs
      const hasAnkiDecks = initialData.decks.some((d: any) => d.source === 'anki')
      if (hasAnkiDecks) {
        const allDecks = await flashcardManager.getDecks(effectiveUserId, initialData.isPremium)
        if (allDecks.length > 0) {
          setDecks(allDecks)
        }
      }
    } catch (error) {
    }
  }, [initialData])

  const handleOpenFlashcardsTests = useCallback(() => {
    router.push(`/${locale}/test-flashcards`)
  }, [router, locale])

  const loadR2Usage = useCallback(async () => {
    if (!initialData.userId || !isPremium) return

    try {
      const response = await fetch('/api/anki/r2/usage')
      if (!response.ok) return
      const data = await response.json()
      setR2Usage({
        usedBytes: data.usedBytes || 0,
        limitBytes: data.limitBytes || 0,
      })
    } catch (error) {
    }
  }, [initialData.userId, isPremium])

  const fetchCachedRecommendations = useCallback(async () => {
    if (!initialData.userId || !isPremium) return null
    try {
      const response = await fetch('/api/flashcards/recommendations', {
        credentials: 'include',
      })
      if (!response.ok) return null
      const data = await response.json()
      const cached = Array.isArray(data.recommendations) ? data.recommendations : []
      return cached.length > 0 ? cached : null
    } catch (error) {
      return null
    }
  }, [initialData.userId, isPremium])

  const saveCachedRecommendations = useCallback(
    async (recommendationsToSave: StudyRecommendation[]) => {
      if (!initialData.userId || !isPremium || recommendationsToSave.length === 0) return
      try {
        await fetch('/api/flashcards/recommendations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ recommendations: recommendationsToSave }),
        })
      } catch (error) {
      }
    },
    [initialData.userId, isPremium]
  )

  const r2Queue = useMemo(() => {
    if (!initialData.userId || !isPremium) return null
    return getR2UploadQueue(initialData.userId)
  }, [initialData.userId, isPremium])

  const restoreQueue = useMemo(() => {
    if (!initialData.userId || !isPremium) return null
    return RestoreQueue.getInstance()
  }, [initialData.userId, isPremium])

  const resumeTriggeredRef = useRef(false)
  const cancelSyncRef = useRef(false)
  const restoreAbortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (studyingDeck || loading || authLoading) return
    if (typeof window === 'undefined') return

    const ownerId =
      initialData.userId ||
      user?.uid ||
      (userTier === 'guest' ? 'guest' : null)
    if (!ownerId) return

    const storageKey = `flashcards_active_session_${ownerId}`
    const raw = localStorage.getItem(storageKey)
    if (!raw) return

    let stored: PersistedStudySession | null = null
    try {
      stored = JSON.parse(raw) as PersistedStudySession
    } catch (error) {
      localStorage.removeItem(storageKey)
      return
    }

    if (!stored || stored.version !== 1 || stored.userId !== ownerId) {
      return
    }

    const checkRemoteSession = async (localSession: PersistedStudySession) => {
      if (!initialData.userId || !isPremium) return false
      try {
        const deviceId = getFlashcardsDeviceId()
        const response = await fetch('/api/flashcards/active-session', {
          method: 'GET',
          credentials: 'include'
        })
        if (!response.ok) return false
        const data = await response.json()
        const remote = data?.session as PersistedStudySession | null
        if (!remote || remote.userId !== initialData.userId) return false
        if (deviceId && remote.deviceId && remote.deviceId === deviceId) return false
        const remoteIsNewer = (remote.savedAt || 0) > (localSession.savedAt || 0)
        if (remoteIsNewer) {
          setPendingRemoteSession(remote)
          setShowRemoteSessionDialog(true)
          return true
        }
        return false
      } catch {
        return false
      }
    }

    const restoreSession = async () => {
      const shouldUseRemote = await checkRemoteSession(stored!)
      if (shouldUseRemote) {
        return
      }

      const deck = await flashcardManager.getDeck(stored!.deckId, ownerId)
      if (!deck || !deck.cards?.length) {
        localStorage.removeItem(storageKey)
        return
      }

      const cardMap = new Map(deck.cards.map(card => [card.id, card]))
      const sessionCards = stored!.cardIds
        .map(cardId => cardMap.get(cardId))
        .filter(Boolean) as FlashcardContent[]

      if (sessionCards.length === 0) {
        localStorage.removeItem(storageKey)
        return
      }

      const gradedCardIds = new Set<string>((stored!.responses || []).map(([cardId]) => cardId))
      let nextIndex = Math.max(0, Math.min(stored!.currentIndex, sessionCards.length - 1))
      while (nextIndex < sessionCards.length && gradedCardIds.has(sessionCards[nextIndex].id)) {
        nextIndex += 1
      }
      if (nextIndex >= sessionCards.length) {
        // All remaining cards already graded: keep last card visible and allow completion on next action.
        nextIndex = sessionCards.length - 1
      }

      const resumeState = nextIndex === stored!.currentIndex
        ? stored!
        : { ...stored!, currentIndex: nextIndex }

      setResumeSessionState(resumeState)
      setStudyingDeck({
        ...deck,
        cards: sessionCards,
        settings: {
          ...deck.settings,
          sessionLength: sessionCards.length,
        },
      })
    }

    restoreSession().catch(() => {})
  }, [
    studyingDeck,
    loading,
    authLoading,
    initialData.userId,
    isPremium,
    user?.uid,
    userTier,
  ])

  useEffect(() => {
    if (studyingDeck || loading || authLoading) return
    if (!initialData.userId || !isPremium) return
    if (resumeSessionState) return
    if (typeof window === 'undefined') return

    const localKey = `flashcards_active_session_${initialData.userId}`
    let localSession: PersistedStudySession | null = null
    const raw = localStorage.getItem(localKey)
    if (raw) {
      try {
        localSession = JSON.parse(raw) as PersistedStudySession
      } catch {
        localSession = null
      }
    }
    const localSavedAt = localSession?.savedAt ?? 0

    const fetchRemote = async () => {
      const deviceId = getFlashcardsDeviceId()
      const response = await fetch('/api/flashcards/active-session', {
        method: 'GET',
        credentials: 'include'
      })
      if (!response.ok) return
      const data = await response.json()
      const remote = data?.session as PersistedStudySession | null
      if (!remote || remote.userId !== initialData.userId) return
      if (deviceId && remote.deviceId && remote.deviceId === deviceId) return

      const remoteIsNewer = (remote.savedAt || 0) > localSavedAt
      if (remoteIsNewer) {
        setPendingRemoteSession(remote)
        setShowRemoteSessionDialog(true)
      }
    }

    fetchRemote().catch(() => {})
  }, [studyingDeck, loading, authLoading, initialData.userId, isPremium, resumeSessionState])

  useEffect(() => {
    if (!r2Queue) return

    const handleComplete = () => {
      loadR2Usage()
    }

    const handleError = () => {
      loadR2Usage()
    }

    r2Queue.on('complete', handleComplete)
    r2Queue.on('error', handleError)

    return () => {
      r2Queue.off('complete', handleComplete)
      r2Queue.off('error', handleError)
    }
  }, [r2Queue, loadR2Usage])

  // Load additional data and handle free users (who need IndexedDB)
  useEffect(() => {
    // Sync premium user's server data to IndexedDB
    if (initialData.isPremium && initialData.decks.length > 0) {
      syncServerDataToIndexedDB()
    }

    // For free users OR premium users without server data, load from client
    if (initialData.userId && (!initialData.isPremium || initialData.decks.length === 0)) {
      loadData()
    } else if (initialData.isPremium && initialData.decks.length > 0) {
      // Premium users with server data - just load supplementary data
      loadSupplementaryData()
    }

    // Check for comeback
    if (initialData.userId) {
      checkForComeback(initialData.userId).then(comeback => {
        if (comeback && comeback.daysAway >= 3) {
          setComebackInfo({
            daysAway: comeback.daysAway,
            lastStudyDate: comeback.lastStudyDate,
          })
        }
      })
    }

    // Check for plan upgrade and migration needs
    if (initialData.userId && initialData.isPremium) {
      checkForMigration()
    }

    // Monitor storage status
    checkStorageStatus()

    if (initialData.userId && isPremium) {
      loadR2Usage()
    }

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [initialData.userId, initialData.isPremium, syncServerDataToIndexedDB, loadR2Usage])

  // Initialize Event Hub for gamification (XP rewards)
  // This ensures flashcard sessions award XP through the same system as other features
  useEffect(() => {
    if (initialData.userId) {
      initializeEventHub(initialData.userId)
    }
  }, [initialData.userId])

  useEffect(() => {
    if (selectedDeckIds.size === 0) return
    const existingIds = new Set(decks.map(deck => deck.id))
    const next = new Set(Array.from(selectedDeckIds).filter(id => existingIds.has(id)))
    if (next.size !== selectedDeckIds.size) {
      setSelectedDeckIds(next)
    }
  }, [decks, selectedDeckIds])

  useEffect(() => {
    if (!isPremium && !showInsights) {
      setShowInsights(true)
    }
  }, [isPremium, showInsights])

  useEffect(() => {
    if (!selectAllMode) return
    if (decks.length === 0) return
    setSelectedDeckIds(new Set(decks.map(deck => deck.id)))
  }, [selectAllMode, decks])

  const refreshWeakCardCounts = useCallback(
    (userId: string, decksToUse: FlashcardDeck[]) => {
      if (!userId || decksToUse.length === 0) {
        setWeakCardCountsByDeckId({})
        return
      }
      const nextCounts: Record<string, number> = {}
      for (const deck of decksToUse) {
        const payload = weakCardsStore.load(userId, deck.id)
        if (payload?.entries?.length) {
          nextCounts[deck.id] = payload.entries.length
        }
      }
      setWeakCardCountsByDeckId(nextCounts)
    },
    []
  )

  const loadWeakCardsRemote = useCallback(async (decksToUse?: FlashcardDeck[]) => {
    if (!effectiveUserId || !isPremium) return
    try {
      const response = await fetch('/api/flashcards/weak-cards', {
        credentials: 'include',
      })
      if (!response.ok) return
      const data = await response.json()
      const items = Array.isArray(data.items) ? data.items : []
      for (const item of items) {
        if (!item?.deckId || !Array.isArray(item.entries)) continue
        const local = weakCardsStore.load(effectiveUserId, item.deckId)
        const localUpdated = local?.updatedAt || 0
        const remoteUpdated = item.updatedAt || 0
        if (!local || remoteUpdated > localUpdated) {
          weakCardsStore.save(effectiveUserId, item.deckId, item.entries)
        }
      }
      const targetDecks = decksToUse ?? decks
      refreshWeakCardCounts(effectiveUserId, targetDecks)
    } catch {
      // ignore
    }
  }, [effectiveUserId, isPremium, decks, refreshWeakCardCounts])

  useEffect(() => {
    if (!effectiveUserId) {
      setWeakCardCountsByDeckId({})
      return
    }
    refreshWeakCardCounts(effectiveUserId, decks)
  }, [decks, effectiveUserId, refreshWeakCardCounts])

  const refreshStreakSnapshots = useCallback(
    async (userId: string, decksToUse: FlashcardDeck[]) => {
      if (!userId) return
      try {
        const snapshot = buildStreakSnapshot(userId, decksToUse)
        await flashcardManager.upsertStreakSnapshot(snapshot)

        if (isPremium) {
          fetch('/api/flashcards/streak-snapshots', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              date: snapshot.date,
              streak1: snapshot.streak1,
              streak2: snapshot.streak2,
              streak3plus: snapshot.streak3plus,
              total: snapshot.total,
              updatedAt: snapshot.updatedAt,
            }),
          }).catch(() => {})
        }

        const recentDates = getLastNDates(7)
        const localSnapshots = await flashcardManager.getStreakSnapshotsForDates(userId, recentDates)
        setStreakSnapshots(localSnapshots)
      } catch {
        // ignore snapshot failures
      }
    },
    [isPremium]
  )

  const loadStreakSnapshotsRemote = useCallback(
    async (userId: string) => {
      if (!userId || !isPremium) return
      try {
        const response = await fetch('/api/flashcards/streak-snapshots', {
          credentials: 'include',
        })
        if (!response.ok) return
        const data = await response.json()
        const items = Array.isArray(data.items) ? data.items : []

        for (const item of items) {
          if (!item?.date) continue
          const local = await flashcardManager.getStreakSnapshot(userId, item.date)
          const localUpdated = local?.updatedAt || 0
          const remoteUpdated = item.updatedAt || 0
          if (!local || remoteUpdated > localUpdated) {
            await flashcardManager.upsertStreakSnapshot({
              id: `${userId}_${item.date}`,
              userId,
              date: item.date,
              streak1: item.streak1 || 0,
              streak2: item.streak2 || 0,
              streak3plus: item.streak3plus || 0,
              total: item.total || 0,
              updatedAt: remoteUpdated,
            })
          }
        }

        const recentDates = getLastNDates(7)
        const localSnapshots = await flashcardManager.getStreakSnapshotsForDates(userId, recentDates)
        setStreakSnapshots(localSnapshots)
      } catch {
        // ignore snapshot sync failures
      }
    },
    [isPremium]
  )

  // Load supplementary data for premium users (user lists, recommendations, etc.)
  const loadSupplementaryData = async () => {
    if (!initialData.userId) return

    try {
      // Load user lists for import option
      const lists = await listManager.getLists(initialData.userId, isPremium)
      setUserLists(lists)

      // Load learning insights and recommendations if user has decks
      if (decks.length > 0) {
        // Pass SSR sessions to avoid IndexedDB lookup for premium users
        const sessionsToUse = initialData.isPremium ? sessions : undefined

        const userInsights = await sessionManager.getLearningInsights(
          initialData.userId,
          sessionsToUse,
          decks
        )
        setInsights(userInsights)

        const cachedRecs = await fetchCachedRecommendations()
        if (cachedRecs) {
          setRecommendations(cachedRecs)
        }

        const studyRecs = await sessionManager.getStudyRecommendations(
          initialData.userId,
          decks,
          sessionsToUse
        )
        setRecommendations(studyRecs)
        await saveCachedRecommendations(studyRecs)

        const streak = await sessionManager.calculateStreak(initialData.userId, sessionsToUse)
        setCurrentStreak(streak)
      }

      await loadWeakCardsRemote(decks)
      await refreshStreakSnapshots(initialData.userId, decks)
      await loadStreakSnapshotsRemote(initialData.userId)
      setLoading(false)
    } catch (error) {
      setLoading(false)
    }
  }

  // Full data load for free users (from IndexedDB)
  const loadData = async (forceRefresh = false, showLoading = true) => {

    // Use consistent userId - same logic as DeckCreator
    const effectiveUserId = initialData.userId || 'guest'

    // Prevent concurrent loads (unless force refresh)
    if (loadingRef.current && !forceRefresh) {
      return
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    loadingRef.current = true
    abortControllerRef.current = new AbortController()

    try {
      if (showLoading) {
        setLoading(true)
      }

      // Load flashcard decks - FlashcardManager handles both regular and Anki decks
      let userDecks = await flashcardManager.getDecks(effectiveUserId, isPremium)

      if (initialData.userId && userTier !== 'guest' && userDecks.length === 0) {
        userDecks = await flashcardManager.ensureStarterDecks(initialData.userId, isPremium)
      }

      if (initialData.userId && userTier !== 'guest' && userDecks.length > 0) {
        userDecks = await flashcardManager.backfillStarterDeckMedia(initialData.userId, userDecks)
      }

      setDecks(userDecks)
      await refreshStreakSnapshots(effectiveUserId, userDecks)
      await loadStreakSnapshotsRemote(effectiveUserId)

      // Load user lists for import option
      const lists = await listManager.getLists(effectiveUserId, isPremium)

      setUserLists(lists)

      // Load learning insights and recommendations
      if (userDecks.length > 0) {
        let sessionsToUse: SessionStats[] | undefined

        if (isPremium && effectiveUserId !== 'guest') {
          try {
            const response = await fetch('/api/flashcards/sessions?limit=200', {
              credentials: 'include',
            })
            if (response.ok) {
              const data = await response.json()
              const remoteSessions = Array.isArray(data.sessions) ? data.sessions : []
              if (remoteSessions.length > 0) {
                sessionsToUse = remoteSessions
                try {
                  await sessionManager.saveSessions(remoteSessions)
                } catch (error) {
                }
              }
            }

            if (!sessionsToUse) {
              try {
                sessionsToUse = await sessionManager.getUserSessions(effectiveUserId, 25)
              } catch (error) {
                sessionsToUse = []
              }
            }
          } catch (error) {
          }
        }

        const userInsights = await sessionManager.getLearningInsights(
          effectiveUserId,
          sessionsToUse,
          userDecks
        )
        setInsights(userInsights)

        const cachedRecs = await fetchCachedRecommendations()
        if (cachedRecs) {
          setRecommendations(cachedRecs)
        }

        const studyRecs = await sessionManager.getStudyRecommendations(
          effectiveUserId,
          userDecks,
          sessionsToUse
        )
        setRecommendations(studyRecs)
        await saveCachedRecommendations(studyRecs)

        const streak = await sessionManager.calculateStreak(effectiveUserId, sessionsToUse)
        setCurrentStreak(streak)

        // Load recent sessions from IndexedDB
        const recentSessions =
          sessionsToUse && sessionsToUse.length > 0
            ? sessionsToUse.slice(0, 25)
            : await sessionManager.getUserSessions(effectiveUserId, 25)
        setSessions(recentSessions)
      }
      await loadWeakCardsRemote(userDecks)
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('[FlashcardsContent.loadData] Failed to load data:', error)
        showToast(t('flashcards.errors.loadFailed'), 'error')
      }
    } finally {
      if (showLoading) {
        setLoading(false)
      }
      loadingRef.current = false
    }
  }

  const handleAutoSync = useCallback(async () => {
    if (!initialData.userId || !isPremium || isSyncingMedia) return

    const now = Date.now()
    if (now - lastAutoSyncRef.current < 60_000) return
    lastAutoSyncRef.current = now

    try {
      await flashcardManager.syncDecksFromFirebase(initialData.userId, isPremium)
      await loadData(true, false)
    } catch (error) {
      console.error('[FlashcardsContent] Auto-sync failed:', error)
    }
  }, [initialData.userId, isPremium, isSyncingMedia])

  useEffect(() => {
    if (!initialData.userId || !isPremium) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleAutoSync()
      }
    }

    const handleWindowFocus = () => {
      handleAutoSync()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [handleAutoSync, initialData.userId, isPremium])

  const checkStorageStatus = async () => {
    try {
      const info = await storageManager.getStorageInfo()
      setStorageInfo(info)

      storageManager.onWarning(warning => {
        showToast(warning.message, warning.level === 'critical' ? 'error' : 'info')
      })
    } catch (error) {
    }
  }

  const checkForMigration = async () => {
    if (!initialData.userId || !isPremium) return

    try {
      const needsMigration = await migrationManager.checkForUpgrade(initialData.userId, userTier)
      if (needsMigration) {
        setShowMigration(true)
      }
    } catch (error) {
    }
  }

  const handleBulkSync = async () => {
    if (!initialData.userId || !isPremium) {
      showToast(t('flashcards.errors.syncRequiresPremium'), 'error')
      return
    }

    if (isSyncingMedia) return

    // Show info modal to user and wait for acknowledgment
    setShowSyncInfoModal(true)

    // Wait for user to close the modal before starting sync
    const userAcknowledged = await new Promise<boolean>((resolve) => {
      syncModalResolverRef.current = resolve
    })

    if (!userAcknowledged) {
      // User cancelled
      return
    }

    setShowMigration(false)
    setIsSyncingMedia(true)
    setMigrationProgress({ status: 'preparing', total: 0, completed: 0, failed: 0, currentDeck: null })
    cancelSyncRef.current = false

    // ========== PHASE 1: DECK SYNC (NEW) ==========
    try {
      console.log('📦 [FlashcardsContent] Starting deck sync phase...')

      setMigrationProgress({
        status: 'syncing-decks' as any,
        phase: 'download' as any,
        total: 0,
        completed: 0,
        failed: 0,
        currentDeck: null
      })

      // Step 1: Download from Firebase (LWW merge)
      console.log('📥 [FlashcardsContent] Downloading decks from Firebase...')
      const downloadResult = await flashcardManager.syncDecksFromFirebase(
        initialData.userId,
        isPremium
      )

      console.log('✅ [FlashcardsContent] Download complete:', downloadResult)

      // Step 2: Upload to Firebase
      setMigrationProgress({
        status: 'syncing-decks',
        phase: 'upload',
        total: 0,
        completed: downloadResult.downloaded + downloadResult.merged,
        failed: 0,
        currentDeck: null
      })

      console.log('📤 [FlashcardsContent] Uploading decks to Firebase...')
      const uploadResult = await flashcardManager.syncAllDecksToFirebase(
        initialData.userId,
        isPremium
      )

      console.log('✅ [FlashcardsContent] Upload complete:', uploadResult)

      showToast(
        `Synced ${uploadResult.synced} deck${uploadResult.synced !== 1 ? 's' : ''} to cloud`,
        'success'
      )

      // Refresh local deck list
      await loadData(true)
    } catch (error) {
      console.error('[FlashcardsContent] Deck sync failed:', error)
      showToast(t('flashcards.errors.deckSyncFailed') || 'Failed to sync decks. Please try again.', 'error')
      setIsSyncingMedia(false)
      return // Don't continue to R2 sync if deck sync fails
    }

    // ========== PHASE 2: R2 USER DECK RESTORE (NEW) ==========
    try {
      console.log('[FlashcardsContent] Starting user deck restore phase...')

      // Fetch list of user decks from R2
      const userDecksResponse = await fetch('/api/flashcards/r2/list', {
        method: 'GET',
        credentials: 'include',
      })

      if (userDecksResponse.ok) {
        const { decks: userDeckList } = await userDecksResponse.json()

        if (userDeckList && userDeckList.length > 0) {
          console.log(`[FlashcardsContent] Found ${userDeckList.length} user deck(s) in R2`)

          setMigrationProgress({
            status: 'migrating',
            phase: 'r2',
            total: userDeckList.length,
            completed: 0,
            failed: 0,
            currentDeck: null,
          })

          const { getUserDeckRestoreOrchestrator } = await import('@/lib/r2/UserDeckRestoreOrchestrator')
          const abortController = new AbortController()
          const orchestrator = getUserDeckRestoreOrchestrator(initialData.userId, abortController.signal)

          let restoredCount = 0
          let failedCount = 0

          for (const metadata of userDeckList) {
            if (cancelSyncRef.current) break

            setMigrationProgress(prev => prev ? {
              ...prev,
              completed: restoredCount,
              currentDeck: metadata.name,
            } : null)

            try {
              await orchestrator.restoreDeck(metadata)
              restoredCount++
              console.log(`[FlashcardsContent] Restored user deck: ${metadata.name}`)
            } catch (error: any) {
              failedCount++
              console.error(`[FlashcardsContent] Failed to restore ${metadata.name}:`, error)
              // Continue to next deck
            }
          }

          console.log(`[FlashcardsContent] User deck restore complete: ${restoredCount} succeeded, ${failedCount} failed`)

          if (restoredCount > 0) {
            showToast(`Restored ${restoredCount} user deck${restoredCount !== 1 ? 's' : ''}`, 'success')
          }
        } else {
          console.log('[FlashcardsContent] No user decks found in R2')
        }
      } else {
        console.log('[FlashcardsContent] User deck list fetch failed (may not be premium or no decks)')
      }
    } catch (error) {
      console.error('[FlashcardsContent] User deck restore failed:', error)
      // Don't stop - continue to Anki sync
    }

    // ========== PHASE 3: R2 ANKI SYNC (EXISTING) ==========
    try {
      console.log('📦 [FlashcardsContent] Starting R2 Anki sync phase...')

      setMigrationProgress({
        status: 'preparing',
        phase: 'r2' as any,
        total: 0,
        completed: 0,
        failed: 0,
        currentDeck: null
      })

      const backupsResponse = await fetch('/api/anki/r2/backups')
      if (!backupsResponse.ok) {
        throw new Error('Failed to fetch backups')
      }

      const backupsData = await backupsResponse.json()
      const backups: BackupInfo[] = backupsData.backups || []
      const deletedDeckIds: string[] = Array.isArray(backupsData.deletedDeckIds)
        ? backupsData.deletedDeckIds
        : []
      const deletedDeckIdSet = new Set(deletedDeckIds)

      const userId = initialData.userId
      if (!userId) return

      if (deletedDeckIdSet.size > 0) {
        const localDecks = await flashcardManager.getDecks(userId, isPremium)
        const decksToDelete = localDecks.filter(
          deck => deck.source === 'anki' && deletedDeckIdSet.has(deck.id)
        )

        if (decksToDelete.length > 0) {
          await Promise.all(
            decksToDelete.map(deck =>
              ankiDeckManager.deleteDeck(deck.id, userId, isPremium, { skipRemote: true })
            )
          )
          setDecks(prev => prev.filter(deck => !deletedDeckIdSet.has(deck.id)))
        }
      }

      if (backups.length === 0) {
        showToast(t('flashcards.restore.noBackups') || 'No backups found.', 'info')
        return
      }

      const localDecks = await flashcardManager.getDecks(userId, isPremium)
      const localDeckMap = new Map(localDecks.map(deck => [deck.id, deck]))
      const missingBackups = backups.filter(backup => {
        const localDeck = localDeckMap.get(backup.deckId)
        if (!localDeck) return true
        if (localDeck.restoreStatus) return true
        if (!localDeck.cards || localDeck.cards.length === 0) return true
        return false
      })

      if (missingBackups.length === 0) {
        showToast(t('flashcards.success.allSynced') || 'All decks are already synced.', 'success')
        return
      }

      const buildRestoreStub = (backup: BackupInfo): FlashcardDeck => ({
        id: backup.deckId,
        userId: initialData.userId!,
        name: backup.name,
        description: '',
        emoji: '📥',
        color: 'lavender',
        cardStyle: 'minimal',
        cards: [],
        settings: {
          studyDirection: 'front-to-back',
          autoPlay: false,
          showHints: true,
          animationSpeed: 'normal',
          soundEffects: true,
          hapticFeedback: true,
          sessionLength: 20,
          reviewMode: 'srs',
          newCardsPerDay: 20,
          reviewsPerDay: 100,
        },
        stats: {
          totalCards: backup.cardCount,
          newCards: backup.cardCount,
          learningCards: 0,
          reviewCards: 0,
          masteredCards: 0,
          totalStudied: 0,
          lastStudied: undefined,
          averageAccuracy: 0,
          currentStreak: 0,
          longestStreak: 0,
          totalTimeSpent: 0,
          heatmapData: {},
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'anki',
        restoreStatus: 'restoring',
        metadata: {
          importedAt: new Date().toISOString(),
          hasMedia: backup.hasMedia,
          ankiImport: true,
          r2BackupEnabled: true,
        },
      })

      const restoreStubs = missingBackups.map(buildRestoreStub)
      setDecks(prev => {
        const existingIds = new Set(prev.map(deck => deck.id))
        const newStubs = restoreStubs.filter(deck => !existingIds.has(deck.id))
        return newStubs.length > 0 ? [...newStubs, ...prev] : prev
      })
      await Promise.all(
        restoreStubs.map(deck =>
          flashcardManager.upsertLocalDeck(deck).catch(error => {
            console.error('[FlashcardsContent] Failed to persist restore stub:', error)
          })
        )
      )
      if (restoreQueue) {
        await Promise.all(
          missingBackups.map(backup => restoreQueue.upsertJobFromBackup(backup, initialData.userId!))
        )
      }
      setRestoreProgressByDeckId(prev => {
        const next = { ...prev }
        for (const backup of missingBackups) {
          next[backup.deckId] = {
            phase: 'fetching-metadata',
            filesDownloaded: 0,
            totalFiles: 0,
            progress: 0,
          }
        }
        return next
      })

      const abortController = new AbortController()
      restoreAbortControllerRef.current = abortController
      const orchestrator = new RestoreOrchestrator(
        initialData.userId,
        restoreQueue ?? undefined,
        abortController.signal
      )
      const progress: MigrationProgress = {
        status: 'migrating',
        total: missingBackups.length,
        completed: 0,
        failed: 0,
        currentDeck: null,
        currentProgress: 0,
        errors: [],
      }

      setMigrationProgress(progress)

      for (const backup of missingBackups) {
        if (cancelSyncRef.current) break
        progress.currentDeck = backup.name
        progress.currentProgress = 0
        setMigrationProgress({ ...progress })

        try {
          const handleProgress = (payload: any) => {
            if (cancelSyncRef.current) return
            progress.currentProgress = Math.max(0, Math.min(100, payload?.progress ?? 0))
            setMigrationProgress({ ...progress })
            setRestoreProgressByDeckId(prev => ({
              ...prev,
              [backup.deckId]: {
                ...prev[backup.deckId],
                ...payload,
                progress: Math.max(0, Math.min(100, payload?.progress ?? 0)),
              },
            }))
        }
          orchestrator.on('progress', handleProgress)
          await orchestrator.restoreDeck(backup)
          orchestrator.off('progress', handleProgress)
          progress.completed += 1
          progress.currentProgress = 0

          const restoredDeck = await flashcardManager.getDeck(backup.deckId, initialData.userId)
          if (restoredDeck) {
            setDecks(prev => prev.map(deck => (deck.id === backup.deckId ? restoredDeck : deck)))
          }
          setRestoreProgressByDeckId(prev => ({
            ...prev,
            [backup.deckId]: {
              ...prev[backup.deckId],
              phase: 'complete',
              progress: 100,
            },
          }))
          setTimeout(() => {
            setRestoreProgressByDeckId(prev => {
              const next = { ...prev }
              delete next[backup.deckId]
              return next
            })
          }, 800)
        } catch (error: any) {
          orchestrator.removeAllListeners('progress')
          if (cancelSyncRef.current || error?.name === 'AbortError' || error?.message === 'Restore cancelled') {
            break
          }
          progress.failed += 1
          progress.errors?.push(error?.message || `Failed to restore ${backup.name}`)
          setRestoreProgressByDeckId(prev => ({
            ...prev,
            [backup.deckId]: {
              ...prev[backup.deckId],
              phase: 'error',
              progress: 0,
              error: error?.message || 'Restore failed',
            },
          }))
          await flashcardManager
            .upsertLocalDeck({
              ...buildRestoreStub(backup),
              restoreStatus: 'error',
              updatedAt: Date.now(),
            })
            .catch(err => console.error('[FlashcardsContent] Failed to mark stub error:', err))
        }

        setMigrationProgress({ ...progress })
      }

      if (cancelSyncRef.current) {
        return
      }

      if (progress.failed > 0) {
        showToast(t('flashcards.errors.syncFailed') || 'Some decks failed to restore.', 'error')
      } else {
        showToast(t('flashcards.success.allSynced'), 'success')
      }

      await loadData(true)

    } catch (error) {
      if (!cancelSyncRef.current) {
        showToast(t('flashcards.errors.syncFailed'), 'error')
      }
    } finally {
      restoreAbortControllerRef.current = null
      setMigrationProgress(null)
      await loadR2Usage()
      setIsSyncingMedia(false)
    }
  }

  const handleCancelSync = useCallback(async () => {
    cancelSyncRef.current = true
    restoreAbortControllerRef.current?.abort()
    restoreAbortControllerRef.current = null

    if (restoreQueue && initialData.userId) {
      const jobs = await restoreQueue.getActiveJobs(initialData.userId)
      await Promise.all(jobs.map(job => restoreQueue.clearJob(job.id)))
    }

    if (initialData.userId) {
      const stubDecks = decks.filter(deck =>
        deck.restoreStatus && (!deck.cards || deck.cards.length === 0)
      )
      if (stubDecks.length > 0) {
        setDecks(prev => prev.filter(deck => !stubDecks.some(stub => stub.id === deck.id)))
        await Promise.all(
          stubDecks.map(deck => flashcardManager.deleteDeck(deck.id, initialData.userId!, false))
        )
      }
    }

    setRestoreProgressByDeckId({})
    setMigrationProgress(null)
    setIsSyncingMedia(false)
  }, [decks, initialData.userId, restoreQueue])

  const resumePendingRestores = useCallback(async () => {
    if (!initialData.userId || !isPremium || !restoreQueue) return
    if (resumeTriggeredRef.current || isSyncingMedia) return

    const jobs = await restoreQueue.getActiveJobs(initialData.userId)
    if (jobs.length === 0) return

    resumeTriggeredRef.current = true

    const backups: BackupInfo[] = jobs.map(job => ({
      deckId: job.id,
      name: job.deckName,
      cardCount: job.cardCount,
      hasMedia: job.hasMedia,
      lastBackup: new Date(job.lastBackup),
      r2Keys: {
        manifestKey: job.manifestKey,
        packageKey: job.packageKey,
      },
    }))

    const restoreStubs = backups.map(backup => ({
      id: backup.deckId,
      userId: initialData.userId!,
      name: backup.name,
      description: '',
      emoji: '📥',
      color: 'lavender',
      cardStyle: 'minimal',
      cards: [],
      settings: {
        studyDirection: 'front-to-back',
        autoPlay: false,
        showHints: true,
        animationSpeed: 'normal',
        soundEffects: true,
        hapticFeedback: true,
        sessionLength: 20,
        reviewMode: 'srs',
        newCardsPerDay: 20,
        reviewsPerDay: 100,
      },
      stats: {
        totalCards: backup.cardCount,
        newCards: backup.cardCount,
        learningCards: 0,
        reviewCards: 0,
        masteredCards: 0,
        totalStudied: 0,
        lastStudied: undefined,
        averageAccuracy: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalTimeSpent: 0,
        heatmapData: {},
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'anki',
      restoreStatus: 'restoring',
    }) as FlashcardDeck)

    setDecks(prev => {
      const existingIds = new Set(prev.map(deck => deck.id))
      const newStubs = restoreStubs.filter(deck => !existingIds.has(deck.id))
      return newStubs.length > 0 ? [...newStubs, ...prev] : prev
    })

    setRestoreProgressByDeckId(prev => {
      const next = { ...prev }
      for (const job of jobs) {
        const downloadedCount = job.downloadedFiles?.length || 0
        next[job.id] = {
          phase: job.status === 'error' ? 'error' : 'downloading-media',
          filesDownloaded: downloadedCount,
          totalFiles: job.totalFiles || 0,
          progress: job.totalFiles ? (downloadedCount / job.totalFiles) * 100 : 0,
          error: job.lastError,
        }
      }
      return next
    })

    showToast(t('flashcards.restore.resumeInProgress') || 'Resuming restore in progress...', 'info')

    const abortController = new AbortController()
    restoreAbortControllerRef.current = abortController
    cancelSyncRef.current = false
    const orchestrator = new RestoreOrchestrator(initialData.userId, restoreQueue, abortController.signal)
    const progress: MigrationProgress = {
      status: 'migrating',
      total: backups.length,
      completed: 0,
      failed: 0,
      currentDeck: null,
      currentProgress: 0,
      errors: [],
    }

    setShowMigration(false)
    setIsSyncingMedia(true)
    setMigrationProgress(progress)

    for (const backup of backups) {
      if (cancelSyncRef.current) break
      progress.currentDeck = backup.name
      progress.currentProgress = 0
      setMigrationProgress({ ...progress })

      try {
        const handleProgress = (payload: any) => {
          if (cancelSyncRef.current) return
          progress.currentProgress = Math.max(0, Math.min(100, payload?.progress ?? 0))
          setMigrationProgress({ ...progress })
          setRestoreProgressByDeckId(prev => ({
            ...prev,
            [backup.deckId]: {
              ...prev[backup.deckId],
              ...payload,
              progress: Math.max(0, Math.min(100, payload?.progress ?? 0)),
            },
          }))
        }
        orchestrator.on('progress', handleProgress)
        await orchestrator.restoreDeck(backup)
        orchestrator.off('progress', handleProgress)
        progress.completed += 1
        progress.currentProgress = 0

        const restoredDeck = await flashcardManager.getDeck(backup.deckId, initialData.userId)
        if (restoredDeck) {
          setDecks(prev => prev.map(deck => (deck.id === backup.deckId ? restoredDeck : deck)))
        }
        setRestoreProgressByDeckId(prev => ({
          ...prev,
          [backup.deckId]: {
            ...prev[backup.deckId],
            phase: 'complete',
            progress: 100,
          },
        }))
        setTimeout(() => {
          setRestoreProgressByDeckId(prev => {
            const next = { ...prev }
            delete next[backup.deckId]
            return next
          })
        }, 800)
      } catch (error: any) {
        orchestrator.removeAllListeners('progress')
        if (cancelSyncRef.current || error?.name === 'AbortError' || error?.message === 'Restore cancelled') {
          break
        }
        progress.failed += 1
        progress.errors?.push(error?.message || `Failed to restore ${backup.name}`)
        setRestoreProgressByDeckId(prev => ({
          ...prev,
          [backup.deckId]: {
            ...prev[backup.deckId],
            phase: 'error',
            progress: 0,
            error: error?.message || 'Restore failed',
          },
        }))
      }

      setMigrationProgress({ ...progress })
    }

    restoreAbortControllerRef.current = null
    setMigrationProgress(null)
    await loadR2Usage()
    setIsSyncingMedia(false)
  }, [initialData.userId, isPremium, restoreQueue, isSyncingMedia, showToast, t, loadR2Usage])

  useEffect(() => {
    resumePendingRestores()
  }, [resumePendingRestores])

  const handleExportAll = async () => {
    if (!initialData.userId) return
    if (!isPremium) {
      redirectToPricing(t('flashcards.upgradeToCreate'))
      return
    }
    if (!decks.some(deck => !deck.isStarter)) {
      showToast(t('flashcards.export.noExportableDecks'), 'info')
      return
    }

    try {
      const jsonData = await migrationManager.exportAllDecks(initialData.userId)
      const blob = new Blob([jsonData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `all-decks-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast(t('flashcards.success.allExported'), 'success')
    } catch (error) {
      showToast(t('flashcards.errors.exportFailed'), 'error')
    }
  }

  const refreshDecks = async () => {
    // Use consistent userId - same logic as DeckCreator
    const effectiveUserId = initialData.userId || 'guest'
    try {
      const userDecks = await flashcardManager.getDecks(effectiveUserId, isPremium)
      setDecks(userDecks)
      showToast(t('flashcards.success.deckCreated'), 'success')
    } catch (error) {
    }
  }

  const handleCreateDeck = async (deckRequest: CreateDeckRequest) => {
    if (!initialData.userId) {
      showToast(t('flashcards.limits.guest'), 'error')
      return
    }
    if (!isPremium) {
      redirectToPricing(t('flashcards.upgradeToCreate'))
      return
    }

    // Note: Deck limit is now checked in handleOpenDeckCreator() before modal opens (better UX)
    // FlashcardManager.createDeck() also validates as a backend failsafe

    try {
      const newDeck = await flashcardManager.createDeck(deckRequest, initialData.userId, isPremium)
      if (newDeck) {
        setDecks([newDeck, ...decks])
        setShowCreator(false)
        setEditingDeck(null)
        await loadData(true)
        showToast(t('flashcards.success.deckCreated'), 'success')
      }
    } catch (error: any) {

      if (error?.code === 'DUPLICATE_DECK_NAME') {
        showToast(t('errors.resource.alreadyExists') || 'This already exists. Please choose a different name.', 'error')
        return
      }

      if (error?.name === 'DECK_LIMIT_REACHED' || error.message?.includes('DECK_LIMIT_REACHED')) {
        showToast(
          t('flashcards.errors.deckLimitReached') || `You've reached the maximum number of decks for your plan. Upgrade to premium for more decks.`,
          'error'
        )
        return
      }

      if (error?.code === 'LIMIT_REACHED') {
        setLimitError({
          currentCount: error.currentCount || 0,
          limit: error.limit || 15,
        })
        return
      }

      if (error.name === 'QuotaExceededError' || error.message?.includes('QuotaExceededError')) {
        showToast(t('flashcards.errors.storageQuotaExceeded'), 'error')
        const suggestions = await storageManager.getCleanupSuggestions()
        if (suggestions.length > 0) {
          showToast(suggestions[0], 'info')
        }
      } else {
        const errorMessage = error?.message || t('flashcards.errors.saveFailed')
        showToast(errorMessage, 'error')
      }
    }
  }

  const handleUpdateDeck = async (deckRequest: CreateDeckRequest) => {
    if (!initialData.userId || !editingDeck) {
      showToast(t('flashcards.errors.updateFailed'), 'error')
      return
    }
    if (!isPremium) {
      redirectToPricing(t('flashcards.upgradeToCreate'))
      return
    }
    if (editingDeck.isStarter) {
      showToast(t('flashcards.starterDeckLocked'), 'error')
      return
    }

    try {
      const updatedDeck = await flashcardManager.updateFullDeck(
        editingDeck.id,
        deckRequest,
        initialData.userId,
        isPremium
      )
      if (updatedDeck) {
        setDecks(decks.map(d => (d.id === updatedDeck.id ? updatedDeck : d)))
        setShowCreator(false)
        setEditingDeck(null)
        await loadData(true)
        showToast(t('flashcards.success.deckUpdated'), 'success')
      }
    } catch (error) {
      if ((error as any)?.code === 'DUPLICATE_DECK_NAME') {
        showToast(t('errors.resource.alreadyExists') || 'This already exists. Please choose a different name.', 'error')
        return
      }
      showToast(t('flashcards.errors.updateFailed'), 'error')
    }
  }

  const handleEditDeck = (deck: FlashcardDeck) => {
    if (!isPremium) {
      redirectToPricing(t('flashcards.upgradeToCreate'))
      return
    }
    if (deck.isStarter) {
      showToast(t('flashcards.starterDeckLocked'), 'error')
      return
    }
    setEditingDeck(deck)
    setShowCreator(true)
  }

  const handleOpenDeckCreator = () => {
    if (!initialData.userId) {
      showToast(t('flashcards.limits.guest'), 'error')
      return
    }
    if (!isPremium) {
      redirectToPricing(t('flashcards.upgradeToCreate'))
      return
    }

    // Check deck limit BEFORE opening creator modal (better UX)
    const userDecks = decks.filter(d => d.source !== 'anki')
    if (limits.maxDecks !== -1 && userDecks.length >= limits.maxDecks) {
      showToast(
        t('flashcards.errors.deckLimitReached') || `You've reached the maximum number of decks (${limits.maxDecks}) for your plan`,
        'error'
      )
      return
    }

    setShowCreator(true)
  }

  const handleDeleteDeck = (deck: FlashcardDeck) => {
    if (!isPremium) {
      redirectToPricing(t('flashcards.upgradeToDeleteStarter'))
      return
    }
    setDeckToDelete(deck)
    setShowDeleteDialog(true)
  }

  const isAnkiDeck = (deck: FlashcardDeck) => {
    if (deck.source === 'anki') return true
    if ((deck as any)?.metadata?.ankiImport === true) return true
    const cards = (deck as any)?.cards
    if (Array.isArray(cards)) {
      return cards.some((card: any) =>
        card?.metadata?.source === 'anki' ||
        Boolean(card?.audioFilename) ||
        Boolean(card?.imageFilename)
      )
    }
    return false
  }

  const handleToggleAnkiBackup = (deck: FlashcardDeck, enabled: boolean) => {
    if (!initialData.userId || !isPremium) {
      redirectToPricing(t('flashcards.upgradeToCreate'))
      return
    }
    if (!isAnkiDeck(deck)) return

    if (enabled) {
      showToast(t('flashcards.ankiBackup.reimportRequired'), 'info')
      return
    }

    setDeckToDisableAnkiBackup(deck)
    setShowDisableAnkiBackupDialog(true)
  }

  const handleReviewWeakCards = (deck: FlashcardDeck) => {
    if (!effectiveUserId) return
    const payload = weakCardsStore.load(effectiveUserId, deck.id)
    const entries = payload?.entries || []
    const cardIds = entries.map(entry => entry.cardId)
    if (cardIds.length === 0) {
      showToast(t('flashcards.weakCards.none'), 'info')
      return
    }
    const cardMap = new Map(deck.cards.map(card => [card.id, card]))
    const cardsToReview = cardIds
      .map(cardId => cardMap.get(cardId))
      .filter(Boolean) as FlashcardContent[]
    if (cardsToReview.length === 0) {
      weakCardsStore.clear(effectiveUserId, deck.id)
      setWeakCardCountsByDeckId(prev => {
        const next = { ...prev }
        delete next[deck.id]
        return next
      })
      showToast(t('flashcards.weakCards.none'), 'info')
      return
    }
    setWeakCardsDeck(deck)
    setWeakCards(cardsToReview)
    setWeakCardIndex(0)
    setWeakCardEntries(entries)
    setShowAgainOnly(false)
    setShowWeakCardsModal(true)
  }

  const confirmDisableAnkiBackup = async () => {
    if (!initialData.userId || !deckToDisableAnkiBackup) return

    const deck = deckToDisableAnkiBackup
    setShowDisableAnkiBackupDialog(false)
    setDeckToDisableAnkiBackup(null)

    showToast(t('flashcards.ankiBackup.disabling', { name: deck.name }), 'info')

    const result = await ankiDeckManager.setR2BackupEnabled(
      deck.id,
      initialData.userId,
      isPremium,
      false
    )

    if (result === 'disabled') {
      setDecks(prev =>
        prev.map(existing =>
          existing.id === deck.id
            ? {
                ...existing,
                metadata: {
                  ...existing.metadata,
                  r2BackupEnabled: false,
                },
              }
            : existing
        )
      )
      await loadR2Usage()
      showToast(t('flashcards.ankiBackup.disabled'), 'success')
      return
    }

    if (result === 'cleanup_failed') {
      setDecks(prev =>
        prev.map(existing =>
          existing.id === deck.id
            ? {
                ...existing,
                metadata: {
                  ...existing.metadata,
                  r2BackupEnabled: false,
                },
              }
            : existing
        )
      )
      await loadR2Usage()
      showToast(t('flashcards.ankiBackup.cleanupFailed'), 'error')
      return
    }

    showToast(t('flashcards.errors.updateFailed'), 'error')
  }

  const handleToggleDeckSelection = (deckId: string) => {
    setSelectedDeckIds(prev => {
      const next = new Set(prev)
      if (next.has(deckId)) {
        next.delete(deckId)
      } else {
        next.add(deckId)
      }
      setSelectAllMode(next.size === decks.length && decks.length > 0)
      return next
    })
  }

  const handleToggleSelectAll = () => {
    if (decks.length === 0) return
    setSelectedDeckIds(prev => {
      const isAllSelected = prev.size === decks.length
      if (isAllSelected) {
        setSelectAllMode(false)
        return new Set()
      }
      setSelectAllMode(true)
      return new Set(decks.map(deck => deck.id))
    })
  }

  const handleBulkDeleteSelected = async () => {
    if (!effectiveUserId || selectedDeckIds.size === 0) return
    if (!isPremium) {
      redirectToPricing(t('flashcards.upgradeToDeleteStarter'))
      return
    }

    const selectedDecks = decks.filter(deck => selectedDeckIds.has(deck.id))
    if (selectedDecks.length === 0) return

    setShowBulkDeleteDialog(false)
    const decksToDelete = selectAllMode
      ? await flashcardManager.getDecks(effectiveUserId, isPremium)
      : selectedDecks
    showToast(`Deleting ${decksToDelete.length} decks...`, 'info')

    const deckIdsToDelete = new Set(decksToDelete.map(deck => deck.id))
    setDecks(prev => prev.filter(deck => !deckIdsToDelete.has(deck.id)))
    setSelectedDeckIds(new Set())
    setSelectAllMode(false)

    const deletionResults = await Promise.allSettled(
      decksToDelete.map(deck =>
        isAnkiDeck(deck)
          ? ankiDeckManager.deleteDeck(deck.id, effectiveUserId, isPremium)
          : flashcardManager.deleteDeck(deck.id, effectiveUserId, isPremium)
      )
    )

    const successCount = deletionResults.filter(result => result.status === 'fulfilled' && result.value).length
    const failedCount = decksToDelete.length - successCount

    await loadData(true)

    if (isPremium && decksToDelete.some(deck => isAnkiDeck(deck))) {
      await loadR2Usage()
    }

    if (failedCount > 0) {
      const failedAnki = decksToDelete.filter((deck, index) => {
        const result = deletionResults[index]
        return isAnkiDeck(deck) && (result.status === 'rejected' || result.value === false)
      })
      if (failedAnki.length > 0) {
        const failures = failedAnki.map((deck) => {
          const index = decksToDelete.findIndex(d => d.id === deck.id)
          const result = deletionResults[index]
          return {
            id: deck.id,
            name: deck.name,
            status: result?.status,
            reason: result?.status === 'rejected' ? String(result.reason) : undefined
          }
        })
        console.error('[FlashcardsContent] Anki delete failed for decks:', failedAnki.map(deck => ({
          id: deck.id,
          name: deck.name
        })))
        console.error('[FlashcardsContent] Anki delete failure details:', failures)
      }
      showToast(t('flashcards.errors.deleteFailed'), 'error')
      return
    }

    showToast(t('flashcards.success.deckDeleted'), 'success')
  }

  const confirmDeleteDeck = async () => {
    if (!initialData.userId || !deckToDelete) return

    const deckToDeleteCopy = deckToDelete

    // Close dialog immediately to avoid blocking UI
    setShowDeleteDialog(false)
    setDeckToDelete(null)

    // Show deleting toast
    showToast(t('flashcards.deleting', { name: deckToDeleteCopy.name }), 'info')

    // Optimistically remove from UI
    setDecks(decks.filter(d => d.id !== deckToDeleteCopy.id))

    // Delete in background (non-blocking)
    const deletePromise = isAnkiDeck(deckToDeleteCopy)
      ? ankiDeckManager.deleteDeck(deckToDeleteCopy.id, initialData.userId, isPremium)
      : flashcardManager.deleteDeck(deckToDeleteCopy.id, initialData.userId, isPremium)

    deletePromise.then(async success => {
      if (success) {
        // Refresh data in background
        loadData(true).then(() => {
          showToast(t('flashcards.success.deckDeleted'), 'success')
        })
        if (isPremium && deckToDeleteCopy.source === 'anki') {
          await loadR2Usage()
        }
      } else {
        // Restore deck on failure
        setDecks(prevDecks => [...prevDecks, deckToDeleteCopy])
        showToast(t('flashcards.errors.deleteFailed'), 'error')
      }
    }).catch(error => {
      // Restore deck on error
      setDecks(prevDecks => [...prevDecks, deckToDeleteCopy])
      showToast(t('flashcards.errors.deleteFailed'), 'error')
    })
  }

  const handleExportDeck = async (deck: FlashcardDeck) => {
    if (!isPremium) {
      redirectToPricing(t('flashcards.upgradeToCreate'))
      return
    }
    if (deck.isStarter) {
      showToast(t('flashcards.starterDeckNoExport'), 'error')
      return
    }
    try {
      const csvData = await flashcardManager.exportDeck(deck.id, 'csv')
      const blob = new Blob([csvData], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${deck.name}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showToast(t('flashcards.success.exported'), 'success')
    } catch (error) {
      showToast(t('flashcards.export.error'), 'error')
    }
  }

  const handleStudyDeck = (deck: FlashcardDeck) => {
    if (!initialData.userId && userTier === 'guest') {
      showToast(t('flashcards.limits.guest'), 'error')
      return
    }

    setDeckToStudy(deck)
    setShowModeSelector(true)
  }

  const handleInstantStudy = (deck: FlashcardDeck, cards: FlashcardContent[]) => {
    if (!initialData.userId && userTier === 'guest') {
      showToast(t('flashcards.limits.guest'), 'error')
      return
    }

    if (!cards.length) {
      showToast(t('flashcards.noCardsAvailable') || 'No cards available for this mode', 'info')
      return
    }

    setResumeSessionState(null)
    setStudyingDeck({
      ...deck,
      cards,
      settings: {
        ...deck.settings,
        reviewMode: 'srs',
        sessionLength: cards.length,
      },
    })
  }

  const handleInstantStudyGroups = (groups: Array<{ deck: FlashcardDeck; cards: FlashcardContent[] }>) => {
    if (!groups.length) return
    const [first, ...rest] = groups
    setMultiDeckQueue(rest)
    handleInstantStudy(first.deck, first.cards)
  }

  const handleToggleInsights = () => {
    const newValue = !showInsights
    setShowInsights(newValue)
    if (typeof window !== 'undefined') {
      localStorage.setItem('flashcards_show_insights', String(newValue))
    }
  }

  const migrationPercent = migrationProgress && migrationProgress.total > 0
    ? Math.round(
        ((migrationProgress.completed + (migrationProgress.currentProgress || 0) / 100) / migrationProgress.total) * 100
      )
    : 0
  const hasNonStarterDecks = decks.some(deck => !deck.isStarter)
  const showSyncUpgrade = Boolean(initialData.userId && !isPremium)
  const isAllSelected = decks.length > 0 && selectedDeckIds.size === decks.length
  const isPartiallySelected = selectedDeckIds.size > 0 && selectedDeckIds.size < decks.length
  const weakCardDifficultyById = useMemo(
    () => new Map(weakCardEntries.map(entry => [entry.cardId, entry.difficulty])),
    [weakCardEntries]
  )
  const visibleWeakCards = useMemo(() => {
    if (!showAgainOnly) return weakCards
    return weakCards.filter(card => weakCardDifficultyById.get(card.id) === 'again')
  }, [showAgainOnly, weakCards, weakCardDifficultyById])
  useEffect(() => {
    if (visibleWeakCards.length === 0) {
      setWeakCardIndex(0)
      return
    }
    if (weakCardIndex > visibleWeakCards.length - 1) {
      setWeakCardIndex(visibleWeakCards.length - 1)
    }
  }, [visibleWeakCards, weakCardIndex])

  const handleStartSession = (selectedCards: any[], mode: string) => {
    if (!deckToStudy || selectedCards.length === 0) return

    setResumeSessionState(null)
    setStudyingDeck({
      ...deckToStudy,
      cards: selectedCards,
      settings: {
        ...deckToStudy.settings,
        reviewMode: mode === 'speed' ? 'sequential' : mode === 'cramming' ? 'random' : 'srs',
        sessionLength: selectedCards.length,
      },
    })

    setShowModeSelector(false)
    setDeckToStudy(null)
  }

  const handleStartSessionWithSettings = async (settings: Partial<import('@/types/flashcards').DeckSettings>) => {
    if (!deckToStudy || !initialData.userId) return
    if (deckToStudy.isStarter) {
      showToast(t('flashcards.starterDeckLocked'), 'error')
      return
    }

    try {
      setResumeSessionState(null)
      // Update deck with new settings
      const updatedDeck = await flashcardManager.updateDeck(
        deckToStudy.id,
        {
          settings: {
            ...deckToStudy.settings,
            ...settings
          }
        },
        initialData.userId,
        isPremium
      )

      if (updatedDeck) {
        // Update in local state
        setDecks(prevDecks =>
          prevDecks.map(d => d.id === updatedDeck.id ? updatedDeck : d)
        )

        const sessionLength = Math.max(1, Math.min(
          settings.sessionLength ?? updatedDeck.settings.sessionLength ?? updatedDeck.cards.length,
          updatedDeck.cards.length
        ))
        const reviewMode = settings.reviewMode ?? updatedDeck.settings.reviewMode
        let sessionCards = [...updatedDeck.cards]

        if (reviewMode === 'random') {
          sessionCards.sort(() => Math.random() - 0.5)
        } else if (reviewMode === 'srs') {
          sessionCards = sessionCards.map(card =>
            card.metadata?.status ? card : FlashcardSRSHelper.initializeCardSRS(card)
          )
          sessionCards = FlashcardSRSHelper.sortByPriority(sessionCards)
        }

        sessionCards = sessionCards.slice(0, sessionLength)

        // Start the study session
        setStudyingDeck({
          ...updatedDeck,
          cards: sessionCards,
          settings: {
            ...updatedDeck.settings,
            ...settings,
            sessionLength
          }
        })
      }

      setShowSessionSettings(false)
      setDeckToStudy(null)
    } catch (error) {
      showToast(t('flashcards.errors.updateFailed'), 'error')
    }
  }

  const applyRemoteSession = useCallback(async () => {
    if (!pendingRemoteSession || !initialData.userId) return
    const deck = await flashcardManager.getDeck(pendingRemoteSession.deckId, initialData.userId)
    if (!deck || !deck.cards?.length) {
      setShowRemoteSessionDialog(false)
      setPendingRemoteSession(null)
      return
    }

    const cardMap = new Map(deck.cards.map(card => [card.id, card]))
    const sessionCards = pendingRemoteSession.cardIds
      .map(cardId => cardMap.get(cardId))
      .filter(Boolean) as FlashcardContent[]

    if (sessionCards.length === 0) {
      setShowRemoteSessionDialog(false)
      setPendingRemoteSession(null)
      return
    }

    const gradedCardIds = new Set<string>((pendingRemoteSession.responses || []).map(([cardId]) => cardId))
    let nextIndex = Math.max(0, Math.min(pendingRemoteSession.currentIndex, sessionCards.length - 1))
    while (nextIndex < sessionCards.length && gradedCardIds.has(sessionCards[nextIndex].id)) {
      nextIndex += 1
    }
    if (nextIndex >= sessionCards.length) {
      nextIndex = sessionCards.length - 1
    }

    const resumeState = nextIndex === pendingRemoteSession.currentIndex
      ? pendingRemoteSession
      : { ...pendingRemoteSession, currentIndex: nextIndex }

    setResumeSessionState(resumeState)
    setStudyingDeck({
      ...deck,
      cards: sessionCards,
      settings: {
        ...deck.settings,
        sessionLength: sessionCards.length,
      },
    })

    setShowRemoteSessionDialog(false)
    setPendingRemoteSession(null)
  }, [pendingRemoteSession, initialData.userId])

  const ignoreRemoteSession = useCallback(() => {
    setShowRemoteSessionDialog(false)
    setPendingRemoteSession(null)
  }, [])

  const handleSessionComplete = async (summary: SessionSummary) => {
    // Capture deck name before clearing state
    const deckName = studyingDeck?.name || 'Flashcard Deck'

    setResumeSessionState(null)
    setStudyingDeck(null)

    // Emit SESSION_COMPLETED event via Event Hub for gamification
    // This uses the same pattern as Kana, Kanji, Lists, etc.
    if (initialData.userId && summary.xpEarned && summary.xpEarned > 0) {
      try {
        const sessionId = `flashcard-${Date.now()}`
        const duration = summary.averageResponseTime * summary.cardsStudied

        const eventPayload = {
          data: {
            sessionId,
            statistics: {
              correctItems: summary.correctAnswers,
              accuracy: summary.accuracy,
              averageResponseTime: summary.averageResponseTime,
              bestStreak: summary.bestStreak || 0,
              // Include flashcard-specific data for XP calculation
              itemsReviewed: summary.cardsStudied,
              fastCards: summary.fastCards || 0,
            },
            duration,
          },
        }

        // Set session stats BEFORE emitting event so gamificationListener can preserve them
        const statsToSet = {
          itemsCompleted: summary.cardsStudied,
          accuracy: summary.accuracy,
          duration: duration,
          xpGained: summary.xpEarned || 0,
          contentType: 'flashcard' as const,
          contentTitle: deckName,
          pageCount: summary.cardsStudied, // Show as "Cards Studied"
        }
        useGamificationStore.getState().setLastSessionStats(statsToSet)

        // Emit event - gamificationListener will handle the API call
        // It will preserve the contentType and contentTitle we just set
        getEventHub().emit(ReviewEventType.SESSION_COMPLETED, eventPayload)

        // Celebration screen will show XP and stats - no need for toast
      } catch (error) {
        console.error('[FlashcardsContent] ❌ Error emitting gamification event:', error)
      }
    }

    await loadData(false, multiDeckQueue.length === 0)

    if (multiDeckQueue.length > 0) {
      const [next, ...rest] = multiDeckQueue
      setMultiDeckQueue(rest)
      setStudyingDeck({
        ...next.deck,
        cards: next.cards,
        settings: {
          ...next.deck.settings,
          reviewMode: 'srs',
          sessionLength: next.cards.length,
        },
      })
    }
  }

  // Calculate overall stats
  const totalCards = decks.reduce((sum, deck) => sum + (deck.stats?.totalCards ?? deck.cards?.length ?? 0), 0)
  const totalMastered = decks.reduce((sum, deck) => sum + (deck.stats?.masteredCards ?? 0), 0)
  const getDeckDailyLimits = (deck: FlashcardDeck) => ({
    newCardsPerDay: deck.settings?.newCardsPerDay ?? 20,
    reviewsPerDay: deck.settings?.reviewsPerDay ?? 20,
  })

  const getDeckDueCount = (deck: FlashcardDeck) => {
    const now = Date.now()
    const limits = getDeckDailyLimits(deck)

    const newCards = deck.cards.filter(card => !card.metadata?.status || card.metadata.status === 'new')
    const reviewCards = deck.cards.filter(
      card =>
        card.metadata?.status &&
        card.metadata.status !== 'new' &&
        card.metadata.nextReview &&
        card.metadata.nextReview <= now
    )

    const limitedNew = Math.min(newCards.length, limits.newCardsPerDay)
    const limitedReviews = Math.min(reviewCards.length, limits.reviewsPerDay)

    return limitedNew + limitedReviews
  }

  const totalDue = decks.reduce((sum, deck) => sum + getDeckDueCount(deck), 0)
  const averageAccuracy =
    decks.length > 0
      ? decks.reduce((sum, deck) => sum + deck.stats.averageAccuracy, 0) / decks.length
      : 0

  if (authLoading || loading) {
    return <LoadingOverlay message={t('common.loading')} />
  }

  if (studyingDeck) {
    return (
      <StudySession
        key={resumeSessionState?.savedAt ? `resume-${resumeSessionState.savedAt}` : 'new-session'}
        deck={studyingDeck}
        cards={studyingDeck.cards}
        onComplete={handleSessionComplete}
        onExit={() => {
          setResumeSessionState(null)
          setStudyingDeck(null)
        }}
        onDeckUpdated={async (deckId) => {
          // Reload deck from IndexedDB and update state
          const updatedDeck = await flashcardManager.getDeck(deckId, initialData.userId || 'guest')
          if (updatedDeck) {
            // Update decks array
            setDecks(prevDecks => prevDecks.map(d => d.id === deckId ? updatedDeck : d))
            // Update studying deck so session has fresh data
            setStudyingDeck(updatedDeck)
          }
        }}
        initialState={resumeSessionState}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-DEFAULT dark:from-dark-850 dark:to-dark-900">
      {/* Desktop Navbar */}
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      <PageHeader
        title={t('flashcards.title') || 'Flashcards'}
        description={t('flashcards.description')}
        backHref="/dashboard"
        actions={
          <ActionMenu
            items={[
              {
                label: t('flashcards.insights'),
                icon: <PieChart className="w-4 h-4" />,
                onClick: handleToggleInsights,
                hidden: !initialData.userId || decks.length === 0,
              },
              {
                label: isAllSelected
                  ? t('flashcards.selectAll')?.replace('Select', 'Deselect') || 'Deselect all'
                  : t('flashcards.selectAll') || 'Select all',
                icon: isAllSelected ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                ),
                onClick: handleToggleSelectAll,
                hidden: decks.length === 0 || !isPremium,
              },
              {
                label: t('flashcards.createDeck'),
                icon: <Plus className="w-4 h-4" />,
                onClick: handleOpenDeckCreator,
                hidden: !isPremium,
              },
              {
                label: t('flashcards.actions.syncAll'),
                icon: isSyncingMedia ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                ),
                onClick: () => {
                  if (!isSyncingMedia) {
                    handleBulkSync()
                  }
                },
                hidden: !isPremium,
              },
              {
                label: t('flashcards.actions.exportAll'),
                icon: <Download className="w-4 h-4" />,
                onClick: handleExportAll,
                hidden: !isPremium || !hasNonStarterDecks,
              },
              {
                label: 'Run Flashcards Tests',
                icon: <AlertTriangle className="w-4 h-4" />,
                onClick: handleOpenFlashcardsTests,
                hidden: !showFlashcardsTestButton || !user,
              },
            ]}
            size="md"
          />
        }
      />

      <div className="container mx-auto px-4 py-8">
        {initialData.userId && <FlashcardsStoragePermissionModal />}

        {/* Migration Banner for New Premium Users */}
        {showMigration && isPremium && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold mb-1">{t('flashcards.migration.title')}</h3>
                <p className="text-sm opacity-90">{t('flashcards.migration.description')}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkSync}
                  className="px-4 py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-gray-100"
                >
                  {t('flashcards.migration.syncNow')}
                </button>
                <button
                  onClick={() => setShowMigration(false)}
                  className="px-3 py-2 bg-white/20 rounded-lg hover:bg-white/30"
                >
                  {t('common.later')}
                </button>
              </div>
            </div>
          </motion.div>
        )}


        {/* Storage Info (desktop only) */}
        {storageInfo && !isPremium && (
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
            <span>{t('flashcards.storage.using')}:</span>
            <span className="font-medium">
              {storageManager.formatBytes(storageInfo.usage)} /{' '}
              {storageManager.formatBytes(storageInfo.quota)}
            </span>
            <span
              className={cn(
                'px-2 py-1 rounded-full text-xs',
                storageInfo.percentage > 90
                  ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300'
                  : storageInfo.percentage > 70
                    ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300'
                    : 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300'
              )}
            >
              {Math.round(storageInfo.percentage)}%
            </span>
          </div>
        )}

        {/* Deck Limits Warning */}
        {!initialData.userId && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-yellow-800 dark:text-yellow-200">{t('flashcards.limits.guest')}</p>
          </div>
        )}

        {initialData.userId && !isPremium && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-blue-800 dark:text-blue-200">{t('flashcards.starterOnly')}</p>
          </div>
        )}

        {/* DeckMarket + Cloud Storage & Sync Progress */}
        {initialData.userId && (
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* DeckMarket Card */}
            {isFeatureEnabled('DECKMARKET') && (
              <Link
                href="/deckmarket"
                className="group block rounded-xl overflow-hidden border border-gray-200 dark:border-dark-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="relative h-16 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 overflow-hidden">
                  <div className="absolute inset-0 opacity-15" style={{
                    backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)',
                    backgroundSize: '16px 16px'
                  }} />
                  <div className="absolute inset-0 flex items-center px-4 gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                      <Store className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-bold text-white text-base tracking-tight">
                      {strings.deckmarket.title}
                    </h3>
                  </div>
                </div>
                <div className="bg-white dark:bg-dark-800 px-4 py-3 flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {strings.deckmarket.subtitle}
                  </p>
                  <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </div>
              </Link>
            )}

            {/* Cloud Storage Widget */}
            {isPremium && r2Usage && (
              <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Cloud Storage</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {storageManager.formatBytes(r2Usage.usedBytes)} / {storageManager.formatBytes(r2Usage.limitBytes)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {Math.round((r2Usage.usedBytes / r2Usage.limitBytes) * 100)}%
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">used</div>
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="mt-3 w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.round((r2Usage.usedBytes / r2Usage.limitBytes) * 100))}%`
                    }}
                  />
                </div>
              </div>
            )}

            {/* Sync Progress Bar */}
            {isPremium && migrationProgress && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-4"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500"></div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {migrationProgress.phase === 'download' && (t('flashcards.sync.downloading') || 'Downloading from cloud')}
                      {migrationProgress.phase === 'upload' && (t('flashcards.sync.uploading') || 'Uploading to cloud')}
                      {migrationProgress.phase === 'r2' && t('flashcards.migration.inProgress')}
                      {!migrationProgress.phase && t('flashcards.migration.inProgress')}
                    </h3>
                    {migrationProgress.total > 0 && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {migrationProgress.completed}/{migrationProgress.total} decks
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {migrationPercent}%
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">synced</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCancelSyncDialog(true)}
                      className="p-2 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title={t('common.stop')}
                      aria-label={t('common.stop')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {migrationProgress.currentDeck && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 truncate">
                    {t('flashcards.migration.syncingDeck', { deck: migrationProgress.currentDeck })}
                  </p>
                )}
                {/* Progress Bar */}
                <div className="mt-3 w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2">
                  <div
                    className={
                      migrationProgress.total > 0
                        ? 'bg-gradient-to-r from-primary-500 to-purple-500 h-2 rounded-full transition-all'
                        : 'bg-gradient-to-r from-primary-500 to-purple-500 h-2 rounded-full animate-pulse w-1/3'
                    }
                    style={{
                      width: `${
                        migrationProgress.total > 0
                          ? Math.max(2, migrationPercent)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Deck Grid - Primary content first */}
        {selectedDeckIds.size > 0 && (
          <div className="mb-6 p-4 bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleSelectAll}
                className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                {isAllSelected ? (
                  <CheckSquare className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                ) : isPartiallySelected ? (
                  <div className="relative">
                    <Square className="w-5 h-5" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-primary-600 dark:bg-primary-400 rounded-sm" />
                    </div>
                  </div>
                ) : (
                  <Square className="w-5 h-5" />
                )}
                <span className="text-sm font-medium">
                  {t('flashcards.bulk.selected', { count: selectedDeckIds.size })}
                </span>
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-500">
                {selectedDeckIds.size} {t('flashcards.decks') || 'decks'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <button
                onClick={() => setShowBulkDeleteDialog(true)}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {t('flashcards.bulk.delete')}
              </button>
              <button
                onClick={() => setSelectedDeckIds(new Set())}
                className="w-full sm:w-auto px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-700 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
              >
                {t('common.clear')}
              </button>
            </div>
          </div>
        )}

        <div className="mb-8">
          <DeckGrid
            decks={decks}
            onDeckClick={handleStudyDeck}
            onCreateDeck={handleOpenDeckCreator}
            onEditDeck={handleEditDeck}
            onDeleteDeck={handleDeleteDeck}
            onExportDeck={handleExportDeck}
            onToggleAnkiBackup={handleToggleAnkiBackup}
            onReviewWeakCards={handleReviewWeakCards}
            onStudyDeck={handleStudyDeck}
            onSessionSettings={deck => {
              setDeckToStudy(deck)
              setShowSessionSettings(true)
            }}
            showStats={true}
            gridCols={4}
            isPremium={isPremium}
            hideCreateCard={true}
            restoreProgressByDeckId={restoreProgressByDeckId}
            selectedDeckIds={isPremium ? selectedDeckIds : undefined}
            onToggleSelect={isPremium ? handleToggleDeckSelection : undefined}
            weakCardCountsByDeckId={weakCardCountsByDeckId}
          />
        </div>

        {/* Insights Widgets (Daily Goals, Study Recommendations & Statistics) */}
        <AnimatePresence mode="wait">
          {showInsights && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {/* Daily Goals (show for logged in users) */}
              {initialData.userId && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-8"
                >
                  <div className="mb-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-4 items-stretch">
                    <div className="h-full">
                      <FlashcardMasteryWidget decks={decks} snapshots={streakSnapshots} />
                    </div>
                    <div className="flex flex-col gap-4 h-full">
                      <div className="flex-1">
                        <MomentumCoach
                          decks={decks}
                          onSelectDeck={deck => handleStudyDeck(deck)}
                        />
                      </div>
                      <div className="flex-1">
                      <HeatFocusWidget
                        decks={decks}
                        onReviewGroups={groups => handleInstantStudyGroups(groups)}
                      />
                      </div>
                    </div>
                  </div>
                  {showSyncUpgrade && (
                    <div className="mb-3 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-800 dark:text-blue-200 flex items-center justify-between gap-3">
                      <span>{t('flashcards.upgradeToSync')}</span>
                      <button
                        onClick={() => router.push(pricingPath)}
                        className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        {t('flashcards.upgradeToSyncCta')}
                      </button>
                    </div>
                  )}
                  <DailyGoals
                    userId={initialData.userId}
                    isPremium={isPremium}
                    onGoalComplete={goalType => {
                    }}
                  />
                </motion.div>
              )}

              {/* Study Recommendations (show only if user has decks and recommendations) */}
              {initialData.userId && (recommendations.length > 0 || !isPremium) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mb-8"
                >
                  {showSyncUpgrade && (
                    <div className="mb-3 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-800 dark:text-blue-200 flex items-center justify-between gap-3">
                      <span>{t('flashcards.upgradeToSync')}</span>
                      <button
                        onClick={() => router.push(pricingPath)}
                        className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        {t('flashcards.upgradeToSyncCta')}
                      </button>
                    </div>
                  )}
                  <StudyRecommendations
                    recommendations={recommendations}
                    insights={insights}
                    currentStreak={currentStreak}
                    onSelectDeck={deckId => {
                      const deck = decks.find(d => d.id === deckId)
                      if (deck) handleStudyDeck(deck)
                    }}
                  />
                </motion.div>
              )}

              {/* Action Buttons Row for Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex justify-end mb-4"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowStats(!showStats)}
                  type="button"
                  className="px-4 py-2 bg-gradient-to-r from-primary-500 to-purple-500 text-white rounded-lg shadow-lg font-medium flex items-center gap-2"
                >
                  <BarChart3 className="w-5 h-5" />
                  {showStats ? t('flashcards.hideStats') : t('flashcards.showStats')}
                </motion.button>
              </motion.div>

              {/* Statistics Dashboard or Cards */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {showSyncUpgrade && (
                  <div className="mb-3 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-800 dark:text-blue-200 flex items-center justify-between gap-3">
                    <span>{t('flashcards.upgradeToSync')}</span>
                    <button
                      onClick={() => router.push(pricingPath)}
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      {t('flashcards.upgradeToSyncCta')}
                    </button>
                  </div>
                )}
                {showStats ? (
                  <StatsDashboard
                    decks={decks}
                    sessions={sessions}
                    userId={initialData.userId || undefined}
                    onViewDetails={deckId => {
                      const deck = decks.find(d => d.id === deckId)
                      if (deck) handleStudyDeck(deck)
                    }}
                  />
                ) : (
                  /* Stats Cards */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="bg-soft-white dark:bg-dark-800 rounded-xl p-6 shadow-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <BookOpen className="w-8 h-8 text-blue-500" />
                        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {totalCards}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('flashcards.totalCards', { count: totalCards })}
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="bg-soft-white dark:bg-dark-800 rounded-xl p-6 shadow-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Trophy className="w-8 h-8 text-yellow-500" />
                        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {totalMastered}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('flashcards.masteryLevel')}
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="bg-soft-white dark:bg-dark-800 rounded-xl p-6 shadow-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Target className="w-8 h-8 text-green-500" />
                        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {Math.round(averageAccuracy * 100)}%
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('flashcards.stats.averageAccuracy')}
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="bg-soft-white dark:bg-dark-800 rounded-xl p-6 shadow-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Clock className="w-8 h-8 text-purple-500" />
                        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {totalDue}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('flashcards.dueForReview')}
                      </p>
                    </motion.div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Deck Creator Modal */}
        <DeckCreator
          isOpen={showCreator}
          onClose={() => {
            setShowCreator(false)
            setEditingDeck(null)
          }}
          onSave={editingDeck ? handleUpdateDeck : handleCreateDeck}
          userLists={userLists}
          userId={initialData.userId || 'guest'}
          isPremium={isPremium}
          editDeck={editingDeck}
          onAnkiImportComplete={refreshDecks}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog
          isOpen={showDeleteDialog}
          onClose={() => {
            setShowDeleteDialog(false)
            setDeckToDelete(null)
          }}
          onConfirm={confirmDeleteDeck}
          title={t('flashcards.confirmDelete.title')}
          message={t('flashcards.confirmDelete.message', { name: deckToDelete?.name || '' })}
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          type="danger"
        />

        {/* Bulk Delete Confirmation Dialog */}
        <Dialog
          isOpen={showBulkDeleteDialog}
          onClose={() => setShowBulkDeleteDialog(false)}
          onConfirm={handleBulkDeleteSelected}
          title={t('flashcards.confirmDelete.title')}
          message={
            t('flashcards.bulk.confirmDelete', { count: selectedDeckIds.size }) ||
            `Delete ${selectedDeckIds.size} decks?`
          }
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          type="danger"
        />

        {/* Cancel Sync Confirmation Dialog */}
        <Dialog
          isOpen={showCancelSyncDialog}
          onClose={() => setShowCancelSyncDialog(false)}
          onConfirm={handleCancelSync}
          title={t('flashcards.migration.cancelSyncTitle') || 'Stop syncing?'}
          message={
            t('flashcards.migration.cancelSyncMessage') ||
            'This will stop the current sync and clear any in-progress restores.'
          }
          confirmText={t('flashcards.migration.cancelSyncConfirm') || 'Stop sync'}
          cancelText={t('common.cancel')}
          type="danger"
        />
        <Dialog
          isOpen={showDisableAnkiBackupDialog}
          onClose={() => {
            setShowDisableAnkiBackupDialog(false)
            setDeckToDisableAnkiBackup(null)
          }}
          onConfirm={confirmDisableAnkiBackup}
          title={t('flashcards.ankiBackup.disableConfirmTitle')}
          message={t('flashcards.ankiBackup.disableConfirmMessage', { name: deckToDisableAnkiBackup?.name || '' })}
          confirmText={t('flashcards.ankiBackup.disableConfirmAction')}
          cancelText={t('common.cancel')}
          type="danger"
        />
        <Dialog
          isOpen={showRemoteSessionDialog}
          onClose={ignoreRemoteSession}
          onConfirm={applyRemoteSession}
          title={t('flashcards.resumeRemote.title') || 'Resume session from another device?'}
          message={
            t('flashcards.resumeRemote.message') ||
            'We found a newer flashcard session from another device. Do you want to resume it here?'
          }
          confirmText={t('flashcards.resumeRemote.confirm') || 'Resume'}
          cancelText={t('flashcards.resumeRemote.cancel') || 'Keep local'}
        />

        {/* Study Mode Selector Modal */}
        {deckToStudy && showModeSelector && (
          <StudyModeSelector
            deck={deckToStudy}
            userId={effectiveUserId || deckToStudy.userId || 'guest'}
            onClose={() => {
              setShowModeSelector(false)
              setDeckToStudy(null)
            }}
            onStartStudy={handleStartSession}
          />
        )}

        {/* Session Settings Modal */}
        {deckToStudy && showSessionSettings && (
          <SessionSettingsModal
            isOpen={showSessionSettings}
            deck={deckToStudy}
            onClose={() => {
              setShowSessionSettings(false)
              setDeckToStudy(null)
            }}
            onStartSession={handleStartSessionWithSettings}
          />
        )}

        {/* Comeback Message */}
        {comebackInfo && (
          <ComebackMessage
            daysAway={comebackInfo.daysAway}
            lastStudyDate={comebackInfo.lastStudyDate}
            onClose={() => setComebackInfo(null)}
          />
        )}

        {/* Sync Info Modal */}
        <Modal
          isOpen={showSyncInfoModal}
          onClose={() => {
            setShowSyncInfoModal(false)
            if (syncModalResolverRef.current) {
              syncModalResolverRef.current(true)
              syncModalResolverRef.current = null
            }
          }}
          title={t('flashcards.migration.infoModal.title')}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              {t('flashcards.migration.infoModal.message')}
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-red-600 dark:text-red-400 text-xs">✕</span>
                </div>
                <span className="text-gray-600 dark:text-gray-400">
                  {t('flashcards.migration.infoModal.cannotUse')}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 dark:text-green-400 text-xs">✓</span>
                </div>
                <span className="text-gray-600 dark:text-gray-400">
                  {t('flashcards.migration.infoModal.canUseApp')}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 dark:text-blue-400 text-xs">ℹ</span>
                </div>
                <span className="text-gray-600 dark:text-gray-400">
                  {t('flashcards.migration.infoModal.comeBack')}
                </span>
              </li>
            </ul>
            <div className="pt-4">
              <button
                onClick={() => {
                  setShowSyncInfoModal(false)
                  if (syncModalResolverRef.current) {
                    syncModalResolverRef.current(true)
                    syncModalResolverRef.current = null
                  }
                }}
                className="w-full px-6 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
              >
                {t('flashcards.migration.infoModal.understand')}
              </button>
            </div>
          </div>
        </Modal>

        {/* Deck Limit Error Modal */}
        <Modal
          isOpen={limitError !== null}
          onClose={() => setLimitError(null)}
          title={t('anki.limitReached.title')}
          size="md"
        >
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('anki.limitReached.title')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('anki.limitReached.message', {
                current: limitError?.currentCount || 0,
                limit: limitError?.limit || 15,
              })}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {t('anki.limitReached.upgrade')}
            </p>
            <button
              onClick={() => setLimitError(null)}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              {t('anki.limitReached.understood')}
            </button>
          </div>
        </Modal>

        {/* Weak Cards Modal */}
        <Modal
          isOpen={showWeakCardsModal}
          onClose={() => {
            setShowWeakCardsModal(false)
            setWeakCardsDeck(null)
            setWeakCards([])
            setWeakCardIndex(0)
            setWeakCardEntries([])
            setShowAgainOnly(false)
          }}
          title={t('flashcards.reviewWeakCards')}
          size="lg"
        >
          {weakCardsDeck && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {weakCardsDeck.name}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAgainOnly(prev => !prev)}
                    className="px-2 py-1 rounded-md text-xs font-medium border border-gray-200 dark:border-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                  >
                    {showAgainOnly
                      ? t('flashcards.weakCards.showAll')
                      : t('flashcards.weakCards.showAgainOnly')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!effectiveUserId || !weakCardsDeck) return
                      weakCardsStore.clear(effectiveUserId, weakCardsDeck.id)
                      if (isPremium) {
                        fetch('/api/flashcards/weak-cards', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ deckId: weakCardsDeck.id }),
                        }).catch(() => {})
                      }
                      setWeakCardCountsByDeckId(prev => {
                        const next = { ...prev }
                        delete next[weakCardsDeck.id]
                        return next
                      })
                      setShowWeakCardsModal(false)
                      setWeakCardsDeck(null)
                      setWeakCards([])
                      setWeakCardIndex(0)
                      setWeakCardEntries([])
                      setShowAgainOnly(false)
                    }}
                    className="px-2 py-1 rounded-md text-xs font-medium border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    {t('flashcards.weakCards.clear')}
                  </button>
                  {visibleWeakCards.length > 0 && (
                    <span>
                      {weakCardIndex + 1} / {visibleWeakCards.length}
                    </span>
                  )}
                </div>
              </div>

              {visibleWeakCards.length > 0 ? (
                <FlashcardViewer
                  card={visibleWeakCards[weakCardIndex]}
                  cardStyle={weakCardsDeck.cardStyle}
                  animationSpeed={weakCardsDeck.settings.animationSpeed}
                  showHints={weakCardsDeck.settings.showHints}
                  autoPlayAudio={weakCardsDeck.settings.autoPlay}
                  onNext={weakCardIndex < visibleWeakCards.length - 1 ? () => setWeakCardIndex(i => i + 1) : undefined}
                  onPrevious={weakCardIndex > 0 ? () => setWeakCardIndex(i => i - 1) : undefined}
                />
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-dark-700 p-4 text-sm text-gray-600 dark:text-gray-400">
                  {showAgainOnly
                    ? t('flashcards.weakCards.noneAgain')
                    : t('flashcards.weakCards.none')}
                </div>
              )}
            </div>
          )}
        </Modal>

      </div>

      <MobileNavSpacer />
    </div>
  )
}
