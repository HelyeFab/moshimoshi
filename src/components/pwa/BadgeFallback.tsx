'use client'

import { useEffect, useState } from 'react'
import { badgeManager } from '@/lib/pwa/badging'
import { useI18n } from '@/i18n/I18nContext'
import { Bell, X } from 'lucide-react'

interface BadgeFallbackProps {
  className?: string
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  showOnlyIfUnsupported?: boolean
}

export function BadgeFallback({
  className = '',
  position = 'top-right',
  showOnlyIfUnsupported = true
}: BadgeFallbackProps) {
  const { t } = useI18n()
  const [badgeCount, setBadgeCount] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Get initial badge count
    setBadgeCount(badgeManager.getBadgeCount())

    // Subscribe to badge changes
    const unsubscribe = badgeManager.onBadgeChange((count) => {
      setBadgeCount(count)
    })

    // Check if we should show the fallback
    if (showOnlyIfUnsupported && badgeManager.isBadgingSupported()) {
      setIsVisible(false)
    } else if (badgeManager.getBadgeCount() > 0) {
      setIsVisible(true)
    }

    return () => {
      unsubscribe()
    }
  }, [showOnlyIfUnsupported])

  useEffect(() => {
    // Show/hide based on count
    if (badgeCount > 0) {
      if (!showOnlyIfUnsupported || !badgeManager.isBadgingSupported()) {
        setIsVisible(true)
      }
    } else {
      setIsVisible(false)
    }
  }, [badgeCount, showOnlyIfUnsupported])

  const handleClear = async () => {
    await badgeManager.clearBadge()
  }

  if (!isVisible) {
    return null
  }

  // Position styles
  const positionStyles = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  }

  return (
    <div
      className={`fixed ${positionStyles[position]} z-40 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={t('pwa.badge.reviewsDue', { count: badgeCount })}
    >
      <div className="bg-soft-white dark:bg-dark-850 border border-gray-200 dark:border-gray-700 rounded-full shadow-lg flex items-center gap-2 py-2 px-4 animate-slide-in">
        <Bell className="w-5 h-5 text-primary-500" />

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {badgeCount}
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {badgeCount === 1 ? 'review due' : 'reviews due'}
          </span>
        </div>

        <button
          onClick={handleClear}
          className="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          aria-label={t('pwa.badge.clearBadge')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// Hook to use badge manager in components
export function useBadge() {
  const [badgeCount, setBadgeCount] = useState(0)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    // Get initial state
    setBadgeCount(badgeManager.getBadgeCount())
    setIsSupported(badgeManager.isBadgingSupported())

    // Subscribe to changes
    const unsubscribe = badgeManager.onBadgeChange((count) => {
      setBadgeCount(count)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const setBadge = async (count: number) => {
    return badgeManager.setBadge(count)
  }

  const clearBadge = async () => {
    return badgeManager.clearBadge()
  }

  const updateFromReviews = async (dueCount: number, urgentCount: number = 0) => {
    return badgeManager.updateBadgeFromReviews(dueCount, urgentCount)
  }

  return {
    badgeCount,
    isSupported,
    setBadge,
    clearBadge,
    updateFromReviews
  }
}