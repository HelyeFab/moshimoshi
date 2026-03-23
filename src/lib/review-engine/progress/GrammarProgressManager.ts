/**
 * Grammar Progress Manager
 * Tracks grammar practice progress with UniversalProgressManager
 */

import { UniversalProgressManager } from './UniversalProgressManager'
import {
  ReviewProgressData,
  ProgressSessionSummary,
} from '../core/progress.types'
import type { SessionStatistics } from '../core/session.types'
import { reviewLogger } from '@/lib/monitoring/logger'

export interface GrammarProgressData extends ReviewProgressData {
  grammarPointId: string
  totalSessions: number
  totalExercises: number
  lastAccuracy: number
  bestAccuracy: number
  lastPracticedAt: string | null
  mode?: string
  jlptLevel?: string
}

export interface GrammarSessionData {
  sessionId: string
  grammarPointId: string
  userId: string
  totalItems: number
  correctItems: number
  incorrectItems: number
  skippedItems?: number
  accuracy: number
  startedAt?: string
  endedAt?: string
  durationMs?: number
  mode?: string
  exerciseIds?: string[]
  jlptLevel?: string
}

export class GrammarProgressManager extends UniversalProgressManager<GrammarProgressData> {
  private static instance: GrammarProgressManager | null = null

  static getInstance(): GrammarProgressManager {
    if (!GrammarProgressManager.instance) {
      GrammarProgressManager.instance = new GrammarProgressManager()
    }
    return GrammarProgressManager.instance
  }

  private constructor() {
    super()
  }

  async startGrammarSession(userId: string, grammarPointId: string, user?: any | null) {
    const sessionId = `grammar_${grammarPointId}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`
    return this.startSession(userId, 'grammar', sessionId, user)
  }

  async trackGrammarSession(
    session: GrammarSessionData,
    user: any | null,
    isPremium: boolean
  ): Promise<void> {
    if (!user?.uid) {
      reviewLogger.debug('[GrammarProgressManager] No user - skipping tracking')
      return
    }

    const now = new Date().toISOString()
    const userId = user.uid

    await this.initDB()

    const existing = await this.getProgressItem(userId, 'grammar', session.grammarPointId)
    const progress = existing
      ? { ...existing }
      : this.createInitialProgress(session.grammarPointId, 'grammar')

    const totalAttempts = session.correctItems + session.incorrectItems
    const newCorrect = progress.correctCount + session.correctItems
    const newIncorrect = progress.incorrectCount + session.incorrectItems
    const totalAnswered = newCorrect + newIncorrect

    progress.contentId = session.grammarPointId
    progress.grammarPointId = session.grammarPointId
    progress.correctCount = newCorrect
    progress.incorrectCount = newIncorrect
    progress.interactionCount += totalAttempts
    progress.viewCount += session.totalItems
    progress.accuracy = totalAnswered > 0 ? (newCorrect / totalAnswered) * 100 : 0
    progress.lastAccuracy = session.accuracy
    progress.bestAccuracy = Math.max(progress.bestAccuracy || 0, session.accuracy)
    progress.totalSessions = (progress.totalSessions || 0) + 1
    progress.totalExercises = (progress.totalExercises || 0) + session.totalItems
    progress.lastPracticedAt = now
    progress.lastInteractedAt = now
    progress.lastViewedAt = now
    progress.firstViewedAt = progress.firstViewedAt || now
    progress.updatedAt = now
    progress.mode = session.mode
    progress.jlptLevel = session.jlptLevel

    if (progress.accuracy >= 80) {
      progress.status = 'learned'
    } else if (progress.viewCount > 0) {
      progress.status = 'learning'
    } else {
      progress.status = 'not-started'
    }

    await this.saveProgress(userId, 'grammar', session.grammarPointId, progress, isPremium)

    await this.saveSessionSummary(session, isPremium)
  }

  async getProgress(
    userId: string,
    contentType: string,
    _isPremium: boolean
  ): Promise<Map<string, GrammarProgressData>> {
    const localData = await this.loadFromIndexedDB(userId, contentType)
    if (navigator.onLine) {
      try {
        const cloudData = await this.loadFromFirebase(userId, contentType)
        return this.mergeProgress(userId, contentType, localData, cloudData)
      } catch (error) {
        reviewLogger.error('[GrammarProgressManager] Failed to load from Firebase:', error)
      }
    }
    return localData
  }

  protected async saveProgress(
    userId: string,
    contentType: string,
    contentId: string,
    progress: GrammarProgressData,
    _isPremium: boolean
  ): Promise<void> {
    await this.saveToIndexedDB(userId, contentType, contentId, progress)
    this.queueFirebaseSync(userId, contentType, contentId, progress)
  }

  protected async saveSession(
    session: ProgressSessionSummary,
    _isPremium: boolean
  ): Promise<void> {
    await super.saveSession(session, true)
  }

  async trackSessionFromStatistics(
    grammarPointId: string,
    stats: SessionStatistics,
    user: any | null,
    isPremium: boolean,
    context?: { mode?: string; jlptLevel?: string; exerciseIds?: string[] }
  ) {
    if (!user?.uid) return

    const sessionData: GrammarSessionData = {
      sessionId: stats.sessionId,
      grammarPointId,
      userId: user.uid,
      totalItems: stats.totalItems,
      correctItems: stats.correctItems,
      incorrectItems: stats.incorrectItems,
      skippedItems: stats.skippedItems,
      accuracy: stats.accuracy,
      durationMs: stats.totalTime,
      mode: context?.mode,
      jlptLevel: context?.jlptLevel,
      exerciseIds: context?.exerciseIds,
    }

    await this.trackGrammarSession(sessionData, user, isPremium)
  }

  protected createInitialProgress(contentId: string, contentType: string): GrammarProgressData {
    const base = super.createInitialProgress(contentId, contentType)
    return {
      ...base,
      grammarPointId: contentId,
      totalSessions: 0,
      totalExercises: 0,
      lastAccuracy: 0,
      bestAccuracy: 0,
      lastPracticedAt: null,
    }
  }

  private async saveSessionSummary(
    session: GrammarSessionData,
    isPremium: boolean
  ): Promise<void> {
    const startedAt = session.startedAt || new Date().toISOString()
    const endedAt = session.endedAt || new Date().toISOString()
    const items = session.exerciseIds || []

    const summary: ProgressSessionSummary = {
      sessionId: session.sessionId,
      userId: session.userId,
      contentType: 'grammar',
      startedAt,
      endedAt,
      duration: session.durationMs || 0,
      itemsViewed: items,
      itemsInteracted: items,
      itemsCompleted: items,
      itemsSkipped: [],
      totalItems: session.totalItems,
      completionRate:
        session.totalItems > 0
          ? ((session.totalItems - (session.skippedItems || 0)) / session.totalItems) * 100
          : 0,
      accuracy: session.accuracy,
      averageResponseTime:
        session.totalItems > 0 && session.durationMs
          ? session.durationMs / session.totalItems
          : 0,
      completed: true,
      syncedToCloud: false,
    }

    await this.saveSession(summary, isPremium)
  }
}

export const getGrammarProgressManager = () => GrammarProgressManager.getInstance()
