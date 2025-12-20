/**
 * Tatoeba Cache Types
 * Types for offline caching of Tatoeba example sentences by kanji
 */

import { TatoebaSentence } from '@/utils/tatoeba-client'

/**
 * Cached data for a single kanji's Tatoeba sentences
 */
export interface CachedTatoebaData {
  /** The kanji character this cache entry is for */
  kanji: string
  /** Array of Tatoeba sentences containing this kanji */
  sentences: TatoebaSentence[]
  /** Map of Japanese text to furigana-annotated HTML */
  furiganaTexts: Record<string, string>
}

/**
 * Cache entry wrapper with metadata
 */
export interface TatoebaCacheEntry {
  data: CachedTatoebaData
  cachedAt: number // timestamp
  lastAccessedAt: number // timestamp
  accessCount: number
}

/**
 * Cache statistics
 */
export interface TatoebaCacheStats {
  totalCached: number
  totalSizeEstimate: number // rough byte estimate
  oldestEntry: number | null // timestamp
  newestEntry: number | null // timestamp
}

/**
 * Cache configuration
 */
export const TATOEBA_CACHE_CONFIG = {
  DB_NAME: 'moshimoshi-tatoeba-cache',
  DB_VERSION: 1,
  STORE_NAME: 'sentences',
  MAX_CACHED_KANJI: 200, // Keep sentences for last 200 kanji
  MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  DEFAULT_SENTENCE_LIMIT: 2, // Number of sentences to fetch per kanji
} as const
