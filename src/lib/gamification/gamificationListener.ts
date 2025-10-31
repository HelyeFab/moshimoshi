/**
 * Gamification Listener Service
 * Event-driven gamification system that listens to URE events
 *
 * CRITICAL: This service maintains clean separation from the Universal Review Engine (URE)
 * - URE emits: SESSION_COMPLETED, ITEM_ANSWERED, PROGRESS_UPDATED
 * - This service listens to those events (read-only)
 * - Calculates XP based on config-driven rules
 * - Checks and unlocks achievements
 * - ZERO modifications to URE code
 */

import { EventEmitter } from 'events'
import {
  ReviewEventType,
  SessionCompletedPayload,
  ItemAnsweredPayload
} from '@/lib/review-engine/core/events'
import { useGamificationStore } from '@/state/userGamification'

// Import configs (Agent 2 deliverables)
import xpConfig from '@/config/gamification/xp.json'
import streakConfig from '@/config/gamification/streak.json'
import achievementsConfig from '@/config/gamification/achievements.json'

export interface XPCalculationResult {
  baseXP: number
  bonuses: {
    accuracy?: number
    speed?: number
    streak?: number
  }
  totalXP: number
  cappedXP: number
}

/**
 * Gamification Listener Class
 */
export class GamificationListener extends EventEmitter {
  private userId: string | null = null
  private isEnabled: boolean = false

  /**
   * Initialize listener and subscribe to URE events
   */
  initialize(userId: string, reviewEngineEmitter: EventEmitter): void {
    // 1. Check feature flag
    this.isEnabled = process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION === 'true'
    if (!this.isEnabled) {
      console.log('[Gamification] Feature disabled via flag')
      return
    }

    this.userId = userId

    // Set userId in store for IndexedDB operations
    const store = useGamificationStore.getState()
    store.setUserId(userId)

    // 2. Subscribe to URE events (read-only, never modify URE)
    reviewEngineEmitter.on(
      ReviewEventType.SESSION_COMPLETED,
      this.handleSessionCompleted.bind(this)
    )

    reviewEngineEmitter.on(
      ReviewEventType.ITEM_ANSWERED,
      this.handleItemAnswered.bind(this)
    )

    console.log('[Gamification] Listener initialized for user:', userId)
  }

  /**
   * Handle session completion - main XP calculation logic
   */
  private async handleSessionCompleted(event: any): Promise<void> {
    if (!this.isEnabled) return

    try {
      // Event emitter passes the data object directly as the event parameter
      // The event structure is: { data: { sessionId, statistics, duration } }
      const payload = event.data || event as SessionCompletedPayload
      const { sessionId, statistics, duration } = payload

      console.log('[Gamification] Received event:', event)
      console.log('[Gamification] Processing session:', sessionId, statistics)

      // 1. Calculate XP with bonuses (config-driven)
      const xpResult = this.calculateXP(statistics)
      console.log('[Gamification] XP Calculation:', {
        correctItems: statistics.correctItems,
        baseXP: xpResult.baseXP,
        bonuses: xpResult.bonuses,
        totalXP: xpResult.totalXP,
        cappedXP: xpResult.cappedXP
      })

      // 2. Award XP to user
      const store = useGamificationStore.getState()
      console.log('[Gamification] Before XP award - Total XP:', store.totalXP)
      store.awardXP(xpResult.cappedXP)
      console.log('[Gamification] After XP award - Total XP:', useGamificationStore.getState().totalXP)

      // 3. Increment session count (for achievements)
      store.incrementSessionCount()

      // 4. Check streak eligibility (≥10 XP from config)
      // Only increment streak if it's a new day (to prevent multiple sessions same day counting as multiple streaks)
      if (xpResult.cappedXP >= streakConfig.minXPForStreak) {
        const today = new Date().toDateString()
        const lastActivityDay = store.lastActivityDate ? new Date(store.lastActivityDate).toDateString() : null

        if (today !== lastActivityDay) {
          // New day! Increment streak
          // Note: incrementStreak is now async in Firebase-first mode
          await store.incrementStreak()
        }
        // Same day as last activity - don't increment streak, but update lastActivityDate
        else {
          // Just update the activity timestamp without incrementing streak
          store.awardXP(0) // This updates lastActivityDate without adding XP
        }
      }

      // 5. Check achievement conditions
      // CRITICAL: Get fresh store reference AFTER state updates
      const freshStore = useGamificationStore.getState()
      const unlockedAchievements = await this.checkAchievements(statistics, freshStore)

      // 6. Emit gamification events for UI
      this.emit('xp.awarded', {
        sessionId,
        xp: xpResult.cappedXP,
        breakdown: xpResult.bonuses
      })

      if (unlockedAchievements.length > 0) {
        unlockedAchievements.forEach(achievement => {
          this.emit('achievement.unlocked', achievement)
        })
      }

      console.log('[Gamification] Session processed:', {
        sessionId,
        xp: xpResult.cappedXP,
        achievements: unlockedAchievements.length
      })

      // 7. Sync to Firebase for premium users (async, don't block UI)
      // This ensures gamification data persists across devices for premium users
      // Free users will continue using IndexedDB only (offline-first)
      const finalStore = useGamificationStore.getState()
      finalStore.syncToFirebase().catch(err => {
        console.error('[Gamification] Failed to sync to Firebase (will retry later):', err)
        // Don't throw - IndexedDB save already succeeded, Firebase is just backup for premium
      })
    } catch (error) {
      console.error('[Gamification] Error handling session completion:', error)
    }
  }

  /**
   * Handle individual item answers (for real-time streak tracking)
   */
  private handleItemAnswered(event: any): void {
    if (!this.isEnabled) return
    // Optional: Track for real-time updates
    // For now, streaks are tracked in session statistics
  }

  /**
   * Calculate XP from session statistics
   * Applies config-driven bonuses (NO hardcoded values!)
   */
  private calculateXP(statistics: any): XPCalculationResult {
    // Base XP: correct answers × base XP per answer (from config)
    const baseXP = statistics.correctItems * xpConfig.baseXP

    const bonuses: XPCalculationResult['bonuses'] = {}

    // Accuracy bonus (iterate tiers from highest to lowest)
    for (const tier of xpConfig.bonuses.accuracy) {
      if (statistics.accuracy >= tier.threshold) {
        bonuses.accuracy = Math.round(baseXP * (tier.multiplier - 1))
        break
      }
    }

    // Speed bonus (average response time)
    if (statistics.averageResponseTime < xpConfig.bonuses.speed.thresholdMs) {
      bonuses.speed = xpConfig.bonuses.speed.bonus
    }

    // Streak bonus (within-session streak)
    if (statistics.bestStreak >= xpConfig.bonuses.streak.minStreak) {
      const streakBonus = statistics.bestStreak * xpConfig.bonuses.streak.bonusPerItem
      bonuses.streak = Math.min(
        streakBonus,
        xpConfig.bonuses.streak.maxBonus || 999999
      )
    }

    // Calculate total
    const bonusTotal = Object.values(bonuses).reduce((sum, val) => sum + (val || 0), 0)
    const totalXP = baseXP + bonusTotal

    // Apply daily XP cap (from config)
    const cappedXP = Math.min(totalXP, xpConfig.dailyXPCap)

    return {
      baseXP,
      bonuses,
      totalXP,
      cappedXP
    }
  }

  /**
   * Check which achievements should be unlocked
   */
  private async checkAchievements(statistics: any, store: any): Promise<any[]> {
    const unlocked: any[] = []

    for (const achievement of achievementsConfig.achievements) {
      // Skip already unlocked
      if (store.unlockedAchievements.includes(achievement.id)) {
        continue
      }

      // Evaluate condition
      const isMet = this.evaluateCondition(achievement.condition, statistics, store)

      if (isMet) {
        store.unlockAchievement(achievement.id)
        unlocked.push(achievement)
      }
    }

    return unlocked
  }

  /**
   * Evaluate achievement condition
   */
  private evaluateCondition(condition: any, statistics: any, store: any): boolean {
    const { type, operator, value } = condition

    let currentValue: number

    // Get current value based on condition type
    switch (type) {
      case 'session_count':
        currentValue = store.sessionCount || 0
        break
      case 'streak':
        currentValue = store.currentStreak
        break
      case 'best_streak':
        currentValue = statistics.bestStreak
        break
      case 'level':
        currentValue = store.currentLevel
        break
      case 'kanji_learned':
        // TODO: Integrate with kanji progress tracker
        currentValue = 0
        break
      case 'speed_reviews':
        // TODO: Track count of fast reviews
        currentValue = 0
        break
      case 'time_of_day':
        currentValue = new Date().getHours()
        break
      default:
        return false
    }

    // Apply operator
    switch (operator) {
      case '>=':
        return currentValue >= value
      case '>':
        return currentValue > value
      case '<=':
        return currentValue <= value
      case '<':
        return currentValue < value
      case '==':
        return currentValue === value
      default:
        return false
    }
  }

  /**
   * Clean up and remove event listeners
   */
  destroy(): void {
    this.removeAllListeners()
    this.userId = null
    this.isEnabled = false
    console.log('[Gamification] Listener destroyed')
  }
}

// Singleton instance
export const gamificationListener = new GamificationListener()
