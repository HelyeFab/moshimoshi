'use client'

import { useEffect, useRef, useCallback } from 'react'
import { ReviewNotificationManager } from '@/lib/notifications/ReviewNotificationManager'
import { useAuth } from '@/hooks/useAuth'
import { reviewLogger } from '@/lib/monitoring/logger'

interface ReviewItem {
  id: string
  content: string
  meaning?: string
  contentType: 'hiragana' | 'katakana' | 'kanji' | 'vocabulary' | 'sentence'
  nextReviewAt?: Date | string
}

export function useReviewNotifications() {
  const { user } = useAuth()
  const managerRef = useRef<ReviewNotificationManager | null>(null)
  const isInitialized = useRef(false)

  useEffect(() => {
    if (!user || isInitialized.current) return

    // Initialize notification manager
    const manager = ReviewNotificationManager.getInstance()
    managerRef.current = manager
    isInitialized.current = true

    // Set up in-app notification callback
    manager.setInAppCallback((notification) => {
      // Dispatch custom event for the notification container to handle
      window.dispatchEvent(new CustomEvent('review:notification', {
        detail: notification
      }))
    })

    // Listen for Review Engine events
    const handleItemAnswered = (event: CustomEvent) => {
      const { item, correct, nextReviewAt, srsData } = event.detail
      
      if (correct && nextReviewAt) {
        scheduleNotificationForItem({
          id: item.id,
          content: item.primaryDisplay || item.content,
          meaning: item.secondaryDisplay || item.meaning,
          contentType: item.contentType,
          nextReviewAt
        })
      }
    }

    const handleSessionCompleted = (event: CustomEvent) => {
      const { items } = event.detail
      
      // Schedule notifications for all items with future reviews
      items.forEach((item: any) => {
        if (item.nextReviewAt) {
          scheduleNotificationForItem({
            id: item.id,
            content: item.primaryDisplay || item.content,
            meaning: item.secondaryDisplay || item.meaning,
            contentType: item.contentType,
            nextReviewAt: item.nextReviewAt
          })
        }
      })
    }

    // Listen for snooze events from the UI
    const handleSnooze = (event: CustomEvent) => {
      const { itemId, content, meaning, contentType, snoozeMinutes } = event.detail
      const snoozeTime = new Date(Date.now() + snoozeMinutes * 60 * 1000)
      
      manager.scheduleReviewNotification(
        itemId,
        content,
        meaning,
        contentType,
        snoozeTime
      )
      
      reviewLogger.info(`Snoozed notification for ${content} by ${snoozeMinutes} minutes`)
    }

    // Add event listeners
    window.addEventListener('reviewEngine:itemAnswered', handleItemAnswered as EventListener)
    window.addEventListener('reviewEngine:sessionCompleted', handleSessionCompleted as EventListener)
    window.addEventListener('review:snooze', handleSnooze as EventListener)

    reviewLogger.info('Review notifications hook initialized')

    return () => {
      window.removeEventListener('reviewEngine:itemAnswered', handleItemAnswered as EventListener)
      window.removeEventListener('reviewEngine:sessionCompleted', handleSessionCompleted as EventListener)
      window.removeEventListener('review:snooze', handleSnooze as EventListener)
    }
  }, [user])

  const scheduleNotificationForItem = useCallback((item: ReviewItem) => {
    if (!managerRef.current) return

    const nextReviewDate = item.nextReviewAt instanceof Date 
      ? item.nextReviewAt 
      : new Date(item.nextReviewAt as string)

    // Only schedule if review is in the future
    if (nextReviewDate.getTime() > Date.now()) {
      managerRef.current.scheduleReviewNotification(
        item.id,
        item.content,
        item.meaning || '',
        item.contentType,
        nextReviewDate
      )

      reviewLogger.info('Scheduled notification:', {
        item: item.content,
        at: nextReviewDate.toLocaleTimeString()
      })
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (!managerRef.current) return 'denied'
    return await managerRef.current.requestPermission()
  }, [])

  const getPermissionStatus = useCallback(() => {
    if (!managerRef.current) return 'default'
    return managerRef.current.getPermission()
  }, [])

  const setEnabled = useCallback((enabled: boolean) => {
    if (managerRef.current) {
      managerRef.current.setEnabled(enabled)
    }
  }, [])

  const setSoundEnabled = useCallback((enabled: boolean) => {
    if (managerRef.current) {
      managerRef.current.setSoundEnabled(enabled)
    }
  }, [])

  const getScheduledNotifications = useCallback(() => {
    if (!managerRef.current) return []
    return managerRef.current.getScheduledNotifications()
  }, [])

  const cancelNotification = useCallback((id: string) => {
    if (managerRef.current) {
      managerRef.current.cancelNotification(id)
    }
  }, [])

  const cancelAllNotifications = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.cancelAllNotifications()
    }
  }, [])

  // Test function to trigger a notification immediately
  const testNotification = useCallback(() => {
    if (!managerRef.current) return
    
    // Create a test notification
    const testItem = {
      id: 'test-' + Date.now(),
      itemId: 'test',
      content: '水',
      meaning: 'water (mizu)',
      contentType: 'kanji' as const,
      scheduledFor: new Date(Date.now() - 1000) // 1 second ago to trigger immediately
    }
    
    // Fire as in-app notification
    window.dispatchEvent(new CustomEvent('review:notification', {
      detail: testItem
    }))
    
    reviewLogger.info('Test notification triggered')
  }, [])

  return {
    requestPermission,
    getPermissionStatus,
    setEnabled,
    setSoundEnabled,
    getScheduledNotifications,
    cancelNotification,
    cancelAllNotifications,
    testNotification,
    scheduleNotificationForItem
  }
}