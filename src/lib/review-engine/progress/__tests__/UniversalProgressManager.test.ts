/**
 * Comprehensive Test Suite for UniversalProgressManager
 * Verifies that server-side API changes haven't broken functionality
 */

import { UniversalProgressManager } from '../UniversalProgressManager'
import {
  ProgressEvent,
  ProgressStatus,
  ReviewProgressData
} from '../../core/progress.types'
import { reviewLogger } from '@/lib/monitoring/logger'

// Mock fetch for API calls
global.fetch = jest.fn()

// Mock modules before imports
jest.mock('idb', () => ({
  openDB: jest.fn(),
  deleteDB: jest.fn(),
}))

jest.mock('@/lib/monitoring/logger', () => ({
  reviewLogger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}))

// Test implementation of UniversalProgressManager
class TestProgressManager extends UniversalProgressManager<ReviewProgressData> {
  // Expose protected methods for testing
  public async testInitDB() {
    return this.initDB()
  }

  public testCreateInitialProgress(contentId: string, contentType: string) {
    return this.createInitialProgress(contentId, contentType)
  }

  public testUpdateProgressForEvent(
    progress: ReviewProgressData,
    event: ProgressEvent,
    metadata?: any
  ) {
    return this.updateProgressForEvent(progress, event, metadata)
  }

  public testQueueFirebaseSync(
    userId: string,
    contentType: string,
    contentId: string,
    progress: ReviewProgressData
  ) {
    return this.queueFirebaseSync(userId, contentType, contentId, progress)
  }

  public getPendingUpdates() {
    return this.pendingUpdates
  }

  public async testProcessPendingUpdates() {
    return this.processPendingUpdates()
  }

  public testGetDeviceType() {
    return this.getDeviceType()
  }

  public getReviewHistoryQueue() {
    return this.reviewHistoryQueue
  }

  public testCleanForStorage(obj: any) {
    return this.cleanForStorage(obj)
  }

  public setDB(db: any) {
    this.db = db
  }
}

describe('UniversalProgressManager - Server-side API Integration', () => {
  let manager: TestProgressManager
  let mockDB: any
  let mockIDB: any

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
    manager = new TestProgressManager()

    // Get the mocked idb module
    mockIDB = require('idb')

    // Setup mock IndexedDB
    mockDB = {
      transaction: jest.fn(),
      add: jest.fn(),
      put: jest.fn(),
      get: jest.fn(),
      getFromIndex: jest.fn(),
      delete: jest.fn(),
      objectStoreNames: {
        contains: jest.fn(() => true)
      }
    }

    mockIDB.openDB.mockResolvedValue(mockDB)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('1. Core Progress Tracking', () => {
    const mockUser = { uid: 'test-user-123' }
    const contentType = 'hiragana'
    const contentId = 'あ'

    it('should not track progress for guest users', async () => {
      await manager.trackProgress(
        contentType,
        contentId,
        ProgressEvent.VIEWED,
        null,
        false
      )

      expect(reviewLogger.debug).toHaveBeenCalledWith(
        '[UniversalProgressManager] Guest user - no storage'
      )
      expect(mockDB.add).not.toHaveBeenCalled()
    })

    it('should handle user objects with alternative id fields', async () => {
      const userWithDifferentId = { userId: 'test-123', email: 'test@example.com' }

      manager.setDB(mockDB)
      mockDB.getFromIndex.mockResolvedValue(null)
      mockDB.add.mockResolvedValue(true)

      await manager.trackProgress(
        contentType,
        contentId,
        ProgressEvent.VIEWED,
        userWithDifferentId as any,
        false
      )

      expect(reviewLogger.info).toHaveBeenCalled()
    })

    it('should create initial progress with correct defaults', () => {
      const progress = manager.testCreateInitialProgress(contentId, contentType)

      expect(progress).toMatchObject({
        contentId,
        contentType,
        status: 'not-started',
        viewCount: 0,
        interactionCount: 0,
        correctCount: 0,
        incorrectCount: 0,
        accuracy: 0,
        streak: 0,
        bestStreak: 0,
        pinned: false,
        bookmarked: false,
        flaggedForReview: false
      })
      expect(progress.createdAt).toBeInstanceOf(Date)
      expect(progress.updatedAt).toBeInstanceOf(Date)
    })

    describe('Event Processing', () => {
      it('should update progress for VIEWED event', () => {
        const initial = manager.testCreateInitialProgress(contentId, contentType)
        const updated = manager.testUpdateProgressForEvent(initial, ProgressEvent.VIEWED)

        expect(updated.viewCount).toBe(1)
        expect(updated.status).toBe('viewing')
        expect(updated.firstViewedAt).toBeInstanceOf(Date)
        expect(updated.lastViewedAt).toBeInstanceOf(Date)
      })

      it('should update progress for INTERACTED event', () => {
        const initial = manager.testCreateInitialProgress(contentId, contentType)
        const updated = manager.testUpdateProgressForEvent(initial, ProgressEvent.INTERACTED)

        expect(updated.interactionCount).toBe(1)
        expect(updated.status).toBe('learning')
        expect(updated.lastInteractedAt).toBeInstanceOf(Date)
      })

      it('should update progress for COMPLETED event (correct)', () => {
        const initial = manager.testCreateInitialProgress(contentId, contentType)
        const updated = manager.testUpdateProgressForEvent(
          initial,
          ProgressEvent.COMPLETED,
          { correct: true }
        )

        expect(updated.correctCount).toBe(1)
        expect(updated.streak).toBe(1)
        expect(updated.bestStreak).toBe(1)
        expect(updated.accuracy).toBe(100)
      })

      it('should reset streak on incorrect answer', () => {
        const initial = manager.testCreateInitialProgress(contentId, contentType)
        initial.streak = 5
        initial.bestStreak = 5
        initial.correctCount = 5

        const updated = manager.testUpdateProgressForEvent(
          initial,
          ProgressEvent.COMPLETED,
          { correct: false }
        )

        expect(updated.incorrectCount).toBe(1)
        expect(updated.streak).toBe(0)
        expect(updated.bestStreak).toBe(5) // Best streak maintained
        expect(updated.accuracy).toBeCloseTo(83.33, 1)
      })

      it('should handle SKIPPED event', () => {
        const initial = manager.testCreateInitialProgress(contentId, contentType)
        const updated = manager.testUpdateProgressForEvent(
          initial,
          ProgressEvent.SKIPPED
        )

        // Skipped doesn't change most fields
        expect(updated.viewCount).toBe(0)
        expect(updated.correctCount).toBe(0)
        expect(updated.updatedAt).toBeInstanceOf(Date)
      })
    })

    describe('Accuracy Calculations', () => {
      it('should calculate accuracy correctly with multiple attempts', () => {
        let progress = manager.testCreateInitialProgress(contentId, contentType)

        // Add 3 correct and 2 incorrect
        for (let i = 0; i < 3; i++) {
          progress = manager.testUpdateProgressForEvent(
            progress,
            ProgressEvent.COMPLETED,
            { correct: true }
          )
        }
        for (let i = 0; i < 2; i++) {
          progress = manager.testUpdateProgressForEvent(
            progress,
            ProgressEvent.COMPLETED,
            { correct: false }
          )
        }

        expect(progress.correctCount).toBe(3)
        expect(progress.incorrectCount).toBe(2)
        expect(progress.accuracy).toBe(60) // 3/5 * 100
      })

      it('should handle zero division in accuracy', () => {
        const progress = manager.testCreateInitialProgress(contentId, contentType)
        expect(progress.accuracy).toBe(0)
      })
    })
  })

  describe('2. Server API Integration', () => {
    const mockUser = { uid: 'test-user-123' }
    const contentType = 'hiragana'

    beforeEach(() => {
      jest.useFakeTimers()
    })

    describe('Firebase Sync Queue', () => {
      it('should queue updates for premium users', () => {
        const progress = manager.testCreateInitialProgress('あ', contentType)

        manager.testQueueFirebaseSync(mockUser.uid, contentType, 'あ', progress)

        const pendingUpdates = manager.getPendingUpdates()
        expect(pendingUpdates.has(`${contentType}:${mockUser.uid}`)).toBe(true)
        expect(pendingUpdates.get(`${contentType}:${mockUser.uid}`)?.has('あ')).toBe(true)
      })

      it('should batch multiple updates for the same content type', () => {
        const progress1 = manager.testCreateInitialProgress('あ', contentType)
        const progress2 = manager.testCreateInitialProgress('か', contentType)

        manager.testQueueFirebaseSync(mockUser.uid, contentType, 'あ', progress1)
        manager.testQueueFirebaseSync(mockUser.uid, contentType, 'か', progress2)

        const pendingUpdates = manager.getPendingUpdates()
        const items = pendingUpdates.get(`${contentType}:${mockUser.uid}`)
        expect(items?.size).toBe(2)
      })

      it('should debounce API calls', () => {
        const progress = manager.testCreateInitialProgress('あ', contentType)

        manager.testQueueFirebaseSync(mockUser.uid, contentType, 'あ', progress)

        // Should not call API immediately
        expect(fetch).not.toHaveBeenCalled()

        // Fast-forward past debounce delay
        jest.advanceTimersByTime(500)

        // Now it should have been called
        expect(fetch).toHaveBeenCalled()
      })
    })

    describe('API Calls', () => {
      it('should call /api/progress/track for saving', async () => {
        (fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            success: true,
            itemsCount: 2,
            isPremium: true
          })
        })

        const progress1 = manager.testCreateInitialProgress('あ', contentType)
        const progress2 = manager.testCreateInitialProgress('か', contentType)

        manager.testQueueFirebaseSync(mockUser.uid, contentType, 'あ', progress1)
        manager.testQueueFirebaseSync(mockUser.uid, contentType, 'か', progress2)

        jest.advanceTimersByTime(500)
        await manager.testProcessPendingUpdates()

        expect(fetch).toHaveBeenCalledWith(
          '/api/progress/track',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.any(String)
          })
        )

        const callArgs = (fetch as jest.Mock).mock.calls[0]
        const body = JSON.parse(callArgs[1].body)
        expect(body.contentType).toBe(contentType)
        expect(body.items).toHaveLength(2)
      })

      it('should include review history in API call for premium users', async () => {
        (fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({ success: true })
        })

        manager.setDB(mockDB)
        mockDB.getFromIndex.mockResolvedValue(null)
        mockDB.add.mockResolvedValue(true)

        // Track with premium flag to create review history
        await manager.trackProgress(
          contentType,
          'あ',
          ProgressEvent.COMPLETED,
          mockUser,
          true,
          { correct: true }
        )

        jest.advanceTimersByTime(500)
        await manager.testProcessPendingUpdates()

        const callArgs = (fetch as jest.Mock).mock.calls[0]
        const body = JSON.parse(callArgs[1].body)

        // Should include review history
        expect(body.reviewHistory).toBeDefined()
        if (body.reviewHistory) {
          expect(body.reviewHistory.length).toBeGreaterThan(0)
        }
      })

      it('should handle API errors and add to sync queue', async () => {
        (fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

        manager.setDB(mockDB)
        mockDB.add.mockResolvedValue(true)

        const progress = manager.testCreateInitialProgress('あ', contentType)
        manager.testQueueFirebaseSync(mockUser.uid, contentType, 'あ', progress)

        jest.advanceTimersByTime(500)
        await manager.testProcessPendingUpdates()

        expect(reviewLogger.error).toHaveBeenCalledWith(
          '[UniversalProgressManager] Failed to sync to Firebase via API:',
          expect.any(Error)
        )

        // Should add to sync queue for retry
        expect(mockDB.add).toHaveBeenCalledWith(
          'syncQueue',
          expect.objectContaining({
            type: 'progress',
            userId: mockUser.uid,
            contentType,
            status: 'pending'
          })
        )
      })

      it('should load progress from API for premium users', async () => {
        mockDB.transaction.mockReturnValue({
          store: {
            index: jest.fn().mockReturnValue({
              openCursor: jest.fn().mockResolvedValue(null)
            })
          }
        });

        (fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            items: {
              'あ': { contentId: 'あ', viewCount: 5, accuracy: 80 },
              'か': { contentId: 'か', viewCount: 3, accuracy: 60 }
            },
            contentType,
            lastUpdated: new Date().toISOString()
          })
        })

        const result = await manager.getProgress(mockUser.uid, contentType, true)

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/progress/track'),
          expect.objectContaining({
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          })
        )

        expect(result.size).toBe(2)
        expect(result.get('あ')?.viewCount).toBe(5)
        expect(result.get('か')?.viewCount).toBe(3)
      })

      it('should handle API 401 responses gracefully', async () => {
        (fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 401,
          statusText: 'Unauthorized'
        })

        const progress = manager.testCreateInitialProgress('あ', contentType)
        manager.testQueueFirebaseSync(mockUser.uid, contentType, 'あ', progress)

        jest.advanceTimersByTime(500)
        await manager.testProcessPendingUpdates()

        expect(reviewLogger.error).toHaveBeenCalledWith(
          '[UniversalProgressManager] Failed to sync to Firebase via API:',
          expect.any(Error)
        )
      })
    })
  })

  describe('3. IndexedDB Storage', () => {
    const mockUser = { uid: 'test-user-123' }
    const contentType = 'hiragana'
    const contentId = 'あ'

    beforeEach(() => {
      manager.setDB(mockDB)
    })

    it('should save new items to IndexedDB', async () => {
      const progress = manager.testCreateInitialProgress(contentId, contentType)

      mockDB.getFromIndex.mockResolvedValue(null)
      mockDB.add.mockResolvedValue(true)

      await manager['saveToIndexedDB'](mockUser.uid, contentType, contentId, progress)

      expect(mockDB.getFromIndex).toHaveBeenCalledWith(
        'progress',
        'by-composite-key',
        `${mockUser.uid}:${contentType}:${contentId}`
      )

      expect(mockDB.add).toHaveBeenCalledWith(
        'progress',
        expect.objectContaining({
          userId: mockUser.uid,
          contentType,
          contentId,
          compositeKey: `${mockUser.uid}:${contentType}:${contentId}`,
          data: expect.any(Object)
        })
      )
    })

    it('should update existing items in IndexedDB', async () => {
      const existingEntry = {
        id: 1,
        userId: mockUser.uid,
        contentType,
        contentId,
        data: manager.testCreateInitialProgress(contentId, contentType)
      }

      mockDB.getFromIndex.mockResolvedValue(existingEntry)
      mockDB.put.mockResolvedValue(true)

      const updatedProgress = { ...existingEntry.data, viewCount: 5 }

      await manager['saveToIndexedDB'](mockUser.uid, contentType, contentId, updatedProgress)

      expect(mockDB.put).toHaveBeenCalledWith(
        'progress',
        expect.objectContaining({
          id: 1,
          data: expect.objectContaining({ viewCount: 5 })
        })
      )
    })

    it('should clean undefined values before storage', () => {
      const obj = {
        a: 1,
        b: undefined,
        c: 'test',
        d: null,
        e: { f: undefined, g: 2 },
        arr: [1, undefined, 3]
      }

      const cleaned = manager.testCleanForStorage(obj)

      expect(cleaned).toEqual({
        a: 1,
        c: 'test',
        d: null,
        e: { g: 2 },
        arr: [1, undefined, 3] // Arrays keep undefined
      })
      expect(cleaned.b).toBeUndefined()
      expect(cleaned.e.f).toBeUndefined()
    })

    it('should handle IndexedDB errors gracefully', async () => {
      mockDB.getFromIndex.mockRejectedValue(new Error('IndexedDB error'))

      const progress = manager.testCreateInitialProgress(contentId, contentType)

      await manager['saveToIndexedDB'](mockUser.uid, contentType, contentId, progress)

      expect(reviewLogger.error).toHaveBeenCalledWith(
        '[UniversalProgressManager] Failed to save to IndexedDB:',
        expect.any(Error)
      )
    })
  })

  describe('4. Session Management', () => {
    const mockUser = { uid: 'test-user-123' }
    const contentType = 'hiragana'

    beforeEach(() => {
      manager.setDB(mockDB)
      mockDB.add.mockResolvedValue(true)
      mockDB.getFromIndex.mockResolvedValue(null)
    })

    it('should start a new session with unique ID', async () => {
      const sessionId = await manager.startSession(mockUser.uid, contentType, undefined, mockUser)

      expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/)
    })

    it('should track events within a session', async () => {
      await manager.startSession(mockUser.uid, contentType, undefined, mockUser)

      await manager.trackProgress(contentType, 'あ', ProgressEvent.VIEWED, mockUser, false)
      await manager.trackProgress(contentType, 'か', ProgressEvent.COMPLETED, mockUser, false)

      const summary = await manager.endSession(false)

      expect(summary?.itemsViewed).toContain('あ')
      expect(summary?.itemsCompleted).toContain('か')
    })

    it('should calculate session duration correctly', async () => {
      await manager.startSession(mockUser.uid, contentType, undefined, mockUser)

      // Simulate some time passing
      await new Promise(resolve => setTimeout(resolve, 100))

      const summary = await manager.endSession(false)

      expect(summary?.duration).toBeGreaterThanOrEqual(100)
      expect(summary?.completed).toBe(true)
    })

    it('should save session to API for premium users', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      })

      await manager.startSession(mockUser.uid, contentType, undefined, mockUser)
      await manager.endSession(true) // Premium user

      expect(fetch).toHaveBeenCalledWith(
        '/api/sessions/save',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('session')
        })
      )
    })
  })

  describe('5. Review History', () => {
    const mockUser = { uid: 'test-user-123' }
    const contentType = 'hiragana'

    beforeEach(() => {
      manager.setDB(mockDB)
      mockDB.add.mockResolvedValue(true)
      mockDB.getFromIndex.mockResolvedValue(null)
    })

    it('should queue review history for premium users', async () => {
      await manager.trackProgress(
        contentType,
        'あ',
        ProgressEvent.COMPLETED,
        mockUser,
        true, // Premium
        { correct: true, responseTime: 1500 }
      )

      const historyQueue = manager.getReviewHistoryQueue()
      expect(historyQueue.length).toBeGreaterThan(0)

      const entry = historyQueue[0]
      expect(entry).toMatchObject({
        userId: mockUser.uid,
        contentType,
        contentId: 'あ',
        event: ProgressEvent.COMPLETED,
        correct: true,
        responseTime: 1500,
        isPremium: true
      })
    })

    it('should not queue review history for free users', async () => {
      await manager.trackProgress(
        contentType,
        'あ',
        ProgressEvent.VIEWED,
        mockUser,
        false // Free user
      )

      const historyQueue = manager.getReviewHistoryQueue()
      expect(historyQueue.length).toBe(0)
    })

    it('should query review history via API', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          entries: [
            { contentId: 'あ', event: ProgressEvent.VIEWED, timestamp: new Date() },
            { contentId: 'か', event: ProgressEvent.COMPLETED, timestamp: new Date() }
          ]
        })
      })

      const results = await manager.queryReviewHistory(mockUser.uid, {
        contentType,
        limit: 10
      })

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/review-history/query'),
        expect.objectContaining({ method: 'GET' })
      )

      expect(results).toHaveLength(2)
    })
  })

  describe('6. Device Detection', () => {
    it('should detect mobile device', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      })

      const deviceType = manager.testGetDeviceType()
      expect(deviceType).toBe('mobile')
    })

    it('should detect tablet device', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 800
      })

      const deviceType = manager.testGetDeviceType()
      expect(deviceType).toBe('tablet')
    })

    it('should detect desktop device', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920
      })

      const deviceType = manager.testGetDeviceType()
      expect(deviceType).toBe('desktop')
    })
  })

  describe('7. Storage Tiers', () => {
    const mockUser = { uid: 'test-user-123' }
    const contentType = 'hiragana'

    beforeEach(() => {
      manager.setDB(mockDB)
      mockDB.getFromIndex.mockResolvedValue(null)
      mockDB.add.mockResolvedValue(true)
      jest.useFakeTimers()
    })

    it('Guest users: no storage at all', async () => {
      await manager.trackProgress(contentType, 'あ', ProgressEvent.VIEWED, null, false)

      expect(mockDB.add).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
    })

    it('Free users: IndexedDB only', async () => {
      await manager.trackProgress(contentType, 'あ', ProgressEvent.VIEWED, mockUser, false)

      // Should save to IndexedDB
      expect(mockDB.add).toHaveBeenCalled()

      // Should NOT sync to Firebase
      jest.advanceTimersByTime(1000)
      expect(fetch).not.toHaveBeenCalled()
    })

    it('Premium users: IndexedDB + Firebase', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      })

      await manager.trackProgress(contentType, 'あ', ProgressEvent.VIEWED, mockUser, true)

      // Should save to IndexedDB
      expect(mockDB.add).toHaveBeenCalled()

      // Should sync to Firebase after debounce
      jest.advanceTimersByTime(500)
      expect(fetch).toHaveBeenCalledWith(
        '/api/progress/track',
        expect.any(Object)
      )
    })
  })

  describe('8. Error Recovery', () => {
    const mockUser = { uid: 'test-user-123' }
    const contentType = 'hiragana'

    beforeEach(() => {
      manager.setDB(mockDB)
      jest.useFakeTimers()
    })

    it('should continue working if API is down', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Service unavailable'))

      mockDB.getFromIndex.mockResolvedValue(null)
      mockDB.add.mockResolvedValue(true)

      await manager.trackProgress(contentType, 'あ', ProgressEvent.VIEWED, mockUser, true)

      // Should still save to IndexedDB
      expect(mockDB.add).toHaveBeenCalled()

      // Should attempt sync and fail gracefully
      jest.advanceTimersByTime(500)
      await manager.testProcessPendingUpdates()

      expect(reviewLogger.error).toHaveBeenCalled()
    })

    it('should handle malformed API responses', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => { throw new Error('Invalid JSON') }
      })

      const result = await manager.getProgress(mockUser.uid, contentType, true)

      // Should return empty map on error
      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
    })

    it('should process sync queue on recovery', async () => {
      mockDB.transaction.mockReturnValue({
        store: {
          index: jest.fn().mockReturnValue({
            getAll: jest.fn().mockResolvedValue([
              {
                id: 1,
                type: 'progress',
                userId: mockUser.uid,
                contentType,
                data: { 'あ': { viewCount: 1 } },
                status: 'pending'
              }
            ])
          })
        }
      })

      mockDB.delete.mockResolvedValue(true);

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      })

      await manager.processSyncQueue()

      expect(fetch).toHaveBeenCalled()
      expect(mockDB.delete).toHaveBeenCalledWith('syncQueue', 1)
    })
  })
})