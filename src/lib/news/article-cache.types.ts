/**
 * Article Cache Types
 * Types for offline caching of news articles
 */

export interface CachedArticle {
  id: string
  title: string
  content: string
  summary: string
  url: string
  imageUrl?: string
  publishDate: string
  source: string
  category: string
  difficulty: string
  tags?: string[]
  metadata?: {
    wordCount?: number
    readingTime?: number
    hasFurigana?: boolean
  }
  // NHK audio
  nhkAudioUrl?: string
  // TTS audio
  generatedTitleAudioUrl?: string
  generatedSummaryAudioUrl?: string
  generatedContentAudioUrl?: string
  audioProvider?: 'edge-tts' | 'voicevox' | 'kokoro'
  audioVoice?: string
  audioStatus?: 'pending' | 'generated' | 'failed' | 'partial'
}

export interface ArticleCacheEntry {
  article: CachedArticle
  cachedAt: number // timestamp
  lastAccessedAt: number // timestamp
  accessCount: number
}

export interface ArticleCacheStats {
  totalCached: number
  totalSizeEstimate: number // rough byte estimate
  oldestEntry: number | null // timestamp
  newestEntry: number | null // timestamp
}

export const ARTICLE_CACHE_CONFIG = {
  DB_NAME: 'moshimoshi-article-cache',
  DB_VERSION: 1,
  STORE_NAME: 'articles',
  MAX_CACHED_ARTICLES: 50, // Keep last 50 articles
  MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const
