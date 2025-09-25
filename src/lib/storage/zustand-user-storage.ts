/**
 * Zustand storage adapter that uses UserStorageService
 * This ensures all Zustand stores use user-specific keys
 *
 * SECURITY: Prevents data leakage between users by scoping localStorage keys per user
 */

import { StateStorage } from 'zustand/middleware'
import { UserStorageService } from './UserStorageService'

/**
 * Create a user-specific storage adapter for Zustand
 * This adapter automatically handles user switching and data isolation
 */
export function createUserStorage(storeName: string): StateStorage {
  // We'll get the user ID dynamically on each operation
  // This ensures we always use the current user's ID

  return {
    getItem: (name: string): string | null => {
      // Get current user ID from auth storage
      let userId: string | null = null

      try {
        const authData = localStorage.getItem('auth-user')
        if (authData) {
          const user = JSON.parse(authData)
          userId = user?.uid || null
        }
      } catch {
        // Ignore parse errors
      }

      // Create service with current user ID
      const storage = new UserStorageService(userId)

      // Use the store name as the key (Zustand will pass the name we provide)
      const value = storage.getItem(storeName)

      // Zustand expects a string, so ensure we return string or null
      if (value === null || value === undefined) {
        return null
      }

      // If it's already a string, return it
      if (typeof value === 'string') {
        return value
      }

      // Otherwise stringify it
      return JSON.stringify(value)
    },

    setItem: (name: string, value: string): void => {
      // Get current user ID from auth storage
      let userId: string | null = null

      try {
        const authData = localStorage.getItem('auth-user')
        if (authData) {
          const user = JSON.parse(authData)
          userId = user?.uid || null
        }
      } catch {
        // Ignore parse errors
      }

      // Create service with current user ID
      const storage = new UserStorageService(userId)

      // Store the value
      storage.setItem(storeName, value)
    },

    removeItem: (name: string): void => {
      // Get current user ID from auth storage
      let userId: string | null = null

      try {
        const authData = localStorage.getItem('auth-user')
        if (authData) {
          const user = JSON.parse(authData)
          userId = user?.uid || null
        }
      } catch {
        // Ignore parse errors
      }

      // Create service with current user ID
      const storage = new UserStorageService(userId)

      // Remove the item
      storage.removeItem(storeName)
    }
  }
}

/**
 * Migration helper to move data from old non-user-specific keys
 * Call this when a user logs in to migrate their old data
 */
export async function migrateZustandStores(userId: string): Promise<void> {
  const storage = new UserStorageService(userId)

  // List of stores that need migration
  const storesToMigrate = [
    'streak-storage',
    'achievement-store',
    'pin-store'
  ]

  storesToMigrate.forEach(storeName => {
    try {
      // Check if old data exists
      const oldData = localStorage.getItem(storeName)

      if (oldData) {
        console.log(`[Migration] Found old data for ${storeName}, migrating to user-specific key`)

        // Save to new user-specific location
        storage.setItem(storeName, oldData)

        // Remove old non-user-specific data
        localStorage.removeItem(storeName)

        console.log(`[Migration] Successfully migrated ${storeName}`)
      }
    } catch (error) {
      console.error(`[Migration] Failed to migrate ${storeName}:`, error)
    }
  })
}

/**
 * Clean up any non-user-specific Zustand store data
 * This should be called on logout to prevent data leakage
 */
export function cleanupNonUserSpecificStores(): void {
  const storesToClean = [
    'streak-storage',
    'achievement-store',
    'pin-store'
  ]

  storesToClean.forEach(storeName => {
    try {
      if (localStorage.getItem(storeName)) {
        localStorage.removeItem(storeName)
        console.log(`[Cleanup] Removed non-user-specific store: ${storeName}`)
      }
    } catch (error) {
      console.error(`[Cleanup] Failed to clean ${storeName}:`, error)
    }
  })
}