'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { X, AlertCircle, CheckCircle, Info, Clock } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'

interface NotificationToastProps {
  notification: {
    id: string
    title: string
    body: string
    type: 'info' | 'success' | 'warning' | 'review_due'
    actionUrl?: string
    persistent?: boolean
    timestamp: Date
  }
  onDismiss: () => void
}

export function NotificationToast({ notification, onDismiss }: NotificationToastProps) {
  const { t } = useI18n()

  const icons = {
    info: <Info className="w-5 h-5" />,
    success: <CheckCircle className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    review_due: <Clock className="w-5 h-5" />
  }

  const colors = {
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100',
    success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-100',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-100',
    review_due: 'bg-primary-50 border-primary-200 text-primary-800 dark:bg-primary-900/20 dark:border-primary-800 dark:text-primary-100'
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={cn(
        'relative w-80 p-4 rounded-lg border shadow-lg pointer-events-auto',
        colors[notification.type]
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {icons[notification.type]}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm">
            {notification.title}
          </h4>
          <p className="mt-1 text-sm opacity-90">
            {notification.body}
          </p>

          {notification.actionUrl && (
            <Link
              href={notification.actionUrl}
              className="inline-block mt-2 text-sm font-medium underline hover:no-underline"
              onClick={onDismiss}
            >
              {t('notifications.goToReview')}
            </Link>
          )}
        </div>

        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          aria-label={t('common.dismiss')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar for auto-dismiss */}
      {!notification.persistent && (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: 5, ease: 'linear' }}
          className="absolute bottom-0 left-0 right-0 h-1 bg-current opacity-30 origin-left"
        />
      )}
    </motion.div>
  )
}