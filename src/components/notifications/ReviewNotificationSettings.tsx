'use client'

import React, { useState, useEffect } from 'react'
import { Bell, BellOff, Volume2, VolumeX, Check, X, AlertCircle, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { useReviewNotifications } from '@/hooks/useReviewNotifications'

export function ReviewNotificationSettings() {
  const { t } = useI18n()
  const {
    requestPermission,
    getPermissionStatus,
    setEnabled,
    setSoundEnabled,
    testNotification,
    getScheduledNotifications
  } = useReviewNotifications()

  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [soundEnabled, setSoundEnabledState] = useState(true)
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [scheduledCount, setScheduledCount] = useState(0)

  useEffect(() => {
    // Load initial state
    setPermission(getPermissionStatus())
    setNotificationsEnabled(localStorage.getItem('notifications_enabled') !== 'false')
    setSoundEnabledState(localStorage.getItem('notification_sound_enabled') !== 'false')
    
    // Update scheduled count
    const updateScheduledCount = () => {
      const scheduled = getScheduledNotifications()
      setScheduledCount(scheduled.length)
    }
    
    updateScheduledCount()
    const interval = setInterval(updateScheduledCount, 5000)
    
    return () => clearInterval(interval)
  }, [])

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true)
    
    try {
      const result = await requestPermission()
      setPermission(result)
      
      if (result === 'granted') {
        setShowSuccess(true)
        setTimeout(() => setShowSuccess(false), 3000)
      }
    } finally {
      setIsRequestingPermission(false)
    }
  }

  const handleToggleNotifications = () => {
    const newState = !notificationsEnabled
    setNotificationsEnabled(newState)
    setEnabled(newState)
  }

  const handleToggleSound = () => {
    const newState = !soundEnabled
    setSoundEnabledState(newState)
    setSoundEnabled(newState)
  }

  const handleTestNotification = () => {
    testNotification()
  }

  return (
    <div className="bg-soft-white dark:bg-dark-800 rounded-2xl p-6 border border-gray-200 dark:border-dark-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          {t('settings.reviewNotifications')}
        </h3>
        {scheduledCount > 0 && (
          <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-full">
            {scheduledCount} scheduled
          </span>
        )}
      </div>

      {/* Permission Status Card */}
      <div className="mb-6">
        {permission === 'default' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200 dark:border-blue-800 rounded-xl"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                  Enable Browser Notifications
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Get reminded when your reviews are due, even when the tab is in the background.
                </p>
                <button
                  onClick={handleRequestPermission}
                  disabled={isRequestingPermission}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRequestingPermission ? 'Requesting...' : 'Enable Notifications'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {permission === 'granted' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  Notifications Enabled
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  You'll receive notifications when reviews are due.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {permission === 'denied' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <X className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                  Notifications Blocked
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Browser notifications are blocked. Please enable them in your browser settings to receive review reminders.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Settings Toggles */}
      <div className="space-y-4">
        {/* Enable/Disable Notifications */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
          <div className="flex items-center gap-3">
            {notificationsEnabled ? (
              <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            )}
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                Review Reminders
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Show notifications when reviews are due
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleNotifications}
            className={cn(
              'relative w-12 h-6 rounded-full transition-colors',
              notificationsEnabled
                ? 'bg-gradient-to-r from-blue-500 to-purple-500'
                : 'bg-gray-300 dark:bg-gray-600'
            )}
          >
            <motion.div
              className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md"
              animate={{ x: notificationsEnabled ? 24 : 2 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            />
          </button>
        </div>

        {/* Sound Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
          <div className="flex items-center gap-3">
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <VolumeX className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            )}
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                Notification Sounds
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Play sound when notifications appear
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleSound}
            className={cn(
              'relative w-12 h-6 rounded-full transition-colors',
              soundEnabled
                ? 'bg-gradient-to-r from-blue-500 to-purple-500'
                : 'bg-gray-300 dark:bg-gray-600'
            )}
            disabled={!notificationsEnabled}
          >
            <motion.div
              className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md"
              animate={{ x: soundEnabled ? 24 : 2 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            />
          </button>
        </div>
      </div>

      {/* Test Notification Button */}
      {permission === 'granted' && notificationsEnabled && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-6"
        >
          <button
            onClick={handleTestNotification}
            className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Test Notification
          </button>
        </motion.div>
      )}

      {/* Success Animation */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-4 right-4 p-4 bg-green-500 text-white rounded-xl shadow-lg flex items-center gap-3"
          >
            <Check className="w-5 h-5" />
            <span className="font-medium">Notifications enabled successfully!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}