import { UniversalProgressManager } from '@/lib/review-engine/progress/UniversalProgressManager'
import { ReviewProgressData, ProgressEvent } from '@/lib/review-engine/core/progress.types'

export interface VocabularyProgressData extends ReviewProgressData {
  textbookId?: string
  lesson?: number
  meanings?: string[]
}

/**
 * Tracks textbook vocabulary progress locally for all signed-in users,
 * with premium-only cloud sync via /api/progress/track (contentType: textbook_vocab).
 */
export class VocabularyProgressManager extends UniversalProgressManager<VocabularyProgressData> {
  private static instance: VocabularyProgressManager

  private constructor() {
    super()
  }

  static getInstance(): VocabularyProgressManager {
    if (!VocabularyProgressManager.instance) {
      VocabularyProgressManager.instance = new VocabularyProgressManager()
    }
    return VocabularyProgressManager.instance
  }

  async trackView(
    vocabId: string,
    user: any | null,
    isPremium: boolean,
    metadata?: Partial<VocabularyProgressData>
  ) {
    await this.trackProgress(
      'textbook_vocab',
      vocabId,
      ProgressEvent.VIEWED,
      user,
      isPremium,
      metadata as any
    )
  }

  async markLearned(
    vocabId: string,
    user: any | null,
    isPremium: boolean,
    metadata?: Partial<VocabularyProgressData>
  ) {
    await this.trackProgress('textbook_vocab', vocabId, ProgressEvent.COMPLETED, user, isPremium, {
      correct: true,
      ...(metadata as any),
    })
  }

  async getProgressMap(user: any | null, isPremium: boolean) {
    if (!user?.uid) return new Map<string, VocabularyProgressData>()
    return this.getProgress(user.uid, 'textbook_vocab', isPremium)
  }
}

export const vocabularyProgressManager = VocabularyProgressManager.getInstance()
