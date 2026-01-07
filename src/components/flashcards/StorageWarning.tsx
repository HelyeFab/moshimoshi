'use client'

import Alert from '@/components/ui/Alert'
import { useStorageQuota, formatBytes, getQuotaSummary } from '@/hooks/useStorageQuota'
import { useState } from 'react'

interface StorageWarningProps {
  /**
   * Whether to show the warning as a fixed banner at the top
   * Default: false
   */
  asBanner?: boolean

  /**
   * Show detailed storage breakdown
   * Default: false
   */
  showDetails?: boolean

  /**
   * Custom class name
   */
  className?: string

  /**
   * Custom warning message for 80-95% usage
   * Default: "Storage running low. {summary}. Consider deleting unused decks."
   */
  warningMessage?: string

  /**
   * Custom critical message for >=95% usage
   * Default: "Storage critical! {summary}. Please delete old flashcard decks to free up space."
   */
  criticalMessage?: string

  /**
   * Custom warning title
   * Default: "Storage Warning"
   */
  warningTitle?: string

  /**
   * Custom critical title
   * Default: "Storage Almost Full"
   */
  criticalTitle?: string
}

/**
 * Component that monitors storage quota and displays warnings when storage is running low.
 *
 * Warning levels:
 * - 80-95%: Yellow warning banner
 * - 95%+: Red critical banner
 */
export default function StorageWarning({
  asBanner = false,
  showDetails = false,
  className = '',
  warningMessage,
  criticalMessage,
  warningTitle,
  criticalTitle
}: StorageWarningProps) {
  const { estimate, warningLevel, percentageUsed, isLoading, isSupported } = useStorageQuota()
  const [showDetailsState, setShowDetailsState] = useState(showDetails)

  // Don't show anything if:
  // - Storage API not supported
  // - Still loading
  // - No warning needed (< 80% usage)
  if (!isSupported || isLoading || warningLevel === 'none') {
    return null
  }

  const getMessage = () => {
    const summary = getQuotaSummary({ estimate, warningLevel, percentageUsed, isLoading, isSupported })

    if (warningLevel === 'critical') {
      return criticalMessage || `Storage critical! ${summary}. Please delete old flashcard decks to free up space.`
    }

    return warningMessage || `Storage running low. ${summary}. Consider deleting unused decks.`
  }

  const getTitle = () => {
    if (warningLevel === 'critical') {
      return criticalTitle || 'Storage Almost Full'
    }
    return warningTitle || 'Storage Warning'
  }

  const detailsContent = showDetailsState && estimate?.usageDetails && (
    <div className="mt-3 p-3 rounded-lg bg-black/5 dark:bg-white/5 text-xs">
      <p className="font-medium mb-2">Storage Breakdown:</p>
      <ul className="space-y-1">
        {estimate.usageDetails.indexedDB !== undefined && (
          <li>
            IndexedDB: {formatBytes(estimate.usageDetails.indexedDB)}
          </li>
        )}
        {estimate.usageDetails.caches !== undefined && (
          <li>
            Caches: {formatBytes(estimate.usageDetails.caches)}
          </li>
        )}
        {estimate.usageDetails.serviceWorkerRegistrations !== undefined && (
          <li>
            Service Workers: {formatBytes(estimate.usageDetails.serviceWorkerRegistrations)}
          </li>
        )}
      </ul>
    </div>
  )

  if (asBanner) {
    return (
      <div className={`fixed top-0 left-0 right-0 z-50 ${className}`}>
        <Alert
          type={warningLevel === 'critical' ? 'error' : 'warning'}
          title={getTitle()}
          message={getMessage()}
          dismissible
          showIcon
          className="rounded-none border-x-0 border-t-0"
          action={estimate?.usageDetails ? {
            label: showDetailsState ? 'Hide Details' : 'Show Details',
            onClick: () => setShowDetailsState(!showDetailsState)
          } : undefined}
        />
        {detailsContent}
      </div>
    )
  }

  return (
    <div className={className}>
      <Alert
        type={warningLevel === 'critical' ? 'error' : 'warning'}
        title={getTitle()}
        message={getMessage()}
        dismissible
        showIcon
        action={estimate?.usageDetails ? {
          label: showDetailsState ? 'Hide Details' : 'Show Details',
          onClick: () => setShowDetailsState(!showDetailsState)
        } : undefined}
      />
      {detailsContent}
    </div>
  )
}

/**
 * Storage indicator component - shows current storage usage without warnings.
 * Useful for settings pages or dashboards.
 */
export function StorageIndicator({ className = '' }: { className?: string }) {
  const { estimate, percentageUsed, isLoading, isSupported } = useStorageQuota()

  if (!isSupported) {
    return (
      <div className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}>
        Storage monitoring not available
      </div>
    )
  }

  if (isLoading || !estimate) {
    return (
      <div className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}>
        Checking storage...
      </div>
    )
  }

  const { usage = 0, quota = 0 } = estimate
  const getColor = () => {
    if (percentageUsed >= 95) return 'text-red-600 dark:text-red-400'
    if (percentageUsed >= 80) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-green-600 dark:text-green-400'
  }

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-gray-700 dark:text-gray-300">Storage Used</span>
        <span className={`font-medium ${getColor()}`}>
          {Math.round(percentageUsed)}%
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            percentageUsed >= 95
              ? 'bg-red-600 dark:bg-red-400'
              : percentageUsed >= 80
              ? 'bg-yellow-600 dark:bg-yellow-400'
              : 'bg-green-600 dark:bg-green-400'
          }`}
          style={{ width: `${Math.min(percentageUsed, 100)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
        <span>{formatBytes(usage)}</span>
        <span>{formatBytes(quota)}</span>
      </div>
    </div>
  )
}
