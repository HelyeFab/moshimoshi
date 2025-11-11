/**
 * Shared utilities for ethical web scraping
 * Implements rate limiting, robots.txt compliance, and retry logic
 */

import * as logger from 'firebase-functions/logger';

// User-Agent string - generic browser to avoid bot detection
export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Rate limiter to prevent overwhelming target servers
 * Implements 1.5-2 second delays between requests
 */
export class RateLimiter {
  private lastRequestTime = 0;
  private minDelay: number;
  private maxDelay: number;

  constructor(minDelayMs = 1500, maxDelayMs = 2000) {
    this.minDelay = minDelayMs;
    this.maxDelay = maxDelayMs;
  }

  /**
   * Wait before making next request with randomized delay
   * Randomization helps avoid detection patterns
   */
  async wait(): Promise<void> {
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
  reset(): void {
    this.lastRequestTime = 0;
  }
}

/**
 * Simple robots.txt parser and validator
 * Checks if a URL is allowed to be scraped
 */
export class RobotsTxtChecker {
  private cache = new Map<string, { allowed: boolean; crawlDelay: number; timestamp: number }>();
  private cacheDuration = 1000 * 60 * 60 * 24; // 24 hours

  /**
   * Check if URL is allowed by robots.txt
   * @param url Full URL to check
   * @returns Object with allowed status and crawl delay
   */
  async canCrawl(url: string): Promise<{ allowed: boolean; crawlDelay: number }> {
    try {
      const urlObj = new URL(url);
      const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
      const robotsUrl = `${baseUrl}/robots.txt`;

      // Check cache first
      const cached = this.cache.get(baseUrl);
      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        return { allowed: cached.allowed, crawlDelay: cached.crawlDelay };
      }

      // Fetch robots.txt
      const response = await fetch(robotsUrl, {
        headers: {
          'User-Agent': USER_AGENT
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        // If robots.txt doesn't exist, assume allowed but use default delay
        logger.info('robots.txt not found, assuming allowed', { url: robotsUrl });
        const result = { allowed: true, crawlDelay: 1.5 };
        this.cache.set(baseUrl, { ...result, timestamp: Date.now() });
        return result;
      }

      const robotsTxt = await response.text();
      const result = this.parseRobotsTxt(robotsTxt, urlObj.pathname);

      // Cache the result
      this.cache.set(baseUrl, { ...result, timestamp: Date.now() });

      return result;
    } catch (error) {
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
  private parseRobotsTxt(content: string, pathname: string): { allowed: boolean; crawlDelay: number } {
    const lines = content.split('\n');
    let userAgentMatch = false;
    let disallowRules: string[] = [];
    let crawlDelay = 1.5; // Default delay

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();

      // Skip comments and empty lines
      if (trimmed.startsWith('#') || trimmed === '') continue;

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
          if (path) disallowRules.push(path);
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
      if (rule === '/') return true; // Disallow all
      return pathname.startsWith(rule);
    });

    return { allowed, crawlDelay };
  }

  /**
   * Clear the robots.txt cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Retry logic with exponential backoff
 * Automatically retries failed operations with increasing delays
 */
export class RetryHandler {
  private maxRetries: number;
  private baseDelay: number;

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
  async execute<T>(
    fn: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.debug(`Attempting ${operationName}`, { attempt, maxRetries: this.maxRetries });
        return await fn();
      } catch (error) {
        lastError = error as Error;
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
      error: lastError?.message || 'Unknown error'
    });
    throw lastError || new Error(`Failed after ${this.maxRetries} attempts`);
  }
}

/**
 * Fetch with timeout and proper headers
 * Wrapper around fetch with best practices built-in
 */
export async function safeFetch(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 30000, ...fetchOptions } = options;

  const headers = {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ja,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    ...(fetchOptions.headers || {})
  };

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    signal: AbortSignal.timeout(timeoutMs)
  });

  return response;
}

/**
 * Structured logging helper for scrapers
 */
export const scraperLogger = {
  info: (message: string, data?: Record<string, any>) => {
    if (typeof logger !== 'undefined' && logger.info) {
      logger.info(message, data);
    } else {
      console.log(`[INFO] ${message}`, data);
    }
  },

  warn: (message: string, data?: Record<string, any>) => {
    if (typeof logger !== 'undefined' && logger.warn) {
      logger.warn(message, data);
    } else {
      console.warn(`[WARN] ${message}`, data);
    }
  },

  error: (message: string, data?: Record<string, any>) => {
    if (typeof logger !== 'undefined' && logger.error) {
      logger.error(message, data);
    } else {
      console.error(`[ERROR] ${message}`, data);
    }
  },

  debug: (message: string, data?: Record<string, any>) => {
    if (typeof logger !== 'undefined' && logger.debug) {
      logger.debug(message, data);
    } else {
      console.debug(`[DEBUG] ${message}`, data);
    }
  }
};