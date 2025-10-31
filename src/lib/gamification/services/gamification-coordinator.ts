/**
 * Gamification Coordinator
 *
 * Fixes Issue #6: Missing streak on drill completion
 *
 * Single entry point for all gamification operations.
 * Ensures atomic updates across XP, streaks, and achievements.
 * Connects drills/reviews to streak system.
 */

import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { updateStreakTransaction } from './streakService'
import { Accuracy } from '@/lib/statistics/accuracy'

// Minimum XP required to count toward streak
const MIN_XP_FOR_STREAK = 25

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
  const { userId, score, totalQuestions, accuracy, isPremium } = params

  if (!adminDb) {
    throw new Error('Firebase Admin not initialized')
  }

  // Calculate XP
  const xpEarned = calculateDrillXP({ score, totalQuestions, accuracy })

  // Use transaction for atomic updates
  return await adminDb.runTransaction(async (transaction) => {
    const userStatsRef = adminDb.collection('user_stats').doc(userId)
    const statsDoc = await transaction.get(userStatsRef)

    // Initialize if doesn't exist
    if (!statsDoc.exists) {
      transaction.set(userStatsRef, {
        xp: { total: 0, level: 1 },
        streak: {
          current: 0,
          best: 0,
          freezesRemaining: isPremium ? 3 : 0,
          version: 1,
          updatedAt: FieldValue.serverTimestamp()
        },
        dates: {
          lastActivityDate: null,
          isActiveToday: false
        },
        sessions: { totalSessions: 0 },
        achievements: {
          unlockedIds: [],
          progress: {}
        },
        metadata: {
          lastUpdated: new Date().toISOString(),
          syncStatus: 'synced',
          schemaVersion: 2
        }
      })
    }

    const currentStats = statsDoc.data() || {}
    const currentXP = currentStats.xp?.total || 0
    const newTotalXP = currentXP + xpEarned
    const newLevel = Math.max(1, Math.floor(newTotalXP / 1000))

    // Update XP
    transaction.update(userStatsRef, {
      'xp.total': newTotalXP,
      'xp.level': newLevel,
      'sessions.totalSessions': FieldValue.increment(1),
      'metadata.lastUpdated': new Date().toISOString()
    })

    // Update streak if XP threshold met
    let streakResult = {
      streakIncremented: false,
      data: {
        current: currentStats.streak?.current || 0,
        best: currentStats.streak?.best || 0
      }
    }

    if (xpEarned >= MIN_XP_FOR_STREAK) {
      try {
        streakResult = await updateStreakTransaction(
          transaction,
          userId,
          xpEarned,
          { isPremium }
        )
      } catch (error) {
        console.error('[Gamification Coordinator] Failed to update streak:', error)
        // Don't fail the whole transaction if streak update fails
      }
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
            [`achievements.progress.${achievementId}`]: perfectCount
          })
          achievements.push(achievementId)
        } else {
          // Update progress
          transaction.update(userStatsRef, {
            [`achievements.progress.${achievementId}`]: perfectCount
          })
        }
      }
    }

    return {
      xpEarned,
      newTotalXP,
      newLevel,
      streakIncremented: streakResult.streakIncremented,
      currentStreak: streakResult.data.current,
      bestStreak: streakResult.data.best,
      achievementsUnlocked: achievements
    }
  })
}

/**
 * Record review session completion
 */
export async function recordReviewCompletion(params: {
  userId: string
  sessionId: string
  itemsReviewed: number
  correctCount: number
  accuracy: number
  isPremium: boolean
}): Promise<GamificationResult> {
  const { userId, itemsReviewed, correctCount, accuracy, isPremium } = params

  if (!adminDb) {
    throw new Error('Firebase Admin not initialized')
  }

  // Calculate XP
  const xpEarned = calculateReviewXP({ itemsReviewed, correctCount, accuracy })

  // Use transaction for atomic updates
  return await adminDb.runTransaction(async (transaction) => {
    const userStatsRef = adminDb.collection('user_stats').doc(userId)
    const statsDoc = await transaction.get(userStatsRef)

    // Initialize if doesn't exist
    if (!statsDoc.exists) {
      transaction.set(userStatsRef, {
        xp: { total: 0, level: 1 },
        streak: {
          current: 0,
          best: 0,
          freezesRemaining: isPremium ? 3 : 0,
          version: 1,
          updatedAt: FieldValue.serverTimestamp()
        },
        dates: {
          lastActivityDate: null,
          isActiveToday: false
        },
        sessions: { totalSessions: 0 },
        achievements: {
          unlockedIds: [],
          progress: {}
        },
        metadata: {
          lastUpdated: new Date().toISOString(),
          syncStatus: 'synced',
          schemaVersion: 2
        }
      })
    }

    const currentStats = statsDoc.data() || {}
    const currentXP = currentStats.xp?.total || 0
    const newTotalXP = currentXP + xpEarned
    const newLevel = Math.max(1, Math.floor(newTotalXP / 1000))

    // Update XP
    transaction.update(userStatsRef, {
      'xp.total': newTotalXP,
      'xp.level': newLevel,
      'sessions.totalSessions': FieldValue.increment(1),
      'metadata.lastUpdated': new Date().toISOString()
    })

    // Update streak if XP threshold met
    let streakResult = {
      streakIncremented: false,
      data: {
        current: currentStats.streak?.current || 0,
        best: currentStats.streak?.best || 0
      }
    }

    if (xpEarned >= MIN_XP_FOR_STREAK) {
      try {
        streakResult = await updateStreakTransaction(
          transaction,
          userId,
          xpEarned,
          { isPremium }
        )
      } catch (error) {
        console.error('[Gamification Coordinator] Failed to update streak:', error)
      }
    }

    return {
      xpEarned,
      newTotalXP,
      newLevel,
      streakIncremented: streakResult.streakIncremented,
      currentStreak: streakResult.data.current,
      bestStreak: streakResult.data.best,
      achievementsUnlocked: []
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

  return await adminDb.runTransaction(async (transaction) => {
    const userStatsRef = adminDb.collection('user_stats').doc(userId)
    const statsDoc = await transaction.get(userStatsRef)

    const currentStats = statsDoc.data() || {}
    const currentXP = currentStats.xp?.total || 0
    const newTotalXP = currentXP + amount
    const newLevel = Math.max(1, Math.floor(newTotalXP / 1000))

    transaction.update(userStatsRef, {
      'xp.total': newTotalXP,
      'xp.level': newLevel,
      'metadata.lastUpdated': new Date().toISOString()
    })

    // Log the manual XP award
    const logRef = adminDb.collection('xp_logs').doc()
    transaction.set(logRef, {
      userId,
      amount,
      reason,
      timestamp: FieldValue.serverTimestamp()
    })

    return { newTotalXP, newLevel }
  })
}
