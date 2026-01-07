'use client'

import { useState, useEffect } from 'react'
import { useSubscription } from '@/hooks/useSubscription'
import { listManager, ListSyncStatus } from '@/lib/lists/ListManager'
import { motion, AnimatePresence } from 'framer-motion'
import { Cloud, CloudOff, CheckCircle, AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast/ToastContext'

interface ListSyncStatusIndicatorProps {
  mobileOnly?: boolean
}

export default function ListSyncStatusIndicator({ mobileOnly = false }: ListSyncStatusIndicatorProps) {
  const [syncStatus, setSyncStatus] = useState<ListSyncStatus | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isManualSyncing, setIsManualSyncing] = useState(false)
  const { isPremium } = useSubscription()
  const { showToast } = useToast()

  useEffect(() => {
    // Get initial status
    const initialStatus = listManager.getSyncStatus()
    console.log('[ListSyncStatusIndicator] Initial sync status:', initialStatus)
    setSyncStatus(initialStatus)

    // Subscribe to sync events
    const unsubscribeStarted = listManager.subscribe('sync-started', () => {
      const status = listManager.getSyncStatus()
      console.log('[ListSyncStatusIndicator] Sync started:', status)
      setSyncStatus(status)
    })

    const unsubscribeCompleted = listManager.subscribe('sync-completed', () => {
      const status = listManager.getSyncStatus()
      console.log('[ListSyncStatusIndicator] Sync completed:', status)
      setSyncStatus(status)
    })

    const unsubscribeFailed = listManager.subscribe('sync-failed', () => {
      const status = listManager.getSyncStatus()
      console.log('[ListSyncStatusIndicator] Sync failed:', status)
      setSyncStatus(status)
    })

    // Poll status every 5 seconds for pending count updates
    const interval = setInterval(() => {
      setSyncStatus(listManager.getSyncStatus())
    }, 5000)

    return () => {
      unsubscribeStarted()
      unsubscribeCompleted()
      unsubscribeFailed()
      clearInterval(interval)
    }
  }, [])

  // Handle click outside to close expanded view
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      // Don't close if clicking the button or inside the panel
      if (isExpanded &&
          !target.closest('.list-sync-indicator-content') &&
          !target.closest('.list-sync-button')) {
        setIsExpanded(false)
      }
    }

    if (isExpanded) {
      // Use setTimeout to avoid race condition with the button click
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
      }, 0)

      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('click', handleClickOutside)
      }
    }
  }, [isExpanded])

  if (!syncStatus) return null

  // Determine icon and color based on status (including manual sync state)
  const getStatusIcon = () => {
    if (!syncStatus.isOnline) return <CloudOff className="w-5 h-5" />
    if (syncStatus.syncState === 'syncing' || isManualSyncing) return <Loader2 className="w-5 h-5 animate-spin" />
    if (syncStatus.syncState === 'synced') return <CheckCircle className="w-5 h-5" />
    if (syncStatus.syncState === 'error') return <AlertCircle className="w-5 h-5" />
    return <Cloud className="w-5 h-5" />
  }

  const getStatusColor = () => {
    if (!syncStatus.isOnline) return 'bg-gray-500'
    if (syncStatus.syncState === 'syncing' || isManualSyncing) return 'bg-blue-500'
    if (syncStatus.syncState === 'synced') return 'bg-green-500'
    if (syncStatus.syncState === 'error') return 'bg-red-500'
    return 'bg-yellow-500'
  }

  const getStatusText = () => {
    if (!syncStatus.isOnline) return 'Offline'
    if (syncStatus.syncState === 'syncing' || isManualSyncing) return `Syncing...${syncStatus.pendingCount > 0 ? ` (${syncStatus.pendingCount})` : ''}`
    if (syncStatus.syncState === 'synced') return 'All synced'
    if (syncStatus.syncState === 'error') return 'Sync error'
    return 'Idle'
  }

  const handleManualSync = async () => {
    if (!isPremium || !syncStatus.isOnline) {
      if (!isPremium) {
        showToast('Manual sync is only available for premium users', 'info')
      } else {
        showToast('Cannot sync while offline', 'warning')
      }
      return
    }

    setIsManualSyncing(true)

    // Get current pending count to determine if there's anything to sync
    const currentStatus = listManager.getSyncStatus()
    const hadPendingItems = currentStatus.pendingCount > 0

    try {
      console.log('[ListSyncStatusIndicator] Starting manual sync...')
      showToast('Syncing lists...', 'info')

      // Add minimum delay to show loading state (even if sync is instant)
      const [syncResult] = await Promise.all([
        listManager.forceSyncAll(),
        new Promise(resolve => setTimeout(resolve, 500))
      ])

      // Get final status to see what happened
      const finalStatus = listManager.getSyncStatus()

      if (!hadPendingItems) {
        showToast('All lists already synced!', 'success')
      } else if (finalStatus.syncState === 'synced') {
        showToast(`Synced successfully!`, 'success')
      } else if (finalStatus.syncState === 'error') {
        showToast(finalStatus.lastError || 'Some items failed to sync', 'error')
      }

      console.log('[ListSyncStatusIndicator] Manual sync completed')
    } catch (error) {
      console.error('[ListSyncStatusIndicator] Manual sync failed:', error)
      showToast('Sync failed. Please try again.', 'error')
    } finally {
      setIsManualSyncing(false)
    }
  }

  // Mobile inline version (compact button for header)
  if (mobileOnly) {
    console.log('[ListSyncStatusIndicator] Rendering mobile version, syncStatus:', syncStatus)
    return (
      <>
        <button
          onClick={(e) => {
            e.stopPropagation()
            console.log('[ListSyncStatusIndicator] Mobile button clicked, isExpanded:', isExpanded)
            setIsExpanded(!isExpanded)
          }}
          className={`
            list-sync-button
            ${getStatusColor()}
            text-white rounded-full p-2 shadow-md
            transition-all duration-200
            flex items-center gap-1
          `}
          aria-label="Sync status"
        >
          {getStatusIcon()}
        </button>

        {/* Mobile expandable panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="list-sync-indicator-content absolute top-full right-0 mt-2 z-50 w-80 max-w-[calc(100vw-2rem)]"
            >
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Sync Status</h3>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
                    aria-label="Close"
                  >
                    &times;
                  </button>
                </div>

                {/* Status details */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon()}
                    <span className="font-medium text-gray-900 dark:text-gray-100">{getStatusText()}</span>
                  </div>

                  {syncStatus.pendingCount > 0 && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {syncStatus.pendingCount} item(s) pending
                    </div>
                  )}

                  {syncStatus.failedCount > 0 && (
                    <div className="text-sm text-red-600 dark:text-red-400">
                      {syncStatus.failedCount} item(s) failed
                    </div>
                  )}

                  {syncStatus.lastSyncTime && (
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      Last sync: {syncStatus.lastSyncTime.toLocaleTimeString()}
                    </div>
                  )}

                  {syncStatus.lastError && (
                    <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                      {syncStatus.lastError}
                    </div>
                  )}

                  {/* Manual sync button for premium */}
                  {isPremium && (
                    <button
                      onClick={handleManualSync}
                      disabled={syncStatus.syncState === 'syncing' || !syncStatus.isOnline || isManualSyncing}
                      className="
                        w-full mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600
                        text-white rounded-lg transition-colors
                        disabled:opacity-50 disabled:cursor-not-allowed
                        flex items-center justify-center gap-2
                      "
                    >
                      {isManualSyncing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Force Sync
                        </>
                      )}
                    </button>
                  )}

                  {/* Upgrade CTA for free users */}
                  {!isPremium && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                        Manual sync is available for premium users
                      </p>
                      <Link
                        href="/pricing"
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Upgrade to Premium &rarr;
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    )
  }

  return (
    <>
      {/* Floating button - only on desktop (hidden on mobile) */}
      <motion.div
        className="hidden md:block fixed bottom-20 right-4 z-40"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <button
          onClick={() => {
            console.log('[ListSyncStatusIndicator] Button clicked, current isExpanded:', isExpanded)
            setIsExpanded(!isExpanded)
          }}
          className={`
            list-sync-button
            ${getStatusColor()}
            text-white rounded-full p-3 shadow-lg
            hover:shadow-xl transition-all duration-200
            flex items-center gap-2
          `}
          aria-label="Sync status"
        >
          {getStatusIcon()}
        </button>
      </motion.div>

      {/* Expandable panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="list-sync-indicator-content fixed bottom-48 md:bottom-36 right-4 z-40 w-80 max-w-[calc(100vw-2rem)]"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Sync Status</h3>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
                  aria-label="Close"
                >
                  &times;
                </button>
              </div>

              {/* Status details */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <span className="font-medium text-gray-900 dark:text-gray-100">{getStatusText()}</span>
                </div>

                {syncStatus.pendingCount > 0 && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {syncStatus.pendingCount} item(s) pending
                  </div>
                )}

                {syncStatus.failedCount > 0 && (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {syncStatus.failedCount} item(s) failed
                  </div>
                )}

                {syncStatus.lastSyncTime && (
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    Last sync: {syncStatus.lastSyncTime.toLocaleTimeString()}
                  </div>
                )}

                {syncStatus.lastError && (
                  <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                    {syncStatus.lastError}
                  </div>
                )}

                {/* Manual sync button for premium */}
                {isPremium && (
                  <button
                    onClick={handleManualSync}
                    disabled={syncStatus.syncState === 'syncing' || !syncStatus.isOnline || isManualSyncing}
                    className="
                      w-full mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600
                      text-white rounded-lg transition-colors
                      disabled:opacity-50 disabled:cursor-not-allowed
                      flex items-center justify-center gap-2
                    "
                  >
                    {isManualSyncing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Force Sync
                      </>
                    )}
                  </button>
                )}

                {/* Upgrade CTA for free users */}
                {!isPremium && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                      Manual sync is available for premium users
                    </p>
                    <Link
                      href="/pricing"
                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Upgrade to Premium &rarr;
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
