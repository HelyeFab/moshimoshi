'use client'

import { useState, useCallback } from 'react'
import { RefreshCw, Check, AlertCircle } from 'lucide-react'
import { skipWaiting } from '@/lib/pwa/registerServiceWorker'
import { useI18n } from '@/i18n/I18nContext'

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

  return (
    <div className="p-4 bg-gray-50 dark:bg-dark-900/50 rounded-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📱</span>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {t('settings.appVersion.title') || 'App Version'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              v{APP_VERSION}
              {status === 'update-available' && serverVersion && (
                <span className="ml-2 text-primary-500">
                  → v{serverVersion} {t('settings.appVersion.available') || 'available'}
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
                  {t('settings.appVersion.checking') || 'Checking...'}
                </>
              ) : status === 'up-to-date' ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  {t('settings.appVersion.upToDate') || 'Up to date'}
                </>
              ) : status === 'error' ? (
                <>
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  {t('settings.appVersion.error') || 'Check failed'}
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  {t('settings.appVersion.checkButton') || 'Check for Updates'}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {status === 'update-available' && isCritical && (
        <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">
            {t('settings.appVersion.criticalMessage') ||
              'This is an important update with critical fixes. Please update as soon as possible.'}
          </p>
        </div>
      )}
    </div>
  )
}
