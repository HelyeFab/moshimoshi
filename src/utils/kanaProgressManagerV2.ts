/**
 * Kana Progress Manager V2
 * Extends UniversalProgressManager for kana-specific functionality
 */

import { UniversalProgressManager } from '@/lib/review-engine/progress/UniversalProgressManager'
import {
  ReviewProgressData,
  ProgressEvent,
  ProgressStatus
} from '@/lib/review-engine/core/progress.types'
import { reviewLogger } from '@/lib/monitoring/logger'

/**
 * Kana-specific progress data
 */
export interface KanaProgressData extends ReviewProgressData {
  // Kana-specific fields
  script: 'hiragana' | 'katakana'
  characterType?: 'vowel' | 'consonant' | 'dakuten' | 'handakuten' | 'digraph'

  // Legacy compatibility fields
  status: ProgressStatus
  reviewCount: number
  correctCount: number
  lastReviewed?: Date
  pinned: boolean
}

/**
 * Legacy character progress interface for backward compatibility
 */
export interface CharacterProgress {
  status: ProgressStatus
  reviewCount: number
  correctCount: number
  lastReviewed?: Date
  pinned: boolean
  updatedAt: Date
}

/**
 * Kana Progress Manager
 * Specialized implementation for hiragana and katakana
 */
export class KanaProgressManagerV2 extends UniversalProgressManager<KanaProgressData> {
  private static instance: KanaProgressManagerV2
  private logger = reviewLogger

  /**
   * Get singleton instance
   */
  static getInstance(): KanaProgressManagerV2 {
    if (!this.instance) {
      this.instance = new KanaProgressManagerV2()
    }
    return this.instance
  }

  private constructor() {
    super()
    // Use a specific DB for kana to maintain backward compatibility
    this.dbName = 'moshimoshi-kana-progress-v2'
    this.dbVersion = 2
  }

  /**
   * Legacy method: Save progress for a character
   * Maintains backward compatibility with existing code
   */
  async saveProgress(
    script: 'hiragana' | 'katakana',
    characterId: string,
    progress: CharacterProgress,
    user: any | null,
    isPremium: boolean
  ): Promise<void> {
    // Handle undefined or null progress
    if (!progress) {
      this.logger.warn(`No progress data provided for ${script}:${characterId}`)
      return
    }

    // Don't save for guest users
    if (!user) {
      return
    }

    // Convert legacy format to new format
    const kanaProgress: KanaProgressData = {
      contentId: characterId,
      contentType: script,
      script,
      status: progress.status || 'not-started',
      viewCount: progress.reviewCount || 0, // Map reviewCount to viewCount
      firstViewedAt: progress.lastReviewed || undefined,
      lastViewedAt: progress.lastReviewed || undefined,
      interactionCount: progress.reviewCount || 0,
      correctCount: progress.correctCount || 0,
      incorrectCount: Math.max(0, (progress.reviewCount || 0) - (progress.correctCount || 0)),
      accuracy: (progress.reviewCount || 0) > 0 ? ((progress.correctCount || 0) / (progress.reviewCount || 0)) * 100 : 0,
      streak: 0,
      bestStreak: 0,
      pinned: progress.pinned || false,
      bookmarked: false,
      flaggedForReview: false,
      createdAt: progress.updatedAt || new Date(),
      updatedAt: progress.updatedAt || new Date()
    }

    // Remove undefined fields before saving
    Object.keys(kanaProgress).forEach(key => {
      if (kanaProgress[key as keyof KanaProgressData] === undefined) {
        delete kanaProgress[key as keyof KanaProgressData]
      }
    })

    // Save directly using the base class method (don't call trackProgress to avoid recursion)
    await super.saveProgress(user.uid, script, characterId, kanaProgress, isPremium)
  }

  /**
   * Legacy method: Get progress for a script
   * Returns in the old format for backward compatibility
   */
  async getProgress(
    script: 'hiragana' | 'katakana',
    user: any | null,
    isPremium: boolean
  ): Promise<Record<string, CharacterProgress>> {
    if (!user) return {}

    // Get progress using the base class method
    const progressMap = await super.getProgress(user.uid, script, isPremium)

    // Convert to legacy format
    const legacyProgress: Record<string, CharacterProgress> = {}

    for (const [characterId, data] of progressMap) {
      legacyProgress[characterId] = {
        status: data.status,
        reviewCount: data.viewCount,
        correctCount: data.correctCount,
        lastReviewed: data.lastViewedAt,
        pinned: data.pinned,
        updatedAt: data.updatedAt
      }
    }

    return legacyProgress
  }

  /**
   * Track when a character is viewed in study mode
   */
  async trackCharacterView(
    script: 'hiragana' | 'katakana',
    characterId: string,
    user: any | null,
    isPremium: boolean
  ): Promise<void> {
    await this.trackProgress(
      script,
      characterId,
      ProgressEvent.VIEWED,
      user,
      isPremium
    )

    reviewLogger.info(`[KanaProgressManagerV2] Tracked view for ${script}:${characterId}`)
  }

  /**
   * Track when a character is interacted with (audio, hint, etc.)
   */
  async trackCharacterInteraction(
    script: 'hiragana' | 'katakana',
    characterId: string,
    interactionType: 'audio' | 'hint' | 'flip',
    user: any | null,
    isPremium: boolean
  ): Promise<void> {
    await this.trackProgress(
      script,
      characterId,
      ProgressEvent.INTERACTED,
      user,
      isPremium,
      {
        eventType: ProgressEvent.INTERACTED,
        timestamp: new Date(),
        interactionType: interactionType as any,
        userId: user?.uid || '',
        isPremium
      }
    )
  }

  /**
   * Track when a character is marked as learned
   */
  async trackCharacterLearned(
    script: 'hiragana' | 'katakana',
    characterId: string,
    user: any | null,
    isPremium: boolean
  ): Promise<void> {
    await this.trackProgress(
      script,
      characterId,
      ProgressEvent.COMPLETED,
      user,
      isPremium,
      {
        eventType: ProgressEvent.COMPLETED,
        timestamp: new Date(),
        correct: true,
        userId: user?.uid || '',
        isPremium
      }
    )
  }

  /**
   * Track when a character is skipped
   */
  async trackCharacterSkipped(
    script: 'hiragana' | 'katakana',
    characterId: string,
    user: any | null,
    isPremium: boolean
  ): Promise<void> {
    await this.trackProgress(
      script,
      characterId,
      ProgressEvent.SKIPPED,
      user,
      isPremium,
      {
        eventType: ProgressEvent.SKIPPED,
        timestamp: new Date(),
        userId: user?.uid || '',
        isPremium
      }
    )

    reviewLogger.info(`[KanaProgressManagerV2] Tracked skip for ${script}:${characterId}`)
  }

  /**
   * Start a kana study session
   */
  async startKanaSession(
    script: 'hiragana' | 'katakana',
    user: any | null
  ): Promise<string> {
    if (!user) return ''

    return await this.startSession(user.uid, script, undefined, user)
  }

  /**
   * End a kana study session
   */
  async endKanaSession(isPremium: boolean): Promise<void> {
    const summary = await this.endSession(isPremium)

    if (summary) {
      reviewLogger.info('[KanaProgressManagerV2] Session ended:', {
        duration: summary.duration,
        itemsViewed: summary.itemsViewed.length,
        itemsCompleted: summary.itemsCompleted.length,
        accuracy: summary.accuracy
      })
    }
  }

  /**
   * Migrate from old localStorage data
   */
  async migrateFromLocalStorage(
    script: 'hiragana' | 'katakana',
    user: any | null,
    isPremium: boolean
  ): Promise<boolean> {
    if (!user) return false

    const storageKey = `kana-progress-${script}`
    const migrationFlag = `${storageKey}-${user.uid}-migrated-v2`

    // Check if already migrated
    if (localStorage.getItem(migrationFlag)) {
      return false
    }

    const oldData = localStorage.getItem(storageKey)
    if (!oldData) {
      // Mark as migrated even if no data (to prevent repeated checks)
      localStorage.setItem(migrationFlag, 'true')
      return false
    }

    try {
      const parsed = JSON.parse(oldData)

      // Migrate each character's progress
      for (const [characterId, progress] of Object.entries(parsed)) {
        if (typeof progress === 'object' && progress !== null) {
          const oldProgress = progress as any
          await this.saveProgress(
            script,
            characterId,
            {
              status: oldProgress.status || 'not-started',
              reviewCount: oldProgress.reviewCount || 0,
              correctCount: oldProgress.correctCount || 0,
              lastReviewed: oldProgress.lastReviewed ? new Date(oldProgress.lastReviewed) : undefined,
              pinned: oldProgress.pinned || false,
              updatedAt: new Date()
            },
            user,
            isPremium
          )
        }
      }

      // Mark as migrated
      localStorage.setItem(migrationFlag, 'true')
      reviewLogger.info(`[KanaProgressManagerV2] Migrated ${Object.keys(parsed).length} items from localStorage`)
      return true
    } catch (error) {
      reviewLogger.error('[KanaProgressManagerV2] Migration failed:', error)
      return false
    }
  }

  /**
   * Clear all progress for a user (for testing)
   */
  async clearProgress(userId: string, script: 'hiragana' | 'katakana'): Promise<void> {
    await this.initDB()
    if (!this.db) return

    try {
      const tx = this.db.transaction('progress', 'readwrite')
      const index = tx.store.index('by-composite')

      let cursor = await index.openCursor(IDBKeyRange.bound(
        [userId, script, ''],
        [userId, script, '\uffff']
      ))

      while (cursor) {
        await cursor.delete()
        cursor = await cursor.continue()
      }

      reviewLogger.info(`[KanaProgressManagerV2] Cleared all ${script} progress for user ${userId}`)
    } catch (error) {
      reviewLogger.error('[KanaProgressManagerV2] Failed to clear progress:', error)
    }
  }

  /**
   * Get learning statistics
   */
  async getStatistics(
    script: 'hiragana' | 'katakana',
    user: any | null,
    isPremium: boolean
  ): Promise<{
    totalCharacters: number
    viewedCharacters: number
    learnedCharacters: number
    masteredCharacters: number
    averageAccuracy: number
    totalViewTime: number
  }> {
    if (!user) {
      return {
        totalCharacters: 0,
        viewedCharacters: 0,
        learnedCharacters: 0,
        masteredCharacters: 0,
        averageAccuracy: 0,
        totalViewTime: 0
      }
    }

    const progressMap = await super.getProgress(user.uid, script, isPremium)

    let viewedCount = 0
    let learnedCount = 0
    let masteredCount = 0
    let totalAccuracy = 0
    let totalViewTime = 0

    for (const data of progressMap.values()) {
      if (data.viewCount > 0) viewedCount++
      if (data.status === 'learned') learnedCount++
      if (data.status === 'mastered') masteredCount++
      totalAccuracy += data.accuracy
      totalViewTime += data.totalViewTime || 0
    }

    return {
      totalCharacters: progressMap.size,
      viewedCharacters: viewedCount,
      learnedCharacters: learnedCount,
      masteredCharacters: masteredCount,
      averageAccuracy: progressMap.size > 0 ? totalAccuracy / progressMap.size : 0,
      totalViewTime
    }
  }
}

// Export singleton instance for backward compatibility
export const kanaProgressManagerV2 = KanaProgressManagerV2.getInstance()