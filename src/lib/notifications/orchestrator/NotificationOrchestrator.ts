/**
 * NotificationOrchestrator Service
 * Central orchestration service for all notification channels
 */

import { EventEmitter } from 'events'
import { ReviewEventType, ReviewEvent, ItemAnsweredPayload } from '@/lib/review-engine/core/events'
import { reviewLogger } from '@/lib/monitoring/logger'
import { SRSAlgorithm } from '@/lib/review-engine/srs/algorithm'
import {
  NotificationChannel,
  NotificationType,
  NotificationContent,
  ScheduledNotification,
  ReviewNotificationData,
  NotificationEventPayload
} from '../types/notifications.types'

// Import services (to be implemented)
import { NotificationScheduler } from './NotificationScheduler'
import { NotificationQueue } from './NotificationQueue'
import { PreferenceManager } from '../preferences/PreferenceManager'
import { BrowserNotificationService } from '../browser/BrowserNotificationService'

/**
 * Notification orchestrator options
 */
export interface OrchestratorOptions {
  userId: string
  enableLogging?: boolean
  autoInitialize?: boolean
}

/**
 * Main NotificationOrchestrator class
 * Singleton pattern for global instance management
 */
export class NotificationOrchestrator extends EventEmitter {
  private static instance: NotificationOrchestrator | null = null
  private scheduler: NotificationScheduler
  private queue: NotificationQueue
  private preferences: PreferenceManager
  private browserService: BrowserNotificationService
  private srsAlgorithm: SRSAlgorithm

  private userId: string | null = null
  private initialized = false
  private reviewEngineUnsubscribe?: () => void
  private eventListeners: Map<string, (...args: any[]) => void> = new Map()

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    super()
    this.scheduler = new NotificationScheduler()
    this.queue = new NotificationQueue()
    this.preferences = new PreferenceManager()
    this.browserService = new BrowserNotificationService()
    this.srsAlgorithm = new SRSAlgorithm()

    // Set orchestrator reference in scheduler
    this.scheduler.setOrchestrator(this)
  }

  /**
   * Get singleton instance
   */
  static getInstance(): NotificationOrchestrator {
    if (!this.instance) {
      this.instance = new NotificationOrchestrator()
    }
    return this.instance
  }

  /**
   * Initialize the orchestrator for a user
   */
  async initialize(userId: string): Promise<void> {
    if (this.initialized && this.userId === userId) {
      reviewLogger.info('NotificationOrchestrator already initialized', { userId })
      return
    }

    try {
      this.userId = userId

      // Load user preferences
      await this.preferences.initialize(userId)

      // Initialize services
      await this.browserService.initialize()
      await this.queue.initialize(userId)
      await this.scheduler.initialize(userId)

      // Subscribe to Review Engine events
      this.subscribeToReviewEngine()

      // Process any pending notifications
      await this.processPendingNotifications()

      // Restore scheduled notifications from IndexedDB
      await this.scheduler.restoreScheduledNotifications()

      this.initialized = true
      reviewLogger.info('NotificationOrchestrator initialized', { userId })

      // Emit initialization event
      this.emit('initialized', { userId })
    } catch (error) {
      reviewLogger.error('Failed to initialize NotificationOrchestrator', { userId, error })
      throw error
    }
  }

  /**
   * Subscribe to Review Engine events
   */
  private subscribeToReviewEngine(): void {
    if (typeof window === 'undefined') return

    // Get Review Engine instance if available
    const reviewEngine = (window as any).__REVIEW_ENGINE_INSTANCE__
    if (!reviewEngine) {
      reviewLogger.warn('Review Engine instance not found, deferring event subscription')
      // Set up a listener for when Review Engine becomes available
      this.setupDeferredSubscription()
      return
    }

    this.attachReviewEngineListeners(reviewEngine)
  }

  /**
   * Set up deferred subscription for Review Engine
   */
  private setupDeferredSubscription(): void {
    const checkInterval = setInterval(() => {
      const reviewEngine = (window as any).__REVIEW_ENGINE_INSTANCE__
      if (reviewEngine) {
        clearInterval(checkInterval)
        this.attachReviewEngineListeners(reviewEngine)
        reviewLogger.info('Review Engine found, attaching listeners')
      }
    }, 1000)

    // Stop checking after 30 seconds
    setTimeout(() => clearInterval(checkInterval), 30000)
  }

  /**
   * Attach listeners to Review Engine
   */
  private attachReviewEngineListeners(reviewEngine: any): void {
    // Handle item answered event
    const handleItemAnswered = this.handleItemAnswered.bind(this)
    reviewEngine.on(ReviewEventType.ITEM_ANSWERED, handleItemAnswered)
    this.eventListeners.set(ReviewEventType.ITEM_ANSWERED, handleItemAnswered)

    // Handle session completed event
    const handleSessionCompleted = this.handleSessionCompleted.bind(this)
    reviewEngine.on(ReviewEventType.SESSION_COMPLETED, handleSessionCompleted)
    this.eventListeners.set(ReviewEventType.SESSION_COMPLETED, handleSessionCompleted)

    // Handle progress updated event
    const handleProgressUpdated = this.handleProgressUpdated.bind(this)
    reviewEngine.on(ReviewEventType.PROGRESS_UPDATED, handleProgressUpdated)
    this.eventListeners.set(ReviewEventType.PROGRESS_UPDATED, handleProgressUpdated)

    // Store unsubscribe function
    this.reviewEngineUnsubscribe = () => {
      this.eventListeners.forEach((handler, event) => {
        reviewEngine.off(event, handler)
      })
      this.eventListeners.clear()
    }

    reviewLogger.info('Review Engine listeners attached')
  }

  /**
   * Handle item answered event
   */
  private async handleItemAnswered(event: ReviewEvent<ItemAnsweredPayload>): Promise<void> {
    if (!this.userId || !this.initialized) return

    const { itemId, correct, contentType, nextReviewAt, srsData } = event.data as any

    reviewLogger.info('Item answered event received', {
      itemId,
      correct,
      contentType,
      nextReviewAt,
      hasNextReview: !!nextReviewAt
    })

    // Only schedule if answer was correct and there's a next review
    if (correct && nextReviewAt) {
      await this.scheduleReviewNotification({
        itemId,
        itemType: contentType || 'review',
        userId: this.userId,
        reviewAt: new Date(nextReviewAt),
        interval: srsData?.interval || 0,
        repetitions: srsData?.repetitions || 0
      })
    }

    // Emit event for other agents
    this.emit('review:answered', {
      itemId,
      correct,
      nextReviewAt
    })
  }

  /**
   * Handle session completed event
   */
  private async handleSessionCompleted(event: ReviewEvent): Promise<void> {
    reviewLogger.info('Session completed', event.data)

    // Update notification queue based on session results
    await this.queue.processSessionResults(event.data)

    // Emit event for other agents
    this.emit('session:completed', event.data)
  }

  /**
   * Handle progress updated event
   */
  private async handleProgressUpdated(event: ReviewEvent): Promise<void> {
    // Check for achievements or milestones
    const { accuracy, streak } = event.data

    if (streak && streak % 10 === 0) {
      // Streak milestone notification
      await this.sendNotification({
        userId: this.userId!,
        title: `🎉 ${streak} Day Streak!`,
        body: `Amazing! You've maintained a ${streak} day learning streak!`,
        type: 'achievement',
        channels: ['browser', 'inApp']
      })
    }

    // Emit event for other agents
    this.emit('progress:updated', event.data)
  }

  /**
   * Schedule a review notification
   */
  async scheduleReviewNotification(params: ReviewNotificationData): Promise<void> {
    const { itemId, userId, reviewAt, itemType, interval } = params

    // Check user preferences
    const prefs = await this.preferences.getPreferences()
    if (!prefs) {
      reviewLogger.warn('No preferences found, skipping notification')
      return
    }

    // Check if any notification channels are enabled
    const hasEnabledChannels = Object.values(prefs.channels).some(enabled => enabled)
    if (!hasEnabledChannels) {
      reviewLogger.info('No notification channels enabled', { userId })
      return
    }

    // Calculate delay until review time
    const delay = reviewAt.getTime() - Date.now()

    reviewLogger.info('Scheduling review notification', {
      itemId,
      reviewAt: reviewAt.toISOString(),
      delay: `${Math.round(delay / 1000)}s`,
      interval
    })

    if (delay <= 0) {
      // Item is already due
      await this.sendImmediateNotification({
        itemId,
        userId,
        itemType,
        title: `Review Due: ${params.primaryDisplay || itemType}`,
        body: 'Your review is ready. Keep your streak going!'
      })
    } else if (delay < 60 * 60 * 1000) { // Less than 1 hour
      // Schedule for exact time (10 min, 30 min reviews)
      if (prefs.timing.immediate) {
        await this.scheduler.scheduleNotification({
          userId,
          itemId,
          type: 'review_due',
          scheduledFor: reviewAt,
          priority: 'high',
          channels: this.getEnabledChannels(prefs)
        })

        // Emit event for in-app countdown (Agent 2)
        this.emit('countdown:add', {
          itemId,
          dueDate: reviewAt
        })
      }
    } else {
      // Schedule for daily batch (1+ day reviews)
      if (prefs.timing.daily) {
        await this.queue.addToDaily({
          userId,
          itemId,
          itemType,
          dueDate: reviewAt,
          interval
        })
      }
    }

    // Emit scheduling event
    this.emit('notification:scheduled', {
      itemId,
      reviewAt,
      delay,
      type: delay < 3600000 ? 'immediate' : 'daily'
    })
  }

  /**
   * Send an immediate notification
   */
  private async sendImmediateNotification(params: any): Promise<void> {
    await this.sendNotification({
      ...params,
      type: 'review_due',
      priority: 'high'
    })
  }

  /**
   * Send notification through enabled channels
   */
  async sendNotification(params: {
    userId: string
    title: string
    body: string
    type?: NotificationType
    data?: any
    channels?: NotificationChannel[]
    priority?: 'high' | 'normal' | 'low'
  }): Promise<void> {
    const { userId, title, body, data, channels, type = 'review_due' } = params

    // Check quiet hours
    const inQuietHours = await this.preferences.isInQuietHours()
    if (inQuietHours) {
      reviewLogger.info('In quiet hours, queueing notification')
      const quietHoursEnd = await this.preferences.getQuietHoursEnd()
      await this.queue.addToQueue({
        userId,
        type,
        title,
        body,
        data,
        scheduledFor: quietHoursEnd
      })
      return
    }

    // Get enabled channels
    const prefs = await this.preferences.getPreferences()
    if (!prefs) return

    const enabledChannels = channels?.filter(ch => prefs.channels[ch]) ||
                           this.getEnabledChannels(prefs)

    reviewLogger.info('Sending notification', {
      title,
      enabledChannels,
      type
    })

    // Send to each enabled channel
    const promises = enabledChannels.map(channel => {
      switch (channel) {
        case 'browser':
          return this.sendBrowserNotification({ title, body, data })
        case 'inApp':
          return this.sendInAppNotification({ title, body, data })
        case 'push':
          return this.sendPushNotification({ userId, title, body, data })
        case 'email':
          return this.sendEmailNotification({ userId, title, body, data })
        default:
          return Promise.resolve()
      }
    })

    const results = await Promise.allSettled(promises)

    // Log results
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        reviewLogger.error('Failed to send notification', {
          channel: enabledChannels[index],
          error: result.reason
        })
      }
    })

    // Track notification sent
    this.emit('notification:sent', {
      type,
      channels: enabledChannels,
      timestamp: new Date()
    })
  }

  /**
   * Send browser notification
   */
  private async sendBrowserNotification(params: any): Promise<void> {
    await this.browserService.send({
      title: params.title,
      body: params.body,
      data: params.data,
      requireInteraction: true
    })
  }

  /**
   * Send in-app notification (placeholder for Agent 2)
   */
  private async sendInAppNotification(params: any): Promise<void> {
    this.emit('inApp:notification', params)
  }

  /**
   * Send push notification (placeholder for Agent 3)
   */
  private async sendPushNotification(params: any): Promise<void> {
    this.emit('push:notification', params)
  }

  /**
   * Send email notification (uses existing service)
   */
  private async sendEmailNotification(params: any): Promise<void> {
    this.emit('email:notification', params)
  }

  /**
   * Get enabled notification channels
   */
  private getEnabledChannels(prefs: any): NotificationChannel[] {
    return Object.entries(prefs.channels)
      .filter(([_, enabled]) => enabled)
      .map(([channel]) => channel as NotificationChannel)
  }

  /**
   * Process pending notifications from queue
   */
  private async processPendingNotifications(): Promise<void> {
    const pending = await this.queue.getPendingNotifications()

    reviewLogger.info('Processing pending notifications', {
      count: pending.length
    })

    for (const notification of pending) {
      const delay = notification.scheduled_for.toDate().getTime() - Date.now()

      if (delay <= 0) {
        // Send immediately
        await this.sendNotification({
          userId: notification.userId,
          title: notification.data.title || 'Review Reminder',
          body: notification.data.message,
          type: notification.type,
          data: notification.data,
          channels: [notification.channel]
        })
      } else if (delay < 60 * 60 * 1000) {
        // Reschedule if less than 1 hour
        await this.scheduler.scheduleNotification({
          userId: notification.userId,
          itemIds: notification.data.item_ids,
          type: notification.type,
          scheduledFor: notification.scheduled_for.toDate(),
          priority: notification.data.priority,
          channels: [notification.channel]
        })
      }
    }
  }

  /**
   * Request browser notification permission
   */
  async requestBrowserPermission(): Promise<NotificationPermission> {
    return await this.browserService.requestPermission()
  }

  /**
   * Get current notification statistics
   */
  async getNotificationStats(): Promise<any> {
    return {
      scheduled: await this.scheduler.getScheduledCount(),
      queued: await this.queue.getQueuedCount(),
      preferences: await this.preferences.getPreferences()
    }
  }

  /**
   * Clean up and release resources
   */
  async cleanup(): Promise<void> {
    reviewLogger.info('Cleaning up NotificationOrchestrator')

    // Unsubscribe from Review Engine
    this.reviewEngineUnsubscribe?.()

    // Clean up services
    await this.scheduler.cleanup()
    await this.queue.cleanup()
    await this.preferences.cleanup()

    // Clear event listeners
    this.removeAllListeners()

    this.initialized = false
    this.userId = null

    reviewLogger.info('NotificationOrchestrator cleanup complete')
  }

  /**
   * Reset singleton instance (mainly for testing)
   */
  static resetInstance(): void {
    if (this.instance) {
      this.instance.cleanup()
      this.instance = null
    }
  }
}