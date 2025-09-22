import { FCMManager } from './FCMManager';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  timestamp?: number;
}

interface ScheduledPushNotification {
  id: string;
  userId: string;
  notification: PushNotificationOptions;
  scheduledFor: Date;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  attempts: number;
  createdAt: Date;
  sentAt?: Date;
  error?: string;
}

interface NotificationBatch {
  userId: string;
  notifications: PushNotificationOptions[];
  windowStart: Date;
  windowEnd: Date;
}

export class PushNotificationService {
  private static instance: PushNotificationService;
  private fcmManager: FCMManager;
  private batchQueue: Map<string, NotificationBatch> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.fcmManager = FCMManager.getInstance();
  }

  static getInstance(): PushNotificationService {
    if (!this.instance) {
      this.instance = new PushNotificationService();
    }
    return this.instance;
  }

  /**
   * Initialize the push notification service
   */
  async initialize(userId: string): Promise<boolean> {
    try {
      // Get VAPID key from environment
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

      if (!vapidKey) {
        console.error('[Push] VAPID key not configured');
        return false;
      }

      // Initialize FCM
      const initialized = await this.fcmManager.initialize({
        vapidKey,
        userId,
        onMessage: this.handleForegroundMessage.bind(this),
        onTokenRefresh: this.handleTokenRefresh.bind(this)
      });

      if (initialized) {
        // Start batch processing
        this.startBatchProcessing();

        // Process any pending scheduled notifications
        await this.processPendingNotifications(userId);

        console.log('[Push] Service initialized successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[Push] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Send a push notification immediately
   */
  async sendNotification(userId: string, notification: PushNotificationOptions): Promise<void> {
    try {
      // Check if user has push notifications enabled
      const preferences = await this.getUserPreferences(userId);
      if (!preferences?.channels?.push) {
        console.log('[Push] User has push notifications disabled');
        return;
      }

      // Check quiet hours
      if (await this.isInQuietHours(userId)) {
        // Queue for later
        await this.queueNotification(userId, notification);
        return;
      }

      // Get user's FCM token
      const token = await this.getUserToken(userId);
      if (!token) {
        console.warn('[Push] No FCM token for user:', userId);
        return;
      }

      // Send via FCM
      await this.fcmManager.sendToDevice({
        token,
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        badge: notification.badge,
        image: notification.image,
        data: {
          ...notification.data,
          tag: notification.tag,
          timestamp: notification.timestamp || Date.now()
        }
      });

      // Log the notification
      await this.logNotification(userId, notification, 'sent');

      console.log('[Push] Notification sent to user:', userId);
    } catch (error) {
      console.error('[Push] Failed to send notification:', error);
      await this.logNotification(userId, notification, 'failed', error as Error);
      throw error;
    }
  }

  /**
   * Schedule a push notification for later
   */
  async scheduleNotification(params: {
    userId: string;
    notification: PushNotificationOptions;
    scheduledFor: Date;
  }): Promise<string> {
    const { userId, notification, scheduledFor } = params;

    // Create scheduled notification document
    const scheduledRef = doc(collection(db, 'notifications_queue'));
    const scheduledNotification: ScheduledPushNotification = {
      id: scheduledRef.id,
      userId,
      notification,
      scheduledFor,
      status: 'pending',
      attempts: 0,
      createdAt: new Date()
    };

    await setDoc(scheduledRef, scheduledNotification);

    // If scheduled for less than 5 minutes, handle locally
    const delay = scheduledFor.getTime() - Date.now();
    if (delay > 0 && delay < 5 * 60 * 1000) {
      this.scheduleLocalNotification(scheduledRef.id, delay);
    }

    console.log(`[Push] Scheduled notification ${scheduledRef.id} for ${scheduledFor.toISOString()}`);
    return scheduledRef.id;
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelScheduledNotification(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(db, 'notifications_queue', notificationId);
      await updateDoc(notificationRef, {
        status: 'cancelled',
        updatedAt: new Date()
      });

      console.log(`[Push] Cancelled notification ${notificationId}`);
    } catch (error) {
      console.error('[Push] Failed to cancel notification:', error);
      throw error;
    }
  }

  /**
   * Batch notifications within a time window
   */
  async batchNotification(userId: string, notification: PushNotificationOptions): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    const batchWindow = preferences?.batching?.window_minutes || 5;

    // Get or create batch for user
    let batch = this.batchQueue.get(userId);

    if (!batch) {
      const now = new Date();
      batch = {
        userId,
        notifications: [],
        windowStart: now,
        windowEnd: new Date(now.getTime() + batchWindow * 60 * 1000)
      };
      this.batchQueue.set(userId, batch);
    }

    // Add notification to batch
    batch.notifications.push(notification);

    console.log(`[Push] Added notification to batch for user ${userId}, batch size: ${batch.notifications.length}`);
  }

  /**
   * Process notification batches
   */
  private startBatchProcessing(): void {
    // Process batches every minute
    this.batchTimer = setInterval(async () => {
      const now = new Date();

      for (const [userId, batch] of this.batchQueue.entries()) {
        if (batch.windowEnd <= now) {
          // Time to send this batch
          await this.sendBatchedNotifications(batch);
          this.batchQueue.delete(userId);
        }
      }
    }, 60 * 1000); // Every minute
  }

  /**
   * Send batched notifications
   */
  private async sendBatchedNotifications(batch: NotificationBatch): Promise<void> {
    if (batch.notifications.length === 0) return;

    const { userId, notifications } = batch;

    // Combine notifications into a single push
    const title = `${notifications.length} new notifications`;
    const body = this.summarizeNotifications(notifications);

    const batchedNotification: PushNotificationOptions = {
      title,
      body,
      tag: 'batched-notifications',
      data: {
        type: 'batch',
        count: notifications.length,
        notifications: notifications.map(n => ({
          title: n.title,
          body: n.body,
          data: n.data
        }))
      },
      requireInteraction: true
    };

    await this.sendNotification(userId, batchedNotification);
  }

  /**
   * Summarize multiple notifications
   */
  private summarizeNotifications(notifications: PushNotificationOptions[]): string {
    if (notifications.length === 1) {
      return notifications[0].body;
    }

    // Count by type
    const types = notifications.reduce((acc, n) => {
      const type = n.data?.type || 'other';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Build summary
    const parts = [];
    if (types.review_due) parts.push(`${types.review_due} reviews due`);
    if (types.achievement) parts.push(`${types.achievement} achievements`);
    if (types.streak_reminder) parts.push('Streak reminder');
    if (types.other) parts.push(`${types.other} other notifications`);

    return parts.join(', ');
  }

  /**
   * Handle foreground messages from FCM
   */
  private handleForegroundMessage(payload: any): void {
    console.log('[Push] Foreground message received:', payload);

    // Emit event for app handling
    const event = new CustomEvent('push:foreground', {
      detail: payload
    });
    window.dispatchEvent(event);
  }

  /**
   * Handle FCM token refresh
   */
  private async handleTokenRefresh(newToken: string): Promise<void> {
    console.log('[Push] FCM token refreshed');

    // Update token in backend if needed
    try {
      await fetch('/api/notifications/update-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: newToken })
      });
    } catch (error) {
      console.error('[Push] Failed to update token on server:', error);
    }
  }

  /**
   * Get user's FCM token
   */
  private async getUserToken(userId: string): Promise<string | null> {
    try {
      const tokenDoc = await getDoc(doc(db, 'notifications_tokens', userId));
      if (tokenDoc.exists()) {
        return tokenDoc.data().fcm_token || null;
      }
      return null;
    } catch (error) {
      console.error('[Push] Failed to get user token:', error);
      return null;
    }
  }

  /**
   * Get user notification preferences
   */
  private async getUserPreferences(userId: string): Promise<any> {
    try {
      const prefsDoc = await getDoc(doc(db, 'notifications_preferences', userId));
      if (prefsDoc.exists()) {
        return prefsDoc.data();
      }

      // Return default preferences
      return {
        channels: { push: true },
        timing: { immediate: true },
        quiet_hours: { enabled: false },
        batching: { enabled: false, window_minutes: 5 }
      };
    } catch (error) {
      console.error('[Push] Failed to get user preferences:', error);
      return null;
    }
  }

  /**
   * Check if user is in quiet hours
   */
  private async isInQuietHours(userId: string): Promise<boolean> {
    const preferences = await this.getUserPreferences(userId);

    if (!preferences?.quiet_hours?.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = preferences.quiet_hours.start.split(':').map(Number);
    const [endHour, endMin] = preferences.quiet_hours.end.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Handle overnight quiet hours
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime < endTime;
    } else {
      return currentTime >= startTime && currentTime < endTime;
    }
  }

  /**
   * Queue notification for later (after quiet hours)
   */
  private async queueNotification(userId: string, notification: PushNotificationOptions): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    const [endHour, endMin] = preferences.quiet_hours.end.split(':').map(Number);

    const scheduledFor = new Date();
    scheduledFor.setHours(endHour, endMin, 0, 0);

    // If end time is earlier today, schedule for tomorrow
    if (scheduledFor <= new Date()) {
      scheduledFor.setDate(scheduledFor.getDate() + 1);
    }

    await this.scheduleNotification({
      userId,
      notification,
      scheduledFor
    });
  }

  /**
   * Schedule a local notification (in-memory)
   */
  private scheduleLocalNotification(notificationId: string, delay: number): void {
    setTimeout(async () => {
      try {
        // Get notification from database
        const notificationDoc = await getDoc(doc(db, 'notifications_queue', notificationId));

        if (!notificationDoc.exists()) return;

        const data = notificationDoc.data() as ScheduledPushNotification;

        if (data.status === 'pending') {
          // Send the notification
          await this.sendNotification(data.userId, data.notification);

          // Update status
          await updateDoc(doc(db, 'notifications_queue', notificationId), {
            status: 'sent',
            sentAt: new Date()
          });
        }
      } catch (error) {
        console.error(`[Push] Failed to send scheduled notification ${notificationId}:`, error);
      }
    }, delay);
  }

  /**
   * Process pending scheduled notifications
   */
  private async processPendingNotifications(userId: string): Promise<void> {
    try {
      const q = query(
        collection(db, 'notifications_queue'),
        where('userId', '==', userId),
        where('status', '==', 'pending'),
        where('scheduledFor', '<=', new Date())
      );

      const snapshot = await getDocs(q);

      for (const doc of snapshot.docs) {
        const data = doc.data() as ScheduledPushNotification;

        // Send the overdue notification
        await this.sendNotification(data.userId, data.notification);

        // Update status
        await updateDoc(doc.ref, {
          status: 'sent',
          sentAt: new Date()
        });
      }

      console.log(`[Push] Processed ${snapshot.size} pending notifications for user ${userId}`);
    } catch (error) {
      console.error('[Push] Failed to process pending notifications:', error);
    }
  }

  /**
   * Log notification event
   */
  private async logNotification(
    userId: string,
    notification: PushNotificationOptions,
    status: 'sent' | 'failed',
    error?: Error
  ): Promise<void> {
    try {
      await setDoc(doc(collection(db, 'notifications_log')), {
        userId,
        type: 'push',
        channel: 'fcm',
        title: notification.title,
        body: notification.body,
        status,
        error: error?.message,
        timestamp: new Date(),
        metadata: {
          tag: notification.tag,
          data: notification.data
        }
      });
    } catch (logError) {
      console.error('[Push] Failed to log notification:', logError);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Stop batch processing
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    // Clear batch queue
    this.batchQueue.clear();

    // Clean up FCM
    await this.fcmManager.cleanup();

    console.log('[Push] Service cleaned up');
  }

  /**
   * Get notification statistics
   */
  async getStatistics(userId: string): Promise<any> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const q = query(
        collection(db, 'notifications_log'),
        where('userId', '==', userId),
        where('channel', '==', 'fcm'),
        where('timestamp', '>=', thirtyDaysAgo)
      );

      const snapshot = await getDocs(q);

      const stats = {
        total: snapshot.size,
        sent: 0,
        failed: 0,
        byType: {} as Record<string, number>
      };

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'sent') stats.sent++;
        if (data.status === 'failed') stats.failed++;

        const type = data.metadata?.data?.type || 'other';
        stats.byType[type] = (stats.byType[type] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('[Push] Failed to get statistics:', error);
      return null;
    }
  }
}