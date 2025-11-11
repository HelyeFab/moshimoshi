/**
 * Gamification Metrics & Telemetry System
 *
 * Logs gamification events for debugging, analytics, and observability.
 * Tracks XP awarded, achievements unlocked, streaks, and other key metrics.
 */

import { gamificationListener } from '@/lib/gamification/gamificationListener'

export interface GamificationMetric {
  timestamp: Date
  event: string
  data: Record<string, any>
  userId?: string
}

export interface MetricsSummary {
  totalMetrics: number
  events: Record<string, number>
  metrics: GamificationMetric[]
}

/**
 * Gamification Metrics Class
 */
export class GamificationMetrics {
  private metrics: GamificationMetric[] = []
  private isEnabled: boolean
  private maxMetricsStored: number = 1000 // Prevent memory issues

  constructor() {
    this.isEnabled = process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION === 'true'
  }

  /**
   * Initialize telemetry and listen to gamification events
   */
  initialize(): void {
    if (!this.isEnabled) {
      console.log('[GamificationMetrics] Telemetry disabled (feature flag OFF)')
      return
    }

    // Listen to XP awarded events
    gamificationListener.on('xp.awarded', (data) => {
      this.logMetric('xp_awarded', {
        sessionId: data.sessionId,
        xp: data.xp,
        breakdown: data.breakdown
      })
    })

    // Listen to achievement unlocked events
    gamificationListener.on('achievement.unlocked', (data) => {
      this.logMetric('achievement_unlocked', {
        achievementId: data.id,
        achievementName: data.name,
        category: data.category,
        points: data.points
      })
    })

    // Listen to streak incremented events
    gamificationListener.on('streak.incremented', (data) => {
      this.logMetric('streak_incremented', {
        currentStreak: data.currentStreak,
        bestStreak: data.bestStreak
      })
    })

    // Listen to streak reset events
    gamificationListener.on('streak.reset', (data) => {
      this.logMetric('streak_reset', {
        previousStreak: data.previousStreak,
        reason: data.reason
      })
    })

    console.log('[GamificationMetrics] Telemetry initialized')
  }

  /**
   * Log a gamification metric
   */
  logMetric(event: string, data: Record<string, any>, userId?: string): void {
    if (!this.isEnabled) return

    const metric: GamificationMetric = {
      timestamp: new Date(),
      event,
      data,
      userId
    }

    this.metrics.push(metric)

    // Enforce max metrics limit (FIFO)
    if (this.metrics.length > this.maxMetricsStored) {
      this.metrics.shift() // Remove oldest
    }

    // Console log for debugging
    console.log(`[Gamification Metric] ${event}:`, data)

    // Could send to analytics service here
    // Example: analytics.track(event, data)
  }

  /**
   * Get all metrics (for debugging/dashboard)
   */
  getMetrics(): GamificationMetric[] {
    return this.metrics
  }

  /**
   * Get metrics by event type
   */
  getMetricsByEvent(event: string): GamificationMetric[] {
    return this.metrics.filter(m => m.event === event)
  }

  /**
   * Get metrics by user ID
   */
  getMetricsByUser(userId: string): GamificationMetric[] {
    return this.metrics.filter(m => m.userId === userId)
  }

  /**
   * Get metrics within a time range
   */
  getMetricsByTimeRange(startDate: Date, endDate: Date): GamificationMetric[] {
    return this.metrics.filter(
      m => m.timestamp >= startDate && m.timestamp <= endDate
    )
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = []
    console.log('[GamificationMetrics] Metrics cleared')
  }

  /**
   * Export metrics to JSON (for dashboard mock)
   */
  exportMetrics(): string {
    const summary: MetricsSummary = {
      totalMetrics: this.metrics.length,
      events: this.getEventCounts(),
      metrics: this.metrics
    }

    return JSON.stringify(summary, null, 2)
  }

  /**
   * Get count of each event type
   */
  private getEventCounts(): Record<string, number> {
    const counts: Record<string, number> = {}

    this.metrics.forEach(metric => {
      counts[metric.event] = (counts[metric.event] || 0) + 1
    })

    return counts
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalMetrics: number
    totalXPAwarded: number
    avgXPPerSession: number
    achievementsUnlocked: number
    streaksIncremented: number
    uniqueUsers: number
  } {
    const xpMetrics = this.getMetricsByEvent('xp_awarded')
    const achievementMetrics = this.getMetricsByEvent('achievement_unlocked')
    const streakMetrics = this.getMetricsByEvent('streak_incremented')

    const totalXP = xpMetrics.reduce((sum, m) => sum + (m.data.xp || 0), 0)
    const avgXP = xpMetrics.length > 0 ? totalXP / xpMetrics.length : 0

    const uniqueUserIds = new Set(
      this.metrics.filter(m => m.userId).map(m => m.userId)
    )

    return {
      totalMetrics: this.metrics.length,
      totalXPAwarded: totalXP,
      avgXPPerSession: Math.round(avgXP * 100) / 100,
      achievementsUnlocked: achievementMetrics.length,
      streaksIncremented: streakMetrics.length,
      uniqueUsers: uniqueUserIds.size
    }
  }
}

// Singleton instance
export const gamificationMetrics = new GamificationMetrics()
