// Notification Management System
// Handles permission requests, quiet hours, and notification display

interface QuietHours {
  enabled: boolean
  startTime: string // HH:MM format
  endTime: string   // HH:MM format
}

interface NotificationOptions {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: any
  requireInteraction?: boolean
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
}

class NotificationManager {
  private permission: NotificationPermission = 'default'
  private quietHours: QuietHours | null = null
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null

  constructor() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.permission = Notification.permission
      this.loadQuietHours()
      this.initServiceWorker()
    }
  }

  private async initServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready
        this.serviceWorkerRegistration = registration
      } catch (error) {
        console.error('Service worker not available:', error)
      }
    }
  }

  private loadQuietHours() {
    const stored = localStorage.getItem('notification_quiet_hours')
    if (stored) {
      try {
        this.quietHours = JSON.parse(stored)
      } catch (error) {
        console.error('Failed to load quiet hours:', error)
      }
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' &&
           'Notification' in window &&
           'serviceWorker' in navigator
  }

  public getPermission(): NotificationPermission {
    if (this.isSupported()) {
      this.permission = Notification.permission
      return this.permission
    }
    return 'default'
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      console.warn('Notifications not supported')
      return 'denied'
    }

    try {
      this.permission = await Notification.requestPermission()

      // Track permission grant/denial
      this.trackPermissionChange(this.permission)

      return this.permission
    } catch (error) {
      console.error('Failed to request notification permission:', error)
      return 'denied'
    }
  }

  private trackPermissionChange(permission: NotificationPermission) {
    // Track analytics event
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'notification_permission', {
        permission_status: permission
      })
    }

    // Store permission request timestamp
    localStorage.setItem('notification_permission_requested', new Date().toISOString())
  }

  public setQuietHours(quietHours: QuietHours | null) {
    this.quietHours = quietHours
    if (quietHours) {
      localStorage.setItem('notification_quiet_hours', JSON.stringify(quietHours))
    } else {
      localStorage.removeItem('notification_quiet_hours')
    }
  }

  public getQuietHours(): QuietHours | null {
    return this.quietHours
  }

  private isInQuietHours(): boolean {
    if (!this.quietHours?.enabled) {
      return false
    }

    const now = new Date()
    const currentTime = now.getHours() * 60 + now.getMinutes()

    const [startHour, startMin] = this.quietHours.startTime.split(':').map(Number)
    const [endHour, endMin] = this.quietHours.endTime.split(':').map(Number)

    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin

    // Handle cases where quiet hours span midnight
    if (startMinutes <= endMinutes) {
      return currentTime >= startMinutes && currentTime <= endMinutes
    } else {
      return currentTime >= startMinutes || currentTime <= endMinutes
    }
  }

  public async showNotification(options: NotificationOptions): Promise<void> {
    // Check if notifications are supported and permitted
    if (!this.isSupported() || this.permission !== 'granted') {
      console.warn('Cannot show notification: not supported or not permitted')
      return
    }

    // Check quiet hours
    if (this.isInQuietHours()) {
      console.log('Notification suppressed due to quiet hours')
      return
    }

    try {
      // Use service worker to show notification if available
      if (this.serviceWorkerRegistration) {
        await this.serviceWorkerRegistration.showNotification(options.title, {
          body: options.body,
          icon: options.icon || '/favicon-192x192.png',
          badge: options.badge || '/favicon-96x96.png',
          tag: options.tag,
          data: options.data,
          requireInteraction: options.requireInteraction,
          actions: options.actions
        })
      } else {
        // Fallback to basic notification API
        new Notification(options.title, {
          body: options.body,
          icon: options.icon || '/favicon-192x192.png',
          badge: options.badge || '/favicon-96x96.png',
          tag: options.tag,
          data: options.data
        })
      }

      // Track notification shown
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'notification_shown', {
          notification_type: options.tag || 'general'
        })
      }
    } catch (error) {
      console.error('Failed to show notification:', error)
    }
  }

  public async sendTestNotification(): Promise<boolean> {
    if (this.permission !== 'granted') {
      const result = await this.requestPermission()
      if (result !== 'granted') {
        return false
      }
    }

    await this.showNotification({
      title: 'Test Notification',
      body: 'This is a test of your notification settings',
      tag: 'test-notification'
    })

    return true
  }

  public async scheduleNotification(
    options: NotificationOptions,
    delayMs: number
  ): Promise<NodeJS.Timeout | null> {
    if (!this.isSupported() || this.permission !== 'granted') {
      return null
    }

    const timeoutId = setTimeout(() => {
      this.showNotification(options)
    }, delayMs)

    return timeoutId
  }

  public clearScheduledNotification(timeoutId: NodeJS.Timeout) {
    clearTimeout(timeoutId)
  }

  public async getNotifications(tag?: string): Promise<Notification[]> {
    if (!this.serviceWorkerRegistration) {
      return []
    }

    try {
      const notifications = await this.serviceWorkerRegistration.getNotifications({
        tag
      })
      return notifications
    } catch (error) {
      console.error('Failed to get notifications:', error)
      return []
    }
  }

  public async clearNotification(tag: string): Promise<void> {
    const notifications = await this.getNotifications(tag)
    notifications.forEach(notification => notification.close())
  }

  public async clearAllNotifications(): Promise<void> {
    const notifications = await this.getNotifications()
    notifications.forEach(notification => notification.close())
  }

  // Check if we should prompt for permission
  public shouldPromptForPermission(): boolean {
    if (!this.isSupported() || this.permission !== 'default') {
      return false
    }

    // Check if we've recently requested permission
    const lastRequested = localStorage.getItem('notification_permission_requested')
    if (lastRequested) {
      const daysSinceRequest = (Date.now() - new Date(lastRequested).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceRequest < 7) { // Don't prompt again for a week
        return false
      }
    }

    // Check if user has been active enough
    const visitCount = parseInt(localStorage.getItem('visit_count') || '0', 10)
    return visitCount >= 5
  }
}

// Export singleton instance
export const notificationManager = new NotificationManager()

// Export types
export type { NotificationOptions, QuietHours }