'use client'

import { useState, useEffect, useCallback } from 'react'
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore'
import { firestore } from '@/lib/firebase/client'
import {
  LearningVillageConfig,
  StallConfig,
  DEFAULT_CONFIG,
  mergeWithDefaults,
  StallId
} from '@/config/learning-village-types'

interface UseLearningVillageConfigReturn {
  config: LearningVillageConfig
  loading: boolean
  error: string | null
  isPopular: (stallId: StallId) => boolean
  getStallOrder: (stallId: StallId) => number
  isStallEnabled: (stallId: StallId) => boolean
  sortedStallIds: StallId[]
  refetch: () => Promise<void>
}

/**
 * Hook to fetch and listen to Learning Village configuration
 * Uses Firestore real-time listener for instant updates
 */
export function useLearningVillageConfig(): UseLearningVillageConfigReturn {
  const [config, setConfig] = useState<LearningVillageConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch via API (fallback)
  const fetchFromAPI = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/learning-village')
      const data = await response.json()

      if (data.success && data.config) {
        setConfig(mergeWithDefaults(data.config))
        setError(null)
      } else {
        setConfig(DEFAULT_CONFIG)
      }
    } catch (err) {
      console.error('[useLearningVillageConfig] API fetch error:', err)
      setConfig(DEFAULT_CONFIG)
    } finally {
      setLoading(false)
    }
  }, [])

  // Set up real-time Firestore listener
  useEffect(() => {
    let unsubscribe: Unsubscribe | null = null

    const setupListener = () => {
      try {
        const configRef = doc(firestore, 'config', 'learningVillage')

        unsubscribe = onSnapshot(
          configRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data() as Partial<LearningVillageConfig>
              setConfig(mergeWithDefaults(data))
              setError(null)
            } else {
              // No config in Firestore, use defaults
              setConfig(DEFAULT_CONFIG)
            }
            setLoading(false)
          },
          (err) => {
            console.error('[useLearningVillageConfig] Firestore listener error:', err)
            setError('Failed to load configuration')
            // Fallback to API fetch
            fetchFromAPI()
          }
        )
      } catch (err) {
        console.error('[useLearningVillageConfig] Error setting up listener:', err)
        // Fallback to API fetch
        fetchFromAPI()
      }
    }

    setupListener()

    // Cleanup
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [fetchFromAPI])

  // Helper: Check if a stall is popular
  const isPopular = useCallback((stallId: StallId): boolean => {
    const stallConfig = config.stalls.find(s => s.id === stallId)
    return stallConfig?.isPopular ?? false
  }, [config.stalls])

  // Helper: Get stall order
  const getStallOrder = useCallback((stallId: StallId): number => {
    const stallConfig = config.stalls.find(s => s.id === stallId)
    return stallConfig?.order ?? 999
  }, [config.stalls])

  // Helper: Check if stall is enabled
  const isStallEnabled = useCallback((stallId: StallId): boolean => {
    const stallConfig = config.stalls.find(s => s.id === stallId)
    return stallConfig?.enabled ?? true
  }, [config.stalls])

  // Get sorted stall IDs
  const sortedStallIds = [...config.stalls]
    .sort((a, b) => a.order - b.order)
    .map(s => s.id) as StallId[]

  return {
    config,
    loading,
    error,
    isPopular,
    getStallOrder,
    isStallEnabled,
    sortedStallIds,
    refetch: fetchFromAPI
  }
}

/**
 * Admin hook for managing Learning Village configuration
 * Provides update functionality
 */
interface UseAdminLearningVillageConfigReturn extends UseLearningVillageConfigReturn {
  updateConfig: (stalls: StallConfig[]) => Promise<boolean>
  resetToDefaults: () => Promise<boolean>
  saving: boolean
}

export function useAdminLearningVillageConfig(): UseAdminLearningVillageConfigReturn {
  const baseHook = useLearningVillageConfig()
  const [saving, setSaving] = useState(false)

  const updateConfig = useCallback(async (stalls: StallConfig[]): Promise<boolean> => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/learning-village', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stalls })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        console.error('[useAdminLearningVillageConfig] Update failed:', data.error)
        return false
      }

      return true
    } catch (err) {
      console.error('[useAdminLearningVillageConfig] Update error:', err)
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  const resetToDefaults = useCallback(async (): Promise<boolean> => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/learning-village', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        console.error('[useAdminLearningVillageConfig] Reset failed:', data.error)
        return false
      }

      return true
    } catch (err) {
      console.error('[useAdminLearningVillageConfig] Reset error:', err)
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  return {
    ...baseHook,
    updateConfig,
    resetToDefaults,
    saving
  }
}
