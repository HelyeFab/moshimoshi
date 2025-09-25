/**
 * Entitlements v2 - Policy Evaluator
 * Agent 2 Implementation
 * 
 * Pure function that evaluates if a user can access a feature
 * based on their plan, usage, and policy limits.
 */

import {
  FeatureId,
  PlanType,
  EvalContext,
  Decision,
  Feature,
  PolicyLimits,
  Permission
} from '@/types/entitlements';

// Re-export types for convenience
export type { EvalContext, Decision } from '@/types/entitlements';
import featuresConfig from '../../../config/features.v1.json';

// Policy version from schema
const POLICY_VERSION = featuresConfig.version;

// Feature registry from schema
const FEATURES: Record<FeatureId, Feature> = featuresConfig.features.reduce((acc, feature) => {
  acc[feature.id as FeatureId] = feature as Feature;
  return acc;
}, {} as Record<FeatureId, Feature>);

// Limits from schema
const LIMITS: PolicyLimits = featuresConfig.limits as PolicyLimits;

// Permission mapping by plan
const PERMISSION_MAP: Record<PlanType, Set<Permission>> = {
  guest: new Set<Permission>(['do_practice']),
  free: new Set<Permission>(['do_practice']),
  premium_monthly: new Set<Permission>(['do_practice']),
  premium_yearly: new Set<Permission>(['do_practice'])
};

/**
 * Main evaluation function
 * Determines if a user can access a feature based on context
 */
export function evaluate(featureId: FeatureId, ctx: EvalContext): Decision {
  // 1. Get feature definition
  const feature = FEATURES[featureId];
  if (!feature) {
    return {
      allow: false,
      remaining: 0,
      reason: 'lifecycle_blocked',
      policyVersion: POLICY_VERSION,
      featureId,
      userId: ctx.userId,
      plan: ctx.plan
    };
  }

  // 2. Check lifecycle - block hidden or deprecated features
  if (feature.lifecycle === 'hidden' || feature.lifecycle === 'deprecated') {
    return {
      allow: false,
      remaining: 0,
      reason: 'lifecycle_blocked',
      policyVersion: POLICY_VERSION,
      featureId,
      userId: ctx.userId,
      plan: ctx.plan
    };
  }

  // 3. Check permissions
  const planPermissions = PERMISSION_MAP[ctx.plan];
  if (!planPermissions.has(feature.permission)) {
    return {
      allow: false,
      remaining: 0,
      reason: 'no_permission',
      policyVersion: POLICY_VERSION,
      featureId,
      userId: ctx.userId,
      plan: ctx.plan
    };
  }

  // 4. Compute effective limit
  const effectiveLimit = computeEffectiveLimit(featureId, ctx);
  
  // 5. Get current usage
  const currentUsage = ctx.usage[featureId] || 0;

  // 6. Check if unlimited (-1 means unlimited)
  if (effectiveLimit === -1) {
    return {
      allow: true,
      remaining: -1,
      reason: 'ok',
      policyVersion: POLICY_VERSION,
      resetAtUtc: getResetTime(ctx.nowUtcISO, feature.limitType),
      featureId,
      userId: ctx.userId,
      plan: ctx.plan,
      usageBefore: currentUsage,
      limit: -1
    };
  }

  // 7. Calculate remaining
  const remaining = Math.max(0, effectiveLimit - currentUsage);
  const allow = remaining > 0;

  return {
    allow,
    remaining,
    reason: allow ? 'ok' : 'limit_reached',
    policyVersion: POLICY_VERSION,
    resetAtUtc: getResetTime(ctx.nowUtcISO, feature.limitType),
    featureId,
    userId: ctx.userId,
    plan: ctx.plan,
    usageBefore: currentUsage,
    limit: effectiveLimit
  };
}

/**
 * Compute the effective limit considering plan, tenant caps, and overrides
 */
function computeEffectiveLimit(featureId: FeatureId, ctx: EvalContext): number {
  // Start with plan limit
  let limit = getPlanLimit(featureId, ctx.plan);

  // Apply override if exists
  if (ctx.overrides && ctx.overrides[featureId] !== undefined) {
    const override = ctx.overrides[featureId];
    if (override === 'unlimited') {
      return -1;
    }
    limit = override;
  }

  // Apply tenant cap if exists (minimum of plan limit and tenant cap)
  if (ctx.tenant?.dailyCaps && ctx.tenant.dailyCaps[featureId] !== undefined) {
    const tenantCap = ctx.tenant.dailyCaps[featureId];
    if (limit === -1) {
      limit = tenantCap;
    } else {
      limit = Math.min(limit, tenantCap);
    }
  }

  return limit;
}

/**
 * Get the plan limit for a feature
 */
function getPlanLimit(featureId: FeatureId, plan: PlanType): number {
  const feature = FEATURES[featureId];
  if (!feature) return 0;

  if (feature.limitType === 'daily') {
    return LIMITS[plan].daily?.[featureId] ?? 0;
  }

  if (feature.limitType === 'monthly') {
    return LIMITS[plan].monthly?.[featureId] ?? 0;
  }

  // Default to 0 if limit type not found
  return 0;
}

/**
 * Calculate when the usage limit resets
 */
function getResetTime(nowUtcISO: string, limitType: 'daily' | 'monthly'): string {
  const now = new Date(nowUtcISO);
  
  if (limitType === 'daily') {
    // Reset at midnight UTC next day
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }
  
  if (limitType === 'monthly') {
    // Reset at midnight UTC first day of next month
    const nextMonth = new Date(now);
    if (nextMonth.getUTCMonth() === 11) {
      nextMonth.setUTCFullYear(nextMonth.getUTCFullYear() + 1);
      nextMonth.setUTCMonth(0);
    } else {
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    }
    nextMonth.setUTCDate(1);
    nextMonth.setUTCHours(0, 0, 0, 0);
    return nextMonth.toISOString();
  }
  
  return now.toISOString();
}

/**
 * Helper to get today's date bucket key (YYYY-MM-DD)
 */
export function getTodayBucket(nowUtcISO: string): string {
  const date = new Date(nowUtcISO);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get bucket key for usage tracking
 */
export function getBucketKey(featureId: FeatureId, userId: string, nowUtcISO: string): string {
  const feature = FEATURES[featureId];
  if (!feature) {
    return `${featureId}_unknown`;
  }

  const date = nowUtcISO.split('T')[0];

  if (feature.limitType === 'daily') {
    return `${featureId}_${date}`;
  } else if (feature.limitType === 'monthly') {
    const [year, month] = date.split('-');
    return `${featureId}_${year}-${month}`;
  }

  return featureId;
}

/**
 * Check if a decision allows access
 */
export function isAllowed(decision: Decision): boolean {
  return decision.allow;
}

/**
 * Get a human-readable message for a decision
 */
export function getDecisionMessage(decision: Decision): string {
  switch (decision.reason) {
    case 'ok':
      if (decision.remaining === -1) {
        return 'Unlimited access';
      }
      return `${decision.remaining} uses remaining today`;
    case 'limit_reached':
      return 'Daily limit reached. Resets at midnight UTC.';
    case 'no_permission':
      return 'Upgrade to premium for unlimited access';
    case 'lifecycle_blocked':
      return 'This feature is currently unavailable';
    default:
      return 'Access denied';
  }
}