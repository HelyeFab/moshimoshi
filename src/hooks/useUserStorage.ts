/**
 * React hook for user-specific localStorage
 *
 * This hook ensures all localStorage data is properly isolated per user
 * to prevent data leakage between users on the same browser
 */

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { UserStorageService, LEGACY_STORAGE_KEYS } from '@/lib/storage/UserStorageService'

interface UseUserStorageOptions {
  autoMigrate?: boolean // Automatically migrate old data
  cleanupOrphans?: boolean // Clean up data from other users
}

export function useUserStorage(options: UseUserStorageOptions = {}) {
  const { autoMigrate = true, cleanupOrphans = false } = options
  const { user } = useAuth()
  const [storage, setStorage] = useState<UserStorageService | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [migrationComplete, setMigrationComplete] = useState(false)
  const lastUserIdRef = useRef<string | null>(null)

  // Initialize storage when user changes
  useEffect(() => {
    const userId = user?.uid || null

    // Only reinitialize if user changed
    if (userId === lastUserIdRef.current && storage) {
      return
    }

    lastUserIdRef.current = userId

    // Create new storage instance
    const newStorage = new UserStorageService(userId)
    setStorage(newStorage)

    // Perform migration if needed
    if (userId && autoMigrate) {
      const migrationKey = `moshimoshi_migration_v2_complete_${userId}`

      if (!localStorage.getItem(migrationKey)) {
        console.log(`[useUserStorage] Starting migration for user ${userId}`)

        // Migrate legacy keys
        newStorage.migrateOldData(LEGACY_STORAGE_KEYS)

        // Mark migration as complete
        localStorage.setItem(migrationKey, 'true')
        localStorage.setItem(`${migrationKey}_date`, new Date().toISOString())

        setMigrationComplete(true)
        console.log('[useUserStorage] Migration completed')
      } else {
        setMigrationComplete(true)
      }
    }

    // Clean up orphaned data if requested
    if (userId && cleanupOrphans) {
      cleanupOrphanedUserData(userId)
    }

    setIsReady(true)
  }, [user, autoMigrate, cleanupOrphans])

  /**
   * Set an item with user-specific key
   */
  const setItem = useCallback((key: string, value: any) => {
    if (!storage) {
      console.warn('[useUserStorage] Storage not initialized')
      return
    }
    storage.setItem(key, value)
  }, [storage])

  /**
   * Get an item with user-specific key
   */
  const getItem = useCallback(<T = any>(key: string, defaultValue?: T): T | null => {
    if (!storage) {
      console.warn('[useUserStorage] Storage not initialized')
      return defaultValue || null
    }
    return storage.getItem<T>(key, defaultValue)
  }, [storage])

  /**
   * Remove an item
   */
  const removeItem = useCallback((key: string) => {
    if (!storage) {
      console.warn('[useUserStorage] Storage not initialized')
      return
    }
    storage.removeItem(key)
  }, [storage])

  /**
   * Check if an item exists
   */
  const hasItem = useCallback((key: string): boolean => {
    if (!storage) {
      return false
    }
    return storage.hasItem(key)
  }, [storage])

  /**
   * Clear all user data
   */
  const clearUserData = useCallback(() => {
    if (!storage) {
      console.warn('[useUserStorage] Storage not initialized')
      return
    }
    storage.clearUserData()
  }, [storage])

  /**
   * Get all keys for current user
   */
  const getUserKeys = useCallback((): string[] => {
    if (!storage) {
      return []
    }
    return storage.getUserKeys()
  }, [storage])

  /**
   * Get storage size for current user
   */
  const getUserStorageSize = useCallback((): number => {
    if (!storage) {
      return 0
    }
    return storage.getUserStorageSize()
  }, [storage])

  return {
    // Storage operations
    setItem,
    getItem,
    removeItem,
    hasItem,
    clearUserData,
    getUserKeys,
    getUserStorageSize,

    // Status
    isReady,
    migrationComplete,
    userId: user?.uid || null,

    // Direct storage access if needed
    storage,
  }
}

/**
 * Clean up orphaned data from other users
 */
function cleanupOrphanedUserData(currentUserId: string) {
  if (typeof window === 'undefined') return

  const keysToRemove: string[] = []
  const userPattern = /_([a-zA-Z0-9]+)$/

  // Find all moshimoshi keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)

    if (key && key.startsWith('moshimoshi_')) {
      const match = key.match(userPattern)

      if (match && match[1] && match[1] !== currentUserId) {
        // This is data from a different user
        keysToRemove.push(key)
      }
    }
  }

  // Remove orphaned keys
  if (keysToRemove.length > 0) {
    console.log(`[useUserStorage] Removing ${keysToRemove.length} orphaned keys from other users`)
    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
    })
  }
}

/**
 * Hook for specific storage keys with automatic user isolation
 */
export function useUserStorageItem<T = any>(
  key: string,
  defaultValue?: T
): [T | null, (value: T) => void, () => void] {
  const { getItem, setItem, removeItem } = useUserStorage()
  const [value, setValue] = useState<T | null>(() => getItem<T>(key, defaultValue))

  // Update value when it changes in storage
  useEffect(() => {
    const storedValue = getItem<T>(key, defaultValue)
    setValue(storedValue)
  }, [key, getItem, defaultValue])

  // Set value function
  const updateValue = useCallback((newValue: T) => {
    setItem(key, newValue)
    setValue(newValue)
  }, [key, setItem])

  // Remove value function
  const deleteValue = useCallback(() => {
    removeItem(key)
    setValue(defaultValue || null)
  }, [key, removeItem, defaultValue])

  return [value, updateValue, deleteValue]
}

/**
 * Migration status hook
 */
export function useStorageMigrationStatus() {
  const { user } = useAuth()
  const [status, setStatus] = useState({
    needsMigration: false,
    isComplete: false,
    userId: null as string | null,
    legacyKeysFound: 0,
  })

  useEffect(() => {
    if (!user?.uid) {
      setStatus({
        needsMigration: false,
        isComplete: false,
        userId: null,
        legacyKeysFound: 0,
      })
      return
    }

    const migrationKey = `moshimoshi_migration_v2_complete_${user.uid}`
    const isComplete = localStorage.getItem(migrationKey) === 'true'

    // Check for legacy keys
    let legacyCount = 0
    LEGACY_STORAGE_KEYS.forEach(key => {
      if (localStorage.getItem(key) !== null) {
        legacyCount++
      }
    })

    setStatus({
      needsMigration: legacyCount > 0 && !isComplete,
      isComplete,
      userId: user.uid,
      legacyKeysFound: legacyCount,
    })
  }, [user])

  return status
}