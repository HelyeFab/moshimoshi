/**
 * Gamification Telemetry & Metrics
 *
 * Centralized metrics tracking for gamification system monitoring.
 * Provides structured logging and performance metrics for observability.
 *
 * @module gamificationMetrics
 */

import logger from '@/lib/logger'

/**
 * Metric types for gamification events
 */
export type GamificationMetricType =
  | 'xp_awarded'
  | 'streak_increment'
  | 'streak_break'
  | 'achievement_unlock'
  | 'session_recorded'
  | 'api_latency'
  | 'api_error'
  | 'sync_completed'
  | 'sync_failed'
  | 'leaderboard_update'

/**
 * Structured metric data
 */
export interface MetricData {
  userId?: string
  amount?: number
  source?: string
  duration?: number
  endpoint?: string
  errorType?: string
  achievementId?: string
  streakValue?: number
  sessionType?: string
  [key: string]: any
}

/**
 * Gamification Metrics Service
 *
 * Provides structured logging and metrics tracking for the gamification system.
 * All metrics are logged with consistent format for easy aggregation and alerting.
 */
export class GamificationMetrics {
  private serviceName = 'gamification'

  /**
   * Track XP awarded to a user
   *
   * @param userId - User ID receiving XP
   * @param amount - Amount of XP awarded
   * @param source - Source of XP (e.g., 'drill_completed', 'review_session')
   * @param metadata - Additional context
   */
  trackXPAwarded(userId: string, amount: number, source: string, metadata?: Record<string, any>): void {
    this.logMetric('xp_awarded', {
      userId,
      amount,
      source,
      ...metadata
    })
  }

  /**
   * Track streak increment event
   *
   * @param userId - User ID
   * @param newStreak - New streak value
   * @param previousStreak - Previous streak value
   */
  trackStreakIncrement(userId: string, newStreak: number, previousStreak?: number): void {
    this.logMetric('streak_increment', {
      userId,
      streakValue: newStreak,
      previousValue: previousStreak,
      increment: previousStreak ? newStreak - previousStreak : 1
    })
  }

  /**
   * Track streak break event
   *
   * @param userId - User ID
   * @param previousStreak - Streak value that was lost
   */
  trackStreakBreak(userId: string, previousStreak: number): void {
    this.logMetric('streak_break', {
      userId,
      previousStreak,
      severity: previousStreak >= 30 ? 'high' : previousStreak >= 7 ? 'medium' : 'low'
    })
  }

  /**
   * Track achievement unlock event
   *
   * @param userId - User ID
   * @param achievementId - Achievement identifier
   * @param points - Points awarded
   * @param rarity - Achievement rarity (optional)
   */
  trackAchievementUnlock(userId: string, achievementId: string, points: number, rarity?: string): void {
    this.logMetric('achievement_unlock', {
      userId,
      achievementId,
      points,
      rarity
    })
  }

  /**
   * Track session recording event
   *
   * @param userId - User ID
   * @param sessionType - Type of session (e.g., 'drill', 'flashcard', 'kanji')
   * @param metadata - Session details
   */
  trackSessionRecorded(userId: string, sessionType: string, metadata: {
    itemsReviewed: number
    accuracy: number
    duration: number
    xpEarned: number
  }): void {
    this.logMetric('session_recorded', {
      userId,
      sessionType,
      ...metadata
    })
  }

  /**
   * Track API endpoint latency
   *
   * @param endpoint - API endpoint path
   * @param durationMs - Duration in milliseconds
   * @param statusCode - HTTP status code
   */
  trackAPILatency(endpoint: string, durationMs: number, statusCode: number): void {
    this.logMetric('api_latency', {
      endpoint,
      duration: durationMs,
      statusCode,
      // Flag slow requests
      slow: durationMs > 200,
      critical: durationMs > 500
    })

    // Log warning for slow requests
    if (durationMs > 500) {
      logger.warn(`[Metrics] Slow API request detected: ${endpoint} took ${durationMs}ms`)
    }
  }

  /**
   * Track API error
   *
   * @param endpoint - API endpoint path
   * @param errorType - Error type/category
   * @param statusCode - HTTP status code
   * @param metadata - Additional error context
   */
  trackAPIError(endpoint: string, errorType: string, statusCode: number, metadata?: Record<string, any>): void {
    this.logMetric('api_error', {
      endpoint,
      errorType,
      statusCode,
      ...metadata
    })
  }

  /**
   * Track sync completion event
   *
   * @param userId - User ID
   * @param itemsSynced - Number of items synced
   * @param durationMs - Sync duration in milliseconds
   */
  trackSyncCompleted(userId: string, itemsSynced: number, durationMs: number): void {
    this.logMetric('sync_completed', {
      userId,
      itemsSynced,
      duration: durationMs
    })
  }

  /**
   * Track sync failure event
   *
   * @param userId - User ID
   * @param reason - Failure reason
   * @param attemptCount - Number of attempts made
   */
  trackSyncFailed(userId: string, reason: string, attemptCount: number): void {
    this.logMetric('sync_failed', {
      userId,
      reason,
      attemptCount,
      severity: attemptCount >= 3 ? 'high' : 'medium'
    })
  }

  /**
   * Track leaderboard update event
   *
   * @param type - Update type ('full' or 'delta')
   * @param usersAffected - Number of users affected
   * @param durationMs - Update duration in milliseconds
   */
  trackLeaderboardUpdate(type: 'full' | 'delta', usersAffected: number, durationMs: number): void {
    this.logMetric('leaderboard_update', {
      type,
      usersAffected,
      duration: durationMs,
      // Flag expensive updates
      expensive: type === 'full' && durationMs > 1000
    })
  }

  /**
   * Internal: Log structured metric
   */
  private logMetric(type: GamificationMetricType, data: MetricData): void {
    const metric = {
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      metricType: type,
      ...data
    }

    // Log to structured logger
    logger.info(`[Metrics] ${type}`, metric)

    // In production, this would also send to:
    // - DataDog / Grafana / Prometheus
    // - Cloud Monitoring (GCP/AWS)
    // - Custom analytics pipeline
  }
}

/**
 * Singleton instance for application-wide use
 */
export const gamificationMetrics = new GamificationMetrics()

/**
 * Performance timer utility for tracking operation duration
 *
 * @example
 * ```typescript
 * const timer = new PerformanceTimer()
 * await someOperation()
 * gamificationMetrics.trackAPILatency('/api/stats/unified', timer.elapsed(), 200)
 * ```
 */
export class PerformanceTimer {
  private startTime: number

  constructor() {
    this.startTime = performance.now()
  }

  /**
   * Get elapsed time in milliseconds
   */
  elapsed(): number {
    return Math.round(performance.now() - this.startTime)
  }

  /**
   * Reset timer to current time
   */
  reset(): void {
    this.startTime = performance.now()
  }
}

/**
 * Correlation ID generator for request tracing
 *
 * Generates unique IDs for tracing requests through the system.
 * Format: timestamp_random (e.g., "1696234567890_abc123")
 */
export function generateCorrelationId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Metric aggregation helper (for future dashboard use)
 *
 * Note: Currently logs individual events. Future enhancement:
 * - Aggregate metrics in-memory
 * - Flush to external service periodically
 * - Calculate rates, percentiles, etc.
 */
export interface MetricAggregate {
  count: number
  sum: number
  min: number
  max: number
  avg: number
  p50: number
  p95: number
  p99: number
}

/**
 * Alert thresholds for monitoring
 *
 * Used to trigger alerts when metrics exceed acceptable ranges.
 */
export const ALERT_THRESHOLDS = {
  // API performance
  API_LATENCY_P95_MS: 200,
  API_LATENCY_P99_MS: 500,
  API_ERROR_RATE_PERCENT: 1,

  // Sync performance
  SYNC_QUEUE_SIZE: 100,
  SYNC_FAILURE_RATE_PERCENT: 5,

  // Streak integrity
  STREAK_BREAK_SPIKE_PERCENT: 50, // % increase above baseline

  // XP system
  XP_PER_MINUTE_MIN: 10, // Below this indicates system issues
  XP_PER_MINUTE_MAX: 10000, // Above this indicates abuse/bot activity
} as const

/**
 * Check if a metric value exceeds alert threshold
 *
 * @param metricName - Name of the metric
 * @param value - Current value
 * @returns True if threshold exceeded
 */
export function isAlertThresholdExceeded(
  metricName: keyof typeof ALERT_THRESHOLDS,
  value: number
): boolean {
  const threshold = ALERT_THRESHOLDS[metricName]
  return value > threshold
}

// Export singleton
export default gamificationMetrics
