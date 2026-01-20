/**
 * Gamification Coordinator
 *
 * Firebase-First Unified Architecture - Server-Side Coordinator
 *
 * Single entry point for ALL gamification operations from server-side.
 * Ensures atomic updates across XP, streaks, and achievements using Firestore transactions.
 *
 * ## Two Integration Pathways:
 *
 * ### 1. Review (URE) Completions:
 * ```
 * URE → gamificationListener (client) → POST /api/review/session/complete
 *     → recordReviewCompletion() → Firestore transaction
 * ```
 *
 * ### 2. Drill Completions:
 * ```
 * Client → PUT /api/drill/session → recordDrillCompletion()
 *     → Firestore transaction
 * ```
 *
 * Both pathways use:
 * - Atomic Firestore transactions
 * - updateStreakWithinTransaction() (reuses parent transaction - NO NESTING!)
 * - Document prefetching optimization
 * - Graceful degradation (streak failures don't crash XP updates)
 *
 * @see updateStreakWithinTransaction in streakService.ts:563
 */

import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import xpConfig from '../../../../config/xp-config.json'

/** Get Firestore instance, throwing if not initialized */
function getDb() {
  if (!adminDb) {
    throw new Error('Firebase Admin Firestore is not initialized')
  }
  return adminDb
}
import { getStreakConfig } from '@/config/gamification/streakConfig'
import { updateStreakWithinTransaction, type StreakUpdateResult } from './streakService'
import { Accuracy } from '@/lib/statistics/accuracy'

// Extract flashcard config from centralized xp-config.json
const flashcardConfig = xpConfig.activities.flashcards

function getMinXpForStreak(): number {
  return getStreakConfig().minXPForStreak
}

function buildCompletionKey(activityType: string, activityId: string): string {
  return `${activityType}_${activityId}`
}

function getCompletionLedgerRef(userId: string, key: string) {
  return getDb().collection('users').doc(userId).collection('completion_ledger').doc(key)
}

/**
 * Calculate XP earned from drill performance
 */
export function calculateDrillXP(params: {
  score: number
  totalQuestions: number
  accuracy: number
}): number {
  const { score, totalQuestions, accuracy } = params

  // Base XP: 5 XP per correct answer
  const baseXP = score * 5

  // Accuracy bonus
  let accuracyBonus = 0
  const normalizedAccuracy = Accuracy.normalize(accuracy)

  if (normalizedAccuracy === 100) {
    accuracyBonus = 50 // Perfect score bonus
  } else if (normalizedAccuracy >= 90) {
    accuracyBonus = 25 // Excellent bonus
  } else if (normalizedAccuracy >= 80) {
    accuracyBonus = 10 // Good bonus
  }

  // Completion bonus (completed all questions)
  const completionBonus = score === totalQuestions ? 20 : 0

  return baseXP + accuracyBonus + completionBonus
}

/**
 * Calculate XP earned from review session
 */
export function calculateReviewXP(params: {
  itemsReviewed: number
  correctCount: number
  accuracy: number
}): number {
  const { itemsReviewed, correctCount, accuracy } = params

  // Base XP: 3 XP per correct review
  const baseXP = correctCount * 3

  // Accuracy bonus
  let accuracyBonus = 0
  const normalizedAccuracy = Accuracy.normalize(accuracy)

  if (normalizedAccuracy === 100) {
    accuracyBonus = 30
  } else if (normalizedAccuracy >= 90) {
    accuracyBonus = 15
  } else if (normalizedAccuracy >= 80) {
    accuracyBonus = 5
  }

  // Volume bonus (for longer sessions)
  const volumeBonus = Math.floor(itemsReviewed / 10) * 5

  return baseXP + accuracyBonus + volumeBonus
}

/**
 * Calculate XP earned from flashcard session
 * Uses centralized xp-config.json - SAME formula as client-side XPConfigService
 */
export function calculateFlashcardXP(params: {
  correctCount: number
  bestStreak: number
  isPerfectSession: boolean
  fastCards: number
}): number {
  const { correctCount, bestStreak, isPerfectSession, fastCards } = params
  const rewards = flashcardConfig.rewards

  // Base XP: perCorrect * correct answers
  const baseXP = correctCount * (rewards.perCorrect || 10)

  // Streak bonus: streakBonus * best streak
  const streakBonus = bestStreak * (rewards.streakBonus || 5)

  // Perfect session bonus (100% accuracy)
  const perfectBonus = isPerfectSession ? (rewards.perfectBonus || 50) : 0

  // Speed bonus: speedBonusPerCard * cards answered under threshold
  const speedBonus = fastCards * (rewards.speedBonusPerCard || 2)

  const totalXP = baseXP + streakBonus + perfectBonus + speedBonus

  // Apply session cap
  const cappedXP = Math.min(totalXP, flashcardConfig.maxPerSession || 500)

  console.log('[Gamification Coordinator] Flashcard XP Calculation:', {
    correctCount,
    bestStreak,
    isPerfectSession,
    fastCards,
    breakdown: { baseXP, streakBonus, perfectBonus, speedBonus },
    totalXP,
    cappedXP,
  })

  return cappedXP
}

/**
 * Result from gamification operations
 */
export interface GamificationResult {
  xpEarned: number
  newTotalXP: number
  newLevel: number
  streakIncremented: boolean
  currentStreak: number
  bestStreak: number
  achievementsUnlocked: string[]
}

function buildIdempotentResult(currentStats: any): GamificationResult {
  const currentXP = currentStats.xp?.total || 0
  return {
    xpEarned: 0,
    newTotalXP: currentXP,
    newLevel: currentStats.xp?.level || Math.max(1, Math.floor(currentXP / 1000)),
    streakIncremented: false,
    currentStreak: currentStats.streak?.current || 0,
    bestStreak: currentStats.streak?.best || 0,
    achievementsUnlocked: [],
  }
}

/**
 * Record drill completion and update all gamification data
 * FIXES: Issue #6 - Now connects drill completion to streak system
 */
export async function recordDrillCompletion(params: {
  userId: string
  sessionId: string
  score: number
  totalQuestions: number
  accuracy: number
  isPremium: boolean
}): Promise<GamificationResult> {
  const { userId, sessionId, score, totalQuestions, accuracy, isPremium } = params

  if (!adminDb) {
    throw new Error('Firebase Admin not initialized')
  }

  // Calculate XP
  const xpEarned = calculateDrillXP({ score, totalQuestions, accuracy })

  // Use transaction for atomic updates
  return await getDb().runTransaction(async transaction => {
    const userStatsRef = getDb().collection('user_stats').doc(userId)
    const statsDoc = await transaction.get(userStatsRef)

    const completionKey = buildCompletionKey('drill', sessionId)
    const completionRef = getCompletionLedgerRef(userId, completionKey)
    const completionDoc = await transaction.get(completionRef)

    const currentStats = statsDoc.data() || {}
    if (completionDoc.exists) {
      return buildIdempotentResult(currentStats)
    }

    // Initialize if doesn't exist (after all reads)
    if (!statsDoc.exists) {
      transaction.set(
        userStatsRef,
        {
          xp: { total: 0, level: 1 },
          sessions: { totalSessions: 0 },
          achievements: {
            unlockedIds: [],
            progress: {},
          },
          metadata: {
            lastUpdated: new Date().toISOString(),
            syncStatus: 'synced',
            schemaVersion: 2,
          },
        },
        { merge: true }
      )
    }
    const currentXP = currentStats.xp?.total || 0
    const newTotalXP = currentXP + xpEarned
    const newLevel = Math.max(1, Math.floor(newTotalXP / 1000))
    const nowIso = new Date().toISOString()
    const today = nowIso.split('T')[0] // yyyy-mm-dd

    // Track daily XP accumulation (CRITICAL FIX: accumulate XP throughout the day)
    const lastXPDate = currentStats.xp?.lastXPDate || null
    const isNewDay = lastXPDate !== today
    const currentDailyXP = isNewDay ? 0 : currentStats.xp?.xpGainedToday || 0
    const newDailyXP = currentDailyXP + xpEarned

    console.log('[Gamification Coordinator] Daily XP Accumulation:', {
      lastXPDate,
      today,
      isNewDay,
      currentDailyXP,
      xpEarnedThisDrill: xpEarned,
      newDailyXP,
      minXpForStreak: getMinXpForStreak(),
    })

    // Update XP (including daily accumulation)
    transaction.update(userStatsRef, {
      'xp.total': newTotalXP,
      'xp.level': newLevel,
      'xp.xpGainedToday': newDailyXP,
      'xp.lastXPDate': today,
      'sessions.totalSessions': FieldValue.increment(1),
      'metadata.lastUpdated': nowIso,
    })

    // Update streak using DAILY XP total (not per-drill XP)
    // CRITICAL FIX: Check daily accumulated XP, not individual drill XP
    // CRITICAL FIX 2: Only update streak ONCE per day
    let streakResult: StreakUpdateResult | null = null
    const minXpForStreak = getMinXpForStreak()
    const lastStreakUpdateDate = currentStats.dates?.lastStreakUpdateDate || null
    const streakAlreadyUpdatedToday = lastStreakUpdateDate === today

    console.log('[Gamification Coordinator] Streak Update Check:', {
      newDailyXP,
      minXpForStreak,
      lastStreakUpdateDate,
      today,
      streakAlreadyUpdatedToday,
    })

    if (newDailyXP >= minXpForStreak && !streakAlreadyUpdatedToday) {
      try {
        const result = await updateStreakWithinTransaction(
          transaction,
          userId,
          newDailyXP, // Pass daily total, not individual drill XP
          {
            isPremium,
            db: adminDb!,
            prefetchedDoc: statsDoc,
          }
        )

        if (!result.success) {
          console.error('[Gamification Coordinator] Streak update returned failure:', result.error)
        } else {
          streakResult = result
          // Mark that streak was updated today
          transaction.update(userStatsRef, {
            'dates.lastStreakUpdateDate': today,
          })
          console.log('[Gamification Coordinator] ✅ Streak updated and marked for today')
        }
      } catch (error) {
        console.error('[Gamification Coordinator] Failed to update streak:', error)
        // Don't fail the whole transaction if streak update fails
      }
    } else if (streakAlreadyUpdatedToday) {
      console.log('[Gamification Coordinator] ⏭️ Streak already updated today, skipping:', {
        lastStreakUpdateDate,
        currentStreak: currentStats.streak?.current || 0,
      })
    } else {
      console.log('[Gamification Coordinator] Daily XP below threshold, streak not updated:', {
        newDailyXP,
        minXpForStreak,
      })
    }

    // Check for achievements
    const achievements: string[] = []

    // Perfect drill achievement
    if (accuracy === 100 && totalQuestions >= 10) {
      const achievementId = 'perfect_drill'
      const currentProgress = currentStats.achievements?.progress || {}

      if (!currentStats.achievements?.unlockedIds?.includes(achievementId)) {
        const perfectCount = (currentProgress[achievementId] || 0) + 1

        if (perfectCount >= 10) {
          // Unlock achievement
          transaction.update(userStatsRef, {
            'achievements.unlockedIds': FieldValue.arrayUnion(achievementId),
            [`achievements.progress.${achievementId}`]: perfectCount,
          })
          achievements.push(achievementId)
        } else {
          // Update progress
          transaction.update(userStatsRef, {
            [`achievements.progress.${achievementId}`]: perfectCount,
          })
        }
      }
    }

    const fallbackStreak = {
      current: currentStats.streak?.current || 0,
      best: currentStats.streak?.best || 0,
    }
    const streakData = streakResult?.data ?? fallbackStreak
    const streakIncremented = streakResult?.success ? streakResult.streakIncremented : false

    transaction.set(completionRef, {
      activityType: 'drill',
      activityId: sessionId,
      sessionId,
      xpEarned,
      createdAt: nowIso,
    })

    return {
      xpEarned,
      newTotalXP,
      newLevel,
      streakIncremented,
      currentStreak: streakData.current,
      bestStreak: streakData.best,
      achievementsUnlocked: achievements,
    }
  })
}

/**
 * Record review session completion
 * Supports both generic review sessions and flashcard-specific sessions
 * When flashcard params (bestStreak, fastCards) are provided, uses flashcard XP formula
 */
export async function recordReviewCompletion(params: {
  userId: string
  sessionId: string
  itemsReviewed: number
  correctCount: number
  accuracy: number
  isPremium: boolean
  // Flashcard-specific params (optional - for flashcard sessions)
  bestStreak?: number
  fastCards?: number
}): Promise<GamificationResult> {
  const { userId, sessionId, itemsReviewed, correctCount, accuracy, isPremium, bestStreak, fastCards } = params

  if (!adminDb) {
    throw new Error('Firebase Admin not initialized')
  }

  // Calculate XP - use flashcard formula if flashcard params provided
  const isFlashcardSession = bestStreak !== undefined && fastCards !== undefined
  const xpEarned = isFlashcardSession
    ? calculateFlashcardXP({
        correctCount,
        bestStreak: bestStreak!,
        isPerfectSession: accuracy === 100 || accuracy === 1, // Support both 0-100 and 0-1 formats
        fastCards: fastCards!,
      })
    : calculateReviewXP({ itemsReviewed, correctCount, accuracy })

  // Use transaction for atomic updates
  return await getDb().runTransaction(async transaction => {
    const userStatsRef = getDb().collection('user_stats').doc(userId)
    const statsDoc = await transaction.get(userStatsRef)

    const completionKey = buildCompletionKey('review', sessionId)
    const completionRef = getCompletionLedgerRef(userId, completionKey)
    const completionDoc = await transaction.get(completionRef)

    const currentStats = statsDoc.data() || {}
    if (completionDoc.exists) {
      return buildIdempotentResult(currentStats)
    }

    // Initialize if doesn't exist (after all reads)
    if (!statsDoc.exists) {
      transaction.set(
        userStatsRef,
        {
          xp: { total: 0, level: 1 },
          sessions: { totalSessions: 0 },
          achievements: {
            unlockedIds: [],
            progress: {},
          },
          metadata: {
            lastUpdated: new Date().toISOString(),
            syncStatus: 'synced',
            schemaVersion: 2,
          },
        },
        { merge: true }
      )
    }
    const currentXP = currentStats.xp?.total || 0
    const newTotalXP = currentXP + xpEarned
    const newLevel = Math.max(1, Math.floor(newTotalXP / 1000))
    const nowIso = new Date().toISOString()
    const today = nowIso.split('T')[0] // yyyy-mm-dd

    // Track daily XP accumulation (CRITICAL FIX: accumulate XP throughout the day)
    const lastXPDate = currentStats.xp?.lastXPDate || null
    const isNewDay = lastXPDate !== today
    const currentDailyXP = isNewDay ? 0 : currentStats.xp?.xpGainedToday || 0
    const newDailyXP = currentDailyXP + xpEarned

    console.log('[Gamification Coordinator] Daily XP Accumulation (Review):', {
      lastXPDate,
      today,
      isNewDay,
      currentDailyXP,
      xpEarnedThisReview: xpEarned,
      newDailyXP,
      minXpForStreak: getMinXpForStreak(),
    })

    // Update XP (including daily accumulation)
    transaction.update(userStatsRef, {
      'xp.total': newTotalXP,
      'xp.level': newLevel,
      'xp.xpGainedToday': newDailyXP,
      'xp.lastXPDate': today,
      'sessions.totalSessions': FieldValue.increment(1),
      'metadata.lastUpdated': nowIso,
    })

    // Update streak using DAILY XP total (not per-review XP)
    // CRITICAL FIX: Check daily accumulated XP, not individual review XP
    // CRITICAL FIX 2: Only update streak ONCE per day
    let streakResult: StreakUpdateResult | null = null
    const minXpForStreak = getMinXpForStreak()
    const lastStreakUpdateDate = currentStats.dates?.lastStreakUpdateDate || null
    const streakAlreadyUpdatedToday = lastStreakUpdateDate === today

    console.log('[Gamification Coordinator] Streak Update Check (Review):', {
      newDailyXP,
      minXpForStreak,
      lastStreakUpdateDate,
      today,
      streakAlreadyUpdatedToday,
    })

    if (newDailyXP >= minXpForStreak && !streakAlreadyUpdatedToday) {
      try {
        const result = await updateStreakWithinTransaction(
          transaction,
          userId,
          newDailyXP, // Pass daily total, not individual review XP
          {
            isPremium,
            db: adminDb!,
            prefetchedDoc: statsDoc,
          }
        )

        if (!result.success) {
          console.error('[Gamification Coordinator] Streak update returned failure:', result.error)
        } else {
          streakResult = result
          // Mark that streak was updated today
          transaction.update(userStatsRef, {
            'dates.lastStreakUpdateDate': today,
          })
          console.log('[Gamification Coordinator] ✅ Streak updated and marked for today (Review)')
        }
      } catch (error) {
        console.error('[Gamification Coordinator] Failed to update streak:', error)
      }
    } else if (streakAlreadyUpdatedToday) {
      console.log(
        '[Gamification Coordinator] ⏭️ Streak already updated today, skipping (Review):',
        {
          lastStreakUpdateDate,
          currentStreak: currentStats.streak?.current || 0,
        }
      )
    } else {
      console.log('[Gamification Coordinator] Daily XP below threshold, streak not updated:', {
        newDailyXP,
        minXpForStreak,
      })
    }

    const fallbackStreak = {
      current: currentStats.streak?.current || 0,
      best: currentStats.streak?.best || 0,
    }
    const streakData = streakResult?.data ?? fallbackStreak
    const streakIncremented = streakResult?.success ? streakResult.streakIncremented : false

    transaction.set(completionRef, {
      activityType: 'review',
      activityId: sessionId,
      sessionId,
      xpEarned,
      createdAt: nowIso,
    })

    return {
      xpEarned,
      newTotalXP,
      newLevel,
      streakIncremented,
      currentStreak: streakData.current,
      bestStreak: streakData.best,
      achievementsUnlocked: [],
    }
  })
}

/**
 * Manually award XP (for special events, bonuses, etc.)
 */
export async function awardManualXP(params: {
  userId: string
  amount: number
  reason: string
}): Promise<{ newTotalXP: number; newLevel: number }> {
  const { userId, amount, reason } = params

  if (!adminDb) {
    throw new Error('Firebase Admin not initialized')
  }

  return await getDb().runTransaction(async transaction => {
    const userStatsRef = getDb().collection('user_stats').doc(userId)
    const statsDoc = await transaction.get(userStatsRef)

    const currentStats = statsDoc.data() || {}
    const currentXP = currentStats.xp?.total || 0
    const newTotalXP = currentXP + amount
    const newLevel = Math.max(1, Math.floor(newTotalXP / 1000))

    transaction.update(userStatsRef, {
      'xp.total': newTotalXP,
      'xp.level': newLevel,
      'metadata.lastUpdated': new Date().toISOString(),
    })

    // Log the manual XP award
    const logRef = getDb().collection('xp_logs').doc()
    transaction.set(logRef, {
      userId,
      amount,
      reason,
      timestamp: FieldValue.serverTimestamp(),
    })

    return { newTotalXP, newLevel }
  })
}

/**
 * Calculate XP earned from news reading
 * Linear formula: 1 XP per 30 seconds of active reading, capped at 50 XP
 */
export function calculateNewsXP(params: { readingTimeMs: number }): number {
  const { readingTimeMs } = params

  // Linear: 1 XP per 30 seconds (30000ms)
  const baseXP = Math.floor(readingTimeMs / 30000)

  // Cap at 50 XP per article
  return Math.min(baseXP, 50)
}

/**
 * Record news article completion and award XP
 * Follows the same pattern as recordDrillCompletion for consistency
 */
export async function recordNewsCompletion(params: {
  userId: string
  articleId: string
  readingTimeMs: number
  difficulty: string
  isPremium: boolean
}): Promise<GamificationResult> {
  const { userId, articleId, readingTimeMs, isPremium } = params

  if (!adminDb) {
    throw new Error('Firebase Admin not initialized')
  }

  // Calculate XP from reading time
  const xpEarned = calculateNewsXP({ readingTimeMs })

  // If no XP earned (read less than 30 seconds), return early
  if (xpEarned === 0) {
    return {
      xpEarned: 0,
      newTotalXP: 0,
      newLevel: 1,
      streakIncremented: false,
      currentStreak: 0,
      bestStreak: 0,
      achievementsUnlocked: [],
    }
  }

  // Use transaction for atomic updates
  return await getDb().runTransaction(async transaction => {
    const userStatsRef = getDb().collection('user_stats').doc(userId)
    const statsDoc = await transaction.get(userStatsRef)

    const completionKey = buildCompletionKey('news', articleId)
    const completionRef = getCompletionLedgerRef(userId, completionKey)
    const completionDoc = await transaction.get(completionRef)

    const currentStats = statsDoc.data() || {}
    if (completionDoc.exists) {
      return buildIdempotentResult(currentStats)
    }

    // Initialize if doesn't exist (after all reads)
    if (!statsDoc.exists) {
      transaction.set(
        userStatsRef,
        {
          xp: { total: 0, level: 1 },
          sessions: { totalSessions: 0 },
          news: { articlesRead: 0, totalReadingTimeMs: 0 },
          achievements: {
            unlockedIds: [],
            progress: {},
          },
          metadata: {
            lastUpdated: new Date().toISOString(),
            syncStatus: 'synced',
            schemaVersion: 2,
          },
        },
        { merge: true }
      )
    }
    const currentXP = currentStats.xp?.total || 0
    const newTotalXP = currentXP + xpEarned
    const newLevel = Math.max(1, Math.floor(newTotalXP / 1000))
    const nowIso = new Date().toISOString()
    const today = nowIso.split('T')[0] // yyyy-mm-dd

    // Track daily XP accumulation
    const lastXPDate = currentStats.xp?.lastXPDate || null
    const isNewDay = lastXPDate !== today
    const currentDailyXP = isNewDay ? 0 : currentStats.xp?.xpGainedToday || 0
    const newDailyXP = currentDailyXP + xpEarned

    console.log('[Gamification Coordinator] News Reading XP:', {
      articleId,
      readingTimeMs,
      xpEarned,
      newDailyXP,
      minXpForStreak: getMinXpForStreak(),
    })

    // Update XP and news stats
    transaction.update(userStatsRef, {
      'xp.total': newTotalXP,
      'xp.level': newLevel,
      'xp.xpGainedToday': newDailyXP,
      'xp.lastXPDate': today,
      'news.articlesRead': FieldValue.increment(1),
      'news.totalReadingTimeMs': FieldValue.increment(readingTimeMs),
      'metadata.lastUpdated': nowIso,
    })

    // Update streak using DAILY XP total
    let streakResult: StreakUpdateResult | null = null
    const minXpForStreak = getMinXpForStreak()
    const lastStreakUpdateDate = currentStats.dates?.lastStreakUpdateDate || null
    const streakAlreadyUpdatedToday = lastStreakUpdateDate === today

    if (newDailyXP >= minXpForStreak && !streakAlreadyUpdatedToday) {
      try {
        const result = await updateStreakWithinTransaction(transaction, userId, newDailyXP, {
          isPremium,
          db: adminDb!,
          prefetchedDoc: statsDoc,
        })

        if (result.success) {
          streakResult = result
          transaction.update(userStatsRef, {
            'dates.lastStreakUpdateDate': today,
          })
          console.log('[Gamification Coordinator] ✅ Streak updated from news reading')
        }
      } catch (error) {
        console.error('[Gamification Coordinator] Failed to update streak from news:', error)
      }
    }

    // Check for news-specific achievements
    const achievements: string[] = []
    const articlesRead = (currentStats.news?.articlesRead || 0) + 1

    // "Avid Reader" achievement: Read 10 articles
    if (articlesRead === 10) {
      const achievementId = 'avid_reader'
      if (!currentStats.achievements?.unlockedIds?.includes(achievementId)) {
        transaction.update(userStatsRef, {
          'achievements.unlockedIds': FieldValue.arrayUnion(achievementId),
        })
        achievements.push(achievementId)
      }
    }

    // "News Junkie" achievement: Read 50 articles
    if (articlesRead === 50) {
      const achievementId = 'news_junkie'
      if (!currentStats.achievements?.unlockedIds?.includes(achievementId)) {
        transaction.update(userStatsRef, {
          'achievements.unlockedIds': FieldValue.arrayUnion(achievementId),
        })
        achievements.push(achievementId)
      }
    }

    const fallbackStreak = {
      current: currentStats.streak?.current || 0,
      best: currentStats.streak?.best || 0,
    }
    const streakData = streakResult?.data ?? fallbackStreak
    const streakIncremented = streakResult?.success ? streakResult.streakIncremented : false

    transaction.set(completionRef, {
      activityType: 'news',
      activityId: articleId,
      xpEarned,
      createdAt: nowIso,
    })

    return {
      xpEarned,
      newTotalXP,
      newLevel,
      streakIncremented,
      currentStreak: streakData.current,
      bestStreak: streakData.best,
      achievementsUnlocked: achievements,
    }
  })
}

/**
 * Calculate XP earned from book reading
 * Linear formula: 1 XP per 30 seconds of active reading, capped at 50 XP
 */
export function calculateBookXP(params: { readingTimeSec: number }): number {
  const { readingTimeSec } = params

  // Linear: 1 XP per 30 seconds
  const baseXP = Math.floor(readingTimeSec / 30)

  // Cap at 50 XP per book completion
  return Math.min(baseXP, 50)
}

/**
 * Record book completion and award XP
 * Follows the same pattern as recordNewsCompletion for consistency
 */
export async function recordBookCompletion(params: {
  userId: string
  bookId: string
  readingTimeSec: number
  isPremium: boolean
}): Promise<GamificationResult> {
  const { userId, bookId, readingTimeSec, isPremium } = params

  if (!adminDb) {
    throw new Error('Firebase Admin not initialized')
  }

  // Calculate XP from reading time
  const xpEarned = calculateBookXP({ readingTimeSec })

  // If no XP earned (read less than 30 seconds), return early
  if (xpEarned === 0) {
    return {
      xpEarned: 0,
      newTotalXP: 0,
      newLevel: 1,
      streakIncremented: false,
      currentStreak: 0,
      bestStreak: 0,
      achievementsUnlocked: [],
    }
  }

  // Use transaction for atomic updates
  return await getDb().runTransaction(async transaction => {
    const userStatsRef = getDb().collection('user_stats').doc(userId)
    const statsDoc = await transaction.get(userStatsRef)

    const completionKey = buildCompletionKey('book', bookId)
    const completionRef = getCompletionLedgerRef(userId, completionKey)
    const completionDoc = await transaction.get(completionRef)

    const currentStats = statsDoc.data() || {}
    if (completionDoc.exists) {
      return buildIdempotentResult(currentStats)
    }

    // Initialize if doesn't exist (after all reads)
    if (!statsDoc.exists) {
      transaction.set(
        userStatsRef,
        {
          xp: { total: 0, level: 1 },
          sessions: { totalSessions: 0 },
          books: { booksRead: 0, totalReadingTimeSec: 0 },
          achievements: {
            unlockedIds: [],
            progress: {},
          },
          metadata: {
            lastUpdated: new Date().toISOString(),
            syncStatus: 'synced',
            schemaVersion: 2,
          },
        },
        { merge: true }
      )
    }
    const currentXP = currentStats.xp?.total || 0
    const newTotalXP = currentXP + xpEarned
    const newLevel = Math.max(1, Math.floor(newTotalXP / 1000))
    const nowIso = new Date().toISOString()
    const today = nowIso.split('T')[0] // yyyy-mm-dd

    // Track daily XP accumulation
    const lastXPDate = currentStats.xp?.lastXPDate || null
    const isNewDay = lastXPDate !== today
    const currentDailyXP = isNewDay ? 0 : currentStats.xp?.xpGainedToday || 0
    const newDailyXP = currentDailyXP + xpEarned

    console.log('[Gamification Coordinator] Book Reading XP:', {
      bookId,
      readingTimeSec,
      xpEarned,
      newDailyXP,
      minXpForStreak: getMinXpForStreak(),
    })

    // Update XP and book stats
    transaction.update(userStatsRef, {
      'xp.total': newTotalXP,
      'xp.level': newLevel,
      'xp.xpGainedToday': newDailyXP,
      'xp.lastXPDate': today,
      'books.booksRead': FieldValue.increment(1),
      'books.totalReadingTimeSec': FieldValue.increment(readingTimeSec),
      'metadata.lastUpdated': nowIso,
    })

    // Update streak using DAILY XP total
    let streakResult: StreakUpdateResult | null = null
    const minXpForStreak = getMinXpForStreak()
    const lastStreakUpdateDate = currentStats.dates?.lastStreakUpdateDate || null
    const streakAlreadyUpdatedToday = lastStreakUpdateDate === today

    if (newDailyXP >= minXpForStreak && !streakAlreadyUpdatedToday) {
      try {
        const result = await updateStreakWithinTransaction(transaction, userId, newDailyXP, {
          isPremium,
          db: adminDb!,
          prefetchedDoc: statsDoc,
        })

        if (result.success) {
          streakResult = result
          transaction.update(userStatsRef, {
            'dates.lastStreakUpdateDate': today,
          })
          console.log('[Gamification Coordinator] ✅ Streak updated from book reading')
        }
      } catch (error) {
        console.error('[Gamification Coordinator] Failed to update streak from book:', error)
      }
    }

    // Check for book-specific achievements
    const achievements: string[] = []
    const booksRead = (currentStats.books?.booksRead || 0) + 1

    // "Bookworm" achievement: Read 5 books
    if (booksRead === 5) {
      const achievementId = 'bookworm'
      if (!currentStats.achievements?.unlockedIds?.includes(achievementId)) {
        transaction.update(userStatsRef, {
          'achievements.unlockedIds': FieldValue.arrayUnion(achievementId),
        })
        achievements.push(achievementId)
      }
    }

    // "Library Master" achievement: Read 20 books
    if (booksRead === 20) {
      const achievementId = 'library_master'
      if (!currentStats.achievements?.unlockedIds?.includes(achievementId)) {
        transaction.update(userStatsRef, {
          'achievements.unlockedIds': FieldValue.arrayUnion(achievementId),
        })
        achievements.push(achievementId)
      }
    }

    const fallbackStreak = {
      current: currentStats.streak?.current || 0,
      best: currentStats.streak?.best || 0,
    }
    const streakData = streakResult?.data ?? fallbackStreak
    const streakIncremented = streakResult?.success ? streakResult.streakIncremented : false

    transaction.set(completionRef, {
      activityType: 'book',
      activityId: bookId,
      xpEarned,
      createdAt: nowIso,
    })

    return {
      xpEarned,
      newTotalXP,
      newLevel,
      streakIncremented,
      currentStreak: streakData.current,
      bestStreak: streakData.best,
      achievementsUnlocked: achievements,
    }
  })
}

/**
 * Calculate XP earned from quiz completion
 * Tiered formula based on score percentage:
 * - 80%+ = 30 XP (Excellent)
 * - 60-79% = 15 XP (Good)
 * - 40-59% = 5 XP (Passing)
 * - <40% = 0 XP (No reward)
 */
export function calculateQuizXP(params: { score: number }): number {
  const { score } = params

  if (score >= 80) return 30
  if (score >= 60) return 15
  if (score >= 40) return 5
  return 0
}

/**
 * Record quiz completion and award XP
 * Used for both story and comic quizzes
 * XP is only awarded on first completion (no retakes)
 */
export async function recordQuizCompletion(params: {
  userId: string
  contentType: 'story' | 'comic'
  contentId: string
  score: number
  totalQuestions: number
  correctAnswers: number
  isPremium: boolean
}): Promise<GamificationResult> {
  const { userId, contentType, contentId, score, totalQuestions, correctAnswers, isPremium } =
    params

  if (!adminDb) {
    throw new Error('Firebase Admin not initialized')
  }

  // Calculate XP from score
  const xpEarned = calculateQuizXP({ score })

  // If no XP earned (score < 40%), return early
  if (xpEarned === 0) {
    return {
      xpEarned: 0,
      newTotalXP: 0,
      newLevel: 1,
      streakIncremented: false,
      currentStreak: 0,
      bestStreak: 0,
      achievementsUnlocked: [],
    }
  }

  // Use transaction for atomic updates
  return await getDb().runTransaction(async transaction => {
    const userStatsRef = getDb().collection('user_stats').doc(userId)
    const statsDoc = await transaction.get(userStatsRef)

    // Initialize if doesn't exist
    if (!statsDoc.exists) {
      transaction.set(
        userStatsRef,
        {
          xp: { total: 0, level: 1 },
          sessions: { totalSessions: 0 },
          quiz: { completed: 0, totalScore: 0 },
          achievements: {
            unlockedIds: [],
            progress: {},
          },
          metadata: {
            lastUpdated: new Date().toISOString(),
            syncStatus: 'synced',
            schemaVersion: 2,
          },
        },
        { merge: true }
      )
    }

    const currentStats = statsDoc.data() || {}
    const completionKey = buildCompletionKey('quiz', `${contentType}_${contentId}`)
    const completionRef = getCompletionLedgerRef(userId, completionKey)
    const completionDoc = await transaction.get(completionRef)

    if (completionDoc.exists) {
      return buildIdempotentResult(currentStats)
    }
    const currentXP = currentStats.xp?.total || 0
    const newTotalXP = currentXP + xpEarned
    const newLevel = Math.max(1, Math.floor(newTotalXP / 1000))
    const nowIso = new Date().toISOString()
    const today = nowIso.split('T')[0] // yyyy-mm-dd

    // Track daily XP accumulation
    const lastXPDate = currentStats.xp?.lastXPDate || null
    const isNewDay = lastXPDate !== today
    const currentDailyXP = isNewDay ? 0 : currentStats.xp?.xpGainedToday || 0
    const newDailyXP = currentDailyXP + xpEarned

    console.log('[Gamification Coordinator] Quiz XP:', {
      contentType,
      contentId,
      score,
      correctAnswers,
      totalQuestions,
      xpEarned,
      newDailyXP,
      minXpForStreak: getMinXpForStreak(),
    })

    // Update XP and quiz stats
    transaction.update(userStatsRef, {
      'xp.total': newTotalXP,
      'xp.level': newLevel,
      'xp.xpGainedToday': newDailyXP,
      'xp.lastXPDate': today,
      'quiz.completed': FieldValue.increment(1),
      'quiz.totalScore': FieldValue.increment(score),
      'metadata.lastUpdated': nowIso,
    })

    // Update streak using DAILY XP total
    let streakResult: StreakUpdateResult | null = null
    const minXpForStreak = getMinXpForStreak()
    const lastStreakUpdateDate = currentStats.dates?.lastStreakUpdateDate || null
    const streakAlreadyUpdatedToday = lastStreakUpdateDate === today

    if (newDailyXP >= minXpForStreak && !streakAlreadyUpdatedToday) {
      try {
        const result = await updateStreakWithinTransaction(transaction, userId, newDailyXP, {
          isPremium,
          db: adminDb!,
          prefetchedDoc: statsDoc,
        })

        if (result.success) {
          streakResult = result
          transaction.update(userStatsRef, {
            'dates.lastStreakUpdateDate': today,
          })
          console.log('[Gamification Coordinator] ✅ Streak updated from quiz completion')
        }
      } catch (error) {
        console.error('[Gamification Coordinator] Failed to update streak from quiz:', error)
      }
    }

    // Check for quiz-specific achievements
    const achievements: string[] = []

    // "Quiz Master" achievement: Complete 10 quizzes with 80%+ score
    if (score >= 80) {
      const achievementId = 'quiz_master'
      const currentProgress = currentStats.achievements?.progress || {}
      const highScoreCount = (currentProgress[achievementId] || 0) + 1

      if (!currentStats.achievements?.unlockedIds?.includes(achievementId)) {
        if (highScoreCount >= 10) {
          transaction.update(userStatsRef, {
            'achievements.unlockedIds': FieldValue.arrayUnion(achievementId),
            [`achievements.progress.${achievementId}`]: highScoreCount,
          })
          achievements.push(achievementId)
        } else {
          transaction.update(userStatsRef, {
            [`achievements.progress.${achievementId}`]: highScoreCount,
          })
        }
      }
    }

    // "Perfect Score" achievement: Get 100% on any quiz
    if (score === 100) {
      const achievementId = 'perfect_quiz'
      if (!currentStats.achievements?.unlockedIds?.includes(achievementId)) {
        transaction.update(userStatsRef, {
          'achievements.unlockedIds': FieldValue.arrayUnion(achievementId),
        })
        achievements.push(achievementId)
      }
    }

    const fallbackStreak = {
      current: currentStats.streak?.current || 0,
      best: currentStats.streak?.best || 0,
    }
    const streakData = streakResult?.data ?? fallbackStreak
    const streakIncremented = streakResult?.success ? streakResult.streakIncremented : false

    transaction.set(completionRef, {
      activityType: 'quiz',
      activityId: `${contentType}_${contentId}`,
      contentType,
      contentId,
      xpEarned,
      createdAt: nowIso,
    })

    return {
      xpEarned,
      newTotalXP,
      newLevel,
      streakIncremented,
      currentStreak: streakData.current,
      bestStreak: streakData.best,
      achievementsUnlocked: achievements,
    }
  })
}
