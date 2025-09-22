/**
 * Advanced rate limiting with adaptive controls and fingerprinting
 * Provides protection against abuse while allowing legitimate usage
 */

import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { redis } from '@/lib/redis/client'
import crypto from 'crypto'

/**
 * Rate limit tiers with different limits
 */
export const RateLimitTiers = {
  guest: 1,
  free: 2,
  premium: 5,
  admin: 10,
} as const

/**
 * Rate limit configurations for different endpoint categories
 */
export const RateLimitConfigs = {
  // Authentication endpoints - strict limits
  auth: {
    signin: { requests: 5, window: '15m', penalty: true },
    signup: { requests: 3, window: '1h', penalty: true },
    passwordReset: { requests: 3, window: '1h', penalty: true },
    magicLink: { requests: 3, window: '15m', penalty: true },
    refresh: { requests: 30, window: '15m' },
    session: { requests: 60, window: '1m' },
  },
  
  // User endpoints - moderate limits
  user: {
    profile: { requests: 30, window: '1m' },
    updateProfile: { requests: 10, window: '5m' },
    deleteAccount: { requests: 1, window: '24h', penalty: true },
    exportData: { requests: 5, window: '1h' },
  },
  
  // Review endpoints - generous limits
  review: {
    queue: { requests: 60, window: '1m' },
    session: { requests: 100, window: '1m' },
    answer: { requests: 300, window: '1m' },
    pin: { requests: 50, window: '1m' },
    stats: { requests: 30, window: '1m' },
  },
  
  // TTS endpoints - resource-intensive
  tts: {
    synthesize: { requests: 30, window: '1m', cost: 2 },
    batch: { requests: 5, window: '1m', cost: 10 },
    preload: { requests: 10, window: '5m', cost: 5 },
  },
  
  // Admin endpoints - relaxed limits
  admin: {
    stats: { requests: 100, window: '1m' },
    operations: { requests: 50, window: '1m' },
  },
  
  // Default fallback
  default: { requests: 60, window: '1m' },
} as const

/**
 * Request fingerprint for advanced tracking
 */
export interface RequestFingerprint {
  ip: string
  userAgent: string
  acceptLanguage: string
  acceptEncoding: string
  origin: string
  userId?: string
  sessionId?: string
  hash: string
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
  fingerprint?: RequestFingerprint
}

/**
 * Create request fingerprint for tracking
 */
export function createFingerprint(request: NextRequest): RequestFingerprint {
  const headers = request.headers
  
  const components = {
    ip: headers.get('x-forwarded-for')?.split(',')[0] || 
        headers.get('x-real-ip') || 
        'unknown',
    userAgent: headers.get('user-agent') || 'unknown',
    acceptLanguage: headers.get('accept-language') || 'unknown',
    acceptEncoding: headers.get('accept-encoding') || 'unknown',
    origin: headers.get('origin') || headers.get('referer') || 'unknown',
    userId: headers.get('x-user-id'),
    sessionId: headers.get('x-session-id'),
  }
  
  // Create hash of fingerprint components
  const fingerprintString = Object.values(components)
    .filter(Boolean)
    .join('|')
  
  const hash = crypto
    .createHash('sha256')
    .update(fingerprintString)
    .digest('hex')
    .substring(0, 16)
  
  return {
    ...components,
    userId: components.userId || undefined,
    sessionId: components.sessionId || undefined,
    hash,
  }
}

/**
 * Adaptive rate limiter that adjusts based on behavior
 */
export class AdaptiveRateLimiter {
  private baseConfig: { requests: number; window: string }
  private limiter: Ratelimit
  
  constructor(
    private endpoint: string,
    config: { requests: number; window: string; cost?: number; penalty?: boolean }
  ) {
    this.baseConfig = { requests: config.requests, window: config.window }
    this.limiter = new Ratelimit({
      redis: redis as any,
      limiter: Ratelimit.slidingWindow(config.requests, config.window as any),
      analytics: true,
      prefix: `rl:${endpoint}`,
    })
  }
  
  /**
   * Check rate limit with adaptive controls
   */
  async check(
    request: NextRequest,
    options?: {
      tier?: keyof typeof RateLimitTiers
      cost?: number
      bypassForAdmin?: boolean
    }
  ): Promise<RateLimitResult> {
    const fingerprint = createFingerprint(request)
    
    // Check if admin bypass is enabled
    if (options?.bypassForAdmin && fingerprint.userId) {
      const isAdmin = await this.checkAdminStatus(fingerprint.userId)
      if (isAdmin) {
        return {
          success: true,
          limit: 999999,
          remaining: 999999,
          reset: Date.now() + 3600000,
        }
      }
    }
    
    // Apply tier multiplier
    const tierMultiplier = options?.tier ? RateLimitTiers[options.tier] : 1
    const adjustedLimit = Math.floor(this.baseConfig.requests * tierMultiplier)
    
    // Create tier-specific limiter
    const tierLimiter = new Ratelimit({
      redis: redis as any,
      limiter: Ratelimit.slidingWindow(adjustedLimit, this.baseConfig.window as any),
      analytics: true,
      prefix: `rl:${this.endpoint}:${options?.tier || 'default'}`,
    })
    
    // Check suspicious behavior
    const suspiciousScore = await this.getSuspiciousScore(fingerprint)
    if (suspiciousScore > 0.8) {
      // Apply stricter limits for suspicious requests
      const strictLimiter = new Ratelimit({
        redis: redis as any,
        limiter: Ratelimit.slidingWindow(
          Math.max(1, Math.floor(adjustedLimit * 0.2)),
          this.baseConfig.window as any
        ),
        analytics: true,
        prefix: `rl:${this.endpoint}:suspicious`,
      })
      
      const result = await strictLimiter.limit(fingerprint.hash)
      return this.formatResult(result, fingerprint)
    }
    
    // Apply cost if specified
    const cost = options?.cost || 1
    const identifier = fingerprint.userId || fingerprint.sessionId || fingerprint.hash
    
    // Perform rate limit check
    const result = await tierLimiter.limit(identifier, { rate: cost })
    
    // Track behavior for adaptive controls
    await this.trackBehavior(fingerprint, result.success)
    
    return this.formatResult(result, fingerprint)
  }
  
  /**
   * Format rate limit result
   */
  private formatResult(
    result: any,
    fingerprint: RequestFingerprint
  ): RateLimitResult {
    const retryAfter = result.success ? undefined : 
      Math.ceil((result.reset - Date.now()) / 1000)
    
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      retryAfter,
      fingerprint,
    }
  }
  
  /**
   * Check if user is admin
   */
  private async checkAdminStatus(userId: string): Promise<boolean> {
    try {
      const key = `admin:${userId}`
      const cached = await redis.get(key)
      if (cached !== null) return cached === '1'
      
      // Check from Firebase database using the isAdmin field
      const { isAdminUser } = await import('@/lib/firebase/admin')
      const isAdmin = await isAdminUser(userId)
      
      // Cache for 5 minutes
      await redis.setex(key, 300, isAdmin ? '1' : '0')
      return isAdmin
    } catch {
      return false
    }
  }
  
  /**
   * Calculate suspicious behavior score
   */
  private async getSuspiciousScore(fingerprint: RequestFingerprint): Promise<number> {
    const key = `suspicious:${fingerprint.hash}`
    
    try {
      // Get recent violations
      const violations = await redis.get(`${key}:violations`) || 0
      const attempts = await redis.get(`${key}:attempts`) || 0
      
      if (Number(attempts) === 0) return 0
      
      // Calculate score based on violation ratio
      const score = Number(violations) / Number(attempts)
      
      // Additional checks
      const factors = []
      
      // Check for bot-like user agents
      if (this.isBotUserAgent(fingerprint.userAgent)) {
        factors.push(0.3)
      }
      
      // Check for missing headers
      if (fingerprint.acceptLanguage === 'unknown') {
        factors.push(0.1)
      }
      
      // Check for rapid requests
      const rapidRequests = await redis.get(`${key}:rapid`) || 0
      if (Number(rapidRequests) > 10) {
        factors.push(0.2)
      }
      
      // Combine scores
      const totalScore = Math.min(1, score + factors.reduce((a, b) => a + b, 0))
      
      return totalScore
    } catch {
      return 0
    }
  }
  
  /**
   * Track request behavior for adaptive controls
   */
  private async trackBehavior(
    fingerprint: RequestFingerprint,
    success: boolean
  ): Promise<void> {
    const key = `suspicious:${fingerprint.hash}`
    
    try {
      // Track attempts
      await redis.incr(`${key}:attempts`)
      await redis.expire(`${key}:attempts`, 3600) // 1 hour TTL
      
      // Track violations
      if (!success) {
        await redis.incr(`${key}:violations`)
        await redis.expire(`${key}:violations`, 3600)
      }
      
      // Track rapid requests (multiple requests within 1 second)
      const rapidKey = `${key}:rapid:${Math.floor(Date.now() / 1000)}`
      await redis.incr(rapidKey)
      await redis.expire(rapidKey, 10)
      
      const rapidCount = await redis.get(rapidKey)
      if (Number(rapidCount) > 5) {
        await redis.incr(`${key}:rapid`)
        await redis.expire(`${key}:rapid`, 3600)
      }
    } catch (error) {
      console.error('Failed to track behavior:', error)
    }
  }
  
  /**
   * Check if user agent appears to be a bot
   */
  private isBotUserAgent(userAgent: string): boolean {
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i,
      /ruby/i,
      /perl/i,
      /php/i,
    ]
    
    return botPatterns.some(pattern => pattern.test(userAgent))
  }
  
  /**
   * Clear rate limit for specific identifier
   */
  async clear(identifier: string): Promise<void> {
    try {
      const pattern = `rl:${this.endpoint}:*:${identifier}`
      // This would need Redis SCAN implementation
      console.log(`Clearing rate limit for pattern: ${pattern}`)
    } catch (error) {
      console.error('Failed to clear rate limit:', error)
    }
  }
}

/**
 * Create rate limiter for endpoint
 */
export function createRateLimiter(
  category: keyof typeof RateLimitConfigs,
  endpoint: string
): AdaptiveRateLimiter {
  const categoryConfig = RateLimitConfigs[category] as any
  const config = categoryConfig?.[endpoint] || RateLimitConfigs.default
  
  return new AdaptiveRateLimiter(`${category}:${endpoint}`, config)
}

/**
 * Rate limit middleware
 */
export async function rateLimitMiddleware(
  request: NextRequest,
  config: {
    category: keyof typeof RateLimitConfigs
    endpoint: string
    tier?: keyof typeof RateLimitTiers
    cost?: number
    bypassForAdmin?: boolean
  }
): Promise<NextResponse | null> {
  const limiter = createRateLimiter(config.category, config.endpoint)
  
  const result = await limiter.check(request, {
    tier: config.tier,
    cost: config.cost,
    bypassForAdmin: config.bypassForAdmin,
  })
  
  if (!result.success) {
    return NextResponse.json(
      {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          retryAfter: result.retryAfter,
          reset: new Date(result.reset).toISOString(),
        },
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': new Date(result.reset).toISOString(),
          'Retry-After': result.retryAfter?.toString() || '60',
        },
      }
    )
  }
  
  // Add rate limit headers to successful requests
  return null
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.reset).toISOString(),
    ...(result.fingerprint && {
      'X-Request-Fingerprint': result.fingerprint.hash,
    }),
  }
}