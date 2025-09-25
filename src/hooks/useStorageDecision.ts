/**
 * useStorageDecision Hook
 * Centralized hook for handling server-driven storage decisions
 * Ensures consistent storage location handling across all client components
 */

import { useCallback } from 'react'

export interface StorageLocation {
  location: 'none' | 'local' | 'both'
  syncEnabled: boolean
  plan?: string
}

export interface StorageResponse<T = any> {
  success: boolean
  data: T
  storage?: StorageLocation
}

export interface StorageDecision {
  isLocal: boolean
  shouldSync: boolean
  storageLocation: 'none' | 'local' | 'both'
  data: any
}

/**
 * Hook to handle storage decisions from API responses
 * All client components should use this instead of checking isPremium directly
 */
export function useStorageDecision() {
  /**
   * Process API response and determine storage strategy
   * @param response - API response with storage metadata
   * @returns Storage decision with location and sync flags
   */
  const handleStorageResponse = useCallback(<T = any>(response: StorageResponse<T>): StorageDecision & { data: T } => {
    const { data, storage } = response

    // Log storage decision for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('[Storage Decision]', {
        location: storage?.location || 'unknown',
        syncEnabled: storage?.syncEnabled || false,
        plan: storage?.plan || 'unknown'
      })
    }

    // Default to local storage if no storage info provided
    if (!storage || !storage.location) {
      console.warn('[Storage] No storage location in API response, defaulting to local')
      return {
        isLocal: true,
        shouldSync: false,
        storageLocation: 'local',
        data
      }
    }

    // Handle different storage locations
    switch (storage.location) {
      case 'local':
        // Free user - local storage only
        console.log('[Storage] Free user - using local storage only')
        return {
          isLocal: true,
          shouldSync: false,
          storageLocation: 'local',
          data
        }

      case 'both':
        // Premium user - both local and cloud storage
        console.log('[Storage] Premium user - syncing to cloud')
        return {
          isLocal: false,
          shouldSync: true,
          storageLocation: 'both',
          data
        }

      case 'none':
        // Guest user - no persistent storage
        console.log('[Storage] Guest user - no persistent storage')
        return {
          isLocal: false,
          shouldSync: false,
          storageLocation: 'none',
          data
        }

      default:
        // Unknown storage location - default to local
        console.warn('[Storage] Unknown storage location:', storage.location)
        return {
          isLocal: true,
          shouldSync: false,
          storageLocation: 'local',
          data
        }
    }
  }, [])

  /**
   * Check if we should save to IndexedDB
   * @param storageLocation - Storage location from API
   * @returns True if should save to IndexedDB
   */
  const shouldSaveToIndexedDB = useCallback((storageLocation: 'none' | 'local' | 'both'): boolean => {
    // Save to IndexedDB for both local and cloud storage (for offline access)
    return storageLocation === 'local' || storageLocation === 'both'
  }, [])

  /**
   * Check if data is synced to cloud
   * @param storageLocation - Storage location from API
   * @returns True if data is synced to cloud
   */
  const isCloudSynced = useCallback((storageLocation: 'none' | 'local' | 'both'): boolean => {
    return storageLocation === 'both'
  }, [])

  /**
   * Get storage location display text
   * @param storageLocation - Storage location from API
   * @returns Human-readable storage location
   */
  const getStorageDisplayText = useCallback((storageLocation: 'none' | 'local' | 'both'): string => {
    switch (storageLocation) {
      case 'local':
        return 'Local Device Only'
      case 'both':
        return 'Synced to Cloud'
      case 'none':
        return 'Session Only'
      default:
        return 'Unknown'
    }
  }, [])

  /**
   * Get storage location icon
   * @param storageLocation - Storage location from API
   * @returns Icon name for storage location
   */
  const getStorageIcon = useCallback((storageLocation: 'none' | 'local' | 'both'): string => {
    switch (storageLocation) {
      case 'local':
        return '💾' // Local storage icon
      case 'both':
        return '☁️' // Cloud sync icon
      case 'none':
        return '⏱️' // Temporary icon
      default:
        return '❓'
    }
  }, [])

  return {
    handleStorageResponse,
    shouldSaveToIndexedDB,
    isCloudSynced,
    getStorageDisplayText,
    getStorageIcon
  }
}

/**
 * Type guard to check if response has storage metadata
 */
export function hasStorageMetadata(response: any): response is StorageResponse {
  return response &&
         typeof response === 'object' &&
         'storage' in response &&
         response.storage &&
         'location' in response.storage
}

/**
 * Helper to extract storage location from response
 */
export function getStorageLocation(response: any): 'none' | 'local' | 'both' | null {
  if (!hasStorageMetadata(response)) {
    return null
  }
  return response.storage.location
}