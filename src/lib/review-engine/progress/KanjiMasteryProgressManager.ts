import { UniversalProgressManager } from './UniversalProgressManager'
import { SessionState, KanjiProgress } from '@/app/[locale]/tools/kanji-mastery/learn/LearnContent'
import { kanjiMasteryDB, type KanjiSession, type KanjiProgressRecord, type KanjiStatistics, type SerializedSRSData } from '@/lib/kanji-mastery/kanjiMasteryDB'
import { AlgorithmFactory } from '@/lib/review-engine/srs/algorithm-factory'
import type { ReviewResult, ReviewableContentWithSRS, SRSData } from '@/lib/review-engine/srs'

// Simplified user type - only uid is needed for progress tracking
interface ProgressUser {
  uid: string
}

export interface KanjiMasterySession {
  sessionId: string
  userId: string
  startTime: Date
  endTime: Date
  level?: string
  kanji: Array<{
    id: string
    character: string
    rounds: {
      round1: boolean
      round2Accuracy: number
      round3Rating: number
    }
    finalScore: number
    nextReviewDate: string
    srsData?: SerializedSRSData
  }>
  sessionStats: {
    totalKanji: number
    perfectKanji: number
    reviewAgainCount: number
    averageAccuracy: number
    timeSpentSeconds: number
  }
}

export class KanjiMasteryProgressManager extends UniversalProgressManager {
  constructor() {
    super()
  }

  async trackSession(
    sessionState: SessionState,
    user: ProgressUser | null,
    isPremium: boolean
  ): Promise<KanjiMasterySession> {
    const endTime = new Date()
    const timeSpentSeconds = Math.round(
      (endTime.getTime() - sessionState.startTime.getTime()) / 1000
    )
    const averageResponseTimeMs = sessionState.kanji.length > 0
      ? Math.max(500, Math.round((timeSpentSeconds * 1000) / sessionState.kanji.length))
      : 1000

    // Calculate session statistics
    const sessionStats = this.calculateSessionStats(sessionState, timeSpentSeconds)

    const existingProgress = user
      ? sessionState.reviewOnly
        ? await kanjiMasteryDB.getProgressByUser(user.uid)
        : await kanjiMasteryDB.getProgressByUserAndLevel(user.uid, sessionState.level || '')
      : []
    const progressById = new Map(existingProgress.map(record => [record.kanjiId, record]))

    // Prepare session data
    const session: KanjiMasterySession = {
      sessionId: sessionState.sessionId,
      userId: user?.uid || 'guest',
      startTime: sessionState.startTime,
      endTime,
      level: sessionState.level,
      kanji: this.prepareKanjiData(sessionState, progressById, averageResponseTimeMs),
      sessionStats
    }

    // LWW (Last Write Wins) - Write to IndexedDB first for all users
    if (user) {
      await this.saveKanjiMasteryToIndexedDB(session, user, sessionState.reviewOnly)
    }

    // Queue Firebase sync for premium users only
    if (user && isPremium) {
      await this.queueKanjiMasteryFirebaseSync(session, user)
    }

    return session
  }

  private calculateSessionStats(sessionState: SessionState, timeSpentSeconds: number) {
    const totalKanji = sessionState.kanji.length
    let perfectKanji = 0
    let totalAccuracy = 0
    const reviewAgainCount = sessionState.reviewAgainPile.size

    sessionState.progress.forEach((progress) => {
      // Check if kanji was perfect (100% in round 2, high rating in round 3)
      if (progress.round2Accuracy === 1 && (progress.round3Rating || 0) >= 4) {
        perfectKanji++
      }
      totalAccuracy += progress.round2Accuracy
    })

    const averageAccuracy = totalKanji > 0 ? totalAccuracy / totalKanji : 0

    return {
      totalKanji,
      perfectKanji,
      reviewAgainCount,
      averageAccuracy,
      timeSpentSeconds
    }
  }

  private prepareKanjiData(
    sessionState: SessionState,
    progressById: Map<string, KanjiProgressRecord>,
    averageResponseTimeMs: number
  ) {
    const kanjiData: KanjiMasterySession['kanji'] = []

    sessionState.kanji.forEach((kanji) => {
      const progress = sessionState.progress.get(kanji.kanji)
      const existingProgress = progressById.get(kanji.kanji)
      const levelForProgress = sessionState.reviewOnly && existingProgress?.level
        ? existingProgress.level
        : sessionState.level

      if (progress) {
        const finalScore = this.calculateKanjiFinalScore(progress)
        const { srsData, nextReviewDate } = this.calculateSRSData({
          kanjiId: kanji.kanji,
          character: kanji.kanji,
          level: levelForProgress,
          accuracy: progress.round2Accuracy,
          rating: progress.round3Rating || 3,
          existingSrsData: existingProgress?.srsData,
          responseTimeMs: averageResponseTimeMs
        })

        kanjiData.push({
          id: kanji.kanji,
          character: kanji.kanji,
          rounds: {
            round1: progress.round1Completed,
            round2Accuracy: progress.round2Accuracy,
            round3Rating: progress.round3Rating || 0
          },
          finalScore,
          nextReviewDate,
          srsData
        })
      }
    })

    return kanjiData
  }

  private calculateKanjiFinalScore(progress: KanjiProgress): number {
    // Weighted average: Round 2 (60%), Round 3 self-assessment (40%)
    const round2Weight = 0.6
    const round3Weight = 0.4

    const round2Score = progress.round2Accuracy
    const round3Score = (progress.round3Rating || 3) / 5 // Normalize to 0-1

    return round2Score * round2Weight + round3Score * round3Weight
  }

  private calculateSRSData(options: {
    kanjiId: string
    character: string
    level?: string
    accuracy: number
    rating: number
    existingSrsData?: SerializedSRSData
    responseTimeMs: number
  }): { srsData: SerializedSRSData; nextReviewDate: string } {
    const {
      kanjiId,
      character,
      level,
      accuracy,
      rating,
      existingSrsData,
      responseTimeMs
    } = options

    const baseItem: ReviewableContentWithSRS = {
      id: kanjiId,
      contentType: 'kanji',
      primaryDisplay: character,
      primaryAnswer: character,
      difficulty: 0.5,
      tags: ['kanji_mastery', ...(level ? [`jlpt_${level.toLowerCase()}`] : [])],
      supportedModes: ['recognition', 'recall']
    }

    const initialSrs = existingSrsData
      ? this.deserializeSRSData(existingSrsData)
      : AlgorithmFactory.getDefault().initializeCardSRS(baseItem)

    const difficulty = this.mapPerformanceToDifficulty(accuracy, rating)
    const reviewResult: ReviewResult = {
      correct: difficulty !== 'again',
      responseTime: responseTimeMs,
      confidence: Math.max(1, Math.min(5, Math.round(rating))) as 1 | 2 | 3 | 4 | 5,
      difficulty
    }

    const algorithm = AlgorithmFactory.fromSRSData(initialSrs)
    const updatedSrs = algorithm.calculateNextReview(
      { ...baseItem, srsData: initialSrs },
      reviewResult
    )

    return {
      srsData: this.serializeSRSData(updatedSrs),
      nextReviewDate: updatedSrs.nextReviewAt.toISOString()
    }
  }

  private mapPerformanceToDifficulty(
    accuracy: number,
    rating: number
  ): 'again' | 'hard' | 'good' | 'easy' {
    const ratingScore = Math.max(0, Math.min(1, rating / 5))
    const combinedScore = Math.max(0, Math.min(1, accuracy * 0.7 + ratingScore * 0.3))

    if (combinedScore < 0.5) return 'again'
    if (combinedScore < 0.7) return 'hard'
    if (combinedScore < 0.85) return 'good'
    return 'easy'
  }

  private serializeSRSData(srsData: SRSData): SerializedSRSData {
    return {
      ...srsData,
      lastReviewedAt: srsData.lastReviewedAt ? srsData.lastReviewedAt.toISOString() : null,
      nextReviewAt: srsData.nextReviewAt.toISOString()
    }
  }

  private deserializeSRSData(srsData: SerializedSRSData): SRSData {
    return {
      ...srsData,
      lastReviewedAt: srsData.lastReviewedAt ? new Date(srsData.lastReviewedAt) : null,
      nextReviewAt: new Date(srsData.nextReviewAt)
    }
  }

  /**
   * IndexedDB-first: Write to local storage for ALL users
   * This runs BEFORE Firebase sync
   */
  private async saveKanjiMasteryToIndexedDB(
    session: KanjiMasterySession,
    user: ProgressUser,
    reviewOnly = false
  ): Promise<void> {
    try {
      // 1. Save session
      const sessionData: KanjiSession = {
        ...session,
        startTime: session.startTime.toISOString(),
        endTime: session.endTime.toISOString()
      }
      await kanjiMasteryDB.saveSession(sessionData)

      // 2. Save/update individual kanji progress
      for (const kanji of session.kanji) {
        // Get existing progress
        const existingProgress = await kanjiMasteryDB.getProgress(user.uid, kanji.id)

        // Update or create progress
        const progressLevel = reviewOnly && existingProgress?.level
          ? existingProgress.level
          : session.level
        const progress: KanjiProgressRecord = {
          userId: user.uid,
          kanjiId: kanji.id,
          character: kanji.character,
          level: progressLevel,
          lastReviewed: new Date().toISOString(),
          nextReviewDate: kanji.nextReviewDate,
          reviewCount: (existingProgress?.reviewCount || 0) + 1,
          averageScore: existingProgress
            ? (existingProgress.averageScore + kanji.finalScore) / 2
            : kanji.finalScore,
          lastScore: kanji.finalScore,
          lastAccuracy: kanji.rounds.round2Accuracy,
          rounds: kanji.rounds,
          srsData: kanji.srsData
        }

        await kanjiMasteryDB.saveProgress(progress)
      }

      // 3. Update statistics
      const existingStats = await kanjiMasteryDB.getStatistics(user.uid)
      const stats: KanjiStatistics = {
        userId: user.uid,
        totalSessions: (existingStats?.totalSessions || 0) + 1,
        totalKanjiLearned: existingStats
          ? existingStats.totalKanjiLearned + session.kanji.length
          : session.kanji.length,
        perfectSessions: existingStats
          ? existingStats.perfectSessions + (session.sessionStats.perfectKanji === session.sessionStats.totalKanji ? 1 : 0)
          : (session.sessionStats.perfectKanji === session.sessionStats.totalKanji ? 1 : 0),
        averageAccuracy: existingStats
          ? (existingStats.averageAccuracy + session.sessionStats.averageAccuracy) / 2
          : session.sessionStats.averageAccuracy,
        lastSessionDate: session.endTime.toISOString()
      }

      await kanjiMasteryDB.updateStatistics(stats)

      console.log('[KanjiMastery] Successfully saved to IndexedDB')
    } catch (error) {
      console.error('[KanjiMastery] Error saving to IndexedDB:', error)
      // Don't throw - we still want to attempt Firebase sync
    }
  }

  /**
   * Sync to Firebase for premium users via existing API endpoint
   * Calls /api/kanji-mastery/session which handles all Firebase operations
   */
  private async queueKanjiMasteryFirebaseSync(
    session: KanjiMasterySession,
    user: ProgressUser
  ): Promise<void> {
    try {
      // Call existing API endpoint that handles Firebase sync
      const response = await fetch('/api/kanji-mastery/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...session,
          startTime: session.startTime.toISOString(),
          endTime: session.endTime.toISOString()
        })
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('[KanjiMastery] Firebase sync failed:', error)
        return
      }

      const result = await response.json()
      console.log('[KanjiMastery] Firebase sync successful:', result.message)
    } catch (error) {
      console.error('[KanjiMastery] Error syncing to Firebase:', error)
      // Don't throw - data is already in IndexedDB
      // Will retry on next session if offline
    }
  }

  /**
   * Get upcoming reviews from IndexedDB
   */
  async getUpcomingReviews(userId: string, limit = 20): Promise<KanjiProgressRecord[]> {
    try {
      return await kanjiMasteryDB.getUpcomingReviews(userId, limit)
    } catch (error) {
      console.error('[KanjiMastery] Error getting upcoming reviews:', error)
      return []
    }
  }
}
