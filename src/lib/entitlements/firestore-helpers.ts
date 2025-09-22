/**
 * Firestore Helpers for Entitlements
 * Agent 2 Implementation
 * 
 * Helper functions for managing usage buckets and decision logs
 */

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  UsageBucket,
  EntitlementLog,
  FeatureId,
  PlanType
} from '@/types/entitlements';
import { getTodayBucket } from './evaluator';

/**
 * Get or create a usage bucket for a user on a specific date
 */
export async function getUsageBucket(
  userId: string,
  date: string
): Promise<UsageBucket> {
  const bucketRef = adminDb
    .collection('usage')
    .doc(userId)
    .collection('daily')
    .doc(date);

  const doc = await bucketRef.get();

  if (doc.exists) {
    return doc.data() as UsageBucket;
  }

  // Create new bucket
  const newBucket: UsageBucket = {
    userId,
    date,
    counts: {},
    updatedAt: new Date().toISOString()
  };

  await bucketRef.set(newBucket);
  return newBucket;
}

/**
 * Increment usage for a feature
 * NOTE: This should be called within a transaction for atomicity
 */
export function incrementUsage(
  transaction: FirebaseFirestore.Transaction,
  userId: string,
  featureId: FeatureId,
  date: string
): void {
  const bucketRef = adminDb
    .collection('usage')
    .doc(userId)
    .collection('daily')
    .doc(date);

  transaction.update(bucketRef, {
    [`counts.${featureId}`]: FieldValue.increment(1),
    updatedAt: new Date().toISOString()
  });
}

/**
 * Get usage for today
 */
export async function getTodayUsage(
  userId: string
): Promise<Record<FeatureId, number>> {
  const today = getTodayBucket(new Date().toISOString());
  const bucket = await getUsageBucket(userId, today);

  return {
    hiragana_practice: bucket.counts.hiragana_practice || 0,
    katakana_practice: bucket.counts.katakana_practice || 0
  };
}

/**
 * Log an entitlement decision
 */
export async function logDecision(
  decision: EntitlementLog
): Promise<void> {
  await adminDb
    .collection('logs')
    .doc('entitlements')
    .collection('decisions')
    .add({
      ...decision,
      serverTimestamp: FieldValue.serverTimestamp()
    });
}

/**
 * Clean up old usage buckets (older than 30 days)
 */
export async function cleanupOldUsageBuckets(
  userId: string,
  daysToKeep: number = 30
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  const cutoffString = getTodayBucket(cutoffDate.toISOString());

  const bucketsRef = adminDb
    .collection('usage')
    .doc(userId)
    .collection('daily');

  const oldBuckets = await bucketsRef
    .where('date', '<', cutoffString)
    .get();

  let deletedCount = 0;
  const batch = adminDb.batch();

  oldBuckets.forEach((doc) => {
    batch.delete(doc.ref);
    deletedCount++;
  });

  if (deletedCount > 0) {
    await batch.commit();
  }

  return deletedCount;
}

/**
 * Get usage history for a user
 */
export async function getUsageHistory(
  userId: string,
  days: number = 7
): Promise<UsageBucket[]> {
  const bucketsRef = adminDb
    .collection('usage')
    .doc(userId)
    .collection('daily');

  const snapshot = await bucketsRef
    .orderBy('date', 'desc')
    .limit(days)
    .get();

  return snapshot.docs.map(doc => doc.data() as UsageBucket);
}

/**
 * Get decision logs for a user
 */
export async function getDecisionLogs(
  userId: string,
  limit: number = 100
): Promise<EntitlementLog[]> {
  const logsRef = adminDb
    .collection('logs')
    .doc('entitlements')
    .collection('decisions');

  const snapshot = await logsRef
    .where('userId', '==', userId)
    .orderBy('ts', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => doc.data() as EntitlementLog);
}

/**
 * Check if idempotency key was already used
 */
export async function checkIdempotency(
  userId: string,
  featureId: FeatureId,
  idempotencyKey: string
): Promise<boolean> {
  const idempotencyRef = adminDb
    .collection('idempotency')
    .doc(`${userId}_${featureId}_${idempotencyKey}`);

  const doc = await idempotencyRef.get();
  return doc.exists;
}

/**
 * Clean up expired idempotency records
 */
export async function cleanupExpiredIdempotency(): Promise<number> {
  const now = new Date().toISOString();
  
  const expiredDocs = await adminDb
    .collection('idempotency')
    .where('expiresAt', '<', now)
    .get();

  let deletedCount = 0;
  const batch = adminDb.batch();

  expiredDocs.forEach((doc) => {
    batch.delete(doc.ref);
    deletedCount++;
  });

  if (deletedCount > 0) {
    await batch.commit();
  }

  return deletedCount;
}

/**
 * Get usage statistics for a feature across all users
 */
export async function getFeatureStats(
  featureId: FeatureId,
  date?: string
): Promise<{
  totalUses: number;
  uniqueUsers: number;
  byPlan: Record<PlanType, number>;
}> {
  const targetDate = date || getTodayBucket(new Date().toISOString());
  
  // This would need to be implemented with aggregation queries
  // or a separate stats collection maintained by Cloud Functions
  // For now, returning a placeholder
  
  return {
    totalUses: 0,
    uniqueUsers: 0,
    byPlan: {
      guest: 0,
      free: 0,
      premium_monthly: 0,
      premium_yearly: 0
    }
  };
}

/**
 * Reset usage for a specific feature (admin only)
 */
export async function resetFeatureUsage(
  userId: string,
  featureId: FeatureId
): Promise<void> {
  const today = getTodayBucket(new Date().toISOString());
  const bucketRef = adminDb
    .collection('usage')
    .doc(userId)
    .collection('daily')
    .doc(today);

  await bucketRef.update({
    [`counts.${featureId}`]: 0,
    updatedAt: new Date().toISOString()
  });
}