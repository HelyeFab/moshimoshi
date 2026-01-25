'use client'

import { useState, useEffect } from 'react'
import { X, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'

/**
 * A promotional banner that displays only on Sundays.
 * Announces that new content is added every Sunday.
 */
const STORAGE_KEY = 'sundayBannerDismissedDate'

export function SundayContentBanner() {
  const { t } = useI18n()
  const [isDismissed, setIsDismissed] = useState(false)
  const [isSunday, setIsSunday] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    const today = new Date()
    const isTodaySunday = today.getDay() === 0
    setIsSunday(isTodaySunday)

    // Check if already dismissed this Sunday
    if (isTodaySunday) {
      const dismissedDate = localStorage.getItem(STORAGE_KEY)
      if (dismissedDate === today.toDateString()) {
        setIsDismissed(true)
      }
    }
  }, [])

  // Don't render on server or if not Sunday
  if (!isMounted || !isSunday) {
    return null
  }

  const shouldShow = !isDismissed

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          role="banner"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative z-50 bg-gradient-to-r from-pink-500 via-rose-500 to-pink-500 dark:from-pink-600 dark:via-rose-600 dark:to-pink-600 shadow-md"
        >
      <div className="max-w-7xl mx-auto py-2.5 px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          {/* Content - Marquee */}
          <div className="flex-1 overflow-hidden min-w-0">
            <motion.div
              animate={{ x: ['100%', '-100%'] }}
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: 'linear'
              }}
              className="flex items-center justify-center gap-2 sm:gap-3 whitespace-nowrap"
            >
              <Sparkles
                className="h-4 w-4 sm:h-5 sm:w-5 text-white flex-shrink-0"
                aria-hidden="true"
              />
              <p className="text-sm sm:text-base font-medium text-white">
                {t('banners.sundayContent.message')}
              </p>
              <Sparkles
                className="h-4 w-4 sm:h-5 sm:w-5 text-white flex-shrink-0"
                aria-hidden="true"
              />
            </motion.div>
          </div>

          {/* Dismiss button */}
          <button
            onClick={() => {
              setIsDismissed(true)
              localStorage.setItem(STORAGE_KEY, new Date().toDateString())
            }}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors duration-200 flex-shrink-0"
            aria-label={t('banners.sundayContent.dismiss')}
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
