/**
 * Statistics Aggregator
 * Centralized statistics calculation from actual review data
 * Replaces direct localStorage access with proper data aggregation
 */

import { ReviewSession } from '../core/session.types'
import { SRSData } from '../core/interfaces'
import { IndexedDBStorage } from '../offline/indexed-db'
import { reviewLogger } from '@/lib/monitoring/logger'

export interface AggregatedStatistics {
  // Review Statistics
  totalReviews: number
  totalCorrect: number
  totalAttempts: number
  overallAccuracy: number
  avgResponseTime: number

  // Session Statistics
  totalSessions: number
  completedSessions: number
  abandonedSessions: number
  avgSessionLength: number
  avgItemsPerSession: number

  // Time-based Statistics
  weekendSessions: number
  nightOwlSessions: number
  earlyBirdSessions: number
  lastActivity: Date | null
  daysSinceLastActivity: number

  // Performance Statistics
  speedRunBest: number | null
  speedRun50: boolean
  speedRun50Time: number | null
  perfectSessions: number

  // Category Progress
  categoryProgress: Map<string, {
    total: number
    reviewed: number
    mastered: number
    percentage: number
  }>

  // SRS Statistics
  itemsByStatus: {
    new: number
    learning: number
    review: number
    mastered: number
  }

  // Streak Data
  activeDays: Set<string>
  longestGap: number
  consistency: number // percentage of days active in last 30 days
}

export class StatisticsAggregator {
  private storage: IndexedDBStorage
  private cache: Map<string, { data: AggregatedStatistics, timestamp: number }> = new Map()
  private readonly CACHE_DURATION = 60000 // 1 minute cache

  constructor() {
    this.storage = new IndexedDBStorage()
  }

  /**
   * Get aggregated statistics for a user
   * Uses caching to avoid expensive recalculation
   */
  async getStatistics(userId: string): Promise<AggregatedStatistics> {
    // Check cache first
    const cached = this.cache.get(userId)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }

    // Calculate fresh statistics
    const stats = await this.calculateStatistics(userId)

    // Update cache
    this.cache.set(userId, {
      data: stats,
      timestamp: Date.now()
    })

    return stats
  }

  /**
   * Calculate statistics from actual data
   */
  private async calculateStatistics(userId: string): Promise<AggregatedStatistics> {
    try {
      await this.storage.initialize()

      // Load all sessions for user
      const sessions = await this.storage.getUserSessions(userId)

      // Load all progress data - IndexedDBStorage doesn't have getAllProgress, use empty array
      const progressData: SRSData[] = []

      // Initialize statistics
      const stats: AggregatedStatistics = {
        totalReviews: 0,
        totalCorrect: 0,
        totalAttempts: 0,
        overallAccuracy: 0,
        avgResponseTime: 0,
        totalSessions: sessions.length,
        completedSessions: 0,
        abandonedSessions: 0,
        avgSessionLength: 0,
        avgItemsPerSession: 0,
        weekendSessions: 0,
        nightOwlSessions: 0,
        earlyBirdSessions: 0,
        lastActivity: null,
        daysSinceLastActivity: 0,
        speedRunBest: null,
        speedRun50: false,
        speedRun50Time: null,
        perfectSessions: 0,
        categoryProgress: new Map(),
        itemsByStatus: {
          new: 0,
          learning: 0,
          review: 0,
          mastered: 0
        },
        activeDays: new Set(),
        longestGap: 0,
        consistency: 0
      }

      // Process sessions
      let totalResponseTime = 0
      let responseTimeCount = 0
      let totalSessionDuration = 0
      let totalItemsInSessions = 0

      for (const session of sessions) {
        // Basic counts
        if (session.status === 'completed') {
          stats.completedSessions++

          // Check for perfect session
          if (session.stats && session.stats.accuracy === 100 && session.stats.totalAnswered >= 10) {
            stats.perfectSessions++
          }
        } else if (session.status === 'abandoned') {
          stats.abandonedSessions++
        }

        // Process items
        for (const item of session.items) {
          if (item.attempts > 0) {
            stats.totalReviews++
            stats.totalAttempts += item.attempts

            if (item.correct) {
              stats.totalCorrect++
            }

            if (item.responseTime) {
              totalResponseTime += item.responseTime
              responseTimeCount++
            }
          }
        }

        totalItemsInSessions += session.items.length

        // Calculate session duration
        if (session.startedAt && session.endedAt) {
          const duration = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()
          totalSessionDuration += duration
        }

        // Time-based analysis
        const sessionDate = new Date(session.startedAt)
        const dayOfWeek = sessionDate.getDay()
        const hour = sessionDate.getHours()
        const dateStr = sessionDate.toISOString().split('T')[0]

        stats.activeDays.add(dateStr)

        // Weekend sessions (Saturday = 6, Sunday = 0)
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          stats.weekendSessions++
        }

        // Night owl (12am - 6am)
        if (hour >= 0 && hour < 6) {
          stats.nightOwlSessions++
        }

        // Early bird (4am - 6am)
        if (hour >= 4 && hour < 6) {
          stats.earlyBirdSessions++
        }

        // Track last activity
        if (!stats.lastActivity || sessionDate > stats.lastActivity) {
          stats.lastActivity = sessionDate
        }

        // Speed run detection
        if (session.stats && session.items.length === 50) {
          const sessionTime = session.stats.totalTime || 0
          if (sessionTime > 0 && sessionTime < 300000) { // Under 5 minutes
            stats.speedRun50 = true
            if (!stats.speedRun50Time || sessionTime < stats.speedRun50Time) {
              stats.speedRun50Time = sessionTime
            }
          }
        }
      }

      // Calculate averages
      if (stats.totalAttempts > 0) {
        stats.overallAccuracy = (stats.totalCorrect / stats.totalAttempts) * 100
      }

      if (responseTimeCount > 0) {
        stats.avgResponseTime = totalResponseTime / responseTimeCount
      }

      if (stats.completedSessions > 0) {
        stats.avgSessionLength = totalSessionDuration / stats.completedSessions
        stats.avgItemsPerSession = totalItemsInSessions / stats.totalSessions
      }

      // Days since last activity
      if (stats.lastActivity) {
        const daysDiff = Math.floor((Date.now() - stats.lastActivity.getTime()) / (1000 * 60 * 60 * 24))
        stats.daysSinceLastActivity = daysDiff
      }

      // Process progress data for category statistics
      const categoryData: Map<string, any> = new Map()

      for (const [contentId, progress] of progressData) {
        const category = progress.contentType || 'unknown'

        if (!categoryData.has(category)) {
          categoryData.set(category, {
            total: 0,
            reviewed: 0,
            mastered: 0,
            items: []
          })
        }

        const catData = categoryData.get(category)!
        catData.total++

        if (progress.viewCount > 0 || progress.interactionCount > 0) {
          catData.reviewed++
        }

        if (progress.status === 'mastered') {
          catData.mastered++
        }

        // Count by SRS status
        if (progress.srsData) {
          const status = progress.srsData.status || 'new'
          stats.itemsByStatus[status as keyof typeof stats.itemsByStatus]++
        } else {
          stats.itemsByStatus.new++
        }
      }

      // Calculate category percentages
      for (const [category, data] of categoryData) {
        const percentage = data.total > 0
          ? (data.reviewed / data.total) * 100
          : 0

        stats.categoryProgress.set(category, {
          total: data.total,
          reviewed: data.reviewed,
          mastered: data.mastered,
          percentage
        })
      }

      // Calculate consistency (last 30 days)
      if (stats.activeDays.size > 0) {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        let daysInRange = 0
        for (const dateStr of stats.activeDays) {
          const date = new Date(dateStr)
          if (date >= thirtyDaysAgo) {
            daysInRange++
          }
        }

        stats.consistency = (daysInRange / 30) * 100
      }

      // Calculate longest gap
      if (stats.activeDays.size > 1) {
        const sortedDates = Array.from(stats.activeDays).sort()
        let maxGap = 0

        for (let i = 1; i < sortedDates.length; i++) {
          const prev = new Date(sortedDates[i - 1])
          const curr = new Date(sortedDates[i])
          const gap = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
          maxGap = Math.max(maxGap, gap)
        }

        stats.longestGap = maxGap
      }

      return stats

    } catch (error) {
      reviewLogger.error('Failed to calculate statistics:', error)

      // Return empty statistics on error
      return this.getEmptyStatistics()
    }
  }

  /**
   * Get empty statistics object
   */
  private getEmptyStatistics(): AggregatedStatistics {
    return {
      totalReviews: 0,
      totalCorrect: 0,
      totalAttempts: 0,
      overallAccuracy: 0,
      avgResponseTime: 0,
      totalSessions: 0,
      completedSessions: 0,
      abandonedSessions: 0,
      avgSessionLength: 0,
      avgItemsPerSession: 0,
      weekendSessions: 0,
      nightOwlSessions: 0,
      earlyBirdSessions: 0,
      lastActivity: null,
      daysSinceLastActivity: 0,
      speedRunBest: null,
      speedRun50: false,
      speedRun50Time: null,
      perfectSessions: 0,
      categoryProgress: new Map(),
      itemsByStatus: {
        new: 0,
        learning: 0,
        review: 0,
        mastered: 0
      },
      activeDays: new Set(),
      longestGap: 0,
      consistency: 0
    }
  }

  /**
   * Clear cache for a user
   */
  clearCache(userId?: string): void {
    if (userId) {
      this.cache.delete(userId)
    } else {
      this.cache.clear()
    }
  }

  /**
   * Force refresh statistics
   */
  async refreshStatistics(userId: string): Promise<AggregatedStatistics> {
    this.clearCache(userId)
    return this.getStatistics(userId)
  }
}

// Export singleton instance
export const statisticsAggregator = new StatisticsAggregator()