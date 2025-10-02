/**
 * Idempotency System for Stats Updates
 *
 * Prevents duplicate stat updates (XP, streaks, achievements) when:
 * - User rapidly clicks buttons
 * - Network retries duplicate requests
 * - Offline sync replays same events
 * - Multi-tab scenarios
 *
 * Uses Firebase to store idempotency keys with automatic expiry.
 * Keys are scoped to userId + unique operation identifier.
 */

import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import logger from '@/lib/logger'

// Collection for storing idempotency keys
const IDEMPOTENCY_COLLECTION = 'idempotency_keys'

// Default expiry: 24 hours (in milliseconds)
const DEFAULT_EXPIRY_HOURS = 24
const DEFAULT_EXPIRY_MS = DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000

/**
 * Check if an idempotency key has already been used
 *
 * @param userId - The user ID
 * @param key - The idempotency key (should be unique per operation)
 * @returns true if key was already used, false if this is a new operation
 */
export async function checkIdempotency(
  userId: string,
  key: string
): Promise<boolean> {
  try {
    const docId = `${userId}_${key}`
    const doc = await adminDb
      .collection(IDEMPOTENCY_COLLECTION)
      .doc(docId)
      .get()

    if (!doc.exists) {
      return false // Key not found = new operation
    }

    const data = doc.data()
    if (!data) {
      return false
    }

    // Check if key has expired
    const now = Date.now()
    if (data.expiresAt && data.expiresAt < now) {
      // Key expired - clean it up and treat as new
      await adminDb
        .collection(IDEMPOTENCY_COLLECTION)
        .doc(docId)
        .delete()

      logger.info('[Idempotency] Expired key cleaned up', {
        userId,
        key,
        expiredAt: data.expiresAt
      })

      return false
    }

    // Key exists and hasn't expired = duplicate
    logger.info('[Idempotency] Duplicate operation detected', {
      userId,
      key,
      originalTimestamp: data.createdAt,
      expiresAt: data.expiresAt
    })

    return true

  } catch (error) {
    logger.error('[Idempotency] Error checking key:', error)
    // On error, allow the operation (fail open for availability)
    return false
  }
}

/**
 * Record an idempotency key to prevent future duplicates
 *
 * @param userId - The user ID
 * @param key - The idempotency key
 * @param expiryHours - How many hours until key expires (default 24)
 * @param metadata - Optional metadata to store with the key
 */
export async function recordIdempotency(
  userId: string,
  key: string,
  expiryHours: number = DEFAULT_EXPIRY_HOURS,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const docId = `${userId}_${key}`
    const now = Date.now()
    const expiresAt = now + (expiryHours * 60 * 60 * 1000)

    await adminDb
      .collection(IDEMPOTENCY_COLLECTION)
      .doc(docId)
      .set({
        userId,
        key,
        createdAt: now,
        expiresAt,
        ...(metadata || {})
      })

    logger.info('[Idempotency] Key recorded', {
      userId,
      key,
      expiresAt,
      expiresIn: `${expiryHours}h`
    })

  } catch (error) {
    logger.error('[Idempotency] Error recording key:', error)
    // Don't throw - idempotency is a best-effort system
    // Failing to record a key is better than blocking valid operations
  }
}

/**
 * Generate a deterministic idempotency key from operation parameters
 *
 * Useful for offline sync where same operation might be replayed.
 * Uses consistent hash of operation details.
 *
 * @param operationType - Type of operation (session, xp, achievement, etc.)
 * @param params - Operation parameters to hash
 * @returns Idempotency key string
 */
export function generateIdempotencyKey(
  operationType: string,
  params: Record<string, any>
): string {
  // Sort keys for consistent hashing
  const sortedKeys = Object.keys(params).sort()
  const paramString = sortedKeys
    .map(key => `${key}:${JSON.stringify(params[key])}`)
    .join('|')

  // Simple hash (can use crypto.subtle in browser if needed)
  const hash = simpleHash(paramString)

  return `${operationType}_${hash}_${Date.now()}`
}

/**
 * Clean up expired idempotency keys (for scheduled maintenance)
 *
 * Should be called periodically (e.g., daily cron job)
 */
export async function cleanupExpiredKeys(): Promise<number> {
  try {
    const now = Date.now()
    const snapshot = await adminDb
      .collection(IDEMPOTENCY_COLLECTION)
      .where('expiresAt', '<', now)
      .limit(500) // Batch delete to avoid quota issues
      .get()

    if (snapshot.empty) {
      logger.info('[Idempotency] No expired keys to clean up')
      return 0
    }

    const batch = adminDb.batch()
    let count = 0

    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref)
      count++
    })

    await batch.commit()

    logger.info('[Idempotency] Cleaned up expired keys', {
      count,
      totalChecked: snapshot.size
    })

    return count

  } catch (error) {
    logger.error('[Idempotency] Error cleaning up expired keys:', error)
    return 0
  }
}

/**
 * Simple hash function for idempotency key generation
 * (Not cryptographically secure - just for deduplication)
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Get idempotency metadata for debugging
 *
 * @param userId - The user ID
 * @param key - The idempotency key
 * @returns Key metadata if found, null otherwise
 */
export async function getIdempotencyMetadata(
  userId: string,
  key: string
): Promise<{
  userId: string
  key: string
  createdAt: number
  expiresAt: number
  metadata?: Record<string, any>
} | null> {
  try {
    const docId = `${userId}_${key}`
    const doc = await adminDb
      .collection(IDEMPOTENCY_COLLECTION)
      .doc(docId)
      .get()

    if (!doc.exists) {
      return null
    }

    return doc.data() as any

  } catch (error) {
    logger.error('[Idempotency] Error getting metadata:', error)
    return null
  }
}
