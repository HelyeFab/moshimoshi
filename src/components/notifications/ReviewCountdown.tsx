'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Clock, Play } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'

interface ReviewCountdownProps {
  itemId: string
  dueDate: Date
  onComplete: () => void
}

export function ReviewCountdown({ itemId, dueDate, onComplete }: ReviewCountdownProps) {
  const { t } = useI18n()
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [isOverdue, setIsOverdue] = useState(false)

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now()
      const diff = dueDate.getTime() - now

      if (diff <= 0) {
        setIsOverdue(true)
        setTimeLeft(t('notifications.countdown.dueNow'))
        onComplete()
        return
      }

      const minutes = Math.floor(diff / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)

      if (minutes > 0) {
        setTimeLeft(t('notifications.countdown.minutesSeconds', { minutes, seconds }))
      } else {
        setTimeLeft(t('notifications.countdown.seconds', { seconds }))
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [dueDate, onComplete, t])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={cn(
        'flex items-center gap-3 px-4 py-2 rounded-lg backdrop-blur-sm',
        isOverdue
          ? 'bg-red-500/90 text-white'
          : 'bg-gray-900/90 text-white dark:bg-gray-100/90 dark:text-gray-900'
      )}
    >
      <Clock className={cn('w-5 h-5', isOverdue && 'animate-pulse')} />

      <div className="flex-1">
        <div className="text-xs opacity-75">{t('notifications.countdown.nextReview')}</div>
        <div className="font-mono font-semibold">{timeLeft}</div>
      </div>

      {isOverdue && (
        <Link
          href={`/review?item=${itemId}`}
          className="flex items-center gap-1 px-3 py-1 bg-white/20 rounded hover:bg-white/30 transition-colors"
        >
          <Play className="w-4 h-4" />
          <span className="text-sm">{t('notifications.countdown.start')}</span>
        </Link>
      )}
    </motion.div>
  )
}