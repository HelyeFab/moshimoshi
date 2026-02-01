import type { StallBadge } from '@/config/learning-village-types'

/**
 * Badge expiry duration in days
 */
export const BADGE_EXPIRY_DAYS = 6

/**
 * Check if a badge has expired
 *
 * Badges auto-expire after 6 days from when they were added
 *
 * @param badge - The badge to check
 * @returns true if badge is expired, false if still active
 */
export function isBadgeExpired(badge: StallBadge | undefined): boolean {
  if (!badge) return true

  const addedAt = new Date(badge.addedAt)
  const now = new Date()
  const daysSinceAdded = (now.getTime() - addedAt.getTime()) / (1000 * 60 * 60 * 24)

  return daysSinceAdded >= BADGE_EXPIRY_DAYS
}

/**
 * Check if a stall should show a badge
 *
 * @param badge - The badge to check
 * @returns true if badge should be shown, false otherwise
 */
export function shouldShowBadge(badge: StallBadge | undefined): boolean {
  if (!badge) return false
  return !isBadgeExpired(badge)
}

/**
 * Get days remaining until badge expires
 *
 * @param badge - The badge to check
 * @returns number of days remaining (0 if expired)
 */
export function getBadgeDaysRemaining(badge: StallBadge | undefined): number {
  if (!badge) return 0

  const addedAt = new Date(badge.addedAt)
  const now = new Date()
  const daysSinceAdded = (now.getTime() - addedAt.getTime()) / (1000 * 60 * 60 * 24)
  const daysRemaining = BADGE_EXPIRY_DAYS - daysSinceAdded

  return Math.max(0, Math.ceil(daysRemaining))
}
