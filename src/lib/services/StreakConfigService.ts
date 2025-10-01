/**
 * StreakConfigService - Dynamic Streak Configuration
 *
 * This service determines which activities count towards streaks by
 * reading from the centralized xp-config.json file. This ensures that
 * streak logic and XP logic are always in sync.
 *
 * Key principle: Any activity that earns 10+ XP and has countsForStreak=true
 * will automatically count towards the user's daily streak.
 */

import xpConfig from '../../../config/xp-config.json'
import logger from '@/lib/logger'

export interface StreakEligibleActivity {
  id: string
  name: string
  description: string
  baseXP: number
  countsForStreak: boolean
  enabled: boolean
}

class StreakConfigService {
  private static instance: StreakConfigService
  private config = xpConfig
  private minXPForStreak: number

  private constructor() {
    this.minXPForStreak = this.config.minXPForStreak || 10
    logger.info('[StreakConfigService] Initialized', {
      minXPForStreak: this.minXPForStreak,
      version: this.config.version
    })
  }

  public static getInstance(): StreakConfigService {
    if (!StreakConfigService.instance) {
      StreakConfigService.instance = new StreakConfigService()
    }
    return StreakConfigService.instance
  }

  /**
   * Get the minimum XP required for an activity to count towards streaks
   */
  getMinXPForStreak(): number {
    return this.minXPForStreak
  }

  /**
   * Check if a specific activity counts towards streaks
   */
  countsForStreak(activityId: string): boolean {
    const activity = this.config.activities[activityId as keyof typeof this.config.activities]
    if (!activity) {
      logger.warn(`[StreakConfigService] Unknown activity: ${activityId}`)
      return false
    }

    return activity.enabled && activity.countsForStreak
  }

  /**
   * Check if XP amount and activity type qualify for streak update
   *
   * @param activityId - The activity identifier
   * @param xpEarned - Amount of XP earned
   * @returns true if this should count towards streak
   */
  shouldCountForStreak(activityId: string, xpEarned: number): boolean {
    // Must earn at least minimum XP
    if (xpEarned < this.minXPForStreak) {
      logger.debug('[StreakConfigService] XP too low for streak', {
        activityId,
        xpEarned,
        minRequired: this.minXPForStreak
      })
      return false
    }

    // Activity must be enabled and configured to count
    const counts = this.countsForStreak(activityId)

    if (!counts) {
      logger.debug('[StreakConfigService] Activity does not count for streak', {
        activityId
      })
    }

    return counts
  }

  /**
   * Get all activities that are eligible for streak counting
   */
  getEligibleActivities(): StreakEligibleActivity[] {
    return Object.values(this.config.activities)
      .filter(activity => activity.enabled && activity.countsForStreak)
      .map(activity => ({
        id: activity.id,
        name: activity.name,
        description: activity.description,
        baseXP: activity.baseXP,
        countsForStreak: activity.countsForStreak,
        enabled: activity.enabled
      })) as StreakEligibleActivity[]
  }

  /**
   * Get activity IDs that count for streaks (for backward compatibility)
   * Returns Set<string> to match old StreakActivity pattern
   */
  getEligibleActivityIds(): Set<string> {
    const activities = this.getEligibleActivities()
    return new Set(activities.map(a => a.id))
  }

  /**
   * Get human-readable list of activities that count for streaks
   * Useful for UI display
   */
  getEligibleActivityNames(): string[] {
    return this.getEligibleActivities().map(a => a.name)
  }

  /**
   * Get current configuration info (for debugging)
   */
  getConfigInfo() {
    const eligible = this.getEligibleActivities()

    return {
      version: this.config.version,
      minXPForStreak: this.minXPForStreak,
      totalActivities: Object.keys(this.config.activities).length,
      eligibleActivities: eligible.length,
      eligibleActivityIds: eligible.map(a => a.id),
      lastUpdated: this.config.lastUpdated
    }
  }
}

// Export singleton instance
export const streakConfigService = StreakConfigService.getInstance()