/**
 * Gamification Listener Service
 * Event-driven gamification system that listens to URE events
 *
 * Firebase-First Unified Architecture:
 * - URE emits: SESSION_COMPLETED, ITEM_ANSWERED, PROGRESS_UPDATED
 * - This service listens to those events (read-only)
 * - Calls server-side API: POST /api/review/session/complete
 * - Server uses gamification-coordinator for atomic transactions
 * - Updates Zustand store with server response
 * - Firebase is single source of truth
 * - ZERO modifications to URE code
 *
 * Pathway:
 * URE → gamificationListener → API → coordinator → Firebase → Zustand store
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
   * Handle URE session completion - Firebase-first unified pathway
   *
   * Architecture:
   * - URE emits SESSION_COMPLETED event
   * - Calls POST /api/review/session/complete
   * - Server uses gamification-coordinator for atomic transaction
   * - Updates Zustand store with server response
   * - Firebase is single source of truth
   */
  private async handleSessionCompleted(event: any): Promise<void> {
    console.log('🎯 [Gamification] handleSessionCompleted called')
    console.log('🎯 [Gamification] isEnabled:', this.isEnabled)

    if (!this.isEnabled) {
      console.log('⏭️ [Gamification] Feature disabled, skipping')
      return
    }

    try {
      // Event emitter passes the data object directly as the event parameter
      // The event structure is: { data: { sessionId, statistics, duration } }
      const payload = event.data || event as SessionCompletedPayload
      const { sessionId, statistics, duration } = payload

      console.log('📥 [Gamification] Received event:', event)
      console.log('📥 [Gamification] Processing session:', sessionId, statistics)

      // Calculate metrics from statistics
      // Flashcards use itemsReviewed, URE uses totalItems
      const itemsReviewed = statistics.itemsReviewed || statistics.totalItems || 0;
      const correctCount = statistics.correctItems || 0;
      const accuracy = itemsReviewed > 0 ? (correctCount / itemsReviewed) * 100 : 0;

      console.log('🌐 [Gamification] Calling server API with:', {
        sessionId,
        itemsReviewed,
        correctCount,
        accuracy
      });

      // Call server-side API using session cookies (no Bearer token needed)
      const response = await fetch('/api/review/session/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Send session cookies
        body: JSON.stringify({
          sessionId,
          itemsReviewed,
          correctCount,
          accuracy
        })
      });

      console.log('📡 [Gamification] API response status:', response.status, response.statusText)

      if (!response.ok) {
        throw new Error(`Gamification API failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('📦 [Gamification] API result:', result)

      if (!result.success || !result.gamification) {
        throw new Error('Invalid gamification response');
      }

      const gam = result.gamification;

      console.log('✨ [Gamification] Server response:', gam);

      // Update Zustand store with server response (Firebase is source of truth)
      const store = useGamificationStore.getState();
      console.log('💾 [Gamification] Updating store from server...')
      store.updateFromServer({
        totalXP: gam.newTotalXP,
        currentLevel: gam.newLevel,
        currentStreak: gam.currentStreak,
        bestStreak: gam.bestStreak
      });

      // Always set lastSessionStats so celebrations can trigger every session.
      // Feature components can still overwrite with richer stats if needed.
      console.log('📊 [Gamification] Setting lastSessionStats from listener...')
      store.setLastSessionStats({
        itemsCompleted: itemsReviewed,
        accuracy: accuracy,
        duration: duration || 0,
        xpGained: gam.xpEarned
      });

      // Increment session count (triggers CelebrationProvider)
      console.log('🎉 [Gamification] Incrementing session count (this triggers celebration)...')
      store.incrementSessionCount();

      // Handle achievement unlocks if any
      if (gam.achievementsUnlocked && gam.achievementsUnlocked.length > 0) {
        gam.achievementsUnlocked.forEach((achievementId: string) => {
          store.unlockAchievement(achievementId);
        });
      }

      // Emit gamification events for UI
      this.emit('xp.awarded', {
        sessionId,
        xp: gam.xpEarned,
        breakdown: { total: gam.xpEarned }
      });

      if (gam.streakIncremented) {
        this.emit('streak.incremented', {
          current: gam.currentStreak,
          best: gam.bestStreak
        });
      }

      if (gam.achievementsUnlocked && gam.achievementsUnlocked.length > 0) {
        gam.achievementsUnlocked.forEach((achievementId: string) => {
          this.emit('achievement.unlocked', { id: achievementId });
        });
      }

      console.log('✅ [Gamification] Session processed successfully via server:', {
        sessionId,
        xpEarned: gam.xpEarned,
        streakIncremented: gam.streakIncremented,
        achievements: gam.achievementsUnlocked?.length || 0
      })
      console.log('🎊 [Gamification] Celebration should trigger now!')
    } catch (error) {
      console.error('❌ [Gamification] Error handling session completion:', error)
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
