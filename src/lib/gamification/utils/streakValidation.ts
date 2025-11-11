/**
 * Streak Validation Utilities
 *
 * Client-side validation to detect stale streak data.
 * Uses same date calculation logic as backend (streakService.ts)
 * to ensure consistency.
 *
 * Purpose: Fix UI bug where streak shows "1 day" when it's actually
 * broken due to 3+ days of inactivity.
 */

/**
 * Get current date in UTC (yyyy-mm-dd format)
 * Mirrors: streakService.ts:getCurrentDateUTC()
 */
export function getCurrentDateUTC(refDate: Date = new Date()): string {
  return refDate.toISOString().split('T')[0]
}

/**
 * Parse ISO date string to Date object at midnight UTC
 * Mirrors: streakService.ts:parseISODate()
 */
export function parseISODate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`)
}

/**
 * Calculate difference in days between two ISO date strings
 * Mirrors: streakService.ts:calculateDaysDifference()
 */
export function calculateDaysDifference(date1: string, date2: string): number {
  const d1 = parseISODate(date1)
  const d2 = parseISODate(date2)
  const diffMs = Math.abs(d2.getTime() - d1.getTime())
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Result of streak validation
 */
export interface StreakValidationResult {
  isStale: boolean          // True if streak is broken (beyond grace period)
  daysSinceActivity: number // Days since last activity
  effectiveStreak: number   // What to display (0 if stale, currentStreak if valid)
  reason: string           // Human-readable explanation
  isWithinGracePeriod: boolean // True if user can still continue streak
}

/**
 * Validate if streak display is accurate or stale
 *
 * @param currentStreak - Streak count from database
 * @param lastActivityDate - Last activity date (yyyy-mm-dd format)
 * @param gracePeriodHours - Grace period in hours (default: 24)
 * @returns Validation result with effective streak to display
 *
 * @example
 * // User was active yesterday
 * validateStreakDisplay(5, '2025-11-05', 24)
 * // => { isStale: false, effectiveStreak: 5, daysSinceActivity: 1, ... }
 *
 * // User was active 3 days ago
 * validateStreakDisplay(5, '2025-11-03', 24)
 * // => { isStale: true, effectiveStreak: 0, daysSinceActivity: 3, ... }
 */
export function validateStreakDisplay(
  currentStreak: number,
  lastActivityDate: string | null,
  gracePeriodHours: number = 24
): StreakValidationResult {
  // No activity ever recorded
  if (!lastActivityDate) {
    return {
      isStale: false,
      daysSinceActivity: 0,
      effectiveStreak: currentStreak,
      reason: 'No activity recorded',
      isWithinGracePeriod: false
    }
  }

  // Calculate days since last activity
  const today = getCurrentDateUTC()
  const daysSince = calculateDaysDifference(lastActivityDate, today)

  // Calculate allowed gap (grace period)
  const allowedDays = Math.max(1, Math.ceil(gracePeriodHours / 24))

  // Check if within grace period
  const isWithinGracePeriod = daysSince <= allowedDays
  const isStale = !isWithinGracePeriod

  // Determine reason
  let reason: string
  if (daysSince === 0) {
    reason = 'Active today'
  } else if (isWithinGracePeriod) {
    reason = `Active ${daysSince} day${daysSince > 1 ? 's' : ''} ago (within grace period)`
  } else {
    reason = `Streak broken ${daysSince} days ago (beyond grace period)`
  }

  return {
    isStale,
    daysSinceActivity: daysSince,
    effectiveStreak: isStale ? 0 : currentStreak,
    reason,
    isWithinGracePeriod
  }
}

/**
 * Calculate deadline for streak continuation
 * Returns null if streak is already stale
 *
 * @param lastActivityDate - Last activity date (yyyy-mm-dd format)
 * @param gracePeriodHours - Grace period in hours (default: 24)
 * @returns Deadline Date object, or null if already expired
 *
 * @example
 * // User was active yesterday at midnight UTC
 * getStreakDeadline('2025-11-05', 24)
 * // => Date('2025-11-06T00:00:00.000Z') - midnight today
 *
 * // User was active 3 days ago (already stale)
 * getStreakDeadline('2025-11-03', 24)
 * // => null
 */
export function getStreakDeadline(
  lastActivityDate: string | null,
  gracePeriodHours: number = 24
): Date | null {
  if (!lastActivityDate) return null

  // Check if already stale
  const validation = validateStreakDisplay(0, lastActivityDate, gracePeriodHours)
  if (validation.isStale) return null

  // Calculate deadline: lastActivityDate + gracePeriodHours
  const lastActivity = parseISODate(lastActivityDate)
  const deadline = new Date(lastActivity.getTime() + gracePeriodHours * 60 * 60 * 1000)

  return deadline
}

/**
 * Format days since activity into human-readable string
 *
 * @param daysSince - Number of days since last activity
 * @returns Human-readable string
 *
 * @example
 * formatDaysSinceActivity(0) // => "today"
 * formatDaysSinceActivity(1) // => "yesterday"
 * formatDaysSinceActivity(3) // => "3 days ago"
 */
export function formatDaysSinceActivity(daysSince: number): string {
  if (daysSince === 0) return 'today'
  if (daysSince === 1) return 'yesterday'
  return `${daysSince} days ago`
}

/**
 * Check if user should be warned about streak breaking soon
 *
 * @param lastActivityDate - Last activity date
 * @param gracePeriodHours - Grace period in hours
 * @param warningThresholdHours - Hours before deadline to warn (default: 4)
 * @returns True if user should be warned
 */
export function shouldWarnStreakAtRisk(
  lastActivityDate: string | null,
  gracePeriodHours: number = 24,
  warningThresholdHours: number = 4
): boolean {
  if (!lastActivityDate) return false

  const deadline = getStreakDeadline(lastActivityDate, gracePeriodHours)
  if (!deadline) return false // Already broken

  const now = new Date()
  const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)

  return hoursUntilDeadline > 0 && hoursUntilDeadline <= warningThresholdHours
}
