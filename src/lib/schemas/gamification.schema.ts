/**
 * Gamification Zod Schemas
 *
 * Runtime validation for all gamification data structures.
 * Prevents invalid data from entering the system.
 */

import { z } from 'zod'

/**
 * ISO date string schema (yyyy-mm-dd)
 */
export const ISODateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid ISO date format (expected yyyy-mm-dd)')

/**
 * ISO datetime string schema
 */
export const ISODateTimeStringSchema = z
  .string()
  .datetime({ message: 'Invalid ISO datetime format' })

/**
 * Streak data schema
 */
export const StreakDataSchema = z.object({
  current: z.number().int().min(0),
  best: z.number().int().min(0),
  lastActivityDate: ISODateStringSchema.nullable(),
  freezesRemaining: z.number().int().min(0).max(3),
  version: z.number().int().min(0),
  updatedAt: ISODateTimeStringSchema
})

export type StreakData = z.infer<typeof StreakDataSchema>

/**
 * Gamification state schema
 * Matches the Zustand store structure
 */
export const GamificationStateSchema = z.object({
  // Core Stats
  totalXP: z.number().int().min(0),
  currentLevel: z.number().int().min(1),
  currentStreak: z.number().int().min(0),
  bestStreak: z.number().int().min(0),
  lastActivityDate: ISODateStringSchema.nullable(),

  // Achievements
  unlockedAchievements: z.array(z.string()),
  achievementProgress: z.record(z.number()),

  // Session Tracking
  sessionCount: z.number().int().min(0),

  // Metadata
  userId: z.string().nullable(),
  lastSyncedAt: ISODateTimeStringSchema.nullable(),
  isDirty: z.boolean(),
  isLoaded: z.boolean(),
  version: z.number().int().min(0),
  isSyncing: z.boolean(),
  hasHydrated: z.boolean()
})

export type GamificationState = z.infer<typeof GamificationStateSchema>

/**
 * XP award schema (for API validation)
 */
export const XPAwardSchema = z.object({
  amount: z.number().int().min(0).max(10000),
  reason: z.string().optional(),
  activityType: z.enum([
    'drill',
    'flashcard',
    'kanji_mastery',
    'word_learning',
    'youtube_shadowing',
    'review_session'
  ]).optional()
})

export type XPAward = z.infer<typeof XPAwardSchema>

/**
 * Streak increment request schema
 */
export const StreakIncrementRequestSchema = z.object({
  version: z.number().int().min(0).optional(),
  xpEarned: z.number().int().min(0).default(25)
})

export type StreakIncrementRequest = z.infer<typeof StreakIncrementRequestSchema>

/**
 * Streak reset request schema
 */
export const StreakResetRequestSchema = z.object({
  version: z.number().int().min(0).optional()
})

export type StreakResetRequest = z.infer<typeof StreakResetRequestSchema>

/**
 * Achievement unlock schema
 */
export const AchievementUnlockSchema = z.object({
  achievementId: z.string().min(1),
  unlockedAt: ISODateTimeStringSchema
})

export type AchievementUnlock = z.infer<typeof AchievementUnlockSchema>

/**
 * Gamification sync request schema
 */
export const GamificationSyncRequestSchema = z.object({
  totalXP: z.number().int().min(0),
  lastActivityDate: ISODateStringSchema.nullable(),
  unlockedAchievements: z.array(z.string()),
  achievementProgress: z.record(z.number()),
  sessionCount: z.number().int().min(0)
})

export type GamificationSyncRequest = z.infer<typeof GamificationSyncRequestSchema>

/**
 * Validation helpers
 */
export const GamificationValidator = {
  /**
   * Validate streak data
   */
  validateStreak(data: unknown): StreakData {
    return StreakDataSchema.parse(data)
  },

  /**
   * Validate gamification state
   */
  validateState(data: unknown): GamificationState {
    return GamificationStateSchema.parse(data)
  },

  /**
   * Check if current streak > best streak (data integrity issue)
   */
  checkStreakIntegrity(data: Pick<GamificationState, 'currentStreak' | 'bestStreak'>): boolean {
    return data.currentStreak <= data.bestStreak
  },

  /**
   * Fix streak integrity if broken
   */
  fixStreakIntegrity<T extends Pick<GamificationState, 'currentStreak' | 'bestStreak'>>(data: T): T {
    if (data.currentStreak > data.bestStreak) {
      return {
        ...data,
        bestStreak: data.currentStreak
      }
    }
    return data
  }
}
