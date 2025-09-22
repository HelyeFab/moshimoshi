interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expires: number;
}

interface PracticeCacheData {
  commonWords: any[];
  verbs: any[];
  adjectives: any[];
}

export class PracticeCache {
  private static readonly CACHE_KEY = 'moshimoshi_practice_cache';
  private static readonly DEFAULT_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly CACHE_VERSION = '1.0';

  /**
   * Get cached data if available and not expired
   */
  static get<T>(key: keyof PracticeCacheData): T | null {
    try {
      const cacheString = localStorage.getItem(this.CACHE_KEY);
      if (!cacheString) return null;

      const cache = JSON.parse(cacheString);

      // Check cache version
      if (cache.version !== this.CACHE_VERSION) {
        this.clear();
        return null;
      }

      const entry: CacheEntry<T> = cache.data[key];
      if (!entry) return null;

      // Check if expired
      if (Date.now() > entry.expires) {
        this.delete(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      // Error reading from practice cache
      this.clear(); // Clear corrupted cache
      return null;
    }
  }

  /**
   * Set cached data with expiration
   */
  static set<T>(key: keyof PracticeCacheData, data: T, duration: number = this.DEFAULT_CACHE_DURATION): void {
    try {
      const cacheString = localStorage.getItem(this.CACHE_KEY);
      let cache: {
        version: string;
        data: { [K in keyof PracticeCacheData]?: CacheEntry<PracticeCacheData[K]> };
      } = {
        version: this.CACHE_VERSION,
        data: {}
      };

      if (cacheString) {
        try {
          cache = JSON.parse(cacheString);
          if (cache.version !== this.CACHE_VERSION) {
            cache = {
              version: this.CACHE_VERSION,
              data: {}
            };
          }
        } catch (parseError) {
          // Error parsing cache, creating new cache
        }
      }

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        expires: Date.now() + duration
      };

      (cache.data as any)[key] = entry;
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));

    } catch (error) {
      // Error writing to practice cache
    }
  }

  /**
   * Delete specific cache entry
   */
  static delete(key: keyof PracticeCacheData): void {
    try {
      const cacheString = localStorage.getItem(this.CACHE_KEY);
      if (!cacheString) return;

      const cache = JSON.parse(cacheString);
      if (cache.data && cache.data[key]) {
        delete cache.data[key];
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
      }
    } catch (error) {
      // Error deleting from practice cache
    }
  }

  /**
   * Clear all cache
   */
  static clear(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY);
    } catch (error) {
      // Error clearing practice cache
    }
  }

  /**
   * Get cache info for debugging
   */
  static getCacheInfo(): any {
    try {
      const cacheString = localStorage.getItem(this.CACHE_KEY);
      if (!cacheString) return null;

      const cache = JSON.parse(cacheString);
      const info: any = {
        version: cache.version,
        entries: {}
      };

      for (const [key, entry] of Object.entries(cache.data || {})) {
        const typedEntry = entry as CacheEntry<any>;
        info.entries[key] = {
          itemCount: Array.isArray(typedEntry.data) ? typedEntry.data.length : 'N/A',
          cachedAt: new Date(typedEntry.timestamp).toLocaleString(),
          expiresAt: new Date(typedEntry.expires).toLocaleString(),
          isExpired: Date.now() > typedEntry.expires,
          sizeKB: Math.round(JSON.stringify(typedEntry.data).length / 1024)
        };
      }

      return info;
    } catch (error) {
      // Error getting cache info
      return null;
    }
  }

  /**
   * Check if cache entry exists and is valid
   */
  static isValid(key: keyof PracticeCacheData): boolean {
    return this.get(key) !== null;
  }

  /**
   * Get cache size in KB
   */
  static getCacheSize(): number {
    try {
      const cacheString = localStorage.getItem(this.CACHE_KEY);
      if (!cacheString) return 0;
      return Math.round(cacheString.length / 1024);
    } catch (error) {
      return 0;
    }
  }
}

export default PracticeCache;