import { UniversalProgressManager } from '@/lib/review-engine/progress/UniversalProgressManager'
import { ReviewProgressData, ProgressEvent } from '@/lib/review-engine/core/progress.types'

export interface KanjiProgressData extends ReviewProgressData {
  character?: string
  jlptLevel?: string
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

  async getKanjiProgressMap(user: any | null, isPremium: boolean) {
    if (!user?.uid) return new Map<string, KanjiProgressData>()
    return this.getProgress(user.uid, 'kanji', isPremium)
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
