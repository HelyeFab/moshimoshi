'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, X, Clock, Check, AlertCircle } from 'lucide-react'
import { notificationManager, QuietHours } from '@/lib/pwa/notifications'
import { useI18n } from '@/i18n/I18nContext'
import { canCurrentUser } from '@/lib/pwa/entitlements'

export function NotificationPermissionFlow() {
  const { t } = useI18n()
  const [showPrompt, setShowPrompt] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [showSettings, setShowSettings] = useState(false)
  const [quietHours, setQuietHours] = useState<QuietHours | null>(null)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    // Check if user can use notifications
    if (!canCurrentUser('push')) {
      return
    }

    // Check current permission status
    const currentPermission = notificationManager.getPermission()
    setPermission(currentPermission)

    // Load quiet hours settings
    const savedQuietHours = notificationManager.getQuietHours()
    setQuietHours(savedQuietHours)

    // Auto-show prompt if conditions are met
    if (notificationManager.shouldPromptForPermission()) {
      setTimeout(() => {
        setShowPrompt(true)
      }, 5000) // Show after 5 seconds
    }
  }, [])

  const handleRequestPermission = async () => {
    setRequesting(true)
    const result = await notificationManager.requestPermission()
    setPermission(result)
    setRequesting(false)

    if (result === 'granted') {
      setShowPrompt(false)
      setShowSettings(true)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    // Store dismissal to avoid showing again too soon
    localStorage.setItem('notification_prompt_dismissed', new Date().toISOString())
  }

  const handleTestNotification = async () => {
    const success = await notificationManager.sendTestNotification()
    if (!success && permission === 'default') {
      setShowPrompt(true)
    }
  }

  const handleQuietHoursChange = (updates: Partial<QuietHours>) => {
    const newQuietHours = {
      ...quietHours,
      ...updates,
      enabled: quietHours?.enabled ?? false,
      startTime: quietHours?.startTime ?? '22:00',
      endTime: quietHours?.endTime ?? '08:00'
    } as QuietHours

    setQuietHours(newQuietHours)
    notificationManager.setQuietHours(newQuietHours)
  }

  // Don't show if not supported
  if (!notificationManager.isSupported()) {
    return null
  }

  // Permission request prompt
  if (showPrompt && permission === 'default') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:bottom-4 sm:right-4 sm:left-auto sm:max-w-sm">
        <div className="bg-soft-white dark:bg-dark-850 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-primary-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('pwa.notifications.permission.title')}
              </h3>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              aria-label={t('common.dismiss')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {t('pwa.notifications.permission.description')}
            </p>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleRequestPermission}
                disabled={requesting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg transition-colors font-medium text-sm"
              >
                <Bell className="w-4 h-4" />
                {requesting ? t('common.processing') : t('pwa.notifications.permission.allow')}
              </button>

              <button
                onClick={handleDismiss}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium text-sm transition-colors"
              >
                {t('pwa.notifications.permission.deny')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Settings panel (shown after permission granted)
  if (showSettings || permission === 'granted') {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="bg-primary-500 hover:bg-primary-600 text-white p-3 rounded-full shadow-lg transition-colors"
          aria-label={t('pwa.notifications.permission.title')}
        >
          <Bell className="w-5 h-5" />
        </button>

        {showSettings && (
          <div className="absolute bottom-16 right-0 w-80 bg-soft-white dark:bg-dark-850 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                {t('pwa.notifications.permission.title')}
              </h4>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Permission status */}
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <Check className="w-4 h-4" />
                <span className="text-sm">{t('pwa.notifications.permission.allow')}</span>
              </div>
            </div>

            {/* Quiet hours */}
            <div className="mb-4">
              <label className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t('pwa.notifications.quietHours.title')}
                </span>
                <input
                  type="checkbox"
                  checked={quietHours?.enabled ?? false}
                  onChange={(e) => handleQuietHoursChange({ enabled: e.target.checked })}
                  className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
              </label>

              {quietHours?.enabled && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600 dark:text-gray-400">
                        {t('pwa.notifications.quietHours.start')}
                      </label>
                      <input
                        type="time"
                        value={quietHours.startTime}
                        onChange={(e) => handleQuietHoursChange({ startTime: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 dark:text-gray-400">
                        {t('pwa.notifications.quietHours.end')}
                      </label>
                      <input
                        type="time"
                        value={quietHours.endTime}
                        onChange={(e) => handleQuietHoursChange({ endTime: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {t('pwa.notifications.quietHours.description')}
                  </p>
                </div>
              )}
            </div>

            {/* Test notification button */}
            <button
              onClick={handleTestNotification}
              className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg transition-colors text-sm font-medium"
            >
              {t('pwa.notifications.test.button')}
            </button>
          </div>
        )}
      </div>
    )
  }

  // Notification blocked warning
  if (permission === 'denied') {
    return (
      <div className="fixed bottom-4 right-4 z-40 max-w-sm">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {t('pwa.notifications.permission.blocked')}
              </p>
              <button
                onClick={() => setShowSettings(false)}
                className="text-xs text-yellow-600 dark:text-yellow-400 underline mt-1"
              >
                {t('common.dismiss')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}