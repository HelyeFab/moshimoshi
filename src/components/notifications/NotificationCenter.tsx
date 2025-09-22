'use client'

import React from 'react'
import { Bell, Clock, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { useInAppNotifications } from './InAppNotificationProvider'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export function NotificationCenter() {
  const { notifications, countdowns, removeNotification, clearAll } = useInAppNotifications()
  const { t } = useI18n()

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case 'review_due':
        return <Clock className="w-5 h-5 text-primary-500" />
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return t('notifications.center.justNow')
    if (minutes < 60) return t('notifications.center.minutesAgo', { minutes })
    if (hours < 24) return t('notifications.center.hoursAgo', { hours })
    return t('notifications.center.daysAgo', { days })
  }

  return (
    <div className="bg-white dark:bg-dark-850 rounded-lg shadow-lg max-w-md w-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5" />
          {t('notifications.center.title')}
        </h3>
        {notifications.length > 0 && (
          <button
            onClick={clearAll}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {t('notifications.center.clearAll')}
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 && countdowns.size === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{t('notifications.center.empty')}</p>
          </div>
        ) : (
          <>
            {/* Active Countdowns */}
            {countdowns.size > 0 && (
              <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('notifications.center.upcoming')}
                </div>
                {Array.from(countdowns.entries()).map(([itemId, dueDate]) => {
                  const timeLeft = dueDate.getTime() - Date.now()
                  const minutes = Math.floor(timeLeft / 60000)
                  return (
                    <Link
                      key={itemId}
                      href={`/review?item=${itemId}`}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Clock className="w-5 h-5 text-primary-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{t('notifications.center.reviewIn', { minutes })}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('notifications.center.itemId', { id: itemId })}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Past Notifications */}
            {notifications.map(notification => (
              <div
                key={notification.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{notification.title}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    {notification.body}
                  </p>
                  {notification.actionUrl && (
                    <Link
                      href={notification.actionUrl}
                      className="text-xs text-primary-500 hover:text-primary-600 mt-1 inline-block"
                    >
                      {t('notifications.center.viewDetails')}
                    </Link>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {formatTime(notification.timestamp)}
                  </p>
                </div>
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                  aria-label={t('common.dismiss')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}