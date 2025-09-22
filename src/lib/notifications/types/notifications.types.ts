/**
 * Notification System Type Definitions
 * Core types for the multi-channel notification system
 */

import { Timestamp } from 'firebase/firestore'

/**
 * Notification channel types
 */
export type NotificationChannel = 'browser' | 'inApp' | 'push' | 'email'

/**
 * Notification types
 */
export type NotificationType =
  | 'review_due'
  | 'review_overdue'
  | 'streak_reminder'
  | 'achievement'
  | 'daily_summary'
  | 'weekly_progress'

/**
 * Notification priority levels
 */
export type NotificationPriority = 'high' | 'normal' | 'low'

/**
 * Notification status
 */
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled'

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  userId: string
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
    start: string         // "22:00" format
    end: string          // "08:00" format
    timezone: string     // IANA timezone
  }
  batching: {
    enabled: boolean
    window_minutes: number  // batch notifications within X minutes
  }
  updated_at: Timestamp | Date
}

/**
 * Default notification preferences
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreferences, 'userId' | 'updated_at'> = {
  channels: {
    browser: false,
    inApp: true,
    push: false,
    email: false
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
  },
  batching: {
    enabled: true,
    window_minutes: 5
  }
}

/**
 * Queued notification
 */
export interface NotificationQueueItem {
  id: string
  userId: string
  type: NotificationType
  channel: NotificationChannel
  scheduled_for: Timestamp | Date
  data: {
    item_ids?: string[]
    review_count?: number
    message: string
    title?: string
    action_url: string
    priority: NotificationPriority
    metadata?: Record<string, any>
  }
  status: NotificationStatus
  attempts: number
  created_at: Timestamp | Date
  sent_at?: Timestamp | Date
  error?: string
}

/**
 * User notification tokens and permissions
 */
export interface NotificationTokens {
  userId: string
  fcm_token?: string
  fcm_token_updated?: Timestamp | Date
  browser_permission: NotificationPermission
  browser_permission_updated?: Timestamp | Date
  device_info?: {
    platform: string
    browser: string
    version: string
  }
}

/**
 * Scheduled notification for in-memory tracking
 */
export interface ScheduledNotification {
  id: string
  userId: string
  itemId?: string
  itemIds?: string[]
  type: NotificationType
  scheduledFor: Date
  priority: NotificationPriority
  channels?: NotificationChannel[]
  timerId?: NodeJS.Timeout
  metadata?: Record<string, any>
}

/**
 * Notification content data
 */
export interface NotificationContent {
  title: string
  body: string
  icon?: string
  badge?: string
  image?: string
  data?: Record<string, any>
  actions?: NotificationAction[]
  requireInteraction?: boolean
  silent?: boolean
  tag?: string
  renotify?: boolean
  vibrate?: number[]
}

/**
 * Notification action
 */
export interface NotificationAction {
  action: string
  title: string
  icon?: string
}

/**
 * Review notification data
 */
export interface ReviewNotificationData {
  itemId: string
  itemType: string
  userId: string
  reviewAt: Date
  interval: number  // in days
  repetitions: number
  difficulty?: number
  primaryDisplay?: string
  meaning?: string
}

/**
 * Notification event payload
 */
export interface NotificationEventPayload {
  type: 'scheduled' | 'sent' | 'clicked' | 'dismissed' | 'failed'
  notification: ScheduledNotification | NotificationQueueItem
  timestamp: Date
  error?: string
}

/**
 * Notification service configuration
 */
export interface NotificationConfig {
  maxRetries: number
  retryDelay: number  // milliseconds
  batchSize: number
  maxScheduleAhead: number  // days
  defaultPriority: NotificationPriority
  soundEnabled: boolean
  vibrationPattern: number[]
}

/**
 * Default notification configuration
 */
export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  maxRetries: 3,
  retryDelay: 5000,
  batchSize: 10,
  maxScheduleAhead: 30,
  defaultPriority: 'normal',
  soundEnabled: true,
  vibrationPattern: [200, 100, 200]
}

/**
 * Notification statistics
 */
export interface NotificationStats {
  userId: string
  sent: number
  clicked: number
  dismissed: number
  failed: number
  clickThroughRate: number
  lastSent?: Date
  lastClicked?: Date
}

/**
 * Batch notification data
 */
export interface BatchNotification {
  userId: string
  items: ReviewNotificationData[]
  scheduledFor: Date
  type: 'daily' | 'overdue'
  totalCount: number
}

/**
 * IndexedDB schema for offline storage
 */
export interface IndexedDBNotification {
  id: string
  userId: string
  scheduledFor: number  // timestamp
  notification: NotificationContent
  metadata?: Record<string, any>
}