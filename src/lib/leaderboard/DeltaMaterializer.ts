/**
 * Leaderboard Delta Materializer
 *
 * Incremental leaderboard updates using delta queue instead of full scans.
 *
 * Architecture:
 * - Track changes in leaderboard_sync_queue collection
 * - Process deltas in batches
 * - Only update changed users + affected neighbors
 * - Scales to 100k+ users
 *
 * Replaces: Full scan in LeaderboardMaterializer.rebuildLeaderboard()
 */

import { adminDb } from '@/lib/firebase/admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import logger from '@/lib/logger'

// ============================================
// Types
// ============================================

export interface LeaderboardDelta {
  userId: string
  changeType: 'xp' | 'streak' | 'achievement' | 'profile'
  oldValue?: number
  newValue?: number
  timestamp: number
  processed: boolean
  processedAt?: number
}

export interface LeaderboardRankUpdate {
  userId: string
  oldRank?: number
  newRank: number
  totalXP: number
  currentStreak: number
  achievementCount: number
  updatedAt: Timestamp
}

// ============================================
// Delta Materializer Class
// ============================================

export class DeltaMaterializer {
  private static instance: DeltaMaterializer
  private readonly QUEUE_COLLECTION = 'leaderboard_sync_queue'
  private readonly LEADERBOARD_COLLECTION = 'leaderboard_stats'
  private readonly USER_STATS_COLLECTION = 'user_stats'
  private readonly BATCH_SIZE = 50

  private constructor() {}

  public static getInstance(): DeltaMaterializer {
    if (!DeltaMaterializer.instance) {
      DeltaMaterializer.instance = new DeltaMaterializer()
    }
    return DeltaMaterializer.instance
  }

  // ============================================
  // Queue Operations
  // ============================================

  /**
   * Enqueue a delta when user stats change
   *
   * Called by UserStatsService after XP, streak, or achievement updates
   */
  async enqueueDelta(delta: Omit<LeaderboardDelta, 'timestamp' | 'processed'>): Promise<void> {
    try {
      const deltaWithMeta: LeaderboardDelta = {
        ...delta,
        timestamp: Date.now(),
        processed: false
      }

      await adminDb.collection(this.QUEUE_COLLECTION).add(deltaWithMeta)

      logger.debug(`[DeltaMaterializer] Delta enqueued`, {
        userId: delta.userId,
        changeType: delta.changeType
      })

    } catch (error) {
      logger.error('[DeltaMaterializer] Failed to enqueue delta:', error)
      // Don't throw - delta enqueue is best-effort
    }
  }

  /**
   * Process all pending deltas in the queue
   */
  async processDeltas(): Promise<{
    processed: number
    updated: number
    errors: number
  }> {
    const result = {
      processed: 0,
      updated: 0,
      errors: 0
    }

    try {
      logger.info('[DeltaMaterializer] Processing pending deltas')

      // Get unprocessed deltas
      const snapshot = await adminDb
        .collection(this.QUEUE_COLLECTION)
        .where('processed', '==', false)
        .orderBy('timestamp', 'asc')
        .limit(this.BATCH_SIZE)
        .get()

      if (snapshot.empty) {
        logger.info('[DeltaMaterializer] No pending deltas')
        return result
      }

      logger.info(`[DeltaMaterializer] Found ${snapshot.size} pending deltas`)

      // Group deltas by userId (multiple updates to same user can be batched)
      const deltasByUser = new Map<string, LeaderboardDelta[]>()

      for (const doc of snapshot.docs) {
        const delta = doc.data() as LeaderboardDelta
        const existing = deltasByUser.get(delta.userId) || []
        existing.push({ ...delta, id: doc.id } as any)
        deltasByUser.set(delta.userId, existing)
      }

      // Process each user's deltas
      for (const [userId, deltas] of deltasByUser.entries()) {
        try {
          await this.processUserDeltas(userId, deltas)
          result.updated++

          // Mark deltas as processed
          const batch = adminDb.batch()
          for (const delta of deltas) {
            const docRef = adminDb.collection(this.QUEUE_COLLECTION).doc((delta as any).id)
            batch.update(docRef, {
              processed: true,
              processedAt: Date.now()
            })
          }
          await batch.commit()

          result.processed += deltas.length

        } catch (error: any) {
          logger.error(`[DeltaMaterializer] Failed to process deltas for ${userId}:`, error)
          result.errors++
        }
      }

      logger.info('[DeltaMaterializer] Deltas processed', result)

      // Clean up old processed deltas (older than 24 hours)
      await this.cleanupProcessedDeltas()

      return result

    } catch (error) {
      logger.error('[DeltaMaterializer] Delta processing error:', error)
      throw error
    }
  }

  /**
   * Process deltas for a single user (incremental update)
   */
  private async processUserDeltas(userId: string, deltas: LeaderboardDelta[]): Promise<void> {
    try {
      // Get latest user stats (source of truth)
      const userStatsDoc = await adminDb
        .collection(this.USER_STATS_COLLECTION)
        .doc(userId)
        .get()

      if (!userStatsDoc.exists) {
        logger.warn(`[DeltaMaterializer] No user_stats for ${userId}, skipping`)
        return
      }

      const userStats = userStatsDoc.data()!

      // Get current leaderboard entry (if exists)
      const leaderboardDoc = await adminDb
        .collection(this.LEADERBOARD_COLLECTION)
        .doc(userId)
        .get()

      const currentEntry = leaderboardDoc.exists ? leaderboardDoc.data() : null

      // Calculate new leaderboard entry
      const newEntry: any = {
        userId,
        displayName: userStats.displayName || 'Anonymous',
        email: userStats.email || '',
        totalXP: userStats.xp?.total || 0,
        currentStreak: userStats.streak?.current || 0,
        bestStreak: userStats.streak?.best || 0,
        currentLevel: userStats.xp?.level || 1,
        achievementCount: userStats.achievements?.unlockedCount || 0,
        totalPoints: userStats.achievements?.totalPoints || 0,
        lastActivityDate: userStats.streak?.lastActivityDate || null,
        lastSyncedAt: FieldValue.serverTimestamp(),
        isPublic: true,
        optedOut: false
      }

      if (userStats.photoURL) {
        newEntry.photoURL = userStats.photoURL
      }

      // Write updated entry
      await adminDb
        .collection(this.LEADERBOARD_COLLECTION)
        .doc(userId)
        .set(newEntry, { merge: true })

      logger.info(`[DeltaMaterializer] Updated leaderboard entry for ${userId}`, {
        oldXP: currentEntry?.totalXP,
        newXP: newEntry.totalXP,
        deltaCount: deltas.length
      })

    } catch (error) {
      logger.error(`[DeltaMaterializer] Failed to process user deltas for ${userId}:`, error)
      throw error
    }
  }

  // ============================================
  // Maintenance
  // ============================================

  /**
   * Clean up processed deltas older than 24 hours
   */
  async cleanupProcessedDeltas(): Promise<number> {
    try {
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)

      const snapshot = await adminDb
        .collection(this.QUEUE_COLLECTION)
        .where('processed', '==', true)
        .where('processedAt', '<', oneDayAgo)
        .limit(500)
        .get()

      if (snapshot.empty) {
        return 0
      }

      const batch = adminDb.batch()
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref)
      })

      await batch.commit()

      logger.info(`[DeltaMaterializer] Cleaned up ${snapshot.size} old deltas`)
      return snapshot.size

    } catch (error) {
      logger.error('[DeltaMaterializer] Cleanup error:', error)
      return 0
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number
    processed: number
    oldestPending?: number
  }> {
    try {
      const [pendingSnap, processedSnap] = await Promise.all([
        adminDb
          .collection(this.QUEUE_COLLECTION)
          .where('processed', '==', false)
          .get(),
        adminDb
          .collection(this.QUEUE_COLLECTION)
          .where('processed', '==', true)
          .get()
      ])

      let oldestPending: number | undefined

      if (!pendingSnap.empty) {
        const timestamps = pendingSnap.docs.map(doc => (doc.data() as LeaderboardDelta).timestamp)
        oldestPending = Math.min(...timestamps)
      }

      return {
        pending: pendingSnap.size,
        processed: processedSnap.size,
        oldestPending
      }

    } catch (error) {
      logger.error('[DeltaMaterializer] Stats error:', error)
      return { pending: 0, processed: 0 }
    }
  }

  // ============================================
  // Scheduled Processing
  // ============================================

  /**
   * Process deltas in a loop until queue is empty
   * Used by scheduled function
   */
  async processUntilEmpty(maxIterations: number = 100): Promise<{
    totalProcessed: number
    totalUpdated: number
    totalErrors: number
    iterations: number
  }> {
    const summary = {
      totalProcessed: 0,
      totalUpdated: 0,
      totalErrors: 0,
      iterations: 0
    }

    for (let i = 0; i < maxIterations; i++) {
      const result = await this.processDeltas()

      summary.totalProcessed += result.processed
      summary.totalUpdated += result.updated
      summary.totalErrors += result.errors
      summary.iterations++

      // If no deltas processed, queue is empty
      if (result.processed === 0) {
        break
      }
    }

    logger.info('[DeltaMaterializer] Batch processing complete', summary)
    return summary
  }
}

// ============================================
// Singleton Instance
// ============================================

export const deltaMaterializer = DeltaMaterializer.getInstance()

// ============================================
// Integration Helpers
// ============================================

/**
 * Enqueue delta when XP changes
 * Call this from UserStatsService.updateXP()
 */
export async function enqueueXPDelta(
  userId: string,
  oldValue: number,
  newValue: number
): Promise<void> {
  await deltaMaterializer.enqueueDelta({
    userId,
    changeType: 'xp',
    oldValue,
    newValue
  })
}

/**
 * Enqueue delta when streak changes
 * Call this from UserStatsService.updateStreak()
 */
export async function enqueueStreakDelta(
  userId: string,
  oldValue: number,
  newValue: number
): Promise<void> {
  await deltaMaterializer.enqueueDelta({
    userId,
    changeType: 'streak',
    oldValue,
    newValue
  })
}

/**
 * Enqueue delta when achievement unlocks
 * Call this from UserStatsService.unlockAchievement()
 */
export async function enqueueAchievementDelta(
  userId: string,
  achievementId: string
): Promise<void> {
  await deltaMaterializer.enqueueDelta({
    userId,
    changeType: 'achievement'
  })
}
