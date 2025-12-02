/**
 * Performance Monitoring for Review Engine
 * Tracks latency and throughput metrics
 *
 * Requirements:
 * - SM-2 calculation: <10ms (target: <1ms)
 * - Queue generation: <100ms for 1000 items
 * - Session operations: <50ms
 * - Offline sync: <100ms per item
 * - Success rate: >99.9%
 */

import { reviewLogger } from '@/lib/monitoring/logger'

export enum OperationType {
  SRS_CALCULATION = 'srs_calculation',
  QUEUE_GENERATION = 'queue_generation',
  SESSION_CREATE = 'session_create',
  SESSION_UPDATE = 'session_update',
  ITEM_ANSWER = 'item_answer',
  OFFLINE_SYNC = 'offline_sync',
  VALIDATION = 'validation',
  PERSISTENCE = 'persistence'
}

export interface PerformanceMetric {
  operation: OperationType
  duration: number
  timestamp: number
  success: boolean
  metadata?: Record<string, any>
}

export interface PerformanceSummary {
  operation: OperationType
  count: number
  avgDuration: number
  minDuration: number
  maxDuration: number
  p50: number
  p95: number
  p99: number
  successRate: number
  withinSLA: boolean
  slaTarget: number
}

export interface PerformanceThresholds {
  [OperationType.SRS_CALCULATION]: number // 10ms
  [OperationType.QUEUE_GENERATION]: number // 100ms
  [OperationType.SESSION_CREATE]: number // 50ms
  [OperationType.SESSION_UPDATE]: number // 50ms
  [OperationType.ITEM_ANSWER]: number // 50ms
  [OperationType.OFFLINE_SYNC]: number // 100ms
  [OperationType.VALIDATION]: number // 20ms
  [OperationType.PERSISTENCE]: number // 200ms
}

class PerformanceMonitor {
  private metrics: Map<OperationType, PerformanceMetric[]> = new Map()
  private readonly MAX_METRICS_PER_TYPE = 1000
  private readonly SLA_THRESHOLDS: PerformanceThresholds = {
    [OperationType.SRS_CALCULATION]: 10,
    [OperationType.QUEUE_GENERATION]: 100,
    [OperationType.SESSION_CREATE]: 50,
    [OperationType.SESSION_UPDATE]: 50,
    [OperationType.ITEM_ANSWER]: 50,
    [OperationType.OFFLINE_SYNC]: 100,
    [OperationType.VALIDATION]: 20,
    [OperationType.PERSISTENCE]: 200
  }

  /**
   * Start timing an operation
   */
  startTimer(): () => number {
    const start = performance.now()

    return () => {
      return performance.now() - start
    }
  }

  /**
   * Record a performance metric
   */
  record(
    operation: OperationType,
    duration: number,
    success: boolean = true,
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: Date.now(),
      success,
      metadata
    }

    // Get or create metrics array for this operation
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, [])
    }

    const operationMetrics = this.metrics.get(operation)!
    operationMetrics.push(metric)

    // Keep only recent metrics
    if (operationMetrics.length > this.MAX_METRICS_PER_TYPE) {
      operationMetrics.shift()
    }

    // Check SLA violation
    const slaThreshold = this.SLA_THRESHOLDS[operation]
    if (duration > slaThreshold) {
      reviewLogger.warn(
        `[PerformanceMonitor] SLA violation: ${operation} took ${duration.toFixed(2)}ms (threshold: ${slaThreshold}ms)`,
        { metadata }
      )
    }
  }

  /**
   * Measure and record an async operation
   */
  async measure<T>(
    operation: OperationType,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const end = this.startTimer()
    let success = true

    try {
      const result = await fn()
      return result
    } catch (error) {
      success = false
      throw error
    } finally {
      const duration = end()
      this.record(operation, duration, success, metadata)
    }
  }

  /**
   * Measure and record a sync operation
   */
  measureSync<T>(
    operation: OperationType,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    const end = this.startTimer()
    let success = true

    try {
      const result = fn()
      return result
    } catch (error) {
      success = false
      throw error
    } finally {
      const duration = end()
      this.record(operation, duration, success, metadata)
    }
  }

  /**
   * Get summary statistics for an operation type
   */
  getSummary(operation: OperationType): PerformanceSummary | null {
    const metrics = this.metrics.get(operation)

    if (!metrics || metrics.length === 0) {
      return null
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b)
    const successfulOps = metrics.filter(m => m.success).length

    const summary: PerformanceSummary = {
      operation,
      count: metrics.length,
      avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p50: this.percentile(durations, 50),
      p95: this.percentile(durations, 95),
      p99: this.percentile(durations, 99),
      successRate: (successfulOps / metrics.length) * 100,
      withinSLA: this.percentile(durations, 95) <= this.SLA_THRESHOLDS[operation],
      slaTarget: this.SLA_THRESHOLDS[operation]
    }

    return summary
  }

  /**
   * Get all summaries
   */
  getAllSummaries(): PerformanceSummary[] {
    const summaries: PerformanceSummary[] = []

    for (const operation of Object.values(OperationType)) {
      const summary = this.getSummary(operation as OperationType)
      if (summary) {
        summaries.push(summary)
      }
    }

    return summaries
  }

  /**
   * Check if system is within SLA
   */
  isWithinSLA(): boolean {
    const summaries = this.getAllSummaries()

    // Check critical operations
    const criticalOps = [
      OperationType.SRS_CALCULATION,
      OperationType.SESSION_CREATE,
      OperationType.ITEM_ANSWER
    ]

    for (const op of criticalOps) {
      const summary = summaries.find(s => s.operation === op)
      if (summary && !summary.withinSLA) {
        reviewLogger.warn(
          `[PerformanceMonitor] SLA breach for ${op}: p95=${summary.p95.toFixed(2)}ms (target: ${summary.slaTarget}ms)`
        )
        return false
      }
    }

    return true
  }

  /**
   * Get performance report
   */
  getReport(): string {
    const summaries = this.getAllSummaries()

    if (summaries.length === 0) {
      return 'No performance data available'
    }

    const lines = ['Performance Report:', '']

    for (const summary of summaries) {
      const slaStatus = summary.withinSLA ? '✓' : '✗'
      lines.push(`${slaStatus} ${summary.operation}:`)
      lines.push(`  Count: ${summary.count}`)
      lines.push(`  Avg: ${summary.avgDuration.toFixed(2)}ms`)
      lines.push(`  P50: ${summary.p50.toFixed(2)}ms`)
      lines.push(`  P95: ${summary.p95.toFixed(2)}ms (target: ${summary.slaTarget}ms)`)
      lines.push(`  P99: ${summary.p99.toFixed(2)}ms`)
      lines.push(`  Success Rate: ${summary.successRate.toFixed(2)}%`)
      lines.push('')
    }

    return lines.join('\n')
  }

  /**
   * Clear all metrics (admin function)
   */
  clear(): void {
    this.metrics.clear()
    reviewLogger.info('[PerformanceMonitor] All metrics cleared')
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1
    return sortedArray[Math.max(0, index)]
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()
