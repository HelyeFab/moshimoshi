/**
 * Admin Evaluator - Administrative functions for entitlements
 * Extends the base evaluator with admin-specific functionality
 */

import { evaluate } from './evaluator';
import { adminFirestore } from '@/lib/firebase/admin';
import {
  FeatureId,
  EvalContext,
  Decision,
  FeatureOverride,
  EntitlementLog,
  OverrideLog
} from '@/types/entitlements';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Evaluate entitlement with override support
 * Checks for active overrides before falling back to regular evaluation
 */
export async function evaluateEntitlementWithOverrides(
  userId: string,
  featureId: FeatureId,
  ctx: EvalContext
): Promise<Decision & { override?: boolean }> {
  // Check for active overrides first
  const overrides = await getUserOverrides(userId);
  const override = overrides.find(o =>
    o.featureId === featureId &&
    o.active &&
    (!o.expiresAt || o.expiresAt.toDate() > new Date())
  );

  if (override) {
    return {
      allow: override.allow,
      remaining: override.limit || Infinity,
      reason: `Override: ${override.reason}`,
      override: true
    };
  }

  // Fall back to regular evaluation
  return evaluate(featureId, ctx);
}

/**
 * Get all overrides for a user
 */
export async function getUserOverrides(userId: string): Promise<FeatureOverride[]> {
  const snapshot = await adminFirestore
    .collection('user_overrides')
    .doc(userId)
    .collection('overrides')
    .where('active', '==', true)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as FeatureOverride));
}

/**
 * Set a feature override for a user
 * Alias for setFeatureOverride
 */
export async function setOverride(
  userId: string,
  featureId: FeatureId,
  override: Omit<FeatureOverride, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  return setFeatureOverride(userId, featureId, override);
}

/**
 * Set a feature override for a user
 */
export async function setFeatureOverride(
  userId: string,
  featureId: FeatureId,
  override: Omit<FeatureOverride, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const overrideData = {
    ...override,
    featureId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    active: true
  };

  const docRef = await adminFirestore
    .collection('user_overrides')
    .doc(userId)
    .collection('overrides')
    .add(overrideData);

  // Log the override creation
  await logOverride({
    userId,
    featureId,
    action: 'SET',
    override: overrideData,
    adminId: override.setBy,
    timestamp: new Date()
  });

  return docRef.id;
}

/**
 * Remove a feature override
 * Alias for removeFeatureOverride
 */
export async function removeOverride(
  userId: string,
  overrideId: string,
  adminId: string
): Promise<void> {
  return removeFeatureOverride(userId, overrideId, adminId);
}

/**
 * Remove a feature override
 */
export async function removeFeatureOverride(
  userId: string,
  overrideId: string,
  adminId: string
): Promise<void> {
  const overrideRef = adminFirestore
    .collection('user_overrides')
    .doc(userId)
    .collection('overrides')
    .doc(overrideId);

  // Get the override data before deleting
  const overrideDoc = await overrideRef.get();
  const overrideData = overrideDoc.data();

  // Mark as inactive instead of deleting (for audit trail)
  await overrideRef.update({
    active: false,
    updatedAt: Timestamp.now(),
    removedBy: adminId,
    removedAt: Timestamp.now()
  });

  // Log the override removal
  await logOverride({
    userId,
    featureId: overrideData?.featureId,
    action: 'REMOVE',
    override: overrideData,
    adminId,
    timestamp: new Date()
  });
}

/**
 * Get entitlement decision logs
 */
export async function getEntitlementLogs(
  filters: {
    userId?: string;
    featureId?: FeatureId;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}
): Promise<EntitlementLog[]> {
  let query = adminFirestore
    .collection('entitlement_logs')
    .orderBy('timestamp', 'desc');

  if (filters.userId) {
    query = query.where('userId', '==', filters.userId);
  }

  if (filters.featureId) {
    query = query.where('featureId', '==', filters.featureId);
  }

  if (filters.startDate) {
    query = query.where('timestamp', '>=', Timestamp.fromDate(filters.startDate));
  }

  if (filters.endDate) {
    query = query.where('timestamp', '<=', Timestamp.fromDate(filters.endDate));
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const snapshot = await query.get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp?.toDate()
  } as EntitlementLog));
}

/**
 * Log an override action for audit trail
 */
async function logOverride(log: {
  userId: string;
  featureId: FeatureId;
  action: 'SET' | 'REMOVE';
  override: any;
  adminId: string;
  timestamp: Date;
}): Promise<void> {
  try {
    await adminFirestore.collection('override_logs').add({
      ...log,
      timestamp: Timestamp.fromDate(log.timestamp)
    });
  } catch (error) {
    console.error('Failed to log override:', error);
    // Don't throw - logging shouldn't break the operation
  }
}