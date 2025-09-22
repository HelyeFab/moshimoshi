import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest } from 'next/server';
import { ComponentLogger } from '../monitoring/logger';

const logger = new ComponentLogger('rate-limiter');

// Initialize Redis client - trim any whitespace from env vars
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL?.trim() || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || '',
});

// Different rate limiters for different endpoints
export const rateLimiters = {
  // General API rate limiting
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
    prefix: 'ratelimit:api',
  }),

  // Strict rate limiting for auth endpoints
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(5, '1 m'),
    analytics: true,
    prefix: 'ratelimit:auth',
  }),

  // Review session rate limiting
  review: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(300, '1 m'),
    analytics: true,
    prefix: 'ratelimit:review',
  }),

  // Admin operations rate limiting
  admin: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(50, '1 m'),
    analytics: true,
    prefix: 'ratelimit:admin',
  }),

  // Webhook rate limiting
  webhook: new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(10, '1 s'),
    analytics: true,
    prefix: 'ratelimit:webhook',
  }),

  // File upload rate limiting
  upload: new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(10, '10 m'),
    analytics: true,
    prefix: 'ratelimit:upload',
  }),

  // Password reset rate limiting
  passwordReset: new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(3, '1 h'),
    analytics: true,
    prefix: 'ratelimit:password-reset',
  }),

  // DDoS protection - aggressive rate limiting
  ddos: new Ratelimit({
    redis,
    limiter: Ratelimit.tokenBucket(10, '1 s', 100),
    analytics: true,
    prefix: 'ratelimit:ddos',
  }),
};

// Get identifier from request
export function getIdentifier(req: NextRequest): string {
  // Try to get user ID from session/JWT
  const userId = req.headers.get('x-user-id');
  if (userId) return `user:${userId}`;

  // Fall back to IP address
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 
             req.headers.get('x-real-ip') || 
             'unknown';
  
  return `ip:${ip}`;
}

// Check rate limit
export async function checkRateLimit(
  req: NextRequest,
  limiterType: keyof typeof rateLimiters = 'api'
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}> {
  try {
    const identifier = getIdentifier(req);
    const limiter = rateLimiters[limiterType];
    
    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    // Log rate limit event
    if (!success) {
      logger.warn('Rate limit exceeded', {
        identifier,
        limiterType,
        limit,
        path: req.nextUrl.pathname,
      });
    }

    return {
      success,
      limit,
      remaining,
      reset: new Date(reset),
      retryAfter: success ? undefined : Math.floor((reset - Date.now()) / 1000),
    };
  } catch (error) {
    logger.error('Rate limit check failed', { error: error instanceof Error ? error.message : String(error) });
    // Fail open - allow request if rate limiting fails
    return {
      success: true,
      limit: 100,
      remaining: 99,
      reset: new Date(Date.now() + 60000),
    };
  }
}

// Middleware for rate limiting
export async function rateLimitMiddleware(
  req: NextRequest,
  limiterType: keyof typeof rateLimiters = 'api'
) {
  const result = await checkRateLimit(req, limiterType);

  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: result.retryAfter,
        reset: result.reset,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.reset.toISOString(),
          'Retry-After': result.retryAfter?.toString() || '60',
        },
      }
    );
  }

  // Add rate limit headers to successful responses
  return {
    headers: {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.reset.toISOString(),
    },
  };
}

// IP-based blocking for suspected attacks
export class IPBlocker {
  private static blockedIPs = new Set<string>();
  private static suspiciousActivity = new Map<string, number>();

  static async blockIP(ip: string, duration: number = 3600) {
    const key = `blocked:${ip}`;
    await redis.setex(key, duration, 'blocked');
    this.blockedIPs.add(ip);
    
    logger.warn('IP blocked', { ip, duration });
  }

  static async isBlocked(ip: string): Promise<boolean> {
    // Check local cache first
    if (this.blockedIPs.has(ip)) {
      return true;
    }

    // Check Redis
    const key = `blocked:${ip}`;
    const blocked = await redis.get(key);
    
    if (blocked) {
      this.blockedIPs.add(ip);
      return true;
    }

    return false;
  }

  static recordSuspiciousActivity(ip: string) {
    const count = (this.suspiciousActivity.get(ip) || 0) + 1;
    this.suspiciousActivity.set(ip, count);

    // Auto-block after threshold
    if (count >= 10) {
      this.blockIP(ip, 7200); // Block for 2 hours
      this.suspiciousActivity.delete(ip);
    }
  }

  static async unblockIP(ip: string) {
    const key = `blocked:${ip}`;
    await redis.del(key);
    this.blockedIPs.delete(ip);
    
    logger.info('IP unblocked', { ip });
  }
}

// Rate limit statistics
export async function getRateLimitStats() {
  const stats: Record<string, any> = {};

  for (const [name, limiter] of Object.entries(rateLimiters)) {
    // Get analytics data if available
    // This is a placeholder - actual implementation depends on Upstash analytics API
    stats[name] = {
      name,
      configured: true,
      // Add actual stats when available from Upstash
    };
  }

  return stats;
}

// Export for use in API routes
export default {
  checkRateLimit,
  rateLimitMiddleware,
  IPBlocker,
  getRateLimitStats,
};