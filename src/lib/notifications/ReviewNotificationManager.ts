/**
 * Review Notification Manager
 * Handles browser notifications and in-app reminders for SRS reviews
 */

import { reviewLogger } from '@/lib/monitoring/logger'

interface ScheduledNotification {
  id: string
  itemId: string
  content: string
  meaning: string
  contentType: 'hiragana' | 'katakana' | 'kanji' | 'vocabulary' | 'sentence'
  scheduledFor: Date
  timerId?: NodeJS.Timeout
  notified?: boolean
}

interface NotificationOptions {
  playSound?: boolean
  requireInteraction?: boolean
  showInApp?: boolean
  showBrowser?: boolean
}

export class ReviewNotificationManager {
  private static instance: ReviewNotificationManager
  private scheduledNotifications: Map<string, ScheduledNotification> = new Map()
  private permission: NotificationPermission = 'default'
  private enabled: boolean = true
  private inAppCallback?: (notification: ScheduledNotification) => void
  private soundEnabled: boolean = true
  private audioContext?: AudioContext

  private constructor() {
    this.initialize()
  }

  static getInstance(): ReviewNotificationManager {
    if (!this.instance) {
      this.instance = new ReviewNotificationManager()
    }
    return this.instance
  }

  private async initialize() {
    // Check if browser supports notifications
    if ('Notification' in window) {
      this.permission = Notification.permission
      this.loadSettings()
      this.restoreScheduledNotifications()
      
      // Initialize audio context for custom sounds
      if ('AudioContext' in window) {
        this.audioContext = new AudioContext()
      }
    }

    // Listen for visibility changes to handle in-app vs browser notifications
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
    
    // Listen for before unload to persist notifications
    window.addEventListener('beforeunload', () => {
      this.persistScheduledNotifications()
    })

    reviewLogger.info('ReviewNotificationManager initialized')
  }

  /**
   * Request permission for browser notifications
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      reviewLogger.warn('Browser does not support notifications')
      return 'denied'
    }

    try {
      this.permission = await Notification.requestPermission()
      
      if (this.permission === 'granted') {
        // Show success notification
        this.showBrowserNotification(
          '🎉 Notifications Enabled!',
          'You\'ll be reminded when reviews are due',
          { requireInteraction: false }
        )
        
        // Save permission status
        localStorage.setItem('notification_permission', this.permission)
        reviewLogger.info('Notification permission granted')
      }
      
      return this.permission
    } catch (error) {
      reviewLogger.error('Failed to request notification permission:', error)
      return 'denied'
    }
  }

  /**
   * Schedule a notification for a review item
   */
  scheduleReviewNotification(
    itemId: string,
    content: string,
    meaning: string,
    contentType: ScheduledNotification['contentType'],
    reviewAt: Date,
    options: NotificationOptions = {}
  ): string {
    const id = `${itemId}_${reviewAt.getTime()}`
    
    // Cancel existing notification for this item
    this.cancelNotification(id)
    
    const delay = reviewAt.getTime() - Date.now()
    
    if (delay <= 0) {
      // Item is already due, notify immediately
      this.fireNotification({
        id,
        itemId,
        content,
        meaning,
        contentType,
        scheduledFor: reviewAt
      }, options)
      return id
    }
    
    // Only schedule if within reasonable time frame (24 hours)
    if (delay > 24 * 60 * 60 * 1000) {
      reviewLogger.debug(`Not scheduling notification for ${content} - too far in future`)
      return id
    }
    
    // Create scheduled notification
    const notification: ScheduledNotification = {
      id,
      itemId,
      content,
      meaning,
      contentType,
      scheduledFor: reviewAt
    }
    
    // Set timer
    notification.timerId = setTimeout(() => {
      this.fireNotification(notification, options)
      this.scheduledNotifications.delete(id)
    }, delay)
    
    this.scheduledNotifications.set(id, notification)
    this.persistScheduledNotifications()
    
    reviewLogger.info(`Scheduled notification for ${content} at ${reviewAt.toLocaleTimeString()}`)
    
    return id
  }

  /**
   * Fire a notification (browser and/or in-app)
   */
  private async fireNotification(
    notification: ScheduledNotification,
    options: NotificationOptions = {}
  ) {
    if (!this.enabled) return
    
    const {
      showInApp = true,
      showBrowser = true,
      playSound = true,
      requireInteraction = true
    } = options
    
    notification.notified = true
    
    // Determine which type of notification to show based on tab visibility
    const isTabVisible = document.visibilityState === 'visible'
    
    if (isTabVisible && showInApp && this.inAppCallback) {
      // Show in-app notification when tab is visible
      this.inAppCallback(notification)
      
      if (playSound && this.soundEnabled) {
        this.playNotificationSound(notification.contentType)
      }
    } else if (!isTabVisible && showBrowser && this.permission === 'granted') {
      // Show browser notification when tab is not visible
      await this.showReviewNotification(notification, requireInteraction)
    }
    
    // Log the notification
    reviewLogger.info('Notification fired:', {
      itemId: notification.itemId,
      content: notification.content,
      type: isTabVisible ? 'in-app' : 'browser'
    })
  }

  /**
   * Show browser notification for review
   */
  private async showReviewNotification(
    notification: ScheduledNotification,
    requireInteraction: boolean = true
  ) {
    const { content, meaning, contentType } = notification
    
    // Get emoji for content type
    const emoji = this.getContentTypeEmoji(contentType)
    
    // Create notification
    const browserNotification = new Notification(
      `${emoji} Review Due: ${content}`,
      {
        body: meaning,
        icon: '/icons/icon-192x192.svg',
        badge: '/icons/icon-72x72.svg',
        tag: notification.id,
        requireInteraction,
        renotify: true,
        vibrate: [200, 100, 200],
        data: {
          itemId: notification.itemId,
          contentType,
          url: `/review?item=${notification.itemId}`
        },
        actions: [
          { action: 'review', title: '📝 Review Now' },
          { action: 'snooze', title: '⏰ 10 min' }
        ]
      } as NotificationOptions
    )
    
    // Handle notification click
    browserNotification.onclick = (event) => {
      event.preventDefault()
      window.focus()
      window.location.href = `/review?item=${notification.itemId}`
      browserNotification.close()
    }
    
    // Handle action clicks (if supported)
    if ('onaction' in browserNotification) {
      (browserNotification as any).onaction = (event: any) => {
        if (event.action === 'review') {
          window.focus()
          window.location.href = `/review?item=${notification.itemId}`
        } else if (event.action === 'snooze') {
          // Reschedule for 10 minutes later
          const snoozeTime = new Date(Date.now() + 10 * 60 * 1000)
          this.scheduleReviewNotification(
            notification.itemId,
            notification.content,
            notification.meaning,
            notification.contentType,
            snoozeTime
          )
        }
        browserNotification.close()
      }
    }
  }

  /**
   * Show generic browser notification
   */
  private showBrowserNotification(
    title: string,
    body: string,
    options: Partial<NotificationOptions> = {}
  ) {
    if (this.permission !== 'granted') return
    
    new Notification(title, {
      body,
      icon: '/icons/icon-192x192.svg',
      ...options
    })
  }

  /**
   * Play notification sound based on content type
   */
  private async playNotificationSound(contentType: string) {
    if (!this.audioContext || !this.soundEnabled) return
    
    try {
      // Create oscillator for different tones based on content type
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)
      
      // Different frequencies for different content types
      const frequencies: Record<string, number[]> = {
        hiragana: [523, 659, 784], // C, E, G - major chord
        katakana: [587, 740, 880], // D, F#, A - major chord
        kanji: [440, 554, 659],    // A, C#, E - major chord
        vocabulary: [494, 622, 740], // B, D#, F# - major chord
        sentence: [392, 494, 587]  // G, B, D - major chord
      }
      
      const notes = frequencies[contentType] || [523, 659, 784]
      
      // Play a pleasant three-note chime
      const currentTime = this.audioContext.currentTime
      
      notes.forEach((freq, index) => {
        const startTime = currentTime + (index * 0.1)
        const endTime = startTime + 0.2
        
        oscillator.frequency.setValueAtTime(freq, startTime)
        gainNode.gain.setValueAtTime(0.3, startTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, endTime)
      })
      
      oscillator.start(currentTime)
      oscillator.stop(currentTime + 0.5)
    } catch (error) {
      reviewLogger.warn('Failed to play notification sound:', error)
    }
  }

  /**
   * Get emoji for content type
   */
  private getContentTypeEmoji(contentType: string): string {
    const emojis: Record<string, string> = {
      hiragana: '🔤',
      katakana: '🔠',
      kanji: '㊙️',
      vocabulary: '📚',
      sentence: '💬'
    }
    return emojis[contentType] || '📝'
  }

  /**
   * Cancel a scheduled notification
   */
  cancelNotification(id: string) {
    const notification = this.scheduledNotifications.get(id)
    if (notification?.timerId) {
      clearTimeout(notification.timerId)
      this.scheduledNotifications.delete(id)
      this.persistScheduledNotifications()
      reviewLogger.debug(`Cancelled notification: ${id}`)
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  cancelAllNotifications() {
    this.scheduledNotifications.forEach((notification) => {
      if (notification.timerId) {
        clearTimeout(notification.timerId)
      }
    })
    this.scheduledNotifications.clear()
    this.persistScheduledNotifications()
    reviewLogger.info('Cancelled all notifications')
  }

  /**
   * Set in-app notification callback
   */
  setInAppCallback(callback: (notification: ScheduledNotification) => void) {
    this.inAppCallback = callback
  }

  /**
   * Enable/disable notifications
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled
    localStorage.setItem('notifications_enabled', String(enabled))
    reviewLogger.info(`Notifications ${enabled ? 'enabled' : 'disabled'}`)
  }

  /**
   * Enable/disable sound
   */
  setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled
    localStorage.setItem('notification_sound_enabled', String(enabled))
  }

  /**
   * Get scheduled notifications
   */
  getScheduledNotifications(): ScheduledNotification[] {
    return Array.from(this.scheduledNotifications.values())
      .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
  }

  /**
   * Handle tab visibility change
   */
  private handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      // Check for any overdue notifications when tab becomes visible
      const now = Date.now()
      this.scheduledNotifications.forEach((notification) => {
        if (notification.scheduledFor.getTime() <= now && !notification.notified) {
          this.fireNotification(notification, { showInApp: true, showBrowser: false })
        }
      })
    }
  }

  /**
   * Persist scheduled notifications to localStorage
   */
  private persistScheduledNotifications() {
    const notifications = Array.from(this.scheduledNotifications.values()).map(n => ({
      id: n.id,
      itemId: n.itemId,
      content: n.content,
      meaning: n.meaning,
      contentType: n.contentType,
      scheduledFor: n.scheduledFor.toISOString()
    }))
    
    localStorage.setItem('scheduled_review_notifications', JSON.stringify(notifications))
  }

  /**
   * Restore scheduled notifications from localStorage
   */
  private restoreScheduledNotifications() {
    try {
      const stored = localStorage.getItem('scheduled_review_notifications')
      if (!stored) return
      
      const notifications = JSON.parse(stored)
      const now = Date.now()
      
      notifications.forEach((n: any) => {
        const scheduledFor = new Date(n.scheduledFor)
        const delay = scheduledFor.getTime() - now
        
        if (delay > 0) {
          // Reschedule future notifications
          this.scheduleReviewNotification(
            n.itemId,
            n.content,
            n.meaning,
            n.contentType,
            scheduledFor
          )
        } else {
          // Fire overdue notifications
          this.fireNotification({
            ...n,
            scheduledFor
          }, { showInApp: true, showBrowser: false })
        }
      })
      
      reviewLogger.info(`Restored ${notifications.length} scheduled notifications`)
    } catch (error) {
      reviewLogger.error('Failed to restore scheduled notifications:', error)
    }
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings() {
    this.enabled = localStorage.getItem('notifications_enabled') !== 'false'
    this.soundEnabled = localStorage.getItem('notification_sound_enabled') !== 'false'
    this.permission = (localStorage.getItem('notification_permission') as NotificationPermission) || 'default'
  }

  /**
   * Get current permission status
   */
  getPermission(): NotificationPermission {
    return this.permission
  }

  /**
   * Check if notifications are enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Check if sound is enabled
   */
  isSoundEnabled(): boolean {
    return this.soundEnabled
  }
}