/**
 * RateLimiter
 * Implements rate limiting for notification system with sliding window algorithm
 */

import { reviewLogger } from '@/lib/monitoring/logger'
import { NotificationChannel, NotificationPriority } from '../types/notifications.types'

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed
   */
  maxRequests: number

  /**
   * Time window in milliseconds
   */
  windowMs: number

  /**
   * Key prefix for identifying limits
   */
  keyPrefix?: string

  /**
   * Skip rate limiting for high priority
   */
  skipHighPriority?: boolean

  /**
   * Penalty multiplier for violations
   */
  penaltyMultiplier?: number

  /**
   * Maximum penalty duration
   */
  maxPenaltyMs?: number
}

/**
 * Rate limit entry
 */
interface RateLimitEntry {
  timestamps: number[]
  violations: number
  penaltyEndTime?: number
  lastResetTime: number
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: Date
  retryAfter?: number
  reason?: string
}

/**
 * Default rate limit configurations
 */
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Global user limit
  user: {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000, // 20 per hour
    skipHighPriority: true
  },

  // Per-channel limits
  browser: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 10 per hour
    keyPrefix: 'channel:browser'
  },

  inApp: {
    maxRequests: 30,
    windowMs: 60 * 60 * 1000, // 30 per hour
    keyPrefix: 'channel:inApp'
  },

  push: {
    maxRequests: 15,
    windowMs: 60 * 60 * 1000, // 15 per hour
    keyPrefix: 'channel:push'
  },

  email: {
    maxRequests: 5,
    windowMs: 24 * 60 * 60 * 1000, // 5 per day
    keyPrefix: 'channel:email'
  },

  // Burst protection
  burst: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 5 per minute
    keyPrefix: 'burst'
  }
}

/**
 * RateLimiter class
 * Implements sliding window rate limiting with exponential backoff
 */
export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map()
  private configs: Map<string, RateLimitConfig> = new Map()
  private cleanupInterval?: NodeJS.Timeout

  constructor() {
    // Initialize default configurations
    Object.entries(DEFAULT_RATE_LIMITS).forEach(([key, config]) => {
      this.configs.set(key, config)
    })

    // Start periodic cleanup
    this.startPeriodicCleanup()
  }

  /**
   * Check if request is allowed under rate limits
   */
  async checkLimit(
    userId: string,
    channel?: NotificationChannel,
    priority: NotificationPriority = 'normal'
  ): Promise<RateLimitResult> {
    const now = Date.now()
    const results: RateLimitResult[] = []

    // Check burst protection first
    const burstResult = this.checkSingleLimit('burst', `burst:${userId}`, now, priority)
    if (!burstResult.allowed) {
      return burstResult
    }
    results.push(burstResult)

    // Check user-level limit
    const userResult = this.checkSingleLimit('user', `user:${userId}`, now, priority)
    if (!userResult.allowed) {
      return userResult
    }
    results.push(userResult)

    // Check channel-specific limit if provided
    if (channel) {
      const channelResult = this.checkSingleLimit(channel, `channel:${channel}:${userId}`, now, priority)
      if (!channelResult.allowed) {
        return channelResult
      }
      results.push(channelResult)
    }

    // All checks passed, return the most restrictive remaining count
    const minRemaining = Math.min(...results.map(r => r.remaining))
    const maxResetTime = new Date(Math.max(...results.map(r => r.resetTime.getTime())))

    return {
      allowed: true,
      remaining: minRemaining,
      resetTime: maxResetTime
    }
  }

  /**
   * Check a single rate limit
   */
  private checkSingleLimit(
    configKey: string,
    limitKey: string,
    now: number,
    priority: NotificationPriority
  ): RateLimitResult {
    const config = this.configs.get(configKey)
    if (!config) {
      // No config means no limit
      return {
        allowed: true,
        remaining: Infinity,
        resetTime: new Date(now)
      }
    }

    // Skip rate limiting for high priority if configured
    if (config.skipHighPriority && priority === 'high') {
      return {
        allowed: true,
        remaining: Infinity,
        resetTime: new Date(now)
      }
    }

    // Get or create limit entry
    let entry = this.limits.get(limitKey)
    if (!entry) {
      entry = {
        timestamps: [],
        violations: 0,
        lastResetTime: now
      }
      this.limits.set(limitKey, entry)
    }

    // Check if under penalty
    if (entry.penaltyEndTime && now < entry.penaltyEndTime) {
      const retryAfter = Math.ceil((entry.penaltyEndTime - now) / 1000)

      reviewLogger.warn('Rate limit penalty active', {
        limitKey,
        retryAfter,
        violations: entry.violations
      })

      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(entry.penaltyEndTime),
        retryAfter,
        reason: `Rate limit penalty active. Too many violations (${entry.violations})`
      }
    }

    // Clean old timestamps (sliding window)
    const windowStart = now - config.windowMs
    entry.timestamps = entry.timestamps.filter(ts => ts > windowStart)

    // Check if limit exceeded
    if (entry.timestamps.length >= config.maxRequests) {
      // Increment violations
      entry.violations++

      // Apply penalty with exponential backoff
      if (config.penaltyMultiplier && entry.violations > 1) {
        const penaltyMs = Math.min(
          config.windowMs * Math.pow(config.penaltyMultiplier || 2, entry.violations - 1),
          config.maxPenaltyMs || 24 * 60 * 60 * 1000 // Max 24 hours
        )
        entry.penaltyEndTime = now + penaltyMs

        reviewLogger.warn('Rate limit exceeded with penalty', {
          limitKey,
          violations: entry.violations,
          penaltyMs
        })
      }

      const oldestTimestamp = Math.min(...entry.timestamps)
      const resetTime = new Date(oldestTimestamp + config.windowMs)
      const retryAfter = Math.ceil((resetTime.getTime() - now) / 1000)

      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter,
        reason: `Rate limit exceeded: ${entry.timestamps.length}/${config.maxRequests} requests in window`
      }
    }

    // Request allowed, add timestamp
    entry.timestamps.push(now)

    // Reset violations on successful request
    if (entry.violations > 0 && entry.timestamps.length === 1) {
      entry.violations = 0
      entry.penaltyEndTime = undefined
    }

    const remaining = config.maxRequests - entry.timestamps.length
    const resetTime = new Date(now + config.windowMs)

    return {
      allowed: true,
      remaining,
      resetTime
    }
  }

  /**
   * Record a request (for tracking after the fact)
   */
  recordRequest(
    userId: string,
    channel?: NotificationChannel,
    success: boolean = true
  ): void {
    const now = Date.now()
    const keys = [`burst:${userId}`, `user:${userId}`]

    if (channel) {
      keys.push(`channel:${channel}:${userId}`)
    }

    keys.forEach(key => {
      let entry = this.limits.get(key)
      if (!entry) {
        entry = {
          timestamps: [now],
          violations: 0,
          lastResetTime: now
        }
        this.limits.set(key, entry)
      } else {
        // Only add timestamp if not already recorded
        const recentTimestamp = entry.timestamps.find(ts => Math.abs(ts - now) < 1000)
        if (!recentTimestamp) {
          entry.timestamps.push(now)
        }
      }

      // Track failures
      if (!success && entry.violations !== undefined) {
        entry.violations++
      }
    })
  }

  /**
   * Reset rate limit for a user
   */
  resetUserLimits(userId: string): void {
    const keysToReset = Array.from(this.limits.keys()).filter(key =>
      key.includes(userId)
    )

    keysToReset.forEach(key => {
      this.limits.delete(key)
    })

    reviewLogger.info('User rate limits reset', {
      userId,
      keysReset: keysToReset.length
    })
  }

  /**
   * Get current limit status for a user
   */
  getLimitStatus(userId: string): Record<string, RateLimitResult> {
    const now = Date.now()
    const status: Record<string, RateLimitResult> = {}

    // Check all relevant limits
    const limitsToCheck = [
      { key: 'burst', limitKey: `burst:${userId}` },
      { key: 'user', limitKey: `user:${userId}` },
      { key: 'browser', limitKey: `channel:browser:${userId}` },
      { key: 'inApp', limitKey: `channel:inApp:${userId}` },
      { key: 'push', limitKey: `channel:push:${userId}` },
      { key: 'email', limitKey: `channel:email:${userId}` }
    ]

    limitsToCheck.forEach(({ key, limitKey }) => {
      status[key] = this.checkSingleLimit(key, limitKey, now, 'normal')
    })

    return status
  }

  /**
   * Update rate limit configuration
   */
  updateConfig(key: string, config: Partial<RateLimitConfig>): void {
    const existing = this.configs.get(key) || {}
    this.configs.set(key, { ...existing, ...config })

    reviewLogger.info('Rate limit config updated', {
      key,
      config
    })
  }

  /**
   * Start periodic cleanup of old entries
   */
  private startPeriodicCleanup(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now()
    let cleaned = 0

    this.limits.forEach((entry, key) => {
      // Remove entries with no recent activity (24 hours)
      const lastActivity = Math.max(...entry.timestamps, entry.lastResetTime)
      if (now - lastActivity > 24 * 60 * 60 * 1000) {
        this.limits.delete(key)
        cleaned++
      }
    })

    if (cleaned > 0) {
      reviewLogger.debug('Rate limiter cleanup', {
        entriesCleaned: cleaned,
        remainingEntries: this.limits.size
      })
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalEntries: number
    activeUsers: Set<string>
    violationCounts: Record<string, number>
    memoryUsage: number
  } {
    const activeUsers = new Set<string>()
    const violationCounts: Record<string, number> = {}

    this.limits.forEach((entry, key) => {
      // Extract userId from key
      const userMatch = key.match(/user:([^:]+)/)
      if (userMatch) {
        activeUsers.add(userMatch[1])
      }

      // Track violations
      if (entry.violations > 0) {
        violationCounts[key] = entry.violations
      }
    })

    return {
      totalEntries: this.limits.size,
      activeUsers,
      violationCounts,
      memoryUsage: this.limits.size * 200 // Rough estimate in bytes
    }
  }

  /**
   * Destroy and clean up
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }

    this.limits.clear()
    this.configs.clear()

    reviewLogger.info('RateLimiter destroyed')
  }
}

/**
 * Singleton instance
 */
let rateLimiterInstance: RateLimiter | null = null

/**
 * Get or create rate limiter instance
 */
export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter()
  }
  return rateLimiterInstance
}

/**
 * Destroy rate limiter instance
 */
export function destroyRateLimiter(): void {
  if (rateLimiterInstance) {
    rateLimiterInstance.destroy()
    rateLimiterInstance = null
  }
}