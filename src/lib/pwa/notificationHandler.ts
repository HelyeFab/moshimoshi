/**
 * Main Thread Notification Handler
 * Handles all notification logic outside of the service worker
 * Keeps the SW minimal and focused only on showing notifications
 */

import { idbClient } from '@/lib/idb/client';
import { canCurrentUser } from './entitlements';

export interface NotificationSchedule {
  id: string;
  title: string;
  body: string;
  scheduledFor: Date;
  data?: any;
  recurring?: boolean;
}

export class NotificationHandler {
  private static instance: NotificationHandler;
  private schedules: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.initialize();
  }

  static getInstance(): NotificationHandler {
    if (!NotificationHandler.instance) {
      NotificationHandler.instance = new NotificationHandler();
    }
    return NotificationHandler.instance;
  }

  private async initialize() {
    // Listen for sync trigger from service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_TRIGGER') {
          this.processPendingSync();
        }
      });
    }

    // Restore scheduled notifications on app start
    this.restoreScheduledNotifications();
  }

  /**
   * Check if notifications are supported and permitted
   */
  async checkPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }

    if (!canCurrentUser('push')) {
      return 'denied';
    }

    return Notification.permission;
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return 'denied';
    }

    if (!canCurrentUser('push')) {
      console.warn('User tier does not allow notifications');
      return 'denied';
    }

    const permission = await Notification.requestPermission();

    // Store permission grant time
    if (permission === 'granted') {
      localStorage.setItem('notification_permission_granted', new Date().toISOString());
    }

    return permission;
  }

  /**
   * Send a test notification
   */
  async sendTestNotification(): Promise<boolean> {
    const permission = await this.checkPermission();

    if (permission !== 'granted') {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('Test Notification', {
        body: 'Notifications are working correctly!',
        icon: '/favicon-192x192.png',
        badge: '/favicon-72x72.png',
        tag: 'test-notification',
        requireInteraction: false,
      });
      return true;
    } catch (error) {
      console.error('Failed to show test notification:', error);
      return false;
    }
  }

  /**
   * Schedule a notification for later
   */
  async scheduleNotification(
    title: string,
    body: string,
    delayMs: number,
    data?: any
  ): Promise<string> {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // For short delays, use setTimeout
    if (delayMs < 5 * 60 * 1000) {
      const timeout = setTimeout(async () => {
        await this.showNotification(title, { body, data });
        this.schedules.delete(id);
      }, delayMs);

      this.schedules.set(id, timeout);
    } else {
      // For longer delays, store in IDB
      await this.storeScheduledNotification({
        id,
        title,
        body,
        scheduledFor: new Date(Date.now() + delayMs),
        data
      });
    }

    return id;
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelScheduledNotification(id: string): Promise<void> {
    // Clear timeout if exists
    const timeout = this.schedules.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.schedules.delete(id);
    }

    // Remove from storage
    await this.removeScheduledNotification(id);
  }

  /**
   * Show a notification immediately
   */
  private async showNotification(
    title: string,
    options: NotificationOptions
  ): Promise<void> {
    const permission = await this.checkPermission();

    if (permission !== 'granted') {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      // Check quiet hours
      if (this.isQuietHours()) {
        console.log('Notification suppressed due to quiet hours');
        return;
      }

      await registration.showNotification(title, {
        ...options,
        icon: options.icon || '/favicon-192x192.png',
        badge: options.badge || '/favicon-72x72.png',
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  /**
   * Check if current time is within quiet hours
   */
  private isQuietHours(): boolean {
    const settings = this.getQuietHoursSettings();

    if (!settings?.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = settings.startTime.split(':').map(Number);
    const [endHour, endMin] = settings.endTime.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime < endTime;
    } else {
      // Handles overnight quiet hours (e.g., 22:00 to 08:00)
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  /**
   * Get quiet hours settings from localStorage
   */
  private getQuietHoursSettings(): {
    enabled: boolean;
    startTime: string;
    endTime: string;
  } | null {
    const stored = localStorage.getItem('notification_quiet_hours');
    return stored ? JSON.parse(stored) : null;
  }

  /**
   * Store scheduled notification in IndexedDB
   */
  private async storeScheduledNotification(schedule: NotificationSchedule): Promise<void> {
    // This would integrate with the IDB client
    // For now, storing in localStorage as a fallback
    const schedules = this.getStoredSchedules();
    schedules.push(schedule);
    localStorage.setItem('scheduled_notifications', JSON.stringify(schedules));
  }

  /**
   * Remove scheduled notification from storage
   */
  private async removeScheduledNotification(id: string): Promise<void> {
    const schedules = this.getStoredSchedules();
    const filtered = schedules.filter(s => s.id !== id);
    localStorage.setItem('scheduled_notifications', JSON.stringify(filtered));
  }

  /**
   * Get stored schedules from localStorage
   */
  private getStoredSchedules(): NotificationSchedule[] {
    const stored = localStorage.getItem('scheduled_notifications');
    return stored ? JSON.parse(stored) : [];
  }

  /**
   * Restore scheduled notifications on app start
   */
  private async restoreScheduledNotifications(): Promise<void> {
    const schedules = this.getStoredSchedules();
    const now = Date.now();

    for (const schedule of schedules) {
      const scheduledTime = new Date(schedule.scheduledFor).getTime();

      if (scheduledTime <= now) {
        // Show immediately if overdue
        await this.showNotification(schedule.title, {
          body: schedule.body,
          data: schedule.data
        });
        await this.removeScheduledNotification(schedule.id);
      } else if (scheduledTime - now < 5 * 60 * 1000) {
        // Reschedule if within 5 minutes
        const delay = scheduledTime - now;
        this.scheduleNotification(
          schedule.title,
          schedule.body,
          delay,
          schedule.data
        );
      }
    }
  }

  /**
   * Process pending sync operations
   */
  private async processPendingSync(): Promise<void> {
    try {
      // Get pending items from outbox
      const pendingItems = await idbClient.getPendingSyncItems();

      // Process each item
      for (const item of pendingItems) {
        try {
          // Attempt to sync with server
          const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
          });

          if (response.ok) {
            // Remove from outbox on success
            await idbClient.removeSyncItem(item.id);
          } else if (response.status >= 400 && response.status < 500) {
            // Client error - remove from outbox (won't retry)
            await idbClient.removeSyncItem(item.id);
          }
        } catch (error) {
          // Network error - will retry later
          console.error('Sync failed for item:', item.id, error);
        }
      }
    } catch (error) {
      console.error('Failed to process sync:', error);
    }
  }

  /**
   * Check for due reviews and notify
   */
  async checkDueReviews(): Promise<void> {
    if (!canCurrentUser('push')) {
      return;
    }

    try {
      const dueCount = await idbClient.getDueCount();

      if (dueCount > 0) {
        await this.showNotification('Reviews Due!', {
          body: `You have ${dueCount} reviews waiting`,
          data: {
            actionUrl: '/review',
            count: dueCount
          },
          tag: 'due-reviews',
          requireInteraction: true
        });
      }
    } catch (error) {
      console.error('Failed to check due reviews:', error);
    }
  }
}

// Export singleton instance
export const notificationHandler = NotificationHandler.getInstance();