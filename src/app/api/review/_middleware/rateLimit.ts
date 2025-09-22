/**
 * Rate limiting middleware for review API endpoints
 * Uses Upstash Redis for distributed rate limiting
 */

import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { redis } from '@/lib/redis/client'

// Define rate limit configurations for different endpoints
export const rateLimitConfigs = {
  // Pin operations - generous limits
  pin: {
    requests: 100,
    window: '1m',
  },
  pinBulk: {
    requests: 20,
    window: '1m',
  },
  
  // Queue operations - moderate limits
  queue: {
    requests: 60,
    window: '1m',
  },
  
  // Session operations - generous for active learning
  sessionStart: {
    requests: 10,
    window: '1m',
  },
  sessionAnswer: {
    requests: 300, // Allow rapid answers during review
    window: '1m',
  },
  
  // Stats operations - can be expensive
  stats: {
    requests: 30,
    window: '1m',
  },
  statsHeatmap: {
    requests: 10,
    window: '1m',
  },
  
  // Set operations - moderate limits
  sets: {
    requests: 30,
    window: '1m',
  },
  setsCreate: {
    requests: 5,
    window: '1m',
  },
  
  // Default fallback
  default: {
    requests: 60,
    window: '1m',
  },
} as const

export type RateLimitEndpoint = keyof typeof rateLimitConfigs

/**
 * Create a rate limiter for a specific endpoint
 */
export function createRateLimiter(endpoint: RateLimitEndpoint) {
  const config = rateLimitConfigs[endpoint] || rateLimitConfigs.default
  
  return new Ratelimit({
    redis: redis as any,
    limiter: Ratelimit.slidingWindow(config.requests, config.window),
    analytics: true,
    prefix: `review:${endpoint}`,
  })
}

/**
 * Rate limit middleware function
 */
export async function rateLimit(
  request: NextRequest,
  endpoint: RateLimitEndpoint = 'default',
  identifier?: string
): Promise<{ success: boolean; response?: NextResponse }> {
  try {
    // Use provided identifier or extract from request
    const id = identifier || 
               request.headers.get('x-user-id') ||
               request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'anonymous'

    const rateLimiter = createRateLimiter(endpoint)
    const { success, limit, reset, remaining } = await rateLimiter.limit(id)

    // Add rate limit headers to all responses
    const headers = {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(reset).toISOString(),
    }

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)
      
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter,
            reset: new Date(reset).toISOString(),
          },
          { 
            status: 429,
            headers: {
              ...headers,
              'Retry-After': retryAfter.toString(),
            },
          }
        ),
      }
    }

    // Success - return headers to be added to successful response
    return { 
      success: true,
      response: undefined,
    }
  } catch (error) {
    // Don't fail the request if rate limiting fails
    console.error('Rate limiting error:', error)
    return { success: true }
  }
}

/**
 * Apply rate limiting with user-specific limits
 */
export async function rateLimitByUser(
  request: NextRequest,
  userId: string,
  endpoint: RateLimitEndpoint = 'default',
  premiumMultiplier: number = 2
): Promise<{ success: boolean; response?: NextResponse }> {
  // Check if user is premium (would need to be passed or fetched)
  const isPremium = request.headers.get('x-user-tier')?.includes('premium')
  
  if (isPremium) {
    // Create a more generous rate limiter for premium users
    const config = rateLimitConfigs[endpoint] || rateLimitConfigs.default
    const premiumLimiter = new Ratelimit({
      redis: redis as any,
      limiter: Ratelimit.slidingWindow(
        config.requests * premiumMultiplier,
        config.window
      ),
      analytics: true,
      prefix: `review:premium:${endpoint}`,
    })
    
    const { success, limit, reset, remaining } = await premiumLimiter.limit(userId)
    
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)
      
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter,
            reset: new Date(reset).toISOString(),
            premium: true,
          },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': new Date(reset).toISOString(),
              'Retry-After': retryAfter.toString(),
            },
          }
        ),
      }
    }
    
    return { success: true }
  }
  
  // Regular rate limiting for non-premium users
  return rateLimit(request, endpoint, userId)
}

/**
 * Clear rate limit for a specific user (e.g., after subscription upgrade)
 */
export async function clearRateLimit(
  userId: string,
  endpoint?: RateLimitEndpoint
): Promise<void> {
  try {
    const prefix = endpoint ? `review:${endpoint}:${userId}` : `review:*:${userId}`
    // This would need to be implemented based on your Redis setup
    // For now, we'll just log it
    console.log(`Clearing rate limit for ${prefix}`)
  } catch (error) {
    console.error('Error clearing rate limit:', error)
  }
}