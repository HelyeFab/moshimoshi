'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, X, AlertTriangle } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

interface UpdateBannerProps {
  registration?: ServiceWorkerRegistration | null
  isCritical?: boolean
  onDismiss?: () => void
}

/**
 * Persistent update banner that appears when a new version is available.
 * For critical updates, shows a modal that cannot be easily dismissed.
 */
export function UpdateBanner({ isCritical = false, onDismiss }: UpdateBannerProps) {
  const { t } = useI18n()
  const [isUpdating, setIsUpdating] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const handleUpdate = useCallback(() => {
    setIsUpdating(true)
    // For version-based updates, a simple reload is sufficient.
    // The server will serve the new version.
    // Small delay to show the updating state before reload
    setTimeout(() => {
      window.location.reload()
    }, 100)
  }, [])

  const handleDismiss = useCallback(() => {
    if (isCritical) {
      // For critical updates, just minimize to a small indicator
      setDismissed(true)
    } else {
      setDismissed(true)
      onDismiss?.()
    }
  }, [isCritical, onDismiss])

  // For critical updates, show a modal-style overlay
  if (isCritical && !dismissed) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {t('pwa.criticalUpdate.title') || 'Important Update Required'}
                </h3>
                <p className="text-sm text-white/80">
                  {t('pwa.criticalUpdate.description') || 'Please update to continue using the app'}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-5">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('pwa.criticalUpdate.message') ||
                'A critical update is available that includes important fixes. The app needs to refresh to apply these changes.'}
            </p>

            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 text-white rounded-xl transition-all font-semibold"
            >
              <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? t('pwa.updating') || 'Updating...' : t('pwa.updateNow') || 'Update Now'}
            </button>

            <button
              onClick={handleDismiss}
              className="w-full mt-2 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {t('pwa.remindLater') || 'Remind me later'}
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // For non-critical updates or dismissed critical updates, show a banner
  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 safe-top"
        >
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 py-3 shadow-lg">
            <div className="container mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">
                  {t('pwa.updateAvailable') || 'A new version is available'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isUpdating ? '...' : t('pwa.refresh') || 'Refresh'}
                </button>
                <button
                  onClick={handleDismiss}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Small floating indicator for when update banner is dismissed
 * Shows in bottom-right corner as a reminder
 */
export function UpdateIndicator({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed bottom-20 right-4 z-40 w-12 h-12 bg-primary-500 hover:bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center"
      aria-label="Update available"
    >
      <RefreshCw className="w-5 h-5" />
      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
    </motion.button>
  )
}
