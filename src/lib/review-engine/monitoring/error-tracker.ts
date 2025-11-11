/**
 * Centralized Error Tracking for Review Engine
 * Aggregates errors, tracks patterns, and triggers alerts
 *
 * Features:
 * - Error aggregation by type and severity
 * - Error rate monitoring
 * - Alert triggers for > 1% error rate
 * - Detailed error context capture
 */

import { reviewLogger } from '@/lib/monitoring/logger'

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  SRS_CALCULATION = 'srs_calculation',
  VALIDATION = 'validation',
  PERSISTENCE = 'persistence',
  SYNC = 'sync',
  NETWORK = 'network',
  CIRCUIT_BREAKER = 'circuit_breaker',
  RATE_LIMIT = 'rate_limit',
  ENTITLEMENT = 'entitlement',
  SESSION_MANAGEMENT = 'session_management',
  UNKNOWN = 'unknown'
}

export interface ErrorContext {
  userId?: string
  sessionId?: string
  itemId?: string
  operation?: string
  metadata?: Record<string, any>
}

export interface TrackedError {
  id: string
  timestamp: number
  category: ErrorCategory
  severity: ErrorSeverity
  message: string
  stack?: string
  context: ErrorContext
  count: number
}

export interface ErrorMetrics {
  totalErrors: number
  errorsByCategory: Record<ErrorCategory, number>
  errorsBySeverity: Record<ErrorSeverity, number>
  errorRate: number // errors per 100 operations
  lastError?: TrackedError
  criticalErrors: TrackedError[]
}

class ErrorTracker {
  private errors: Map<string, TrackedError> = new Map()
  private readonly MAX_ERROR_HISTORY = 1000
  private readonly CRITICAL_THRESHOLD = 100 // errors per 100 operations = 1%
  private totalOperations = 0

  /**
   * Track an error
   */
  trackError(
    category: ErrorCategory,
    severity: ErrorSeverity,
    message: string,
    error: Error | unknown,
    context: ErrorContext = {}
  ): void {
    const errorKey = `${category}:${message}`

    // Get or create error record
    let tracked = this.errors.get(errorKey)

    if (tracked) {
      // Increment count for duplicate error
      tracked.count++
      tracked.timestamp = Date.now()
    } else {
      // Create new error record
      tracked = {
        id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        category,
        severity,
        message,
        stack: error instanceof Error ? error.stack : undefined,
        context,
        count: 1
      }

      this.errors.set(errorKey, tracked)
    }

    // Log error
    const logMessage = `[ErrorTracker] ${category} (${severity}): ${message}`
    if (severity === ErrorSeverity.CRITICAL) {
      reviewLogger.error(logMessage, { error, context, count: tracked.count })
      this.checkCriticalThreshold()
    } else if (severity === ErrorSeverity.HIGH) {
      reviewLogger.error(logMessage, { error, context })
    } else {
      reviewLogger.warn(logMessage, { error, context })
    }

    // Cleanup old errors if needed
    this.cleanupOldErrors()
  }

  /**
   * Record successful operation (for error rate calculation)
   */
  recordSuccess(): void {
    this.totalOperations++
  }

  /**
   * Get error metrics
   */
  getMetrics(): ErrorMetrics {
    const errors = Array.from(this.errors.values())

    const errorsByCategory = errors.reduce((acc, err) => {
      acc[err.category] = (acc[err.category] || 0) + err.count
      return acc
    }, {} as Record<ErrorCategory, number>)

    const errorsBySeverity = errors.reduce((acc, err) => {
      acc[err.severity] = (acc[err.severity] || 0) + err.count
      return acc
    }, {} as Record<ErrorSeverity, number>)

    const totalErrors = errors.reduce((sum, err) => sum + err.count, 0)
    const errorRate = this.totalOperations > 0
      ? (totalErrors / this.totalOperations) * 100
      : 0

    const criticalErrors = errors
      .filter(err => err.severity === ErrorSeverity.CRITICAL)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)

    const lastError = errors
      .sort((a, b) => b.timestamp - a.timestamp)[0]

    return {
      totalErrors,
      errorsByCategory,
      errorsBySeverity,
      errorRate,
      lastError,
      criticalErrors
    }
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: ErrorCategory): TrackedError[] {
    return Array.from(this.errors.values())
      .filter(err => err.category === category)
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity): TrackedError[] {
    return Array.from(this.errors.values())
      .filter(err => err.severity === severity)
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Clear all errors (admin function)
   */
  clearErrors(): void {
    this.errors.clear()
    this.totalOperations = 0
    reviewLogger.info('[ErrorTracker] All errors cleared')
  }

  /**
   * Check if error rate exceeds critical threshold
   */
  private checkCriticalThreshold(): void {
    const metrics = this.getMetrics()

    if (metrics.errorRate > this.CRITICAL_THRESHOLD / 100) {
      reviewLogger.error(
        `[ErrorTracker] CRITICAL: Error rate ${metrics.errorRate.toFixed(2)}% exceeds threshold of 1%`,
        { metrics }
      )

      // In production, this would trigger alerts (email, Slack, PagerDuty, etc.)
      this.triggerAlert(metrics)
    }
  }

  /**
   * Trigger alert for high error rates
   */
  private triggerAlert(metrics: ErrorMetrics): void {
    // This would integrate with alerting services
    reviewLogger.error('[ErrorTracker] ALERT TRIGGERED', {
      errorRate: metrics.errorRate,
      totalErrors: metrics.totalErrors,
      criticalErrors: metrics.criticalErrors.length
    })
  }

  /**
   * Clean up old errors to prevent memory leaks
   */
  private cleanupOldErrors(): void {
    if (this.errors.size > this.MAX_ERROR_HISTORY) {
      const errors = Array.from(this.errors.entries())
        .sort((a, b) => b[1].timestamp - a[1].timestamp)

      // Keep only the most recent errors
      const toKeep = errors.slice(0, this.MAX_ERROR_HISTORY)
      this.errors = new Map(toKeep)

      reviewLogger.info(`[ErrorTracker] Cleaned up old errors, kept ${toKeep.length} most recent`)
    }
  }

  /**
   * Get error summary for dashboard
   */
  getSummary(): string {
    const metrics = this.getMetrics()

    return `
Error Summary:
- Total Errors: ${metrics.totalErrors}
- Error Rate: ${metrics.errorRate.toFixed(2)}%
- Critical: ${metrics.errorsBySeverity[ErrorSeverity.CRITICAL] || 0}
- High: ${metrics.errorsBySeverity[ErrorSeverity.HIGH] || 0}
- Medium: ${metrics.errorsBySeverity[ErrorSeverity.MEDIUM] || 0}
- Low: ${metrics.errorsBySeverity[ErrorSeverity.LOW] || 0}

Top Categories:
${Object.entries(metrics.errorsByCategory)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([cat, count]) => `- ${cat}: ${count}`)
  .join('\n')}
    `.trim()
  }
}

// Singleton instance
export const errorTracker = new ErrorTracker()
