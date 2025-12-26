/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from: config/features.v1.json
 * Generated at: 2025-12-26T15:38:35.844Z
 */

import type { FeatureId } from '@/types/FeatureId';
import type { PlanType } from '@/lib/access/permissionMap';

export const POLICY_VERSION = 1;

export type LimitType = 'daily' | 'weekly' | 'monthly';

export interface PlanLimits {
  daily?: Partial<Record<FeatureId, number>>;
  weekly?: Partial<Record<FeatureId, number>>;
  monthly?: Partial<Record<FeatureId, number>>;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  "guest": {
    "daily": {
          "hiragana_practice": 0,
          "katakana_practice": 0,
          "kanji_browser": 0,
          "kanji_connection": 0,
          "kanji_mastery": 0,
          "drawing_practice": 0,
          "conjugation_drill": 0,
          "grammar_explanations": 0,
          "youtube_shadowing": 0,
          "media_upload": 0,
          "stall_layout_customization": 0,
          "flashcard_daily_reviews": 0,
          "pwa_push": 0,
          "pwa_bg_sync": 0,
          "pwa_periodic_sync": 0,
          "pwa_share_target": 0,
          "pwa_fs_access": 0,
          "pwa_badging": 0,
          "pwa_media_session": 0,
          "word_lookup": 0,
          "news": 0,
          "story": 0,
          "books": 0,
          "kanji_mood_board": 0,
          "drill": 0,
          "my_list": 0,
          "textbook_vocabulary": 0,
          "flashcards": 0,
          "resources": -1,
          "blogs": -1,
          "vocabulary": -1,
          "comics": 0
    },
    "monthly": {
          "custom_lists": 0,
          "save_items": 0,
          "todos": 0,
          "flashcard_decks": 0,
          "anki_imports": 0
    }
  },
  "free": {
    "daily": {
          "hiragana_practice": 5,
          "katakana_practice": 5,
          "kanji_browser": 5,
          "kanji_connection": 0,
          "kanji_mastery": 5,
          "drawing_practice": 5,
          "conjugation_drill": 5,
          "grammar_explanations": 3,
          "youtube_shadowing": 3,
          "media_upload": 2,
          "stall_layout_customization": 1,
          "flashcard_daily_reviews": 0,
          "pwa_push": 0,
          "pwa_bg_sync": 0,
          "pwa_periodic_sync": 0,
          "pwa_share_target": 0,
          "pwa_fs_access": 0,
          "pwa_badging": 0,
          "pwa_media_session": 0,
          "word_lookup": 5,
          "news": 2,
          "story": 2,
          "books": 2,
          "kanji_mood_board": 5,
          "drill": 5,
          "my_list": 5,
          "textbook_vocabulary": 0,
          "flashcards": 0,
          "resources": -1,
          "blogs": -1,
          "vocabulary": -1,
          "comics": 0
    },
    "monthly": {
          "custom_lists": 3,
          "save_items": 50,
          "todos": 100,
          "flashcard_decks": 0,
          "anki_imports": 0
    }
  },
  "premium_monthly": {
    "daily": {
          "hiragana_practice": -1,
          "katakana_practice": -1,
          "kanji_browser": -1,
          "kanji_connection": -1,
          "kanji_mastery": -1,
          "drawing_practice": -1,
          "conjugation_drill": -1,
          "grammar_explanations": -1,
          "youtube_shadowing": 20,
          "media_upload": -1,
          "stall_layout_customization": -1,
          "flashcard_daily_reviews": -1,
          "pwa_push": -1,
          "pwa_bg_sync": -1,
          "pwa_periodic_sync": -1,
          "pwa_share_target": -1,
          "pwa_fs_access": -1,
          "pwa_badging": -1,
          "pwa_media_session": -1,
          "word_lookup": -1,
          "news": -1,
          "story": -1,
          "books": -1,
          "kanji_mood_board": -1,
          "drill": -1,
          "my_list": -1,
          "textbook_vocabulary": -1,
          "flashcards": -1,
          "resources": -1,
          "blogs": -1,
          "vocabulary": -1,
          "comics": -1
    },
    "monthly": {
          "custom_lists": -1,
          "save_items": -1,
          "todos": -1,
          "flashcard_decks": 15,
          "anki_imports": 15
    }
  },
  "premium_yearly": {
    "daily": {
          "hiragana_practice": -1,
          "katakana_practice": -1,
          "kanji_browser": -1,
          "kanji_connection": -1,
          "kanji_mastery": -1,
          "drawing_practice": -1,
          "conjugation_drill": -1,
          "grammar_explanations": -1,
          "youtube_shadowing": 20,
          "media_upload": -1,
          "stall_layout_customization": -1,
          "flashcard_daily_reviews": -1,
          "pwa_push": -1,
          "pwa_bg_sync": -1,
          "pwa_periodic_sync": -1,
          "pwa_share_target": -1,
          "pwa_fs_access": -1,
          "pwa_badging": -1,
          "pwa_media_session": -1,
          "word_lookup": -1,
          "news": -1,
          "story": -1,
          "books": -1,
          "kanji_mood_board": -1,
          "drill": -1,
          "my_list": -1,
          "textbook_vocabulary": -1,
          "flashcards": -1,
          "resources": -1,
          "blogs": -1,
          "vocabulary": -1,
          "comics": -1
    },
    "monthly": {
          "custom_lists": -1,
          "save_items": -1,
          "todos": -1,
          "flashcard_decks": 15,
          "anki_imports": 15
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
