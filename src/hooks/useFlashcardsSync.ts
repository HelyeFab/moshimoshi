'use client'

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type Dispatch,
  type SetStateAction,
  type MutableRefObject,
} from 'react'
import { flashcardManager } from '@/lib/flashcards/FlashcardManager'
import { ankiDeckManager } from '@/lib/anki/AnkiDeckManager'
import { RestoreOrchestrator } from '@/lib/r2/RestoreOrchestrator'
import type { RestoreQueue } from '@/lib/r2/RestoreQueue'
import type { BackupInfo, RestoreProgress } from '@/types/r2'
import type { FlashcardDeck } from '@/types/flashcards'

export interface MigrationProgress {
  status: 'syncing-decks' | 'preparing' | 'migrating' | 'complete'
  phase?: 'download' | 'upload' | 'r2'
  total: number
  completed: number
  failed: number
  currentDeck: string | null
  currentProgress?: number
  errors?: string[]
}

interface UseFlashcardsSyncParams {
  userId: string | null
  isPremium: boolean
  decks: FlashcardDeck[]
  setDecks: Dispatch<SetStateAction<FlashcardDeck[]>>
  restoreQueue: RestoreQueue | null
  loadDataRef: MutableRefObject<((force?: boolean, show?: boolean) => Promise<void>) | undefined>
  loadR2Usage: () => Promise<void>
  setShowMigration: Dispatch<SetStateAction<boolean>>
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
  t: (key: string, params?: Record<string, any>) => string
}

export function useFlashcardsSync({
  userId,
  isPremium,
  decks,
  setDecks,
  restoreQueue,
  loadDataRef,
  loadR2Usage,
  setShowMigration,
  showToast,
  t,
}: UseFlashcardsSyncParams) {
  const [isSyncingMedia, setIsSyncingMedia] = useState(false)
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null)
  const [restoreProgressByDeckId, setRestoreProgressByDeckId] = useState<Record<string, RestoreProgress>>({})
  const [showSyncInfoModal, setShowSyncInfoModal] = useState(false)
  const [showCancelSyncDialog, setShowCancelSyncDialog] = useState(false)

  const syncModalResolverRef = useRef<((value: boolean) => void) | null>(null)
  const cancelSyncRef = useRef(false)
  const restoreAbortControllerRef = useRef<AbortController | null>(null)
  const resumeTriggeredRef = useRef(false)

  const handleSyncModalConfirm = useCallback(() => {
    setShowSyncInfoModal(false)
    if (syncModalResolverRef.current) {
      syncModalResolverRef.current(true)
      syncModalResolverRef.current = null
    }
  }, [])

  const handleBulkSync = async () => {
    if (!userId || !isPremium) {
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
        userId,
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
        userId,
        isPremium
      )

      console.log('✅ [FlashcardsContent] Upload complete:', uploadResult)

      showToast(
        `Synced ${uploadResult.synced} deck${uploadResult.synced !== 1 ? 's' : ''} to cloud`,
        'success'
      )

      // Refresh local deck list
      await loadDataRef.current?.(true)
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
          const orchestrator = getUserDeckRestoreOrchestrator(userId, abortController.signal)

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
        userId: userId!,
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
          missingBackups.map(backup => restoreQueue.upsertJobFromBackup(backup, userId!))
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
        userId,
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

          const restoredDeck = await flashcardManager.getDeck(backup.deckId, userId)
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

      await loadDataRef.current?.(true)

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

    if (restoreQueue && userId) {
      const jobs = await restoreQueue.getActiveJobs(userId)
      await Promise.all(jobs.map(job => restoreQueue.clearJob(job.id)))
    }

    if (userId) {
      const stubDecks = decks.filter(deck =>
        deck.restoreStatus && (!deck.cards || deck.cards.length === 0)
      )
      if (stubDecks.length > 0) {
        setDecks(prev => prev.filter(deck => !stubDecks.some(stub => stub.id === deck.id)))
        await Promise.all(
          stubDecks.map(deck => flashcardManager.deleteDeck(deck.id, userId!, false))
        )
      }
    }

    setRestoreProgressByDeckId({})
    setMigrationProgress(null)
    setIsSyncingMedia(false)
  }, [decks, userId, restoreQueue])

  const resumePendingRestores = useCallback(async () => {
    if (!userId || !isPremium || !restoreQueue) return
    if (resumeTriggeredRef.current || isSyncingMedia) return

    const jobs = await restoreQueue.getActiveJobs(userId)
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
      userId: userId!,
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
    const orchestrator = new RestoreOrchestrator(userId, restoreQueue, abortController.signal)
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

        const restoredDeck = await flashcardManager.getDeck(backup.deckId, userId)
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
  }, [userId, isPremium, restoreQueue, isSyncingMedia, showToast, t, loadR2Usage])

  useEffect(() => {
    resumePendingRestores()
  }, [resumePendingRestores])

  const migrationPercent = migrationProgress && migrationProgress.total > 0
    ? Math.round(
        ((migrationProgress.completed + (migrationProgress.currentProgress || 0) / 100) / migrationProgress.total) * 100
      )
    : 0

  return {
    isSyncingMedia,
    migrationProgress,
    migrationPercent,
    restoreProgressByDeckId,
    showSyncInfoModal,
    showCancelSyncDialog,
    setShowCancelSyncDialog,
    handleBulkSync,
    handleCancelSync,
    handleSyncModalConfirm,
  }
}
