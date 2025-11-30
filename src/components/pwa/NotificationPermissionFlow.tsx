'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, X, Clock, Check, AlertCircle, Send, Loader2 } from 'lucide-react'
import { notificationManager, QuietHours } from '@/lib/pwa/notifications'
import { useI18n } from '@/i18n/I18nContext'
import { canCurrentUser } from '@/lib/pwa/entitlements'
import { usePushNotifications } from '@/hooks/usePushNotifications'

export function NotificationPermissionFlow() {
  const { t } = useI18n()
  const [showPrompt, setShowPrompt] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [showSettings, setShowSettings] = useState(false)
  const [quietHours, setQuietHours] = useState<QuietHours | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [testingPush, setTestingPush] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // FCM push notifications hook
  const { initialize: initializePush, isInitialized: isPushInitialized } = usePushNotifications()

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

    if (result === 'granted') {
      // Initialize FCM push notifications
      await initializePush()
      setShowPrompt(false)
      setShowSettings(true)
    }

    setRequesting(false)
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

  // Test server-side push notification (FCM)
  const handleTestPushNotification = async () => {
    setTestingPush(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: 'push',
          type: 'review_due',
        }),
      })

      const data = await response.json()

      if (response.ok && data.results?.push?.success) {
        setTestResult({
          success: true,
          message: t('pwa.notifications.test.success') || 'Push notification sent! Check your device.',
        })
      } else {
        const errorMsg = data.results?.push?.error || data.error || 'Failed to send'
        setTestResult({
          success: false,
          message: errorMsg,
        })
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Network error',
      })
    } finally {
      setTestingPush(false)
      // Clear result after 5 seconds
      setTimeout(() => setTestResult(null), 5000)
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

            {/* Test notification buttons */}
            <div className="space-y-2">
              <button
                onClick={handleTestNotification}
                className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg transition-colors text-sm font-medium"
              >
                {t('pwa.notifications.test.button')}
              </button>

              {/* Server-side Push Test (FCM) */}
              <button
                onClick={handleTestPushNotification}
                disabled={testingPush}
                className="w-full px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                {testingPush ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('common.processing') || 'Sending...'}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t('pwa.notifications.test.pushButton') || 'Test Server Push (FCM)'}
                  </>
                )}
              </button>

              {/* Test result feedback */}
              {testResult && (
                <div
                  className={`p-2 rounded-lg text-xs ${
                    testResult.success
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                  }`}
                >
                  {testResult.success ? (
                    <div className="flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      {testResult.message}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {testResult.message}
                    </div>
                  )}
                </div>
              )}
            </div>
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