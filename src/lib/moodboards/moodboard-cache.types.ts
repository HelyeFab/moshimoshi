/**
 * MoodBoard Cache Types
 * Types for offline caching of kanji moodboards
 */

import type { KanjiItem } from '@/types/moodboard'

export interface CachedMoodBoard {
  id: string
  title: string
  emoji: string
  jlpt: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  background: string
  description: string
  kanji: KanjiItem[]
  createdAt: string // ISO string
  updatedAt?: string // ISO string
  createdBy?: string
  isActive: boolean
  sortOrder?: number
}

export interface MoodBoardCacheEntry {
  moodBoard: CachedMoodBoard
  cachedAt: number // timestamp
  lastAccessedAt: number // timestamp
  accessCount: number
}

export interface MoodBoardCacheStats {
  totalCached: number
  totalSizeEstimate: number // rough byte estimate
  oldestEntry: number | null // timestamp
  newestEntry: number | null // timestamp
}

export const MOODBOARD_CACHE_CONFIG = {
  DB_NAME: 'moshimoshi-moodboard-cache',
  DB_VERSION: 1,
  STORE_NAME: 'moodboards',
  MAX_CACHED_BOARDS: 50, // All boards (typically ~15-20)
  MAX_AGE_MS: 30 * 24 * 60 * 60 * 1000, // 30 days (admin-controlled content changes rarely)
} as const
