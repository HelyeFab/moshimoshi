/**
 * BrowserNotificationService
 * Handles browser notification permissions and display
 */

import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { reviewLogger } from '@/lib/monitoring/logger'
import { NotificationContent, NotificationTokens } from '../types/notifications.types'

/**
 * Browser notification options
 */
export interface BrowserNotificationOptions extends NotificationContent {
  onClick?: () => void
  onClose?: () => void
  onError?: (error: any) => void
}

/**
 * Browser notification service class
 */
export class BrowserNotificationService {
  private permission: NotificationPermission = 'default'
  private userId: string | null = null
  private soundEnabled = true
  private notificationSound: HTMLAudioElement | null = null

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (!this.isSupported()) {
      reviewLogger.warn('Browser notifications not supported')
      return
    }

    // Get current permission state
    this.permission = Notification.permission

    // Preload notification sound
    this.preloadSound()

    reviewLogger.info('BrowserNotificationService initialized', {
      permission: this.permission,
      supported: true
    })
  }

  /**
   * Check if browser notifications are supported
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' &&
           'Notification' in window &&
           'permissions' in navigator
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      reviewLogger.warn('Browser notifications not supported')
      return 'denied'
    }

    try {
      // Request permission
      this.permission = await Notification.requestPermission()

      reviewLogger.info('Notification permission requested', {
        result: this.permission
      })

      // Store permission in database
      if (this.userId) {
        await this.storePermission(this.userId, this.permission)
      }

      // Track permission event
      this.trackEvent('permission_requested', {
        result: this.permission
      })

      return this.permission
    } catch (error) {
      reviewLogger.error('Failed to request notification permission', error)
      return 'denied'
    }
  }

  /**
   * Set user ID for permission tracking
   */
  setUserId(userId: string): void {
    this.userId = userId
  }

  /**
   * Check current permission status
   */
  async checkPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied'
    }

    // Query permissions API for current state
    try {
      const result = await navigator.permissions.query({ name: 'notifications' as PermissionName })

      switch (result.state) {
        case 'granted':
          this.permission = 'granted'
          break
        case 'denied':
          this.permission = 'denied'
          break
        default:
          this.permission = 'default'
      }

      // Listen for permission changes
      result.addEventListener('change', () => {
        this.handlePermissionChange(result.state)
      })
    } catch (error) {
      // Fallback to Notification.permission
      this.permission = Notification.permission
    }

    return this.permission
  }

  /**
   * Send a browser notification
   */
  async send(options: BrowserNotificationOptions): Promise<void> {
    // Check permission
    if (this.permission !== 'granted') {
      reviewLogger.warn('Cannot send notification, permission not granted', {
        permission: this.permission
      })

      // Try to request permission if it's default
      if (this.permission === 'default') {
        const newPermission = await this.requestPermission()
        if (newPermission !== 'granted') {
          return
        }
      } else {
        return
      }
    }

    try {
      const {
        title,
        body,
        icon = '/icons/icon-192x192.svg',
        badge = '/icons/icon-72x72.svg',
        image,
        data = {},
        actions = [],
        requireInteraction = false,
        silent = false,
        tag = 'review-reminder',
        renotify = true,
        vibrate = [200, 100, 200],
        onClick,
        onClose,
        onError
      } = options

      // Create notification
      const notification = new Notification(title, {
        body,
        icon,
        badge,
        image,
        data,
        actions,
        requireInteraction,
        silent,
        tag,
        renotify,
        vibrate,
        timestamp: Date.now()
      })

      // Play sound if enabled
      if (!silent && this.soundEnabled) {
        this.playSound()
      }

      // Handle click event
      notification.onclick = (event) => {
        event.preventDefault()

        // Focus window
        if (window.focus) {
          window.focus()
        }

        // Navigate to action URL if provided
        if (data.actionUrl) {
          window.location.href = data.actionUrl
        }

        // Call custom onClick handler
        onClick?.()

        // Track click event
        this.trackEvent('notification_clicked', {
          title,
          tag,
          actionUrl: data.actionUrl
        })

        notification.close()
      }

      // Handle close event
      notification.onclose = () => {
        onClose?.()

        this.trackEvent('notification_closed', {
          title,
          tag
        })
      }

      // Handle error event
      notification.onerror = (error) => {
        reviewLogger.error('Notification error', error)
        onError?.(error)

        this.trackEvent('notification_error', {
          title,
          error: error.toString()
        })
      }

      // Track notification sent
      this.trackEvent('notification_sent', {
        title,
        tag,
        requireInteraction,
        hasActions: actions.length > 0
      })

      reviewLogger.info('Browser notification sent', {
        title,
        tag
      })
    } catch (error) {
      reviewLogger.error('Failed to send browser notification', error)
      throw error
    }
  }

  /**
   * Send a test notification
   */
  async sendTest(): Promise<void> {
    await this.send({
      title: '🔔 Test Notification',
      body: 'This is a test of your notification settings. Click to dismiss.',
      data: {
        test: true
      },
      requireInteraction: true,
      actions: [
        { action: 'view', title: 'View Settings' }
      ],
      onClick: () => {
        window.location.href = '/settings#notifications'
      }
    })
  }

  /**
   * Handle permission change
   */
  private handlePermissionChange(state: PermissionState): void {
    const oldPermission = this.permission

    switch (state) {
      case 'granted':
        this.permission = 'granted'
        break
      case 'denied':
        this.permission = 'denied'
        break
      default:
        this.permission = 'default'
    }

    if (oldPermission !== this.permission) {
      reviewLogger.info('Notification permission changed', {
        from: oldPermission,
        to: this.permission
      })

      // Store updated permission
      if (this.userId) {
        this.storePermission(this.userId, this.permission)
      }

      // Track permission change
      this.trackEvent('permission_changed', {
        from: oldPermission,
        to: this.permission
      })
    }
  }

  /**
   * Store permission in Firestore
   */
  private async storePermission(userId: string, permission: NotificationPermission): Promise<void> {
    try {
      const tokenData: Partial<NotificationTokens> = {
        userId,
        browser_permission: permission,
        browser_permission_updated: new Date(),
        device_info: this.getDeviceInfo()
      }

      await setDoc(doc(db, 'notifications_tokens', userId), tokenData, { merge: true })

      reviewLogger.info('Permission stored in database', {
        userId,
        permission
      })
    } catch (error) {
      reviewLogger.error('Failed to store permission', error)
    }
  }

  /**
   * Get stored permission from Firestore
   */
  async getStoredPermission(userId: string): Promise<NotificationPermission | null> {
    try {
      const docRef = doc(db, 'notifications_tokens', userId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data() as NotificationTokens
        return data.browser_permission || null
      }

      return null
    } catch (error) {
      reviewLogger.error('Failed to get stored permission', error)
      return null
    }
  }

  /**
   * Get device information
   */
  private getDeviceInfo(): any {
    const userAgent = navigator.userAgent
    const platform = navigator.platform

    // Parse browser information
    let browser = 'Unknown'
    let version = 'Unknown'

    if (userAgent.includes('Chrome')) {
      browser = 'Chrome'
      version = userAgent.match(/Chrome\/(\S+)/)?.[1] || 'Unknown'
    } else if (userAgent.includes('Safari')) {
      browser = 'Safari'
      version = userAgent.match(/Version\/(\S+)/)?.[1] || 'Unknown'
    } else if (userAgent.includes('Firefox')) {
      browser = 'Firefox'
      version = userAgent.match(/Firefox\/(\S+)/)?.[1] || 'Unknown'
    } else if (userAgent.includes('Edge')) {
      browser = 'Edge'
      version = userAgent.match(/Edge\/(\S+)/)?.[1] || 'Unknown'
    }

    return {
      platform,
      browser,
      version,
      userAgent: userAgent.substring(0, 200) // Limit length
    }
  }

  /**
   * Preload notification sound
   */
  private preloadSound(): void {
    if (typeof window === 'undefined') return

    try {
      this.notificationSound = new Audio('/sounds/notification.wav')
      this.notificationSound.preload = 'auto'
      this.notificationSound.volume = 0.5
    } catch (error) {
      reviewLogger.warn('Failed to preload notification sound', error)
    }
  }

  /**
   * Play notification sound
   */
  private playSound(): void {
    if (!this.notificationSound) return

    try {
      // Clone and play to allow multiple simultaneous sounds
      const sound = this.notificationSound.cloneNode() as HTMLAudioElement
      sound.volume = 0.5
      sound.play().catch(error => {
        reviewLogger.warn('Failed to play notification sound', error)
      })
    } catch (error) {
      reviewLogger.warn('Failed to play notification sound', error)
    }
  }

  /**
   * Set sound enabled state
   */
  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled
  }

  /**
   * Track analytics event
   */
  private trackEvent(eventName: string, data: any): void {
    // Track with gtag if available
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName, {
        event_category: 'Notifications',
        event_label: 'Browser',
        ...data
      })
    }
  }

  /**
   * Check if page is visible
   */
  isPageVisible(): boolean {
    return typeof document !== 'undefined' && !document.hidden
  }

  /**
   * Check if browser is in focus
   */
  isBrowserFocused(): boolean {
    return typeof document !== 'undefined' && document.hasFocus()
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.notificationSound = null
    this.userId = null
  }
}