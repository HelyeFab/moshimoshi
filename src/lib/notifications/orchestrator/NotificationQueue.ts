/**
 * NotificationQueue
 * Manages queued notifications with Firestore persistence
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  deleteDoc,
  updateDoc,
  Timestamp,
  writeBatch
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { reviewLogger } from '@/lib/monitoring/logger'
import {
  NotificationQueueItem,
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  BatchNotification,
  ReviewNotificationData
} from '../types/notifications.types'

/**
 * Queue options
 */
export interface QueueOptions {
  userId: string
  itemId?: string
  itemType?: string
  type?: NotificationType
  title?: string
  body?: string
  data?: any
  scheduledFor: Date
  channel?: NotificationChannel
  priority?: NotificationPriority
}

/**
 * Daily notification options
 */
export interface DailyNotificationOptions {
  userId: string
  itemId: string
  itemType: string
  dueDate: Date
  interval: number
}

/**
 * NotificationQueue class
 */
export class NotificationQueue {
  private readonly COLLECTION_NAME = 'notifications_queue'
  private userId: string | null = null
  private batchingEnabled = true
  private batchWindowMinutes = 5
  private maxBatchSize = 10

  /**
   * Initialize queue for a user
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId

    // Clean up old notifications
    await this.cleanupOldNotifications()

    reviewLogger.info('NotificationQueue initialized', { userId })
  }

  /**
   * Add notification to queue
   */
  async addToQueue(options: QueueOptions): Promise<string> {
    const {
      userId,
      itemId,
      type = 'review_due',
      title = 'Review Reminder',
      body = 'You have items to review',
      data = {},
      scheduledFor,
      channel = 'browser',
      priority = 'normal'
    } = options

    // Check for batching
    if (this.batchingEnabled && type === 'review_due') {
      const existingBatch = await this.findBatchableNotification(userId, scheduledFor, channel)

      if (existingBatch) {
        // Add to existing batch
        await this.addToBatch(existingBatch.id, itemId)
        reviewLogger.info('Added to existing batch', {
          batchId: existingBatch.id,
          itemId
        })
        return existingBatch.id
      }
    }

    // Create new queue item
    const queueItem: Omit<NotificationQueueItem, 'id'> = {
      userId,
      type,
      channel,
      scheduled_for: Timestamp.fromDate(scheduledFor),
      data: {
        item_ids: itemId ? [itemId] : [],
        review_count: itemId ? 1 : 0,
        message: body,
        title,
        action_url: data.actionUrl || '/review',
        priority,
        metadata: data
      },
      status: 'pending',
      attempts: 0,
      created_at: Timestamp.now()
    }

    // Generate ID
    const id = this.generateQueueId()

    // Save to Firestore
    await setDoc(doc(db, this.COLLECTION_NAME, id), {
      ...queueItem,
      id
    })

    reviewLogger.info('Notification queued', {
      id,
      type,
      scheduledFor: scheduledFor.toISOString()
    })

    return id
  }

  /**
   * Add to daily notification batch
   */
  async addToDaily(options: DailyNotificationOptions): Promise<void> {
    const { userId, itemId, itemType, dueDate, interval } = options

    // Get or create daily batch for user
    const batchDate = this.getDailyBatchTime(dueDate)
    const batchId = `daily_${userId}_${batchDate.getTime()}`

    try {
      const batchRef = doc(db, this.COLLECTION_NAME, batchId)
      const batchSnap = await getDoc(batchRef)

      if (batchSnap.exists()) {
        // Update existing batch
        const batch = batchSnap.data() as NotificationQueueItem
        const updatedItemIds = [...(batch.data.item_ids || []), itemId]

        await updateDoc(batchRef, {
          'data.item_ids': updatedItemIds,
          'data.review_count': updatedItemIds.length,
          'data.message': `You have ${updatedItemIds.length} items ready to review`
        })

        reviewLogger.info('Added to daily batch', {
          batchId,
          itemId,
          totalItems: updatedItemIds.length
        })
      } else {
        // Create new daily batch
        const queueItem: NotificationQueueItem = {
          id: batchId,
          userId,
          type: 'daily_summary',
          channel: 'browser',
          scheduled_for: Timestamp.fromDate(batchDate),
          data: {
            item_ids: [itemId],
            review_count: 1,
            message: 'You have 1 item ready to review',
            title: '📚 Daily Review Reminder',
            action_url: '/review',
            priority: 'normal',
            metadata: {
              itemType,
              interval
            }
          },
          status: 'pending',
          attempts: 0,
          created_at: Timestamp.now()
        }

        await setDoc(batchRef, queueItem)

        reviewLogger.info('Created daily batch', {
          batchId,
          itemId,
          scheduledFor: batchDate.toISOString()
        })
      }
    } catch (error) {
      reviewLogger.error('Failed to add to daily batch', error)
      throw error
    }
  }

  /**
   * Get pending notifications
   */
  async getPendingNotifications(): Promise<NotificationQueueItem[]> {
    if (!this.userId) return []

    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', this.userId),
        where('status', '==', 'pending'),
        where('scheduled_for', '<=', Timestamp.now()),
        orderBy('scheduled_for', 'asc'),
        limit(10)
      )

      const snapshot = await getDocs(q)
      const notifications: NotificationQueueItem[] = []

      snapshot.forEach((doc) => {
        notifications.push(doc.data() as NotificationQueueItem)
      })

      reviewLogger.info('Retrieved pending notifications', {
        count: notifications.length,
        userId: this.userId
      })

      return notifications
    } catch (error) {
      reviewLogger.error('Failed to get pending notifications', error)
      return []
    }
  }

  /**
   * Get queued count
   */
  async getQueuedCount(): Promise<number> {
    if (!this.userId) return 0

    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', this.userId),
        where('status', '==', 'pending')
      )

      const snapshot = await getDocs(q)
      return snapshot.size
    } catch (error) {
      reviewLogger.error('Failed to get queued count', error)
      return 0
    }
  }

  /**
   * Mark notification as sent
   */
  async markAsSent(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, this.COLLECTION_NAME, notificationId), {
        status: 'sent',
        sent_at: Timestamp.now()
      })

      reviewLogger.info('Notification marked as sent', { id: notificationId })
    } catch (error) {
      reviewLogger.error('Failed to mark notification as sent', error)
    }
  }

  /**
   * Mark notification as failed
   */
  async markAsFailed(notificationId: string, error: string): Promise<void> {
    try {
      const notifRef = doc(db, this.COLLECTION_NAME, notificationId)
      const notifSnap = await getDoc(notifRef)

      if (notifSnap.exists()) {
        const notif = notifSnap.data() as NotificationQueueItem
        const attempts = (notif.attempts || 0) + 1

        await updateDoc(notifRef, {
          status: attempts >= 3 ? 'failed' : 'pending',
          attempts,
          error,
          last_attempt: Timestamp.now()
        })

        reviewLogger.info('Notification marked as failed', {
          id: notificationId,
          attempts,
          error
        })
      }
    } catch (err) {
      reviewLogger.error('Failed to mark notification as failed', err)
    }
  }

  /**
   * Process session results
   */
  async processSessionResults(sessionData: any): Promise<void> {
    const { userId, completedItems, nextReviews } = sessionData

    if (!nextReviews || nextReviews.length === 0) return

    // Group by review time
    const grouped = this.groupByReviewTime(nextReviews)

    // Process each group
    for (const [timeKey, items] of Object.entries(grouped)) {
      const scheduledFor = new Date(timeKey)
      const delay = scheduledFor.getTime() - Date.now()

      if (delay > 60 * 60 * 1000) { // More than 1 hour
        // Add to daily batch
        for (const item of items as any[]) {
          await this.addToDaily({
            userId,
            itemId: item.id,
            itemType: item.type,
            dueDate: scheduledFor,
            interval: item.interval
          })
        }
      }
    }

    reviewLogger.info('Processed session results', {
      userId,
      completedCount: completedItems?.length || 0,
      scheduledCount: nextReviews?.length || 0
    })
  }

  /**
   * Find batchable notification
   */
  private async findBatchableNotification(
    userId: string,
    scheduledFor: Date,
    channel: NotificationChannel
  ): Promise<NotificationQueueItem | null> {
    const windowStart = new Date(scheduledFor.getTime() - this.batchWindowMinutes * 60 * 1000)
    const windowEnd = new Date(scheduledFor.getTime() + this.batchWindowMinutes * 60 * 1000)

    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', userId),
        where('channel', '==', channel),
        where('status', '==', 'pending'),
        where('scheduled_for', '>=', Timestamp.fromDate(windowStart)),
        where('scheduled_for', '<=', Timestamp.fromDate(windowEnd)),
        limit(1)
      )

      const snapshot = await getDocs(q)

      if (!snapshot.empty) {
        const batch = snapshot.docs[0].data() as NotificationQueueItem

        // Check if batch is not full
        if ((batch.data.item_ids?.length || 0) < this.maxBatchSize) {
          return batch
        }
      }

      return null
    } catch (error) {
      reviewLogger.error('Failed to find batchable notification', error)
      return null
    }
  }

  /**
   * Add item to existing batch
   */
  private async addToBatch(batchId: string, itemId?: string): Promise<void> {
    if (!itemId) return

    try {
      const batchRef = doc(db, this.COLLECTION_NAME, batchId)
      const batchSnap = await getDoc(batchRef)

      if (batchSnap.exists()) {
        const batch = batchSnap.data() as NotificationQueueItem
        const updatedItemIds = [...(batch.data.item_ids || []), itemId]

        await updateDoc(batchRef, {
          'data.item_ids': updatedItemIds,
          'data.review_count': updatedItemIds.length,
          'data.message': `You have ${updatedItemIds.length} items ready to review`
        })
      }
    } catch (error) {
      reviewLogger.error('Failed to add to batch', error)
    }
  }

  /**
   * Get daily batch time (next 9 AM in user's timezone)
   */
  private getDailyBatchTime(dueDate: Date): Date {
    const batchTime = new Date(dueDate)
    batchTime.setHours(9, 0, 0, 0) // 9 AM

    // If due date is already past 9 AM, schedule for next day
    if (dueDate.getHours() >= 9) {
      batchTime.setDate(batchTime.getDate() + 1)
    }

    return batchTime
  }

  /**
   * Group items by review time
   */
  private groupByReviewTime(items: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {}

    items.forEach(item => {
      const timeKey = item.reviewAt.toISOString()
      if (!grouped[timeKey]) {
        grouped[timeKey] = []
      }
      grouped[timeKey].push(item)
    })

    return grouped
  }

  /**
   * Clean up old notifications
   */
  private async cleanupOldNotifications(): Promise<void> {
    if (!this.userId) return

    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 7) // 7 days ago

      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', this.userId),
        where('status', 'in', ['sent', 'failed', 'cancelled']),
        where('created_at', '<', Timestamp.fromDate(cutoffDate))
      )

      const snapshot = await getDocs(q)

      if (snapshot.size > 0) {
        const batch = writeBatch(db)

        snapshot.forEach((doc) => {
          batch.delete(doc.ref)
        })

        await batch.commit()

        reviewLogger.info('Cleaned up old notifications', {
          count: snapshot.size,
          userId: this.userId
        })
      }
    } catch (error) {
      reviewLogger.error('Failed to clean up old notifications', error)
    }
  }

  /**
   * Cancel notifications for item
   */
  async cancelNotificationsForItem(itemId: string): Promise<void> {
    if (!this.userId) return

    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', this.userId),
        where('data.item_ids', 'array-contains', itemId),
        where('status', '==', 'pending')
      )

      const snapshot = await getDocs(q)

      if (snapshot.size > 0) {
        const batch = writeBatch(db)

        snapshot.forEach((doc) => {
          batch.update(doc.ref, {
            status: 'cancelled'
          })
        })

        await batch.commit()

        reviewLogger.info('Cancelled notifications for item', {
          itemId,
          count: snapshot.size
        })
      }
    } catch (error) {
      reviewLogger.error('Failed to cancel notifications for item', error)
    }
  }

  /**
   * Generate queue ID
   */
  private generateQueueId(): string {
    return `${this.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Set batching configuration
   */
  setBatchingConfig(enabled: boolean, windowMinutes: number = 5): void {
    this.batchingEnabled = enabled
    this.batchWindowMinutes = windowMinutes

    reviewLogger.info('Batching config updated', {
      enabled,
      windowMinutes
    })
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.userId = null
    reviewLogger.info('NotificationQueue cleanup complete')
  }
}