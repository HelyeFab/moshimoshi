"use strict";
/**
 * Performance-Optimized Cache Manager
 * Week 2 - Redis Caching Layer Implementation
 *
 * Implements multi-tier caching with:
 * - L1: In-memory LRU cache (fastest, limited size)
 * - L2: Redis cache (fast, distributed)
 * - L3: Database (source of truth)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheManager = exports.CacheManager = exports.CACHE_CONFIG = void 0;
exports.cached = cached;
exports.invalidatesCache = invalidatesCache;
const client_1 = require("@/lib/redis/client");
// Note: lru-cache v7+ uses named export, not default export
const lru_cache_1 = require("lru-cache");
/**
 * Cache configuration based on performance budget
 */
exports.CACHE_CONFIG = {
    // Session data - frequently accessed, small size
    SESSION: {
        ttl: 5 * 60, // 5 minutes
        maxMemoryItems: 100,
        warmup: true,
    },
    // Queue generation - moderate access, medium size
    QUEUE: {
        ttl: 60, // 1 minute
        maxMemoryItems: 50,
        warmup: false,
    },
    // User progress - moderate access, medium size
    USER_PROGRESS: {
        ttl: 10 * 60, // 10 minutes
        maxMemoryItems: 200,
        warmup: true,
    },
    // Lesson data - infrequent changes, large size
    LESSON_DATA: {
        ttl: 60 * 60, // 1 hour
        maxMemoryItems: 500,
        warmup: true,
    },
    // Statistics - expensive to calculate
    STATS: {
        ttl: 5 * 60, // 5 minutes
        maxMemoryItems: 20,
        warmup: false,
    },
    // TTS audio URLs - static content
    TTS_AUDIO: {
        ttl: 24 * 60 * 60, // 24 hours
        maxMemoryItems: 1000,
        warmup: false,
    },
    // Conjugation forms - static data, frequently accessed
    CONJUGATION: {
        ttl: 24 * 60 * 60, // 24 hours (conjugations never change)
        maxMemoryItems: 1000, // Generous - conjugations are small (~2KB each)
        warmup: true, // Pre-cache common words for instant drill startup
    },
};
/**
 * Multi-tier cache manager
 */
class CacheManager {
    constructor() {
        this.memoryCache = new Map();
        this.stats = {
            hits: { memory: 0, redis: 0 },
            misses: 0,
            sets: 0,
            evictions: 0,
            errors: 0,
        };
        // Initialize memory caches for each category
        Object.entries(exports.CACHE_CONFIG).forEach(([category, config]) => {
            this.memoryCache.set(category, new lru_cache_1.LRUCache({
                max: config.maxMemoryItems,
                ttl: config.ttl * 1000, // Convert to milliseconds
                updateAgeOnGet: true,
                updateAgeOnHas: false,
            }));
        });
    }
    static getInstance() {
        if (!CacheManager.instance) {
            CacheManager.instance = new CacheManager();
        }
        return CacheManager.instance;
    }
    /**
     * Get value from cache (L1 -> L2 -> L3)
     */
    async get(category, key, fetcher) {
        const fullKey = this.buildKey(category, key);
        // L1: Check memory cache
        const memCache = this.memoryCache.get(category);
        if (memCache) {
            const memValue = memCache.get(fullKey);
            if (memValue !== undefined) {
                this.stats.hits.memory++;
                return memValue;
            }
        }
        // L2: Check Redis cache
        try {
            const redisValue = await client_1.redis.get(fullKey);
            if (redisValue) {
                this.stats.hits.redis++;
                const parsed = JSON.parse(redisValue);
                // Populate L1 cache
                if (memCache) {
                    memCache.set(fullKey, parsed);
                }
                return parsed;
            }
        }
        catch (error) {
            console.error('Redis get error:', error);
            this.stats.errors++;
        }
        // L3: Fetch from source if fetcher provided
        if (fetcher) {
            this.stats.misses++;
            try {
                const value = await fetcher();
                if (value !== null && value !== undefined) {
                    // Populate both caches
                    await this.set(category, key, value);
                }
                return value;
            }
            catch (error) {
                console.error('Fetcher error:', error);
                this.stats.errors++;
                return null;
            }
        }
        this.stats.misses++;
        return null;
    }
    /**
     * Set value in cache (L1 + L2)
     */
    async set(category, key, value, customTTL) {
        const fullKey = this.buildKey(category, key);
        const config = exports.CACHE_CONFIG[category];
        const ttl = customTTL || config.ttl;
        this.stats.sets++;
        // L1: Set in memory cache
        const memCache = this.memoryCache.get(category);
        if (memCache) {
            memCache.set(fullKey, value);
        }
        // L2: Set in Redis cache
        try {
            await client_1.redis.setex(fullKey, ttl, JSON.stringify(value));
        }
        catch (error) {
            console.error('Redis set error:', error);
            this.stats.errors++;
        }
    }
    /**
     * Delete value from cache
     */
    async delete(category, key) {
        const fullKey = this.buildKey(category, key);
        // L1: Delete from memory cache
        const memCache = this.memoryCache.get(category);
        if (memCache) {
            memCache.delete(fullKey);
        }
        // L2: Delete from Redis
        try {
            await client_1.redis.del(fullKey);
        }
        catch (error) {
            console.error('Redis delete error:', error);
            this.stats.errors++;
        }
    }
    /**
     * Invalidate entire category
     */
    async invalidateCategory(category) {
        // L1: Clear memory cache
        const memCache = this.memoryCache.get(category);
        if (memCache) {
            memCache.clear();
        }
        // L2: Clear Redis keys for category
        try {
            const pattern = `${category.toLowerCase()}:*`;
            const keys = await client_1.redis.keys(pattern);
            if (keys.length > 0) {
                await client_1.redis.del(...keys);
            }
        }
        catch (error) {
            console.error('Redis invalidate error:', error);
            this.stats.errors++;
        }
    }
    /**
     * Batch get with optimized Redis operations
     */
    async batchGet(category, keys) {
        const results = new Map();
        const memCache = this.memoryCache.get(category);
        const missingKeys = [];
        // L1: Check memory cache first
        for (const key of keys) {
            const fullKey = this.buildKey(category, key);
            if (memCache) {
                const value = memCache.get(fullKey);
                if (value !== undefined) {
                    results.set(key, value);
                    this.stats.hits.memory++;
                }
                else {
                    missingKeys.push(key);
                }
            }
            else {
                missingKeys.push(key);
            }
        }
        // L2: Batch fetch from Redis
        if (missingKeys.length > 0) {
            try {
                const fullKeys = missingKeys.map(k => this.buildKey(category, k));
                const values = await client_1.redis.mget(...fullKeys);
                values.forEach((value, index) => {
                    if (value) {
                        const parsed = JSON.parse(value);
                        results.set(missingKeys[index], parsed);
                        this.stats.hits.redis++;
                        // Populate L1 cache
                        if (memCache) {
                            memCache.set(fullKeys[index], parsed);
                        }
                    }
                    else {
                        this.stats.misses++;
                    }
                });
            }
            catch (error) {
                console.error('Redis batch get error:', error);
                this.stats.errors++;
            }
        }
        return results;
    }
    /**
     * Batch set with pipelining
     */
    async batchSet(category, items, customTTL) {
        const config = exports.CACHE_CONFIG[category];
        const ttl = customTTL || config.ttl;
        const memCache = this.memoryCache.get(category);
        // L1: Set in memory cache
        for (const item of items) {
            const fullKey = this.buildKey(category, item.key);
            if (memCache) {
                memCache.set(fullKey, item.value);
            }
            this.stats.sets++;
        }
        // L2: Batch set in Redis using pipeline
        try {
            const pipeline = client_1.redis.pipeline();
            for (const item of items) {
                const fullKey = this.buildKey(category, item.key);
                pipeline.setex(fullKey, ttl, JSON.stringify(item.value));
            }
            await pipeline.exec();
        }
        catch (error) {
            console.error('Redis batch set error:', error);
            this.stats.errors++;
        }
    }
    /**
     * Warm up cache with frequently accessed data
     */
    async warmup(category, items) {
        const config = exports.CACHE_CONFIG[category];
        if (!config.warmup) {
            return;
        }
        console.log(`Warming up ${category} cache with ${items.length} items...`);
        // Batch set all items
        const cacheItems = items.map(item => ({
            key: item.id || item.key,
            value: item,
        }));
        await this.batchSet(category, cacheItems);
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const totalHits = this.stats.hits.memory + this.stats.hits.redis;
        const totalRequests = totalHits + this.stats.misses;
        const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;
        return Object.assign(Object.assign({}, this.stats), { hitRate });
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            hits: { memory: 0, redis: 0 },
            misses: 0,
            sets: 0,
            evictions: 0,
            errors: 0,
        };
    }
    /**
     * Get in-memory cache size for a category
     */
    getMemorySize(category) {
        const memCache = this.memoryCache.get(category);
        return memCache ? memCache.size : 0;
    }
    /**
     * Build cache key
     */
    buildKey(category, key) {
        return `${category.toLowerCase()}:${key}`;
    }
}
exports.CacheManager = CacheManager;
/**
 * Cache decorator for methods
 */
function cached(category, keyBuilder) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const cache = CacheManager.getInstance();
            const key = keyBuilder ? keyBuilder(...args) : JSON.stringify(args);
            // Try to get from cache
            const cached = await cache.get(category, key);
            if (cached !== null) {
                return cached;
            }
            // Execute method and cache result
            const result = await originalMethod.apply(this, args);
            if (result !== null && result !== undefined) {
                await cache.set(category, key, result);
            }
            return result;
        };
        return descriptor;
    };
}
/**
 * Invalidate cache decorator
 */
function invalidatesCache(category, keyBuilder) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const result = await originalMethod.apply(this, args);
            // Invalidate cache after successful execution
            const cache = CacheManager.getInstance();
            if (keyBuilder) {
                const key = keyBuilder(...args);
                await cache.delete(category, key);
            }
            else {
                // Invalidate entire category if no key builder provided
                await cache.invalidateCategory(category);
            }
            return result;
        };
        return descriptor;
    };
}
// Export singleton instance
exports.cacheManager = CacheManager.getInstance();
//# sourceMappingURL=cache-manager.js.map