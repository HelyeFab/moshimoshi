/**
 * Rate Limiter for Review Engine API
 * Prevents abuse and enforces tier-based request limits
 *
 * Tier Limits:
 * - Guest: 10 requests per minute
 * - Free: 30 requests per minute
 * - Premium: 100 requests per minute
 */

import { PlanType } from '@/types/entitlements'
import { reviewLogger } from '@/lib/monitoring/logger'

interface RateLimitRecord {
  count: number
  resetAt: number
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfter?: number
}

// In-memory rate limit store (Redis recommended for production)
const rateLimitStore = new Map<string, RateLimitRecord>()

// Tier-based rate limits (requests per minute)
const RATE_LIMITS: Record<PlanType, number> = {
  guest: 10,
  free: 30,
  premium_monthly: 100,
  premium_yearly: 100
}

// Window duration in milliseconds
const WINDOW_MS = 60 * 1000 // 1 minute

/**
 * Check if a request is within rate limit
 */
export function checkRateLimit(userId: string, tier: PlanType): RateLimitResult {
  const key = `rate:${userId}`
  const now = Date.now()
  const limit = RATE_LIMITS[tier]

  // Get existing record or create new one
  let record = rateLimitStore.get(key)

  // Clean up expired record
  if (record && now >= record.resetAt) {
    record = undefined
    rateLimitStore.delete(key)
  }

  // Create new window if needed
  if (!record) {
    record = {
      count: 0,
      resetAt: now + WINDOW_MS
    }
  }

  // Increment count
  record.count++

  // Check if over limit
  const allowed = record.count <= limit
  const remaining = Math.max(0, limit - record.count)

  // Save record
  rateLimitStore.set(key, record)

  const result: RateLimitResult = {
    allowed,
    limit,
    remaining,
    resetAt: record.resetAt
  }

  // Calculate retry after if blocked
  if (!allowed) {
    result.retryAfter = Math.ceil((record.resetAt - now) / 1000) // seconds
  }

  // Log rate limit violations
  if (!allowed) {
    reviewLogger.warn(`[RateLimit] User ${userId} exceeded rate limit (${tier}): ${record.count}/${limit}`)
  }

  return result
}

/**
 * Reset rate limit for a user (admin function)
 */
export function resetRateLimit(userId: string): void {
  const key = `rate:${userId}`
  rateLimitStore.delete(key)
  reviewLogger.info(`[RateLimit] Reset for user ${userId}`)
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(userId: string, tier: PlanType): RateLimitResult {
  const key = `rate:${userId}`
  const now = Date.now()
  const limit = RATE_LIMITS[tier]

  const record = rateLimitStore.get(key)

  if (!record || now >= record.resetAt) {
    return {
      allowed: true,
      limit,
      remaining: limit,
      resetAt: now + WINDOW_MS
    }
  }

  const remaining = Math.max(0, limit - record.count)
  const allowed = record.count < limit

  return {
    allowed,
    limit,
    remaining,
    resetAt: record.resetAt,
    retryAfter: allowed ? undefined : Math.ceil((record.resetAt - now) / 1000)
  }
}

/**
 * Clean up expired records (should be called periodically)
 */
export function cleanupExpiredRecords(): number {
  const now = Date.now()
  let cleaned = 0

  for (const [key, record] of rateLimitStore.entries()) {
    if (now >= record.resetAt) {
      rateLimitStore.delete(key)
      cleaned++
    }
  }

  if (cleaned > 0) {
    reviewLogger.info(`[RateLimit] Cleaned up ${cleaned} expired records`)
  }

  return cleaned
}

// Cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredRecords, 5 * 60 * 1000)
}
