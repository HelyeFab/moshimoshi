/**
 * Event definitions for the Universal Review Engine
 * Defines all events emitted during review sessions
 */

import { ReviewMode, SessionSource } from './types'
import { SessionStatistics } from './session.types'

/**
 * All possible review event types
 */
export enum ReviewEventType {
  // Session events
  SESSION_STARTED = 'session.started',
  SESSION_PAUSED = 'session.paused',
  SESSION_RESUMED = 'session.resumed',
  SESSION_COMPLETED = 'session.completed',
  SESSION_ABANDONED = 'session.abandoned',
  
  // Item events
  ITEM_PRESENTED = 'item.presented',
  ITEM_ANSWERED = 'item.answered',
  ITEM_SKIPPED = 'item.skipped',
  ITEM_HINT_USED = 'item.hint_used',
  ITEM_RETRY = 'item.retry',
  
  // Progress events
  PROGRESS_UPDATED = 'progress.updated',
  STREAK_UPDATED = 'streak.updated',
  ACHIEVEMENT_UNLOCKED = 'achievement.unlocked',
  MILESTONE_REACHED = 'milestone.reached',
  
  // Sync events
  SYNC_STARTED = 'sync.started',
  SYNC_COMPLETED = 'sync.completed',
  SYNC_FAILED = 'sync.failed',
  SYNC_CONFLICT = 'sync.conflict',
  
  // Error events
  ERROR_OCCURRED = 'error.occurred',
  VALIDATION_FAILED = 'validation.failed',
  TIMEOUT_WARNING = 'timeout.warning',
  
  // Analytics events
  ANALYTICS_TRACKED = 'analytics.tracked',
  PERFORMANCE_METRIC = 'performance.metric',
}

/**
 * Base review event interface
 */
export interface ReviewEvent<T = any> {
  /**
   * Event type
   */
  type: ReviewEventType
  
  /**
   * When the event occurred
   */
  timestamp: Date
  
  /**
   * Associated session ID
   */
  sessionId?: string
  
  /**
   * User who triggered the event
   */
  userId?: string
  
  /**
   * Event-specific data payload
   */
  data: T
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, any>
}

// Session Event Payloads

/**
 * Event payload for session started
 */
export interface SessionStartedPayload {
  sessionId: string
  itemCount: number
  mode: ReviewMode
  source: SessionSource
  contentTypes: string[]
}

/**
 * Event payload for session pause
 */
export interface SessionPausedPayload {
  sessionId: string
  currentIndex: number
  timeElapsed: number
}

/**
 * Event payload for session resume
 */
export interface SessionResumedPayload {
  sessionId: string
  pauseDuration: number
}

/**
 * Event payload for session completion
 */
export interface SessionCompletedPayload {
  sessionId: string
  statistics: SessionStatistics
  duration: number
}

/**
 * Event payload for session abandonment
 */
export interface SessionAbandonedPayload {
  sessionId: string
  reason?: 'timeout' | 'user_action' | 'error'
  currentIndex: number
  completionPercentage: number
}

// Item Event Payloads

/**
 * Event payload for item presentation
 */
export interface ItemPresentedPayload {
  itemId: string
  contentType: string
  index: number
  total: number
  difficulty: number
}

/**
 * Event payload for item answered
 */
export interface ItemAnsweredPayload {
  itemId: string
  correct: boolean
  responseTime: number
  userAnswer: string
  expectedAnswer: string
  confidence?: 1 | 2 | 3 | 4 | 5
  score: number
  attempts: number
  nextReviewAt?: Date | string  // Next scheduled review time
  contentType?: string          // Type of content (hiragana, kanji, vocabulary, etc.)
  srsData?: {                    // SRS algorithm data
    interval: number
    repetitions: number
    easeFactor: number
    status: string
  }
}

/**
 * Event payload for item skip
 */
export interface ItemSkippedPayload {
  itemId: string
  index: number
  reason?: string
}

/**
 * Event payload for hint usage
 */
export interface ItemHintUsedPayload {
  itemId: string
  hintLevel: 1 | 2 | 3
  hintContent: string
  penaltyApplied: number
}

/**
 * Event payload for item retry
 */
export interface ItemRetryPayload {
  itemId: string
  attemptNumber: number
  previousAnswer: string
}

// Progress Event Payloads

/**
 * Event payload for progress updates
 */
export interface ProgressUpdatedPayload {
  sessionId: string
  current: number
  total: number
  correct: number
  incorrect: number
  skipped: number
  accuracy: number
  streak: number
  score: number
}

/**
 * Event payload for streak updates
 */
export interface StreakUpdatedPayload {
  current: number
  best: number
  type: 'session' | 'daily' | 'all-time'
}

/**
 * Event payload for achievement unlock
 */
export interface AchievementUnlockedPayload {
  achievementId: string
  achievementName: string
  description: string
  category: string
  points: number
}

/**
 * Event payload for milestone reached
 */
export interface MilestoneReachedPayload {
  milestoneType: 'items_reviewed' | 'accuracy' | 'streak' | 'time_spent'
  value: number
  threshold: number
  reward?: any
}

// Sync Event Payloads

/**
 * Event payload for sync start
 */
export interface SyncStartedPayload {
  sessionId: string
  itemsToSync: number
  syncType: 'manual' | 'auto'
}

/**
 * Event payload for sync completion
 */
export interface SyncCompletedPayload {
  sessionId: string
  itemsSynced: number
  duration: number
}

/**
 * Event payload for sync failure
 */
export interface SyncFailedPayload {
  sessionId: string
  error: string
  retryable: boolean
  itemsFailed: number
}

/**
 * Event payload for sync conflict
 */
export interface SyncConflictPayload {
  sessionId: string
  conflictType: 'version' | 'data'
  resolution: 'local' | 'remote' | 'merge'
}

// Error Event Payloads

/**
 * Event payload for errors
 */
export interface ErrorOccurredPayload {
  error: Error | string
  context: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  recoverable: boolean
}

/**
 * Event payload for validation failures
 */
export interface ValidationFailedPayload {
  itemId: string
  userAnswer: string
  validationType: string
  reason: string
}

/**
 * Event payload for timeout warnings
 */
export interface TimeoutWarningPayload {
  sessionId: string
  timeRemaining: number
  action: 'warning' | 'final'
}

// Analytics Event Payloads

/**
 * Event payload for analytics tracking
 */
export interface AnalyticsTrackedPayload {
  eventName: string
  category: string
  properties: Record<string, any>
}

/**
 * Event payload for performance metrics
 */
export interface PerformanceMetricPayload {
  metric: string
  value: number
  unit: string
  context?: Record<string, any>
}

/**
 * Event listener function type
 */
export type EventListener<T = any> = (event: ReviewEvent<T>) => void | Promise<void>

/**
 * Event emitter interface
 */
export interface IEventEmitter {
  on<T = any>(event: ReviewEventType, listener: EventListener<T>): void
  off<T = any>(event: ReviewEventType, listener: EventListener<T>): void
  emit<T = any>(event: ReviewEventType, data: T): void
  once<T = any>(event: ReviewEventType, listener: EventListener<T>): void
  removeAllListeners(event?: ReviewEventType): void
}