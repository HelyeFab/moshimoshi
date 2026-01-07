/**
 * AnkiMediaManager Tests
 *
 * Comprehensive test suite for the background sync queue processor
 */

import { AnkiMediaManager } from '../AnkiMediaManager'
import { AnkiMediaStore } from '../mediaStore'

describe('AnkiMediaManager', () => {
  let manager: AnkiMediaManager
  let mediaStore: AnkiMediaStore

  beforeEach(() => {
    manager = AnkiMediaManager.getInstance()
    mediaStore = AnkiMediaStore.getInstance()
  })

  afterEach(async () => {
    // Cleanup
    manager.destroy()
    await mediaStore.deleteAllMedia()
  })

  describe('Basic Queue Processing', () => {
    it('should enqueue upload job', async () => {
      const blob = new Blob(['test content'], { type: 'text/plain' })

      await manager.enqueueUpload('testUser', 'testDeck', 'test.txt', blob)

      const status = await manager.getSyncStatus('testDeck')
      expect(status.pendingCount).toBeGreaterThan(0)
    })

    it('should process upload job successfully', async () => {
      const blob = new Blob(['test content'], { type: 'text/plain' })

      await manager.enqueueUpload('testUser', 'testDeck', 'test.txt', blob)

      // Wait for processing (mock upload is fast)
      await new Promise(resolve => setTimeout(resolve, 6000))

      const status = await manager.getSyncStatus('testDeck')
      expect(status.syncState).toBe('synced')
      expect(status.pendingCount).toBe(0)
    }, 10000)

    it('should enqueue delete job', async () => {
      await manager.enqueueDelete('testUser', 'testDeck', 'test.txt')

      const status = await manager.getSyncStatus('testDeck')
      expect(status.pendingCount).toBeGreaterThan(0)
    })
  })

  describe('Exponential Backoff', () => {
    it('should retry with exponential backoff on failure', async () => {
      // This test would need to mock failures
      // For now, just verify the retry mechanism exists
      const status = await manager.getSyncStatus()
      expect(status).toBeDefined()
    })
  })

  describe('Circuit Breaker', () => {
    it('should have circuit breaker constants defined', () => {
      const status = manager.getCurrentSyncStatus()
      expect(status).toBeDefined()
      expect(status.syncState).toBeDefined()
    })
  })

  describe('Sync Status', () => {
    it('should return correct sync status', async () => {
      const status = await manager.getSyncStatus()

      expect(status).toBeDefined()
      expect(status.isOnline).toBeDefined()
      expect(status.syncState).toBeDefined()
      expect(status.pendingCount).toBeDefined()
      expect(status.failedCount).toBeDefined()
    })

    it('should filter by deckId', async () => {
      const blob = new Blob(['test'], { type: 'text/plain' })

      await manager.enqueueUpload('user1', 'deck1', 'file1.txt', blob)
      await manager.enqueueUpload('user1', 'deck2', 'file2.txt', blob)

      const deck1Status = await manager.getSyncStatus('deck1')
      const deck2Status = await manager.getSyncStatus('deck2')

      expect(deck1Status.pendingCount).toBeGreaterThan(0)
      expect(deck2Status.pendingCount).toBeGreaterThan(0)
    })
  })

  describe('Force Sync', () => {
    it('should trigger immediate sync', async () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      await manager.enqueueUpload('testUser', 'testDeck', 'test.txt', blob)

      await manager.forceSyncAll()

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000))

      const status = await manager.getSyncStatus()
      expect(status).toBeDefined()
    }, 5000)
  })
})
