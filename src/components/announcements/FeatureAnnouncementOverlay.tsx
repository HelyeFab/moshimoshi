'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { DoshiMascot } from '@/components/ui/DoshiMascot'
import type { Announcement } from '@/lib/announcements/types'

// Auth-related paths where announcements should not be shown
const AUTH_PATHS = [
  '/login',
  '/signup',
  '/register',
  '/auth',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
]

/**
 * Check if the current path is an auth-related page
 */
function isAuthPage(pathname: string): boolean {
  // Remove locale prefix if present (e.g., /en/login -> /login)
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '')
  return AUTH_PATHS.some(
    (authPath) => pathWithoutLocale === authPath || pathWithoutLocale.startsWith(`${authPath}/`)
  )
}

// Sparkle component for decoration
function Sparkle({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: [0, 1, 0],
        opacity: [0, 1, 0],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        delay,
        ease: 'easeInOut',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 0L12.5 7.5L20 10L12.5 12.5L10 20L7.5 12.5L0 10L7.5 7.5L10 0Z" />
      </svg>
    </motion.div>
  )
}

/**
 * FeatureAnnouncementOverlay
 *
 * Full-screen overlay that displays the most recent published announcement
 * to users on app load. Shows only once per announcement per user.
 */
export function FeatureAnnouncementOverlay() {
  const { t, strings } = useI18n()
  const { user, loading: authLoading } = useAuth()
  const pathname = usePathname()
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissing, setDismissing] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  // Fetch active announcement (only for authenticated users)
  const fetchAnnouncement = useCallback(async () => {
    try {
      setLoading(true)

      const url = '/api/announcements/active'
      const response = await fetch(url)
      const data = await response.json()

      if (data.success && data.announcement) {
        setAnnouncement(data.announcement)
        // Small delay before showing for smoother UX
        setTimeout(() => setIsVisible(true), 300)
      }
    } catch (error) {
      console.error('[FeatureAnnouncementOverlay] Failed to fetch:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount after auth is resolved - only for authenticated users not on auth pages
  useEffect(() => {
    if (!authLoading && user && !isAuthPage(pathname)) {
      fetchAnnouncement()
    } else if (!authLoading) {
      // Not authenticated or on auth page - don't show announcements
      setLoading(false)
    }
  }, [authLoading, user, pathname, fetchAnnouncement])

  // Handle dismiss (only authenticated users reach this point)
  const handleDismiss = async () => {
    if (!announcement || dismissing) return

    setDismissing(true)

    try {
      const body = {
        announcementId: announcement.id,
      }

      const response = await fetch('/api/announcements/dismiss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (data.success) {
        setIsVisible(false)
        // Wait for exit animation before clearing
        setTimeout(() => setAnnouncement(null), 300)
      } else {
        console.error('[FeatureAnnouncementOverlay] Dismiss failed:', data.error)
        // Still hide the overlay even if API call fails
        setIsVisible(false)
        setTimeout(() => setAnnouncement(null), 300)
      }
    } catch (error) {
      console.error('[FeatureAnnouncementOverlay] Dismiss error:', error)
      // Still hide the overlay even if API call fails
      setIsVisible(false)
      setTimeout(() => setAnnouncement(null), 300)
    } finally {
      setDismissing(false)
    }
  }

  // Get translated "Got it" text
  const gotItText = strings.announcements?.gotIt || t('announcements.gotIt') || 'Got it'

  // Don't render if:
  // - Still loading auth state
  // - User is not authenticated
  // - On an auth page
  // - Still loading announcement
  // - No announcement to show
  if (authLoading || !user || isAuthPage(pathname) || loading || !announcement) {
    return null
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          {/* Floating sparkles decoration */}
          <Sparkle className="absolute top-[15%] left-[20%] text-yellow-400" delay={0} />
          <Sparkle className="absolute top-[25%] right-[15%] text-primary-400" delay={0.5} />
          <Sparkle className="absolute bottom-[30%] left-[15%] text-pink-400" delay={1} />
          <Sparkle className="absolute bottom-[20%] right-[20%] text-yellow-400" delay={1.5} />

          {/* Content card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-white dark:bg-dark-800 rounded-3xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto border border-gray-200/50 dark:border-dark-600/50 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {/* Gradient header decoration */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-primary-500/20 via-pink-500/10 to-yellow-500/20 dark:from-primary-500/10 dark:via-pink-500/5 dark:to-yellow-500/10 pointer-events-none" />

            {/* NEW badge - positioned at top right of card */}
            <motion.div
              initial={{ scale: 0, rotate: -12 }}
              animate={{ scale: 1, rotate: -12 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 400 }}
              className="absolute top-4 right-4 px-3 py-1 bg-gradient-to-r from-primary-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-lg z-10"
            >
              NEW!
            </motion.div>

            {/* Doshi mascot - positioned at top */}
            <div className="relative flex justify-center pt-6">
              <motion.div
                animate={{
                  y: [0, -8, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <DoshiMascot size="large" variant="animated" mood="excited" />
              </motion.div>
            </div>

            {/* Image (if provided) */}
            {announcement.imageUrl && (
              <div className="relative mx-4 mt-4 rounded-xl overflow-hidden shadow-lg">
                <img
                  src={announcement.imageUrl}
                  alt=""
                  className="w-full aspect-video object-cover"
                />
              </div>
            )}

            {/* Content */}
            <div className="relative p-6 pt-4">
              {/* Title with gradient accent */}
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">
                {announcement.title}
              </h2>

              {/* HTML Content */}
              <div
                className="prose prose-sm dark:prose-invert max-w-none mb-6 text-center [&>*]:text-gray-600 [&>*]:dark:text-gray-400 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-gray-800 [&_h1]:dark:text-gray-200 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-gray-800 [&_h2]:dark:text-gray-200 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-gray-800 [&_h3]:dark:text-gray-200 [&_ul]:text-left [&_ol]:text-left"
                dangerouslySetInnerHTML={{ __html: announcement.content || announcement.description || '' }}
              />

              {/* Got it button with gradient */}
              <motion.button
                onClick={handleDismiss}
                disabled={dismissing}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:from-primary-400 disabled:to-primary-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2"
              >
                {dismissing ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <span>{gotItText}</span>
                    <span className="text-lg">✨</span>
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default FeatureAnnouncementOverlay
