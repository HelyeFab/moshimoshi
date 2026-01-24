/**
 * Rate limiting wrapper for admin analytics APIs
 * Combines withAdminAuth with rate limiting protection
 */

import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { redis } from '@/lib/redis/client'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'

/**
 * Rate limit configuration for admin analytics
 * 60 requests per minute - generous for admin use
 */
const ADMIN_ANALYTICS_RATE_LIMIT = {
  requests: 60,
  window: '1m' as const,
}

/**
 * Create rate limiter instance for admin analytics
 */
const analyticsRateLimiter = new Ratelimit({
  redis: redis as any,
  limiter: Ratelimit.slidingWindow(
    ADMIN_ANALYTICS_RATE_LIMIT.requests,
    ADMIN_ANALYTICS_RATE_LIMIT.window
  ),
  analytics: true,
  prefix: 'rl:admin:analytics',
})

/**
 * Rate limit result for headers
 */
interface RateLimitInfo {
  limit: number
  remaining: number
  reset: Date
}

/**
 * Get rate limit headers for response
 */
function getRateLimitHeaders(info: RateLimitInfo): Record<string, string> {
  return {
    'X-RateLimit-Limit': info.limit.toString(),
    'X-RateLimit-Remaining': info.remaining.toString(),
    'X-RateLimit-Reset': info.reset.toISOString(),
  }
}

/**
 * Wrapper that combines admin auth with rate limiting
 * Use this instead of withAdminAuth for analytics endpoints
 */
export function withAdminAnalyticsRateLimit(
  handler: (request: NextRequest, context: AdminContext) => Promise<NextResponse>
) {
  // First apply admin auth check
  const authWrappedHandler = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
    // Use admin user ID as the rate limit identifier
    const identifier = `admin:${context.user.uid}`

    try {
      // Check rate limit
      const { success, limit, remaining, reset } = await analyticsRateLimiter.limit(identifier)

      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000)
        return NextResponse.json(
          {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests. Please slow down.',
              retryAfter,
              reset: new Date(reset).toISOString(),
            },
          },
          {
            status: 429,
            headers: {
              ...getRateLimitHeaders({ limit, remaining, reset: new Date(reset) }),
              'Retry-After': retryAfter.toString(),
            },
          }
        )
      }

      // Rate limit passed, execute the handler
      const response = await handler(request, context)

      // Add rate limit headers to successful response
      const headers = new Headers(response.headers)
      const rateLimitHeaders = getRateLimitHeaders({
        limit,
        remaining,
        reset: new Date(reset),
      })
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        headers.set(key, value)
      })

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    } catch (rateLimitError) {
      // If rate limiter fails (Redis unavailable), log and continue
      // Fail-open for admin analytics - don't block admins if Redis is down
      console.warn('[Admin Analytics Rate Limit] Redis error, allowing request:', rateLimitError)
      return handler(request, context)
    }
  })

  return authWrappedHandler
}
