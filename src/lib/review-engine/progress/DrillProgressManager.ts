/**
 * Drill Progress Manager
 * Extends UniversalProgressManager to track drill-specific progress
 */

import { UniversalProgressManager } from './UniversalProgressManager'
import { ReviewProgressData, ProgressEvent, ProgressStatus } from '../core/progress.types'
import { reviewLogger } from '@/lib/monitoring/logger'

/**
 * Drill-specific progress data
 */
export interface DrillProgressData extends ReviewProgressData {
  drillType: 'conjugation' | 'vocabulary' | 'mixed'
  verbsStudied: Set<string>
  adjectivesStudied: Set<string>
  totalDrills: number
  perfectDrills: number
  averageAccuracy: number
  bestStreak: number
  conjugationTypes: Map<string, number> // Track which conjugations are practiced
}

/**
 * Drill session data for tracking
 */
export interface DrillSessionData {
  sessionId: string
  userId: string
  startedAt: Date
  completedAt?: Date
  questions: number
  correctAnswers: number
  accuracy: number
  mode: string
  wordTypeFilter: string
  verbsPracticed: string[]
  adjectivesPracticed: string[]
  conjugationTypes: string[]
}

/**
 * Manager for drill-specific progress tracking
 */
export class DrillProgressManager extends UniversalProgressManager<DrillProgressData> {
  private static instance: DrillProgressManager | null = null

  private constructor() {
    super()
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DrillProgressManager {
    if (!DrillProgressManager.instance) {
      DrillProgressManager.instance = new DrillProgressManager()
    }
    return DrillProgressManager.instance
  }

  /**
   * Initialize drill progress for a user
   */
  async initializeDrillProgress(userId: string): Promise<void> {
    await this.initDB()

    const existingProgress = await this.getProgress('drill', 'overall', userId, false)

    if (!existingProgress) {
      const initialData: DrillProgressData = {
        status: 'not-started',
        lastReviewedAt: null,
        reviewCount: 0,
        correctCount: 0,
        accuracy: 0,
        drillType: 'conjugation',
        verbsStudied: new Set(),
        adjectivesStudied: new Set(),
        totalDrills: 0,
        perfectDrills: 0,
        averageAccuracy: 0,
        bestStreak: 0,
        conjugationTypes: new Map()
      }

      await this.saveProgress('drill', 'overall', userId, initialData, false)
    }
  }

  /**
   * Track a completed drill session
   */
  async trackDrillSession(
    session: DrillSessionData,
    user: any,
    isPremium: boolean
  ): Promise<void> {
    if (!user?.uid) {
      reviewLogger.debug('[DrillProgressManager] No user - skipping tracking')
      return
    }

    const userId = user.uid
    await this.initDB()

    // Get current progress
    const currentProgress = await this.getProgress('drill', 'overall', userId, isPremium)
    const drillData = currentProgress as DrillProgressData || {
      status: 'learning',
      lastReviewedAt: null,
      reviewCount: 0,
      correctCount: 0,
      accuracy: 0,
      drillType: 'conjugation',
      verbsStudied: new Set(),
      adjectivesStudied: new Set(),
      totalDrills: 0,
      perfectDrills: 0,
      averageAccuracy: 0,
      bestStreak: 0,
      conjugationTypes: new Map()
    }

    // Update drill statistics
    drillData.totalDrills += 1
    drillData.reviewCount += session.questions
    drillData.correctCount += session.correctAnswers
    drillData.lastReviewedAt = session.completedAt || new Date()

    // Update accuracy (weighted average)
    const totalAnswers = drillData.reviewCount
    drillData.accuracy = (drillData.correctCount / totalAnswers) * 100
    drillData.averageAccuracy = drillData.accuracy

    // Track perfect sessions
    if (session.accuracy === 100) {
      drillData.perfectDrills += 1
    }

    // Track studied words
    session.verbsPracticed.forEach(verb => {
      drillData.verbsStudied.add(verb)
    })
    session.adjectivesPracticed.forEach(adj => {
      drillData.adjectivesStudied.add(adj)
    })

    // Track conjugation types
    session.conjugationTypes.forEach(type => {
      const count = drillData.conjugationTypes.get(type) || 0
      drillData.conjugationTypes.set(type, count + 1)
    })

    // Update status based on total drills
    if (drillData.totalDrills >= 100) {
      drillData.status = 'mastered'
    } else if (drillData.totalDrills >= 50) {
      drillData.status = 'learned'
    } else if (drillData.totalDrills >= 10) {
      drillData.status = 'learning'
    }

    // Save updated progress
    await this.saveProgress('drill', 'overall', userId, drillData, isPremium)

    // Track individual session for history
    await this.trackProgress(
      'drill',
      session.sessionId,
      ProgressEvent.COMPLETED,
      user,
      isPremium,
      {
        score: session.accuracy,
        questionsAnswered: session.questions,
        correctAnswers: session.correctAnswers,
        mode: session.mode
      }
    )

    // Emit events for achievements
    this.emit('drill.session.completed', {
      userId,
      session,
      totalDrills: drillData.totalDrills,
      perfectDrills: drillData.perfectDrills,
      averageAccuracy: drillData.averageAccuracy
    })

    reviewLogger.info('[DrillProgressManager] Drill session tracked', {
      userId,
      sessionId: session.sessionId,
      accuracy: session.accuracy,
      totalDrills: drillData.totalDrills
    })
  }

  /**
   * Get drill statistics for a user
   */
  async getDrillStats(userId: string, isPremium: boolean): Promise<DrillProgressData | null> {
    await this.initDB()
    const progress = await this.getProgress('drill', 'overall', userId, isPremium)
    return progress as DrillProgressData
  }

  /**
   * Get recent drill sessions
   */
  async getRecentSessions(
    userId: string,
    limit: number = 10
  ): Promise<DrillSessionData[]> {
    if (!this.db) await this.initDB()

    try {
      const tx = this.db!.transaction('sessions', 'readonly')
      const store = tx.objectStore('sessions')
      const index = store.index('by-user')

      const sessions: DrillSessionData[] = []
      const cursor = await index.openCursor(userId)

      let count = 0
      while (cursor && count < limit) {
        const session = cursor.value.data as any
        if (session.sessionType === 'drill') {
          sessions.push(session)
          count++
        }
        await cursor.continue()
      }

      return sessions
    } catch (error) {
      reviewLogger.error('[DrillProgressManager] Failed to get recent sessions:', error)
      return []
    }
  }

  /**
   * Calculate drill mastery level
   */
  calculateMasteryLevel(data: DrillProgressData): number {
    let score = 0

    // Factor 1: Total drills completed (max 30 points)
    score += Math.min(30, data.totalDrills * 0.3)

    // Factor 2: Average accuracy (max 40 points)
    score += (data.averageAccuracy / 100) * 40

    // Factor 3: Perfect drills ratio (max 20 points)
    const perfectRatio = data.totalDrills > 0 ? data.perfectDrills / data.totalDrills : 0
    score += perfectRatio * 20

    // Factor 4: Variety of words studied (max 10 points)
    const totalWords = data.verbsStudied.size + data.adjectivesStudied.size
    score += Math.min(10, totalWords * 0.1)

    return Math.round(score)
  }

  /**
   * Reset drill progress (for testing)
   */
  async resetDrillProgress(userId: string): Promise<void> {
    await this.initDB()
    await this.saveProgress('drill', 'overall', userId, {
      status: 'not-started',
      lastReviewedAt: null,
      reviewCount: 0,
      correctCount: 0,
      accuracy: 0,
      drillType: 'conjugation',
      verbsStudied: new Set(),
      adjectivesStudied: new Set(),
      totalDrills: 0,
      perfectDrills: 0,
      averageAccuracy: 0,
      bestStreak: 0,
      conjugationTypes: new Map()
    } as DrillProgressData, false)
  }
}

// Export singleton instance
export const drillProgressManager = DrillProgressManager.getInstance()