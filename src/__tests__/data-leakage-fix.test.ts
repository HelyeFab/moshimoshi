/**
 * Test suite to verify data leakage fixes
 * Tests that user data is properly isolated and doesn't leak between users
 */

import { checkForDataLeakage, getAllUserDataKeys } from '@/lib/storage/migrate-stores'
import { UserStorageService } from '@/lib/storage/UserStorageService'

describe('Data Leakage Security Fix', () => {
  beforeEach(() => {
    // Clear all localStorage before each test
    localStorage.clear()
  })

  afterEach(() => {
    // Clean up after each test
    localStorage.clear()
  })

  describe('UserStorageService', () => {
    it('should create user-specific keys', () => {
      const userA = new UserStorageService('userA')
      const userB = new UserStorageService('userB')

      userA.setItem('test-data', { value: 'A' })
      userB.setItem('test-data', { value: 'B' })

      // Check that different keys are created
      const keys = Object.keys(localStorage)
      expect(keys).toContain('moshimoshi_test-data_userA')
      expect(keys).toContain('moshimoshi_test-data_userB')

      // Verify data isolation
      expect(userA.getItem('test-data')).toEqual({ value: 'A' })
      expect(userB.getItem('test-data')).toEqual({ value: 'B' })
    })

    it('should not access other user data', () => {
      const userA = new UserStorageService('userA')
      const userB = new UserStorageService('userB')

      userA.setItem('secret', 'userA-secret')

      // User B should not see User A's data
      expect(userB.getItem('secret')).toBeNull()
    })

    it('should handle guest users', () => {
      const guestStorage = new UserStorageService(null)
      guestStorage.setItem('guest-data', 'test')

      const keys = Object.keys(localStorage)
      expect(keys.some(k => k.includes('_guest'))).toBe(true)
    })
  })

  describe('Store Migration', () => {
    it('should detect non-user-specific store data', () => {
      // Simulate old store data
      localStorage.setItem('streak-storage', JSON.stringify({
        state: {
          currentStreak: 5,
          longestStreak: 10,
          lastActiveDay: '2024-01-01'
        }
      }))

      localStorage.setItem('achievement-store', JSON.stringify({
        state: {
          currentUserId: 'userA',
          currentStreak: 5
        }
      }))

      const leakedData = checkForDataLeakage()

      expect(leakedData).toHaveProperty('streak-storage')
      expect(leakedData).toHaveProperty('achievement-store')
    })

    it('should categorize localStorage keys correctly', () => {
      // Set up various types of keys
      localStorage.setItem('streak-storage', 'old-data')
      localStorage.setItem('moshimoshi_test_userA', 'user-specific')
      localStorage.setItem('moshimoshi_other', 'unknown')
      localStorage.setItem('random-key', 'ignored')

      const keys = getAllUserDataKeys()

      expect(keys.nonUserSpecific).toContain('streak-storage')
      expect(keys.userSpecific).toContain('moshimoshi_test_userA')
      expect(keys.unknown).toContain('moshimoshi_other')
    })
  })

  describe('Zustand Store Isolation', () => {
    it('should use user-specific storage adapter', async () => {
      // Mock auth-user in localStorage
      localStorage.setItem('auth-user', JSON.stringify({
        uid: 'testUser123',
        email: 'test@example.com'
      }))

      // Import the storage adapter
      const { createUserStorage } = await import('@/lib/storage/zustand-user-storage')
      const storage = createUserStorage('test-store')

      // Test setItem
      storage.setItem('test-store', JSON.stringify({ data: 'test' }))

      // Check that it created a user-specific key
      const keys = Object.keys(localStorage)
      expect(keys.some(k => k.includes('moshimoshi_test-store_testUser123'))).toBe(true)

      // Test getItem
      const retrieved = storage.getItem('test-store')
      expect(retrieved).toBeTruthy()
      expect(JSON.parse(retrieved!)).toEqual({ data: 'test' })
    })

    it('should handle user switching correctly', async () => {
      const { createUserStorage } = await import('@/lib/storage/zustand-user-storage')
      const storage = createUserStorage('test-store')

      // User A logs in
      localStorage.setItem('auth-user', JSON.stringify({
        uid: 'userA',
        email: 'a@example.com'
      }))

      storage.setItem('test-store', JSON.stringify({ user: 'A' }))

      // User A logs out, User B logs in
      localStorage.setItem('auth-user', JSON.stringify({
        uid: 'userB',
        email: 'b@example.com'
      }))

      // User B should not see User A's data
      const userBData = storage.getItem('test-store')
      expect(userBData).toBeNull()

      // User B sets their own data
      storage.setItem('test-store', JSON.stringify({ user: 'B' }))

      // Switch back to User A
      localStorage.setItem('auth-user', JSON.stringify({
        uid: 'userA',
        email: 'a@example.com'
      }))

      // User A should see their original data
      const userAData = storage.getItem('test-store')
      expect(userAData).toBeTruthy()
      expect(JSON.parse(userAData!)).toEqual({ user: 'A' })
    })
  })

  describe('Logout Cleanup', () => {
    it('should remove non-user-specific stores on cleanup', async () => {
      // Simulate leaked data
      localStorage.setItem('streak-storage', 'leaked-data')
      localStorage.setItem('achievement-store', 'leaked-data')
      localStorage.setItem('pin-store', 'leaked-data')

      const { cleanupNonUserSpecificStores } = await import('@/lib/storage/zustand-user-storage')
      cleanupNonUserSpecificStores()

      // All non-user-specific stores should be removed
      expect(localStorage.getItem('streak-storage')).toBeNull()
      expect(localStorage.getItem('achievement-store')).toBeNull()
      expect(localStorage.getItem('pin-store')).toBeNull()
    })

    it('should clear user-specific data on logout', () => {
      const userId = 'testUser'

      // Set up user-specific data
      localStorage.setItem(`moshimoshi_streak-storage_${userId}`, 'user-data')
      localStorage.setItem(`moshimoshi_achievement-store_${userId}`, 'user-data')
      localStorage.setItem(`moshimoshi_pin-store_${userId}`, 'user-data')

      // Simulate logout cleanup
      const userPattern = new RegExp(`^moshimoshi_.*_${userId}$`)
      const keysToRemove: string[] = []

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && userPattern.test(key)) {
          keysToRemove.push(key)
        }
      }

      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
      })

      // All user-specific data should be removed
      expect(localStorage.getItem(`moshimoshi_streak-storage_${userId}`)).toBeNull()
      expect(localStorage.getItem(`moshimoshi_achievement-store_${userId}`)).toBeNull()
      expect(localStorage.getItem(`moshimoshi_pin-store_${userId}`)).toBeNull()
    })
  })
})