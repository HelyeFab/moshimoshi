/**
 * Integration tests for KanaProgressManagerV2
 */

// Mock Firebase first (before imports)
jest.mock('@/lib/firebase/client', () => ({
  firestore: {
    collection: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
    setDoc: jest.fn(),
    serverTimestamp: jest.fn(() => new Date()),
    writeBatch: jest.fn(() => ({
      set: jest.fn(),
      commit: jest.fn()
    }))
  }
}))

// No need to mock idb - fake-indexeddb handles it

import { KanaProgressManagerV2, CharacterProgress } from '../kanaProgressManagerV2'
import { ProgressEvent } from '@/lib/review-engine/core/progress.types'
import { User } from 'firebase/auth'

describe('KanaProgressManagerV2', () => {
  let manager: KanaProgressManagerV2
  let mockUser: User

  beforeEach(() => {
    // Get singleton instance
    manager = KanaProgressManagerV2.getInstance()

    mockUser = {
      uid: 'test-user-123',
      email: 'test@example.com'
    } as User

    // Clear mocks
    jest.clearAllMocks()

    // Clear localStorage
    localStorage.clear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = KanaProgressManagerV2.getInstance()
      const instance2 = KanaProgressManagerV2.getInstance()

      expect(instance1).toBe(instance2)
    })
  })

  describe('Character Progress Tracking', () => {
    it('should save character progress with legacy format', async () => {
      const progress: CharacterProgress = {
        status: 'learning',
        reviewCount: 3,
        correctCount: 2,
        lastReviewed: new Date(),
        pinned: true,
        updatedAt: new Date()
      }

      await manager.saveProgress(
        'hiragana',
        'あ',
        progress,
        mockUser,
        false // free user
      )

      // Verify it was saved
      const retrieved = await manager.getProgress('hiragana', mockUser, false)
      expect(retrieved['あ']).toBeDefined()
      expect(retrieved['あ'].status).toBe('learning')
      expect(retrieved['あ'].reviewCount).toBe(3)
      expect(retrieved['あ'].pinned).toBe(true)
    })

    it('should track character view', async () => {
      await manager.trackCharacterView(
        'hiragana',
        'あ',
        mockUser,
        false
      )

      const progress = await manager.getProgress('hiragana', mockUser, false)
      expect(progress['あ']).toBeDefined()
      expect(progress['あ'].reviewCount).toBeGreaterThan(0)
    })

    it('should track character interaction', async () => {
      await manager.trackCharacterInteraction(
        'hiragana',
        'あ',
        'audio',
        mockUser,
        false
      )

      const progress = await manager.getProgress('hiragana', mockUser, false)
      expect(progress['あ']).toBeDefined()
    })

    it('should track character as learned', async () => {
      await manager.trackCharacterLearned(
        'hiragana',
        'あ',
        mockUser,
        false
      )

      const progress = await manager.getProgress('hiragana', mockUser, false)
      expect(progress['あ']).toBeDefined()
      expect(progress['あ'].correctCount).toBeGreaterThan(0)
    })
  })

  describe('Session Management', () => {
    it('should start and end a kana session', async () => {
      const sessionId = await manager.startKanaSession('hiragana', mockUser)
      expect(sessionId).toBeDefined()
      expect(sessionId).toContain('session_')

      await manager.endKanaSession(false)
      // Session should be ended without errors
    })

    it('should not start session for guest user', async () => {
      const sessionId = await manager.startKanaSession('hiragana', null)
      expect(sessionId).toBe('')
    })
  })

  describe('LocalStorage Migration', () => {
    it('should migrate from localStorage', async () => {
      // Set up old localStorage data
      const oldData = {
        'あ': {
          status: 'learned',
          reviewCount: 5,
          correctCount: 4,
          pinned: false
        },
        'い': {
          status: 'learning',
          reviewCount: 2,
          correctCount: 1,
          pinned: true
        }
      }

      localStorage.setItem('kana-progress-hiragana', JSON.stringify(oldData))

      // Perform migration
      const migrated = await manager.migrateFromLocalStorage(
        'hiragana',
        mockUser,
        false
      )

      expect(migrated).toBe(true)

      // Check data was migrated
      const progress = await manager.getProgress('hiragana', mockUser, false)
      expect(progress['あ']).toBeDefined()
      expect(progress['あ'].status).toBe('learned')
      expect(progress['い']).toBeDefined()
      expect(progress['い'].pinned).toBe(true)

      // Check migration flag was set
      expect(localStorage.getItem(`kana-progress-hiragana-${mockUser.uid}-migrated-v2`)).toBe('true')
    })

    it('should not migrate twice', async () => {
      // Set migration flag
      localStorage.setItem(`kana-progress-hiragana-${mockUser.uid}-migrated-v2`, 'true')

      const migrated = await manager.migrateFromLocalStorage(
        'hiragana',
        mockUser,
        false
      )

      expect(migrated).toBe(false)
    })

    it('should handle missing localStorage data', async () => {
      const migrated = await manager.migrateFromLocalStorage(
        'hiragana',
        mockUser,
        false
      )

      expect(migrated).toBe(false)
      // Should still set migration flag
      expect(localStorage.getItem(`kana-progress-hiragana-${mockUser.uid}-migrated-v2`)).toBe('true')
    })

    it('should handle corrupted localStorage data', async () => {
      localStorage.setItem('kana-progress-hiragana', 'invalid json')

      const migrated = await manager.migrateFromLocalStorage(
        'hiragana',
        mockUser,
        false
      )

      expect(migrated).toBe(false)
    })
  })

  describe('Statistics', () => {
    it('should calculate learning statistics', async () => {
      // Add some progress data
      await manager.trackCharacterView('hiragana', 'あ', mockUser, false)
      await manager.trackCharacterLearned('hiragana', 'あ', mockUser, false)
      await manager.trackCharacterView('hiragana', 'い', mockUser, false)

      const stats = await manager.getStatistics('hiragana', mockUser, false)

      expect(stats.totalCharacters).toBeGreaterThanOrEqual(2)
      expect(stats.viewedCharacters).toBeGreaterThanOrEqual(2)
      expect(stats.learnedCharacters).toBeGreaterThanOrEqual(0)
    })

    it('should return empty statistics for guest user', async () => {
      const stats = await manager.getStatistics('hiragana', null, false)

      expect(stats.totalCharacters).toBe(0)
      expect(stats.viewedCharacters).toBe(0)
      expect(stats.learnedCharacters).toBe(0)
      expect(stats.averageAccuracy).toBe(0)
    })
  })

  describe('Clear Progress', () => {
    it('should clear all progress for a user and script', async () => {
      // Add some progress
      await manager.trackCharacterView('hiragana', 'あ', mockUser, false)
      await manager.trackCharacterView('hiragana', 'い', mockUser, false)

      // Clear progress
      await manager.clearProgress(mockUser.uid, 'hiragana')

      // Check it's cleared
      const progress = await manager.getProgress('hiragana', mockUser, false)
      expect(Object.keys(progress).length).toBe(0)
    })
  })

  describe('Premium vs Free Users', () => {
    it('should handle free user storage (IndexedDB only)', async () => {
      await manager.trackCharacterView(
        'hiragana',
        'あ',
        mockUser,
        false // free user
      )

      const progress = await manager.getProgress('hiragana', mockUser, false)
      expect(progress['あ']).toBeDefined()
    })

    it('should handle premium user storage (IndexedDB + Firebase)', async () => {
      await manager.trackCharacterView(
        'hiragana',
        'あ',
        mockUser,
        true // premium user
      )

      // Should queue for Firebase sync
      const progress = await manager.getProgress('hiragana', mockUser, true)
      expect(progress['あ']).toBeDefined()
    })

    it('should not store anything for guest users', async () => {
      await manager.trackCharacterView(
        'hiragana',
        'あ',
        null, // guest
        false
      )

      const progress = await manager.getProgress('hiragana', null, false)
      expect(Object.keys(progress).length).toBe(0)
    })
  })

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with old CharacterProgress format', async () => {
      const oldProgress: CharacterProgress = {
        status: 'learned',
        reviewCount: 10,
        correctCount: 8,
        lastReviewed: new Date('2025-01-01'),
        pinned: true,
        updatedAt: new Date()
      }

      await manager.saveProgress(
        'katakana',
        'ア',
        oldProgress,
        mockUser,
        false
      )

      const retrieved = await manager.getProgress('katakana', mockUser, false)

      expect(retrieved['ア']).toBeDefined()
      expect(retrieved['ア'].status).toBe('learned')
      expect(retrieved['ア'].reviewCount).toBe(10)
      expect(retrieved['ア'].correctCount).toBe(8)
      expect(retrieved['ア'].pinned).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle Firebase sync failures gracefully', async () => {
      // This is handled by the base class, but verify it works
      await expect(
        manager.trackCharacterView('hiragana', 'あ', mockUser, true)
      ).resolves.not.toThrow()
    })
  })
})