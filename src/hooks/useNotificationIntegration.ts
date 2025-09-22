/**
 * Notification Integration Hook for Review Engine
 * Connects Review Engine events to notification scheduling
 */

import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { reviewLogger } from '@/lib/monitoring/logger'
import {
  ReviewEventType,
  ItemAnsweredPayload,
  SessionCompletedPayload,
  ProgressUpdatedPayload
} from '@/lib/review-engine/core/events'
import { notificationService } from '@/lib/notifications/notification-service'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

interface ScheduledNotification {
  itemId: string
  userId: string
  scheduledFor: Date
  type: 'review_due' | 'overdue' | 'daily_summary'
  contentType: string
  metadata?: Record<string, any>
}

interface NotificationPreferences {
  channels: {
    browser: boolean
    inApp: boolean
    push: boolean
    email: boolean
  }
  timing: {
    immediate: boolean      // 10min, 30min reviews
    daily: boolean         // daily summary
    overdue: boolean       // overdue items
  }
  quiet_hours: {
    enabled: boolean
    start: string  // "22:00"
    end: string    // "08:00"
    timezone: string
  }
}

/**
 * Hook for integrating Review Engine with Notification System
 */
export function useNotificationIntegration() {
  const { user } = useAuth()
  const sessionManagerRef = useRef<any>(null)
  const scheduledNotificationsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const preferencesRef = useRef<NotificationPreferences | null>(null)

  /**
   * Load user notification preferences
   */
  const loadPreferences = useCallback(async () => {
    if (!user) return null

    try {
      const docRef = doc(db, 'notifications_preferences', user.uid)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const prefs = docSnap.data() as NotificationPreferences
        preferencesRef.current = prefs
        return prefs
      }

      // Default preferences if none exist
      const defaultPrefs: NotificationPreferences = {
        channels: {
          browser: false,
          inApp: true,
          push: false,
          email: true
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
        }
      }

      // Save default preferences
      await setDoc(docRef, {
        ...defaultPrefs,
        userId: user.uid,
        created_at: new Date(),
        updated_at: new Date()
      })

      preferencesRef.current = defaultPrefs
      return defaultPrefs
    } catch (error) {
      reviewLogger.error('Failed to load notification preferences:', error)
      return null
    }
  }, [user])

  /**
   * Calculate next review time based on SRS algorithm
   */
  const calculateNextReviewTime = useCallback((
    correct: boolean,
    difficulty: number = 2.5,
    consecutiveCorrect: number = 0
  ): Date => {
    const now = new Date()
    let interval: number

    if (!correct) {
      // Failed review - reset to beginning
      interval = 10 * 60 * 1000 // 10 minutes
    } else {
      // Success - use SRS intervals
      switch (consecutiveCorrect) {
        case 0:
          interval = 10 * 60 * 1000 // 10 minutes
          break
        case 1:
          interval = 30 * 60 * 1000 // 30 minutes
          break
        case 2:
          interval = 24 * 60 * 60 * 1000 // 1 day
          break
        case 3:
          interval = 3 * 24 * 60 * 60 * 1000 // 3 days
          break
        case 4:
          interval = 7 * 24 * 60 * 60 * 1000 // 1 week
          break
        case 5:
          interval = 14 * 24 * 60 * 60 * 1000 // 2 weeks
          break
        case 6:
          interval = 30 * 24 * 60 * 60 * 1000 // 1 month
          break
        default:
          // Apply difficulty modifier for intervals beyond 1 month
          const baseInterval = 30 * 24 * 60 * 60 * 1000
          interval = baseInterval * Math.pow(difficulty, consecutiveCorrect - 6)
          break
      }
    }

    return new Date(now.getTime() + interval)
  }, [])

  /**
   * Check if current time is within quiet hours
   */
  const isInQuietHours = useCallback((): boolean => {
    const prefs = preferencesRef.current
    if (!prefs?.quiet_hours.enabled) return false

    const now = new Date()
    const currentTime = now.getHours() * 60 + now.getMinutes()

    const [startHour, startMin] = prefs.quiet_hours.start.split(':').map(Number)
    const [endHour, endMin] = prefs.quiet_hours.end.split(':').map(Number)

    const startTime = startHour * 60 + startMin
    const endTime = endHour * 60 + endMin

    if (startTime <= endTime) {
      // Quiet hours don't cross midnight
      return currentTime >= startTime && currentTime < endTime
    } else {
      // Quiet hours cross midnight
      return currentTime >= startTime || currentTime < endTime
    }
  }, [])

  /**
   * Schedule a notification for a review item
   */
  const scheduleNotification = useCallback(async (params: {
    itemId: string
    scheduledFor: Date
    contentType: string
    metadata?: any
  }) => {
    if (!user || !preferencesRef.current) return

    const { itemId, scheduledFor, contentType, metadata } = params
    const prefs = preferencesRef.current

    // Check if any notification channel is enabled
    if (!prefs.channels.browser && !prefs.channels.inApp &&
        !prefs.channels.push && !prefs.channels.email) {
      return
    }

    const delay = scheduledFor.getTime() - Date.now()

    // Cancel existing schedule for this item
    const existingTimer = scheduledNotificationsRef.current.get(itemId)
    if (existingTimer) {
      clearTimeout(existingTimer)
      scheduledNotificationsRef.current.delete(itemId)
    }

    if (delay <= 0) {
      // Item is already due - send notification immediately if not in quiet hours
      if (!isInQuietHours()) {
        await sendNotification({
          itemId,
          userId: user.uid,
          type: 'overdue',
          contentType,
          metadata
        })
      }
    } else if (delay < 60 * 60 * 1000) {
      // Less than 1 hour - schedule for exact time if immediate timing enabled
      if (prefs.timing.immediate) {
        const timerId = setTimeout(async () => {
          if (!isInQuietHours()) {
            await sendNotification({
              itemId,
              userId: user.uid,
              type: 'review_due',
              contentType,
              metadata
            })
          }
          scheduledNotificationsRef.current.delete(itemId)
        }, delay)

        scheduledNotificationsRef.current.set(itemId, timerId)

        // Store in database for persistence
        await storeScheduledNotification({
          itemId,
          userId: user.uid,
          scheduledFor,
          type: 'review_due',
          contentType,
          metadata
        })
      }
    } else {
      // More than 1 hour - add to daily batch if daily timing enabled
      if (prefs.timing.daily) {
        await storeScheduledNotification({
          itemId,
          userId: user.uid,
          scheduledFor,
          type: 'daily_summary',
          contentType,
          metadata
        })
      }
    }

    reviewLogger.info('Notification scheduled', {
      itemId,
      scheduledFor,
      delay: Math.round(delay / 1000 / 60), // minutes
      contentType
    })
  }, [user, isInQuietHours])

  /**
   * Send a notification through enabled channels
   */
  const sendNotification = useCallback(async (params: {
    itemId: string
    userId: string
    type: 'review_due' | 'overdue' | 'daily_summary'
    contentType: string
    metadata?: any
  }) => {
    const prefs = preferencesRef.current
    if (!prefs) return

    const { itemId, userId, type, contentType, metadata } = params

    // Browser notification (will be implemented by Agent 1)
    if (prefs.channels.browser && 'Notification' in window &&
        Notification.permission === 'granted') {
      const notification = new Notification('Review Due!', {
        body: `Time to review your ${contentType}`,
        icon: '/icons/icon-192x192.svg',
        badge: '/icons/icon-72x72.svg',
        tag: `review-${itemId}`,
        data: { itemId, actionUrl: `/review?item=${itemId}` },
        requireInteraction: true
      })

      notification.onclick = () => {
        window.focus()
        window.location.href = `/review?item=${itemId}`
        notification.close()
      }
    }

    // In-app notification (will be implemented by Agent 2)
    if (prefs.channels.inApp) {
      // Emit event for in-app notification system
      window.dispatchEvent(new CustomEvent('notification:show', {
        detail: {
          title: 'Review Due!',
          body: `Time to review your ${contentType}`,
          type: 'review_due',
          actionUrl: `/review?item=${itemId}`,
          persistent: type === 'overdue'
        }
      }))
    }

    // Push notification (will be implemented by Agent 3)
    if (prefs.channels.push && 'serviceWorker' in navigator) {
      // Send message to service worker
      const registration = await navigator.serviceWorker.ready
      registration.active?.postMessage({
        type: 'SCHEDULE_NOTIFICATION',
        delay: 0,
        notification: {
          title: 'Review Due!',
          options: {
            body: `Time to review your ${contentType}`,
            icon: '/icons/icon-192x192.svg',
            data: { itemId, actionUrl: `/review?item=${itemId}` }
          }
        }
      })
    }

    // Email notification (already implemented)
    if (prefs.channels.email && type === 'daily_summary') {
      // Email notifications are handled by cron job
      // This is just for individual critical notifications
      await notificationService.sendDailyReminder(userId)
    }

    reviewLogger.info('Notification sent', {
      itemId,
      type,
      channels: Object.entries(prefs.channels)
        .filter(([_, enabled]) => enabled)
        .map(([channel]) => channel)
    })
  }, [])

  /**
   * Store scheduled notification in database
   */
  const storeScheduledNotification = useCallback(async (
    notification: ScheduledNotification
  ) => {
    if (!user) return

    try {
      await setDoc(
        doc(db, 'notifications_queue', `${notification.userId}_${notification.itemId}`),
        {
          ...notification,
          scheduledFor: notification.scheduledFor,
          createdAt: new Date(),
          status: 'pending'
        }
      )
    } catch (error) {
      reviewLogger.error('Failed to store scheduled notification:', error)
    }
  }, [user])

  /**
   * Handle Review Engine events
   */
  const handleItemAnswered = useCallback(async (event: CustomEvent<ItemAnsweredPayload>) => {
    if (!user || !preferencesRef.current) return

    const { itemId, correct, contentType } = event.detail

    // Calculate next review time
    const nextReviewTime = calculateNextReviewTime(
      correct,
      2.5, // default difficulty
      correct ? 1 : 0 // consecutive correct count
    )

    // Schedule notification for next review
    await scheduleNotification({
      itemId,
      scheduledFor: nextReviewTime,
      contentType: contentType || 'item',
      metadata: {
        correct,
        reviewedAt: new Date()
      }
    })

    // Emit custom event for other components
    window.dispatchEvent(new CustomEvent('review:scheduled', {
      detail: {
        itemId,
        nextReviewAt: nextReviewTime,
        contentType
      }
    }))
  }, [user, calculateNextReviewTime, scheduleNotification])

  const handleSessionCompleted = useCallback(async (event: CustomEvent<SessionCompletedPayload>) => {
    if (!user) return

    const { statistics } = event.detail

    // Log session completion
    reviewLogger.info('Session completed', {
      userId: user.uid,
      statistics
    })

    // Could trigger achievement notifications here if needed
  }, [user])

  const handleProgressUpdated = useCallback(async (event: CustomEvent<ProgressUpdatedPayload>) => {
    if (!user) return

    const { streak, accuracy } = event.detail

    // Check for milestone achievements
    if (streak > 0 && streak % 10 === 0) {
      // Streak milestone
      window.dispatchEvent(new CustomEvent('notification:show', {
        detail: {
          title: 'Streak Milestone!',
          body: `You've reached a ${streak} day streak!`,
          type: 'achievement',
          persistent: false
        }
      }))
    }

    if (accuracy >= 90 && event.detail.total >= 10) {
      // High accuracy achievement
      window.dispatchEvent(new CustomEvent('notification:show', {
        detail: {
          title: 'Excellent Performance!',
          body: `${accuracy}% accuracy! Keep it up!`,
          type: 'achievement',
          persistent: false
        }
      }))
    }
  }, [user])

  /**
   * Initialize the integration
   */
  useEffect(() => {
    if (!user) return

    let cleanup: (() => void) | undefined

    const initialize = async () => {
      try {
        // Load user preferences
        await loadPreferences()

        // Set up event listeners
        const itemAnsweredHandler = handleItemAnswered as EventListener
        const sessionCompletedHandler = handleSessionCompleted as EventListener
        const progressUpdatedHandler = handleProgressUpdated as EventListener

        window.addEventListener(`review:${ReviewEventType.ITEM_ANSWERED}`, itemAnsweredHandler)
        window.addEventListener(`review:${ReviewEventType.SESSION_COMPLETED}`, sessionCompletedHandler)
        window.addEventListener(`review:${ReviewEventType.PROGRESS_UPDATED}`, progressUpdatedHandler)

        cleanup = () => {
          window.removeEventListener(`review:${ReviewEventType.ITEM_ANSWERED}`, itemAnsweredHandler)
          window.removeEventListener(`review:${ReviewEventType.SESSION_COMPLETED}`, sessionCompletedHandler)
          window.removeEventListener(`review:${ReviewEventType.PROGRESS_UPDATED}`, progressUpdatedHandler)
        }

        reviewLogger.info('Notification integration initialized', {
          userId: user.uid
        })
      } catch (error) {
        reviewLogger.error('Failed to initialize notification integration:', error)
      }
    }

    initialize()

    return () => {
      cleanup?.()
      // Clear all scheduled notifications
      scheduledNotificationsRef.current.forEach(timer => clearTimeout(timer))
      scheduledNotificationsRef.current.clear()
    }
  }, [user, loadPreferences, handleItemAnswered, handleSessionCompleted, handleProgressUpdated])

  /**
   * Public API
   */
  const requestNotificationPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      reviewLogger.warn('Browser notifications not supported')
      return 'denied'
    }

    const permission = await Notification.requestPermission()

    // Update preferences if permission granted
    if (permission === 'granted' && user) {
      await setDoc(
        doc(db, 'notifications_tokens', user.uid),
        {
          browser_permission: permission,
          browser_permission_updated: new Date(),
          device_info: {
            platform: navigator.platform,
            userAgent: navigator.userAgent
          }
        },
        { merge: true }
      )
    }

    return permission
  }, [user])

  const testNotification = useCallback(async () => {
    if (!user) return

    await sendNotification({
      itemId: 'test',
      userId: user.uid,
      type: 'review_due',
      contentType: 'test',
      metadata: { test: true }
    })
  }, [user, sendNotification])

  const updatePreferences = useCallback(async (
    preferences: Partial<NotificationPreferences>
  ) => {
    if (!user) return

    const docRef = doc(db, 'notifications_preferences', user.uid)
    await setDoc(docRef, {
      ...preferencesRef.current,
      ...preferences,
      updated_at: new Date()
    }, { merge: true })

    // Reload preferences
    await loadPreferences()
  }, [user, loadPreferences])

  return {
    scheduleNotification,
    requestNotificationPermission,
    testNotification,
    updatePreferences,
    preferences: preferencesRef.current
  }
}