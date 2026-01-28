'use client'

import { useState, useEffect } from 'react'
import { Download, Share, Info, Smartphone, RefreshCw, X, WifiOff, Zap, Bell, Plus, MoreHorizontal, SquarePlus } from 'lucide-react'
import { a2hsManager } from '@/lib/pwa/a2hs'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useI18n } from '@/i18n/I18nContext'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

export default function PWADemoPage() {
  const { t } = useI18n()
  const { showToast } = useToast()
  const [state, setState] = useState({
    canPrompt: false,
    isInstalled: false,
    shouldShow: false,
    platform: 'unknown' as string,
    visitCount: 0,
    lastPrompt: null as string | null,
    dismissedAt: null as string | null,
  })
  const [showDemoModal, setShowDemoModal] = useState(false)
  const [showDemoIOSModal, setShowDemoIOSModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const refreshState = () => {
    if (typeof window === 'undefined') return

    const visitCount = parseInt(localStorage.getItem('pwa_visit_count') || '0', 10)
    const lastPrompt = localStorage.getItem('pwa_last_prompt')
    const dismissedAt = localStorage.getItem('pwa_install_dismissed')

    setState({
      canPrompt: a2hsManager.canPrompt(),
      isInstalled: a2hsManager.isAppInstalled(),
      shouldShow: a2hsManager.shouldShowPrompt(),
      platform: a2hsManager.getPlatform(),
      visitCount,
      lastPrompt,
      dismissedAt,
    })
    setRefreshKey(prev => prev + 1)
  }

  useEffect(() => {
    refreshState()
  }, [])

  const triggerModal = () => {
    setShowDemoModal(true)
  }

  const triggerIOSModal = () => {
    setShowDemoIOSModal(true)
  }

  const triggerToast = () => {
    const message = state.platform === 'ios'
      ? t('pwa.install.toast.iosMessage')
      : t('pwa.install.toast.message')

    showToast(message, 'info', 8000, {
      label: t('pwa.install.toast.action'),
      onClick: triggerModal,
    })
  }

  const resetState = () => {
    if (confirm('This will reset all PWA install state. Continue?')) {
      localStorage.removeItem('pwa_visit_count')
      localStorage.removeItem('pwa_last_prompt')
      localStorage.removeItem('pwa_install_dismissed')
      localStorage.removeItem('pwa_installed')
      sessionStorage.removeItem('pwa_install_toast_shown')
      refreshState()
      showToast('PWA state reset!', 'success')
    }
  }

  const incrementVisits = () => {
    const current = parseInt(localStorage.getItem('pwa_visit_count') || '0', 10)
    localStorage.setItem('pwa_visit_count', (current + 1).toString())
    refreshState()
    showToast('Visit count incremented!', 'success')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Smartphone className="w-12 h-12 text-primary" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              PWA Installation Demo
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Test and preview all PWA installation invitation components
          </p>
        </div>

        {/* Current State Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Info className="w-6 h-6 text-primary" />
              Current State
            </h2>
            <button
              onClick={refreshState}
              className="p-2 rounded-lg hover:bg-accent/10 transition-colors"
              title="Refresh state"
            >
              <RefreshCw className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" key={refreshKey}>
            <StateItem label="Can Prompt" value={state.canPrompt} />
            <StateItem label="Is Installed" value={state.isInstalled} />
            <StateItem label="Should Show Prompt" value={state.shouldShow} />
            <StateItem label="Platform" value={state.platform} />
            <StateItem label="Visit Count" value={state.visitCount} />
            <StateItem
              label="Last Prompt Shown"
              value={state.lastPrompt ? new Date(parseInt(state.lastPrompt)).toLocaleString() : 'Never'}
            />
            <StateItem
              label="Dismissed At"
              value={state.dismissedAt ? new Date(state.dismissedAt).toLocaleString() : 'Never'}
              className="md:col-span-2"
            />
          </div>
        </div>

        {/* Controls Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <h2 className="text-2xl font-bold mb-6">Test Components</h2>

          <div className="space-y-4">
            {/* Trigger Modal Button */}
            <button
              onClick={triggerModal}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-xl font-semibold shadow-md hover:shadow-lg transition-all hover:scale-[1.02]"
            >
              <Download className="w-5 h-5" />
              Show PWA Install Modal (Android/Desktop)
            </button>

            {/* Trigger iOS Modal Button */}
            <button
              onClick={triggerIOSModal}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all hover:scale-[1.02]"
            >
              <Smartphone className="w-5 h-5" />
              Show iOS Install Instructions
            </button>

            {/* Trigger Toast Button */}
            <button
              onClick={triggerToast}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground rounded-xl font-semibold shadow-md hover:shadow-lg transition-all hover:scale-[1.02]"
            >
              <Share className="w-5 h-5" />
              Show PWA Install Toast
            </button>

            {/* Divider */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 text-sm text-muted-foreground bg-card">
                  State Management
                </span>
              </div>
            </div>

            {/* Increment Visits */}
            <button
              onClick={incrementVisits}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 border-2 border-primary text-primary rounded-xl font-semibold hover:bg-primary/10 transition-all"
            >
              <RefreshCw className="w-5 h-5" />
              Increment Visit Count
            </button>

            {/* Reset State Button */}
            <button
              onClick={resetState}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 border-2 border-destructive text-destructive rounded-xl font-semibold hover:bg-destructive/10 transition-all"
            >
              <RefreshCw className="w-5 h-5" />
              Reset PWA State
            </button>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            How It Works
          </h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong className="text-foreground">Visit Count:</strong> Prompt shows after 3+ visits</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong className="text-foreground">Cooldowns:</strong> 7 days after dismissal, 48 hours between prompts</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong className="text-foreground">Platform Detection:</strong> iOS shows instructions, Android/Chrome shows native prompt</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong className="text-foreground">Session Guard:</strong> Toast only shows once per browser session</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong className="text-foreground">Manual Trigger:</strong> Use the buttons above to bypass automatic restrictions for testing</span>
            </li>
          </ul>
        </div>

        {/* Components Section */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <h3 className="text-xl font-bold mb-4">Component Files</h3>
          <div className="space-y-2 text-sm font-mono">
            <div className="p-3 bg-accent/10 rounded-lg">
              <span className="text-muted-foreground">Modal:</span>{' '}
              <span className="text-primary">src/components/pwa/PWAInstallPrompt.tsx</span>
            </div>
            <div className="p-3 bg-accent/10 rounded-lg">
              <span className="text-muted-foreground">Toast:</span>{' '}
              <span className="text-primary">src/components/pwa/PWAInstallToast.tsx</span>
            </div>
            <div className="p-3 bg-accent/10 rounded-lg">
              <span className="text-muted-foreground">Manager:</span>{' '}
              <span className="text-primary">src/lib/pwa/a2hs.ts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Modals */}
      <DemoInstallModal
        show={showDemoModal}
        onClose={() => setShowDemoModal(false)}
        t={t}
      />
      <DemoIOSInstructions
        show={showDemoIOSModal}
        onClose={() => setShowDemoIOSModal(false)}
        t={t}
      />
    </div>
  )
}

// Demo Install Modal Component (always renders when show=true)
function DemoInstallModal({
  show,
  onClose,
  t
}: {
  show: boolean
  onClose: () => void
  t: (key: string) => string
}) {
  return (
    <AnimatePresence>
      {show && (
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
                  onClick={onClose}
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
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl transition-all font-semibold text-sm shadow-lg shadow-primary-500/25"
              >
                <Download className="w-4 h-4" />
                {t('pwa.install.button')}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all font-medium text-sm"
              >
                {t('pwa.install.later')}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Demo iOS Instructions Component
function DemoIOSInstructions({
  show,
  onClose,
  t
}: {
  show: boolean
  onClose: () => void
  t: (key: string) => string
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 bg-black/50 backdrop-blur-sm overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm mx-auto my-auto overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-500 to-accent-500 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-5 h-5 text-primary-600" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white truncate">
                    {t('pwa.install.ios.instructions')}
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  className="text-white/70 hover:text-white flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Steps */}
            <div className="p-4 sm:p-5 space-y-4">
              {/* Step 1 */}
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                    1
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200 font-medium break-words">
                      {t('pwa.install.ios.step1')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-start p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-gray-300/40 dark:bg-gray-600/40 flex items-center justify-center">
                        <MoreHorizontal className="w-6 h-6 text-blue-500" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                    2
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200 font-medium break-words">
                      {t('pwa.install.ios.step2')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-start p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
                      <Share className="w-6 h-6 text-blue-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                    3
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200 font-medium break-words">
                      {t('pwa.install.ios.step3')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-start p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-gray-300/40 dark:bg-gray-600/40 flex items-center justify-center">
                        <MoreHorizontal className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                    4
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200 font-medium break-words">
                      {t('pwa.install.ios.step4')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-start p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
                      <SquarePlus className="w-6 h-6 text-green-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 pt-0 sm:pt-0">
              <button
                onClick={onClose}
                className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors text-sm sm:text-base"
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

function StateItem({
  label,
  value,
  className = ''
}: {
  label: string
  value: boolean | string | number
  className?: string
}) {
  const displayValue = typeof value === 'boolean'
    ? (value ? '✅ Yes' : '❌ No')
    : value

  const colorClass = typeof value === 'boolean'
    ? (value ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')
    : 'text-foreground'

  return (
    <div className={`p-4 bg-accent/5 rounded-lg border border-border/50 ${className}`}>
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-semibold ${colorClass}`}>
        {displayValue}
      </div>
    </div>
  )
}
