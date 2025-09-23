'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { NotificationToast } from './NotificationToast'
import { ReviewCountdown } from './ReviewCountdown'
import { useAuth } from '@/hooks/useAuth'
import { ReviewEventType } from '@/lib/review-engine/core/events'
import { useI18n } from '@/i18n/I18nContext'
import { UserStorageService } from '@/lib/storage/UserStorageService'

interface InAppNotification {
  id: string
  title: string
  body: string
  type: 'info' | 'success' | 'warning' | 'review_due'
  actionUrl?: string
  countdown?: number // seconds until auto-dismiss
  persistent?: boolean
  timestamp: Date
}

interface InAppNotificationContextType {
  notifications: InAppNotification[]
  countdowns: Map<string, Date> // itemId -> dueDate
  addNotification: (notification: Omit<InAppNotification, 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  addCountdown: (itemId: string, dueDate: Date) => void
  removeCountdown: (itemId: string) => void
  clearAll: () => void
}

const InAppNotificationContext = createContext<InAppNotificationContextType | undefined>(undefined)

export function InAppNotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { t } = useI18n()
  const [notifications, setNotifications] = useState<InAppNotification[]>([])
  const [countdowns, setCountdowns] = useState<Map<string, Date>>(new Map())
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const storageRef = useRef<UserStorageService | null>(null)

  useEffect(() => {
    if (!user) {
      storageRef.current = null
      return
    }

    // Initialize user-specific storage
    storageRef.current = new UserStorageService(user.uid)

    // Load persisted countdowns
    loadPersistedCountdowns()

    // Listen for Review Engine events
    const handleReviewEvent = (event: CustomEvent) => {
      switch (event.detail.type) {
        case ReviewEventType.ITEM_ANSWERED:
          handleItemAnswered(event.detail)
          break
        case ReviewEventType.SESSION_COMPLETED:
          handleSessionCompleted(event.detail)
          break
        case ReviewEventType.PROGRESS_UPDATED:
          handleProgressUpdated(event.detail)
          break
      }
    }

    // Subscribe to Review Engine events
    window.addEventListener('review:event', handleReviewEvent as EventListener)

    return () => {
      window.removeEventListener('review:event', handleReviewEvent as EventListener)
      // Cleanup timers
      timersRef.current.forEach(timer => clearTimeout(timer))
      timersRef.current.clear()
    }
  }, [user, t])

  const handleItemAnswered = useCallback((event: any) => {
    const { itemId, correct, nextReviewAt, contentType } = event.data

    if (correct && nextReviewAt) {
      const reviewDate = new Date(nextReviewAt)
      const delay = reviewDate.getTime() - Date.now()

      // Add countdown for immediate reviews (< 1 hour)
      if (delay > 0 && delay < 60 * 60 * 1000) {
        addCountdown(itemId, reviewDate)
      }
    }
  }, [])

  const handleSessionCompleted = useCallback((event: any) => {
    const { itemsReviewed, accuracy } = event.data

    if (itemsReviewed > 0) {
      addNotification({
        title: t('notifications.sessionComplete.title'),
        body: t('notifications.sessionComplete.body', {
          count: itemsReviewed,
          accuracy: Math.round(accuracy * 100)
        }),
        type: 'success',
        persistent: false
      })
    }
  }, [t])

  const handleProgressUpdated = useCallback((event: any) => {
    // Handle progress updates if needed
  }, [])

  const addNotification = useCallback((notification: Omit<InAppNotification, 'id' | 'timestamp'>) => {
    const id = `${Date.now()}_${Math.random()}`
    const newNotification: InAppNotification = {
      ...notification,
      id,
      timestamp: new Date()
    }

    setNotifications(prev => [...prev, newNotification])

    // Auto-dismiss if not persistent
    if (!notification.persistent) {
      const timeout = notification.countdown || 5000
      const timerId = setTimeout(() => {
        removeNotification(id)
      }, timeout)

      timersRef.current.set(id, timerId)
    }

    // Play sound for review_due notifications
    if (notification.type === 'review_due') {
      playNotificationSound()
    }
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))

    // Clear timer if exists
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const addCountdown = useCallback((itemId: string, dueDate: Date) => {
    setCountdowns(prev => {
      const next = new Map(prev)
      next.set(itemId, dueDate)
      return next
    })

    // Persist to localStorage
    persistCountdowns()

    // Schedule notification for due date
    const delay = dueDate.getTime() - Date.now()
    if (delay > 0 && delay < 60 * 60 * 1000) { // Less than 1 hour
      const timerId = setTimeout(() => {
        addNotification({
          title: t('notifications.reviewDue.title'),
          body: t('notifications.reviewDue.body'),
          type: 'review_due',
          actionUrl: `/review?item=${itemId}`,
          persistent: true
        })
        removeCountdown(itemId)
      }, delay)

      timersRef.current.set(`countdown_${itemId}`, timerId)
    }
  }, [addNotification, t])

  const removeCountdown = useCallback((itemId: string) => {
    setCountdowns(prev => {
      const next = new Map(prev)
      next.delete(itemId)
      return next
    })

    // Clear timer if exists
    const timer = timersRef.current.get(`countdown_${itemId}`)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(`countdown_${itemId}`)
    }

    persistCountdowns()
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    setCountdowns(new Map())

    // Clear all timers
    timersRef.current.forEach(timer => clearTimeout(timer))
    timersRef.current.clear()
  }, [])

  const persistCountdowns = () => {
    if (typeof window === 'undefined') return

    const data = Array.from(countdowns.entries()).map(([itemId, dueDate]) => ({
      itemId,
      dueDate: dueDate.toISOString()
    }))

    if (storageRef.current) {
      storageRef.current.setItem('review_countdowns', data)
    }
  }

  const loadPersistedCountdowns = () => {
    if (typeof window === 'undefined' || !storageRef.current) return

    try {
      const stored = storageRef.current.getItem<any[]>('review_countdowns')
      if (stored) {
        const data = JSON.parse(stored)
        const now = Date.now()

        data.forEach((item: any) => {
          const dueDate = new Date(item.dueDate)
          if (dueDate.getTime() > now) {
            addCountdown(item.itemId, dueDate)
          }
        })
      }
    } catch (error) {
      console.error('Failed to load persisted countdowns:', error)
    }
  }

  const playNotificationSound = () => {
    if (typeof window === 'undefined') return

    try {
      const audio = new Audio('/sounds/notification.mp3')
      audio.volume = 0.5
      audio.play().catch(e => console.warn('Could not play notification sound:', e))
    } catch (error) {
      console.warn('Audio not supported:', error)
    }
  }

  return (
    <InAppNotificationContext.Provider
      value={{
        notifications,
        countdowns,
        addNotification,
        removeNotification,
        addCountdown,
        removeCountdown,
        clearAll
      }}
    >
      {children}

      {/* Notification container */}
      <div className="fixed top-20 right-4 z-50 space-y-2 pointer-events-none">
        <AnimatePresence>
          {notifications.map(notification => (
            <NotificationToast
              key={notification.id}
              notification={notification}
              onDismiss={() => removeNotification(notification.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Countdown timers */}
      <div className="fixed bottom-4 right-4 z-40 space-y-2">
        <AnimatePresence>
          {Array.from(countdowns.entries())
            .filter(([_, dueDate]) => dueDate.getTime() - Date.now() < 60 * 60 * 1000) // Show if less than 1 hour
            .map(([itemId, dueDate]) => (
              <ReviewCountdown
                key={itemId}
                itemId={itemId}
                dueDate={dueDate}
                onComplete={() => removeCountdown(itemId)}
              />
            ))}
        </AnimatePresence>
      </div>
    </InAppNotificationContext.Provider>
  )
}

export function useInAppNotifications() {
  const context = useContext(InAppNotificationContext)
  if (!context) {
    throw new Error('useInAppNotifications must be used within InAppNotificationProvider')
  }
  return context
}