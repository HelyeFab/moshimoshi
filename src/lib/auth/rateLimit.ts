// Rate limiting configuration for authentication endpoints
// Provides DDoS protection and brute force attack prevention

import { Ratelimit } from '@upstash/ratelimit'
import { NextRequest } from 'next/server'
import { redis, RedisKeys, CacheTTL } from '@/lib/redis/client'

// Rate limit configurations for different endpoints
const rateLimitConfigs = {
  // Authentication endpoints (stricter limits)
  signin: {
    requests: 10,
    window: '15m', // 15 minutes
    message: 'Too many sign-in attempts. Please try again in 15 minutes.',
  },
  signup: {
    requests: 20,
    window: '15m', // 15 minutes
    message: 'Too many sign-up attempts. Please try again in 15 minutes.',
  },
  passwordReset: {
    requests: 3,
    window: '1h',
    message: 'Too many password reset requests. Please try again later.',
  },
  magicLink: {
    requests: 5,
    window: '1h',
    message: 'Too many magic link requests. Please try again later.',
  },

  // Session check endpoint (more lenient since it's checked frequently)
  sessionCheck: {
    requests: 300,
    window: '1m', // 1 minute
    message: 'Too many session checks. Please slow down.',
  },

  // General API endpoints
  api: {
    requests: 100,
    window: '1m', // 1 minute
    message: 'Too many API requests. Please slow down.',
  },
  
  // Strict limits for sensitive operations
  adminAction: {
    requests: 10,
    window: '1m',
    message: 'Too many admin actions. Please wait.',
  },
  
  // User-generated content
  profileUpdate: {
    requests: 10,
    window: '1h',
    message: 'Too many profile updates. Please try again later.',
  },
} as const

// Create rate limiters
const rateLimiters = {
  signin: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(rateLimitConfigs.signin.requests, rateLimitConfigs.signin.window),
    analytics: true,
    prefix: 'ratelimit:signin',
  }),

  signup: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(rateLimitConfigs.signup.requests, rateLimitConfigs.signup.window),
    analytics: true,
    prefix: 'ratelimit:signup',
  }),

  passwordReset: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(rateLimitConfigs.passwordReset.requests, rateLimitConfigs.passwordReset.window),
    analytics: true,
    prefix: 'ratelimit:password_reset',
  }),

  magicLink: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(rateLimitConfigs.magicLink.requests, rateLimitConfigs.magicLink.window),
    analytics: true,
    prefix: 'ratelimit:magic_link',
  }),

  sessionCheck: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(rateLimitConfigs.sessionCheck.requests, rateLimitConfigs.sessionCheck.window),
    analytics: true,
    prefix: 'ratelimit:session',
  }),

  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(rateLimitConfigs.api.requests, rateLimitConfigs.api.window),
    analytics: true,
    prefix: 'ratelimit:api',
  }),

  adminAction: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(rateLimitConfigs.adminAction.requests, rateLimitConfigs.adminAction.window),
    analytics: true,
    prefix: 'ratelimit:admin',
  }),

  profileUpdate: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(rateLimitConfigs.profileUpdate.requests, rateLimitConfigs.profileUpdate.window),
    analytics: true,
    prefix: 'ratelimit:profile',
  }),
}

// Rate limit result interface
export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: Date
  message?: string
  identifier?: string
}

// Get client identifier from request
function getIdentifier(request: NextRequest, userId?: string): string {
  // Prefer user ID for authenticated requests
  if (userId) {
    return `user:${userId}`
  }

  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0] || realIp || 'unknown'
  
  return `ip:${ip}`
}

// Get client IP address
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  return forwarded?.split(',')[0] || realIp || 'unknown'
}

/**
 * Check rate limit for sign-in attempts
 */
export async function checkSigninRateLimit(
  request: NextRequest,
  email?: string
): Promise<RateLimitResult> {
  const identifier = email ? `email:${email}` : getIdentifier(request)
  
  try {
    const result = await rateLimiters.signin.limit(identifier)
    
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: new Date(result.reset),
      message: result.success ? undefined : rateLimitConfigs.signin.message,
      identifier,
    }
  } catch (error) {
    console.error('[SECURITY] Rate limit check failed for signin:', error)
    // Fail closed for security-critical signin endpoint
    return {
      success: false,
      limit: rateLimitConfigs.signin.requests,
      remaining: 0,
      reset: new Date(Date.now() + 15 * 60 * 1000),
      message: 'Service temporarily unavailable. Please try again later.',
      identifier,
    }
  }
}

/**
 * Check rate limit for sign-up attempts
 */
export async function checkSignupRateLimit(
  request: NextRequest
): Promise<RateLimitResult> {
  const identifier = getIdentifier(request)
  
  try {
    const result = await rateLimiters.signup.limit(identifier)
    
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: new Date(result.reset),
      message: result.success ? undefined : rateLimitConfigs.signup.message,
      identifier,
    }
  } catch (error) {
    console.error('[SECURITY] Rate limit check failed for signup:', error)
    // Fail closed for security-critical signup endpoint
    return {
      success: false,
      limit: rateLimitConfigs.signup.requests,
      remaining: 0,
      reset: new Date(Date.now() + 60 * 60 * 1000),
      message: 'Service temporarily unavailable. Please try again later.',
      identifier,
    }
  }
}

/**
 * Check rate limit for password reset attempts
 */
export async function checkPasswordResetRateLimit(
  request: NextRequest,
  email?: string
): Promise<RateLimitResult> {
  const identifier = email ? `email:${email}` : getIdentifier(request)
  
  try {
    const result = await rateLimiters.passwordReset.limit(identifier)
    
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: new Date(result.reset),
      message: result.success ? undefined : rateLimitConfigs.passwordReset.message,
      identifier,
    }
  } catch (error) {
    console.error('[SECURITY] Rate limit check failed for password reset:', error)
    // Fail closed for security-critical password reset
    return {
      success: false,
      limit: rateLimitConfigs.passwordReset.requests,
      remaining: 0,
      reset: new Date(Date.now() + 60 * 60 * 1000),
      message: 'Service temporarily unavailable. Please try again later.',
      identifier,
    }
  }
}

/**
 * Check rate limit for magic link requests
 */
export async function checkMagicLinkRateLimit(
  request: NextRequest,
  email?: string
): Promise<RateLimitResult> {
  const identifier = email ? `email:${email}` : getIdentifier(request)
  
  try {
    const result = await rateLimiters.magicLink.limit(identifier)
    
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: new Date(result.reset),
      message: result.success ? undefined : rateLimitConfigs.magicLink.message,
      identifier,
    }
  } catch (error) {
    console.error('[SECURITY] Rate limit check failed for magic link:', error)
    // Fail closed for security-critical magic link
    return {
      success: false,
      limit: rateLimitConfigs.magicLink.requests,
      remaining: 0,
      reset: new Date(Date.now() + 60 * 60 * 1000),
      message: 'Service temporarily unavailable. Please try again later.',
      identifier,
    }
  }
}

/**
 * Check rate limit for session check endpoint
 */
export async function checkSessionRateLimit(
  request: NextRequest,
  userId?: string
): Promise<RateLimitResult> {
  const identifier = getIdentifier(request, userId)

  try {
    const result = await rateLimiters.sessionCheck.limit(identifier)

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: new Date(result.reset),
      message: result.success ? undefined : rateLimitConfigs.sessionCheck.message,
      identifier,
    }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    return {
      success: true,
      limit: rateLimitConfigs.sessionCheck.requests,
      remaining: rateLimitConfigs.sessionCheck.requests,
      reset: new Date(Date.now() + 60 * 1000),
      identifier,
    }
  }
}

/**
 * Check rate limit for general API endpoints
 */
export async function checkApiRateLimit(
  request: NextRequest,
  userId?: string
): Promise<RateLimitResult> {
  const identifier = getIdentifier(request, userId)

  try {
    const result = await rateLimiters.api.limit(identifier)

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: new Date(result.reset),
      message: result.success ? undefined : rateLimitConfigs.api.message,
      identifier,
    }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    return {
      success: true,
      limit: rateLimitConfigs.api.requests,
      remaining: rateLimitConfigs.api.requests,
      reset: new Date(Date.now() + 60 * 1000),
      identifier,
    }
  }
}

/**
 * Check rate limit for admin actions
 */
export async function checkAdminRateLimit(
  request: NextRequest,
  userId: string
): Promise<RateLimitResult> {
  const identifier = `admin:${userId}`
  
  try {
    const result = await rateLimiters.adminAction.limit(identifier)
    
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: new Date(result.reset),
      message: result.success ? undefined : rateLimitConfigs.adminAction.message,
      identifier,
    }
  } catch (error) {
    console.error('[SECURITY] Rate limit check failed for admin action:', error)
    // Fail closed for security-critical admin actions
    return {
      success: false,
      limit: rateLimitConfigs.adminAction.requests,
      remaining: 0,
      reset: new Date(Date.now() + 60 * 1000),
      message: 'Service temporarily unavailable. Please try again later.',
      identifier,
    }
  }
}

/**
 * Check rate limit for profile updates
 */
export async function checkProfileUpdateRateLimit(
  request: NextRequest,
  userId: string
): Promise<RateLimitResult> {
  const identifier = `profile:${userId}`
  
  try {
    const result = await rateLimiters.profileUpdate.limit(identifier)
    
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: new Date(result.reset),
      message: result.success ? undefined : rateLimitConfigs.profileUpdate.message,
      identifier,
    }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    return {
      success: true,
      limit: rateLimitConfigs.profileUpdate.requests,
      remaining: rateLimitConfigs.profileUpdate.requests,
      reset: new Date(Date.now() + 60 * 60 * 1000),
      identifier,
    }
  }
}

/**
 * Custom rate limiting for specific use cases
 */
export async function checkCustomRateLimit(
  identifier: string,
  requests: number,
  windowMs: number,
  prefix: string = 'custom'
): Promise<RateLimitResult> {
  const rateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, `${windowMs}ms`),
    prefix: `ratelimit:${prefix}`,
  })
  
  try {
    const result = await rateLimiter.limit(identifier)
    
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: new Date(result.reset),
      identifier,
    }
  } catch (error) {
    console.error('Custom rate limit check failed:', error)
    return {
      success: true,
      limit: requests,
      remaining: requests,
      reset: new Date(Date.now() + windowMs),
      identifier,
    }
  }
}

/**
 * Track authentication attempts for progressive delays
 */
export async function trackAuthAttempt(
  identifier: string,
  success: boolean
): Promise<{ attempts: number; lockoutUntil?: Date }> {
  const key = RedisKeys.authAttempts(identifier)
  
  try {
    if (success) {
      // Clear attempts on successful authentication
      await redis.del(key)
      return { attempts: 0 }
    }

    // Increment failed attempts
    const attempts = await redis.incr(key)
    await redis.expire(key, CacheTTL.AUTH_ATTEMPTS)
    
    // Calculate progressive lockout
    let lockoutSeconds = 0
    if (attempts >= 10) {
      lockoutSeconds = 60 * 60 // 1 hour
    } else if (attempts >= 5) {
      lockoutSeconds = 15 * 60 // 15 minutes
    } else if (attempts >= 3) {
      lockoutSeconds = 5 * 60 // 5 minutes
    }
    
    const lockoutUntil = lockoutSeconds > 0 
      ? new Date(Date.now() + lockoutSeconds * 1000)
      : undefined
    
    return { attempts, lockoutUntil }
  } catch (error) {
    console.error('Error tracking auth attempts:', error)
    return { attempts: 0 }
  }
}

/**
 * Check if an identifier is currently locked out
 */
export async function isLockedOut(identifier: string): Promise<boolean> {
  try {
    const attempts = await redis.get(RedisKeys.authAttempts(identifier))
    return (attempts as number) >= 3 // Start lockout after 3 failures
  } catch (error) {
    console.error('Error checking lockout status:', error)
    return false
  }
}

/**
 * Get rate limit headers for API responses
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.reset.getTime() / 1000).toString(),
    'Retry-After': result.success ? '0' : Math.ceil((result.reset.getTime() - Date.now()) / 1000).toString(),
  }
}

/**
 * Rate limiting middleware for API routes
 */
export function withRateLimit(
  rateLimitFn: (request: NextRequest) => Promise<RateLimitResult>
) {
  return async (request: NextRequest) => {
    const result = await rateLimitFn(request)
    
    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'RATE_LIMITED',
            message: result.message || 'Too many requests',
          },
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...getRateLimitHeaders(result),
          },
        }
      )
    }
    
    return null // Continue to handler
  }
}