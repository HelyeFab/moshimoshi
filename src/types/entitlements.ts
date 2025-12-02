/**
 * Entitlements v2 - Core Types
 * Agent 2 Implementation
 */

// Re-export FeatureId from the generated source of truth
export type { FeatureId } from './FeatureId';

export type PlanType = 'guest' | 'free' | 'premium_monthly' | 'premium_yearly';

export type Permission = 'do_practice';

export type FeatureLifecycle = 'active' | 'deprecated' | 'hidden';

export type DecisionReason = 'ok' | 'no_permission' | 'limit_reached' | 'lifecycle_blocked';

export interface Feature {
  id: FeatureId;
  name: string;
  category: string;
  lifecycle: FeatureLifecycle;
  permission: Permission;
  limitType: 'daily' | 'monthly';
  notifications: boolean;
}

export interface EvalContext {
  userId: string;
  plan: PlanType;
  usage: Record<FeatureId, number>;
  nowUtcISO: string;
  overrides?: Partial<Record<FeatureId, number | 'unlimited'>>;
  tenant?: {
    id?: string;
    dailyCaps?: Partial<Record<FeatureId, number>>;
  };
  /** Optional: Simulate evaluation at a different date (admin use) */
  simulateDate?: Date;
  /** Optional: Skip logging for simulation purposes */
  skipLogging?: boolean;
}

export interface Decision {
  allow: boolean;
  remaining: number | -1; // -1 means unlimited
  reason: DecisionReason;
  policyVersion: number;
  resetAtUtc?: string;
  featureId?: FeatureId;
  userId?: string;
  plan?: PlanType;
  usageBefore?: number;
  limit?: number;
}

export interface PolicyLimits {
  guest: {
    daily: Record<FeatureId, number>;
    monthly?: Record<FeatureId, number>;
  };
  free: {
    daily: Record<FeatureId, number>;
    monthly?: Record<FeatureId, number>;
  };
  premium_monthly: {
    daily: Record<FeatureId, number>;
    monthly?: Record<FeatureId, number>;
  };
  premium_yearly: {
    daily: Record<FeatureId, number>;
    monthly?: Record<FeatureId, number>;
  };
}

export interface UsageBucket {
  userId: string;
  date: string; // YYYY-MM-DD
  counts: Partial<Record<FeatureId, number>>;
  updatedAt: string;
}

export interface EntitlementLog {
  ts: string;
  userId: string;
  featureId: FeatureId;
  plan: PlanType;
  usageBefore: number;
  limit: number;
  allow: boolean;
  remaining: number;
  reason: DecisionReason;
  policyVersion: number;
  idempotencyKey?: string;
}

/**
 * Feature override for a specific user/feature
 * Allows admins to grant/restrict access beyond normal plan limits
 */
export interface FeatureOverride {
  id: string;
  featureId: FeatureId;
  setBy: string;
  limit?: number | null;
  allow?: boolean | null;
  note?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expiresAt?: any; // Firestore Timestamp or Date
  active: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any; // Firestore Timestamp or Date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatedAt: any; // Firestore Timestamp or Date
}

/**
 * Log entry for override actions
 */
export interface OverrideLog {
  userId: string;
  featureId: FeatureId;
  action: 'SET' | 'REMOVE';
  override: Partial<FeatureOverride>;
  adminId: string;
  timestamp: Date;
}