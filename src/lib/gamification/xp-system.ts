/**
 * XP System
 * Experience points and leveling system for gamification
 */

import { EventEmitter } from 'events'
import { ReviewSession } from '@/lib/review-engine/core/session.types'
import { Achievement } from '@/lib/review-engine/progress/achievement-system'

export interface XPEvent {
  type: 'review_completed' | 'achievement_unlocked' | 'streak_bonus' | 'perfect_session' | 'speed_bonus' | 'daily_bonus'
  xpGained: number
  source: string
  timestamp: Date
  metadata?: any
}

export interface LevelData {
  level: number
  title: string
  minXP: number
  maxXP: number
  icon: string
  color: string
  perks: string[]
  badge?: string
}

export interface UserLevel {
  currentLevel: number
  currentXP: number
  xpToNextLevel: number
  progressPercentage: number
  title: string
  nextLevelTitle: string
  totalXP: number
  rank: number // Global rank based on XP
  recentXPEvents: XPEvent[]
}

export class XPSystem extends EventEmitter {
  private readonly BASE_XP = 100 // Base XP for level 1
  private readonly XP_MULTIPLIER = 1.5 // Exponential growth factor
  private readonly LEVELS: LevelData[] = []

  constructor() {
    super()
    this.initializeLevels()
  }

  /**
   * Initialize level definitions
   */
  private initializeLevels(): void {
    const levelDefinitions = [
      { level: 1, title: 'Beginner', icon: '🌱', color: 'gray', badge: '🥉' },
      { level: 5, title: 'Novice', icon: '📚', color: 'green', badge: '🥉' },
      { level: 10, title: 'Apprentice', icon: '🎓', color: 'blue', badge: '🥈' },
      { level: 15, title: 'Student', icon: '📖', color: 'blue', badge: '🥈' },
      { level: 20, title: 'Scholar', icon: '🎯', color: 'purple', badge: '🥈' },
      { level: 25, title: 'Adept', icon: '⭐', color: 'purple', badge: '🥇' },
      { level: 30, title: 'Expert', icon: '💫', color: 'orange', badge: '🥇' },
      { level: 35, title: 'Master', icon: '🏆', color: 'orange', badge: '🏅' },
      { level: 40, title: 'Grandmaster', icon: '👑', color: 'red', badge: '🏅' },
      { level: 45, title: 'Sensei', icon: '🥋', color: 'red', badge: '💎' },
      { level: 50, title: 'Legend', icon: '🌟', color: 'gold', badge: '👑' },
      { level: 60, title: 'Mythic', icon: '🔥', color: 'gold', badge: '🔥' },
      { level: 70, title: 'Eternal', icon: '♾️', color: 'rainbow', badge: '🌈' },
      { level: 80, title: 'Transcendent', icon: '🌌', color: 'cosmic', badge: '✨' },
      { level: 90, title: 'Divine', icon: '⚡', color: 'divine', badge: '⚡' },
      { level: 100, title: 'Kami', icon: '🗾', color: 'legendary', badge: '🗾' }
    ]

    // Generate all 100 levels
    for (let level = 1; level <= 100; level++) {
      const definition = levelDefinitions.findLast(d => level >= d.level) || levelDefinitions[0]

      const xpRequired = this.calculateXPForLevel(level)
      const nextLevelXP = this.calculateXPForLevel(level + 1)

      this.LEVELS.push({
        level,
        title: `${definition.title} ${this.getRomanNumeral(level - definition.level + 1)}`,
        minXP: xpRequired,
        maxXP: nextLevelXP,
        icon: definition.icon,
        color: definition.color,
        badge: definition.badge,
        perks: this.getPerksForLevel(level)
      })
    }
  }

  /**
   * Calculate total XP required for a level
   */
  calculateXPForLevel(level: number): number {
    if (level <= 1) return 0

    // Exponential growth formula: XP = BASE * (MULTIPLIER ^ (level - 1))
    // With adjustments for smoother progression
    let totalXP = 0
    for (let l = 1; l < level; l++) {
      const xpForThisLevel = Math.floor(
        this.BASE_XP * Math.pow(this.XP_MULTIPLIER, Math.sqrt(l))
      )
      totalXP += xpForThisLevel
    }
    return totalXP
  }

  /**
   * Calculate level from total XP
   */
  getLevelFromXP(totalXP: number): number {
    let level = 1
    while (level < 100 && this.calculateXPForLevel(level + 1) <= totalXP) {
      level++
    }
    return level
  }

  /**
   * Get user level data
   */
  getUserLevel(totalXP: number): UserLevel {
    const currentLevel = this.getLevelFromXP(totalXP)
    const levelData = this.LEVELS[currentLevel - 1]
    const nextLevelData = currentLevel < 100 ? this.LEVELS[currentLevel] : null

    const xpForCurrentLevel = levelData.minXP
    const xpForNextLevel = nextLevelData ? nextLevelData.minXP : levelData.maxXP
    const xpProgress = totalXP - xpForCurrentLevel
    const xpNeeded = xpForNextLevel - xpForCurrentLevel

    return {
      currentLevel,
      currentXP: xpProgress,
      xpToNextLevel: xpNeeded - xpProgress,
      progressPercentage: (xpProgress / xpNeeded) * 100,
      title: levelData.title.replace(/\s+[IVXLCDM]+$/, ''), // Remove roman numerals
      nextLevelTitle: nextLevelData ? nextLevelData.title.replace(/\s+[IVXLCDM]+$/, '') : 'Max Level',
      totalXP,
      rank: 0, // This would be calculated from leaderboard position
      recentXPEvents: []
    }
  }

  /**
   * Calculate XP from review session
   */
  calculateSessionXP(session: ReviewSession): number {
    let xp = 0

    // Base XP for completion
    if (session.status === 'completed') {
      xp += 50

      // Accuracy bonus
      if (session.stats) {
        const accuracy = session.stats.accuracy || 0
        if (accuracy === 100) {
          xp += 100 // Perfect session bonus
        } else if (accuracy >= 90) {
          xp += 50
        } else if (accuracy >= 80) {
          xp += 25
        } else if (accuracy >= 70) {
          xp += 10
        }

        // Speed bonus
        const avgTime = session.stats.avgResponseTime || 0
        if (avgTime < 2000) {
          xp += 30 // Very fast
        } else if (avgTime < 3000) {
          xp += 20 // Fast
        } else if (avgTime < 5000) {
          xp += 10 // Normal
        }

        // Quantity bonus
        const itemCount = session.stats.totalAnswered || 0
        xp += Math.min(itemCount * 2, 100) // 2 XP per item, max 100

        // No hints bonus
        if (!session.stats.hintsUsed || session.stats.hintsUsed === 0) {
          xp += 25
        }
      }
    } else {
      // Partial XP for incomplete sessions
      const completionRate = session.currentIndex / session.items.length
      xp = Math.floor(25 * completionRate)
    }

    return xp
  }

  /**
   * Calculate XP from achievement unlock
   */
  calculateAchievementXP(achievement: Achievement): number {
    const rarityXP = {
      common: 25,
      uncommon: 50,
      rare: 100,
      epic: 200,
      legendary: 500
    }

    return rarityXP[achievement.rarity as keyof typeof rarityXP] || 25
  }

  /**
   * Calculate streak bonus XP
   */
  calculateStreakBonus(streak: number): number {
    if (streak < 3) return 0
    if (streak < 7) return 10
    if (streak < 14) return 25
    if (streak < 30) return 50
    if (streak < 60) return 75
    if (streak < 100) return 100
    return 150
  }

  /**
   * Award XP to user
   */
  async awardXP(
    userId: string,
    amount: number,
    type: XPEvent['type'],
    source: string,
    metadata?: any
  ): Promise<XPEvent> {
    const event: XPEvent = {
      type,
      xpGained: amount,
      source,
      timestamp: new Date(),
      metadata
    }

    // Emit XP gained event
    this.emit('xp.gained', {
      userId,
      event,
      amount
    })

    // Check for level up
    const oldTotalXP = await this.getUserTotalXP(userId)
    const newTotalXP = oldTotalXP + amount
    const oldLevel = this.getLevelFromXP(oldTotalXP)
    const newLevel = this.getLevelFromXP(newTotalXP)

    if (newLevel > oldLevel) {
      const levelData = this.LEVELS[newLevel - 1]
      this.emit('level.up', {
        userId,
        oldLevel,
        newLevel,
        levelData,
        totalXP: newTotalXP
      })

      // Award bonus XP for leveling up
      const levelUpBonus = newLevel * 10
      await this.awardXP(
        userId,
        levelUpBonus,
        'achievement_unlocked',
        `Level ${newLevel} reached!`,
        { levelUp: true }
      )
    }

    return event
  }

  /**
   * Get user's total XP (would connect to storage)
   */
  private async getUserTotalXP(userId: string): Promise<number> {
    // This would fetch from database/storage
    // For now, return from localStorage
    const stored = localStorage.getItem(`xp_${userId}`)
    return stored ? parseInt(stored) : 0
  }

  /**
   * Get perks for a level
   */
  private getPerksForLevel(level: number): string[] {
    const perks: string[] = []

    if (level >= 5) perks.push('Custom avatars')
    if (level >= 10) perks.push('Profile badges')
    if (level >= 15) perks.push('Streak shields')
    if (level >= 20) perks.push('XP multiplier +10%')
    if (level >= 25) perks.push('Exclusive themes')
    if (level >= 30) perks.push('Priority support')
    if (level >= 35) perks.push('Beta features')
    if (level >= 40) perks.push('XP multiplier +20%')
    if (level >= 50) perks.push('Custom card backs')
    if (level >= 60) perks.push('Legendary status')
    if (level >= 70) perks.push('XP multiplier +30%')
    if (level >= 80) perks.push('Exclusive content')
    if (level >= 90) perks.push('Master trainer role')
    if (level >= 100) perks.push('Kami privileges')

    return perks
  }

  /**
   * Convert number to roman numeral
   */
  private getRomanNumeral(num: number): string {
    if (num <= 0 || num > 10) return ''

    const numerals = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
    return numerals[num]
  }

  /**
   * Get level badge/icon
   */
  getLevelBadge(level: number): string {
    const levelData = this.LEVELS[level - 1]
    return levelData?.badge || levelData?.icon || '🎯'
  }

  /**
   * Get level color for UI
   */
  getLevelColor(level: number): string {
    const levelData = this.LEVELS[level - 1]
    const colors: Record<string, string> = {
      gray: 'from-gray-400 to-gray-600',
      green: 'from-green-400 to-green-600',
      blue: 'from-blue-400 to-blue-600',
      purple: 'from-purple-400 to-purple-600',
      orange: 'from-orange-400 to-orange-600',
      red: 'from-red-400 to-red-600',
      gold: 'from-yellow-400 to-amber-500',
      rainbow: 'from-red-400 via-yellow-400 to-blue-400',
      cosmic: 'from-purple-600 via-pink-500 to-blue-600',
      divine: 'from-yellow-300 via-orange-400 to-red-500',
      legendary: 'from-yellow-400 via-red-500 to-purple-600'
    }
    return colors[levelData?.color || 'gray'] || colors.gray
  }

  /**
   * Get XP multiplier for level
   */
  getXPMultiplier(level: number): number {
    if (level < 20) return 1.0
    if (level < 40) return 1.1
    if (level < 70) return 1.2
    return 1.3
  }
}

// Export singleton instance
export const xpSystem = new XPSystem()