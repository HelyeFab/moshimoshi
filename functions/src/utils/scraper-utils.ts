/**
 * Shared utilities for ethical web scraping (Firebase Functions version)
 * Implements rate limiting, robots.txt compliance, and retry logic
 */

import * as logger from 'firebase-functions/logger';
import fetch from 'node-fetch';

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

      // Fetch robots.txt with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(robotsUrl, {
        headers: {
          'User-Agent': USER_AGENT
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

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

      logger.info('robots.txt checked', {
        url: baseUrl,
        allowed: result.allowed,
        crawlDelay: result.crawlDelay
      });

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
  options: any & { timeoutMs?: number } = {}
): Promise<any> {
  const { timeoutMs = 30000, ...fetchOptions } = options;

  const headers = {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ja,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    ...(fetchOptions.headers || {})
  };

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Removes photo captions from Japanese news article content
 * Photo captions typically contain:
 * - Full-width equals sign (＝) for location/date/photographer info
 * - End with 撮影 (photography credit)
 * - Photographer names and dates
 *
 * Example: 「東京2025デフリンピック」開会式で行われたアーティスティックプログラム＝東京都渋谷区の東京体育館で2025年11月15日、西夏生撮影
 *
 * @param content - The article content to clean
 * @returns Content with photo captions removed
 */
export function removePhotoCaptions(content: string): string {
  if (!content) return content;

  // Pattern to match photo captions embedded in text
  // Format: text＝location/date/photographer撮影 nexttext
  // We want to remove from ＝ to 撮影 (inclusive)
  const captionPattern = /＝[^＝。]*?撮影\s*/g;

  const before = content;
  const cleaned = content.replace(captionPattern, '');

  // Log if we removed something
  if (before !== cleaned) {
    const matches = before.match(captionPattern);
    if (matches) {
      logger.debug('Removed photo caption(s)', {
        count: matches.length,
        examples: matches.slice(0, 2).map(m => m.substring(0, 80) + (m.length > 80 ? '...' : ''))
      });
    }
  }

  // Clean up any double spaces or leading/trailing whitespace
  return cleaned.replace(/\s+/g, ' ').trim();
}