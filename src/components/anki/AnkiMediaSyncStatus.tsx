'use client'

import { useState, useEffect } from 'react'
import { Cloud, CloudOff, CheckCircle2, AlertCircle, Upload, RefreshCw } from 'lucide-react'
import { AnkiMediaManager } from '@/lib/anki/AnkiMediaManager'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import type { MediaSyncStatus } from '@/types/ankiMedia'

interface AnkiMediaSyncStatusProps {
  deckId?: string
  className?: string
}

/**
 * Non-blocking sync status indicator for Anki media files
 * Shows progress and allows deck usage while syncing
 */
export function AnkiMediaSyncStatus({ deckId, className = '' }: AnkiMediaSyncStatusProps) {
  const { user } = useAuth()
  const { isPremium } = useSubscription()
  const [status, setStatus] = useState<MediaSyncStatus | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!user?.uid || !isPremium) return

    const manager = AnkiMediaManager.getInstance()

    const fetchStatus = async () => {
      const syncStatus = await manager.getSyncStatus(deckId)
      setStatus(syncStatus)
    }

    // Initial fetch
    fetchStatus()

    // Poll every 3 seconds while syncing, every 30 seconds otherwise
    const interval = setInterval(() => {
      fetchStatus()
    }, status?.syncState === 'syncing' ? 3000 : 30000)

    return () => clearInterval(interval)
  }, [user?.uid, isPremium, deckId, status?.syncState])

  const handleManualSync = async () => {
    if (!user?.uid || !isPremium) return

    setIsRefreshing(true)
    try {
      const manager = AnkiMediaManager.getInstance()
      await manager.forceSyncAll()

      // Refresh status after sync attempt
      setTimeout(async () => {
        const syncStatus = await manager.getSyncStatus(deckId)
        setStatus(syncStatus)
        setIsRefreshing(false)
      }, 2000)
    } catch (error) {
      console.error('[AnkiMediaSyncStatus] Manual sync failed:', error)
      setIsRefreshing(false)
    }
  }

  if (!status || !user?.uid || !isPremium) return null

  // Don't show if no media files
  if (status.totalCount === 0) return null

  // Calculate progress percentage
  const progressPercent = status.totalCount > 0
    ? (status.syncedCount / status.totalCount) * 100
    : 0

  const getIcon = () => {
    switch (status.syncState) {
      case 'syncing':
        return <Upload className="w-4 h-4 animate-pulse" />
      case 'synced':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-orange-500" />
      case 'idle':
        return status.isOnline ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />
      default:
        return <Cloud className="w-4 h-4" />
    }
  }

  const getStatusText = () => {
    switch (status.syncState) {
      case 'syncing':
        return `Syncing media... ${status.syncedCount} / ${status.totalCount}`
      case 'synced':
        return `All media synced (${status.totalCount})`
      case 'error':
        return `Sync error: ${status.failedCount} failed`
      case 'idle':
        return status.pendingCount > 0
          ? `${status.pendingCount} files waiting to sync`
          : `${status.totalCount} files ready`
      default:
        return 'Media storage'
    }
  }

  const getStatusColor = () => {
    switch (status.syncState) {
      case 'syncing':
        return 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
      case 'synced':
        return 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
      case 'error':
        return 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20'
      default:
        return 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
    }
  }

  return (
    <div className={`p-3 rounded-lg border ${getStatusColor()} ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getIcon()}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
            {getStatusText()}
          </span>
        </div>

        {/* Progress bar for syncing state */}
        {status.syncState === 'syncing' && (
          <div className="flex-1 max-w-[120px]">
            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {Math.round(progressPercent)}%
            </span>
          </div>
        )}

        {/* Manual sync button - show when there are pending files */}
        {status.pendingCount > 0 && (
          <button
            onClick={handleManualSync}
            disabled={status.syncState === 'syncing' || isRefreshing}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={status.syncState === 'syncing' ? 'Syncing...' : 'Sync now'}
          >
            <RefreshCw className={`w-4 h-4 ${status.syncState === 'syncing' || isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Error message */}
      {status.syncState === 'error' && status.lastError && (
        <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
          {status.lastError}
        </p>
      )}

      {/* Offline warning */}
      {!status.isOnline && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Offline - sync will resume when online
        </p>
      )}
    </div>
  )
}
