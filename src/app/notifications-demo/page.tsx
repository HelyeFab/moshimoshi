'use client'

import React, { useState } from 'react'
import { ReviewNotificationSettings } from '@/components/notifications/ReviewNotificationSettings'
import { ReviewNotificationContainer } from '@/components/notifications/ReviewNotificationToast'
import { useReviewNotifications } from '@/hooks/useReviewNotifications'
import { Bell, Clock, Play, Sparkles } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

export default function NotificationsDemoPage() {
  const { t } = useI18n()
  const {
    testNotification,
    scheduleNotificationForItem,
    getScheduledNotifications
  } = useReviewNotifications()
  
  const [scheduledCount, setScheduledCount] = useState(0)

  const handleTestImmediate = () => {
    testNotification()
  }

  const handleSchedule10Seconds = () => {
    const futureTime = new Date(Date.now() + 10 * 1000) // 10 seconds
    scheduleNotificationForItem({
      id: 'demo-10s',
      content: 'あ',
      meaning: 'a (hiragana)',
      contentType: 'hiragana',
      nextReviewAt: futureTime
    })
    updateScheduledCount()
  }

  const handleSchedule30Seconds = () => {
    const futureTime = new Date(Date.now() + 30 * 1000) // 30 seconds
    scheduleNotificationForItem({
      id: 'demo-30s',
      content: '水',
      meaning: 'water (mizu)',
      contentType: 'kanji',
      nextReviewAt: futureTime
    })
    updateScheduledCount()
  }

  const handleSchedule1Minute = () => {
    const futureTime = new Date(Date.now() + 60 * 1000) // 1 minute
    scheduleNotificationForItem({
      id: 'demo-1m',
      content: '学校',
      meaning: 'school (gakkou)',
      contentType: 'vocabulary',
      nextReviewAt: futureTime
    })
    updateScheduledCount()
  }

  const updateScheduledCount = () => {
    const scheduled = getScheduledNotifications()
    setScheduledCount(scheduled.length)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-light/90 dark:from-dark-900 dark:to-dark-850">
      {/* Notification Container (top-right toasts) */}
      <ReviewNotificationContainer />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-3">
            <Bell className="w-8 h-8 text-primary-500" />
            Review Notifications Demo
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Test the new notification system for SRS reviews
          </p>
        </div>

        {/* Settings Panel */}
        <div className="mb-8">
          <ReviewNotificationSettings />
        </div>

        {/* Test Controls */}
        <div className="bg-soft-white dark:bg-dark-800 rounded-2xl p-6 border border-gray-200 dark:border-dark-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Test Notifications
          </h3>

          <div className="space-y-4">
            {/* Immediate Notification */}
            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                Immediate Notification
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Show a notification immediately (as if review is overdue)
              </p>
              <button
                onClick={handleTestImmediate}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105"
              >
                <Play className="w-4 h-4 inline mr-2" />
                Test Now
              </button>
            </div>

            {/* Scheduled Notifications */}
            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                Schedule Future Notifications
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Schedule notifications at typical SRS intervals
              </p>
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSchedule10Seconds}
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                >
                  <Clock className="w-4 h-4 inline mr-1" />
                  10 seconds
                </button>
                
                <button
                  onClick={handleSchedule30Seconds}
                  className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                >
                  <Clock className="w-4 h-4 inline mr-1" />
                  30 seconds
                </button>
                
                <button
                  onClick={handleSchedule1Minute}
                  className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                >
                  <Clock className="w-4 h-4 inline mr-1" />
                  1 minute
                </button>
              </div>

              {scheduledCount > 0 && (
                <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  {scheduledCount} notification{scheduledCount !== 1 ? 's' : ''} scheduled
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                How It Works
              </h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• When tab is visible: Beautiful in-app toast notifications</li>
                <li>• When tab is in background: Browser system notifications</li>
                <li>• Notifications persist across page refreshes</li>
                <li>• Each content type has unique sound and color</li>
                <li>• Snooze options: 10 minutes or 30 minutes</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
              🎨 Beautiful Design
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Glassmorphic toasts with smooth animations and gradient backgrounds
            </p>
          </div>

          <div className="p-4 bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 rounded-xl">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
              🎯 Smart Targeting
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Automatically switches between in-app and browser notifications
            </p>
          </div>

          <div className="p-4 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
              🔄 Persistent
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Scheduled notifications survive page refreshes and browser restarts
            </p>
          </div>

          <div className="p-4 bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-xl">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
              🎵 Audio Feedback
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Unique chimes for each content type (hiragana, katakana, kanji)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}