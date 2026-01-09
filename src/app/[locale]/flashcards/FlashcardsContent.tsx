'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { DeckGrid } from '@/components/flashcards/DeckGrid'
import { DeckCreator } from '@/components/flashcards/DeckCreator'
import { StudySession } from '@/components/flashcards/StudySession'
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
} from '@/types/flashcards'
import type { StudyRecommendation, LearningInsights } from '@/lib/flashcards/SessionManager'
import type { UserList } from '@/types/userLists'
import type { FlashcardsInitialData } from '@/lib/flashcards/server'
import { Trophy, TrendingUp, Target, Clock, BookOpen, BarChart3, AlertTriangle, Plus, PieChart, RefreshCw, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface FlashcardsContentProps {
  initialData: FlashcardsInitialData
}

export default function FlashcardsContent({ initialData }: FlashcardsContentProps) {
  const { t } = useI18n()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()

  // Initialize state with server data (will be empty for local-only mode)
  const [decks, setDecks] = useState<FlashcardDeck[]>(initialData.decks)

  // Debug: Track decks state changes
  useEffect(() => {
    console.log('📊 [FlashcardsContent] Decks state changed:', {
      count: decks.length,
      decks: decks.map(d => ({ id: d.id, name: d.name, cardCount: d.cards?.length }))
    })
  }, [decks])
  const [sessions, setSessions] = useState<SessionStats[]>(initialData.sessions)
  const [userLists, setUserLists] = useState<UserList[]>([])

  // For premium users with server data, skip initial loading
  const hasServerData = initialData.isPremium && initialData.decks.length > 0
  const [loading, setLoading] = useState(!hasServerData)

  const [showCreator, setShowCreator] = useState(false)
  const [editingDeck, setEditingDeck] = useState<FlashcardDeck | null>(null)
  const [studyingDeck, setStudyingDeck] = useState<FlashcardDeck | null>(null)
  const [deckToDelete, setDeckToDelete] = useState<FlashcardDeck | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
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
  const [migrationProgress, setMigrationProgress] = useState<any>(null)
  const [deckToStudy, setDeckToStudy] = useState<FlashcardDeck | null>(null)
  const [showModeSelector, setShowModeSelector] = useState(false)
  const [showSessionSettings, setShowSessionSettings] = useState(false)
  const [recommendations, setRecommendations] = useState<StudyRecommendation[]>([])
  const [insights, setInsights] = useState<LearningInsights | null>(null)
  const [currentStreak, setCurrentStreak] = useState(0)
  const [comebackInfo, setComebackInfo] = useState<{
    daysAway: number
    lastStudyDate: Date
  } | null>(null)
  const [limitError, setLimitError] = useState<{ currentCount: number; limit: number } | null>(null)
  const [isSyncingMedia, setIsSyncingMedia] = useState(false)
  const [r2Usage, setR2Usage] = useState<{ usedBytes: number; limitBytes: number } | null>(null)
  const [restoreProgressByDeckId, setRestoreProgressByDeckId] = useState<Record<string, RestoreProgress>>({})
  const [showSyncInfoModal, setShowSyncInfoModal] = useState(false)

  // Prevent race conditions
  const loadingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const initialSyncDone = useRef(false)

  // Use tier from server - no more race condition!
  const isPremium = initialData.isPremium
  const userTier = initialData.tier
  const limits = FlashcardManager.getDeckLimits(userTier)

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
    console.log('🔧 [FlashcardsContent] EventHub initialization check:', {
      hasUserId: !!initialData.userId,
      userId: initialData.userId
    })
    if (initialData.userId) {
      console.log('🔧 [FlashcardsContent] Calling initializeEventHub...')
      initializeEventHub(initialData.userId)
      console.log('🔧 [FlashcardsContent] initializeEventHub returned')
    }
  }, [initialData.userId])

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
          sessionsToUse
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

      setLoading(false)
    } catch (error) {
      setLoading(false)
    }
  }

  // Full data load for free users (from IndexedDB)
  const loadData = async (forceRefresh = false) => {

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
      setLoading(true)

      // Load flashcard decks - FlashcardManager handles both regular and Anki decks
      const userDecks = await flashcardManager.getDecks(effectiveUserId, isPremium)

      console.log('🎯 [FlashcardsContent.loadData] Setting decks state:', {
        deckCount: userDecks.length,
        decks: userDecks.map(d => ({ id: d.id, name: d.name, cardCount: d.cards?.length }))
      })
      setDecks(userDecks)
      console.log('✅ [FlashcardsContent.loadData] Decks state updated')

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

        console.log('📊 [FlashcardsContent.loadData] Loading insights and sessions for user:', effectiveUserId)

        const userInsights = await sessionManager.getLearningInsights(effectiveUserId, sessionsToUse)
        console.log('📈 [FlashcardsContent.loadData] Learning insights:', userInsights)
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
        console.log('💡 [FlashcardsContent.loadData] Study recommendations:', studyRecs.length, 'recommendations')
        setRecommendations(studyRecs)
        await saveCachedRecommendations(studyRecs)

        const streak = await sessionManager.calculateStreak(effectiveUserId, sessionsToUse)
        console.log('🔥 [FlashcardsContent.loadData] Current streak:', streak, 'days')
        setCurrentStreak(streak)

        // Load recent sessions from IndexedDB
        const recentSessions =
          sessionsToUse && sessionsToUse.length > 0
            ? sessionsToUse.slice(0, 25)
            : await sessionManager.getUserSessions(effectiveUserId, 25)
        console.log('📚 [FlashcardsContent.loadData] Recent sessions loaded:', {
          count: recentSessions.length,
          sessions: recentSessions.slice(0, 3).map(s => ({
            deckId: s.deckId,
            cardsStudied: s.cardsStudied,
            timestamp: new Date(s.timestamp).toISOString()
          }))
        })
        setSessions(recentSessions)
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('[FlashcardsContent.loadData] Failed to load data:', error)
        showToast(t('flashcards.errors.loadFailed'), 'error')
      }
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

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

    // Show info modal to user before starting sync
    setShowSyncInfoModal(true)

    setShowMigration(false)
    setIsSyncingMedia(true)
    setMigrationProgress({ status: 'preparing', total: 0, completed: 0, failed: 0, currentDeck: null })

    try {
      const backupsResponse = await fetch('/api/anki/r2/backups')
      if (!backupsResponse.ok) {
        throw new Error('Failed to fetch backups')
      }

      const backupsData = await backupsResponse.json()
      const backups: BackupInfo[] = backupsData.backups || []

      if (backups.length === 0) {
        showToast(t('flashcards.restore.noBackups') || 'No backups found.', 'info')
        return
      }

      const localDecks = await flashcardManager.getDecks(initialData.userId, isPremium)
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

      const orchestrator = new RestoreOrchestrator(initialData.userId, restoreQueue ?? undefined)
      const progress = {
        status: 'migrating',
        total: missingBackups.length,
        completed: 0,
        failed: 0,
        currentDeck: null as string | null,
        currentProgress: 0,
        errors: [] as string[],
      }

      setMigrationProgress(progress)

      for (const backup of missingBackups) {
        progress.currentDeck = backup.name
        progress.currentProgress = 0
        setMigrationProgress({ ...progress })

        try {
          const handleProgress = (payload: any) => {
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
          progress.failed += 1
          progress.errors.push(error?.message || `Failed to restore ${backup.name}`)
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

      if (progress.failed > 0) {
        showToast(t('flashcards.errors.syncFailed') || 'Some decks failed to restore.', 'error')
      } else {
        showToast(t('flashcards.success.allSynced'), 'success')
      }

      await loadData(true)

    } catch (error) {
      showToast(t('flashcards.errors.syncFailed'), 'error')
    } finally {
      setMigrationProgress(null)
      await loadR2Usage()
      setIsSyncingMedia(false)
    }
  }

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

    const orchestrator = new RestoreOrchestrator(initialData.userId, restoreQueue)
    const progress = {
      status: 'migrating',
      total: backups.length,
      completed: 0,
      failed: 0,
      currentDeck: null as string | null,
      currentProgress: 0,
      errors: [] as string[],
    }

    setShowMigration(false)
    setIsSyncingMedia(true)
    setMigrationProgress(progress)

    for (const backup of backups) {
      progress.currentDeck = backup.name
      progress.currentProgress = 0
      setMigrationProgress({ ...progress })

      try {
        const handleProgress = (payload: any) => {
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
        progress.failed += 1
        progress.errors.push(error?.message || `Failed to restore ${backup.name}`)
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

    setMigrationProgress(null)
    await loadR2Usage()
    setIsSyncingMedia(false)
  }, [initialData.userId, isPremium, restoreQueue, isSyncingMedia, showToast, t, loadR2Usage])

  useEffect(() => {
    resumePendingRestores()
  }, [resumePendingRestores])

  const handleExportAll = async () => {
    if (!initialData.userId) return

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

    if (limits.maxDecks !== -1 && decks.length >= limits.maxDecks) {
      showToast(t('flashcards.errors.limitReached'), 'error')
      return
    }

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

    try {
      const updatedDeck = await flashcardManager.updateDeck(
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
    setEditingDeck(deck)
    setShowCreator(true)
  }

  const handleDeleteDeck = (deck: FlashcardDeck) => {
    setDeckToDelete(deck)
    setShowDeleteDialog(true)
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
    const deletePromise = deckToDeleteCopy.source === 'anki'
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

  const handleStartSession = (selectedCards: any[], mode: string) => {
    if (!deckToStudy || selectedCards.length === 0) return

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

    try {
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

  const handleSessionComplete = async (summary: SessionSummary) => {
    console.log('🎴 [FlashcardsContent] Session completed:', {
      cardsStudied: summary.cardsStudied,
      accuracy: summary.accuracy,
      xpEarned: summary.xpEarned,
      userId: initialData.userId
    })

    // Capture deck name before clearing state
    const deckName = studyingDeck?.name || 'Flashcard Deck'

    setStudyingDeck(null)

    // Emit SESSION_COMPLETED event via Event Hub for gamification
    // This uses the same pattern as Kana, Kanji, Lists, etc.
    if (initialData.userId && summary.xpEarned && summary.xpEarned > 0) {
      console.log('✅ [FlashcardsContent] Gamification conditions met, emitting event...')
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
        console.log('📊 [FlashcardsContent] Setting lastSessionStats BEFORE event:', statsToSet)
        useGamificationStore.getState().setLastSessionStats(statsToSet)

        console.log('📤 [FlashcardsContent] Emitting SESSION_COMPLETED event:', eventPayload)

        // Emit event - gamificationListener will handle the API call
        // It will preserve the contentType and contentTitle we just set
        getEventHub().emit(ReviewEventType.SESSION_COMPLETED, eventPayload)

        // Celebration screen will show XP and stats - no need for toast
      } catch (error) {
        console.error('[FlashcardsContent] ❌ Error emitting gamification event:', error)
      }
    } else {
      console.log('⏭️ [FlashcardsContent] Skipping gamification:', {
        hasUserId: !!initialData.userId,
        hasXP: !!summary.xpEarned,
        xpAmount: summary.xpEarned
      })
    }

    loadData()
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
        deck={studyingDeck}
        cards={studyingDeck.cards}
        onComplete={handleSessionComplete}
        onExit={() => setStudyingDeck(null)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-DEFAULT dark:from-dark-850 dark:to-dark-900">
      {/* Desktop Navbar */}
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      {/* Page Header - Mobile */}
      <PageHeader
        title={t('flashcards.title') || 'Flashcards'}
        description="Practice your Flashcards"
        backHref="/dashboard"
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

        {/* Horizontally Scrollable Action Buttons */}
        <div className="mb-6 -mx-4 sm:mx-0">
          <div className="flex gap-3 overflow-x-auto px-4 sm:px-0 pb-2 scrollbar-hide snap-x snap-mandatory">
            {/* Insights Toggle Button */}
            {initialData.userId && decks.length > 0 && (
              <button
                onClick={handleToggleInsights}
                className={cn(
                  "flex-shrink-0 px-4 py-2.5 text-sm font-medium rounded-lg transition-all snap-start shadow-sm flex items-center gap-2",
                  showInsights
                    ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                    : "bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-dark-600"
                )}
              >
                <PieChart className="w-4 h-4" />
                {t('flashcards.insights')}
              </button>
            )}

            {/* Create New Deck Button */}
            <button
              onClick={() => setShowCreator(true)}
              className="flex-shrink-0 px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-primary-500 to-purple-500 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 snap-start shadow-md"
            >
              <Plus className="w-4 h-4" />
              {t('flashcards.createDeck')}
            </button>

            {isPremium && (decks.length > 0 || (r2Usage && r2Usage.usedBytes > 0)) && (
              <button
                onClick={handleBulkSync}
                disabled={isSyncingMedia}
                className="flex-shrink-0 px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:opacity-90 transition-opacity snap-start shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSyncingMedia && (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                )}
                {t('flashcards.actions.syncAll')}
              </button>
            )}

            {decks.length > 0 && (
              <button
                onClick={handleExportAll}
                className="flex-shrink-0 px-4 py-2.5 text-sm font-medium bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors snap-start shadow-sm"
              >
                {t('flashcards.actions.exportAll')}
              </button>
            )}
          </div>
        </div>

        {/* Deck Limits Warning */}
        {!initialData.userId && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-yellow-800 dark:text-yellow-200">{t('flashcards.limits.guest')}</p>
          </div>
        )}

        {initialData.userId && !isPremium && decks.length >= limits.maxDecks - 2 && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-blue-800 dark:text-blue-200">
              {t('flashcards.limits.freeLimit', {
                current: decks.length,
                max: limits.maxDecks,
              })}
            </p>
          </div>
        )}

        {/* Cloud Storage & Sync Progress - Side by side on desktop, stacked on mobile */}
        {isPremium && (migrationProgress || r2Usage) && (
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cloud Storage Widget */}
            {r2Usage && (
              <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-4">
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
            {migrationProgress && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-4"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500"></div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {t('flashcards.migration.inProgress')}
                    </h3>
                    {migrationProgress.total > 0 && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {migrationProgress.completed}/{migrationProgress.total} decks
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {migrationPercent}%
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">synced</div>
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
        <div className="mb-8">
          <DeckGrid
            decks={decks}
            onDeckClick={handleStudyDeck}
            onCreateDeck={() => setShowCreator(true)}
            onEditDeck={handleEditDeck}
            onDeleteDeck={handleDeleteDeck}
            onExportDeck={handleExportDeck}
            onStudyDeck={handleStudyDeck}
            onSessionSettings={deck => {
              setDeckToStudy(deck)
              setShowSessionSettings(true)
            }}
            showStats={true}
            gridCols={3}
            isPremium={isPremium}
            hideCreateCard={true}
            restoreProgressByDeckId={restoreProgressByDeckId}
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
                  <DailyGoals
                    userId={initialData.userId}
                    isPremium={isPremium}
                    onGoalComplete={goalType => {
                    }}
                  />
                </motion.div>
              )}

              {/* Study Recommendations (show only if user has decks and recommendations) */}
              {initialData.userId && recommendations.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mb-8"
                >
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

        {/* Study Mode Selector Modal */}
        {deckToStudy && showModeSelector && (
          <StudyModeSelector
            deck={deckToStudy}
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
          onClose={() => setShowSyncInfoModal(false)}
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
                onClick={() => setShowSyncInfoModal(false)}
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

        <MobileNavSpacer />
      </div>
    </div>
  )
}
