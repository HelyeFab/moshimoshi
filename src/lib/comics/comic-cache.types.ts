/**
 * Comic Cache Types
 * Types for offline caching of comic episodes
 */

import type { JLPTLevel } from '@/types/kanji'
import type {
  ComicPanel,
  ComicVocabulary,
  CulturalNote,
  ComicQuiz,
  ComicEpisodeMetadata,
} from '@/types/comic'

export interface CachedComicEpisode {
  id: string
  seriesId: string
  slug: string
  episodeNumber: number
  displayNumber?: number // Sequential number shown to users
  title: string
  titleJa: string
  description: string
  descriptionJa: string
  coverImageUrl: string
  jlptLevel: JLPTLevel
  theme: string
  location: string
  panels: ComicPanel[]
  vocabulary: ComicVocabulary[]
  grammarPoints: string[]
  culturalNotes: CulturalNote[]
  quiz?: ComicQuiz
  metadata: ComicEpisodeMetadata
  status: 'draft' | 'review' | 'published' | 'archived'
  publishedAt?: string
  createdAt: string
  updatedAt?: string
  // Audio fields
  audioStatus?: 'pending' | 'generated' | 'failed' | 'partial' | 'complete'
  audioProvider?: string
  fullAudioUrl?: string
  // Stats
  viewCount?: number
  completionCount?: number
}

export interface ComicCacheEntry {
  episode: CachedComicEpisode
  cachedAt: number // timestamp
  lastAccessedAt: number // timestamp
  accessCount: number
}

export interface ComicCacheStats {
  totalCached: number
  totalSizeEstimate: number // rough byte estimate
  oldestEntry: number | null // timestamp
  newestEntry: number | null // timestamp
}

export const COMIC_CACHE_CONFIG = {
  DB_NAME: 'moshimoshi-comic-cache',
  DB_VERSION: 1,
  STORE_NAME: 'episodes',
  MAX_CACHED_EPISODES: 10, // Conservative - comics have images
  MAX_AGE_MS: 14 * 24 * 60 * 60 * 1000, // 14 days (weekly release)
} as const
