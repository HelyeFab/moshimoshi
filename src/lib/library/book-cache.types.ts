/**
 * Book Cache Types
 * Types for offline caching of library books
 */

import type { JLPTLevel } from '@/types/book'

export interface CachedBook {
  id: string
  title: string
  titleJa: string
  bookName: string
  author?: string
  content: string
  summary: string
  coverImageUrl?: string
  audioUrl?: string
  jlptLevel: JLPTLevel
  category?: string
  tags?: string[]
  createdAt: string
  updatedAt?: string
  status: 'draft' | 'published'
  viewCount?: number
  readCount?: number
  metadata?: {
    wordCount?: number
    readingTime?: number
    originalBookIsbn?: string
    generationModel?: string
    coverGenerated?: boolean
    audioCached?: boolean
    audioGeneratedAt?: string
  }
}

export interface BookCacheEntry {
  book: CachedBook
  cachedAt: number // timestamp
  lastAccessedAt: number // timestamp
  accessCount: number
}

export interface BookCacheStats {
  totalCached: number
  totalSizeEstimate: number // rough byte estimate
  oldestEntry: number | null // timestamp
  newestEntry: number | null // timestamp
}

export const BOOK_CACHE_CONFIG = {
  DB_NAME: 'moshimoshi-book-cache',
  DB_VERSION: 1,
  STORE_NAME: 'books',
  MAX_CACHED_BOOKS: 30, // Keep last 30 books
  MAX_AGE_MS: 14 * 24 * 60 * 60 * 1000, // 14 days (books change less frequently)
} as const
