/**
 * NotificationScheduler
 * Handles scheduling and management of timed notifications
 */

import { reviewLogger } from '@/lib/monitoring/logger'
import { getTimerManager, TimerManager } from '../utils/TimerManager'
import {
  ScheduledNotification,
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  IndexedDBNotification,
  NotificationContent
} from '../types/notifications.types'

/**
 * Scheduler options
 */
export interface SchedulerOptions {
  userId: string
  itemId?: string
  itemIds?: string[]
  type: NotificationType
  scheduledFor: Date
  priority: NotificationPriority
  channels?: NotificationChannel[]
  metadata?: Record<string, any>
}

/**
 * NotificationScheduler class
 */
export class NotificationScheduler {
  private scheduled: Map<string, ScheduledNotification> = new Map()
  private orchestrator?: any // Will be injected
  private userId: string | null = null
  private db: IDBDatabase | null = null
  private timerManager: TimerManager
  private readonly DB_NAME = 'moshimoshi_notifications'
  private readonly DB_VERSION = 1
  private readonly STORE_NAME = 'scheduled_notifications'

  constructor() {
    // Get dedicated timer manager for scheduler
    this.timerManager = getTimerManager('notification-scheduler')
  }

  /**
   * Set orchestrator reference
   */
  setOrchestrator(orchestrator: any): void {
    this.orchestrator = orchestrator
  }

  /**
   * Initialize scheduler for a user
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId
    await this.openIndexedDB()
    await this.restoreScheduledNotifications()

    reviewLogger.info('NotificationScheduler initialized', {
      userId,
      scheduledCount: this.scheduled.size
    })
  }

  /**
   * Schedule a notification
   */
  async scheduleNotification(options: SchedulerOptions): Promise<string> {
    const {
      userId,
      itemId,
      itemIds,
      type,
      scheduledFor,
      priority,
      channels = ['browser', 'inApp'],
      metadata
    } = options

    // Generate unique ID
    const id = this.generateId(userId, itemId || itemIds?.join('-') || '', scheduledFor)

    // Cancel existing schedule for this item if exists
    if (itemId) {
      this.cancelNotificationsForItem(itemId)
    }

    // Calculate delay
    const delay = scheduledFor.getTime() - Date.now()

    reviewLogger.info('Scheduling notification', {
      id,
      type,
      delay: `${Math.round(delay / 1000)}s`,
      scheduledFor: scheduledFor.toISOString()
    })

    if (delay <= 0) {
      // Fire immediately
      await this.fireNotification({
        userId,
        itemId,
        itemIds,
        type,
        scheduledFor,
        priority,
        channels,
        metadata
      })
      return id
    }

    // Create scheduled notification
    const scheduled: ScheduledNotification = {
      id,
      userId,
      itemId,
      itemIds,
      type,
      scheduledFor,
      priority,
      channels,
      metadata
    }

    // Set timeout for notification
    if (delay < 2147483647) { // Max timeout value (~24.8 days)
      const timerId = this.timerManager.setTimeout(async () => {
        await this.fireNotification(scheduled)
        this.scheduled.delete(id)
        await this.removeFromIndexedDB(id)
      }, delay, id, {
        type: 'notification',
        itemId,
        userId
      })

      scheduled.timerId = timerId as any
    } else {
      // For longer delays, we'll rely on restoration from IndexedDB
      reviewLogger.info('Notification scheduled beyond timeout limit, will restore from DB', {
        id,
        daysAhead: Math.round(delay / (1000 * 60 * 60 * 24))
      })
    }

    // Store in memory
    this.scheduled.set(id, scheduled)

    // Persist to IndexedDB
    await this.persistToIndexedDB(scheduled)

    return id
  }

  /**
   * Fire a notification
   */
  private async fireNotification(params: Omit<ScheduledNotification, 'id' | 'timerId'>): Promise<void> {
    if (!this.orchestrator) {
      reviewLogger.warn('Orchestrator not set, cannot fire notification')
      return
    }

    const { userId, itemId, itemIds, type, priority, channels, metadata } = params

    // Fetch item details if needed
    const itemDetails = itemId ? await this.fetchItemDetails(itemId) : null

    // Prepare notification content
    const content = this.prepareNotificationContent(type, itemDetails, metadata)

    reviewLogger.info('Firing scheduled notification', {
      type,
      itemId,
      channels
    })

    // Send through orchestrator
    await this.orchestrator.sendNotification({
      userId,
      title: content.title,
      body: content.body,
      type,
      data: {
        itemId,
        itemIds,
        type,
        ...metadata,
        actionUrl: content.data?.actionUrl || '/review'
      },
      channels,
      priority
    })

    // Track notification fired
    this.trackEvent('notification_fired', {
      type,
      priority,
      hasItem: !!itemId
    })
  }

  /**
   * Prepare notification content based on type
   */
  private prepareNotificationContent(
    type: NotificationType,
    item: any,
    metadata?: any
  ): NotificationContent {
    switch (type) {
      case 'review_due':
        return {
          title: `📚 Time to review: ${item?.primaryDisplay || 'item'}`,
          body: `Your ${item?.contentType || 'review'} is ready. Keep your streak going!`,
          data: {
            actionUrl: `/review?item=${item?.id || ''}`
          },
          requireInteraction: true,
          actions: [
            { action: 'review', title: 'Start Review' },
            { action: 'later', title: 'Remind Later' }
          ]
        }

      case 'review_overdue':
        return {
          title: `⚠️ Overdue review: ${item?.primaryDisplay || 'item'}`,
          body: `This ${item?.contentType || 'item'} is overdue. Review it now to strengthen your memory.`,
          data: {
            actionUrl: `/review?item=${item?.id || ''}`
          },
          requireInteraction: true,
          badge: '/icons/icon-72x72.svg'
        }

      case 'daily_summary':
        const count = metadata?.reviewCount || 0
        return {
          title: `🌅 ${count} reviews waiting for you`,
          body: count > 0
            ? `You have ${count} items ready to review. Start now to maintain your progress!`
            : 'No reviews due today. Great job staying on top of your learning!',
          data: {
            actionUrl: '/review'
          }
        }

      case 'achievement':
        return {
          title: `🎉 Achievement Unlocked!`,
          body: metadata?.message || 'You've reached a new milestone!',
          data: {
            actionUrl: '/achievements'
          }
        }

      case 'streak_reminder':
        return {
          title: `🔥 Don't break your streak!`,
          body: `Complete today's reviews to maintain your ${metadata?.currentStreak || ''} day streak`,
          data: {
            actionUrl: '/review'
          },
          requireInteraction: true
        }

      default:
        return {
          title: 'Moshimoshi Reminder',
          body: 'You have pending reviews',
          data: {
            actionUrl: '/review'
          }
        }
    }
  }

  /**
   * Cancel a scheduled notification
   */
  cancelNotification(id: string): void {
    const scheduled = this.scheduled.get(id)

    if (scheduled) {
      // Clear timer using TimerManager
      if (scheduled.timerId) {
        // timerId is the same as the notification id
        this.timerManager.clearTimer(id)
      }

      // Remove from memory
      this.scheduled.delete(id)

      // Remove from IndexedDB
      this.removeFromIndexedDB(id)

      reviewLogger.info('Notification cancelled', { id })
    }
  }

  /**
   * Cancel all notifications for an item
   */
  cancelNotificationsForItem(itemId: string): void {
    const toCancel: string[] = []

    this.scheduled.forEach((notification, id) => {
      if (notification.itemId === itemId) {
        toCancel.push(id)
      }
    })

    toCancel.forEach(id => this.cancelNotification(id))

    if (toCancel.length > 0) {
      reviewLogger.info('Cancelled notifications for item', {
        itemId,
        count: toCancel.length
      })
    }
  }

  /**
   * Get scheduled notifications count
   */
  async getScheduledCount(): Promise<number> {
    return this.scheduled.size
  }

  /**
   * Get all scheduled notifications
   */
  getScheduledNotifications(): ScheduledNotification[] {
    return Array.from(this.scheduled.values())
  }

  /**
   * Get scheduled notifications for user
   */
  getScheduledForUser(userId: string): ScheduledNotification[] {
    return Array.from(this.scheduled.values())
      .filter(n => n.userId === userId)
      .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
  }

  /**
   * Open IndexedDB connection
   */
  private async openIndexedDB(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reviewLogger.warn('IndexedDB not available')
      return
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' })
          store.createIndex('userId', 'userId', { unique: false })
          store.createIndex('scheduledFor', 'scheduledFor', { unique: false })
        }
      }

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result
        reviewLogger.info('IndexedDB opened successfully')
        resolve()
      }

      request.onerror = (event) => {
        reviewLogger.error('Failed to open IndexedDB', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * Persist notification to IndexedDB
   */
  private async persistToIndexedDB(notification: ScheduledNotification): Promise<void> {
    if (!this.db) return

    try {
      const tx = this.db.transaction([this.STORE_NAME], 'readwrite')
      const store = tx.objectStore(this.STORE_NAME)

      const data: IndexedDBNotification = {
        id: notification.id,
        userId: notification.userId,
        scheduledFor: notification.scheduledFor.getTime(),
        notification: this.prepareNotificationContent(
          notification.type,
          null,
          notification.metadata
        ),
        metadata: {
          type: notification.type,
          priority: notification.priority,
          channels: notification.channels,
          itemId: notification.itemId,
          itemIds: notification.itemIds,
          ...notification.metadata
        }
      }

      await new Promise((resolve, reject) => {
        const request = store.put(data)
        request.onsuccess = resolve
        request.onerror = () => reject(request.error)
      })

      reviewLogger.debug('Notification persisted to IndexedDB', { id: notification.id })
    } catch (error) {
      reviewLogger.error('Failed to persist notification to IndexedDB', error)
    }
  }

  /**
   * Remove notification from IndexedDB
   */
  private async removeFromIndexedDB(id: string): Promise<void> {
    if (!this.db) return

    try {
      const tx = this.db.transaction([this.STORE_NAME], 'readwrite')
      const store = tx.objectStore(this.STORE_NAME)

      await new Promise((resolve, reject) => {
        const request = store.delete(id)
        request.onsuccess = resolve
        request.onerror = () => reject(request.error)
      })

      reviewLogger.debug('Notification removed from IndexedDB', { id })
    } catch (error) {
      reviewLogger.error('Failed to remove notification from IndexedDB', error)
    }
  }

  /**
   * Restore scheduled notifications from IndexedDB
   */
  async restoreScheduledNotifications(): Promise<void> {
    if (!this.db || !this.userId) return

    try {
      const tx = this.db.transaction([this.STORE_NAME], 'readonly')
      const store = tx.objectStore(this.STORE_NAME)
      const index = store.index('userId')

      const notifications = await new Promise<IndexedDBNotification[]>((resolve, reject) => {
        const request = index.getAll(this.userId!)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      const now = Date.now()
      let restoredCount = 0
      let firedCount = 0

      for (const stored of notifications) {
        const scheduledFor = new Date(stored.scheduledFor)
        const delay = scheduledFor.getTime() - now

        if (delay <= 0) {
          // Fire overdue notifications immediately
          await this.fireNotification({
            userId: stored.userId,
            itemId: stored.metadata?.itemId,
            itemIds: stored.metadata?.itemIds,
            type: stored.metadata?.type || 'review_due',
            scheduledFor,
            priority: stored.metadata?.priority || 'normal',
            channels: stored.metadata?.channels,
            metadata: stored.metadata
          })

          // Remove from IndexedDB
          await this.removeFromIndexedDB(stored.id)
          firedCount++
        } else if (delay < 2147483647) {
          // Reschedule if within timeout range
          await this.scheduleNotification({
            userId: stored.userId,
            itemId: stored.metadata?.itemId,
            itemIds: stored.metadata?.itemIds,
            type: stored.metadata?.type || 'review_due',
            scheduledFor,
            priority: stored.metadata?.priority || 'normal',
            channels: stored.metadata?.channels,
            metadata: stored.metadata
          })
          restoredCount++
        }
      }

      reviewLogger.info('Restored scheduled notifications', {
        total: notifications.length,
        restored: restoredCount,
        fired: firedCount
      })
    } catch (error) {
      reviewLogger.error('Failed to restore scheduled notifications', error)
    }
  }

  /**
   * Fetch item details (placeholder - would connect to actual data source)
   */
  private async fetchItemDetails(itemId: string): Promise<any> {
    // This would normally fetch from the review engine or database
    // For now, return mock data
    return {
      id: itemId,
      primaryDisplay: 'Review Item',
      contentType: 'vocabulary',
      meaning: 'example'
    }
  }

  /**
   * Generate unique notification ID
   */
  private generateId(userId: string, itemIdentifier: string, scheduledFor: Date): string {
    return `${userId}_${itemIdentifier}_${scheduledFor.getTime()}`
  }

  /**
   * Track analytics event
   */
  private trackEvent(eventName: string, data: any): void {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName, {
        event_category: 'Notifications',
        event_label: 'Scheduler',
        ...data
      })
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Clear all timers through TimerManager
    this.timerManager.clearAll()

    // Clear scheduled map
    this.scheduled.clear()

    // Close IndexedDB
    if (this.db) {
      this.db.close()
      this.db = null
    }

    // Destroy timer manager to release all resources
    this.timerManager.destroy()

    this.userId = null
    this.orchestrator = null

    reviewLogger.info('NotificationScheduler cleanup complete')
  }
}