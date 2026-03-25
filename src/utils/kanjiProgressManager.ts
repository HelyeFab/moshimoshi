import { UniversalProgressManager } from '@/lib/review-engine/progress/UniversalProgressManager'
import { ReviewProgressData, ProgressEvent } from '@/lib/review-engine/core/progress.types'

/**
 * Reading exposure data for vocabulary-first mode
 */
export interface ReadingExposure {
  reading: string // The reading (hiragana)
  readingType: 'onyomi' | 'kunyomi'
  exposureCount: number // How many times this reading was shown
  lastWord?: string // Last vocabulary word that used this reading
  lastWordMeaning?: string // Meaning of last word
  lastSeenAt?: string // ISO timestamp
}

export interface KanjiProgressData extends ReviewProgressData {
  character?: string
  jlptLevel?: string

  // Vocabulary exposure tracking (Agent 4 - vocabulary-first mode)
  // All fields optional for backward compatibility
  vocabularySeenCount?: number // Total vocabulary cards viewed for this kanji
  readingsExposed?: Record<string, ReadingExposure> // Map: reading → exposure data
  lastVocabularyTimestamp?: string // ISO timestamp of last vocabulary card view
}

/**
 * Tracks kanji progress locally (IndexedDB) for all signed-in users
 * and syncs to Firebase for premium users via /api/progress/track.
 */
export class KanjiProgressManager extends UniversalProgressManager<KanjiProgressData> {
  private static instance: KanjiProgressManager
  // Match previous logic (browseCount > 5) → require at least 6 views to be learned
  private readonly LEARNED_VIEW_THRESHOLD = 6

  private constructor() {
    super()
  }

  static getInstance(): KanjiProgressManager {
    if (!KanjiProgressManager.instance) {
      KanjiProgressManager.instance = new KanjiProgressManager()
    }
    return KanjiProgressManager.instance
  }

  async trackKanjiView(
    kanjiId: string,
    user: any | null,
    isPremium: boolean
  ): Promise<void> {
    await this.trackProgress('kanji', kanjiId, ProgressEvent.VIEWED, user, isPremium)
  }

  async markKanjiLearned(
    kanjiId: string,
    user: any | null,
    isPremium: boolean
  ): Promise<void> {
    if (!user?.uid) return

    const userId = user.uid
    const existing =
      (await this.getProgressItem(userId, 'kanji', kanjiId)) ||
      (this.createInitialProgress(kanjiId, 'kanji') as KanjiProgressData)

    const updated: KanjiProgressData = {
      ...existing,
      status: 'learned',
      viewCount: Math.max(existing.viewCount || 0, this.LEARNED_VIEW_THRESHOLD),
      correctCount: (existing.correctCount || 0) + 1,
      updatedAt: new Date().toISOString(),
    }

    await this.saveProgress(userId, 'kanji', kanjiId, updated, isPremium)
  }

  async resetKanjiProgress(
    kanjiId: string,
    user: any | null,
    isPremium: boolean
  ): Promise<void> {
    if (!user?.uid) return

    const userId = user.uid

    // Reset to initial state - complete clean slate
    const resetData: KanjiProgressData = {
      ...this.createInitialProgress(kanjiId, 'kanji'),
      status: 'not-started',
      viewCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      updatedAt: new Date().toISOString(),
    }

    await this.saveProgress(userId, 'kanji', kanjiId, resetData, isPremium)
  }

  async getKanjiProgressMap(user: any | null, isPremium: boolean) {
    if (!user?.uid) return new Map<string, KanjiProgressData>()
    return this.getProgress(user.uid, 'kanji', isPremium)
  }

  async getKanjiProgressItem(
    kanjiId: string,
    user: any | null,
    isPremium: boolean
  ): Promise<KanjiProgressData | null> {
    if (!user?.uid) return null

    const progressMap = await this.getProgress(user.uid, 'kanji', isPremium)
    return progressMap.get(kanjiId) || null
  }

  /**
   * Track vocabulary exposure for vocabulary-first study mode
   * @param kanjiId - The kanji character
   * @param reading - The reading being taught (hiragana)
   * @param readingType - 'onyomi' or 'kunyomi'
   * @param word - The vocabulary word
   * @param wordMeaning - English meaning of the word
   * @param user - User object
   * @param isPremium - Whether user has premium subscription
   */
  async trackVocabularyExposure(
    kanjiId: string,
    reading: string,
    readingType: 'onyomi' | 'kunyomi',
    word: string,
    wordMeaning: string,
    user: any | null,
    isPremium: boolean
  ): Promise<void> {
    if (!user?.uid) return

    const userId = user.uid
    const existing =
      (await this.getProgressItem(userId, 'kanji', kanjiId)) ||
      (this.createInitialProgress(kanjiId, 'kanji') as KanjiProgressData)

    // Initialize vocabulary tracking fields if not present
    const vocabularySeenCount = (existing.vocabularySeenCount || 0) + 1

    // Create immutable copy of existing readingsExposed (don't mutate!)
    const existingReadings = existing.readingsExposed || {}
    const currentExposure = existingReadings[reading] || {
      reading,
      readingType,
      exposureCount: 0,
    }

    // Create new readingsExposed object with updated reading
    const readingsExposed: Record<string, ReadingExposure> = {
      ...existingReadings, // Shallow copy of existing readings
      [reading]: {
        ...currentExposure,
        exposureCount: currentExposure.exposureCount + 1,
        lastWord: word,
        lastWordMeaning: wordMeaning,
        lastSeenAt: new Date().toISOString(),
      },
    }

    const updated: KanjiProgressData = {
      ...existing,
      vocabularySeenCount,
      readingsExposed,
      lastVocabularyTimestamp: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await this.saveProgress(userId, 'kanji', kanjiId, updated, isPremium)
  }

  /**
   * Get vocabulary exposure statistics for a kanji
   * @param kanjiId - The kanji character
   * @param user - User object
   * @param isPremium - Whether user has premium subscription
   * @returns Vocabulary exposure stats or null if no data
   */
  async getVocabularyExposureStats(
    kanjiId: string,
    user: any | null,
    isPremium: boolean
  ): Promise<{
    totalVocabularySeen: number
    readingsExposed: ReadingExposure[]
    lastVocabularyTimestamp: string | null
  } | null> {
    if (!user?.uid) return null

    const progress = await this.getKanjiProgressItem(kanjiId, user, isPremium)
    if (!progress) return null

    const readingsExposed = progress.readingsExposed || {}
    const exposureArray = Object.values(readingsExposed)

    return {
      totalVocabularySeen: progress.vocabularySeenCount || 0,
      readingsExposed: exposureArray,
      lastVocabularyTimestamp: progress.lastVocabularyTimestamp || null,
    }
  }

  async flushKanjiSync(): Promise<void> {
    await this.flushPendingSync()
  }

  // Promote status to learned once thresholds are reached
  protected updateProgressForEvent(
    progress: KanjiProgressData,
    event: ProgressEvent,
    metadata?: Partial<any>
  ): KanjiProgressData {
    const updated = super.updateProgressForEvent(progress, event, metadata)

    const views = updated.viewCount || 0
    if (views >= this.LEARNED_VIEW_THRESHOLD) {
      updated.status = 'learned'
    } else if (views > 0 && updated.status === 'not-started') {
      updated.status = 'learning'
    }

    return updated
  }
}

export const kanjiProgressManager = KanjiProgressManager.getInstance()
