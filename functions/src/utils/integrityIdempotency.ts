/**
 * Integrity Checker Idempotency Utilities
 *
 * Provides idempotency tracking, repair cooldowns, and distributed locking
 * to prevent duplicate repairs and concurrent scheduler runs.
 *
 * Following the pattern from functions/src/firestore.ts (Stripe webhook idempotency)
 *
 * Collections:
 * - ops/integrity/processed_checks/{checkId}   - Track processed runs
 * - ops/integrity/repair_attempts/{contentId}  - Track repair cooldowns
 * - ops/integrity/locks/integrity_checker      - Distributed lock
 */

import * as admin from 'firebase-admin'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'

const db = admin.firestore()

// ============================================================================
// CONFIGURATION
// ============================================================================

export const IDEMPOTENCY_CONFIG = {
  REPAIR_COOLDOWN_HOURS: 6, // Hours before retry allowed
  MAX_CONSECUTIVE_FAILURES: 3, // Circuit breaker threshold
  LOCK_EXPIRY_MINUTES: 10, // Lock auto-expires after this
  CHECK_TTL_DAYS: 14, // Auto-cleanup processed checks after this
  REPAIR_TTL_DAYS: 14, // Auto-cleanup repair attempts after this
  EXTENDED_COOLDOWN_HOURS: 24, // Extended cooldown after circuit breaker trips
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ProcessedIntegrityCheck {
  checkId: string
  type: 'scheduled' | 'manual'
  scheduleTime?: string | null
  requestId?: string | null
  triggeredBy: string
  processedAt: Timestamp
  completedAt?: Timestamp
  status: 'in_progress' | 'completed' | 'failed'
  error?: string
  ttl: Timestamp
}

export interface RepairAttemptRecord {
  attemptedAt: Timestamp
  checkId: string
  success: boolean
  error?: string
}

export interface RepairAttempt {
  contentId: string
  contentType: 'news_article' | 'story'
  repairType: string
  attempts: RepairAttemptRecord[]
  lastAttemptAt: Timestamp
  totalAttempts: number
  consecutiveFailures: number
  cooldownUntil?: Timestamp | null
  ttl: Timestamp
}

export interface SchedulerLock {
  lockId: string
  acquiredBy: string
  acquiredAt: Timestamp
  expiresAt: Timestamp
  heartbeatAt?: Timestamp
}

export interface CanRepairResult {
  allowed: boolean
  reason?: string
}

// ============================================================================
// CHECK ID GENERATION
// ============================================================================

/**
 * Generate a unique check ID from schedule time or manual request
 */
export function generateCheckId(
  type: 'scheduled' | 'manual',
  scheduleTime?: string,
  requestId?: string
): string {
  if (type === 'scheduled' && scheduleTime) {
    // Use schedule time as idempotency key for scheduled runs
    return `scheduled_${scheduleTime.replace(/[:.]/g, '-')}`
  }
  // For manual runs, use request ID + timestamp
  return `manual_${requestId || 'unknown'}_${Date.now()}`
}

// ============================================================================
// CHECK IDEMPOTENCY
// ============================================================================

/**
 * Check if an integrity check with this ID was already processed
 */
export async function wasCheckProcessed(checkId: string): Promise<boolean> {
  const ref = db.collection('ops').doc('integrity').collection('processed_checks').doc(checkId)
  const snap = await ref.get()
  return snap.exists
}

/**
 * Mark integrity check as started (in_progress)
 */
export async function markCheckStarted(
  checkId: string,
  type: 'scheduled' | 'manual',
  triggeredBy: string,
  scheduleTime?: string
): Promise<void> {
  const ref = db.collection('ops').doc('integrity').collection('processed_checks').doc(checkId)

  const ttl = Timestamp.fromMillis(
    Date.now() + IDEMPOTENCY_CONFIG.CHECK_TTL_DAYS * 24 * 60 * 60 * 1000
  )

  const data: ProcessedIntegrityCheck = {
    checkId,
    type,
    scheduleTime: scheduleTime || null,
    triggeredBy,
    processedAt: Timestamp.now(),
    status: 'in_progress',
    ttl,
  }

  await ref.set(data)

  logger.info('[Idempotency] Check started', { checkId, type, triggeredBy })
}

/**
 * Mark integrity check as completed or failed
 */
export async function markCheckCompleted(
  checkId: string,
  status: 'completed' | 'failed',
  error?: string
): Promise<void> {
  const ref = db.collection('ops').doc('integrity').collection('processed_checks').doc(checkId)

  const updateData: Partial<ProcessedIntegrityCheck> = {
    status,
    completedAt: Timestamp.now(),
  }

  if (error) {
    updateData.error = error
  }

  await ref.update(updateData)

  logger.info('[Idempotency] Check completed', { checkId, status, error: error || null })
}

// ============================================================================
// REPAIR COOLDOWN & CIRCUIT BREAKER
// ============================================================================

/**
 * Check if repair for content is allowed (not in cooldown, not circuit-broken)
 */
export async function canRepairContent(
  contentId: string,
  contentType: 'news_article' | 'story',
  repairType: string
): Promise<CanRepairResult> {
  const docId = `${contentType}_${contentId}_${repairType}`
  const ref = db.collection('ops').doc('integrity').collection('repair_attempts').doc(docId)

  const snap = await ref.get()

  if (!snap.exists) {
    return { allowed: true }
  }

  const data = snap.data() as RepairAttempt
  const now = Date.now()

  // Check circuit breaker
  if (data.consecutiveFailures >= IDEMPOTENCY_CONFIG.MAX_CONSECUTIVE_FAILURES) {
    // Allow retry after extended cooldown (24 hours)
    const extendedCooldownMs = IDEMPOTENCY_CONFIG.EXTENDED_COOLDOWN_HOURS * 60 * 60 * 1000
    if (data.lastAttemptAt && now - data.lastAttemptAt.toMillis() < extendedCooldownMs) {
      const remainingMs = extendedCooldownMs - (now - data.lastAttemptAt.toMillis())
      const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000))
      return {
        allowed: false,
        reason: `Circuit breaker: ${data.consecutiveFailures} consecutive failures, retry in ${remainingHours}h`,
      }
    }
  }

  // Check explicit cooldown (set after multiple failures)
  if (data.cooldownUntil && data.cooldownUntil.toMillis() > now) {
    const remainingMs = data.cooldownUntil.toMillis() - now
    const remainingMin = Math.ceil(remainingMs / 60000)
    return {
      allowed: false,
      reason: `Cooldown active: ${remainingMin} minutes remaining`,
    }
  }

  // Check normal cooldown period after any attempt
  if (data.lastAttemptAt) {
    const cooldownMs = IDEMPOTENCY_CONFIG.REPAIR_COOLDOWN_HOURS * 60 * 60 * 1000
    if (now - data.lastAttemptAt.toMillis() < cooldownMs) {
      const remainingMs = cooldownMs - (now - data.lastAttemptAt.toMillis())
      const remainingMin = Math.ceil(remainingMs / 60000)
      return {
        allowed: false,
        reason: `Recent attempt: retry in ${remainingMin} minutes`,
      }
    }
  }

  return { allowed: true }
}

/**
 * Record a repair attempt (success or failure)
 */
export async function recordRepairAttempt(
  contentId: string,
  contentType: 'news_article' | 'story',
  repairType: string,
  checkId: string,
  success: boolean,
  error?: string
): Promise<void> {
  const docId = `${contentType}_${contentId}_${repairType}`
  const ref = db.collection('ops').doc('integrity').collection('repair_attempts').doc(docId)

  const now = Timestamp.now()
  const ttl = Timestamp.fromMillis(
    Date.now() + IDEMPOTENCY_CONFIG.REPAIR_TTL_DAYS * 24 * 60 * 60 * 1000
  )

  const attemptRecord: RepairAttemptRecord = {
    attemptedAt: now,
    checkId,
    success,
  }

  if (error) {
    attemptRecord.error = error
  }

  await db.runTransaction(async transaction => {
    const snap = await transaction.get(ref)

    if (!snap.exists) {
      // First attempt for this content
      const data: RepairAttempt = {
        contentId,
        contentType,
        repairType,
        attempts: [attemptRecord],
        lastAttemptAt: now,
        totalAttempts: 1,
        consecutiveFailures: success ? 0 : 1,
        ttl,
      }
      transaction.set(ref, data)
    } else {
      const existingData = snap.data() as RepairAttempt
      const attempts = existingData.attempts || []

      // Keep last 10 attempts for history
      if (attempts.length >= 10) {
        attempts.shift()
      }
      attempts.push(attemptRecord)

      // Update consecutive failures
      const consecutiveFailures = success ? 0 : (existingData.consecutiveFailures || 0) + 1

      // Set extended cooldown if failures accumulating
      let cooldownUntil: Timestamp | null = null
      if (!success && consecutiveFailures >= 2) {
        // Exponential backoff: 6h, 12h, 24h (capped)
        const cooldownHours =
          IDEMPOTENCY_CONFIG.REPAIR_COOLDOWN_HOURS * Math.pow(2, consecutiveFailures - 1)
        const maxCooldownHours = IDEMPOTENCY_CONFIG.EXTENDED_COOLDOWN_HOURS
        const actualCooldownHours = Math.min(cooldownHours, maxCooldownHours)
        cooldownUntil = Timestamp.fromMillis(Date.now() + actualCooldownHours * 60 * 60 * 1000)
      }

      transaction.update(ref, {
        attempts,
        lastAttemptAt: now,
        totalAttempts: FieldValue.increment(1),
        consecutiveFailures,
        cooldownUntil,
        ttl,
      })
    }
  })

  logger.info('[Idempotency] Repair attempt recorded', {
    contentId,
    contentType,
    repairType,
    checkId,
    success,
    error: error || null,
  })
}

// ============================================================================
// DISTRIBUTED LOCKING
// ============================================================================

/**
 * Try to acquire distributed lock for integrity checker
 * Returns true if lock acquired, false if already locked by another instance
 */
export async function tryAcquireLock(instanceId: string): Promise<boolean> {
  const ref = db.collection('ops').doc('integrity').collection('locks').doc('integrity_checker')

  const now = Date.now()
  const expiresAt = Timestamp.fromMillis(now + IDEMPOTENCY_CONFIG.LOCK_EXPIRY_MINUTES * 60 * 1000)

  try {
    await db.runTransaction(async transaction => {
      const snap = await transaction.get(ref)

      if (snap.exists) {
        const data = snap.data() as SchedulerLock
        // Check if lock is expired
        if (data.expiresAt.toMillis() > now) {
          throw new Error('Lock already held')
        }
        // Lock expired, can take over
        logger.info('[Idempotency] Taking over expired lock', {
          previousHolder: data.acquiredBy,
          expiredAt: data.expiresAt.toDate().toISOString(),
        })
      }

      const lockData: SchedulerLock = {
        lockId: 'integrity_checker',
        acquiredBy: instanceId,
        acquiredAt: Timestamp.now(),
        expiresAt,
      }

      transaction.set(ref, lockData)
    })

    logger.info('[Idempotency] Lock acquired', { instanceId })
    return true
  } catch (error) {
    if (error instanceof Error && error.message === 'Lock already held') {
      logger.info('[Idempotency] Lock already held, skipping', { instanceId })
      return false
    }
    // Re-throw unexpected errors
    throw error
  }
}

/**
 * Release the distributed lock
 */
export async function releaseLock(instanceId: string): Promise<void> {
  const ref = db.collection('ops').doc('integrity').collection('locks').doc('integrity_checker')

  try {
    await db.runTransaction(async transaction => {
      const snap = await transaction.get(ref)

      if (!snap.exists) {
        // Already released or never existed
        return
      }

      const data = snap.data() as SchedulerLock
      if (data.acquiredBy !== instanceId) {
        logger.warn('[Idempotency] Cannot release lock held by another instance', {
          currentHolder: data.acquiredBy,
          requestedBy: instanceId,
        })
        return
      }

      transaction.delete(ref)
    })

    logger.info('[Idempotency] Lock released', { instanceId })
  } catch (error) {
    logger.error('[Idempotency] Error releasing lock', {
      instanceId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Update lock heartbeat (extend expiry for long-running checks)
 */
export async function updateLockHeartbeat(instanceId: string): Promise<void> {
  const ref = db.collection('ops').doc('integrity').collection('locks').doc('integrity_checker')

  const expiresAt = Timestamp.fromMillis(
    Date.now() + IDEMPOTENCY_CONFIG.LOCK_EXPIRY_MINUTES * 60 * 1000
  )

  try {
    await ref.update({
      heartbeatAt: Timestamp.now(),
      expiresAt,
    })
    logger.debug('[Idempotency] Lock heartbeat updated', { instanceId })
  } catch (error) {
    logger.warn('[Idempotency] Failed to update lock heartbeat', {
      instanceId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Clean up old processed checks and repair attempts (TTL-based)
 * Should be called opportunistically after successful integrity checks
 */
export async function cleanupOldRecords(): Promise<{
  checksDeleted: number
  attemptsDeleted: number
}> {
  const now = Timestamp.now()
  let checksDeleted = 0
  let attemptsDeleted = 0

  try {
    // Clean processed_checks with expired TTL
    const checksQuery = db
      .collection('ops')
      .doc('integrity')
      .collection('processed_checks')
      .where('ttl', '<', now)
      .limit(100)

    const checksSnap = await checksQuery.get()
    if (!checksSnap.empty) {
      const batch = db.batch()
      checksSnap.docs.forEach(doc => batch.delete(doc.ref))
      await batch.commit()
      checksDeleted = checksSnap.size
    }

    // Clean repair_attempts with expired TTL
    const attemptsQuery = db
      .collection('ops')
      .doc('integrity')
      .collection('repair_attempts')
      .where('ttl', '<', now)
      .limit(100)

    const attemptsSnap = await attemptsQuery.get()
    if (!attemptsSnap.empty) {
      const batch = db.batch()
      attemptsSnap.docs.forEach(doc => batch.delete(doc.ref))
      await batch.commit()
      attemptsDeleted = attemptsSnap.size
    }

    if (checksDeleted > 0 || attemptsDeleted > 0) {
      logger.info('[Idempotency] Cleanup completed', { checksDeleted, attemptsDeleted })
    }
  } catch (error) {
    logger.warn('[Idempotency] Cleanup failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }

  return { checksDeleted, attemptsDeleted }
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export const integrityIdempotency = {
  generateCheckId,
  wasCheckProcessed,
  markCheckStarted,
  markCheckCompleted,
  canRepairContent,
  recordRepairAttempt,
  tryAcquireLock,
  releaseLock,
  updateLockHeartbeat,
  cleanupOldRecords,
}
