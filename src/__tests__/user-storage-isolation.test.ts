/**
 * Test suite for user data isolation
 * Verifies that user data is properly isolated in storage
 */

import { UserStorageService } from '@/lib/storage/UserStorageService'

describe('User Data Isolation', () => {
  beforeEach(() => {
    // Clear all localStorage before each test
    localStorage.clear()
  })

  describe('UserStorageService', () => {
    it('should isolate data between different users', () => {
      // Create storage for User A
      const storageA = new UserStorageService('userA')
      storageA.setItem('testKey', 'dataFromUserA')
      storageA.setItem('sharedKey', 'userAData')

      // Create storage for User B
      const storageB = new UserStorageService('userB')
      storageB.setItem('testKey', 'dataFromUserB')
      storageB.setItem('sharedKey', 'userBData')

      // Verify User A sees only their data
      expect(storageA.getItem('testKey')).toBe('dataFromUserA')
      expect(storageA.getItem('sharedKey')).toBe('userAData')

      // Verify User B sees only their data
      expect(storageB.getItem('testKey')).toBe('dataFromUserB')
      expect(storageB.getItem('sharedKey')).toBe('userBData')

      // Verify raw localStorage has user-specific keys
      expect(localStorage.getItem('moshimoshi_testKey_userA')).toBe('"dataFromUserA"')
      expect(localStorage.getItem('moshimoshi_testKey_userB')).toBe('"dataFromUserB"')
    })

    it('should return null for non-existent keys', () => {
      const storage = new UserStorageService('testUser')
      expect(storage.getItem('nonExistent')).toBeNull()
    })

    it('should handle guest users', () => {
      const guestStorage = new UserStorageService(null)
      guestStorage.setItem('guestData', 'testValue')

      // Verify guest data is stored with 'guest' suffix
      expect(localStorage.getItem('moshimoshi_guestData_guest')).toBe('"testValue"')
    })

    it('should properly serialize and deserialize objects', () => {
      const storage = new UserStorageService('userC')
      const testObject = {
        name: 'Test User',
        settings: {
          theme: 'dark',
          language: 'en'
        },
        scores: [10, 20, 30]
      }

      storage.setItem('complexData', testObject)
      const retrieved = storage.getItem('complexData')

      expect(retrieved).toEqual(testObject)
    })

    it('should handle removal of items', () => {
      const storage = new UserStorageService('userD')
      storage.setItem('toRemove', 'someValue')

      expect(storage.getItem('toRemove')).toBe('someValue')

      storage.removeItem('toRemove')
      expect(storage.getItem('toRemove')).toBeNull()
    })

    it('should clear only current user data', () => {
      // Set data for multiple users
      const storageA = new UserStorageService('userA')
      const storageB = new UserStorageService('userB')

      storageA.setItem('dataA1', 'valueA1')
      storageA.setItem('dataA2', 'valueA2')
      storageB.setItem('dataB1', 'valueB1')

      // Clear User A's data
      storageA.clearUserData()

      // Verify User A's data is gone
      expect(storageA.getItem('dataA1')).toBeNull()
      expect(storageA.getItem('dataA2')).toBeNull()

      // Verify User B's data still exists
      expect(storageB.getItem('dataB1')).toBe('valueB1')
    })

    it('should correctly report user keys', () => {
      const storage = new UserStorageService('userE')
      storage.setItem('key1', 'value1')
      storage.setItem('key2', 'value2')
      storage.setItem('key3', 'value3')

      const keys = storage.getUserKeys()
      expect(keys).toContain('key1')
      expect(keys).toContain('key2')
      expect(keys).toContain('key3')
      expect(keys).toHaveLength(3)
    })

    it('should correctly check if items exist', () => {
      const storage = new UserStorageService('userF')
      storage.setItem('existingKey', 'value')

      expect(storage.hasItem('existingKey')).toBe(true)
      expect(storage.hasItem('nonExistingKey')).toBe(false)
    })

    it('should handle migration of legacy data', () => {
      // Set legacy non-user-specific data
      localStorage.setItem('currentStreak', '10')
      localStorage.setItem('bestStreak', '20')
      localStorage.setItem('kanjiMasteryProgress', JSON.stringify({ level: 5 }))

      const storage = new UserStorageService('userMigration')

      // Migrate old data
      storage.migrateOldData(['currentStreak', 'bestStreak', 'kanjiMasteryProgress'])

      // Verify data is now user-specific
      expect(storage.getItem('currentStreak')).toBe('10')
      expect(storage.getItem('bestStreak')).toBe('20')
      expect(storage.getItem('kanjiMasteryProgress')).toEqual({ level: 5 })

      // Verify old keys are removed
      expect(localStorage.getItem('currentStreak')).toBeNull()
      expect(localStorage.getItem('bestStreak')).toBeNull()
      expect(localStorage.getItem('kanjiMasteryProgress')).toBeNull()
    })
  })

  describe('Critical User Data Isolation Scenarios', () => {
    it('should not leak streak data between users', () => {
      // User A sets their streak
      const storageA = new UserStorageService('userA')
      storageA.setItem('currentStreak', 15)
      storageA.setItem('bestStreak', 30)

      // User B logs in and sets their streak
      const storageB = new UserStorageService('userB')
      storageB.setItem('currentStreak', 5)
      storageB.setItem('bestStreak', 10)

      // Verify no data leakage
      expect(storageA.getItem('currentStreak')).toBe(15)
      expect(storageA.getItem('bestStreak')).toBe(30)
      expect(storageB.getItem('currentStreak')).toBe(5)
      expect(storageB.getItem('bestStreak')).toBe(10)
    })

    it('should not leak kanji progress between users', () => {
      const storageA = new UserStorageService('userA')
      const progressA = {
        totalStudied: 100,
        totalMastered: 50,
        averageAccuracy: 85
      }
      storageA.setItem('kanjiMasteryProgress', progressA)

      const storageB = new UserStorageService('userB')
      const progressB = {
        totalStudied: 10,
        totalMastered: 2,
        averageAccuracy: 60
      }
      storageB.setItem('kanjiMasteryProgress', progressB)

      expect(storageA.getItem('kanjiMasteryProgress')).toEqual(progressA)
      expect(storageB.getItem('kanjiMasteryProgress')).toEqual(progressB)
    })

    it('should not leak notification settings between users', () => {
      const storageA = new UserStorageService('userA')
      const notificationsA = [
        { itemId: 'item1', dueDate: '2025-01-23T10:00:00Z' },
        { itemId: 'item2', dueDate: '2025-01-23T14:00:00Z' }
      ]
      storageA.setItem('review_countdowns', notificationsA)

      const storageB = new UserStorageService('userB')
      const notificationsB = [
        { itemId: 'item3', dueDate: '2025-01-24T09:00:00Z' }
      ]
      storageB.setItem('review_countdowns', notificationsB)

      expect(storageA.getItem('review_countdowns')).toEqual(notificationsA)
      expect(storageB.getItem('review_countdowns')).toEqual(notificationsB)
    })

    it('should not leak learning village state between users', () => {
      const storageA = new UserStorageService('userA')
      const villageA = {
        stalls: [['hiragana', { progress: 100 }]],
        overallProgress: 50,
        unlockedStalls: ['hiragana', 'katakana'],
        nextUnlock: 'kanji'
      }
      storageA.setItem('learningVillageState', villageA)

      const storageB = new UserStorageService('userB')
      const villageB = {
        stalls: [['hiragana', { progress: 20 }]],
        overallProgress: 10,
        unlockedStalls: ['hiragana'],
        nextUnlock: 'katakana'
      }
      storageB.setItem('learningVillageState', villageB)

      expect(storageA.getItem('learningVillageState')).toEqual(villageA)
      expect(storageB.getItem('learningVillageState')).toEqual(villageB)
    })
  })

  describe('Storage Size Management', () => {
    it('should calculate user storage size correctly', () => {
      const storage = new UserStorageService('sizeTestUser')

      // Add some data
      storage.setItem('smallData', 'test')
      storage.setItem('mediumData', 'a'.repeat(100))
      storage.setItem('largeData', 'b'.repeat(1000))

      const size = storage.getUserStorageSize()

      // Size should be greater than 0 and include keys + values
      expect(size).toBeGreaterThan(1000)
      expect(size).toBeLessThan(2000)
    })
  })
})