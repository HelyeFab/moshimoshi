'use client'

import React, { useState, useEffect } from 'react'
import { Bell, Clock, Moon, Volume2, Smartphone } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useI18n } from '@/i18n/I18nContext'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

interface NotificationPreferences {
  channels: {
    browser: boolean
    inApp: boolean
    push: boolean
    email: boolean
  }
  timing: {
    immediate: boolean
    daily: boolean
    overdue: boolean
  }
  quiet_hours: {
    enabled: boolean
    start: string
    end: string
    timezone: string
  }
  batching: {
    enabled: boolean
    window_minutes: number
  }
}

export function NotificationSettings() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [preferences, setPreferences] = useState<NotificationPreferences>({
    channels: {
      browser: false,
      inApp: true,
      push: false,
      email: false
    },
    timing: {
      immediate: true,
      daily: true,
      overdue: true
    },
    quiet_hours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    batching: {
      enabled: true,
      window_minutes: 5
    }
  })

  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (user) {
      loadPreferences()
      checkBrowserPermission()
    }
  }, [user])

  const loadPreferences = async () => {
    if (!user) return

    try {
      const docRef = doc(db, 'notifications_preferences', user.uid)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        setPreferences(docSnap.data() as NotificationPreferences)
      }
    } catch (error) {
      console.error('Failed to load preferences:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkBrowserPermission = () => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission)
    }
  }

  const savePreferences = async () => {
    if (!user) return

    setSaving(true)
    try {
      const docRef = doc(db, 'notifications_preferences', user.uid)
      await setDoc(docRef, {
        ...preferences,
        userId: user.uid,
        updated_at: new Date()
      })

      showToast(t('settings.notifications.saveSuccess'), 'success')
    } catch (error) {
      console.error('Failed to save preferences:', error)
      showToast(t('settings.notifications.saveError'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const requestBrowserPermission = async () => {
    if (!('Notification' in window)) {
      showToast(t('settings.notifications.browserNotSupported'), 'error')
      return
    }

    const permission = await Notification.requestPermission()
    setBrowserPermission(permission)

    if (permission === 'granted') {
      setPreferences(prev => ({
        ...prev,
        channels: { ...prev.channels, browser: true }
      }))
      showToast(t('settings.notifications.browserEnabled'), 'success')
    } else if (permission === 'denied') {
      showToast(t('settings.notifications.browserDenied'), 'error')
    }
  }

  const testNotification = async () => {
    if (browserPermission !== 'granted') {
      showToast(t('settings.notifications.enableBrowserFirst'), 'warning')
      return
    }

    const notification = new Notification(t('settings.notifications.test.title'), {
      body: t('settings.notifications.test.body'),
      icon: '/icons/icon-192x192.svg',
      badge: '/icons/icon-72x72.svg',
      requireInteraction: true
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  }

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>
  }

  return (
    <div className="space-y-6">
      {/* Notification Channels */}
      <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          {t('settings.notifications.channels.title')}
        </h3>

        <div className="space-y-4">
          {/* Browser Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="font-medium text-sm">
                {t('settings.notifications.channels.browser.label')}
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('settings.notifications.channels.browser.description')}
              </p>
            </div>
            {browserPermission === 'default' ? (
              <button
                onClick={requestBrowserPermission}
                className="px-3 py-1.5 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors text-sm"
              >
                {t('common.enable')}
              </button>
            ) : browserPermission === 'granted' ? (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.channels.browser}
                  onChange={(e) =>
                    setPreferences(prev => ({
                      ...prev,
                      channels: { ...prev.channels, browser: e.target.checked }
                    }))
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
              </label>
            ) : (
              <span className="text-sm text-red-500">{t('settings.notifications.blocked')}</span>
            )}
          </div>

          {/* In-App Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="font-medium text-sm">
                {t('settings.notifications.channels.inApp.label')}
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('settings.notifications.channels.inApp.description')}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.channels.inApp}
                onChange={(e) =>
                  setPreferences(prev => ({
                    ...prev,
                    channels: { ...prev.channels, inApp: e.target.checked }
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
            </label>
          </div>

          {/* Push Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="font-medium text-sm flex items-center gap-1">
                {t('settings.notifications.channels.push.label')}
                <Smartphone className="w-4 h-4" />
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('settings.notifications.channels.push.description')}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.channels.push}
                onChange={(e) =>
                  setPreferences(prev => ({
                    ...prev,
                    channels: { ...prev.channels, push: e.target.checked }
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Timing Preferences */}
      <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {t('settings.notifications.timing.title')}
        </h3>

        <div className="space-y-4">
          {/* Immediate Reviews */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="font-medium text-sm">
                {t('settings.notifications.timing.immediate.label')}
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('settings.notifications.timing.immediate.description')}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.timing.immediate}
                onChange={(e) =>
                  setPreferences(prev => ({
                    ...prev,
                    timing: { ...prev.timing, immediate: e.target.checked }
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
            </label>
          </div>

          {/* Daily Reviews */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="font-medium text-sm">
                {t('settings.notifications.timing.daily.label')}
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('settings.notifications.timing.daily.description')}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.timing.daily}
                onChange={(e) =>
                  setPreferences(prev => ({
                    ...prev,
                    timing: { ...prev.timing, daily: e.target.checked }
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Moon className="w-5 h-5" />
          {t('settings.notifications.quietHours.title')}
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="font-medium text-sm">
                {t('settings.notifications.quietHours.enable')}
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('settings.notifications.quietHours.description')}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.quiet_hours.enabled}
                onChange={(e) =>
                  setPreferences(prev => ({
                    ...prev,
                    quiet_hours: { ...prev.quiet_hours, enabled: e.target.checked }
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
            </label>
          </div>

          {preferences.quiet_hours.enabled && (
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">
                  {t('settings.notifications.quietHours.start')}
                </label>
                <input
                  type="time"
                  value={preferences.quiet_hours.start}
                  onChange={(e) =>
                    setPreferences(prev => ({
                      ...prev,
                      quiet_hours: { ...prev.quiet_hours, start: e.target.value }
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">
                  {t('settings.notifications.quietHours.end')}
                </label>
                <input
                  type="time"
                  value={preferences.quiet_hours.end}
                  onChange={(e) =>
                    setPreferences(prev => ({
                      ...prev,
                      quiet_hours: { ...prev.quiet_hours, end: e.target.value }
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={savePreferences}
          disabled={saving}
          className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? t('common.saving') : t('common.saveChanges')}
        </button>

        <button
          onClick={testNotification}
          disabled={!preferences.channels.browser || browserPermission !== 'granted'}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Volume2 className="w-4 h-4" />
          {t('settings.notifications.testNotification')}
        </button>
      </div>
    </div>
  )
}