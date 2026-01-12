"use strict";
// Redis client configuration for Upstash Redis
// Handles caching, session storage, and rate limiting
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisUtils = exports.CacheTTL = exports.RedisKeys = exports.redis = void 0;
exports.checkRedisConnection = checkRedisConnection;
exports.getRedisInfo = getRedisInfo;
exports.getRedisClient = getRedisClient;
exports.closeRedis = closeRedis;
const redis_1 = require("@upstash/redis");
// Environment variables - trim any whitespace
const UPSTASH_REDIS_REST_URL = (_a = process.env.UPSTASH_REDIS_REST_URL) === null || _a === void 0 ? void 0 : _a.trim();
const UPSTASH_REDIS_REST_TOKEN = (_b = process.env.UPSTASH_REDIS_REST_TOKEN) === null || _b === void 0 ? void 0 : _b.trim();
// CRITICAL: In production, Redis is REQUIRED for session management, tier caching, and rate limiting
// Fail fast if not configured to prevent silent degradation and Stripe checkout issues
// Only check on server-side (typeof window === 'undefined')
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    if (!UPSTASH_REDIS_REST_URL || UPSTASH_REDIS_REST_URL.includes('mock')) {
        console.error('🔴 CRITICAL: Redis (Upstash) is not configured in production');
        console.error('Required environment variables:');
        console.error('  - UPSTASH_REDIS_REST_URL');
        console.error('  - UPSTASH_REDIS_REST_TOKEN');
        console.error('');
        console.error('Redis is required for:');
        console.error('  - Session authentication (including Stripe checkout)');
        console.error('  - Tier caching (premium subscription detection)');
        console.error('  - Rate limiting (security)');
        console.error('  - User stats caching (performance)');
        throw new Error('Redis configuration required in production. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.');
    }
    if (!UPSTASH_REDIS_REST_TOKEN) {
        console.error('🔴 CRITICAL: UPSTASH_REDIS_REST_TOKEN is missing in production');
        throw new Error('Redis token required in production. Set UPSTASH_REDIS_REST_TOKEN environment variable.');
    }
}
// Development/Test: Warn if not configured but allow mock fallback
// Only warn on server-side to avoid browser console pollution
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
    if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
        console.warn('⚠️  Redis not configured. Using mock Redis for development.');
        console.warn('To use real Redis, add to your .env.local:');
        console.warn('  UPSTASH_REDIS_REST_URL=your_url_here');
        console.warn('  UPSTASH_REDIS_REST_TOKEN=your_token_here');
    }
}
// Create Redis instance or mock for development
exports.redis = (!UPSTASH_REDIS_REST_URL || UPSTASH_REDIS_REST_URL.includes('mock')) ?
    // Mock Redis implementation for development
    {
        get: async (key) => {
            console.log('[Mock Redis] GET:', key);
            return null;
        },
        set: async (key, value, options) => {
            console.log('[Mock Redis] SET:', key);
            return 'OK';
        },
        setex: async (key, ttl, value) => {
            console.log('[Mock Redis] SETEX:', key, ttl);
            return 'OK';
        },
        del: async (...keys) => {
            console.log('[Mock Redis] DEL:', keys);
            return keys.length;
        },
        keys: async (pattern) => {
            console.log('[Mock Redis] KEYS:', pattern);
            return [];
        },
        exists: async (...keys) => {
            console.log('[Mock Redis] EXISTS:', keys);
            return 0;
        },
        expire: async (key, ttl) => {
            console.log('[Mock Redis] EXPIRE:', key, ttl);
            return 1;
        },
        ttl: async (key) => {
            console.log('[Mock Redis] TTL:', key);
            return -1;
        },
        incr: async (key) => {
            console.log('[Mock Redis] INCR:', key);
            return 1;
        },
        mget: async (...keys) => {
            console.log('[Mock Redis] MGET:', keys);
            return keys.map(() => null);
        },
        mset: async (data) => {
            console.log('[Mock Redis] MSET:', data);
            return 'OK';
        },
        pipeline: () => ({
            exec: async () => {
                console.log('[Mock Redis] PIPELINE EXEC');
                return [];
            }
        })
    } :
    new redis_1.Redis({
        url: UPSTASH_REDIS_REST_URL,
        token: UPSTASH_REDIS_REST_TOKEN,
        automaticDeserialization: false, // Keep as strings for consistent JSON handling
    });
// Log Redis client status on initialization (server-side only)
if (typeof window === 'undefined') {
    if (exports.redis === null || typeof exports.redis === 'object' && 'get' in exports.redis && exports.redis.get.constructor.name === 'AsyncFunction') {
        // Mock Redis
        console.log('[Redis] 🔶 Using MOCK Redis client (development mode)');
    }
    else {
        // Real Redis
        console.log('[Redis] ✅ Using REAL Upstash Redis client');
        console.log(`[Redis] 🔗 Connected to: ${UPSTASH_REDIS_REST_URL === null || UPSTASH_REDIS_REST_URL === void 0 ? void 0 : UPSTASH_REDIS_REST_URL.slice(0, 30)}...`);
    }
}
// Redis key prefixes for different data types
exports.RedisKeys = {
    // Session management
    session: (sessionId) => `session:${sessionId}`,
    userSessions: (userId) => `user_sessions:${userId}`,
    blacklist: (sessionId) => `blacklist:${sessionId}`,
    // User data caching
    userProfile: (userId) => `profile:${userId}`,
    userTier: (userId) => `tier:${userId}`,
    userEntitlements: (userId) => `entitlements:${userId}`,
    // Authentication
    magicLink: (token) => `magic:${token}`,
    passwordReset: (token) => `reset:${token}`,
    emailVerification: (token) => `verify:${token}`,
    // Rate limiting
    rateLimit: (identifier, endpoint) => `ratelimit:${endpoint}:${identifier}`,
    authAttempts: (identifier) => `auth_attempts:${identifier}`,
    // Application data
    lessonProgress: (userId, lessonId) => `progress:${userId}:${lessonId}`,
    userStats: (userId) => `stats:${userId}`,
    reviewQueue: (userId) => `queue:${userId}`,
    // Admin operations
    adminAudit: (action, timestamp) => `audit:${action}:${timestamp}`,
};
// Cache TTL constants (in seconds)
exports.CacheTTL = {
    // Session data
    SESSION_VALIDATION: 5 * 60, // 5 minutes
    SESSION_TOKEN: 60 * 60, // 1 hour
    // User data
    USER_PROFILE: 15 * 60, // 15 minutes
    USER_TIER: 5 * 60, // 5 minutes
    USER_ENTITLEMENTS: 10 * 60, // 10 minutes
    // Authentication
    MAGIC_LINK: 15 * 60, // 15 minutes
    PASSWORD_RESET: 60 * 60, // 1 hour
    EMAIL_VERIFICATION: 24 * 60 * 60, // 24 hours
    // Rate limiting
    RATE_LIMIT_WINDOW: 60, // 1 minute
    AUTH_ATTEMPTS: 15 * 60, // 15 minutes
    // Application data
    LESSON_PROGRESS: 30 * 60, // 30 minutes
    USER_STATS: 60 * 60, // 1 hour
    // Short-lived caches
    TEMPORARY: 5 * 60, // 5 minutes
    LONG_TERM: 24 * 60 * 60, // 24 hours
};
// Utility functions for Redis operations
exports.RedisUtils = {
    /**
     * Set with automatic expiration
     */
    async setWithTTL(key, value, ttl) {
        await exports.redis.setex(key, ttl, JSON.stringify(value));
    },
    /**
     * Get and parse JSON
     */
    async getJSON(key) {
        const value = await exports.redis.get(key);
        return value ? JSON.parse(value) : null;
    },
    /**
     * Increment with expiration
     */
    async incrementWithTTL(key, ttl) {
        const pipeline = exports.redis.pipeline();
        pipeline.incr(key);
        pipeline.expire(key, ttl);
        const results = await pipeline.exec();
        return results[0];
    },
    /**
     * Set expiration if key doesn't have one
     */
    async ensureExpiration(key, ttl) {
        const currentTTL = await exports.redis.ttl(key);
        if (currentTTL === -1) { // Key exists but no expiration
            await exports.redis.expire(key, ttl);
        }
    },
    /**
     * Multi-get with fallback
     */
    async mgetWithDefault(keys, defaultValue) {
        const values = await exports.redis.mget(...keys);
        return values.map((value) => value !== null ? value : defaultValue);
    },
    /**
     * Cache with function fallback
     */
    async cacheWithFallback(key, fallbackFn, ttl = exports.CacheTTL.TEMPORARY) {
        // Try to get from cache first
        const cached = await exports.RedisUtils.getJSON(key);
        if (cached !== null) {
            return cached;
        }
        // Execute fallback function
        const result = await fallbackFn();
        // Cache the result
        await exports.RedisUtils.setWithTTL(key, result, ttl);
        return result;
    },
    /**
     * Invalidate cache pattern
     */
    async invalidatePattern(pattern) {
        // Note: Upstash Redis doesn't support KEYS command for security reasons
        // In production, you'd maintain a set of keys to invalidate
        console.log(`Would invalidate pattern: ${pattern}`);
    },
    /**
     * Batch set operations
     */
    async setBatch(operations) {
        const pipeline = exports.redis.pipeline();
        for (const op of operations) {
            if (op.ttl) {
                pipeline.setex(op.key, op.ttl, JSON.stringify(op.value));
            }
            else {
                pipeline.set(op.key, JSON.stringify(op.value));
            }
        }
        await pipeline.exec();
    },
    /**
     * Batch delete operations
     */
    async deleteBatch(keys) {
        if (keys.length === 0)
            return;
        const pipeline = exports.redis.pipeline();
        keys.forEach(key => pipeline.del(key));
        await pipeline.exec();
    },
    /**
     * Check if key exists and is not expired
     */
    async isValid(key) {
        const exists = await exports.redis.exists(key);
        return exists === 1;
    },
    /**
     * Get TTL remaining for a key
     */
    async getTTL(key) {
        return await exports.redis.ttl(key);
    },
};
// Health check function
async function checkRedisConnection() {
    try {
        const start = Date.now();
        await exports.redis.ping();
        const latency = Date.now() - start;
        return { connected: true, latency };
    }
    catch (error) {
        return {
            connected: false,
            error: error instanceof Error ? error.message : 'Unknown Redis error'
        };
    }
}
// Redis connection info for debugging
function getRedisInfo() {
    return {
        url: UPSTASH_REDIS_REST_URL ? `${UPSTASH_REDIS_REST_URL.slice(0, 20)}...` : undefined,
        configured: !!(UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN),
    };
}
// Get Redis client (alias for compatibility)
function getRedisClient() {
    return exports.redis;
}
// Graceful shutdown helper
async function closeRedis() {
    try {
        // Upstash Redis client doesn't need explicit connection closing
        console.log('Redis client shutdown complete');
    }
    catch (error) {
        console.error('Error during Redis shutdown:', error);
    }
}
//# sourceMappingURL=client.js.map