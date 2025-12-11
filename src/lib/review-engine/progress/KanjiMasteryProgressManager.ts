import { UniversalProgressManager } from './UniversalProgressManager'
import { SessionState, KanjiProgress } from '@/app/[locale]/tools/kanji-mastery/learn/LearnContent'

// Simplified user type - only uid is needed for progress tracking
interface ProgressUser {
  uid: string
}

export interface KanjiMasterySession {
  sessionId: string
  userId: string
  startTime: Date
  endTime: Date
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
  }>
  /** @deprecated XP calculation moved to external gamification service */
  totalXP: number
  streakContribution: boolean
  /** @deprecated Achievement tracking moved to external gamification service */
  achievements: string[]
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

    // Calculate session statistics
    const sessionStats = this.calculateSessionStats(sessionState, timeSpentSeconds)

    // Prepare session data
    const session: KanjiMasterySession = {
      sessionId: sessionState.sessionId,
      userId: user?.uid || 'guest',
      startTime: sessionState.startTime,
      endTime,
      kanji: this.prepareKanjiData(sessionState),
      totalXP: 0, // Deprecated: XP calculation moved to external gamification service
      streakContribution: true,
      achievements: [], // Deprecated: Achievement tracking moved to external service
      sessionStats
    }

    // Handle storage based on user tier
    await this.saveKanjiMasterySession(session, user, isPremium)

    // Track individual kanji progress
    await this.trackKanjiProgress(session.kanji, user, isPremium)

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

  /**
   * @deprecated XP calculation has been moved to external gamification service.
   * External services should listen to session completion events and calculate XP independently.
   * This method remains for backward compatibility but always returns 0.
   * TODO: Remove this method in next major version after external gamification service is fully integrated.
   */
  calculateSessionXP(_sessionState: SessionState, _sessionStats: any): number {
    return 0
  }

  private prepareKanjiData(sessionState: SessionState) {
    const kanjiData: KanjiMasterySession['kanji'] = []

    sessionState.kanji.forEach((kanji) => {
      const progress = sessionState.progress.get(kanji.kanji)

      if (progress) {
        const finalScore = this.calculateKanjiFinalScore(progress)
        const nextReviewDate = this.calculateNextReviewDate(finalScore)

        kanjiData.push({
          id: kanji.kanji,
          character: kanji.kanji,
          rounds: {
            round1: progress.round1Completed,
            round2Accuracy: progress.round2Accuracy,
            round3Rating: progress.round3Rating || 0
          },
          finalScore,
          nextReviewDate
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

  private calculateNextReviewDate(finalScore: number): string {
    // Calculate next review based on performance
    let daysUntilReview: number

    if (finalScore >= 0.9) {
      daysUntilReview = 7 // Excellent - review in a week
    } else if (finalScore >= 0.8) {
      daysUntilReview = 4 // Good - review in 4 days
    } else if (finalScore >= 0.7) {
      daysUntilReview = 2 // Fair - review in 2 days
    } else if (finalScore >= 0.5) {
      daysUntilReview = 1 // Struggling - review tomorrow
    } else {
      daysUntilReview = 0 // Poor - review today
    }

    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + daysUntilReview)
    return nextDate.toISOString()
  }

  private async saveKanjiMasterySession(
    session: KanjiMasterySession,
    user: ProgressUser | null,
    isPremium: boolean
  ) {
    // Save to IndexedDB for all authenticated users
    if (user) {
      await this.saveKanjiMasteryToIndexedDB(session)
    }

    // Firebase saving is handled by API endpoint
    // Premium users will have their data synced through the API
  }

  private async saveKanjiMasteryToIndexedDB(session: KanjiMasterySession) {
    try {
      // Open IndexedDB
      const request = indexedDB.open('moshimoshi_progress', 2)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create kanji_mastery_sessions store if it doesn't exist
        if (!db.objectStoreNames.contains('kanji_mastery_sessions')) {
          const store = db.createObjectStore('kanji_mastery_sessions', {
            keyPath: 'sessionId'
          })
          store.createIndex('userId', 'userId', { unique: false })
          store.createIndex('startTime', 'startTime', { unique: false })
        }
      }

      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      // Save session
      const transaction = db.transaction(['kanji_mastery_sessions'], 'readwrite')
      const store = transaction.objectStore('kanji_mastery_sessions')

      await new Promise((resolve, reject) => {
        const addRequest = store.put({
          ...session,
          startTime: session.startTime.toISOString(),
          endTime: session.endTime.toISOString()
        })
        addRequest.onsuccess = resolve
        addRequest.onerror = () => reject(addRequest.error)
      })

      db.close()
    } catch (error) {
      console.error('Error saving to IndexedDB:', error)
    }
  }

  private async trackKanjiProgress(
    kanjiData: KanjiMasterySession['kanji'],
    user: ProgressUser | null,
    isPremium: boolean
  ) {
    if (!user) return

    try {
      // Open IndexedDB
      const request = indexedDB.open('moshimoshi_progress', 2)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create kanji_progress store if it doesn't exist
        if (!db.objectStoreNames.contains('kanji_progress')) {
          const store = db.createObjectStore('kanji_progress', {
            keyPath: ['userId', 'kanjiId']
          })
          store.createIndex('userId', 'userId', { unique: false })
          store.createIndex('kanjiId', 'kanjiId', { unique: false })
          store.createIndex('nextReviewDate', 'nextReviewDate', { unique: false })
        }
      }

      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      // Update progress for each kanji
      const transaction = db.transaction(['kanji_progress'], 'readwrite')
      const store = transaction.objectStore('kanji_progress')

      for (const kanji of kanjiData) {
        const key = [user.uid, kanji.id]

        // Get existing progress
        const getRequest = store.get(key)
        const existingProgress = await new Promise<any>((resolve) => {
          getRequest.onsuccess = () => resolve(getRequest.result)
          getRequest.onerror = () => resolve(null)
        })

        // Update or create progress
        const progress = {
          userId: user.uid,
          kanjiId: kanji.id,
          character: kanji.character,
          lastReviewed: new Date().toISOString(),
          nextReviewDate: kanji.nextReviewDate,
          reviewCount: (existingProgress?.reviewCount || 0) + 1,
          averageScore: existingProgress
            ? (existingProgress.averageScore + kanji.finalScore) / 2
            : kanji.finalScore,
          lastScore: kanji.finalScore,
          rounds: kanji.rounds
        }

        await new Promise((resolve, reject) => {
          const putRequest = store.put(progress)
          putRequest.onsuccess = resolve
          putRequest.onerror = () => reject(putRequest.error)
        })
      }

      db.close()

      // Sync to Firebase for premium users
      if (isPremium) {
        await this.syncKanjiProgressToFirebase(kanjiData, user)
      }
    } catch (error) {
      console.error('Error tracking kanji progress:', error)
    }
  }

  private async syncKanjiProgressToFirebase(
    kanjiData: KanjiMasterySession['kanji'],
    user: ProgressUser
  ) {
    // Firebase sync handled by API endpoint
    // This method is kept for future direct Firebase integration
    console.log('Firebase sync should be handled by API endpoint')
  }

  async getUpcomingReviews(userId: string, limit = 20): Promise<any[]> {
    try {
      // Open IndexedDB
      const request = indexedDB.open('moshimoshi_progress', 2)
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      const transaction = db.transaction(['kanji_progress'], 'readonly')
      const store = transaction.objectStore('kanji_progress')
      const index = store.index('userId')

      // Get all kanji progress for user
      const userProgress = await new Promise<any[]>((resolve, reject) => {
        const getRequest = index.getAll(userId)
        getRequest.onsuccess = () => resolve(getRequest.result || [])
        getRequest.onerror = () => reject(getRequest.error)
      })

      db.close()

      // Filter and sort by review date
      const now = new Date()
      const upcomingReviews = userProgress
        .filter((progress) => new Date(progress.nextReviewDate) <= now)
        .sort((a, b) =>
          new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime()
        )
        .slice(0, limit)

      return upcomingReviews
    } catch (error) {
      console.error('Error getting upcoming reviews:', error)
      return []
    }
  }
}