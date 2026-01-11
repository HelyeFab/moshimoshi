"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrityIdempotency = exports.IDEMPOTENCY_CONFIG = void 0;
exports.generateCheckId = generateCheckId;
exports.wasCheckProcessed = wasCheckProcessed;
exports.markCheckStarted = markCheckStarted;
exports.markCheckCompleted = markCheckCompleted;
exports.updateCheckProgress = updateCheckProgress;
exports.canRepairContent = canRepairContent;
exports.recordRepairAttempt = recordRepairAttempt;
exports.tryAcquireLock = tryAcquireLock;
exports.releaseLock = releaseLock;
exports.updateLockHeartbeat = updateLockHeartbeat;
exports.cleanupOldRecords = cleanupOldRecords;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const db = admin.firestore();
// ============================================================================
// CONFIGURATION
// ============================================================================
exports.IDEMPOTENCY_CONFIG = {
    REPAIR_COOLDOWN_HOURS: 0, // Disabled - allow immediate retries
    MAX_CONSECUTIVE_FAILURES: 3, // Circuit breaker threshold
    LOCK_EXPIRY_MINUTES: 10, // Lock auto-expires after this
    CHECK_TTL_DAYS: 14, // Auto-cleanup processed checks after this
    REPAIR_TTL_DAYS: 14, // Auto-cleanup repair attempts after this
    EXTENDED_COOLDOWN_HOURS: 0, // Disabled - no extended cooldown
};
// ============================================================================
// CHECK ID GENERATION
// ============================================================================
/**
 * Generate a unique check ID from schedule time or manual request
 *
 * For scheduled runs: Uses schedule time as idempotency key
 * For manual runs: Uses time slot (rounded to minute) + triggeredBy for idempotency
 *
 * This ensures that:
 * - Scheduled runs with the same schedule time are deduplicated
 * - Manual runs within the same minute by the same user are deduplicated
 */
function generateCheckId(type, timeSlot, triggeredBy) {
    if (type === 'scheduled' && timeSlot) {
        // Use schedule time as idempotency key for scheduled runs
        return `scheduled_${timeSlot.replace(/[:.]/g, '-')}`;
    }
    if (type === 'manual' && timeSlot) {
        // Use time slot + triggeredBy for manual runs (idempotent within same minute)
        const sanitizedTime = timeSlot.replace(/[:.]/g, '-');
        const sanitizedUser = (triggeredBy || 'unknown').replace(/[^a-zA-Z0-9-]/g, '_');
        return `manual_${sanitizedTime}_${sanitizedUser}`;
    }
    // Fallback: unique ID (no idempotency)
    return `${type}_${triggeredBy || 'unknown'}_${Date.now()}`;
}
// ============================================================================
// CHECK IDEMPOTENCY
// ============================================================================
/**
 * Check if an integrity check with this ID was already processed
 */
async function wasCheckProcessed(checkId) {
    const ref = db.collection('ops').doc('integrity').collection('processed_checks').doc(checkId);
    const snap = await ref.get();
    return snap.exists;
}
/**
 * Mark integrity check as started (in_progress)
 */
async function markCheckStarted(checkId, type, triggeredBy, scheduleTime) {
    const ref = db.collection('ops').doc('integrity').collection('processed_checks').doc(checkId);
    const ttl = firestore_1.Timestamp.fromMillis(Date.now() + exports.IDEMPOTENCY_CONFIG.CHECK_TTL_DAYS * 24 * 60 * 60 * 1000);
    const data = {
        checkId,
        type,
        scheduleTime: scheduleTime || null,
        triggeredBy,
        processedAt: firestore_1.Timestamp.now(),
        status: 'in_progress',
        progress: 'starting',
        progressDetails: null,
        lastProgressAt: firestore_1.Timestamp.now(),
        ttl,
    };
    await ref.set(data);
    logger.info('[Idempotency] Check started', { checkId, type, triggeredBy });
}
/**
 * Mark integrity check as completed or failed
 */
async function markCheckCompleted(checkId, status, error) {
    const ref = db.collection('ops').doc('integrity').collection('processed_checks').doc(checkId);
    const updateData = {
        status,
        completedAt: firestore_1.Timestamp.now(),
    };
    if (error) {
        updateData.error = error;
    }
    await ref.update(updateData);
    logger.info('[Idempotency] Check completed', { checkId, status, error: error || null });
}
/**
 * Update check progress (for real-time status updates in UI)
 */
async function updateCheckProgress(checkId, progress, details) {
    const ref = db.collection('ops').doc('integrity').collection('processed_checks').doc(checkId);
    try {
        await ref.update({
            progress,
            progressDetails: details || null,
            lastProgressAt: firestore_1.Timestamp.now(),
        });
        logger.debug('[Idempotency] Progress updated', { checkId, progress, details });
    }
    catch (error) {
        // Don't fail the check if progress update fails
        logger.warn('[Idempotency] Failed to update progress', {
            checkId,
            progress,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
// ============================================================================
// REPAIR COOLDOWN & CIRCUIT BREAKER
// ============================================================================
/**
 * Check if repair for content is allowed (not in cooldown, not circuit-broken)
 */
async function canRepairContent(contentId, contentType, repairType) {
    const docId = `${contentType}_${contentId}_${repairType}`;
    const ref = db.collection('ops').doc('integrity').collection('repair_attempts').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
        return { allowed: true };
    }
    const data = snap.data();
    const now = Date.now();
    // Check circuit breaker
    if (data.consecutiveFailures >= exports.IDEMPOTENCY_CONFIG.MAX_CONSECUTIVE_FAILURES) {
        // Allow retry after extended cooldown (24 hours)
        const extendedCooldownMs = exports.IDEMPOTENCY_CONFIG.EXTENDED_COOLDOWN_HOURS * 60 * 60 * 1000;
        if (data.lastAttemptAt && now - data.lastAttemptAt.toMillis() < extendedCooldownMs) {
            const remainingMs = extendedCooldownMs - (now - data.lastAttemptAt.toMillis());
            const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
            return {
                allowed: false,
                reason: `Circuit breaker: ${data.consecutiveFailures} consecutive failures, retry in ${remainingHours}h`,
            };
        }
    }
    // Check explicit cooldown (set after multiple failures)
    if (data.cooldownUntil && data.cooldownUntil.toMillis() > now) {
        const remainingMs = data.cooldownUntil.toMillis() - now;
        const remainingMin = Math.ceil(remainingMs / 60000);
        return {
            allowed: false,
            reason: `Cooldown active: ${remainingMin} minutes remaining`,
        };
    }
    // Check normal cooldown period after any attempt
    if (data.lastAttemptAt) {
        const cooldownMs = exports.IDEMPOTENCY_CONFIG.REPAIR_COOLDOWN_HOURS * 60 * 60 * 1000;
        if (now - data.lastAttemptAt.toMillis() < cooldownMs) {
            const remainingMs = cooldownMs - (now - data.lastAttemptAt.toMillis());
            const remainingMin = Math.ceil(remainingMs / 60000);
            return {
                allowed: false,
                reason: `Recent attempt: retry in ${remainingMin} minutes`,
            };
        }
    }
    return { allowed: true };
}
/**
 * Record a repair attempt (success or failure)
 */
async function recordRepairAttempt(contentId, contentType, repairType, checkId, success, error) {
    const docId = `${contentType}_${contentId}_${repairType}`;
    const ref = db.collection('ops').doc('integrity').collection('repair_attempts').doc(docId);
    const now = firestore_1.Timestamp.now();
    const ttl = firestore_1.Timestamp.fromMillis(Date.now() + exports.IDEMPOTENCY_CONFIG.REPAIR_TTL_DAYS * 24 * 60 * 60 * 1000);
    const attemptRecord = {
        attemptedAt: now,
        checkId,
        success,
    };
    if (error) {
        attemptRecord.error = error;
    }
    await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists) {
            // First attempt for this content
            const data = {
                contentId,
                contentType,
                repairType,
                attempts: [attemptRecord],
                lastAttemptAt: now,
                totalAttempts: 1,
                consecutiveFailures: success ? 0 : 1,
                ttl,
            };
            transaction.set(ref, data);
        }
        else {
            const existingData = snap.data();
            const attempts = existingData.attempts || [];
            // Keep last 10 attempts for history
            if (attempts.length >= 10) {
                attempts.shift();
            }
            attempts.push(attemptRecord);
            // Update consecutive failures
            const consecutiveFailures = success ? 0 : (existingData.consecutiveFailures || 0) + 1;
            // Set extended cooldown if failures accumulating
            let cooldownUntil = null;
            if (!success && consecutiveFailures >= 2) {
                // Exponential backoff: 6h, 12h, 24h (capped)
                const cooldownHours = exports.IDEMPOTENCY_CONFIG.REPAIR_COOLDOWN_HOURS * Math.pow(2, consecutiveFailures - 1);
                const maxCooldownHours = exports.IDEMPOTENCY_CONFIG.EXTENDED_COOLDOWN_HOURS;
                const actualCooldownHours = Math.min(cooldownHours, maxCooldownHours);
                cooldownUntil = firestore_1.Timestamp.fromMillis(Date.now() + actualCooldownHours * 60 * 60 * 1000);
            }
            transaction.update(ref, {
                attempts,
                lastAttemptAt: now,
                totalAttempts: firestore_1.FieldValue.increment(1),
                consecutiveFailures,
                cooldownUntil,
                ttl,
            });
        }
    });
    logger.info('[Idempotency] Repair attempt recorded', {
        contentId,
        contentType,
        repairType,
        checkId,
        success,
        error: error || null,
    });
}
// ============================================================================
// DISTRIBUTED LOCKING
// ============================================================================
/**
 * Try to acquire distributed lock for integrity checker
 * Returns true if lock acquired, false if already locked by another instance
 */
async function tryAcquireLock(instanceId) {
    const ref = db.collection('ops').doc('integrity').collection('locks').doc('integrity_checker');
    const now = Date.now();
    const expiresAt = firestore_1.Timestamp.fromMillis(now + exports.IDEMPOTENCY_CONFIG.LOCK_EXPIRY_MINUTES * 60 * 1000);
    try {
        await db.runTransaction(async (transaction) => {
            const snap = await transaction.get(ref);
            if (snap.exists) {
                const data = snap.data();
                // Check if lock is expired
                if (data.expiresAt.toMillis() > now) {
                    throw new Error('Lock already held');
                }
                // Lock expired, can take over
                logger.info('[Idempotency] Taking over expired lock', {
                    previousHolder: data.acquiredBy,
                    expiredAt: data.expiresAt.toDate().toISOString(),
                });
            }
            const lockData = {
                lockId: 'integrity_checker',
                acquiredBy: instanceId,
                acquiredAt: firestore_1.Timestamp.now(),
                expiresAt,
            };
            transaction.set(ref, lockData);
        });
        logger.info('[Idempotency] Lock acquired', { instanceId });
        return true;
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Lock already held') {
            logger.info('[Idempotency] Lock already held, skipping', { instanceId });
            return false;
        }
        // Re-throw unexpected errors
        throw error;
    }
}
/**
 * Release the distributed lock
 */
async function releaseLock(instanceId) {
    const ref = db.collection('ops').doc('integrity').collection('locks').doc('integrity_checker');
    try {
        await db.runTransaction(async (transaction) => {
            const snap = await transaction.get(ref);
            if (!snap.exists) {
                // Already released or never existed
                return;
            }
            const data = snap.data();
            if (data.acquiredBy !== instanceId) {
                logger.warn('[Idempotency] Cannot release lock held by another instance', {
                    currentHolder: data.acquiredBy,
                    requestedBy: instanceId,
                });
                return;
            }
            transaction.delete(ref);
        });
        logger.info('[Idempotency] Lock released', { instanceId });
    }
    catch (error) {
        logger.error('[Idempotency] Error releasing lock', {
            instanceId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
/**
 * Update lock heartbeat (extend expiry for long-running checks)
 */
async function updateLockHeartbeat(instanceId) {
    const ref = db.collection('ops').doc('integrity').collection('locks').doc('integrity_checker');
    const expiresAt = firestore_1.Timestamp.fromMillis(Date.now() + exports.IDEMPOTENCY_CONFIG.LOCK_EXPIRY_MINUTES * 60 * 1000);
    try {
        await ref.update({
            heartbeatAt: firestore_1.Timestamp.now(),
            expiresAt,
        });
        logger.debug('[Idempotency] Lock heartbeat updated', { instanceId });
    }
    catch (error) {
        logger.warn('[Idempotency] Failed to update lock heartbeat', {
            instanceId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
// ============================================================================
// CLEANUP
// ============================================================================
/**
 * Clean up old processed checks and repair attempts (TTL-based)
 * Should be called opportunistically after successful integrity checks
 */
async function cleanupOldRecords() {
    const now = firestore_1.Timestamp.now();
    let checksDeleted = 0;
    let attemptsDeleted = 0;
    try {
        // Clean processed_checks with expired TTL
        const checksQuery = db
            .collection('ops')
            .doc('integrity')
            .collection('processed_checks')
            .where('ttl', '<', now)
            .limit(100);
        const checksSnap = await checksQuery.get();
        if (!checksSnap.empty) {
            const batch = db.batch();
            checksSnap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            checksDeleted = checksSnap.size;
        }
        // Clean repair_attempts with expired TTL
        const attemptsQuery = db
            .collection('ops')
            .doc('integrity')
            .collection('repair_attempts')
            .where('ttl', '<', now)
            .limit(100);
        const attemptsSnap = await attemptsQuery.get();
        if (!attemptsSnap.empty) {
            const batch = db.batch();
            attemptsSnap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            attemptsDeleted = attemptsSnap.size;
        }
        if (checksDeleted > 0 || attemptsDeleted > 0) {
            logger.info('[Idempotency] Cleanup completed', { checksDeleted, attemptsDeleted });
        }
    }
    catch (error) {
        logger.warn('[Idempotency] Cleanup failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
    return { checksDeleted, attemptsDeleted };
}
// ============================================================================
// UTILITY EXPORTS
// ============================================================================
exports.integrityIdempotency = {
    generateCheckId,
    wasCheckProcessed,
    markCheckStarted,
    markCheckCompleted,
    updateCheckProgress,
    canRepairContent,
    recordRepairAttempt,
    tryAcquireLock,
    releaseLock,
    updateLockHeartbeat,
    cleanupOldRecords,
};
//# sourceMappingURL=integrityIdempotency.js.map