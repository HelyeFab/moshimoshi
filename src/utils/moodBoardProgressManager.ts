import { UniversalProgressManager } from '@/lib/review-engine/progress/UniversalProgressManager'
import { ReviewProgressData } from '@/lib/review-engine/core/progress.types'
import { MoodBoard, BoardProgress, MoodBoardsProgress } from '@/types/moodboard'
import { reviewLogger } from '@/lib/monitoring/logger'
type UserLike = { uid: string }

export interface MoodBoardKanjiProgressData extends ReviewProgressData {
  boardId: string
  kanjiChar: string
}

const CONTENT_TYPE = 'moodboard'
const STORAGE_KEY = 'moshimoshi_mood_boards_progress'
const LEGACY_STORAGE_KEY = 'doshi_mood_boards_progress'

export class MoodBoardProgressManager extends UniversalProgressManager<MoodBoardKanjiProgressData> {
  private static instance: MoodBoardProgressManager
  private readonly LEARNED_VIEW_THRESHOLD = 6

  private constructor() {
    super()
  }

  static getInstance(): MoodBoardProgressManager {
    if (!MoodBoardProgressManager.instance) {
      MoodBoardProgressManager.instance = new MoodBoardProgressManager()
    }
    return MoodBoardProgressManager.instance
  }

  private buildContentId(boardId: string, kanjiChar: string): string {
    return `moodboard:${boardId}:${kanjiChar}`
  }

  private parseContentId(contentId: string): { boardId: string; kanjiChar: string } | null {
    const parts = contentId.split(':')
    if (parts.length < 3) return null
    return { boardId: parts[1], kanjiChar: parts.slice(2).join(':') }
  }

  async toggleKanjiLearned(
    boardId: string,
    kanjiChar: string,
    user: UserLike | null,
    isPremium: boolean
  ): Promise<void> {
    if (!user?.uid) return

    const userId = user.uid
    const contentId = this.buildContentId(boardId, kanjiChar)
    const existing =
      (await this.getProgressItem(userId, CONTENT_TYPE, contentId)) ||
      (this.createInitialProgress(contentId, CONTENT_TYPE) as MoodBoardKanjiProgressData)

    const currentlyLearned = existing.status === 'learned' || existing.status === 'mastered'
    const updated: MoodBoardKanjiProgressData = {
      ...existing,
      boardId,
      kanjiChar,
      status: currentlyLearned ? 'not-started' : 'learned',
      viewCount: currentlyLearned ? 0 : Math.max(existing.viewCount || 0, this.LEARNED_VIEW_THRESHOLD),
      correctCount: currentlyLearned ? 0 : Math.max(existing.correctCount || 0, 1),
      updatedAt: new Date().toISOString(),
    }

    await this.saveProgress(userId, CONTENT_TYPE, contentId, updated, isPremium)
  }

  async markKanjiLearned(
    boardId: string,
    kanjiChar: string,
    user: UserLike | null,
    isPremium: boolean
  ): Promise<void> {
    if (!user?.uid) return

    const userId = user.uid
    const contentId = this.buildContentId(boardId, kanjiChar)
    const existing =
      (await this.getProgressItem(userId, CONTENT_TYPE, contentId)) ||
      (this.createInitialProgress(contentId, CONTENT_TYPE) as MoodBoardKanjiProgressData)

    const updated: MoodBoardKanjiProgressData = {
      ...existing,
      boardId,
      kanjiChar,
      status: 'learned',
      viewCount: Math.max(existing.viewCount || 0, this.LEARNED_VIEW_THRESHOLD),
      correctCount: Math.max(existing.correctCount || 0, 1),
      updatedAt: new Date().toISOString(),
    }

    await this.saveProgress(userId, CONTENT_TYPE, contentId, updated, isPremium)
  }

  async getBoardProgress(
    user: UserLike | null,
    isPremium: boolean,
    boardId: string,
    totalKanji: number
  ): Promise<BoardProgress> {
    if (!user?.uid) {
      return {
        boardId,
        learnedKanji: [],
        totalKanji,
        progressPercentage: 0,
        lastStudied: new Date(0),
      }
    }

    const allProgress = await this.getProgress(user.uid, CONTENT_TYPE, isPremium)
    const learnedKanji: string[] = []
    let lastStudied: Date | null = null

    allProgress.forEach((progress) => {
      const parsed = this.parseContentId(progress.contentId)
      const progressBoardId = progress.boardId || parsed?.boardId
      if (progressBoardId !== boardId) return

      const kanjiChar = progress.kanjiChar || parsed?.kanjiChar
      if (!kanjiChar) return

      if (progress.status === 'learned' || progress.status === 'mastered') {
        learnedKanji.push(kanjiChar)
      }

      const updatedAt = progress.updatedAt ? new Date(progress.updatedAt) : null
      if (updatedAt && (!lastStudied || updatedAt > lastStudied)) {
        lastStudied = updatedAt
      }
    })

    const progressPercentage =
      totalKanji > 0 ? Math.round((learnedKanji.length / totalKanji) * 100) : 0

    return {
      boardId,
      learnedKanji,
      totalKanji,
      progressPercentage,
      lastStudied: lastStudied || new Date(0),
      ...(progressPercentage === 100 && lastStudied ? { completedAt: lastStudied } : {}),
    }
  }

  async getAllBoardsProgress(
    user: UserLike | null,
    isPremium: boolean,
    moodBoards: MoodBoard[]
  ): Promise<MoodBoardsProgress> {
    if (!user?.uid || moodBoards.length === 0) {
      return {}
    }

    const allProgress = await this.getProgress(user.uid, CONTENT_TYPE, isPremium)
    const boardsById = new Map(moodBoards.map((board) => [board.id, board]))
    const progressMap: MoodBoardsProgress = {}

    moodBoards.forEach((board) => {
      progressMap[board.id] = {
        boardId: board.id,
        learnedKanji: [],
        totalKanji: board.kanji.length,
        progressPercentage: 0,
        lastStudied: new Date(0),
      }
    })

    allProgress.forEach((progress) => {
      const parsed = this.parseContentId(progress.contentId)
      const boardId = progress.boardId || parsed?.boardId
      const kanjiChar = progress.kanjiChar || parsed?.kanjiChar
      if (!boardId || !kanjiChar || !boardsById.has(boardId)) return

      const boardProgress = progressMap[boardId]
      if (!boardProgress) return

      if (progress.status === 'learned' || progress.status === 'mastered') {
        if (!boardProgress.learnedKanji.includes(kanjiChar)) {
          boardProgress.learnedKanji.push(kanjiChar)
        }
      }

      const updatedAt = progress.updatedAt ? new Date(progress.updatedAt) : null
      if (updatedAt && updatedAt > boardProgress.lastStudied) {
        boardProgress.lastStudied = updatedAt
      }
    })

    Object.values(progressMap).forEach((boardProgress) => {
      boardProgress.progressPercentage =
        boardProgress.totalKanji > 0
          ? Math.round((boardProgress.learnedKanji.length / boardProgress.totalKanji) * 100)
          : 0

      if (boardProgress.progressPercentage === 100) {
        boardProgress.completedAt = boardProgress.lastStudied
      }
    })

    return progressMap
  }

  async migrateFromLocalStorage(user: UserLike | null, isPremium: boolean): Promise<boolean> {
    if (typeof window === 'undefined' || !user?.uid) return false

    const migrationKey = `${STORAGE_KEY}:migrated:${user.uid}`
    if (localStorage.getItem(migrationKey)) return false

    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return false

    try {
      const parsed = JSON.parse(raw) as MoodBoardsProgress
      const entries = Object.entries(parsed)

      for (const [boardId, progress] of entries) {
        const learnedKanji = progress?.learnedKanji || []
        for (const kanjiChar of learnedKanji) {
          await this.markKanjiLearned(boardId, kanjiChar, user, isPremium)
        }
      }

      localStorage.setItem(migrationKey, 'true')
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      return true
    } catch (error) {
      reviewLogger.error('[MoodBoardProgressManager] Failed to migrate localStorage data:', error)
      return false
    }
  }
}

export const moodBoardProgressManager = MoodBoardProgressManager.getInstance()
