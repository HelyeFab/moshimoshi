/**
 * Story Cache Types
 * Types for offline caching of AI stories
 */

import type { JLPTLevel, StoryPage, StoryQuizQuestion } from '@/types/story'

export interface CachedStory {
  id: string
  title: string
  titleJa: string
  description: string
  jlptLevel: JLPTLevel
  theme: string
  tags: string[]
  coverImageUrl?: string
  pages: StoryPage[]
  quiz?: StoryQuizQuestion[]
  slug: string

  // Metadata (converted to ISO strings)
  authorId: string
  createdAt: string
  updatedAt: string
  publishedAt?: string
  status: 'draft' | 'published' | 'archived'

  // Stats
  viewCount: number
  completionCount: number
  averageQuizScore?: number

  // SEO
  seoTitle?: string
  seoDescription?: string

  // Mood Board Reference
  moodBoardId?: string
  moodBoardTitle?: string
  moodBoardKanji?: string[]

  // AI Generation Metadata
  isAIGenerated?: boolean
  aiModel?: string

  // Audio
  fullAudioUrl?: string
  audioGeneratedAt?: string
  audioProvider?: 'voicevox' | 'openai' | 'elevenlabs'
  audioVoice?: string
  audioStatus?: 'pending' | 'generating' | 'complete' | 'partial' | 'failed'
}

export interface StoryCacheEntry {
  story: CachedStory
  cachedAt: number // timestamp
  lastAccessedAt: number // timestamp
  accessCount: number
}

export interface StoryCacheStats {
  totalCached: number
  totalSizeEstimate: number // rough byte estimate
  oldestEntry: number | null // timestamp
  newestEntry: number | null // timestamp
}

export const STORY_CACHE_CONFIG = {
  DB_NAME: 'moshimoshi-story-cache',
  DB_VERSION: 1,
  STORE_NAME: 'stories',
  MAX_CACHED_STORIES: 20, // Keep last 20 stories (stories are larger due to pages)
  MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const
