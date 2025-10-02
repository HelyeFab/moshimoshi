/**
 * Achievement Listener Service
 * External gamification service that listens to URE events
 *
 * This service maintains clean separation between the Universal Review Engine (URE)
 * and the gamification system. URE emits pure review statistics events, and this
 * service consumes those events to calculate XP and unlock achievements.
 *
 * Architecture:
 * - URE emits: SESSION_COMPLETED, ITEM_ANSWERED, PROGRESS_UPDATED
 * - This service listens to those events
 * - Calculates XP based on session performance
 * - Checks and unlocks achievements
 * - Emits ACHIEVEMENT_UNLOCKED events (outside URE)
 */

import { EventEmitter } from 'events'
import { ReviewEventType, SessionCompletedPayload, ItemAnsweredPayload } from '@/lib/review-engine/core/events'
import { SessionStatistics } from '@/lib/review-engine/core/session.types'
import { AchievementSystem } from '@/lib/review-engine/progress/achievement-system'
import { xpSystem } from '@/lib/gamification/xp-system'
import { reviewLogger } from '@/lib/monitoring/logger'

export interface XPCalculationResult {
  baseXP: number
  bonuses: {
    speed?: number
    accuracy?: number
    streak?: number
    difficulty?: number
  }
  totalXP: number
  cappedXP: number
}

/**
 * External achievement listener that consumes URE events
 */
export class AchievementListenerService extends EventEmitter {
  private achievementSystem: AchievementSystem | null = null
  private userId: string | null = null

  /**
   * Initialize the service for a specific user
   */
  initialize(userId: string): void {
    this.userId = userId

    // Note: AchievementSystem requires ProgressTracker, which we don't have here
    // This will be refactored when achievement system is fully extracted
    reviewLogger.info(`[AchievementListener] Initialized for user ${userId}`)
  }

  /**
   * Listen to URE events and process them
   */
  listenToReviewEngine(reviewEngineEmitter: EventEmitter): void {
    // Listen to session completion
    reviewEngineEmitter.on(ReviewEventType.SESSION_COMPLETED, (event) => {
      this.handleSessionCompleted(event.data as SessionCompletedPayload)
    })

    // Listen to item answered for streak tracking
    reviewEngineEmitter.on(ReviewEventType.ITEM_ANSWERED, (event) => {
      this.handleItemAnswered(event.data as ItemAnsweredPayload)
    })

    reviewLogger.info('[AchievementListener] Started listening to URE events')
  }

  /**
   * Handle session completion - calculate XP and check achievements
   */
  private async handleSessionCompleted(payload: SessionCompletedPayload): Promise<void> {
    try {
      const { sessionId, statistics, duration } = payload

      // Calculate XP based on session performance
      const xpResult = this.calculateSessionXP(statistics, duration)

      // Award XP (this would interact with user profile)
      reviewLogger.info(`[AchievementListener] Session ${sessionId} earned ${xpResult.cappedXP} XP`)

      // Emit XP awarded event (for UI notifications)
      this.emit('xp.awarded', {
        sessionId,
        xp: xpResult.cappedXP,
        breakdown: xpResult.bonuses
      })

      // Check for achievements based on session stats
      await this.checkSessionAchievements(statistics)

    } catch (error) {
      reviewLogger.error('[AchievementListener] Error handling session completion:', error)
    }
  }

  /**
   * Handle item answered - track streaks
   */
  private handleItemAnswered(payload: ItemAnsweredPayload): void {
    // Streak tracking logic can be added here
    // For now, streaks are tracked in session statistics
  }

  /**
   * Calculate XP for a completed session
   * This replaces the XP calculation that was previously inside URE
   */
  private calculateSessionXP(statistics: SessionStatistics, durationMs: number): XPCalculationResult {
    const baseXP = statistics.correctItems * 10 // 10 XP per correct answer
    const bonuses: XPCalculationResult['bonuses'] = {}

    // Accuracy bonus
    if (statistics.accuracy >= 90) {
      bonuses.accuracy = Math.round(baseXP * 0.5) // 50% bonus for 90%+ accuracy
    } else if (statistics.accuracy >= 80) {
      bonuses.accuracy = Math.round(baseXP * 0.25) // 25% bonus for 80%+ accuracy
    }

    // Speed bonus (if average response time is under 5 seconds)
    if (statistics.averageResponseTime < 5000) {
      bonuses.speed = Math.round(baseXP * 0.2) // 20% speed bonus
    }

    // Streak bonus
    if (statistics.bestStreak >= 10) {
      bonuses.streak = statistics.bestStreak * 2 // 2 XP per streak item
    }

    // Calculate total
    const bonusTotal = Object.values(bonuses).reduce((sum, val) => sum + (val || 0), 0)
    const totalXP = baseXP + bonusTotal

    // Apply daily cap (500 XP per day)
    const cappedXP = Math.min(totalXP, 500)

    return {
      baseXP,
      bonuses,
      totalXP,
      cappedXP
    }
  }

  /**
   * Check session-based achievements
   */
  private async checkSessionAchievements(statistics: SessionStatistics): Promise<void> {
    const achievements: string[] = []

    // Perfect session achievement
    if (statistics.accuracy === 100 && statistics.totalItems >= 10) {
      achievements.push('perfect_session')
      this.emit('achievement.unlocked', {
        achievementId: 'perfect_session',
        achievementName: 'Perfect Session',
        description: 'Complete a session with 100% accuracy',
        category: 'accuracy',
        points: 100
      })
    }

    // Streak master achievement
    if (statistics.bestStreak >= 20) {
      achievements.push('streak_master')
      this.emit('achievement.unlocked', {
        achievementId: 'streak_master',
        achievementName: 'Streak Master',
        description: 'Achieve a 20+ answer streak',
        category: 'streak',
        points: 50
      })
    }

    // Speed demon achievement
    if (statistics.averageResponseTime < 3000 && statistics.totalItems >= 20) {
      achievements.push('speed_demon')
      this.emit('achievement.unlocked', {
        achievementId: 'speed_demon',
        achievementName: 'Speed Demon',
        description: 'Average under 3 seconds per answer',
        category: 'speed',
        points: 75
      })
    }

    if (achievements.length > 0) {
      reviewLogger.info(`[AchievementListener] Unlocked achievements:`, achievements)
    }
  }

  /**
   * Get XP breakdown for display purposes
   */
  getXPBreakdown(statistics: SessionStatistics, durationMs: number): XPCalculationResult {
    return this.calculateSessionXP(statistics, durationMs)
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.removeAllListeners()
    this.achievementSystem = null
    this.userId = null
    reviewLogger.info('[AchievementListener] Service destroyed')
  }
}

/**
 * Singleton instance for easy access
 */
export const achievementListener = new AchievementListenerService()
