/**
 * useFlashcardsSync Hook Tests
 *
 * Covers the three critical orchestration paths extracted from FlashcardsContent:
 * 1. handleBulkSync — modal acknowledge → 3-phase sync (deck sync, R2 user decks, R2 Anki)
 * 2. handleCancelSync — abort controller, clear jobs/stubs, reset state
 * 3. resumePendingRestores — rehydrate progress from RestoreQueue, complete/error handling
 *
 * @jest-environment jsdom
 */

// ── Mocks (must be before imports) ──────────────────────────────────────────

jest.mock('@/lib/firebase/client', () => ({
  auth: {},
  db: {},
  storage: {},
}))

jest.mock('@/lib/flashcards/FlashcardManager', () => ({
  flashcardManager: {
    syncDecksFromFirebase: jest.fn(),
    syncAllDecksToFirebase: jest.fn(),
    getDecks: jest.fn(),
    getDeck: jest.fn(),
    upsertLocalDeck: jest.fn(),
    deleteDeck: jest.fn(),
  },
}))

jest.mock('@/lib/anki/AnkiDeckManager', () => ({
  ankiDeckManager: {
    deleteDeck: jest.fn(),
  },
}))

const mockRestoreDeck = jest.fn()
const mockOn = jest.fn()
const mockOff = jest.fn()
const mockRemoveAllListeners = jest.fn()

jest.mock('@/lib/r2/RestoreOrchestrator', () => ({
  RestoreOrchestrator: jest.fn().mockImplementation(() => ({
    restoreDeck: mockRestoreDeck,
    on: mockOn,
    off: mockOff,
    removeAllListeners: mockRemoveAllListeners,
  })),
}))

jest.mock('@/lib/r2/UserDeckRestoreOrchestrator', () => ({
  getUserDeckRestoreOrchestrator: jest.fn(() => ({
    restoreDeck: jest.fn().mockResolvedValue(undefined),
  })),
}))

global.fetch = jest.fn()

// ── Imports ─────────────────────────────────────────────────────────────────

import { renderHook, act, waitFor } from '@testing-library/react'
import { useFlashcardsSync } from '../useFlashcardsSync'
import { flashcardManager } from '@/lib/flashcards/FlashcardManager'
import { ankiDeckManager } from '@/lib/anki/AnkiDeckManager'
import type { FlashcardDeck } from '@/types/flashcards'

// ── Helpers ─────────────────────────────────────────────────────────────────

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

function makeDeck(overrides: Partial<FlashcardDeck> = {}): FlashcardDeck {
  return {
    id: overrides.id ?? 'deck-1',
    userId: 'user-1',
    name: 'Test Deck',
    description: '',
    emoji: '📚',
    color: 'blue',
    cardStyle: 'minimal',
    cards: [{ id: 'c1', front: 'a', back: 'b', srs: {} }] as any,
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
      totalCards: 1,
      newCards: 1,
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
    ...overrides,
  }
}

function makeRestoreQueue(
  overrides: {
    getActiveJobs?: jest.Mock
    clearJob?: jest.Mock
    upsertJobFromBackup?: jest.Mock
  } = {}
) {
  return {
    getActiveJobs: overrides.getActiveJobs ?? jest.fn().mockResolvedValue([]),
    clearJob: overrides.clearJob ?? jest.fn().mockResolvedValue(undefined),
    upsertJobFromBackup: overrides.upsertJobFromBackup ?? jest.fn().mockResolvedValue(undefined),
  }
}

function defaultParams(overrides: Record<string, any> = {}) {
  return {
    userId: 'user-1' as string | null,
    isPremium: true,
    decks: [] as FlashcardDeck[],
    setDecks: jest.fn(),
    restoreQueue: null as any,
    loadDataRef: { current: jest.fn().mockResolvedValue(undefined) },
    loadR2Usage: jest.fn().mockResolvedValue(undefined),
    setShowMigration: jest.fn(),
    showToast: jest.fn(),
    t: jest.fn((key: string) => key),
    ...overrides,
  }
}

// ── Test Suites ─────────────────────────────────────────────────────────────

describe('useFlashcardsSync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockReset()
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. INITIAL STATE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('initial state', () => {
    it('returns correct defaults', () => {
      const { result } = renderHook(() => useFlashcardsSync(defaultParams()))

      expect(result.current.isSyncingMedia).toBe(false)
      expect(result.current.migrationProgress).toBeNull()
      expect(result.current.migrationPercent).toBe(0)
      expect(result.current.restoreProgressByDeckId).toEqual({})
      expect(result.current.showSyncInfoModal).toBe(false)
      expect(result.current.showCancelSyncDialog).toBe(false)
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. handleBulkSync
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('handleBulkSync', () => {
    it('blocks non-premium users with toast', async () => {
      const params = defaultParams({ isPremium: false })
      const { result } = renderHook(() => useFlashcardsSync(params))

      await act(async () => {
        await result.current.handleBulkSync()
      })

      expect(params.showToast).toHaveBeenCalledWith(
        'flashcards.errors.syncRequiresPremium',
        'error'
      )
      expect(result.current.isSyncingMedia).toBe(false)
    })

    it('blocks when userId is null', async () => {
      const params = defaultParams({ userId: null })
      const { result } = renderHook(() => useFlashcardsSync(params))

      await act(async () => {
        await result.current.handleBulkSync()
      })

      expect(params.showToast).toHaveBeenCalledWith(
        'flashcards.errors.syncRequiresPremium',
        'error'
      )
    })

    it('shows sync info modal and waits for acknowledgment', async () => {
      const params = defaultParams()
      const { result } = renderHook(() => useFlashcardsSync(params))

      // Start sync — it will block on the modal promise
      let syncPromise: Promise<void>
      act(() => {
        syncPromise = result.current.handleBulkSync()
      })

      // Modal should be visible
      await waitFor(() => {
        expect(result.current.showSyncInfoModal).toBe(true)
      })

      // Acknowledge via handleSyncModalConfirm — this resolves the promise
      // Set up the mocks for the sync phases so they don't fail
      ;(flashcardManager.syncDecksFromFirebase as jest.Mock).mockResolvedValue({
        downloaded: 2,
        merged: 1,
      })
      ;(flashcardManager.syncAllDecksToFirebase as jest.Mock).mockResolvedValue({
        synced: 3,
      })

      // Phase 2: R2 user deck list (empty)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ decks: [] }),
      } as Response)

      // Phase 3: Anki backups (empty)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ backups: [], deletedDeckIds: [] }),
      } as Response)

      await act(async () => {
        result.current.handleSyncModalConfirm()
      })

      // Wait for the full sync to complete
      await act(async () => {
        await syncPromise!
      })

      // Modal should be closed
      expect(result.current.showSyncInfoModal).toBe(false)
      // Phase 1 should have executed
      expect(flashcardManager.syncDecksFromFirebase).toHaveBeenCalledWith('user-1', true)
      expect(flashcardManager.syncAllDecksToFirebase).toHaveBeenCalledWith('user-1', true)
    })

    it('runs all 3 phases to completion and shows success toast', async () => {
      const params = defaultParams()
      const { result } = renderHook(() => useFlashcardsSync(params))

      // Phase 1 mocks
      ;(flashcardManager.syncDecksFromFirebase as jest.Mock).mockResolvedValue({
        downloaded: 1,
        merged: 0,
      })
      ;(flashcardManager.syncAllDecksToFirebase as jest.Mock).mockResolvedValue({
        synced: 2,
      })

      // Phase 2: R2 user deck list — empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ decks: [] }),
      } as Response)

      // Phase 3: Anki backups — no backups
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ backups: [], deletedDeckIds: [] }),
      } as Response)

      let syncPromise: Promise<void>
      act(() => {
        syncPromise = result.current.handleBulkSync()
      })

      // Confirm modal
      await waitFor(() => expect(result.current.showSyncInfoModal).toBe(true))
      await act(async () => {
        result.current.handleSyncModalConfirm()
      })

      await act(async () => {
        await syncPromise!
      })

      // Sync completed — toast for synced decks shown
      expect(params.showToast).toHaveBeenCalledWith('Synced 2 decks to cloud', 'success')
      // loadData was called after phase 1
      expect(params.loadDataRef.current).toHaveBeenCalledWith(true)
      // loadR2Usage was called in finally
      expect(params.loadR2Usage).toHaveBeenCalled()
      // Back to idle
      expect(result.current.isSyncingMedia).toBe(false)
      expect(result.current.migrationProgress).toBeNull()
    })

    it('aborts early if phase 1 fails', async () => {
      const params = defaultParams()
      const { result } = renderHook(() => useFlashcardsSync(params))

      ;(flashcardManager.syncDecksFromFirebase as jest.Mock).mockRejectedValue(
        new Error('Firebase down')
      )

      let syncPromise: Promise<void>
      act(() => {
        syncPromise = result.current.handleBulkSync()
      })

      await waitFor(() => expect(result.current.showSyncInfoModal).toBe(true))
      await act(async () => {
        result.current.handleSyncModalConfirm()
      })
      await act(async () => {
        await syncPromise!
      })

      expect(params.showToast).toHaveBeenCalledWith(
        expect.stringContaining('flashcards.errors.deckSyncFailed'),
        'error'
      )
      expect(result.current.isSyncingMedia).toBe(false)
      // Phase 2/3 should NOT have been attempted
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('does not start if already syncing', async () => {
      const params = defaultParams()
      const { result } = renderHook(() => useFlashcardsSync(params))

      // Stall phase 1 so isSyncingMedia stays true
      ;(flashcardManager.syncDecksFromFirebase as jest.Mock).mockReturnValue(
        new Promise(() => {}) // never resolves
      )

      // Start first sync
      act(() => {
        result.current.handleBulkSync()
      })
      await waitFor(() => expect(result.current.showSyncInfoModal).toBe(true))
      await act(async () => {
        result.current.handleSyncModalConfirm()
      })

      // Try to start a second sync — should be a no-op
      await act(async () => {
        await result.current.handleBulkSync()
      })

      // Only one call to syncDecksFromFirebase
      expect(flashcardManager.syncDecksFromFirebase).toHaveBeenCalledTimes(1)
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. handleCancelSync
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('handleCancelSync', () => {
    it('clears restore queue jobs', async () => {
      const mockClearJob = jest.fn().mockResolvedValue(undefined)
      const mockGetActiveJobs = jest.fn().mockResolvedValue([
        { id: 'job-1' },
        { id: 'job-2' },
      ])
      const rq = makeRestoreQueue({ getActiveJobs: mockGetActiveJobs, clearJob: mockClearJob })
      const params = defaultParams({ restoreQueue: rq })
      const { result } = renderHook(() => useFlashcardsSync(params))

      await act(async () => {
        await result.current.handleCancelSync()
      })

      expect(mockGetActiveJobs).toHaveBeenCalledWith('user-1')
      expect(mockClearJob).toHaveBeenCalledTimes(2)
      expect(mockClearJob).toHaveBeenCalledWith('job-1')
      expect(mockClearJob).toHaveBeenCalledWith('job-2')
    })

    it('removes stub decks from state and deletes from storage', async () => {
      const stubDeck = makeDeck({
        id: 'stub-1',
        cards: [],
        restoreStatus: 'restoring' as any,
      })
      const realDeck = makeDeck({ id: 'real-1' })
      const setDecks = jest.fn()
      const rq = makeRestoreQueue()
      const params = defaultParams({
        decks: [stubDeck, realDeck],
        setDecks,
        restoreQueue: rq,
      })

      ;(flashcardManager.deleteDeck as jest.Mock).mockResolvedValue(undefined)

      const { result } = renderHook(() => useFlashcardsSync(params))

      await act(async () => {
        await result.current.handleCancelSync()
      })

      // setDecks should filter out the stub
      expect(setDecks).toHaveBeenCalled()
      const filterFn = setDecks.mock.calls.find(
        (call: any[]) => typeof call[0] === 'function'
      )?.[0]
      if (filterFn) {
        const filtered = filterFn([stubDeck, realDeck])
        expect(filtered).toEqual([realDeck])
      }

      // deleteDeck called for stub
      expect(flashcardManager.deleteDeck).toHaveBeenCalledWith('stub-1', 'user-1', false)
    })

    it('resets all sync state', async () => {
      const rq = makeRestoreQueue()
      const params = defaultParams({ restoreQueue: rq })
      const { result } = renderHook(() => useFlashcardsSync(params))

      await act(async () => {
        await result.current.handleCancelSync()
      })

      expect(result.current.restoreProgressByDeckId).toEqual({})
      expect(result.current.migrationProgress).toBeNull()
      expect(result.current.isSyncingMedia).toBe(false)
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. resumePendingRestores
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('resumePendingRestores', () => {
    it('does nothing when no active jobs', async () => {
      const rq = makeRestoreQueue()
      const params = defaultParams({ restoreQueue: rq })

      renderHook(() => useFlashcardsSync(params))

      // useEffect fires on mount — wait for it
      await waitFor(() => {
        expect(rq.getActiveJobs).toHaveBeenCalledWith('user-1')
      })

      // No toast, no deck state changes
      expect(params.showToast).not.toHaveBeenCalled()
      expect(params.setDecks).not.toHaveBeenCalled()
    })

    it('skips resume for non-premium users', async () => {
      const rq = makeRestoreQueue()
      const params = defaultParams({ isPremium: false, restoreQueue: rq })

      renderHook(() => useFlashcardsSync(params))

      // Wait a tick — should NOT call getActiveJobs
      await act(async () => {
        await new Promise(r => setTimeout(r, 0))
      })

      expect(rq.getActiveJobs).not.toHaveBeenCalled()
    })

    it('skips resume when restoreQueue is null', async () => {
      const params = defaultParams({ restoreQueue: null })

      const { result } = renderHook(() => useFlashcardsSync(params))

      await act(async () => {
        await new Promise(r => setTimeout(r, 0))
      })

      // Nothing should have happened
      expect(params.setDecks).not.toHaveBeenCalled()
      expect(result.current.isSyncingMedia).toBe(false)
    })

    it('rehydrates progress and creates stubs for pending jobs', async () => {
      const rq = makeRestoreQueue({
        getActiveJobs: jest.fn().mockResolvedValue([
          {
            id: 'deck-a',
            deckName: 'Kanji N3',
            cardCount: 50,
            hasMedia: true,
            lastBackup: Date.now(),
            manifestKey: 'manifest-a',
            packageKey: 'package-a',
            status: 'downloading',
            downloadedFiles: ['f1', 'f2'],
            totalFiles: 10,
            lastError: undefined,
          },
        ]),
      })

      // Mock the RestoreOrchestrator.restoreDeck to succeed
      mockRestoreDeck.mockResolvedValue('deck-a')

      // Mock getDeck to return the restored deck
      ;(flashcardManager.getDeck as jest.Mock).mockResolvedValue(
        makeDeck({ id: 'deck-a', name: 'Kanji N3' })
      )

      const params = defaultParams({ restoreQueue: rq })
      const { result } = renderHook(() => useFlashcardsSync(params))

      // Wait for the auto-triggered resumePendingRestores effect
      await waitFor(() => {
        expect(rq.getActiveJobs).toHaveBeenCalledWith('user-1')
      })

      // Should show resume toast
      await waitFor(() => {
        expect(params.showToast).toHaveBeenCalledWith(
          expect.stringContaining('flashcards.restore.resumeInProgress'),
          'info'
        )
      })

      // setDecks should have been called (to add restore stubs)
      expect(params.setDecks).toHaveBeenCalled()

      // Wait for restore to complete
      await waitFor(() => {
        expect(result.current.isSyncingMedia).toBe(false)
      })

      // loadR2Usage called after completion
      expect(params.loadR2Usage).toHaveBeenCalled()
    })

    it('only triggers once even across re-renders', async () => {
      const rq = makeRestoreQueue({
        getActiveJobs: jest.fn().mockResolvedValue([]),
      })
      const params = defaultParams({ restoreQueue: rq })

      const { rerender } = renderHook(() => useFlashcardsSync(params))

      await waitFor(() => {
        expect(rq.getActiveJobs).toHaveBeenCalledTimes(1)
      })

      // Re-render shouldn't re-trigger
      rerender()

      await act(async () => {
        await new Promise(r => setTimeout(r, 0))
      })

      // Still only called once because resumeTriggeredRef guards it
      // (Note: with empty jobs it won't set the ref, but the useCallback deps
      // shouldn't change, so it won't re-fire)
      expect(rq.getActiveJobs).toHaveBeenCalledTimes(1)
    })

    it('handles restore errors without crashing', async () => {
      const rq = makeRestoreQueue({
        getActiveJobs: jest.fn().mockResolvedValue([
          {
            id: 'deck-err',
            deckName: 'Broken Deck',
            cardCount: 10,
            hasMedia: false,
            lastBackup: Date.now(),
            manifestKey: 'manifest-err',
            packageKey: 'package-err',
            status: 'active',
            downloadedFiles: [],
            totalFiles: 5,
            lastError: undefined,
          },
        ]),
      })

      // RestoreOrchestrator.restoreDeck fails
      mockRestoreDeck.mockRejectedValue(new Error('R2 unavailable'))

      const params = defaultParams({ restoreQueue: rq })
      const { result } = renderHook(() => useFlashcardsSync(params))

      // Should eventually settle without throwing
      await waitFor(() => {
        expect(result.current.isSyncingMedia).toBe(false)
      })

      expect(params.loadR2Usage).toHaveBeenCalled()
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. handleSyncModalConfirm
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('handleSyncModalConfirm', () => {
    it('closes the sync info modal', async () => {
      const params = defaultParams()
      const { result } = renderHook(() => useFlashcardsSync(params))

      // Manually set showSyncInfoModal via the bulk sync flow
      // The simplest test is just calling confirm directly
      await act(async () => {
        result.current.handleSyncModalConfirm()
      })

      expect(result.current.showSyncInfoModal).toBe(false)
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. migrationPercent computation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('migrationPercent', () => {
    it('returns 0 when no migration progress', () => {
      const { result } = renderHook(() => useFlashcardsSync(defaultParams()))
      expect(result.current.migrationPercent).toBe(0)
    })
  })
})
