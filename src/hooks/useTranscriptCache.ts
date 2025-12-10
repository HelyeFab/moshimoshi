'use client';

import { useState, useCallback, useEffect } from 'react';

interface TranscriptLine {
  id?: string;
  text: string;
  startTime: number;
  endTime: number;
  words?: string[];
  translation?: string;
}

interface CachedTranscript {
  transcript: TranscriptLine[];
  formattedTranscript?: TranscriptLine[];
  videoTitle?: string;
  videoMetadata?: any;
  language?: string;
  cachedAt: number;
  method?: string;
}

interface TranscriptCacheConfig {
  ttlMs?: number;           // Time-to-live in milliseconds (default: 30 minutes)
  maxEntries?: number;      // Maximum number of cached transcripts (default: 20)
  storageKey?: string;      // localStorage key prefix (default: 'moshi_transcript_')
}

const DEFAULT_CONFIG: Required<TranscriptCacheConfig> = {
  ttlMs: 30 * 60 * 1000,        // 30 minutes
  maxEntries: 20,
  storageKey: 'moshi_transcript_',
};

/**
 * Client-side transcript caching hook
 * Uses localStorage for persistence across page reloads
 * Implements LRU eviction when maxEntries is exceeded
 */
export function useTranscriptCache(config: TranscriptCacheConfig = {}) {
  const { ttlMs, maxEntries, storageKey } = { ...DEFAULT_CONFIG, ...config };

  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      cleanupExpiredEntries();
      setIsInitialized(true);
    }
  }, []);

  /**
   * Get cache key for a video ID
   */
  const getCacheKey = useCallback((videoId: string): string => {
    return `${storageKey}${videoId}`;
  }, [storageKey]);

  /**
   * Get all cache keys from localStorage
   */
  const getAllCacheKeys = useCallback((): string[] => {
    if (typeof window === 'undefined') return [];

    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(storageKey)) {
        keys.push(key);
      }
    }
    return keys;
  }, [storageKey]);

  /**
   * Remove expired entries from cache
   */
  const cleanupExpiredEntries = useCallback((): void => {
    if (typeof window === 'undefined') return;

    const now = Date.now();
    const keys = getAllCacheKeys();

    keys.forEach(key => {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          const cached: CachedTranscript = JSON.parse(item);
          if (now - cached.cachedAt > ttlMs) {
            localStorage.removeItem(key);
            console.debug(`[TranscriptCache] Removed expired entry: ${key}`);
          }
        }
      } catch (e) {
        // Remove corrupted entries
        localStorage.removeItem(key);
      }
    });
  }, [getAllCacheKeys, ttlMs]);

  /**
   * Enforce max entries limit using LRU eviction
   */
  const enforceCacheLimit = useCallback((): void => {
    if (typeof window === 'undefined') return;

    const keys = getAllCacheKeys();
    if (keys.length < maxEntries) return;

    // Get all entries with their timestamps
    const entries: { key: string; cachedAt: number }[] = [];
    keys.forEach(key => {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          const cached: CachedTranscript = JSON.parse(item);
          entries.push({ key, cachedAt: cached.cachedAt });
        }
      } catch (e) {
        // Remove corrupted entries
        localStorage.removeItem(key);
      }
    });

    // Sort by cachedAt (oldest first) and remove oldest entries
    entries.sort((a, b) => a.cachedAt - b.cachedAt);
    const entriesToRemove = entries.slice(0, entries.length - maxEntries + 1);

    entriesToRemove.forEach(entry => {
      localStorage.removeItem(entry.key);
      console.debug(`[TranscriptCache] LRU evicted: ${entry.key}`);
    });
  }, [getAllCacheKeys, maxEntries]);

  /**
   * Get cached transcript for a video
   */
  const get = useCallback((videoId: string): CachedTranscript | null => {
    if (typeof window === 'undefined') return null;

    const key = getCacheKey(videoId);
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const cached: CachedTranscript = JSON.parse(item);

      // Check if expired
      if (Date.now() - cached.cachedAt > ttlMs) {
        localStorage.removeItem(key);
        console.debug(`[TranscriptCache] Entry expired: ${videoId}`);
        return null;
      }

      console.debug(`[TranscriptCache] Cache hit: ${videoId}`);
      return cached;
    } catch (e) {
      console.error('[TranscriptCache] Error reading cache:', e);
      localStorage.removeItem(key);
      return null;
    }
  }, [getCacheKey, ttlMs]);

  /**
   * Set cached transcript for a video
   */
  const set = useCallback((
    videoId: string,
    data: Omit<CachedTranscript, 'cachedAt'>
  ): boolean => {
    if (typeof window === 'undefined') return false;

    const key = getCacheKey(videoId);
    try {
      // Enforce cache limit before adding
      enforceCacheLimit();

      const cached: CachedTranscript = {
        ...data,
        cachedAt: Date.now(),
      };

      localStorage.setItem(key, JSON.stringify(cached));
      console.debug(`[TranscriptCache] Cached: ${videoId} (${data.transcript.length} segments)`);
      return true;
    } catch (e) {
      // localStorage might be full
      console.error('[TranscriptCache] Error setting cache:', e);

      // Try to free space by removing oldest entries
      try {
        cleanupExpiredEntries();
        enforceCacheLimit();
        localStorage.setItem(key, JSON.stringify({ ...data, cachedAt: Date.now() }));
        return true;
      } catch (retryError) {
        console.error('[TranscriptCache] Failed to cache after cleanup:', retryError);
        return false;
      }
    }
  }, [getCacheKey, enforceCacheLimit, cleanupExpiredEntries]);

  /**
   * Remove cached transcript for a video
   */
  const remove = useCallback((videoId: string): void => {
    if (typeof window === 'undefined') return;

    const key = getCacheKey(videoId);
    localStorage.removeItem(key);
    console.debug(`[TranscriptCache] Removed: ${videoId}`);
  }, [getCacheKey]);

  /**
   * Clear all cached transcripts
   */
  const clearAll = useCallback((): void => {
    if (typeof window === 'undefined') return;

    const keys = getAllCacheKeys();
    keys.forEach(key => localStorage.removeItem(key));
    console.debug(`[TranscriptCache] Cleared ${keys.length} entries`);
  }, [getAllCacheKeys]);

  /**
   * Get cache statistics
   */
  const getStats = useCallback((): {
    entryCount: number;
    totalSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } => {
    if (typeof window === 'undefined') {
      return { entryCount: 0, totalSize: 0, oldestEntry: null, newestEntry: null };
    }

    const keys = getAllCacheKeys();
    let totalSize = 0;
    let oldestEntry: number | null = null;
    let newestEntry: number | null = null;

    keys.forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        totalSize += item.length * 2; // UTF-16 characters = 2 bytes each
        try {
          const cached: CachedTranscript = JSON.parse(item);
          if (oldestEntry === null || cached.cachedAt < oldestEntry) {
            oldestEntry = cached.cachedAt;
          }
          if (newestEntry === null || cached.cachedAt > newestEntry) {
            newestEntry = cached.cachedAt;
          }
        } catch (e) {
          // Ignore corrupted entries
        }
      }
    });

    return {
      entryCount: keys.length,
      totalSize,
      oldestEntry,
      newestEntry,
    };
  }, [getAllCacheKeys]);

  return {
    get,
    set,
    remove,
    clearAll,
    getStats,
    isInitialized,
  };
}

/**
 * Extract video ID from YouTube URL
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /embed\/([a-zA-Z0-9_-]{11})/,
    /shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}
