'use client'

import { useState, useEffect } from 'react'

export interface StorageEstimate {
  usage?: number
  quota?: number
  usageDetails?: {
    indexedDB?: number
    caches?: number
    serviceWorkerRegistrations?: number
  }
}

export type StorageWarningLevel = 'none' | 'warning' | 'critical'

export interface StorageQuotaState {
  estimate: StorageEstimate | null
  warningLevel: StorageWarningLevel
  percentageUsed: number
  isLoading: boolean
  isSupported: boolean
}

/**
 * Hook for monitoring storage quota and warning users about storage pressure.
 *
 * Warning levels:
 * - none: < 80% usage
 * - warning: 80-95% usage
 * - critical: >= 95% usage
 *
 * @param checkIntervalMs - How often to check quota (default: 60000ms = 1 minute)
 * @returns Storage quota state with warning levels
 */
export function useStorageQuota(checkIntervalMs: number = 60000): StorageQuotaState {
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null)
  const [warningLevel, setWarningLevel] = useState<StorageWarningLevel>('none')
  const [percentageUsed, setPercentageUsed] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    // Check if Storage API is supported
    const supported = 'storage' in navigator && 'estimate' in navigator.storage
    setIsSupported(supported)

    if (!supported) {
      setIsLoading(false)
      return
    }

    const checkQuota = async () => {
      try {
        const storageEstimate = await navigator.storage.estimate()
        setEstimate(storageEstimate)

        if (storageEstimate.usage !== undefined && storageEstimate.quota !== undefined) {
          const percentage = (storageEstimate.usage / storageEstimate.quota) * 100
          setPercentageUsed(percentage)

          // Determine warning level
          if (percentage >= 95) {
            setWarningLevel('critical')
          } else if (percentage >= 80) {
            setWarningLevel('warning')
          } else {
            setWarningLevel('none')
          }
        }

        setIsLoading(false)
      } catch (error) {
        console.error('[useStorageQuota] Failed to check storage quota:', error)
        setIsLoading(false)
      }
    }

    // Check immediately on mount
    checkQuota()

    // Set up periodic checking
    const interval = setInterval(checkQuota, checkIntervalMs)

    return () => clearInterval(interval)
  }, [checkIntervalMs])

  return {
    estimate,
    warningLevel,
    percentageUsed,
    isLoading,
    isSupported
  }
}

/**
 * Format bytes to human-readable format
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Get storage quota summary message
 */
export function getQuotaSummary(state: StorageQuotaState): string {
  if (!state.isSupported) {
    return 'Storage quota monitoring not supported in this browser'
  }

  if (state.isLoading || !state.estimate) {
    return 'Checking storage...'
  }

  const { usage = 0, quota = 0 } = state.estimate

  return `Using ${formatBytes(usage)} of ${formatBytes(quota)} (${Math.round(state.percentageUsed)}%)`
}
