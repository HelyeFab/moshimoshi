/**
 * useMonitoringData Hook
 * Optimized hook for fetching monitoring dashboard data
 * Features: request deduplication, configurable refresh, proper cleanup
 */

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Health status interface
 */
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  score: number
  issues: string[]
}

/**
 * Metric summary interface
 */
interface MetricSummary {
  count: number
  sum: number
  min: number
  max: number
  avg: number
}

/**
 * Metrics data from the API
 */
interface MetricsData {
  timestamp: string
  environment: string
  health: HealthStatus
  summary: {
    reviewEngine?: Record<string, MetricSummary>
    api?: Record<string, MetricSummary>
    cache?: Record<string, MetricSummary>
  }
  metrics: Record<string, any>
  system: {
    uptime: number
    memory: NodeJS.MemoryUsage
    cpuUsage: NodeJS.CpuUsage
  }
  error?: string
}

/**
 * Backup status data
 */
interface BackupData {
  success?: boolean
  error?: string
  status?: {
    pitr: {
      enabled: boolean
      earliestRestoreTime: string | null
      retentionDays: number
      status: string
    }
    backups: {
      total: number
      successful: number
      failed: number
      inProgress: number
      lastSuccessful: {
        id: string
        timestamp: string
        type: string
      } | null
    }
    storage: {
      bucket: string
      backupPath: string
    }
    health: {
      status: string
    }
  }
  recentBackups?: Array<{
    id: string
    type: string
    status: string
    startedAt: string
    completedAt?: string
    error?: string
  }>
}

/**
 * Quota data
 */
interface QuotaData {
  success?: boolean
  error?: string
  quota?: {
    reads: { used: number; limit: number; percentage: number; remaining: number }
    writes: { used: number; limit: number; percentage: number; remaining: number }
    deletes: { used: number; limit: number; percentage: number; remaining: number }
    storage: { used: number; limit: number; percentage: number; remaining: number; unit: string }
  }
  status?: 'healthy' | 'warning' | 'critical'
  source?: 'redis' | 'estimate'
  billingPlan?: string
  alerts?: Array<{ type: string; severity: string; message: string }>
}

/**
 * Combined monitoring data
 */
export interface MonitoringData {
  metrics: MetricsData | null
  backup: BackupData | null
  quota: QuotaData | null
}

/**
 * Hook options
 */
interface UseMonitoringDataOptions {
  /** Enable auto-refresh (default: false) */
  autoRefresh?: boolean
  /** Refresh interval in milliseconds (default: 15000 = 15 seconds) */
  refreshInterval?: number
  /** Enable data fetching (default: true) */
  enabled?: boolean
}

/**
 * Hook return type
 */
interface UseMonitoringDataReturn {
  /** Combined monitoring data */
  data: MonitoringData
  /** Loading state */
  loading: boolean
  /** Error message if any */
  error: string | null
  /** Manually trigger a refresh */
  refresh: () => Promise<void>
  /** Last update timestamp */
  lastUpdated: Date | null
  /** Whether auto-refresh is active */
  isAutoRefreshing: boolean
}

/**
 * Optimized hook for monitoring dashboard data
 */
export function useMonitoringData(options: UseMonitoringDataOptions = {}): UseMonitoringDataReturn {
  const { autoRefresh = false, refreshInterval = 15000, enabled = true } = options

  // State
  const [data, setData] = useState<MonitoringData>({
    metrics: null,
    backup: null,
    quota: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Refs for cleanup and deduplication
  const abortControllerRef = useRef<AbortController | null>(null)
  const isFetchingRef = useRef(false)
  const mountedRef = useRef(true)

  /**
   * Fetch all monitoring data from batch endpoint
   */
  const fetchData = useCallback(async () => {
    // Prevent duplicate requests
    if (isFetchingRef.current) {
      return
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController()
    isFetchingRef.current = true

    try {
      const response = await fetch('/api/admin/monitoring/batch', {
        signal: abortControllerRef.current.signal,
        credentials: 'include',
      })

      // Check if component is still mounted
      if (!mountedRef.current) return

      if (!response.ok) {
        throw new Error(`Failed to fetch monitoring data: ${response.status}`)
      }

      const result = await response.json()

      if (!mountedRef.current) return

      if (result.success) {
        setData({
          metrics: result.metrics || null,
          backup: result.backup || null,
          quota: result.quota || null,
        })
        setError(null)
        setLastUpdated(new Date())
      } else {
        setError(result.error || 'Failed to fetch monitoring data')
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }

      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
      isFetchingRef.current = false
    }
  }, [])

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchData()
  }, [fetchData])

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true

    if (enabled) {
      fetchData()
    }

    return () => {
      mountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [enabled, fetchData])

  // Auto-refresh effect
  useEffect(() => {
    if (!enabled || !autoRefresh) {
      return
    }

    const intervalId = setInterval(() => {
      fetchData()
    }, refreshInterval)

    return () => {
      clearInterval(intervalId)
    }
  }, [enabled, autoRefresh, refreshInterval, fetchData])

  return {
    data,
    loading,
    error,
    refresh,
    lastUpdated,
    isAutoRefreshing: autoRefresh,
  }
}

export default useMonitoringData
