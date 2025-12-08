'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  LearningVillageConfig,
  StallConfig,
  DEFAULT_CONFIG,
  mergeWithDefaults,
  StallId,
} from '@/config/learning-village-types'

// LocalStorage key for offline caching
const STORAGE_KEY = 'moshimoshi_learning_village_config'

interface UseLearningVillageConfigReturn {
  config: LearningVillageConfig
  loading: boolean
  error: string | null
  isOffline: boolean
  isPopular: (stallId: StallId) => boolean
  getStallOrder: (stallId: StallId) => number
  isStallEnabled: (stallId: StallId) => boolean
  sortedStallIds: StallId[]
  refetch: () => Promise<void>
}

/**
 * Get cached config from localStorage (for offline support)
 */
function getCachedConfig(): LearningVillageConfig | null {
  if (typeof window === 'undefined') return null

  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      console.log('[useLearningVillageConfig] Loaded cached config from localStorage')
      return mergeWithDefaults(parsed)
    }
  } catch (err) {
    console.warn('[useLearningVillageConfig] Failed to parse cached config:', err)
  }
  return null
}

/**
 * Save config to localStorage (for offline support)
 */
function setCachedConfig(config: LearningVillageConfig): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    console.log('[useLearningVillageConfig] Saved config to localStorage for offline use')
  } catch (err) {
    console.warn('[useLearningVillageConfig] Failed to cache config:', err)
  }
}

/**
 * Hook to fetch Learning Village configuration
 * Uses API route (server-side Firebase Admin SDK) - follows app-wide pattern
 *
 * Offline Support:
 * - Caches successful API responses to localStorage
 * - Falls back to cached config when offline
 * - Uses DEFAULT_CONFIG if no cache available
 */
export function useLearningVillageConfig(): UseLearningVillageConfigReturn {
  // Try to load cached config first for instant display
  const [config, setConfig] = useState<LearningVillageConfig>(() => {
    return getCachedConfig() || DEFAULT_CONFIG
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOffline, setIsOffline] = useState(false)

  // Fetch via API (uses Firebase Admin SDK on server)
  const fetchFromAPI = useCallback(async () => {
    try {
      setLoading(true)
      setIsOffline(false)

      const response = await fetch('/api/admin/learning-village')
      const data = await response.json()

      if (data.success && data.config) {
        const mergedConfig = mergeWithDefaults(data.config)
        setConfig(mergedConfig)
        setError(null)
        // Cache successful response for offline use
        setCachedConfig(mergedConfig)
      } else {
        console.warn('[useLearningVillageConfig] API returned no config, using defaults')
        setConfig(DEFAULT_CONFIG)
      }
    } catch (err) {
      console.error('[useLearningVillageConfig] API fetch error:', err)
      setError('Failed to load configuration')
      setIsOffline(true)

      // Try localStorage cache first, then fall back to DEFAULT_CONFIG
      const cachedConfig = getCachedConfig()
      if (cachedConfig) {
        console.log('[useLearningVillageConfig] Using cached config (offline mode)')
        setConfig(cachedConfig)
      } else {
        console.log('[useLearningVillageConfig] No cache available, using defaults')
        setConfig(DEFAULT_CONFIG)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchFromAPI()
  }, [fetchFromAPI])

  // Helper: Check if a stall is popular
  const isPopular = useCallback(
    (stallId: StallId): boolean => {
      const stallConfig = config.stalls.find(s => s.id === stallId)
      return stallConfig?.isPopular ?? false
    },
    [config.stalls]
  )

  // Helper: Get stall order
  const getStallOrder = useCallback(
    (stallId: StallId): number => {
      const stallConfig = config.stalls.find(s => s.id === stallId)
      return stallConfig?.order ?? 999
    },
    [config.stalls]
  )

  // Helper: Check if stall is enabled
  const isStallEnabled = useCallback(
    (stallId: StallId): boolean => {
      const stallConfig = config.stalls.find(s => s.id === stallId)
      return stallConfig?.enabled ?? true
    },
    [config.stalls]
  )

  // Get sorted stall IDs (memoized)
  const sortedStallIds = useMemo(
    () => [...config.stalls].sort((a, b) => a.order - b.order).map(s => s.id) as StallId[],
    [config.stalls]
  )

  return {
    config,
    loading,
    error,
    isOffline,
    isPopular,
    getStallOrder,
    isStallEnabled,
    sortedStallIds,
    refetch: fetchFromAPI,
  }
}

/**
 * Admin hook for managing Learning Village configuration
 * Provides update functionality and auto-refetch after changes
 */
interface UseAdminLearningVillageConfigReturn extends UseLearningVillageConfigReturn {
  updateConfig: (stalls: StallConfig[]) => Promise<boolean>
  resetToDefaults: () => Promise<boolean>
  saving: boolean
}

export function useAdminLearningVillageConfig(): UseAdminLearningVillageConfigReturn {
  const baseHook = useLearningVillageConfig()
  const [saving, setSaving] = useState(false)

  const updateConfig = useCallback(
    async (stalls: StallConfig[]): Promise<boolean> => {
      setSaving(true)
      try {
        const response = await fetch('/api/admin/learning-village', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stalls }),
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
          console.error('[useAdminLearningVillageConfig] Update failed:', data.error)
          return false
        }

        // Refetch to get updated config
        await baseHook.refetch()
        return true
      } catch (err) {
        console.error('[useAdminLearningVillageConfig] Update error:', err)
        return false
      } finally {
        setSaving(false)
      }
    },
    [baseHook]
  )

  const resetToDefaults = useCallback(async (): Promise<boolean> => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/learning-village', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        console.error('[useAdminLearningVillageConfig] Reset failed:', data.error)
        return false
      }

      // Refetch to get updated config
      await baseHook.refetch()
      return true
    } catch (err) {
      console.error('[useAdminLearningVillageConfig] Reset error:', err)
      return false
    } finally {
      setSaving(false)
    }
  }, [baseHook])

  return {
    ...baseHook,
    updateConfig,
    resetToDefaults,
    saving,
  }
}
