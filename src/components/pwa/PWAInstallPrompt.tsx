'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Smartphone, Zap, Bell, WifiOff, Share, Plus } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import Image from 'next/image'

// Type for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Detect iOS Safari
const isIOS = (): boolean => {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
}

// Detect if running as standalone PWA
const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

// Check if install prompt was recently dismissed (7 days)
const wasRecentlyDismissed = (): boolean => {
  if (typeof window === 'undefined') return false
  const dismissed = localStorage.getItem('pwa_install_dismissed')
  if (!dismissed) return false
  const dismissedTime = new Date(dismissed).getTime()
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  return dismissedTime > sevenDaysAgo
}

// Visit count management for engagement threshold
const VISIT_COUNT_KEY = 'pwa_visit_count'
const MIN_VISITS_FOR_PROMPT = 3

const getVisitCount = (): number => {
  if (typeof window === 'undefined') return 0
  return parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10)
}

const incrementVisitCount = (): void => {
  if (typeof window === 'undefined') return
  const count = getVisitCount() + 1
  localStorage.setItem(VISIT_COUNT_KEY, count.toString())
}

const hasEnoughVisits = (): boolean => {
  return getVisitCount() >= MIN_VISITS_FOR_PROMPT
}

export function PWAInstallPrompt() {
  const { t } = useI18n()
  const [showPrompt, setShowPrompt] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalling, setIsInstalling] = useState(false)

  useEffect(() => {
    // Increment visit count on each mount
    incrementVisitCount()

    // Don't show if already installed, recently dismissed, or not enough visits
    if (isStandalone() || wasRecentlyDismissed() || !hasEnoughVisits()) return

    // Handle iOS Safari
    if (isIOS()) {
      // Show after user engagement (30 seconds)
      const timer = setTimeout(() => {
        setShowPrompt(true)
      }, 30000)
      return () => clearTimeout(timer)
    }

    // Handle Chrome/Edge/Samsung (beforeinstallprompt)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Show after brief delay for engagement
      setTimeout(() => setShowPrompt(true), 15000)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Track successful installs
    window.addEventListener('appinstalled', () => {
      setShowPrompt(false)
      setDeferredPrompt(null)
      localStorage.setItem('pwa_installed', 'true')
      // Track analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'pwa_install', { event_category: 'engagement' })
      }
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = useCallback(async () => {
    if (isIOS()) {
      setShowIOSInstructions(true)
      return
    }

    if (!deferredPrompt) return

    setIsInstalling(true)
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        setShowPrompt(false)
      }
    } catch (error) {
      console.error('[PWA Install] Error:', error)
    } finally {
      setIsInstalling(false)
      setDeferredPrompt(null)
    }
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    setShowPrompt(false)
    setShowIOSInstructions(false)
    localStorage.setItem('pwa_install_dismissed', new Date().toISOString())
  }, [])

  // Don't render if already standalone
  if (typeof window !== 'undefined' && isStandalone()) return null

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-md"
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header with gradient accent */}
            <div className="bg-gradient-to-r from-primary-500 via-primary-600 to-accent-500 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* App Icon */}
                  <div className="w-12 h-12 bg-white rounded-xl shadow-lg flex items-center justify-center">
                    <Image
                      src="/favicon-192x192.png"
                      alt="Moshimoshi"
                      width={40}
                      height={40}
                      className="rounded-lg"
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {t('pwa.install.title')}
                    </h3>
                    <p className="text-sm text-white/80">
                      {t('pwa.install.description')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="text-white/70 hover:text-white transition-colors p-1"
                  aria-label="Dismiss"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Benefits */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <WifiOff className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                <span className="text-sm">{t('pwa.install.benefits.offline')}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <div className="w-8 h-8 rounded-full bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-accent-600 dark:text-accent-400" />
                </div>
                <span className="text-sm">{t('pwa.install.benefits.faster')}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm">{t('pwa.install.benefits.notifications')}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-4 pt-0 flex gap-3">
              <button
                onClick={handleInstall}
                disabled={isInstalling}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 text-white rounded-xl transition-all font-semibold text-sm shadow-lg shadow-primary-500/25"
              >
                {isIOS() ? (
                  <>
                    <Share className="w-4 h-4" />
                    {t('pwa.install.button')}
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    {isInstalling ? '...' : t('pwa.install.button')}
                  </>
                )}
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all font-medium text-sm"
              >
                {t('pwa.install.later')}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={handleDismiss}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-500 to-accent-500 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-primary-600" />
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    {t('pwa.install.ios.instructions')}
                  </h3>
                </div>
                <button
                  onClick={handleDismiss}
                  className="text-white/70 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Steps */}
            <div className="p-5 space-y-4">
              {/* Step 1 */}
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  1
                </div>
                <div className="flex-1">
                  <p className="text-gray-800 dark:text-gray-200 font-medium">
                    {t('pwa.install.ios.step1')}
                  </p>
                  <div className="mt-2 flex items-center justify-center p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
                    <Share className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  2
                </div>
                <div className="flex-1">
                  <p className="text-gray-800 dark:text-gray-200 font-medium">
                    {t('pwa.install.ios.step2')}
                  </p>
                  <div className="mt-2 flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
                    <Plus className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Add to Home Screen</span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  3
                </div>
                <div className="flex-1">
                  <p className="text-gray-800 dark:text-gray-200 font-medium">
                    {t('pwa.install.ios.step3')}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 pt-0">
              <button
                onClick={handleDismiss}
                className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
              >
                {t('common.gotIt') || 'Got it!'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
