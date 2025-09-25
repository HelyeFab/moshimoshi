/**
 * Entitlements v2 - Core Types
 * Agent 2 Implementation
 */

export type FeatureId =
  | 'hiragana_practice'
  | 'katakana_practice'
  | 'kanji_browser'
  | 'custom_lists'
  | 'save_items'
  | 'youtube_shadowing'
  | 'media_upload'
  | 'stall_layout_customization';

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