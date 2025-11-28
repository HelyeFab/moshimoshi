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
 * Per-question answer result (for SRS tracking)
 */
export interface QuestionAnswerResult {
  questionId: string
  wordId: string
  targetForm: string
  correct: boolean
  userAnswer: string
  correctAnswer: string
  responseTime: number
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
  questionResults?: QuestionAnswerResult[] // NEW: For SRS tracking
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

    // 🔥 FIX: Call the API to properly complete the drill session
    // This updates Firebase drill_sessions collection and triggers gamification (XP + streak)
    // NEW: Also sends questionResults for SRS tracking
    try {
      const response = await fetch('/api/drill/session', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          action: 'complete',
          finalScore: session.correctAnswers,
          accuracy: session.accuracy,
          questionResults: session.questionResults // NEW: For SRS tracking
        })
      })

      if (response.ok) {
        const result = await response.json()

        // Log gamification results if present (streak/XP only)
        if (result.data?.gamification) {
          console.log('[DrillProgressManager] 🎉 Gamification results:', {
            xpEarned: result.data.gamification.xpEarned,
            streakIncremented: result.data.gamification.streakIncremented,
            currentStreak: result.data.gamification.currentStreak
          })
        }
      } else {
        console.error('[DrillProgressManager] Failed to complete drill via API:', await response.text())
      }
    } catch (error) {
      console.error('[DrillProgressManager] Error calling drill completion API:', error)
      // Continue with local tracking even if API fails
    }

    // Get current progress
    const progressMap = await this.getProgress(userId, 'drill', isPremium)
    const currentProgress = progressMap?.get('overall')

    // Initialize with defaults or convert loaded data
    let drillData: DrillProgressData

    if (currentProgress) {
      // Convert serialized data back to proper types
      const raw = currentProgress as any
      drillData = {
        ...raw,
        // Convert arrays/objects back to Set/Map
        verbsStudied: new Set(raw.verbsStudied || []),
        adjectivesStudied: new Set(raw.adjectivesStudied || []),
        conjugationTypes: new Map(Object.entries(raw.conjugationTypes || {}))
      } as DrillProgressData
    } else {
      // Create initial data
      drillData = {
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
      } as DrillProgressData
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

    // Convert Sets and Maps to serializable formats before saving
    const serializableData = {
      ...drillData,
      verbsStudied: Array.from(drillData.verbsStudied),
      adjectivesStudied: Array.from(drillData.adjectivesStudied),
      conjugationTypes: Object.fromEntries(drillData.conjugationTypes)
    }

    // Save updated progress
    // saveProgress(userId, contentType, contentId, progress, isPremium)
    await this.saveProgress(userId, 'drill', 'overall', serializableData as any, isPremium)

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

    // Note: Gamification events are emitted by the drill page component
    // No need to emit here since we're using URE event system

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

    // Premium users: Load from Firebase first for cross-device sync
    // This ensures stats are consistent across devices
    if (isPremium) {
      try {
        const cloudData = await this.loadFromFirebase(userId, 'drill')

        if (cloudData && cloudData.size > 0) {
          const progress = cloudData.get('overall')
          if (progress) {
            // Convert serialized data back to proper types
            const raw = progress as any
            return {
              ...raw,
              verbsStudied: new Set(raw.verbsStudied || []),
              adjectivesStudied: new Set(raw.adjectivesStudied || []),
              conjugationTypes: new Map(Object.entries(raw.conjugationTypes || {}))
            } as DrillProgressData
          }
        }
      } catch (error) {
        console.warn('[DrillProgressManager] Firebase load failed, using IndexedDB fallback:', error)
      }
    }

    // Free users OR Firebase fallback: Load from IndexedDB
    const progressMap = await this.getProgress(userId, 'drill', isPremium)

    if (!progressMap || progressMap.size === 0) return null

    // Get the 'overall' drill stats from the map
    const progress = progressMap.get('overall')
    if (!progress) return null

    // Convert serialized data back to proper types
    const raw = progress as any
    return {
      ...raw,
      verbsStudied: new Set(raw.verbsStudied || []),
      adjectivesStudied: new Set(raw.adjectivesStudied || []),
      conjugationTypes: new Map(Object.entries(raw.conjugationTypes || {}))
    } as DrillProgressData
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

  // ============= SRS (Spaced Repetition System) Methods =============

  /**
   * Get ALL SRS data for a user's studied words
   * Returns a Map of wordId => WordSRSEntry
   */
  async getSRSData(userId: string, isPremium: boolean): Promise<Map<string, any>> {
    await this.initDB()

    // Load from appropriate storage
    const progressMap = await this.getProgress(userId, 'drill-srs', isPremium)

    if (!progressMap || progressMap.size === 0) {
      return new Map()
    }

    return progressMap
  }

  /**
   * Update SRS data for a single word after a review
   * Uses SM-2 algorithm to calculate next interval
   *
   * CLIENT-SIDE ONLY: This method uses IndexedDB
   * For server-side SRS updates, use the API route's direct Firebase write
   */
  async updateWordSRS(
    userId: string,
    wordId: string,
    word: any,
    correct: boolean,
    targetForm: string,
    responseTime: number,
    isPremium: boolean
  ): Promise<void> {
    // CLIENT-SIDE: Use IndexedDB
    await this.initDB()

    // Get existing SRS data
    const srsMap = await this.getSRSData(userId, isPremium)
    let wordEntry = srsMap.get(wordId)

    const now = new Date().toISOString()

    // Initialize if new word
    if (!wordEntry) {
      wordEntry = {
        wordId,
        word: {
          kanji: word.kanji,
          kana: word.kana,
          meaning: word.meaning || word.english,
          type: word.type,
          jlpt: word.jlpt
        },
        srsData: {
          interval: 1,
          easeFactor: 2.5,
          repetitions: 0,
          lastReviewedAt: null,
          nextReviewAt: this.calculateNextReviewDate(1),
          status: 'new' as const,
          lapses: 0
        },
        conjugationAccuracy: {},
        reviewHistory: [],
        leechScore: 0,
        firstSeenAt: now,
        lastReviewedAt: null,
        totalReviews: 0,
        version: 1,
        updatedAt: now
      }
    }

    // Update conjugation form accuracy
    if (!wordEntry.conjugationAccuracy[targetForm]) {
      wordEntry.conjugationAccuracy[targetForm] = {
        attempts: 0,
        correct: 0,
        lastAttempted: null,
        averageTime: 0
      }
    }

    const formAccuracy = wordEntry.conjugationAccuracy[targetForm]
    formAccuracy.attempts++
    if (correct) formAccuracy.correct++
    formAccuracy.lastAttempted = now
    formAccuracy.averageTime =
      (formAccuracy.averageTime * (formAccuracy.attempts - 1) + responseTime) / formAccuracy.attempts

    // Update review history (keep last 10)
    wordEntry.reviewHistory.push({
      timestamp: now,
      targetForm,
      correct,
      responseTime
    })
    if (wordEntry.reviewHistory.length > 10) {
      wordEntry.reviewHistory.shift()
    }

    // Update leech score
    if (!correct) {
      wordEntry.leechScore = Math.min(10, wordEntry.leechScore + 1)
    } else if (wordEntry.leechScore > 0) {
      wordEntry.leechScore = Math.max(0, wordEntry.leechScore - 0.5)
    }

    // Update SRS data using SM-2 algorithm
    wordEntry.srsData = this.calculateSM2(wordEntry.srsData, correct)
    wordEntry.lastReviewedAt = now
    wordEntry.totalReviews++
    wordEntry.updatedAt = now

    // Save updated data
    srsMap.set(wordId, wordEntry)
    await this.saveProgress(userId, 'drill-srs', wordId, wordEntry, isPremium)

    console.log(`[DrillProgressManager] SRS updated for ${wordId}:`, {
      status: wordEntry.srsData.status,
      interval: wordEntry.srsData.interval,
      nextReview: wordEntry.srsData.nextReviewAt,
      leechScore: wordEntry.leechScore
    })
  }

  /**
   * SM-2 algorithm implementation for SRS interval calculation
   * PUBLIC: Exported for use in API routes for server-side SRS calculations
   */
  public calculateSM2(currentSRS: any, correct: boolean): any {
    const newSRS = { ...currentSRS }

    if (correct) {
      // Correct answer
      if (newSRS.status === 'new') {
        newSRS.status = 'learning'
        newSRS.interval = 1
        newSRS.repetitions = 1
      } else if (newSRS.status === 'learning') {
        newSRS.repetitions++
        if (newSRS.repetitions >= 2) {
          newSRS.status = 'review'
          newSRS.interval = 3
        } else {
          newSRS.interval = 1
        }
      } else {
        // Review status
        newSRS.repetitions++
        newSRS.interval = Math.round(newSRS.interval * newSRS.easeFactor)

        // Check for mastery (21+ days with good accuracy)
        if (newSRS.interval >= 21 && newSRS.repetitions >= 5) {
          newSRS.status = 'mastered'
        }
      }

      // Increase ease factor slightly on correct
      newSRS.easeFactor = Math.min(2.5, newSRS.easeFactor + 0.1)
    } else {
      // Incorrect answer
      newSRS.lapses++
      newSRS.repetitions = 0
      newSRS.interval = 1
      newSRS.easeFactor = Math.max(1.3, newSRS.easeFactor - 0.2)

      // Demote status
      if (newSRS.status === 'mastered') {
        newSRS.status = 'review'
      } else if (newSRS.status === 'review') {
        newSRS.status = 'learning'
      }
    }

    // Calculate next review date
    newSRS.lastReviewedAt = new Date().toISOString()
    newSRS.nextReviewAt = this.calculateNextReviewDate(newSRS.interval)

    return newSRS
  }

  /**
   * Calculate next review date based on interval
   */
  public calculateNextReviewDate(intervalDays: number): string {
    const now = new Date()
    const next = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000)
    return next.toISOString()
  }

  /**
   * Get SRS statistics for dashboard display
   */
  async getSRSStats(userId: string, isPremium: boolean): Promise<any> {
    const srsData = await this.getSRSData(userId, isPremium)

    const stats = {
      totalWords: srsData.size,
      newWords: 0,
      learningWords: 0,
      reviewWords: 0,
      masteredWords: 0,
      dueToday: 0,
      dueThisWeek: 0,
      leechWords: 0,
      averageAccuracy: 0,
      totalReviews: 0
    }

    const now = new Date()
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    srsData.forEach(entry => {
      // Count by status
      switch (entry.srsData.status) {
        case 'new':
          stats.newWords++
          break
        case 'learning':
          stats.learningWords++
          break
        case 'review':
          stats.reviewWords++
          break
        case 'mastered':
          stats.masteredWords++
          break
      }

      // Count due words
      const nextReview = new Date(entry.srsData.nextReviewAt)
      if (nextReview <= now) {
        stats.dueToday++
      } else if (nextReview <= weekFromNow) {
        stats.dueThisWeek++
      }

      // Count leeches
      if (entry.leechScore >= 5) {
        stats.leechWords++
      }

      // Aggregate reviews
      stats.totalReviews += entry.totalReviews
    })

    // Calculate average accuracy
    if (stats.totalReviews > 0) {
      let totalCorrect = 0
      let totalAttempts = 0

      srsData.forEach(entry => {
        Object.values(entry.conjugationAccuracy).forEach((form: any) => {
          totalCorrect += form.correct
          totalAttempts += form.attempts
        })
      })

      stats.averageAccuracy = totalAttempts > 0
        ? Math.round((totalCorrect / totalAttempts) * 100)
        : 0
    }

    return stats
  }
}

// Note: Do NOT export an eagerly-instantiated singleton here.
// This class uses IndexedDB (via idb) which is browser-only.
// Server-side code (API routes) that imports this module would fail during build
// if we instantiate at module load time.
// Use DrillProgressManager.getInstance() when needed instead.