"use strict";
/**
 * Shared utilities for ethical web scraping (Firebase Functions version)
 * Implements rate limiting, robots.txt compliance, and retry logic
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryHandler = exports.RobotsTxtChecker = exports.RateLimiter = exports.USER_AGENT = void 0;
exports.safeFetch = safeFetch;
const logger = __importStar(require("firebase-functions/logger"));
const node_fetch_1 = __importDefault(require("node-fetch"));
// User-Agent string - generic browser to avoid bot detection
exports.USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
/**
 * Rate limiter to prevent overwhelming target servers
 * Implements 1.5-2 second delays between requests
 */
class RateLimiter {
    constructor(minDelayMs = 1500, maxDelayMs = 2000) {
        this.lastRequestTime = 0;
        this.minDelay = minDelayMs;
        this.maxDelay = maxDelayMs;
    }
    /**
     * Wait before making next request with randomized delay
     * Randomization helps avoid detection patterns
     */
    async wait() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        // Calculate random delay between min and max
        const delay = Math.floor(Math.random() * (this.maxDelay - this.minDelay) + this.minDelay);
        if (timeSinceLastRequest < delay) {
            const waitTime = delay - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastRequestTime = Date.now();
    }
    /**
     * Reset the rate limiter (useful for new scraping sessions)
     */
    reset() {
        this.lastRequestTime = 0;
    }
}
exports.RateLimiter = RateLimiter;
/**
 * Simple robots.txt parser and validator
 * Checks if a URL is allowed to be scraped
 */
class RobotsTxtChecker {
    constructor() {
        this.cache = new Map();
        this.cacheDuration = 1000 * 60 * 60 * 24; // 24 hours
    }
    /**
     * Check if URL is allowed by robots.txt
     * @param url Full URL to check
     * @returns Object with allowed status and crawl delay
     */
    async canCrawl(url) {
        try {
            const urlObj = new URL(url);
            const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
            const robotsUrl = `${baseUrl}/robots.txt`;
            // Check cache first
            const cached = this.cache.get(baseUrl);
            if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
                return { allowed: cached.allowed, crawlDelay: cached.crawlDelay };
            }
            // Fetch robots.txt with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await (0, node_fetch_1.default)(robotsUrl, {
                headers: {
                    'User-Agent': exports.USER_AGENT
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                // If robots.txt doesn't exist, assume allowed but use default delay
                logger.info('robots.txt not found, assuming allowed', { url: robotsUrl });
                const result = { allowed: true, crawlDelay: 1.5 };
                this.cache.set(baseUrl, Object.assign(Object.assign({}, result), { timestamp: Date.now() }));
                return result;
            }
            const robotsTxt = await response.text();
            const result = this.parseRobotsTxt(robotsTxt, urlObj.pathname);
            // Cache the result
            this.cache.set(baseUrl, Object.assign(Object.assign({}, result), { timestamp: Date.now() }));
            logger.info('robots.txt checked', {
                url: baseUrl,
                allowed: result.allowed,
                crawlDelay: result.crawlDelay
            });
            return result;
        }
        catch (error) {
            logger.warn('Failed to check robots.txt, assuming allowed', {
                url,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            // On error, allow but use conservative delay
            return { allowed: true, crawlDelay: 2.0 };
        }
    }
    /**
     * Parse robots.txt content
     * Simplified parser for common directives
     */
    parseRobotsTxt(content, pathname) {
        const lines = content.split('\n');
        let userAgentMatch = false;
        let disallowRules = [];
        let crawlDelay = 1.5; // Default delay
        for (const line of lines) {
            const trimmed = line.trim().toLowerCase();
            // Skip comments and empty lines
            if (trimmed.startsWith('#') || trimmed === '')
                continue;
            // Check User-agent
            if (trimmed.startsWith('user-agent:')) {
                const agent = trimmed.substring('user-agent:'.length).trim();
                userAgentMatch = agent === '*' || agent === 'moshimoshibot' || agent.includes('bot');
            }
            // Only process rules for matched user-agent
            if (userAgentMatch) {
                // Check Disallow rules
                if (trimmed.startsWith('disallow:')) {
                    const path = trimmed.substring('disallow:'.length).trim();
                    if (path)
                        disallowRules.push(path);
                }
                // Check Crawl-delay
                if (trimmed.startsWith('crawl-delay:')) {
                    const delay = trimmed.substring('crawl-delay:'.length).trim();
                    const delayNum = parseFloat(delay);
                    if (!isNaN(delayNum)) {
                        crawlDelay = Math.max(delayNum, 1.5); // Minimum 1.5s even if robots.txt says less
                    }
                }
            }
        }
        // Check if pathname matches any disallow rules
        const allowed = !disallowRules.some(rule => {
            if (rule === '/')
                return true; // Disallow all
            return pathname.startsWith(rule);
        });
        return { allowed, crawlDelay };
    }
    /**
     * Clear the robots.txt cache
     */
    clearCache() {
        this.cache.clear();
    }
}
exports.RobotsTxtChecker = RobotsTxtChecker;
/**
 * Retry logic with exponential backoff
 * Automatically retries failed operations with increasing delays
 */
class RetryHandler {
    constructor(maxRetries = 3, baseDelayMs = 1000) {
        this.maxRetries = maxRetries;
        this.baseDelay = baseDelayMs;
    }
    /**
     * Execute a function with retry logic
     * @param fn Function to execute
     * @param operationName Name for logging purposes
     * @returns Result of the function
     */
    async execute(fn, operationName) {
        let lastError = null;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                logger.debug(`Attempting ${operationName}`, { attempt, maxRetries: this.maxRetries });
                return await fn();
            }
            catch (error) {
                lastError = error;
                logger.warn(`${operationName} failed`, {
                    attempt,
                    maxRetries: this.maxRetries,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                // Don't wait after the last attempt
                if (attempt < this.maxRetries) {
                    const waitTime = this.baseDelay * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s, 4s
                    logger.debug(`Waiting before retry`, { waitTimeMs: waitTime });
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }
        // All attempts failed
        logger.error(`${operationName} failed after all retries`, {
            attempts: this.maxRetries,
            error: (lastError === null || lastError === void 0 ? void 0 : lastError.message) || 'Unknown error'
        });
        throw lastError || new Error(`Failed after ${this.maxRetries} attempts`);
    }
}
exports.RetryHandler = RetryHandler;
/**
 * Fetch with timeout and proper headers
 * Wrapper around fetch with best practices built-in
 */
async function safeFetch(url, options = {}) {
    const { timeoutMs = 30000 } = options, fetchOptions = __rest(options, ["timeoutMs"]);
    const headers = Object.assign({ 'User-Agent': exports.USER_AGENT, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'ja,en;q=0.9', 'Accept-Encoding': 'gzip, deflate' }, (fetchOptions.headers || {}));
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await (0, node_fetch_1.default)(url, Object.assign(Object.assign({}, fetchOptions), { headers, signal: controller.signal }));
        clearTimeout(timeoutId);
        return response;
    }
    catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}
//# sourceMappingURL=scraper-utils.js.map