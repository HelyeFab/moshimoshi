/**
 * Cache Manager for AI Service
 * Handles caching of AI responses for improved performance and cost reduction
 */

import { CacheEntry } from '../types';

export class CacheManager {
  private cache: Map<string, CacheEntry>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.cache = new Map();
    this.startCleanupInterval();
  }

  /**
   * Get cached value
   */
  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count
    entry.hits++;

    console.log(`📦 Cache hit for key: ${key} (hits: ${entry.hits})`);
    return entry.data;
  }

  /**
   * Set cache value
   */
  async set(
    key: string,
    data: any,
    durationSeconds: number,
    metadata?: any
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationSeconds * 1000);

    const entry: CacheEntry = {
      key,
      data,
      timestamp: now,
      expiresAt,
      hits: 0,
      metadata
    };

    this.cache.set(key, entry);
    console.log(`💾 Cached result for key: ${key} (expires: ${expiresAt.toISOString()})`);
  }

  /**
   * Delete cache entry
   */
  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  /**
   * Clear cache (with optional pattern matching)
   */
  async clear(pattern?: string): Promise<void> {
    if (!pattern) {
      this.cache.clear();
      console.log('🗑️ Cleared entire cache');
      return;
    }

    // Clear entries matching pattern
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`🗑️ Cleared ${keysToDelete.length} cache entries matching pattern: ${pattern}`);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    entries: Array<{
      key: string;
      hits: number;
      age: number;
      expiresIn: number;
    }>;
    totalHits: number;
    memoryUsage: number;
  } {
    const now = new Date();
    const entries: Array<any> = [];
    let totalHits = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now.getTime() - entry.timestamp.getTime();
      const expiresIn = entry.expiresAt.getTime() - now.getTime();

      entries.push({
        key,
        hits: entry.hits,
        age: Math.floor(age / 1000), // in seconds
        expiresIn: Math.floor(expiresIn / 1000) // in seconds
      });

      totalHits += entry.hits;
    }

    // Estimate memory usage (rough)
    const memoryUsage = JSON.stringify(Array.from(this.cache.values())).length;

    return {
      size: this.cache.size,
      entries: entries.sort((a, b) => b.hits - a.hits), // Sort by hits
      totalHits,
      memoryUsage
    };
  }

  /**
   * Start cleanup interval to remove expired entries
   */
  private startCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 5 * 60 * 1000);
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired cache entries`);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test basic operations
      const testKey = 'health_check_test';
      await this.set(testKey, { test: true }, 1, {});
      const result = await this.get(testKey);
      await this.delete(testKey);

      return result !== null;
    } catch (error) {
      console.error('Cache health check failed:', error);
      return false;
    }
  }

  /**
   * Destroy cache manager
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }

  /**
   * Get most frequently accessed entries
   */
  getHotEntries(limit: number = 10): Array<{
    key: string;
    hits: number;
    data: any;
  }> {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        hits: entry.hits,
        data: entry.data
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit);

    return entries;
  }

  /**
   * Preload cache with common requests
   */
  async preload(entries: Array<{
    key: string;
    data: any;
    duration: number;
  }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.data, entry.duration);
    }
    console.log(`⚡ Preloaded ${entries.length} cache entries`);
  }

  /**
   * Export cache for persistence
   */
  export(): Array<CacheEntry> {
    return Array.from(this.cache.values());
  }

  /**
   * Import cache from persistence
   */
  import(entries: Array<CacheEntry>): void {
    const now = new Date();
    let imported = 0;

    for (const entry of entries) {
      // Only import non-expired entries
      if (new Date(entry.expiresAt) > now) {
        this.cache.set(entry.key, entry);
        imported++;
      }
    }

    console.log(`📥 Imported ${imported} cache entries`);
  }
}