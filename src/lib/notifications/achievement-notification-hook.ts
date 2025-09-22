/**
 * Achievement Notification Hook
 * Integrates with the achievement system to send notifications
 */

import { EventEmitter } from 'events'
import { notificationService } from './notification-service'

export class AchievementNotificationHook {
  private achievementSystem: EventEmitter
  private userId: string

  constructor(achievementSystem: EventEmitter, userId: string) {
    this.achievementSystem = achievementSystem
    this.userId = userId
    this.setupListeners()
  }

  private setupListeners(): void {
    // Listen for achievement unlock events
    this.achievementSystem.on('achievementUnlocked', async (achievement: any) => {
      console.log(`[AchievementHook] Achievement unlocked: ${achievement.id} for user ${this.userId}`)

      try {
        // Send notification asynchronously
        await notificationService.sendAchievementAlert(this.userId, achievement.id)
        console.log(`[AchievementHook] Notification sent for achievement: ${achievement.id}`)
      } catch (error) {
        console.error(`[AchievementHook] Failed to send notification:`, error)
        // Don't throw - we don't want notification failures to break the achievement system
      }
    })

    // Listen for milestone events
    this.achievementSystem.on('milestoneReached', async (milestone: any) => {
      console.log(`[AchievementHook] Milestone reached: ${milestone.type} for user ${this.userId}`)

      // You can add special milestone notifications here
      // For example, sending a special email for 100-day streaks, etc.
    })
  }

  /**
   * Clean up listeners when no longer needed
   */
  destroy(): void {
    this.achievementSystem.removeAllListeners('achievementUnlocked')
    this.achievementSystem.removeAllListeners('milestoneReached')
  }
}

/**
 * Factory function to create and attach notification hook
 */
export function attachAchievementNotifications(
  achievementSystem: EventEmitter,
  userId: string
): AchievementNotificationHook {
  return new AchievementNotificationHook(achievementSystem, userId)
}