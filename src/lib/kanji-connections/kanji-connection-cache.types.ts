/**
 * Kanji Connection Cache Types
 * Types for offline caching of kanji connection queries (families, radicals, SKIP)
 */

export type ConnectionType = 'family' | 'radical' | 'skip'

/**
 * Cached response from any kanji connection API
 * Generic structure to handle all three types
 */
export interface CachedConnectionResponse {
  /** Unique cache key: e.g., "family:water", "radical:fire", "skip:left-right" */
  cacheKey: string
  /** Connection type */
  type: ConnectionType
  /** The ID (family ID, radical ID, or SKIP pattern) */
  id: string
  /** Full API response data */
  data: any
  /** Query parameters used (for cache invalidation) */
  queryParams: {
    details?: boolean
    crossFamilies?: boolean
    subThemes?: boolean
    subcategories?: boolean
  }
}

export interface ConnectionCacheEntry {
  response: CachedConnectionResponse
  cachedAt: number // timestamp
  lastAccessedAt: number // timestamp
  accessCount: number
}

export interface ConnectionCacheStats {
  totalCached: number
  totalSizeEstimate: number // rough byte estimate
  oldestEntry: number | null // timestamp
  newestEntry: number | null // timestamp
  byType: {
    family: number
    radical: number
    skip: number
  }
}

export const CONNECTION_CACHE_CONFIG = {
  DB_NAME: 'moshimoshi-kanji-connection-cache',
  DB_VERSION: 1,
  STORE_NAME: 'connections',
  MAX_CACHED_ENTRIES: 100, // Covers all families + radicals + SKIP patterns
  MAX_AGE_MS: 30 * 24 * 60 * 60 * 1000, // 30 days (static content)
} as const

/**
 * All family IDs for prefetching
 */
export const ALL_FAMILY_IDS = [
  'water',
  'ice',
  'fire',
  'earth',
  'metal',
  'tree',
  'plant',
  'mountain',
  'sun',
  'moon',
  'rain',
  'stone',
  'human',
  'woman',
  'child',
  'hand',
  'mouth',
  'heart',
  'eye',
  'speech',
  'vehicle',
  'thread',
] as const

/**
 * All radical IDs for prefetching
 */
export const ALL_RADICAL_IDS = [
  'water',
  'fire',
  'tree',
  'person',
  'hand',
  'mouth',
  'heart',
  'movement',
  'metal',
  'earth',
  'plant',
] as const

/**
 * All SKIP patterns for prefetching
 */
export const ALL_SKIP_PATTERNS = ['left-right', 'up-down', 'enclosure', 'solid'] as const
