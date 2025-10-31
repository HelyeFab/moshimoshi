/**
 * Streak Service - Firebase-First Implementation
 *
 * This service provides the single source of truth for user streak management.
 * All streak operations go through Firebase transactions to ensure data consistency.
 *
 * Architecture:
 * - Pure functions for streak calculations (no side effects)
 * - Transactional Firebase operations with version-based conflict detection
 * - Optimistic UI updates handled by caller (Zustand store)
 * - Matches Universal Review Engine (URE) patterns
 *
 * @module streakService
 */

import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Firestore, DocumentReference, Transaction } from 'firebase-admin/firestore';
import streakConfig from '@/config/gamification/streak.json';

// ============================================================================
// Types
// ============================================================================

export interface StreakData {
  currentStreak: number;
  bestStreak: number;
  lastActivityDate: string; // ISO 8601 date string (YYYY-MM-DD)
  totalXP: number;
  freezesRemaining: number;
  version: number; // For conflict detection
  updatedAt: Timestamp;
}

export interface StreakUpdateResult {
  success: boolean;
  data: StreakData | null;
  streakIncremented: boolean;
  newRecordSet: boolean;
  error?: string;
  conflictDetected?: boolean;
}

export interface StreakCheckResult {
  shouldIncrement: boolean;
  shouldReset: boolean;
  isWithinGracePeriod: boolean;
  daysSinceLastActivity: number;
  reason: string;
}

// ============================================================================
// Configuration
// ============================================================================

const MIN_XP_FOR_STREAK = streakConfig.minXPForStreak;
const GRACE_PERIOD_HOURS = streakConfig.gracePeriodHours;
const MAX_FREEZES = streakConfig.streakFreeze.maxFreezes;

// ============================================================================
// Pure Helper Functions (No Side Effects)
// ============================================================================

/**
 * Get the current date in UTC as ISO 8601 string (YYYY-MM-DD)
 */
export function getCurrentDateUTC(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Parse ISO date string to Date object at midnight UTC
 */
export function parseISODate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

/**
 * Calculate the number of days between two ISO date strings
 */
export function calculateDaysDifference(date1: string, date2: string): number {
  const d1 = parseISODate(date1);
  const d2 = parseISODate(date2);
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date is within the grace period from another date
 */
export function isWithinGracePeriod(
  lastActivityDate: string,
  currentDate: string = getCurrentDateUTC()
): boolean {
  const daysDiff = calculateDaysDifference(lastActivityDate, currentDate);
  // Grace period allows up to 1 day gap (activity on consecutive days)
  // Plus grace period hours (24h by default)
  return daysDiff <= 1;
}

/**
 * Determine if streak should be incremented based on activity
 *
 * Rules:
 * 1. Must earn minimum XP (default: 25)
 * 2. Must not have already incremented today
 * 3. Must be within grace period OR have streak freeze available
 */
export function checkStreakEligibility(
  xpEarned: number,
  lastActivityDate: string | null,
  freezesRemaining: number,
  currentDate: string = getCurrentDateUTC()
): StreakCheckResult {
  // Check minimum XP requirement
  if (xpEarned < MIN_XP_FOR_STREAK) {
    return {
      shouldIncrement: false,
      shouldReset: false,
      isWithinGracePeriod: false,
      daysSinceLastActivity: 0,
      reason: `Insufficient XP (${xpEarned}/${MIN_XP_FOR_STREAK})`
    };
  }

  // First-time activity
  if (!lastActivityDate) {
    return {
      shouldIncrement: true,
      shouldReset: false,
      isWithinGracePeriod: true,
      daysSinceLastActivity: 0,
      reason: 'First-time activity'
    };
  }

  const daysSinceLastActivity = calculateDaysDifference(lastActivityDate, currentDate);

  // Already counted today
  if (lastActivityDate === currentDate) {
    return {
      shouldIncrement: false,
      shouldReset: false,
      isWithinGracePeriod: true,
      daysSinceLastActivity: 0,
      reason: 'Already counted today'
    };
  }

  // Within grace period (consecutive days)
  const withinGracePeriod = isWithinGracePeriod(lastActivityDate, currentDate);

  if (withinGracePeriod) {
    return {
      shouldIncrement: true,
      shouldReset: false,
      isWithinGracePeriod: true,
      daysSinceLastActivity,
      reason: 'Within grace period'
    };
  }

  // Beyond grace period - check for freeze
  if (freezesRemaining > 0 && daysSinceLastActivity <= 2) {
    return {
      shouldIncrement: true,
      shouldReset: false,
      isWithinGracePeriod: false,
      daysSinceLastActivity,
      reason: 'Freeze used'
    };
  }

  // Streak broken
  return {
    shouldIncrement: false,
    shouldReset: true,
    isWithinGracePeriod: false,
    daysSinceLastActivity,
    reason: `Missed ${daysSinceLastActivity} days, no freezes available`
  };
}

/**
 * Calculate new streak values based on eligibility check
 */
export function calculateNewStreakValues(
  currentStreak: number,
  bestStreak: number,
  eligibility: StreakCheckResult,
  freezeUsed: boolean = false
): Pick<StreakData, 'currentStreak' | 'bestStreak' | 'freezesRemaining'> & { newRecordSet: boolean } {
  let newCurrentStreak = currentStreak;
  let newBestStreak = bestStreak;
  let newFreezesRemaining = eligibility.shouldReset ? MAX_FREEZES : undefined;

  if (eligibility.shouldIncrement) {
    newCurrentStreak = currentStreak + 1;
    if (newCurrentStreak > bestStreak) {
      newBestStreak = newCurrentStreak;
    }
  } else if (eligibility.shouldReset) {
    newCurrentStreak = 0;
  }

  return {
    currentStreak: newCurrentStreak,
    bestStreak: newBestStreak,
    freezesRemaining: newFreezesRemaining !== undefined ? newFreezesRemaining :
                      freezeUsed ? Math.max(0, (eligibility as any).freezesRemaining - 1) :
                      (eligibility as any).freezesRemaining,
    newRecordSet: newBestStreak > bestStreak
  };
}

// ============================================================================
// Firebase Transactional Operations
// ============================================================================

/**
 * Get user stats document reference
 */
function getUserStatsRef(userId: string, db?: Firestore): DocumentReference {
  const firestore = db || getFirestore();
  return firestore.collection('user_stats').doc(userId);
}

/**
 * Update streak with Firebase transaction (version-based conflict detection)
 *
 * This is the ONLY way to update streak data. All callers must use this function.
 *
 * @param userId - User ID
 * @param xpEarned - XP earned in the current session
 * @param isPremium - Whether user has premium (for freeze eligibility)
 * @param db - Optional Firestore instance (for testing)
 * @returns StreakUpdateResult with success status and updated data
 */
export async function updateStreakTransaction(
  userId: string,
  xpEarned: number,
  isPremium: boolean = false,
  db?: Firestore
): Promise<StreakUpdateResult> {
  const firestore = db || getFirestore();
  const userStatsRef = getUserStatsRef(userId, firestore);

  try {
    const result = await firestore.runTransaction(async (transaction: Transaction) => {
      const doc = await transaction.get(userStatsRef);

      // Initialize if document doesn't exist
      if (!doc.exists) {
        const initialData: StreakData = {
          currentStreak: 1,
          bestStreak: 1,
          lastActivityDate: getCurrentDateUTC(),
          totalXP: xpEarned,
          freezesRemaining: MAX_FREEZES,
          version: 1,
          updatedAt: Timestamp.now()
        };

        transaction.set(userStatsRef, initialData);

        return {
          success: true,
          data: initialData,
          streakIncremented: true,
          newRecordSet: true
        };
      }

      // Get current data
      const currentData = doc.data() as StreakData;
      const currentVersion = currentData.version || 1;

      // Check eligibility
      const eligibility = checkStreakEligibility(
        xpEarned,
        currentData.lastActivityDate,
        currentData.freezesRemaining || 0
      );

      // Determine if freeze should be used
      const shouldUseFreeze =
        !eligibility.isWithinGracePeriod &&
        eligibility.daysSinceLastActivity <= 2 &&
        (currentData.freezesRemaining || 0) > 0 &&
        isPremium &&
        streakConfig.streakFreeze.enabled;

      // Calculate new values
      const newValues = calculateNewStreakValues(
        currentData.currentStreak,
        currentData.bestStreak,
        eligibility,
        shouldUseFreeze
      );

      // Prepare update data
      const updateData: Partial<StreakData> = {
        currentStreak: newValues.currentStreak,
        bestStreak: newValues.bestStreak,
        lastActivityDate: getCurrentDateUTC(),
        totalXP: (currentData.totalXP || 0) + xpEarned,
        freezesRemaining: newValues.freezesRemaining,
        version: currentVersion + 1,
        updatedAt: Timestamp.now()
      };

      // Apply transaction update
      transaction.update(userStatsRef, updateData as any);

      return {
        success: true,
        data: { ...currentData, ...updateData } as StreakData,
        streakIncremented: eligibility.shouldIncrement,
        newRecordSet: newValues.newRecordSet
      };
    });

    return result;

  } catch (error: any) {
    console.error('[StreakService] Transaction failed:', error);

    // Check if it's a conflict error
    const isConflict = error.code === 'aborted' || error.message?.includes('contention');

    return {
      success: false,
      data: null,
      streakIncremented: false,
      newRecordSet: false,
      error: error.message || 'Unknown error',
      conflictDetected: isConflict
    };
  }
}

/**
 * Get current streak data from Firebase
 *
 * @param userId - User ID
 * @param db - Optional Firestore instance (for testing)
 * @returns Current streak data or null if not found
 */
export async function getStreakData(
  userId: string,
  db?: Firestore
): Promise<StreakData | null> {
  const firestore = db || getFirestore();
  const userStatsRef = getUserStatsRef(userId, firestore);

  try {
    const doc = await userStatsRef.get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as StreakData;

  } catch (error) {
    console.error('[StreakService] Failed to get streak data:', error);
    return null;
  }
}

/**
 * Use a streak freeze (premium only)
 *
 * @param userId - User ID
 * @param isPremium - Whether user has premium
 * @param db - Optional Firestore instance (for testing)
 * @returns Success status
 */
export async function useStreakFreeze(
  userId: string,
  isPremium: boolean,
  db?: Firestore
): Promise<{ success: boolean; error?: string }> {
  if (!isPremium || !streakConfig.streakFreeze.enabled) {
    return {
      success: false,
      error: 'Streak freeze requires premium subscription'
    };
  }

  const firestore = db || getFirestore();
  const userStatsRef = getUserStatsRef(userId, firestore);

  try {
    await firestore.runTransaction(async (transaction: Transaction) => {
      const doc = await transaction.get(userStatsRef);

      if (!doc.exists) {
        throw new Error('User stats not found');
      }

      const data = doc.data() as StreakData;
      const freezesRemaining = data.freezesRemaining || 0;

      if (freezesRemaining <= 0) {
        throw new Error('No freezes remaining');
      }

      transaction.update(userStatsRef, {
        freezesRemaining: freezesRemaining - 1,
        version: (data.version || 1) + 1,
        updatedAt: Timestamp.now()
      });
    });

    return { success: true };

  } catch (error: any) {
    console.error('[StreakService] Failed to use freeze:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Reset streak (for testing or admin purposes)
 *
 * @param userId - User ID
 * @param db - Optional Firestore instance (for testing)
 */
export async function resetStreak(
  userId: string,
  db?: Firestore
): Promise<{ success: boolean; error?: string }> {
  const firestore = db || getFirestore();
  const userStatsRef = getUserStatsRef(userId, firestore);

  try {
    await firestore.runTransaction(async (transaction: Transaction) => {
      const doc = await transaction.get(userStatsRef);

      if (!doc.exists) {
        throw new Error('User stats not found');
      }

      const data = doc.data() as StreakData;

      transaction.update(userStatsRef, {
        currentStreak: 0,
        lastActivityDate: getCurrentDateUTC(),
        freezesRemaining: MAX_FREEZES,
        version: (data.version || 1) + 1,
        updatedAt: Timestamp.now()
      });
    });

    return { success: true };

  } catch (error: any) {
    console.error('[StreakService] Failed to reset streak:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

// ============================================================================
// Unified API Entry Points (for sync & migration routes)
// ============================================================================

/**
 * Merged gamification stats for unified API endpoints
 * Used by /api/gamification/sync and /api/gamification/migration/upload
 */
export interface MergedGamificationStats {
  xp?: {
    total?: number;
    level?: number;
    levelTitle?: string;
    xpToNextLevel?: number;
    xpGainedToday?: number;
    weeklyXP?: number;
    monthlyXP?: number;
  };
  streak?: {
    current?: number;
    best?: number;
  };
  dates?: {
    lastActivityDate?: string | null;
    isActiveToday?: boolean;
  };
  sessions?: {
    totalSessions?: number;
    todaySessions?: number;
    weekSessions?: number;
    monthSessions?: number;
    averageAccuracy?: number;
    totalStudyTimeMinutes?: number;
    totalItemsReviewed?: number;
  };
  achievements?: {
    unlockedIds?: string[];
    unlockedCount?: number;
    completionPercentage?: number;
  };
}

/**
 * Result of applying merged stats transaction
 */
export interface ApplyMergedStatsResult {
  success: boolean;
  streakData?: {
    current: number;
    best: number;
  };
  xpData?: {
    total: number;
    level: number;
  };
  error?: string;
}

/**
 * Apply merged gamification stats with transactional streak handling
 *
 * This is the SINGLE entry point for sync and migration routes.
 * All streak writes MUST go through this transaction to maintain consistency.
 *
 * @param userId - User ID
 * @param incoming - Merged stats from API routes
 * @param db - Optional Firestore instance (for testing)
 * @returns Result with updated streak and XP data
 */
export async function applyMergedStatsTransaction(
  userId: string,
  incoming: MergedGamificationStats,
  db?: Firestore
): Promise<ApplyMergedStatsResult> {
  const firestore = db || getFirestore();
  const userStatsRef = getUserStatsRef(userId, firestore);

  try {
    const result = await firestore.runTransaction(async (transaction: Transaction) => {
      const doc = await transaction.get(userStatsRef);
      const existingData = doc.exists ? (doc.data() as any) : {};

      // Merge non-streak fields first
      const merged: any = { ...existingData };

      // XP merge
      if (incoming.xp) {
        merged.xp = {
          ...(existingData.xp ?? {}),
          ...incoming.xp
        };
      }

      // Sessions merge
      if (incoming.sessions) {
        merged.sessions = {
          ...(existingData.sessions ?? {}),
          ...incoming.sessions
        };
      }

      // Achievements merge
      if (incoming.achievements) {
        merged.achievements = {
          ...(existingData.achievements ?? {}),
          ...incoming.achievements
        };
      }

      // CRITICAL: Streak merge uses max strategy to prevent data loss
      // This maintains the invariant: best >= current
      // NOTE: If streak is not provided, preserve existing values (don't overwrite!)
      if (incoming.streak !== undefined) {
        const incomingCurrent = incoming.streak?.current ?? 0;
        const incomingBest = incoming.streak?.best ?? 0;
        const existingCurrent = existingData.currentStreak ?? existingData.streak?.current ?? 0;
        const existingBest = existingData.bestStreak ?? existingData.streak?.best ?? 0;

        const newCurrent = Math.max(incomingCurrent, existingCurrent);
        const newBest = Math.max(incomingBest, existingBest, newCurrent);

        // Write to BOTH legacy flat format AND new nested format for compatibility
        merged.currentStreak = newCurrent;
        merged.bestStreak = newBest;
        merged.streak = {
          current: newCurrent,
          best: newBest
        };
      }
      // else: preserve existing streak values (don't touch them)

      // Dates merge
      if (incoming.dates) {
        const lastActivityDate = incoming.dates.lastActivityDate ?? existingData.lastActivityDate;
        const isActiveToday = typeof incoming.dates.isActiveToday === 'boolean'
          ? incoming.dates.isActiveToday
          : (existingData.dates?.isActiveToday ?? false);

        merged.lastActivityDate = lastActivityDate;
        merged.dates = {
          ...(existingData.dates ?? {}),
          lastActivityDate,
          isActiveToday
        };
      }

      // Update version for conflict detection
      merged.version = (existingData.version || 0) + 1;
      merged.updatedAt = Timestamp.now();

      // Metadata
      if (!merged.metadata) {
        merged.metadata = {};
      }
      merged.metadata.lastUpdated = new Date().toISOString();
      merged.metadata.syncStatus = 'synced';
      merged.metadata.schemaVersion = 2;

      transaction.set(userStatsRef, merged, { merge: true });

      return {
        streakData: {
          current: newCurrent,
          best: newBest
        },
        xpData: {
          total: merged.xp?.total ?? 0,
          level: merged.xp?.level ?? 1
        }
      };
    });

    return {
      success: true,
      ...result
    };

  } catch (error: any) {
    console.error('[StreakService] Failed to apply merged stats:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}
