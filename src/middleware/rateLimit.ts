/**
 * Rate Limiting Middleware
 *
 * Protects gamification APIs from abuse using Upstash Redis.
 * Implements sliding window rate limiting with different tiers for authenticated users.
 *
 * @module rateLimit
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Initialize Redis connection
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

/**
 * Rate limiter for XP/Stats API endpoints
 *
 * Limits: 100 requests per hour per user
 * Strategy: Sliding window (more accurate than fixed window)
 */
export const xpRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 h'),
  analytics: true,
  prefix: 'ratelimit:xp',
})

/**
 * Rate limiter for streak updates
 *
 * Limits: 10 requests per minute per user
 * Rationale: Users should only update streak a few times per day
 */
export const streakRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  analytics: true,
  prefix: 'ratelimit:streak',
})

/**
 * Rate limiter for achievement unlocks
 *
 * Limits: 20 requests per hour per user
 * Rationale: Achievement checks are expensive, limit frequency
 */
export const achievementRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  analytics: true,
  prefix: 'ratelimit:achievement',
})

/**
 * Rate limiter for sync operations
 *
 * Limits: 30 requests per hour per user
 * Rationale: Sync is intensive, should happen on page load only
 */
export const syncRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 h'),
  analytics: true,
  prefix: 'ratelimit:sync',
})

/**
 * Premium user rate limiter (more generous)
 *
 * Limits: 500 requests per hour
 * Rationale: Premium users get higher limits
 */
export const premiumRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(500, '1 h'),
  analytics: true,
  prefix: 'ratelimit:premium',
})

/**
 * Admin/internal rate limiter (no limits)
 *
 * Limits: 10,000 requests per hour
 * Rationale: Internal tools and admin operations need high throughput
 */
export const adminRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10000, '1 h'),
  analytics: true,
  prefix: 'ratelimit:admin',
})

/**
 * Rate limit result interface
 */
export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
  pending: Promise<unknown>
}

/**
 * Check rate limit for a user
 *
 * @param identifier - User ID or IP address
 * @param limiter - Rate limiter to use (default: xpRateLimit)
 * @returns Rate limit result
 *
 * @example
 * ```typescript
 * const result = await checkRateLimit(userId, xpRateLimit)
 * if (!result.success) {
 *   return NextResponse.json(
 *     {
 *       error: 'Rate limit exceeded',
 *       limit: result.limit,
 *       remaining: result.remaining,
 *       reset: result.reset
 *     },
 *     { status: 429 }
 *   )
 * }
 * ```
 */
export async function checkRateLimit(
  identifier: string,
  limiter: Ratelimit = xpRateLimit
): Promise<RateLimitResult> {
  const result = await limiter.limit(identifier)

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    pending: result.pending,
  }
}

/**
 * Select appropriate rate limiter based on user tier
 *
 * @param tier - User tier ('free', 'premium', 'admin')
 * @returns Appropriate rate limiter
 */
export function getRateLimiterForTier(tier: string | undefined): Ratelimit {
  if (tier === 'admin') {
    return adminRateLimit
  } else if (tier === 'premium_monthly' || tier === 'premium_yearly') {
    return premiumRateLimit
  } else {
    return xpRateLimit // Default for free users
  }
}

/**
 * Rate limit error response helper
 *
 * @param result - Rate limit result
 * @returns Formatted error object
 */
export function createRateLimitError(result: RateLimitResult) {
  return {
    error: 'Rate limit exceeded',
    message: 'Too many requests. Please try again later.',
    limit: result.limit,
    remaining: result.remaining,
    resetAt: new Date(result.reset * 1000).toISOString(),
    retryAfter: Math.ceil((result.reset * 1000 - Date.now()) / 1000), // seconds
  }
}

/**
 * Rate limit response headers
 *
 * Adds standard rate limit headers to response
 * @see https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers
 */
export function addRateLimitHeaders(
  headers: Headers,
  result: RateLimitResult
): Headers {
  headers.set('X-RateLimit-Limit', result.limit.toString())
  headers.set('X-RateLimit-Remaining', result.remaining.toString())
  headers.set('X-RateLimit-Reset', result.reset.toString())

  if (!result.success) {
    const retryAfter = Math.ceil((result.reset * 1000 - Date.now()) / 1000)
    headers.set('Retry-After', retryAfter.toString())
  }

  return headers
}

/**
 * Bypass rate limiting for specific IPs/users
 *
 * Use cases:
 * - Internal monitoring/health checks
 * - Load testing
 * - Trusted integrations
 */
const RATE_LIMIT_BYPASS_LIST = [
  // Add IPs or user IDs that should bypass rate limiting
  // Example: '127.0.0.1', 'admin-user-123'
]

/**
 * Check if identifier should bypass rate limiting
 *
 * @param identifier - User ID or IP address
 * @returns True if should bypass
 */
export function shouldBypassRateLimit(identifier: string): boolean {
  return RATE_LIMIT_BYPASS_LIST.includes(identifier)
}
