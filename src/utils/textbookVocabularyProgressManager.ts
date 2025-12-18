import { UniversalProgressManager } from '@/lib/review-engine/progress/UniversalProgressManager'
import { ReviewProgressData, ProgressEvent } from '@/lib/review-engine/core/progress.types'

export interface TextbookVocabProgressData extends ReviewProgressData {
  japanese?: string
  textbook?: string
  lesson?: number
  chapter?: number
  jlptLevel?: string
}

/**
 * Tracks textbook vocabulary progress locally (IndexedDB) for all signed-in users
 * and syncs to Firebase for premium users via /api/progress/track.
 *
 * Progress is isolated per textbook - learning a word in Genki doesn't affect
 * the same word in other textbooks.
 */
export class TextbookVocabularyProgressManager extends UniversalProgressManager<TextbookVocabProgressData> {
  private static instance: TextbookVocabularyProgressManager
  // Match kanji logic: require at least 6 views to be considered "learned"
  private readonly LEARNED_VIEW_THRESHOLD = 6

  private constructor() {
    super()
  }

  static getInstance(): TextbookVocabularyProgressManager {
    if (!TextbookVocabularyProgressManager.instance) {
      TextbookVocabularyProgressManager.instance = new TextbookVocabularyProgressManager()
    }
    return TextbookVocabularyProgressManager.instance
  }

  /**
   * Track when a vocabulary item is viewed in study mode
   */
  async trackVocabView(
    vocabId: string,
    user: any | null,
    isPremium: boolean,
    vocabMetadata?: { textbook?: string; lesson?: number; chapter?: number }
  ): Promise<void> {
    if (!user?.uid) return

    // Track the view first
    await this.trackProgress(
      'textbook_vocabulary',
      vocabId,
      ProgressEvent.VIEWED,
      user,
      isPremium
    )

    // Then update with textbook-specific metadata if provided
    if (vocabMetadata) {
      const userId = user.uid
      const existing = await this.getProgressItem(userId, 'textbook_vocabulary', vocabId)
      if (existing) {
        const updated: TextbookVocabProgressData = {
          ...existing,
          textbook: vocabMetadata.textbook || existing.textbook,
          lesson: vocabMetadata.lesson || existing.lesson,
          chapter: vocabMetadata.chapter || existing.chapter,
        }
        await this.saveProgress(userId, 'textbook_vocabulary', vocabId, updated, isPremium)
      }
    }
  }

  /**
   * Track when a vocabulary item is reviewed (answered correctly/incorrectly)
   */
  async trackVocabReview(
    vocabId: string,
    user: any | null,
    isPremium: boolean,
    correct: boolean,
    vocabMetadata?: { textbook?: string; lesson?: number; chapter?: number }
  ): Promise<void> {
    if (!user?.uid) return

    // Track the review
    await this.trackProgress(
      'textbook_vocabulary',
      vocabId,
      correct ? ProgressEvent.COMPLETED : ProgressEvent.INTERACTED,
      user,
      isPremium,
      { correct }
    )

    // Then update with textbook-specific metadata if provided
    if (vocabMetadata) {
      const userId = user.uid
      const existing = await this.getProgressItem(userId, 'textbook_vocabulary', vocabId)
      if (existing) {
        const updated: TextbookVocabProgressData = {
          ...existing,
          textbook: vocabMetadata.textbook || existing.textbook,
          lesson: vocabMetadata.lesson || existing.lesson,
          chapter: vocabMetadata.chapter || existing.chapter,
        }
        await this.saveProgress(userId, 'textbook_vocabulary', vocabId, updated, isPremium)
      }
    }
  }

  /**
   * Mark a vocabulary item as learned (manual marking)
   */
  async markVocabLearned(
    vocabId: string,
    user: any | null,
    isPremium: boolean,
    metadata?: { textbook?: string; lesson?: number; chapter?: number }
  ): Promise<void> {
    if (!user?.uid) return

    const userId = user.uid
    const existing =
      (await this.getProgressItem(userId, 'textbook_vocabulary', vocabId)) ||
      (this.createInitialProgress(vocabId, 'textbook_vocabulary') as TextbookVocabProgressData)

    const updated: TextbookVocabProgressData = {
      ...existing,
      status: 'learned',
      viewCount: Math.max(existing.viewCount || 0, this.LEARNED_VIEW_THRESHOLD),
      correctCount: (existing.correctCount || 0) + 1,
      textbook: metadata?.textbook || existing.textbook,
      lesson: metadata?.lesson || existing.lesson,
      chapter: metadata?.chapter || existing.chapter,
      updatedAt: new Date().toISOString(),
    }

    await this.saveProgress(userId, 'textbook_vocabulary', vocabId, updated, isPremium)
  }

  /**
   * Get progress for all vocabulary items for a user
   */
  async getVocabProgressMap(
    user: any | null,
    isPremium: boolean
  ): Promise<Map<string, TextbookVocabProgressData>> {
    if (!user?.uid) return new Map<string, TextbookVocabProgressData>()
    return this.getProgress(user.uid, 'textbook_vocabulary', isPremium)
  }

  /**
   * Get progress for a specific textbook
   */
  async getTextbookProgress(
    user: any | null,
    isPremium: boolean,
    textbookId: string
  ): Promise<Map<string, TextbookVocabProgressData>> {
    const allProgress = await this.getVocabProgressMap(user, isPremium)
    const filtered = new Map<string, TextbookVocabProgressData>()

    allProgress.forEach((progress, key) => {
      if (progress.textbook === textbookId) {
        filtered.set(key, progress)
      }
    })

    return filtered
  }

  /**
   * Get progress for a specific lesson/chapter
   */
  async getLessonProgress(
    user: any | null,
    isPremium: boolean,
    textbookId: string,
    lessonOrChapter: number,
    type: 'lesson' | 'chapter' = 'lesson'
  ): Promise<Map<string, TextbookVocabProgressData>> {
    const textbookProgress = await this.getTextbookProgress(user, isPremium, textbookId)
    const filtered = new Map<string, TextbookVocabProgressData>()

    textbookProgress.forEach((progress, key) => {
      if (type === 'lesson' && progress.lesson === lessonOrChapter) {
        filtered.set(key, progress)
      } else if (type === 'chapter' && progress.chapter === lessonOrChapter) {
        filtered.set(key, progress)
      }
    })

    return filtered
  }

  /**
   * Get statistics for a textbook
   */
  async getTextbookStats(
    user: any | null,
    isPremium: boolean,
    textbookId: string
  ): Promise<{
    total: number
    learned: number
    learning: number
    notStarted: number
    accuracy: number
  }> {
    const progress = await this.getTextbookProgress(user, isPremium, textbookId)

    let learned = 0
    let learning = 0
    let notStarted = 0
    let totalCorrect = 0
    let totalAttempts = 0

    progress.forEach((p) => {
      if (p.status === 'learned' || p.status === 'mastered') {
        learned++
      } else if (p.status === 'learning' || p.status === 'viewing') {
        learning++
      } else {
        notStarted++
      }
      totalCorrect += p.correctCount || 0
      totalAttempts += (p.correctCount || 0) + (p.incorrectCount || 0)
    })

    return {
      total: progress.size,
      learned,
      learning,
      notStarted,
      accuracy: totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0
    }
  }

  /**
   * Promote status to learned once thresholds are reached
   */
  protected updateProgressForEvent(
    progress: TextbookVocabProgressData,
    event: ProgressEvent,
    metadata?: Partial<any>
  ): TextbookVocabProgressData {
    const updated = super.updateProgressForEvent(progress, event, metadata)

    // Store textbook/lesson metadata if provided
    if (metadata?.textbook) updated.textbook = metadata.textbook
    if (metadata?.lesson) updated.lesson = metadata.lesson
    if (metadata?.chapter) updated.chapter = metadata.chapter
    if (metadata?.jlptLevel) updated.jlptLevel = metadata.jlptLevel

    // Promote status based on view count
    const views = updated.viewCount || 0
    if (views >= this.LEARNED_VIEW_THRESHOLD) {
      updated.status = 'learned'
    } else if (views > 0 && updated.status === 'not-started') {
      updated.status = 'learning'
    }

    // Also promote to learned if accuracy is high enough
    const attempts = (updated.correctCount || 0) + (updated.incorrectCount || 0)
    const accuracy = attempts > 0 ? (updated.correctCount || 0) / attempts : 0
    if (attempts >= 3 && accuracy >= 0.9) {
      updated.status = 'learned'
    }

    return updated
  }
}

export const textbookVocabularyProgressManager = TextbookVocabularyProgressManager.getInstance()
