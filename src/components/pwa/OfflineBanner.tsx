'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'

/**
 * Discreet offline indicator banner
 * - Appears as a small pill at the top when offline
 * - Shows "Back online" toast when connection is restored
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)
  const { strings } = useI18n()
  const { showToast } = useToast()
  const wasOfflineRef = useRef(false)
  const initialCheckDoneRef = useRef(false)

  useEffect(() => {
    // Check initial state
    const initialOffline = !navigator.onLine
    setIsOffline(initialOffline)
    wasOfflineRef.current = initialOffline
    initialCheckDoneRef.current = true

    const handleOnline = () => {
      setIsOffline(false)
      // Only show toast if we were previously offline (not on initial load)
      if (wasOfflineRef.current && initialCheckDoneRef.current) {
        showToast(strings?.pwa?.offline?.backOnline || 'Back online', 'success')
      }
      wasOfflineRef.current = false
    }

    const handleOffline = () => {
      setIsOffline(true)
      wasOfflineRef.current = true
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [showToast, strings?.pwa?.offline?.backOnline])

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className="fixed top-2 left-1/2 -translate-x-1/2 z-[100]"
        >
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/90 dark:bg-gray-700/90 text-white text-xs font-medium rounded-full shadow-lg backdrop-blur-sm">
            <WifiOff className="w-3 h-3" />
            <span>{strings?.pwa?.offline?.cached || 'Viewing cached content'}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default OfflineBanner
