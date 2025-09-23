/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from: config/features.v1.json
 * Generated at: 2025-09-22T15:15:41.380Z
 */

import type { FeatureId } from '@/types/FeatureId';
import type { PlanType } from '@/lib/access/permissionMap';

export const POLICY_VERSION = 1;

export type LimitType = 'daily' | 'weekly' | 'monthly';

export interface PlanLimits {
  daily?: Record<FeatureId, number>;
  weekly?: Record<FeatureId, number>;
  monthly?: Record<FeatureId, number>;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  "guest": {
    "daily": {
      "hiragana_practice": 3,
      "katakana_practice": 3,
      "kanji_browser": 0,
      "custom_lists": 0,
      "save_items": 0,
      "youtube_shadowing": 0,
      "media_upload": 0,
      "stall_layout_customization": 0
    }
  },
  "free": {
    "daily": {
      "hiragana_practice": 5,
      "katakana_practice": 5,
      "kanji_browser": 5,
      "custom_lists": 10,
      "save_items": 50,
      "youtube_shadowing": 3,
      "media_upload": 2,
      "stall_layout_customization": 1
    }
  },
  "premium_monthly": {
    "daily": {
      "hiragana_practice": -1,
      "katakana_practice": -1,
      "kanji_browser": 10,
      "custom_lists": -1,
      "save_items": -1,
      "youtube_shadowing": 20,
      "media_upload": -1,
      "stall_layout_customization": -1
    }
  },
  "premium_yearly": {
    "daily": {
      "hiragana_practice": -1,
      "katakana_practice": -1,
      "kanji_browser": 10,
      "custom_lists": -1,
      "save_items": -1,
      "youtube_shadowing": 20,
      "media_upload": -1,
      "stall_layout_customization": -1
    }
  }
};

export function getLimit(plan: PlanType, limitType: LimitType, featureId: FeatureId): number {
  const planLimits = PLAN_LIMITS[plan];
  if (!planLimits || !planLimits[limitType]) {
    return 0;
  }
  return planLimits[limitType][featureId] ?? 0;
}

export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

export function getEffectiveLimit(
  planLimit: number,
  override?: number | 'unlimited',
  tenantCap?: number
): number {
  // Handle override
  if (override !== undefined) {
    if (override === 'unlimited') return -1;
    return override;
  }

  // If plan is unlimited, check tenant cap
  if (isUnlimited(planLimit)) {
    return tenantCap ?? -1;
  }

  // If tenant has a cap, use the minimum
  if (tenantCap !== undefined && !isUnlimited(tenantCap)) {
    return Math.min(planLimit, tenantCap);
  }

  return planLimit;
}

export function getResetTime(limitType: LimitType, fromDate: Date = new Date()): Date {
  const resetDate = new Date(fromDate);
  resetDate.setUTCHours(0, 0, 0, 0);

  switch (limitType) {
    case 'daily':
      resetDate.setUTCDate(resetDate.getUTCDate() + 1);
      break;
    case 'weekly':
      const daysUntilMonday = (8 - resetDate.getUTCDay()) % 7 || 7;
      resetDate.setUTCDate(resetDate.getUTCDate() + daysUntilMonday);
      break;
    case 'monthly':
      resetDate.setUTCMonth(resetDate.getUTCMonth() + 1);
      resetDate.setUTCDate(1);
      break;
  }

  return resetDate;
}

export function getBucketKey(limitType: LimitType, date: Date = new Date()): string {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');

  switch (limitType) {
    case 'daily':
      return `${year}-${month}-${day}`;
    case 'weekly':
      const weekStart = new Date(d);
      weekStart.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      const weekYear = weekStart.getUTCFullYear();
      const weekMonth = String(weekStart.getUTCMonth() + 1).padStart(2, '0');
      const weekDay = String(weekStart.getUTCDate()).padStart(2, '0');
      return `${weekYear}-W${weekMonth}-${weekDay}`;
    case 'monthly':
      return `${year}-${month}`;
  }
}
