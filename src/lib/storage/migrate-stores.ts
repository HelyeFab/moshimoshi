/**
 * Migration utility for Zustand stores
 * Moves data from old non-user-specific keys to new user-specific keys
 *
 * SECURITY: This ensures old data is properly migrated and cleaned up
 */

import { UserStorageService } from './UserStorageService'

/**
 * Migrate all Zustand stores for a specific user
 * This should be called once when a user logs in
 */
export async function migrateUserStores(userId: string): Promise<void> {
  if (!userId || typeof window === 'undefined') return

  const storage = new UserStorageService(userId)

  // Check if migration has already been done for this user
  const migrationKey = `moshimoshi_stores_migrated_v1_${userId}`

  if (localStorage.getItem(migrationKey)) {
    // Migration already done
    return
  }

  console.log(`[StoreMigration] Starting migration for user ${userId}`)

  // List of stores to migrate
  const storesToMigrate = [
    'streak-storage',
    'achievement-store',
    'pin-store'
  ]

  let migratedCount = 0

  storesToMigrate.forEach(storeName => {
    try {
      // Check if old data exists
      const oldData = localStorage.getItem(storeName)

      if (oldData) {
        console.log(`[StoreMigration] Found old data for ${storeName}`)

        // Parse the old data to check if it belongs to this user
        try {
          const parsedData = JSON.parse(oldData)

          // For achievement-store, check if currentUserId matches
          if (storeName === 'achievement-store' && parsedData.state?.currentUserId) {
            if (parsedData.state.currentUserId !== userId) {
              console.log(`[StoreMigration] Skipping ${storeName} - belongs to different user`)
              return
            }
          }

          // Save to new user-specific location
          storage.setItem(storeName, oldData)
          migratedCount++

          console.log(`[StoreMigration] Migrated ${storeName} to user-specific key`)
        } catch (parseError) {
          // If we can't parse it, still migrate it
          storage.setItem(storeName, oldData)
          migratedCount++
          console.log(`[StoreMigration] Migrated unparseable ${storeName} to user-specific key`)
        }

        // Remove old non-user-specific data
        localStorage.removeItem(storeName)
      }
    } catch (error) {
      console.error(`[StoreMigration] Failed to migrate ${storeName}:`, error)
    }
  })

  // Mark migration as complete
  localStorage.setItem(migrationKey, new Date().toISOString())

  console.log(`[StoreMigration] Migration complete. Migrated ${migratedCount} stores.`)
}

/**
 * Clean up all non-user-specific store data
 * This should be called on logout or when switching users
 */
export function cleanupNonUserSpecificStores(): void {
  if (typeof window === 'undefined') return

  const storesToClean = [
    'streak-storage',
    'achievement-store',
    'pin-store'
  ]

  storesToClean.forEach(storeName => {
    if (localStorage.getItem(storeName)) {
      localStorage.removeItem(storeName)
      console.log(`[StoreCleanup] Removed non-user-specific store: ${storeName}`)
    }
  })
}

/**
 * Get all localStorage keys that might contain user data
 * Useful for debugging and cleanup
 */
export function getAllUserDataKeys(): {
  nonUserSpecific: string[],
  userSpecific: string[],
  unknown: string[]
} {
  if (typeof window === 'undefined') {
    return { nonUserSpecific: [], userSpecific: [], unknown: [] }
  }

  const nonUserSpecific: string[] = []
  const userSpecific: string[] = []
  const unknown: string[] = []

  const knownStores = ['streak-storage', 'achievement-store', 'pin-store']
  const userSpecificPattern = /^moshimoshi_.*_[a-zA-Z0-9]+$/

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)

    if (!key) continue

    if (knownStores.includes(key)) {
      nonUserSpecific.push(key)
    } else if (userSpecificPattern.test(key)) {
      userSpecific.push(key)
    } else if (key.startsWith('moshimoshi')) {
      unknown.push(key)
    }
  }

  return { nonUserSpecific, userSpecific, unknown }
}

/**
 * Debug function to check for data leakage
 * Returns any non-user-specific store data found
 */
export function checkForDataLeakage(): Record<string, any> {
  if (typeof window === 'undefined') {
    return {}
  }

  const leakedData: Record<string, any> = {}
  const storesToCheck = ['streak-storage', 'achievement-store', 'pin-store']

  storesToCheck.forEach(storeName => {
    const data = localStorage.getItem(storeName)
    if (data) {
      try {
        leakedData[storeName] = JSON.parse(data)
      } catch {
        leakedData[storeName] = data
      }
    }
  })

  if (Object.keys(leakedData).length > 0) {
    console.warn('[DataLeakage] Found non-user-specific store data:', leakedData)
  }

  return leakedData
}