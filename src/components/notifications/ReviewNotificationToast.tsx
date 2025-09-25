'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, X, Play, ChevronRight, Volume2, VolumeX } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'

interface ReviewNotification {
  id: string
  itemId: string
  content: string
  meaning: string
  contentType: 'hiragana' | 'katakana' | 'kanji' | 'vocabulary' | 'sentence'
  scheduledFor: Date
}

interface ReviewNotificationToastProps {
  notification: ReviewNotification
  onDismiss: () => void
  onSnooze?: (minutes: number) => void
  soundEnabled?: boolean
}

export function ReviewNotificationToast({
  notification,
  onDismiss,
  onSnooze,
  soundEnabled = true
}: ReviewNotificationToastProps) {
  const { t } = useI18n()
  const [timeOverdue, setTimeOverdue] = useState<string>('')
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    const updateOverdueTime = () => {
      const now = Date.now()
      const overdueMs = now - notification.scheduledFor.getTime()
      
      if (overdueMs < 60000) {
        setTimeOverdue('Just now')
      } else {
        const minutes = Math.floor(overdueMs / 60000)
        if (minutes < 60) {
          setTimeOverdue(`${minutes}m overdue`)
        } else {
          const hours = Math.floor(minutes / 60)
          setTimeOverdue(`${hours}h overdue`)
        }
      }
    }

    updateOverdueTime()
    const interval = setInterval(updateOverdueTime, 10000) // Update every 10 seconds

    return () => clearInterval(interval)
  }, [notification.scheduledFor])

  const getContentTypeColor = () => {
    const colors = {
      hiragana: 'from-blue-500 to-blue-600',
      katakana: 'from-green-500 to-green-600',
      kanji: 'from-purple-500 to-purple-600',
      vocabulary: 'from-orange-500 to-orange-600',
      sentence: 'from-pink-500 to-pink-600'
    }
    return colors[notification.contentType] || 'from-gray-500 to-gray-600'
  }

  const getContentTypeLabel = () => {
    const labels = {
      hiragana: 'Hiragana',
      katakana: 'Katakana',
      kanji: 'Kanji',
      vocabulary: 'Vocabulary',
      sentence: 'Sentence'
    }
    return labels[notification.contentType] || 'Review'
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 400, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 400, scale: 0.8 }}
      transition={{
        type: 'spring',
        damping: 20,
        stiffness: 300
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative w-full max-w-sm md:w-96 overflow-hidden rounded-2xl shadow-2xl backdrop-blur-xl"
    >
      {/* Gradient background */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br opacity-95',
        getContentTypeColor()
      )} />
      
      {/* Glass effect overlay */}
      <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
      
      {/* Content */}
      <div className="relative p-4 md:p-5 text-white">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: isHovered ? 360 : 0 }}
              transition={{ duration: 0.5 }}
              className="p-2 bg-white/20 rounded-lg backdrop-blur-sm"
            >
              <Clock className="w-5 h-5" />
            </motion.div>
            <div>
              <p className="text-xs font-medium opacity-90">
                {getContentTypeLabel()} Review Due
              </p>
              <p className="text-xs opacity-75">{timeOverdue}</p>
            </div>
          </div>
          
          <button
            onClick={onDismiss}
            className="relative z-10 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Dismiss"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main content */}
        <div className="mb-4">
          <div className="text-3xl md:text-4xl font-bold mb-1 md:mb-2">
            {notification.content}
          </div>
          <div className="text-base md:text-lg opacity-90">
            {notification.meaning}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Link
            href={`/review?item=${notification.itemId}`}
            className="flex-1 flex items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 bg-white/25 hover:bg-white/35 rounded-xl text-sm md:text-base font-medium backdrop-blur-sm transition-all transform hover:scale-105"
            onClick={onDismiss}
          >
            <Play className="w-4 h-4" />
            <span>Review</span>
            <ChevronRight className="w-4 h-4 hidden sm:block" />
          </Link>

          {onSnooze && (
            <div className="flex gap-1">
              <button
                onClick={() => {
                  onSnooze(10)
                  onDismiss()
                }}
                className="px-2 md:px-3 py-2 md:py-2.5 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-medium backdrop-blur-sm transition-all"
                title="Snooze for 10 minutes"
              >
                10m
              </button>
              <button
                onClick={() => {
                  onSnooze(30)
                  onDismiss()
                }}
                className="px-2 md:px-3 py-2 md:py-2.5 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-medium backdrop-blur-sm transition-all"
                title="Snooze for 30 minutes"
              >
                30m
              </button>
            </div>
          )}
        </div>

        {/* Animated pulse effect */}
        <motion.div
          className="absolute -inset-4 bg-white/20 rounded-2xl blur-xl"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.1, 0.3]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      </div>

      {/* Progress bar showing how overdue */}
      <motion.div
        className="absolute bottom-0 left-0 h-1 bg-white/50"
        initial={{ width: '0%' }}
        animate={{ width: '100%' }}
        transition={{
          duration: 10,
          ease: 'linear'
        }}
      />
    </motion.div>
  )
}

// Container component to manage multiple notifications
export function ReviewNotificationContainer() {
  const [notifications, setNotifications] = useState<ReviewNotification[]>([])
  const [soundEnabled, setSoundEnabled] = useState(true)

  // This will be called by the ReviewNotificationManager
  useEffect(() => {
    const handleNewNotification = (event: CustomEvent<ReviewNotification>) => {
      setNotifications(prev => [...prev, event.detail])
      
      // Auto-dismiss after 30 seconds if not interacted with
      setTimeout(() => {
        dismissNotification(event.detail.id)
      }, 30000)
    }

    window.addEventListener('review:notification', handleNewNotification as EventListener)
    
    return () => {
      window.removeEventListener('review:notification', handleNewNotification as EventListener)
    }
  }, [])

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const snoozeNotification = (id: string, minutes: number) => {
    const notification = notifications.find(n => n.id === id)
    if (notification) {
      // Dispatch snooze event for the manager to handle
      window.dispatchEvent(new CustomEvent('review:snooze', {
        detail: {
          ...notification,
          snoozeMinutes: minutes
        }
      }))
    }
  }

  return (
    <div className="fixed top-20 right-2 md:right-4 left-2 md:left-auto z-50 space-y-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <div key={notification.id} className="pointer-events-auto flex justify-end">
            <ReviewNotificationToast
              notification={notification}
              onDismiss={() => dismissNotification(notification.id)}
              onSnooze={(minutes) => snoozeNotification(notification.id, minutes)}
              soundEnabled={soundEnabled}
            />
          </div>
        ))}
      </AnimatePresence>
      
      {/* Sound toggle button */}
      {notifications.length > 0 && (
        <motion.button
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="pointer-events-auto absolute top-0 right-0 -mt-12 p-2 bg-gray-800/80 hover:bg-gray-700/80 text-white rounded-lg backdrop-blur-sm transition-colors"
          title={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </motion.button>
      )}
    </div>
  )
}