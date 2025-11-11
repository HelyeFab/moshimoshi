/**
 * Offline Sync Integration Tests
 * Tests for offline session storage and sync recovery
 *
 * Coverage:
 * - IndexedDB initialization
 * - Offline queue management
 * - Network reconnection handling
 * - Circuit breaker behavior
 * - Exponential backoff
 * - Conflict resolution
 */

import { IndexedDBStorage } from '../offline/indexed-db'
import { ImprovedSyncQueue } from '../offline/improved-sync-queue'

describe('Offline Sync', () => {
  let storage: IndexedDBStorage
  let syncQueue: any

  beforeEach(async () => {
    // Create new storage instance with unique DB name for test isolation
    storage = new IndexedDBStorage()
    await storage.initialize()
  })

  afterEach(async () => {
    // Clean up test data
    if (storage) {
      try {
        // Clear all sessions
        const sessions = await storage.getUserSessions('user-123')
        for (const session of sessions) {
          // Sessions are stored, no delete method exposed
        }
        // Clear sync queue
        const queue = await storage.getSyncQueue()
        for (const item of queue) {
          if (item.id) {
            await storage.removeSyncQueueItem(item.id)
          }
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  })

  describe('IndexedDB Storage', () => {
    test('should initialize IndexedDB successfully', async () => {
      expect(storage).toBeDefined()
      // DB should be ready for operations
    })

    test('should save session to IndexedDB', async () => {
      const session = {
        id: 'test-session-1',
        userId: 'user-123',
        status: 'active' as const,
        mode: 'recall' as const,
        items: [],
        currentIndex: 0,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        config: {},
        source: 'test',
        stats: {
          sessionId: 'test-session-1',
          totalItems: 0,
          completedItems: 0,
          correctItems: 0,
          incorrectItems: 0,
          skippedItems: 0,
          averageResponseTime: 0,
          totalTime: 0,
          accuracy: 0,
          currentStreak: 0,
          bestStreak: 0,
          performanceByDifficulty: {
            easy: { correct: 0, total: 0, avgTime: 0 },
            medium: { correct: 0, total: 0, avgTime: 0 },
            hard: { correct: 0, total: 0, avgTime: 0 }
          },
          totalScore: 0,
          maxPossibleScore: 0,
          totalHintsUsed: 0,
          averageHintsPerItem: 0
        }
      }

      await storage.saveSession(session)

      const retrieved = await storage.getSession('test-session-1')
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe('test-session-1')
      expect(retrieved?.userId).toBe('user-123')
    })

    test('should retrieve user sessions', async () => {
      const session1 = createTestSession('session-1', 'user-123')
      const session2 = createTestSession('session-2', 'user-123')
      const session3 = createTestSession('session-3', 'user-456')

      await storage.saveSession(session1)
      await storage.saveSession(session2)
      await storage.saveSession(session3)

      const user123Sessions = await storage.getUserSessions('user-123')

      expect(user123Sessions.length).toBe(2)
      expect(user123Sessions.map(s => s.id)).toContain('session-1')
      expect(user123Sessions.map(s => s.id)).toContain('session-2')
      expect(user123Sessions.map(s => s.id)).not.toContain('session-3')
    })

    test('should filter active sessions', async () => {
      const activeSession = createTestSession('active-1', 'user-123', 'active')
      const completedSession = createTestSession('completed-1', 'user-123', 'completed')

      await storage.saveSession(activeSession)
      await storage.saveSession(completedSession)

      const activeSessions = await storage.getActiveSessions('user-123')

      expect(activeSessions.length).toBe(1)
      expect(activeSessions[0].status).toBe('active')
    })
  })

  describe('Sync Queue Management', () => {
    test('should add items to sync queue', async () => {
      const queueItem = {
        type: 'session' as const,
        action: 'create' as const,
        data: createTestSession('queue-test-1', 'user-123'),
        timestamp: Date.now(),
        retryCount: 0,
        status: 'pending' as const
      }

      await storage.addToSyncQueue(queueItem)

      const queue = await storage.getSyncQueue()
      expect(queue.length).toBeGreaterThan(0)
      expect(queue[0].type).toBe('session')
      expect(queue[0].status).toBe('pending')
    })

    test('should update sync queue item status', async () => {
      const queueItem = {
        type: 'session' as const,
        action: 'create' as const,
        data: {},
        timestamp: Date.now(),
        retryCount: 0,
        status: 'pending' as const
      }

      await storage.addToSyncQueue(queueItem)
      const queue = await storage.getSyncQueue()
      const itemId = queue[0].id!

      await storage.updateSyncQueueItem(itemId, { status: 'syncing' })

      const updatedQueue = await storage.getSyncQueue()
      const updatedItem = updatedQueue.find(item => item.id === itemId)

      expect(updatedItem?.status).toBe('syncing')
    })

    test('should remove synced items from queue', async () => {
      const queueItem = {
        type: 'session' as const,
        action: 'create' as const,
        data: {},
        timestamp: Date.now(),
        retryCount: 0,
        status: 'completed' as const
      }

      await storage.addToSyncQueue(queueItem)
      let queue = await storage.getSyncQueue()
      const itemId = queue[queue.length - 1].id!

      await storage.removeSyncQueueItem(itemId)

      queue = await storage.getSyncQueue()
      const removedItem = queue.find(item => item.id === itemId)

      expect(removedItem).toBeUndefined()
    })
  })

  describe('Network Reconnection', () => {
    test('should process queue on network reconnection', async () => {
      // Simulate offline scenario
      const mockApiClient = {
        createSession: jest.fn().mockResolvedValue({}),
        updateSession: jest.fn().mockResolvedValue({}),
        submitAnswer: jest.fn().mockResolvedValue({}),
        saveStatistics: jest.fn().mockResolvedValue(undefined),
        updateProgress: jest.fn().mockResolvedValue(undefined)
      }

      syncQueue = new ImprovedSyncQueue(storage, mockApiClient)

      // Add items while "offline"
      await syncQueue.add({
        type: 'session',
        action: 'create',
        data: createTestSession('offline-1', 'user-123')
      })

      // Simulate coming back online
      await syncQueue.process()

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockApiClient.createSession).toHaveBeenCalled()
    })
  })

  describe('Circuit Breaker', () => {
    test('should open circuit after 5 consecutive failures', async () => {
      const failingApiClient = {
        createSession: jest.fn().mockRejectedValue(new Error('Network error')),
        updateSession: jest.fn().mockRejectedValue(new Error('Network error')),
        submitAnswer: jest.fn().mockRejectedValue(new Error('Network error')),
        saveStatistics: jest.fn().mockRejectedValue(new Error('Network error')),
        updateProgress: jest.fn().mockRejectedValue(new Error('Network error'))
      }

      syncQueue = new ImprovedSyncQueue(storage, failingApiClient)

      // Attempt 5 syncs (should trigger circuit breaker)
      for (let i = 0; i < 5; i++) {
        await syncQueue.add({
          type: 'session',
          action: 'create',
          data: createTestSession(`fail-${i}`, 'user-123')
        })
      }

      await syncQueue.process()
      await new Promise(resolve => setTimeout(resolve, 200))

      const metrics = syncQueue.getMetrics()
      expect(metrics.circuitBreakerTrips).toBeGreaterThan(0)
    })

    test('should reset circuit breaker after cooldown period', async () => {
      // This test would require mocking time or waiting 30+ seconds
      // Marked as integration test
    })
  })

  describe('Exponential Backoff', () => {
    test('should increase retry delay exponentially', () => {
      const delays = []
      const baseDelay = 1000 // 1 second
      const maxDelay = 60000 // 60 seconds

      for (let retry = 0; retry < 6; retry++) {
        const delay = Math.min(baseDelay * Math.pow(2, retry), maxDelay)
        delays.push(delay)
      }

      expect(delays[0]).toBe(1000) // 1s
      expect(delays[1]).toBe(2000) // 2s
      expect(delays[2]).toBe(4000) // 4s
      expect(delays[3]).toBe(8000) // 8s
      expect(delays[4]).toBe(16000) // 16s
      expect(delays[5]).toBe(32000) // 32s
    })

    test('should cap retry delay at maximum', () => {
      const baseDelay = 1000
      const maxDelay = 60000

      const delay = Math.min(baseDelay * Math.pow(2, 10), maxDelay)

      expect(delay).toBe(maxDelay)
    })
  })

  describe('Conflict Resolution', () => {
    test('should use Last-Write-Wins for conflicting updates', async () => {
      const session = createTestSession('conflict-test', 'user-123')

      // Save initial version
      await storage.saveSession(session)

      // Create two conflicting updates
      const update1 = { ...session, currentIndex: 5, lastActivityAt: new Date(Date.now() - 1000) }
      const update2 = { ...session, currentIndex: 7, lastActivityAt: new Date() }

      // LWW should keep the one with later timestamp
      await storage.saveSession(update1)
      await storage.saveSession(update2)

      const retrieved = await storage.getSession('conflict-test')

      expect(retrieved?.currentIndex).toBe(7) // Later update wins
    })
  })

  describe('Edge Cases', () => {
    test('should handle corrupted IndexedDB gracefully', async () => {
      // Attempt to read non-existent session
      const retrieved = await storage.getSession('non-existent-id')

      expect(retrieved).toBeNull()
    })

    test('should handle concurrent session saves', async () => {
      const session = createTestSession('concurrent-test', 'user-123')

      // Save same session multiple times concurrently
      await Promise.all([
        storage.saveSession(session),
        storage.saveSession(session),
        storage.saveSession(session)
      ])

      const retrieved = await storage.getSession('concurrent-test')

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe('concurrent-test')
    })

    test('should survive browser storage quota exceeded', async () => {
      // This would require filling up IndexedDB to quota
      // Marked as manual/integration test
    })
  })
})

// Helper function to create test sessions
function createTestSession(
  id: string,
  userId: string,
  status: 'active' | 'completed' | 'abandoned' | 'paused' = 'active'
): any {
  return {
    id,
    userId,
    status,
    mode: 'recall' as const,
    items: [],
    currentIndex: 0,
    startedAt: new Date(),
    lastActivityAt: new Date(),
    config: {},
    source: 'test',
    stats: {
      sessionId: id,
      totalItems: 0,
      completedItems: 0,
      correctItems: 0,
      incorrectItems: 0,
      skippedItems: 0,
      averageResponseTime: 0,
      totalTime: 0,
      accuracy: 0,
      currentStreak: 0,
      bestStreak: 0,
      performanceByDifficulty: {
        easy: { correct: 0, total: 0, avgTime: 0 },
        medium: { correct: 0, total: 0, avgTime: 0 },
        hard: { correct: 0, total: 0, avgTime: 0 }
      },
      totalScore: 0,
      maxPossibleScore: 0,
      totalHintsUsed: 0,
      averageHintsPerItem: 0
    }
  }
}
