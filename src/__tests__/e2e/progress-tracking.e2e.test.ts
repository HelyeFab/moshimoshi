/**
 * End-to-End Test Suite for Progress Tracking System
 * Tests the complete flow from user interaction to Firebase storage
 */

import { KanaProgressManagerV2 } from '@/utils/kanaProgressManagerV2'
import { ProgressEvent } from '@/lib/review-engine/core/progress.types'

// Mock fetch globally
global.fetch = jest.fn()

// Mock IndexedDB
const mockIDB = {
  openDB: jest.fn(),
  deleteDB: jest.fn(),
}
jest.mock('idb', () => mockIDB)

// Mock logger
jest.mock('@/lib/monitoring/logger', () => ({
  reviewLogger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}))

describe('Progress Tracking E2E Flow', () => {
  let kanaManager: KanaProgressManagerV2
  let mockDB: any

  const mockUser = {
    uid: 'e2e-test-user',
    email: 'e2e@test.com',
    displayName: 'E2E Test User'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()

    // Get singleton instance
    kanaManager = KanaProgressManagerV2.getInstance()

    // Setup mock IndexedDB
    mockDB = {
      transaction: jest.fn(),
      add: jest.fn().mockResolvedValue(true),
      put: jest.fn().mockResolvedValue(true),
      get: jest.fn(),
      getFromIndex: jest.fn().mockResolvedValue(null),
      delete: jest.fn(),
      objectStoreNames: {
        contains: jest.fn(() => true)
      }
    }

    mockIDB.openDB.mockResolvedValue(mockDB)

    // Setup mock transaction for cursor operations
    mockDB.transaction.mockReturnValue({
      store: {
        index: jest.fn().mockReturnValue({
          openCursor: jest.fn().mockResolvedValue(null)
        })
      }
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('Complete User Journey', () => {
    it('should track a complete learning session for a free user', async () => {
      // 1. User starts a session
      const sessionId = await kanaManager.startKanaSession('hiragana', mockUser)
      expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/)

      // 2. User views multiple characters
      await kanaManager.trackCharacterView('hiragana', 'あ', mockUser, false)
      await kanaManager.trackCharacterView('hiragana', 'か', mockUser, false)
      await kanaManager.trackCharacterView('hiragana', 'さ', mockUser, false)

      // Verify IndexedDB was called for each view
      expect(mockDB.add.mock.calls.length).toBeGreaterThanOrEqual(3)

      // 3. User interacts with characters
      await kanaManager.trackCharacterInteraction('hiragana', 'あ', 'audio', mockUser, false)
      await kanaManager.trackCharacterInteraction('hiragana', 'か', 'hint', mockUser, false)

      // 4. User marks some as learned
      await kanaManager.trackCharacterLearned('hiragana', 'あ', mockUser, false)
      await kanaManager.trackCharacterLearned('hiragana', 'か', mockUser, false)

      // 5. User skips one character
      await kanaManager.trackCharacterSkipped('hiragana', 'さ', mockUser, false)

      // 6. End session
      await kanaManager.endKanaSession(false)

      // Verify no API calls were made (free user)
      expect(fetch).not.toHaveBeenCalled()

      // 7. Verify progress can be loaded
      const progress = await kanaManager.getProgress('hiragana', mockUser, false)

      // Progress should be an object with character IDs as keys
      expect(typeof progress).toBe('object')
    })

    it('should sync to Firebase for premium users', async () => {
      jest.useFakeTimers()

      // Mock successful API responses
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          itemsCount: 2,
          isPremium: true
        })
      })

      // 1. Premium user starts session
      const sessionId = await kanaManager.startKanaSession('hiragana', mockUser)

      // 2. User learns characters
      await kanaManager.trackCharacterView('hiragana', 'あ', mockUser, true) // Premium
      await kanaManager.trackCharacterLearned('hiragana', 'あ', mockUser, true)

      // 3. Advance time to trigger debounced sync
      jest.advanceTimersByTime(600)

      // 4. Verify API was called
      await Promise.resolve() // Let promises resolve
      expect(fetch).toHaveBeenCalledWith(
        '/api/progress/track',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      )

      // 5. Verify the request body
      const lastCall = (fetch as jest.Mock).mock.calls[0]
      const body = JSON.parse(lastCall[1].body)
      expect(body.contentType).toBe('hiragana')
      expect(body.items).toBeDefined()
      expect(body.items.length).toBeGreaterThan(0)
    })

    it('should handle achievement updates through the system', async () => {
      // Import achievement store
      const { useAchievementStore } = require('@/stores/achievement-store')
      const achievementStore = useAchievementStore.getState()

      // Mock achievement API
      (fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/api/achievements/update-activity')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              currentStreak: 5,
              bestStreak: 10,
              message: 'Activity updated'
            })
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true })
        })
      })

      // Track activity
      await achievementStore.updateProgress(
        'hiragana',
        10, // items reviewed
        80, // accuracy
        300000 // 5 minutes
      )

      // Verify achievement API was called
      expect(fetch).toHaveBeenCalledWith(
        '/api/achievements/update-activity',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('hiragana')
        })
      )
    })

    it('should handle offline to online transition', async () => {
      jest.useFakeTimers()

      // Start offline (API fails)
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      // 1. Track progress while offline
      await kanaManager.trackCharacterView('hiragana', 'あ', mockUser, true)
      await kanaManager.trackCharacterLearned('hiragana', 'あ', mockUser, true)

      // Advance time to trigger sync attempt
      jest.advanceTimersByTime(600)
      await Promise.resolve()

      // Verify it tried to sync and failed
      expect(fetch).toHaveBeenCalled()

      // Data should be in sync queue
      expect(mockDB.add).toHaveBeenCalledWith(
        'syncQueue',
        expect.objectContaining({
          type: 'progress',
          status: 'pending'
        })
      )

      // 2. Come back online
      jest.clearAllMocks()
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      })

      // Mock sync queue data
      mockDB.transaction.mockReturnValue({
        store: {
          index: jest.fn().mockReturnValue({
            getAll: jest.fn().mockResolvedValue([
              {
                id: 1,
                type: 'progress',
                userId: mockUser.uid,
                contentType: 'hiragana',
                data: { 'あ': { viewCount: 1 } },
                status: 'pending'
              }
            ])
          })
        }
      })

      // Process sync queue
      await kanaManager['processSyncQueue']()

      // Verify data was synced
      expect(fetch).toHaveBeenCalledWith(
        '/api/progress/track',
        expect.any(Object)
      )
    })

    it('should migrate from old localStorage format', async () => {
      // Setup old localStorage data
      const oldData = {
        'あ': {
          status: 'learned',
          reviewCount: 10,
          correctCount: 8,
          lastReviewed: '2024-01-01T00:00:00Z',
          pinned: false
        },
        'か': {
          status: 'viewing',
          reviewCount: 5,
          correctCount: 3,
          lastReviewed: '2024-01-02T00:00:00Z',
          pinned: true
        }
      }

      localStorage.setItem('kana-progress-hiragana', JSON.stringify(oldData))

      // Run migration
      const migrated = await kanaManager.migrateFromLocalStorage('hiragana', mockUser, false)

      expect(migrated).toBe(true)

      // Verify data was saved to IndexedDB
      expect(mockDB.add.mock.calls.length).toBeGreaterThanOrEqual(2)

      // Verify migration flag was set
      expect(localStorage.getItem(`kana-progress-hiragana-${mockUser.uid}-migrated-v2`)).toBe('true')
    })

    it('should calculate statistics correctly', async () => {
      // Mock progress data in IndexedDB
      const mockProgress = new Map([
        ['あ', { viewCount: 10, status: 'learned', accuracy: 90, totalViewTime: 5000 }],
        ['か', { viewCount: 5, status: 'mastered', accuracy: 95, totalViewTime: 3000 }],
        ['さ', { viewCount: 2, status: 'viewing', accuracy: 60, totalViewTime: 1000 }],
        ['た', { viewCount: 0, status: 'not-started', accuracy: 0, totalViewTime: 0 }]
      ])

      // Mock the getProgress method to return our test data
      jest.spyOn(kanaManager, 'getProgress').mockResolvedValue({
        'あ': { status: 'learned', reviewCount: 10, correctCount: 9, pinned: false, updatedAt: new Date() },
        'か': { status: 'mastered', reviewCount: 5, correctCount: 5, pinned: false, updatedAt: new Date() },
        'さ': { status: 'viewing', reviewCount: 2, correctCount: 1, pinned: false, updatedAt: new Date() },
        'た': { status: 'not-started', reviewCount: 0, correctCount: 0, pinned: false, updatedAt: new Date() }
      } as any)

      const stats = await kanaManager.getStatistics('hiragana', mockUser, false)

      expect(stats.totalCharacters).toBe(4)
      expect(stats.viewedCharacters).toBe(3) // All except 'た'
      expect(stats.learnedCharacters).toBe(1) // 'あ'
      expect(stats.masteredCharacters).toBe(1) // 'か'
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle API failures gracefully', async () => {
      jest.useFakeTimers()

      // API returns 401 Unauthorized
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      })

      // Track as premium user
      await kanaManager.trackCharacterView('hiragana', 'あ', mockUser, true)

      // Trigger sync
      jest.advanceTimersByTime(600)
      await Promise.resolve()

      // Should still save to IndexedDB
      expect(mockDB.add).toHaveBeenCalled()

      // Should add to sync queue after failure
      expect(mockDB.add).toHaveBeenCalledWith(
        'syncQueue',
        expect.any(Object)
      )
    })

    it('should handle corrupted IndexedDB data', async () => {
      // Mock corrupted data
      mockDB.getFromIndex.mockResolvedValue({
        data: 'corrupted-non-object-data'
      })

      // Should not throw
      const progress = await kanaManager.getProgress('hiragana', mockUser, false)

      // Should return empty object on error
      expect(progress).toEqual({})
    })

    it('should handle race conditions in concurrent updates', async () => {
      jest.useFakeTimers()

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      })

      // Simulate rapid concurrent updates
      const promises = [
        kanaManager.trackCharacterView('hiragana', 'あ', mockUser, true),
        kanaManager.trackCharacterView('hiragana', 'か', mockUser, true),
        kanaManager.trackCharacterView('hiragana', 'さ', mockUser, true),
        kanaManager.trackCharacterLearned('hiragana', 'あ', mockUser, true),
        kanaManager.trackCharacterLearned('hiragana', 'か', mockUser, true)
      ]

      await Promise.all(promises)

      // Advance time to trigger sync
      jest.advanceTimersByTime(600)
      await Promise.resolve()

      // Should batch all updates into a single API call
      expect(fetch).toHaveBeenCalledTimes(1)

      const callArgs = (fetch as jest.Mock).mock.calls[0]
      const body = JSON.parse(callArgs[1].body)

      // Should include all characters
      expect(body.items.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Performance Tests', () => {
    it('should handle large datasets efficiently', async () => {
      const startTime = Date.now()

      // Track 100 characters
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(
          kanaManager.trackCharacterView('hiragana', `char-${i}`, mockUser, false)
        )
      }

      await Promise.all(promises)

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete within 2 seconds even with 100 operations
      expect(duration).toBeLessThan(2000)
    })

    it('should load progress efficiently', async () => {
      // Mock API to return large dataset
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => {
          const items: any = {}
          for (let i = 0; i < 500; i++) {
            items[`char-${i}`] = {
              contentId: `char-${i}`,
              viewCount: Math.floor(Math.random() * 100),
              accuracy: Math.floor(Math.random() * 100)
            }
          }
          return { items, contentType: 'hiragana' }
        }
      })

      const startTime = Date.now()
      await kanaManager.getProgress('hiragana', mockUser, true)
      const endTime = Date.now()

      // Should load 500 items in under 1 second
      expect(endTime - startTime).toBeLessThan(1000)
    })
  })

  describe('Data Integrity', () => {
    it('should maintain data consistency across storage layers', async () => {
      jest.useFakeTimers()

      // Setup successful API
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, itemsCount: 1, isPremium: true })
      })

      // Save as premium user
      await kanaManager.saveProgress(
        'hiragana',
        'あ',
        {
          status: 'learned',
          reviewCount: 10,
          correctCount: 8,
          lastReviewed: new Date(),
          pinned: true,
          updatedAt: new Date()
        },
        mockUser,
        true
      )

      // Trigger sync
      jest.advanceTimersByTime(600)
      await Promise.resolve()

      // Verify IndexedDB was updated
      expect(mockDB.put).toHaveBeenCalled()

      // Verify API was called
      expect(fetch).toHaveBeenCalled()

      // Verify the data sent matches what was saved
      const apiCall = (fetch as jest.Mock).mock.calls[0]
      const body = JSON.parse(apiCall[1].body)

      expect(body.items).toBeDefined()
      const savedItem = body.items[0][1] // [key, value] pair
      expect(savedItem.status).toBe('learned')
      expect(savedItem.correctCount).toBe(8)
    })

    it('should handle special characters correctly', async () => {
      const specialChars = ['ゃ', 'ゅ', 'ょ', 'っ', 'ー']

      for (const char of specialChars) {
        await kanaManager.trackCharacterView('hiragana', char, mockUser, false)
      }

      // Verify all special characters were saved
      expect(mockDB.add.mock.calls.length).toBeGreaterThanOrEqual(specialChars.length)
    })
  })
})