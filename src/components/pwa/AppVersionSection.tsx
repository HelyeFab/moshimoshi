'use client'

import { useState, useCallback, useEffect } from 'react'
import { RefreshCw, Check, AlertCircle, Download, Share, Smartphone, X } from 'lucide-react'
import { skipWaiting } from '@/lib/pwa/registerServiceWorker'
import { useI18n } from '@/i18n/I18nContext'
import { a2hsManager } from '@/lib/pwa/a2hs'

// Must match the version in ServiceWorkerProvider.tsx
const APP_VERSION = '1.0.3'

interface VersionInfo {
  version: string
  critical?: boolean
  message?: string
}

type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'update-available' | 'error'

export function AppVersionSection() {
  const { t } = useI18n()
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [serverVersion, setServerVersion] = useState<string | null>(null)
  const [isCritical, setIsCritical] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)

  useEffect(() => {
    // Check if PWA can be installed
    const checkInstallability = () => {
      const canPrompt = a2hsManager.canPrompt()
      const isInstalled = a2hsManager.isAppInstalled()
      const shouldShow = canPrompt && !isInstalled

      console.log('[AppVersionSection] Install button check:', {
        canPrompt,
        isInstalled,
        shouldShow,
        platform: a2hsManager.getPlatform()
      })

      setCanInstall(shouldShow)
    }

    checkInstallability()

    // Listen for availability changes
    const unsubscribe = a2hsManager.onAvailabilityChange((available) => {
      console.log('[AppVersionSection] Availability changed:', available)
      checkInstallability()
    })

    return () => unsubscribe()
  }, [])

  const checkForUpdates = useCallback(async () => {
    setStatus('checking')

    try {
      // Fetch version info from server
      const response = await fetch('/version.json', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch version info')
      }

      const versionInfo: VersionInfo = await response.json()
      setServerVersion(versionInfo.version)
      setIsCritical(versionInfo.critical === true)

      if (versionInfo.version !== APP_VERSION) {
        setStatus('update-available')
      } else {
        setStatus('up-to-date')
        // Reset to idle after 3 seconds
        setTimeout(() => setStatus('idle'), 3000)
      }

      // Also trigger service worker update check
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        await registration.update()
      }
    } catch (error) {
      console.error('[AppVersion] Failed to check for updates:', error)
      setStatus('error')
      // Reset to idle after 3 seconds
      setTimeout(() => setStatus('idle'), 3000)
    }
  }, [])

  const handleUpdate = useCallback(async () => {
    setIsUpdating(true)
    try {
      const registration = await navigator.serviceWorker?.ready
      await skipWaiting(registration)
    } catch (error) {
      console.error('[AppVersion] Failed to apply update:', error)
      // Force reload as fallback
      window.location.reload()
    }
  }, [])

  const handleInstall = useCallback(async () => {
    const platform = a2hsManager.getPlatform()

    if (platform === 'ios') {
      setShowIOSInstructions(true)
      return
    }

    setIsInstalling(true)
    try {
      const outcome = await a2hsManager.prompt()

      if (outcome === 'accepted') {
        setCanInstall(false)
      }
    } catch (error) {
      console.error('[AppVersion] Failed to install:', error)
    } finally {
      setIsInstalling(false)
    }
  }, [])

  // i18n path prefix for app info version strings
  const i18nPrefix = 'settings.sections.appInfo.version'

  return (
    <>
      <div className="p-4 bg-gray-50 dark:bg-dark-900/50 rounded-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📱</span>
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {t(`${i18nPrefix}.title`) || 'App Version'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                v{APP_VERSION}
                {status === 'update-available' && serverVersion && (
                  <span className="ml-2 text-primary-500">
                    → v{serverVersion} {t(`${i18nPrefix}.available`) || 'available'}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {status === 'update-available' ? (
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className={`
                  w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all
                  ${
                    isCritical
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-primary-500 hover:bg-primary-600 text-white'
                  }
                  disabled:opacity-50
                `}
              >
                <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
                {isUpdating ? t('pwa.updating') || 'Updating...' : t('pwa.updateNow') || 'Update Now'}
              </button>
            ) : (
              <button
                onClick={checkForUpdates}
                disabled={status === 'checking'}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 rounded-lg font-medium text-sm text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50"
              >
                {status === 'checking' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {t(`${i18nPrefix}.checking`) || 'Checking...'}
                  </>
                ) : status === 'up-to-date' ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    {t(`${i18nPrefix}.upToDate`) || 'Up to date'}
                  </>
                ) : status === 'error' ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    {t(`${i18nPrefix}.error`) || 'Check failed'}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    {t(`${i18nPrefix}.checkButton`) || 'Check for Updates'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {status === 'update-available' && isCritical && (
          <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">
              {t(`${i18nPrefix}.criticalMessage`) ||
                'This is an important update with critical fixes. Please update as soon as possible.'}
            </p>
          </div>
        )}
      </div>

      {/* Install PWA Button - only shows if not installed */}
      {canInstall && (
        <div className="mt-3 p-4 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-primary-900/20 dark:to-accent-900/20 rounded-xl border border-primary-200 dark:border-primary-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📲</span>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {t('pwa.install.title') || 'Install App'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('pwa.install.settingsDescription') || 'Add Moshimoshi to your home screen for quick access'}
                </p>
              </div>
            </div>

            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-all shadow-md shadow-primary-500/25"
            >
              {a2hsManager.getPlatform() === 'ios' ? (
                <>
                  <Share className="w-4 h-4" />
                  {t('pwa.install.button') || 'Install'}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  {isInstalling ? t('pwa.installing') || 'Installing...' : t('pwa.install.button') || 'Install'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowIOSInstructions(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-500 to-accent-500 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-primary-600" />
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    {t('pwa.install.ios.instructions') || 'How to Install'}
                  </h3>
                </div>
                <button onClick={() => setShowIOSInstructions(false)} className="text-white/70 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Steps */}
            <div className="p-5 space-y-4">
              {a2hsManager.getInstallInstructions().steps.map((step, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-800 dark:text-gray-200 font-medium">{step}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 pt-0">
              <button
                onClick={() => setShowIOSInstructions(false)}
                className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
              >
                {t('common.gotIt') || 'Got it!'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
