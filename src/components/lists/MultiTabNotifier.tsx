'use client'

import React, { useState, useEffect } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import { listManager } from '@/lib/lists/ListManager'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * MultiTabNotifier Component
 *
 * Displays a prominent alert banner when the IndexedDB database version changes
 * in another tab, prompting the user to refresh the page to continue using lists.
 *
 * This prevents data corruption and sync issues by ensuring all tabs are using
 * the same database schema version.
 */
export default function MultiTabNotifier() {
  const { t } = useI18n()
  const [showNotification, setShowNotification] = useState(false)

  useEffect(() => {
    // Subscribe to version-change events from ListManager
    const unsubscribe = listManager.subscribe('version-change', () => {
      console.log('[MultiTabNotifier] Database version change detected')
      setShowNotification(true)
    })

    // Cleanup subscription on unmount
    return () => {
      unsubscribe()
    }
  }, [])

  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <AnimatePresence>
      {showNotification && (
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -100 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none"
        >
          <div className="container mx-auto px-4 pt-4 pointer-events-auto">
            <div
              className="
                bg-red-500/95 dark:bg-red-600/95
                backdrop-blur-lg
                border-2 border-red-600 dark:border-red-500
                rounded-2xl
                shadow-2xl
                p-4 sm:p-6
                text-white
              "
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Icon */}
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold mb-1">
                    {t('lists.multiTab.versionChangeTitle')}
                  </h3>
                  <p className="text-sm sm:text-base opacity-95">
                    {t('lists.multiTab.versionChangeMessage')}
                  </p>
                </div>

                {/* Refresh Button */}
                <div className="flex-shrink-0 w-full sm:w-auto">
                  <button
                    onClick={handleRefresh}
                    className="
                      w-full sm:w-auto
                      px-6 py-3
                      bg-white
                      hover:bg-gray-100
                      text-red-600
                      font-bold
                      rounded-xl
                      transition-all
                      duration-200
                      flex items-center justify-center gap-2
                      shadow-lg
                      hover:shadow-xl
                      hover:scale-105
                      active:scale-95
                    "
                  >
                    <RefreshCw className="w-5 h-5" />
                    {t('lists.multiTab.refreshButton')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
