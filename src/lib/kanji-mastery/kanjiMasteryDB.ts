/**
 * Kanji Mastery IndexedDB Client
 *
 * Centralized database manager for kanji mastery progress
 * Matches Firebase structure exactly for all users
 */

export const KANJI_DB_NAME = 'moshimoshi_progress'
export const KANJI_DB_VERSION = 3 // Bumped to force recreation with all stores

export const KANJI_STORES = {
  SESSIONS: 'kanji_mastery_sessions',
  PROGRESS: 'kanji_progress',
  STATISTICS: 'kanji_mastery_statistics'
} as const

export interface KanjiSession {
  sessionId: string
  userId: string
  startTime: string // ISO string
  endTime: string   // ISO string
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

export interface SerializedSRSData {
  interval: number
  lastReviewedAt: string | null
  nextReviewAt: string
  status: 'new' | 'learning' | 'review' | 'mastered'
  reviewCount: number
  correctCount: number
  streak: number
  bestStreak: number
  algorithm: 'sm2' | 'fsrs'
  easeFactor?: number
  repetitions?: number
  stability?: number
  difficulty?: number
  retrievability?: number
  state?: number
}

export interface KanjiProgressRecord {
  userId: string
  kanjiId: string
  character: string
  level?: string
  lastReviewed: string
  nextReviewDate: string
  reviewCount: number
  averageScore: number
  lastScore: number
  lastAccuracy?: number
  rounds: {
    round1: boolean
    round2Accuracy: number
    round3Rating: number
  }
  srsData?: SerializedSRSData
}

export interface KanjiStatistics {
  userId: string
  totalSessions: number
  totalKanjiLearned: number
  perfectSessions: number
  averageAccuracy: number
  lastSessionDate: string
}

export class KanjiMasteryDB {
  private static instance: KanjiMasteryDB | null = null
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): KanjiMasteryDB {
    if (!KanjiMasteryDB.instance) {
      KanjiMasteryDB.instance = new KanjiMasteryDB()
    }
    return KanjiMasteryDB.instance
  }

  /**
   * Initialize database with ALL object stores in one place
   * This fixes the schema initialization bug
   */
  private async initialize(): Promise<void> {
    if (this.db) return

    if (this.initPromise) {
      await this.initPromise
      return
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(KANJI_DB_NAME, KANJI_DB_VERSION)

      request.onerror = () => {
        console.error('[KanjiDB] Failed to open database:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('[KanjiDB] Database opened successfully')

        this.db.onclose = () => {
          console.log('[KanjiDB] Database connection closed')
          this.db = null
        }

        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        console.log(`[KanjiDB] Upgrading database from version ${event.oldVersion} to ${KANJI_DB_VERSION}`)

        // CREATE ALL OBJECT STORES HERE (fixes the bug!)

        // 1. Sessions store
        if (!db.objectStoreNames.contains(KANJI_STORES.SESSIONS)) {
          const sessionsStore = db.createObjectStore(KANJI_STORES.SESSIONS, {
            keyPath: 'sessionId'
          })
          sessionsStore.createIndex('userId', 'userId', { unique: false })
          sessionsStore.createIndex('startTime', 'startTime', { unique: false })
          console.log('[KanjiDB] Created sessions store')
        }

        // 2. Progress store
        if (!db.objectStoreNames.contains(KANJI_STORES.PROGRESS)) {
          const progressStore = db.createObjectStore(KANJI_STORES.PROGRESS, {
            keyPath: ['userId', 'kanjiId']
          })
          progressStore.createIndex('userId', 'userId', { unique: false })
          progressStore.createIndex('kanjiId', 'kanjiId', { unique: false })
          progressStore.createIndex('nextReviewDate', 'nextReviewDate', { unique: false })
          console.log('[KanjiDB] Created progress store')
        }

        // 3. Statistics store
        if (!db.objectStoreNames.contains(KANJI_STORES.STATISTICS)) {
          const statsStore = db.createObjectStore(KANJI_STORES.STATISTICS, {
            keyPath: 'userId'
          })
          console.log('[KanjiDB] Created statistics store')
        }
      }
    })

    await this.initPromise
  }

  /**
   * Get database instance
   */
  private async getDB(): Promise<IDBDatabase> {
    await this.initialize()
    if (!this.db) {
      throw new Error('[KanjiDB] Database not initialized')
    }
    return this.db
  }

  /**
   * Save session (IndexedDB-first)
   */
  async saveSession(session: KanjiSession): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction([KANJI_STORES.SESSIONS], 'readwrite')
    const store = tx.objectStore(KANJI_STORES.SESSIONS)

    return new Promise((resolve, reject) => {
      const request = store.put(session)
      request.onsuccess = () => {
        console.log(`[KanjiDB] Saved session ${session.sessionId}`)
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Save kanji progress (IndexedDB-first)
   */
  async saveProgress(progress: KanjiProgressRecord): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction([KANJI_STORES.PROGRESS], 'readwrite')
    const store = tx.objectStore(KANJI_STORES.PROGRESS)

    return new Promise((resolve, reject) => {
      const request = store.put(progress)
      request.onsuccess = () => {
        console.log(`[KanjiDB] Saved progress for ${progress.character}`)
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get existing progress for a kanji
   */
  async getProgress(userId: string, kanjiId: string): Promise<KanjiProgressRecord | null> {
    const db = await this.getDB()
    const tx = db.transaction([KANJI_STORES.PROGRESS], 'readonly')
    const store = tx.objectStore(KANJI_STORES.PROGRESS)

    return new Promise((resolve, reject) => {
      const request = store.get([userId, kanjiId])
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Update statistics (IndexedDB-first)
   */
  async updateStatistics(stats: KanjiStatistics): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction([KANJI_STORES.STATISTICS], 'readwrite')
    const store = tx.objectStore(KANJI_STORES.STATISTICS)

    return new Promise((resolve, reject) => {
      const request = store.put(stats)
      request.onsuccess = () => {
        console.log(`[KanjiDB] Updated statistics for user ${stats.userId}`)
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get statistics
   */
  async getStatistics(userId: string): Promise<KanjiStatistics | null> {
    const db = await this.getDB()
    const tx = db.transaction([KANJI_STORES.STATISTICS], 'readonly')
    const store = tx.objectStore(KANJI_STORES.STATISTICS)

    return new Promise((resolve, reject) => {
      const request = store.get(userId)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get sessions for a user (most recent first)
   */
  async getSessionsByUser(userId: string, limit = 60): Promise<KanjiSession[]> {
    const db = await this.getDB()
    const tx = db.transaction([KANJI_STORES.SESSIONS], 'readonly')
    const store = tx.objectStore(KANJI_STORES.SESSIONS)
    const index = store.index('userId')

    return new Promise((resolve, reject) => {
      const request = index.getAll(userId)
      request.onsuccess = () => {
        const sessions = (request.result || [])
          .sort((a: KanjiSession, b: KanjiSession) =>
            new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
          )
          .slice(0, limit)
        resolve(sessions)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get upcoming reviews
   */
  async getUpcomingReviews(userId: string, limit = 20): Promise<KanjiProgressRecord[]> {
    const db = await this.getDB()
    const tx = db.transaction([KANJI_STORES.PROGRESS], 'readonly')
    const store = tx.objectStore(KANJI_STORES.PROGRESS)
    const index = store.index('userId')

    return new Promise((resolve, reject) => {
      const request = index.getAll(userId)
      request.onsuccess = () => {
        const allProgress = request.result || []
        const now = new Date()

        // Filter and sort by review date
        const upcomingReviews = allProgress
          .filter((p: KanjiProgressRecord) => {
            const nextReview = p.srsData?.nextReviewAt || p.nextReviewDate
            return new Date(nextReview) <= now
          })
          .sort((a: KanjiProgressRecord, b: KanjiProgressRecord) =>
            new Date(a.srsData?.nextReviewAt || a.nextReviewDate).getTime() -
            new Date(b.srsData?.nextReviewAt || b.nextReviewDate).getTime()
          )
          .slice(0, limit)

        resolve(upcomingReviews)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get all progress records for a user
   */
  async getProgressByUser(userId: string): Promise<KanjiProgressRecord[]> {
    const db = await this.getDB()
    const tx = db.transaction([KANJI_STORES.PROGRESS], 'readonly')
    const store = tx.objectStore(KANJI_STORES.PROGRESS)
    const index = store.index('userId')

    return new Promise((resolve, reject) => {
      const request = index.getAll(userId)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get all progress records for a user and JLPT level
   */
  async getProgressByUserAndLevel(userId: string, level: string): Promise<KanjiProgressRecord[]> {
    const records = await this.getProgressByUser(userId)
    return records.filter(record => record.level === level)
  }
}

// Export singleton instance
export const kanjiMasteryDB = KanjiMasteryDB.getInstance()
