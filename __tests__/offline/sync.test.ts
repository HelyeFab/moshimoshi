import { IndexedDBStorage } from '@/lib/review-engine/offline/indexed-db'
import { SyncQueue } from '@/lib/review-engine/offline/sync-queue'
import { ConflictResolver } from '@/lib/review-engine/offline/conflict-resolver'
import { ReviewSession, SessionStatistics, ProgressData } from '@/lib/review-engine/core/types'

// Mock IndexedDB for testing
import mockIndexedDB from 'fake-indexeddb'
import mockIDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange'

global.indexedDB = mockIndexedDB
global.IDBKeyRange = mockIDBKeyRange

describe('Offline Sync System', () => {
  describe('IndexedDB Storage', () => {
    let storage: IndexedDBStorage

    beforeEach(async () => {
      storage = new IndexedDBStorage()
      await storage.initialize()
    })

    afterEach(() => {
      storage.close()
    })

    it('should initialize database', async () => {
      expect(storage).toBeDefined()
    })

    it('should save and retrieve sessions', async () => {
      const session: ReviewSession = {
        id: 'test-session-1',
        userId: 'user-1',
        mode: 'recognition',
        items: [],
        currentIndex: 0,
        startedAt: Date.now(),
        lastActivityAt: Date.now(),
        status: 'active'
      }

      await storage.saveSession(session)
      const retrieved = await storage.getSession('test-session-1')

      expect(retrieved).toEqual(session)
    })

    it('should get user sessions', async () => {
      const userId = 'user-1'
      const sessions: ReviewSession[] = [
        {
          id: 'session-1',
          userId,
          mode: 'recognition',
          items: [],
          currentIndex: 0,
          startedAt: Date.now(),
          lastActivityAt: Date.now(),
          status: 'active'
        },
        {
          id: 'session-2',
          userId,
          mode: 'recall',
          items: [],
          currentIndex: 0,
          startedAt: Date.now(),
          lastActivityAt: Date.now(),
          status: 'completed'
        }
      ]

      for (const session of sessions) {
        await storage.saveSession(session)
      }

      const retrieved = await storage.getUserSessions(userId)
      expect(retrieved).toHaveLength(2)
      expect(retrieved.map(s => s.id)).toEqual(['session-1', 'session-2'])
    })

    it('should cache and retrieve content', async () => {
      const content = [
        { id: 'content-1', contentType: 'kana' as const, primaryDisplay: 'あ', primaryAnswer: 'a', tags: [], difficulty: 0.1, supportedModes: ['recognition' as const] },
        { id: 'content-2', contentType: 'kana' as const, primaryDisplay: 'い', primaryAnswer: 'i', tags: [], difficulty: 0.1, supportedModes: ['recognition' as const] }
      ]

      await storage.cacheContent(content)
      const retrieved = await storage.getContent(['content-1', 'content-2'])

      expect(retrieved).toHaveLength(2)
      expect(retrieved[0].id).toBe('content-1')
      expect(retrieved[1].id).toBe('content-2')
    })

    it('should clean up old data', async () => {
      const oldSession: ReviewSession = {
        id: 'old-session',
        userId: 'user-1',
        mode: 'recognition',
        items: [],
        currentIndex: 0,
        startedAt: Date.now() - 40 * 24 * 60 * 60 * 1000, // 40 days ago
        lastActivityAt: Date.now() - 40 * 24 * 60 * 60 * 1000,
        status: 'completed'
      }

      await storage.saveSession(oldSession)
      await storage.cleanupOldData(30)

      const retrieved = await storage.getSession('old-session')
      expect(retrieved).toBeNull()
    })
  })
  
  describe('Sync Queue', () => {
    let storage: IndexedDBStorage
    let syncQueue: SyncQueue
    let mockApiClient: any

    beforeEach(async () => {
      storage = new IndexedDBStorage()
      await storage.initialize()
      
      mockApiClient = {
        createSession: jest.fn().mockResolvedValue({}),
        updateSession: jest.fn().mockResolvedValue({}),
        submitAnswer: jest.fn().mockResolvedValue({}),
        saveStatistics: jest.fn().mockResolvedValue({}),
        updateProgress: jest.fn().mockResolvedValue({})
      }
      
      syncQueue = new SyncQueue(storage, mockApiClient)
    })

    afterEach(() => {
      syncQueue.cleanup()
      storage.close()
    })

    it('should queue items when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      })

      await syncQueue.add({
        type: 'session',
        action: 'create',
        data: { id: 'session-1' }
      })

      const status = await syncQueue.getQueueStatus()
      expect(status.pending).toBe(1)
      expect(status.total).toBe(1)
    })

    it('should process queue when online', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      })

      await syncQueue.add({
        type: 'session',
        action: 'create',
        data: { id: 'session-1' }
      })

      await syncQueue.process()

      expect(mockApiClient.createSession).toHaveBeenCalledWith({ id: 'session-1' })
      
      const status = await syncQueue.getQueueStatus()
      expect(status.total).toBe(0)
    })

    it('should handle retry logic', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      })

      mockApiClient.createSession.mockRejectedValueOnce(new Error('Network error'))
      mockApiClient.createSession.mockResolvedValueOnce({})

      await syncQueue.add({
        type: 'session',
        action: 'create',
        data: { id: 'session-1' }
      })

      await syncQueue.process()

      expect(mockApiClient.createSession).toHaveBeenCalledTimes(2)
    })

    it('should move failed items to dead letter queue after max retries', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      })

      mockApiClient.createSession.mockRejectedValue(new Error('Permanent error'))

      await syncQueue.add({
        type: 'session',
        action: 'create',
        data: { id: 'session-1' }
      })

      await syncQueue.process()

      expect(mockApiClient.createSession).toHaveBeenCalledTimes(3) // Max retries
      
      const status = await syncQueue.getQueueStatus()
      expect(status.total).toBe(0) // Item moved to dead letter queue
    })
  })
  
  describe('Conflict Resolution', () => {
    let resolver: ConflictResolver

    beforeEach(() => {
      resolver = new ConflictResolver('merge')
    })

    it('should resolve session conflicts with merge strategy', () => {
      const local: ReviewSession = {
        id: 'session-1',
        userId: 'user-1',
        mode: 'recognition',
        items: [],
        currentIndex: 5,
        startedAt: 1000,
        lastActivityAt: 2000,
        status: 'active',
        statistics: {
          totalItems: 10,
          completedItems: 5,
          correctItems: 3,
          incorrectItems: 2,
          skippedItems: 0,
          averageResponseTime: 2000,
          accuracy: 60,
          currentStreak: 2,
          maxStreak: 3,
          hintsUsed: 1,
          duration: 1000
        }
      }

      const remote: ReviewSession = {
        id: 'session-1',
        userId: 'user-1',
        mode: 'recognition',
        items: [],
        currentIndex: 7,
        startedAt: 1000,
        lastActivityAt: 3000,
        status: 'completed',
        statistics: {
          totalItems: 10,
          completedItems: 7,
          correctItems: 5,
          incorrectItems: 2,
          skippedItems: 0,
          averageResponseTime: 1800,
          accuracy: 71,
          currentStreak: 3,
          maxStreak: 4,
          hintsUsed: 2,
          duration: 2000
        }
      }

      const result = resolver.resolveSessionConflict(local, remote)

      expect(result.resolved.currentIndex).toBe(7) // Higher value
      expect(result.resolved.lastActivityAt).toBe(3000) // More recent
      expect(result.resolved.status).toBe('completed') // Higher priority
      expect(result.resolved.statistics?.completedItems).toBe(7) // Max value
      expect(result.resolved.statistics?.maxStreak).toBe(4) // Max value
      expect(result.conflicts.length).toBeGreaterThan(0)
    })

    it('should resolve progress conflicts', () => {
      const local: ProgressData = {
        contentId: 'content-1',
        learned: 50,
        reviewCount: 10,
        correctCount: 8,
        incorrectCount: 2,
        lastReviewed: 2000,
        nextReview: 5000,
        difficulty: 0.3,
        interval: 1
      }

      const remote: ProgressData = {
        contentId: 'content-1',
        learned: 60,
        reviewCount: 12,
        correctCount: 10,
        incorrectCount: 2,
        lastReviewed: 3000,
        nextReview: 4000,
        difficulty: 0.25,
        interval: 2
      }

      const result = resolver.resolveProgressConflict(local, remote)

      expect(result.resolved.learned).toBe(60) // Max value
      expect(result.resolved.reviewCount).toBe(12) // Max value
      expect(result.resolved.lastReviewed).toBe(3000) // Most recent
      expect(result.resolved.nextReview).toBe(4000) // Nearest future
      expect(result.resolved.interval).toBe(2) // Max interval
    })

    it('should handle edge cases in conflict resolution', () => {
      const localWithNoStats: ReviewSession = {
        id: 'session-1',
        userId: 'user-1',
        mode: 'recognition',
        items: [],
        currentIndex: 0,
        startedAt: 1000,
        lastActivityAt: 2000,
        status: 'active'
      }

      const remoteWithStats: ReviewSession = {
        id: 'session-1',
        userId: 'user-1',
        mode: 'recognition',
        items: [],
        currentIndex: 3,
        startedAt: 1000,
        lastActivityAt: 1500,
        status: 'active',
        statistics: {
          totalItems: 10,
          completedItems: 3,
          correctItems: 2,
          incorrectItems: 1,
          skippedItems: 0,
          averageResponseTime: 2000,
          accuracy: 67,
          currentStreak: 1,
          maxStreak: 2,
          hintsUsed: 0,
          duration: 500
        }
      }

      const result = resolver.resolveSessionConflict(localWithNoStats, remoteWithStats)

      expect(result.resolved.statistics).toBeDefined()
      expect(result.resolved.statistics).toEqual(remoteWithStats.statistics)
    })
  })
})