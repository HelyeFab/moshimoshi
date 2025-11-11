/**
 * XPConfigService - Single Source of Truth for XP Awards
 *
 * This service manages all XP calculations and validations based on
 * the centralized configuration file. It ensures consistency across
 * all features and provides anti-cheat mechanisms.
 */

import xpConfig from '../../../config/xp-config.json'
import logger from '@/lib/logger'

export interface XPCalculation {
  activityId: string
  baseXP: number
  bonusXP: number
  totalXP: number
  cappedXP: number
  details: Record<string, any>
  countsForStreak: boolean
  appliedCooldown: boolean
}

export interface ActivityXPConfig {
  id: string
  name: string
  description: string
  enabled: boolean
  baseXP: number
  bonuses?: Record<string, { threshold?: number; xp: number }>
  rewards?: Record<string, any>
  thresholds?: Record<string, number>
  maxPerSession: number
  cooldownMinutes: number
  countsForStreak: boolean
}

class XPConfigService {
  private static instance: XPConfigService
  private config = xpConfig
  private cooldowns: Map<string, number> = new Map()

  private constructor() {
    // Load config and initialize
    logger.info('[XPConfigService] Initialized with config version:', this.config.version)
  }

  public static getInstance(): XPConfigService {
    if (!XPConfigService.instance) {
      XPConfigService.instance = new XPConfigService()
    }
    return XPConfigService.instance
  }

  /**
   * Get configuration for a specific activity
   */
  getActivityConfig(activityId: string): ActivityXPConfig | null {
    const activity = this.config.activities[activityId as keyof typeof this.config.activities]
    if (!activity) {
      logger.warn(`[XPConfigService] Activity not found: ${activityId}`)
      return null
    }
    return activity as ActivityXPConfig
  }

  /**
   * Check if an activity is enabled
   */
  isActivityEnabled(activityId: string): boolean {
    const activity = this.getActivityConfig(activityId)
    return activity?.enabled || false
  }

  /**
   * Calculate XP for drill activity
   */
  calculateDrillXP(accuracy: number): XPCalculation {
    const config = this.getActivityConfig('drill')
    if (!config || !config.enabled) {
      return this.createEmptyCalculation('drill')
    }

    let bonusXP = 0
    let bonusType = 'none'

    // Check bonuses based on accuracy
    if (config.bonuses) {
      if (accuracy === 100 && config.bonuses.perfect) {
        bonusXP = config.bonuses.perfect.xp
        bonusType = 'perfect'
      } else if (accuracy >= 90 && config.bonuses.high) {
        bonusXP = config.bonuses.high.xp
        bonusType = 'high'
      } else if (accuracy >= 80 && config.bonuses.good) {
        bonusXP = config.bonuses.good.xp
        bonusType = 'good'
      } else if (accuracy >= 70 && config.bonuses.decent) {
        bonusXP = config.bonuses.decent.xp
        bonusType = 'decent'
      }
    }

    const totalXP = config.baseXP + bonusXP
    const cappedXP = Math.min(totalXP, config.maxPerSession)

    return {
      activityId: 'drill',
      baseXP: config.baseXP,
      bonusXP,
      totalXP,
      cappedXP,
      details: {
        accuracy,
        bonusType
      },
      countsForStreak: config.countsForStreak,
      appliedCooldown: false
    }
  }

  /**
   * Calculate XP for flashcard session
   */
  calculateFlashcardsXP(
    correctCount: number,
    bestStreak: number,
    perfectSession: boolean,
    fastCards: number
  ): XPCalculation {
    const config = this.getActivityConfig('flashcards')
    if (!config || !config.enabled) {
      return this.createEmptyCalculation('flashcards')
    }

    const rewards = config.rewards || {}

    const baseXP = correctCount * (rewards.perCorrect || 10)
    const streakBonus = bestStreak * (rewards.streakBonus || 5)
    const perfectBonus = perfectSession ? (rewards.perfectBonus || 50) : 0
    const speedBonus = fastCards * (rewards.speedBonusPerCard || 2)

    const bonusXP = streakBonus + perfectBonus + speedBonus
    const totalXP = baseXP + bonusXP
    const cappedXP = Math.min(totalXP, config.maxPerSession)

    return {
      activityId: 'flashcards',
      baseXP,
      bonusXP,
      totalXP,
      cappedXP,
      details: {
        correctCount,
        bestStreak,
        perfectSession,
        fastCards,
        breakdown: {
          correctXP: baseXP,
          streakXP: streakBonus,
          perfectXP: perfectBonus,
          speedXP: speedBonus
        }
      },
      countsForStreak: config.countsForStreak,
      appliedCooldown: false
    }
  }

  /**
   * Calculate XP for Kanji Mastery session
   */
  calculateKanjiMasteryXP(
    kanjiCount: number,
    perfectKanjiCount: number,
    averageAccuracy: number,
    speedMultiplier: number,
    noReviewNeeded: boolean,
    roundsCompleted: number
  ): XPCalculation {
    const config = this.getActivityConfig('kanji_mastery')
    if (!config || !config.enabled) {
      return this.createEmptyCalculation('kanji_mastery')
    }

    const rewards = config.rewards || {}
    const thresholds = config.thresholds || {}

    // Base XP
    let baseXP = config.baseXP
    baseXP += kanjiCount * (rewards.perKanji || 10)

    // Bonus calculations
    let bonusXP = 0

    // Perfect kanji bonus
    bonusXP += perfectKanjiCount * (rewards.perfectKanjiBonus || 15)

    // Accuracy bonus
    if (averageAccuracy >= (thresholds.excellentAccuracy || 0.9)) {
      bonusXP += rewards.excellentAccuracyBonus || 50
    } else if (averageAccuracy >= (thresholds.goodAccuracy || 0.8)) {
      bonusXP += rewards.goodAccuracyBonus || 30
    } else if (averageAccuracy >= (thresholds.decentAccuracy || 0.7)) {
      bonusXP += rewards.decentAccuracyBonus || 15
    }

    // Speed bonus
    if (speedMultiplier < (thresholds.speedMultiplier || 0.75)) {
      bonusXP += rewards.speedBonus || 25
    }

    // No review bonus
    if (noReviewNeeded) {
      bonusXP += rewards.noReviewBonus || 30
    }

    // Round completion bonus
    bonusXP += roundsCompleted * (rewards.roundCompletionBase || 5)

    const totalXP = baseXP + bonusXP
    const cappedXP = Math.min(totalXP, config.maxPerSession)

    return {
      activityId: 'kanji_mastery',
      baseXP,
      bonusXP,
      totalXP,
      cappedXP,
      details: {
        kanjiCount,
        perfectKanjiCount,
        averageAccuracy,
        speedMultiplier,
        noReviewNeeded,
        roundsCompleted
      },
      countsForStreak: config.countsForStreak,
      appliedCooldown: false
    }
  }

  /**
   * Generic XP calculation for new activities
   */
  calculateActivityXP(
    activityId: string,
    metrics: Record<string, any>
  ): XPCalculation {
    const config = this.getActivityConfig(activityId)
    if (!config || !config.enabled) {
      return this.createEmptyCalculation(activityId)
    }

    // This is a placeholder for future activities
    // Each activity will have its own calculation logic
    const baseXP = config.baseXP
    const bonusXP = 0 // Calculate based on activity-specific metrics
    const totalXP = baseXP + bonusXP
    const cappedXP = Math.min(totalXP, config.maxPerSession)

    return {
      activityId,
      baseXP,
      bonusXP,
      totalXP,
      cappedXP,
      details: metrics,
      countsForStreak: config.countsForStreak,
      appliedCooldown: false
    }
  }

  /**
   * Check if user is within cooldown period
   */
  isInCooldown(userId: string, activityId: string): boolean {
    const key = `${userId}:${activityId}`
    const lastActivity = this.cooldowns.get(key)

    if (!lastActivity) return false

    const config = this.getActivityConfig(activityId)
    if (!config || config.cooldownMinutes === 0) return false

    const cooldownMs = config.cooldownMinutes * 60 * 1000
    const timeSinceLastActivity = Date.now() - lastActivity

    return timeSinceLastActivity < cooldownMs
  }

  /**
   * Record activity for cooldown tracking
   */
  recordActivity(userId: string, activityId: string): void {
    const key = `${userId}:${activityId}`
    this.cooldowns.set(key, Date.now())

    // Clean up old entries periodically
    if (this.cooldowns.size > 1000) {
      this.cleanupCooldowns()
    }
  }

  /**
   * Check for suspicious XP patterns (anti-cheat)
   */
  validateXP(userId: string, xpAmount: number, activityId: string): {
    valid: boolean
    reason?: string
  } {
    // Check if activity is enabled
    if (!this.isActivityEnabled(activityId)) {
      return { valid: false, reason: 'Activity disabled' }
    }

    // Check cooldown
    if (this.isInCooldown(userId, activityId)) {
      return { valid: false, reason: 'Activity in cooldown' }
    }

    // Check suspicious threshold
    if (this.config.antiCheat?.enabled) {
      if (xpAmount > (this.config.antiCheat.suspiciousThreshold || 1000)) {
        logger.warn(`[XPConfigService] Suspicious XP amount detected: ${xpAmount} for user ${userId}`)
        return { valid: false, reason: 'Suspicious XP amount' }
      }
    }

    return { valid: true }
  }

  /**
   * Get minimum XP required for streak update
   * Now reads from gamification streak config (single source of truth)
   */
  getMinXPForStreak(): number {
    // Read from gamification streak config to ensure consistency
    const streakConfig = require('@/config/gamification/streak.json')
    return streakConfig.minXPForStreak || 10
  }

  /**
   * Get all enabled activities
   */
  getEnabledActivities(): ActivityXPConfig[] {
    return Object.values(this.config.activities)
      .filter(activity => activity.enabled) as ActivityXPConfig[]
  }

  /**
   * Get all activities (enabled and disabled)
   */
  getAllActivities(): ActivityXPConfig[] {
    return Object.values(this.config.activities) as ActivityXPConfig[]
  }

  /**
   * Update activity configuration (for admin panel)
   */
  updateActivityConfig(activityId: string, updates: Partial<ActivityXPConfig>): void {
    const activity = this.config.activities[activityId as keyof typeof this.config.activities]
    if (activity) {
      Object.assign(activity, updates)
      this.config.lastUpdated = new Date().toISOString().split('T')[0]
      logger.info(`[XPConfigService] Updated config for activity: ${activityId}`)
    }
  }

  /**
   * Get full configuration (for admin panel)
   */
  getFullConfig() {
    return this.config
  }

  /**
   * Clean up old cooldown entries
   */
  private cleanupCooldowns(): void {
    const now = Date.now()
    const maxCooldown = 60 * 60 * 1000 // 1 hour max

    for (const [key, timestamp] of this.cooldowns.entries()) {
      if (now - timestamp > maxCooldown) {
        this.cooldowns.delete(key)
      }
    }
  }

  /**
   * Create empty calculation result
   */
  private createEmptyCalculation(activityId: string): XPCalculation {
    return {
      activityId,
      baseXP: 0,
      bonusXP: 0,
      totalXP: 0,
      cappedXP: 0,
      details: {},
      countsForStreak: false,
      appliedCooldown: false
    }
  }
}

// Export singleton instance
export const xpConfigService = XPConfigService.getInstance()