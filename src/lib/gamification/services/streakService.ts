/**
 * Streak Service - Single Source of Truth
 *
 * Mirrors the Universal Review Engine pattern: all streak mutations flow through
 * one transactional service. No other code path is allowed to write streak data.
 *
 * Responsibilities:
 * - Normalize legacy Firestore documents into the canonical streak snapshot shape
 * - Apply eligibility rules (XP threshold, grace period, optional freezes)
 * - Persist transactional updates with version-based conflict detection
 * - Provide merge helpers for API routes (sync, migration) that need to reconcile data
 *
 * Schema (user_stats/{uid} document excerpt):
 * {
 *   streak: {
 *     current: number,
 *     best: number,
 *     freezesRemaining: number,
 *     version: number,
 *     updatedAt: Timestamp
 *   },
 *   dates: {
 *     lastActivityDate: string | null,   // ISO yyyy-mm-dd
 *     isActiveToday: boolean
 *   },
 *   metadata: {
 *     lastUpdated: string,
 *     syncStatus: 'synced' | 'pending',
 *     schemaVersion: 2
 *   }
 * }
 */

import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import type {
  Firestore,
  DocumentReference,
  Transaction,
  DocumentData
} from 'firebase-admin/firestore'
import streakConfig from '@/config/gamification/streak.json'

// ============================================================================
// Types
// ============================================================================

export interface StreakSnapshot {
  current: number
  best: number
  lastActivityDate: string | null
  freezesRemaining: number
  version: number
  updatedAt: Timestamp
}

export interface StreakUpdateResult {
  success: boolean
  data: StreakSnapshot | null
  streakIncremented: boolean
  newRecordSet: boolean
  conflictDetected?: boolean
  error?: string
}

export interface StreakCheckResult {
  shouldIncrement: boolean
  shouldReset: boolean
  isWithinGracePeriod: boolean
  daysSinceLastActivity: number
  reason: string
}

export interface UpdateStreakOptions {
  isPremium?: boolean
  expectedVersion?: number
  db?: Firestore
}

export interface MergedGamificationStats {
  xp?: {
    total?: number
    level?: number
    levelTitle?: string
    xpToNextLevel?: number
    xpGainedToday?: number
    weeklyXP?: number
    monthlyXP?: number
  }
  streak?: {
    current?: number
    best?: number
  }
  dates?: {
    lastActivityDate?: string | null
    isActiveToday?: boolean
  }
  sessions?: {
    totalSessions?: number
    todaySessions?: number
    weekSessions?: number
    monthSessions?: number
    averageAccuracy?: number
    totalStudyTimeMinutes?: number
    totalItemsReviewed?: number
  }
  achievements?: {
    unlockedIds?: string[]
    unlockedCount?: number
    completionPercentage?: number
  }
}

export interface ApplyMergedStatsResult {
  success: boolean
  streakData?: StreakSnapshot
  xpData?: {
    total: number
    level: number
  }
  error?: string
}

// ============================================================================
// Configuration
// ============================================================================

const MIN_XP_FOR_STREAK = streakConfig.minXPForStreak
const FREEZE_FEATURE_ENABLED = streakConfig.streakFreeze?.enabled === true
const MAX_FREEZES = streakConfig.streakFreeze?.maxFreezes ?? 0

// ============================================================================
// Pure helper functions
// ============================================================================

export function getCurrentDateUTC(): string {
  return new Date().toISOString().split('T')[0]
}

export function parseISODate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`)
}

export function calculateDaysDifference(date1: string, date2: string): number {
  const d1 = parseISODate(date1)
  const d2 = parseISODate(date2)
  const diffMs = Math.abs(d2.getTime() - d1.getTime())
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

export function isWithinGracePeriod(
  lastActivityDate: string,
  currentDate: string = getCurrentDateUTC()
): boolean {
  const daysDiff = calculateDaysDifference(lastActivityDate, currentDate)
  return daysDiff <= 1 // plus GRACE_PERIOD_HOURS baked into caller
}

export function checkStreakEligibility(
  xpEarned: number,
  lastActivityDate: string | null,
  freezesRemaining: number,
  currentDate: string = getCurrentDateUTC(),
  freezeEnabled: boolean = FREEZE_FEATURE_ENABLED
): StreakCheckResult {
  if (xpEarned < MIN_XP_FOR_STREAK) {
    return {
      shouldIncrement: false,
      shouldReset: false,
      isWithinGracePeriod: false,
      daysSinceLastActivity: 0,
      reason: `Insufficient XP (${xpEarned}/${MIN_XP_FOR_STREAK})`
    }
  }

  if (!lastActivityDate) {
    return {
      shouldIncrement: true,
      shouldReset: false,
      isWithinGracePeriod: true,
      daysSinceLastActivity: 0,
      reason: 'First-time activity'
    }
  }

  const daysSinceLastActivity = calculateDaysDifference(lastActivityDate, currentDate)

  if (lastActivityDate === currentDate) {
    return {
      shouldIncrement: false,
      shouldReset: false,
      isWithinGracePeriod: true,
      daysSinceLastActivity: 0,
      reason: 'Already counted today'
    }
  }

  if (isWithinGracePeriod(lastActivityDate, currentDate)) {
    return {
      shouldIncrement: true,
      shouldReset: false,
      isWithinGracePeriod: true,
      daysSinceLastActivity,
      reason: 'Within grace period'
    }
  }

  if (
    freezeEnabled &&
    freezesRemaining > 0 &&
    daysSinceLastActivity <= 2
  ) {
    return {
      shouldIncrement: true,
      shouldReset: false,
      isWithinGracePeriod: false,
      daysSinceLastActivity,
      reason: 'Freeze used'
    }
  }

  return {
    shouldIncrement: false,
    shouldReset: true,
    isWithinGracePeriod: false,
    daysSinceLastActivity,
    reason: `Missed ${daysSinceLastActivity} days, no freezes available`
  }
}

export function calculateNewStreakValues(
  currentStreak: number,
  bestStreak: number,
  freezesRemaining: number,
  eligibility: StreakCheckResult,
  options?: { freezeUsed?: boolean; freezeEnabled?: boolean }
): { current: number; best: number; freezesRemaining: number; newRecordSet: boolean } {
  const freezeEnabled = options?.freezeEnabled ?? FREEZE_FEATURE_ENABLED
  const freezeUsed = freezeEnabled && options?.freezeUsed === true

  let newCurrent = currentStreak
  let newBest = bestStreak
  let newFreezes = freezeEnabled ? freezesRemaining : 0

  if (eligibility.shouldIncrement) {
    newCurrent = currentStreak + 1
    if (newCurrent > bestStreak) {
      newBest = newCurrent
    }
  } else if (eligibility.shouldReset) {
    newCurrent = 0
    if (freezeEnabled) {
      newFreezes = MAX_FREEZES
    }
  }

  if (freezeEnabled && freezeUsed && !eligibility.shouldReset) {
    newFreezes = Math.max(0, freezesRemaining - 1)
  }

  return {
    current: newCurrent,
    best: newBest,
    freezesRemaining: freezeEnabled ? newFreezes : 0,
    newRecordSet: newBest > bestStreak
  }
}

// ============================================================================
// Firestore helpers
// ============================================================================

function getUserStatsRef(userId: string, db?: Firestore): DocumentReference {
  const firestore = db || getFirestore()
  return firestore.collection('user_stats').doc(userId)
}

function defaultSnapshot(): StreakSnapshot {
  return {
    current: 0,
    best: 0,
    lastActivityDate: null,
    freezesRemaining: FREEZE_FEATURE_ENABLED ? MAX_FREEZES : 0,
    version: 0,
    updatedAt: Timestamp.now()
  }
}

function normalizeStreak(data: DocumentData | undefined): StreakSnapshot {
  if (!data) {
    return defaultSnapshot()
  }

  const streak = data.streak ?? {}
  const dates = data.dates ?? {}

  const current =
    typeof streak.current === 'number'
      ? streak.current
      : typeof data.currentStreak === 'number'
        ? data.currentStreak
        : 0

  const best =
    typeof streak.best === 'number'
      ? streak.best
      : typeof data.bestStreak === 'number'
        ? data.bestStreak
        : current

  const lastActivityDateRaw =
    typeof dates.lastActivityDate === 'string'
      ? dates.lastActivityDate
      : typeof data.lastActivityDate === 'string'
        ? data.lastActivityDate
        : null

  const freezesRemaining =
    typeof streak.freezesRemaining === 'number'
      ? streak.freezesRemaining
      : typeof data.freezesRemaining === 'number'
        ? data.freezesRemaining
        : FREEZE_FEATURE_ENABLED ? MAX_FREEZES : 0

  const version =
    typeof streak.version === 'number'
      ? streak.version
      : typeof data.version === 'number'
        ? data.version
        : 0

  const updatedAt =
    streak.updatedAt instanceof Timestamp
      ? streak.updatedAt
      : data.updatedAt instanceof Timestamp
        ? data.updatedAt
        : Timestamp.now()

  return {
    current,
    best,
    lastActivityDate: lastActivityDateRaw,
    freezesRemaining: FREEZE_FEATURE_ENABLED ? freezesRemaining : 0,
    version,
    updatedAt
  }
}

function buildStreakWrite(snapshot: StreakSnapshot) {
  const today = getCurrentDateUTC()
  return {
    streak: {
      current: snapshot.current,
      best: snapshot.best,
      freezesRemaining: FREEZE_FEATURE_ENABLED ? snapshot.freezesRemaining : 0,
      version: snapshot.version,
      updatedAt: snapshot.updatedAt
    },
    dates: {
      lastActivityDate: snapshot.lastActivityDate,
      isActiveToday: snapshot.lastActivityDate === today
    },
    metadata: {
      lastUpdated: new Date().toISOString(),
      syncStatus: 'synced',
      schemaVersion: 2
    }
  }
}

class StreakConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StreakConflictError'
  }
}

// ============================================================================
// Public API
// ============================================================================

export async function updateStreakTransaction(
  userId: string,
  xpEarned: number,
  options: UpdateStreakOptions = {}
): Promise<StreakUpdateResult> {
  const firestore = options.db || getFirestore()
  const userStatsRef = getUserStatsRef(userId, firestore)

  try {
    const result = await firestore.runTransaction(async (transaction: Transaction) => {
      const doc = await transaction.get(userStatsRef)
      const snapshot = doc.exists ? normalizeStreak(doc.data()) : defaultSnapshot()

      if (
        typeof options.expectedVersion === 'number' &&
        snapshot.version !== options.expectedVersion
      ) {
        throw new StreakConflictError(
          `Version mismatch: expected ${options.expectedVersion}, actual ${snapshot.version}`
        )
      }

      const freezeEnabledForUser = FREEZE_FEATURE_ENABLED && options.isPremium === true
      const eligibility = checkStreakEligibility(
        xpEarned,
        snapshot.lastActivityDate,
        freezeEnabledForUser ? snapshot.freezesRemaining : 0,
        getCurrentDateUTC(),
        freezeEnabledForUser
      )

      const freezeUsed = freezeEnabledForUser && eligibility.reason === 'Freeze used'
      const newValues = calculateNewStreakValues(
        snapshot.current,
        snapshot.best,
        snapshot.freezesRemaining,
        eligibility,
        { freezeUsed, freezeEnabled: freezeEnabledForUser }
      )

      const today = getCurrentDateUTC()
      const nextSnapshot: StreakSnapshot = {
        current: newValues.current,
        best: newValues.best,
        lastActivityDate:
          eligibility.shouldIncrement || eligibility.shouldReset
            ? today
            : snapshot.lastActivityDate,
        freezesRemaining: FREEZE_FEATURE_ENABLED
          ? (freezeEnabledForUser ? newValues.freezesRemaining : snapshot.freezesRemaining)
          : 0,
        version: snapshot.version + 1,
        updatedAt: Timestamp.now()
      }

      transaction.set(userStatsRef, buildStreakWrite(nextSnapshot), { merge: true })

      return {
        success: true,
        data: nextSnapshot,
        streakIncremented: eligibility.shouldIncrement,
        newRecordSet: newValues.newRecordSet
      }
    })

    return result
  } catch (error: any) {
    if (error instanceof StreakConflictError) {
      return {
        success: false,
        data: null,
        streakIncremented: false,
        newRecordSet: false,
        conflictDetected: true,
        error: error.message
      }
    }

    console.error('[StreakService] Transaction failed:', error)
    const isConflict = error.code === 'aborted' || error?.message?.includes('contention')
    return {
      success: false,
      data: null,
      streakIncremented: false,
      newRecordSet: false,
      conflictDetected: isConflict,
      error: error?.message || 'Unknown error'
    }
  }
}

export async function getStreakData(
  userId: string,
  db?: Firestore
): Promise<StreakSnapshot | null> {
  const firestore = db || getFirestore()
  const doc = await getUserStatsRef(userId, firestore).get()
  if (!doc.exists) {
    return null
  }
  return normalizeStreak(doc.data())
}

export async function useStreakFreeze(
  userId: string,
  isPremium: boolean,
  db?: Firestore
): Promise<{ success: boolean; error?: string }> {
  if (!FREEZE_FEATURE_ENABLED) {
    return {
      success: false,
      error: 'Streak freeze feature is disabled'
    }
  }

  if (!isPremium) {
    return {
      success: false,
      error: 'Streak freeze requires premium subscription'
    }
  }

  const firestore = db || getFirestore()
  const userStatsRef = getUserStatsRef(userId, firestore)

  try {
    await firestore.runTransaction(async (transaction: Transaction) => {
      const doc = await transaction.get(userStatsRef)
      if (!doc.exists) {
        throw new Error('User stats not found')
      }

      const snapshot = normalizeStreak(doc.data())
      if (snapshot.freezesRemaining <= 0) {
        throw new Error('No freezes remaining')
      }

      const updated: StreakSnapshot = {
        ...snapshot,
        freezesRemaining: snapshot.freezesRemaining - 1,
        version: snapshot.version + 1,
        updatedAt: Timestamp.now()
      }

      transaction.set(userStatsRef, buildStreakWrite(updated), { merge: true })
    })

    return { success: true }
  } catch (error: any) {
    console.error('[StreakService] Failed to use freeze:', error)
    return {
      success: false,
      error: error?.message || 'Unknown error'
    }
  }
}

export async function resetStreak(
  userId: string,
  db?: Firestore
): Promise<{ success: boolean; data?: StreakSnapshot; error?: string }> {
  const firestore = db || getFirestore()
  const userStatsRef = getUserStatsRef(userId, firestore)

  try {
    const snapshot = await firestore.runTransaction(async (transaction: Transaction) => {
      const doc = await transaction.get(userStatsRef)
      if (!doc.exists) {
        throw new Error('User stats not found')
      }

      const current = normalizeStreak(doc.data())
      const today = getCurrentDateUTC()
      const updated: StreakSnapshot = {
        current: 0,
        best: Math.max(current.best, 0),
        lastActivityDate: today,
        freezesRemaining: FREEZE_FEATURE_ENABLED ? MAX_FREEZES : 0,
        version: current.version + 1,
        updatedAt: Timestamp.now()
      }

      transaction.set(userStatsRef, buildStreakWrite(updated), { merge: true })
      return updated
    })

    return { success: true, data: snapshot }
  } catch (error: any) {
    console.error('[StreakService] Failed to reset streak:', error)
    return {
      success: false,
      error: error?.message || 'Unknown error'
    }
  }
}

export async function applyMergedStatsTransaction(
  userId: string,
  incoming: MergedGamificationStats,
  db?: Firestore
): Promise<ApplyMergedStatsResult> {
  const firestore = db || getFirestore()
  const userStatsRef = getUserStatsRef(userId, firestore)

  try {
    const result = await firestore.runTransaction(async (transaction: Transaction) => {
      const doc = await transaction.get(userStatsRef)
      const existing = doc.exists ? doc.data() : {}
      const currentSnapshot = normalizeStreak(existing)
      let nextSnapshot = currentSnapshot
      let snapshotMutated = false
      const now = Timestamp.now()

      // Merge XP / sessions / achievements normally
      const mergedPayload: Record<string, unknown> = {}

      if (incoming.xp) {
        mergedPayload.xp = {
          ...(existing?.xp ?? {}),
          ...incoming.xp
        }
      }

      if (incoming.sessions) {
        mergedPayload.sessions = {
          ...(existing?.sessions ?? {}),
          ...incoming.sessions
        }
      }

      if (incoming.achievements) {
        mergedPayload.achievements = {
          ...(existing?.achievements ?? {}),
          ...incoming.achievements
        }
      }

      if (incoming.streak) {
        const incomingCurrent = incoming.streak.current ?? 0
        const incomingBest = incoming.streak.best ?? incomingCurrent
        const newCurrent = Math.max(incomingCurrent, currentSnapshot.current)
        const newBest = Math.max(incomingBest, currentSnapshot.best, newCurrent)

        if (newCurrent !== currentSnapshot.current || newBest !== currentSnapshot.best) {
          nextSnapshot = {
            ...nextSnapshot,
            current: newCurrent,
            best: newBest,
            version: currentSnapshot.version + 1,
            updatedAt: now
          }
          snapshotMutated = true
        }
      }

      if (incoming.dates) {
        const maybeDate =
          incoming.dates.lastActivityDate ?? nextSnapshot.lastActivityDate
        const nextDate = maybeDate ?? nextSnapshot.lastActivityDate
        const shouldBumpVersion =
          typeof incoming.dates.lastActivityDate === 'string' &&
          incoming.dates.lastActivityDate !== nextSnapshot.lastActivityDate

        if (nextDate !== nextSnapshot.lastActivityDate || shouldBumpVersion) {
          nextSnapshot = {
            ...nextSnapshot,
            lastActivityDate: nextDate ?? null,
            version: shouldBumpVersion
              ? nextSnapshot.version + 1
              : nextSnapshot.version,
            updatedAt: shouldBumpVersion ? now : nextSnapshot.updatedAt
          }
          snapshotMutated = true
        }
      }

      if (snapshotMutated) {
        mergedPayload.streak = {
          current: nextSnapshot.current,
          best: nextSnapshot.best,
          freezesRemaining: FREEZE_FEATURE_ENABLED ? nextSnapshot.freezesRemaining : 0,
          version: nextSnapshot.version,
          updatedAt: nextSnapshot.updatedAt
        }
        mergedPayload.dates = {
          lastActivityDate: nextSnapshot.lastActivityDate,
          isActiveToday: nextSnapshot.lastActivityDate === getCurrentDateUTC()
        }
      }

      mergedPayload.metadata = {
        ...(existing?.metadata ?? {}),
        lastUpdated: new Date().toISOString(),
        syncStatus: 'synced',
        schemaVersion: 2
      }

      if (Object.keys(mergedPayload).length > 0) {
        transaction.set(userStatsRef, mergedPayload, { merge: true })
      }

      return {
        streakData: nextSnapshot,
        xpData: {
          total: mergedPayload.xp && typeof (mergedPayload.xp as any).total === 'number'
            ? (mergedPayload.xp as any).total
            : existing?.xp?.total ?? 0,
          level: mergedPayload.xp && typeof (mergedPayload.xp as any).level === 'number'
            ? (mergedPayload.xp as any).level
            : existing?.xp?.level ?? 1
        }
      }
    })

    return {
      success: true,
      streakData: result.streakData,
      xpData: result.xpData
    }
  } catch (error: any) {
    console.error('[StreakService] Failed to apply merged stats:', error)
    return {
      success: false,
      error: error?.message || 'Unknown error'
    }
  }
}
