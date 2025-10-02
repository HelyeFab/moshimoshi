/**
 * Shared Type Contract for Stats API
 *
 * This file defines the strict TypeScript types and Zod schemas
 * for all stat update operations through /api/stats/unified.
 *
 * Enforces:
 * - Non-negative XP values
 * - Valid activity types
 * - Required fields for each update type
 * - Idempotency key support
 */

import { z } from 'zod'

// ============================================
// Zod Schemas (Runtime Validation)
// ============================================

/**
 * Streak Update Schema
 *
 * Two modes:
 * 1. Simple activity date update (most common)
 * 2. Full streak sync (from migration/repair)
 */
export const StreakUpdateSchema = z.object({
  // Simple mode: just mark today as active
  activityDate: z.string().optional(),

  // Full sync mode: complete streak data
  dates: z.record(z.boolean()).optional(),
  current: z.number().nonnegative().optional(),
  best: z.number().nonnegative().optional(),
  lastActivityTimestamp: z.number().optional(),

  // Idempotency
  idempotencyKey: z.string().optional()
})

/**
 * XP Update Schema
 *
 * Enforces:
 * - Positive XP amounts only (no negative XP)
 * - Required source for tracking
 */
export const XPUpdateSchema = z.object({
  amount: z.number().positive('XP amount must be positive'),
  source: z.string().min(1, 'XP source is required'),
  idempotencyKey: z.string().optional()
})

/**
 * Session Update Schema
 *
 * Covers all session types: drill, flashcards, kana, kanji_mastery, etc.
 *
 * Critical: xpEarned determines if streak should update (≥10 XP threshold)
 */
export const SessionUpdateSchema = z.object({
  type: z.string().min(1, 'Session type is required'),
  itemsReviewed: z.number().nonnegative(),
  accuracy: z.number().min(0).max(100, 'Accuracy must be between 0 and 100'),
  duration: z.number().nonnegative(), // milliseconds
  xpEarned: z.number().nonnegative().optional(), // Used for streak threshold check
  idempotencyKey: z.string().optional()
})

/**
 * Achievement Update Schema
 *
 * Server-only decisions for achievement unlocks
 */
export const AchievementUpdateSchema = z.object({
  achievementId: z.string().min(1, 'Achievement ID is required'),
  points: z.number().nonnegative(),
  idempotencyKey: z.string().optional()
})

/**
 * Profile Update Schema
 *
 * Updates user metadata in stats document
 */
export const ProfileUpdateSchema = z.object({
  displayName: z.string().optional(),
  photoURL: z.string().url().optional().or(z.literal('')),
  email: z.string().email().optional()
})

/**
 * Unified Stats Request Schema
 *
 * Top-level request wrapper
 */
export const UnifiedStatsRequestSchema = z.object({
  type: z.enum(['streak', 'xp', 'achievement', 'session', 'profile', 'repair']),
  data: z.unknown() // Validated based on type
})

// ============================================
// TypeScript Types (Compile-time Safety)
// ============================================

export type StreakUpdate = z.infer<typeof StreakUpdateSchema>
export type XPUpdate = z.infer<typeof XPUpdateSchema>
export type SessionUpdate = z.infer<typeof SessionUpdateSchema>
export type AchievementUpdate = z.infer<typeof AchievementUpdateSchema>
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>
export type UnifiedStatsRequest = z.infer<typeof UnifiedStatsRequestSchema>

// ============================================
// Validation Helper Functions
// ============================================

/**
 * Validate a stats update request based on its type
 *
 * @param type - The update type
 * @param data - The data to validate
 * @returns Validation result with parsed data or error details
 */
export function validateStatsUpdate(
  type: string,
  data: unknown
): {
  success: boolean
  data?: any
  error?: {
    message: string
    issues: any[]
  }
} {
  let schema: z.ZodSchema

  switch (type) {
    case 'streak':
      schema = StreakUpdateSchema
      break
    case 'xp':
      schema = XPUpdateSchema
      break
    case 'session':
      schema = SessionUpdateSchema
      break
    case 'achievement':
      schema = AchievementUpdateSchema
      break
    case 'profile':
      schema = ProfileUpdateSchema
      break
    case 'repair':
      // Repair has no specific schema, accepts any data
      return { success: true, data }
    default:
      return {
        success: false,
        error: {
          message: `Invalid update type: ${type}`,
          issues: []
        }
      }
  }

  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  } else {
    return {
      success: false,
      error: {
        message: `Invalid ${type} data`,
        issues: result.error.issues
      }
    }
  }
}

// ============================================
// Invariant Assertions
// ============================================

/**
 * Invariants that MUST be true for valid stat updates:
 *
 * 1. XP amounts are always non-negative
 * 2. Accuracy is always 0-100%
 * 3. Session durations are non-negative
 * 4. Streak values are non-negative
 * 5. Activity dates are valid ISO date strings
 */

export function assertXPInvariant(amount: number): void {
  if (amount < 0) {
    throw new Error(`XP invariant violated: amount must be non-negative, got ${amount}`)
  }
}

export function assertStreakInvariant(current: number, best: number): void {
  if (current < 0 || best < 0) {
    throw new Error(`Streak invariant violated: values must be non-negative, got current=${current} best=${best}`)
  }
  if (current > best) {
    throw new Error(`Streak invariant violated: current (${current}) cannot exceed best (${best})`)
  }
}

export function assertAccuracyInvariant(accuracy: number): void {
  if (accuracy < 0 || accuracy > 100) {
    throw new Error(`Accuracy invariant violated: must be 0-100, got ${accuracy}`)
  }
}
