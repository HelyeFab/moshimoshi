/**
 * Universal Progress Tracking Types
 * Item-agnostic progress tracking for all content types
 *
 * FIXED: Now uses ISO string types for dates and includes versioning
 */

import type { ISODateString, ISODateTimeString } from '@/lib/types/shared/timestamp.types'
import type { Versioned } from '@/lib/types/shared/versioned.types'

/**
 * Progress events that can occur during learning
 */
export enum ProgressEvent {
  VIEWED = 'viewed',           // User saw the item
  INTERACTED = 'interacted',   // User did something (typed, clicked, played audio)
  COMPLETED = 'completed',     // User finished with item (correct/incorrect)
  SKIPPED = 'skipped',         // User skipped item
  SESSION_START = 'session_start', // Session started
  SESSION_END = 'session_end'  // Session completed
}

/**
 * Status progression for any content
 */
export type ProgressStatus =
  | 'not-started'  // Never viewed
  | 'viewing'      // Seen but not interacted
  | 'learning'     // Actively practicing
  | 'learned'      // Marked as learned
  | 'mastered'     // Achieved mastery (21+ days, 90% accuracy)

/**
 * Metadata for progress events
 */
export interface ProgressEventMetadata {
  // Event context
  eventType: ProgressEvent
  timestamp: ISODateTimeString // FIXED: ISO datetime string
  sessionId?: string

  // Interaction details
  interactionType?: 'click' | 'type' | 'audio' | 'hint' | 'answer'
  correct?: boolean
  responseTime?: number // milliseconds

  // User context
  userId: string
  isPremium: boolean
  deviceType?: 'mobile' | 'tablet' | 'desktop'
}

/**
 * Universal progress data that extends ReviewableContent
 * FIXED: Now includes versioning and uses ISO strings
 */
export interface ReviewProgressData extends Versioned {
  // Content identification (from ReviewableContent)
  contentId: string
  contentType: string  // 'kana', 'kanji', 'word', 'sentence'

  // Status
  status: ProgressStatus

  // View tracking
  viewCount: number
  firstViewedAt: ISODateTimeString | null // FIXED: ISO datetime string
  lastViewedAt: ISODateTimeString | null // FIXED: ISO datetime string
  totalViewTime: number // milliseconds

  // Interaction tracking
  interactionCount: number
  correctCount: number
  incorrectCount: number
  lastInteractedAt: ISODateTimeString | null // FIXED: ISO datetime string

  // Learning metrics
  accuracy: number // 0-100 percentage
  streak: number   // Consecutive correct answers
  bestStreak: number

  // SRS integration (optional, depends on content)
  srsLevel: number | null
  nextReviewDate: ISODateString | null // FIXED: ISO date string
  easeFactor: number | null
  interval: number | null // days

  // User flags
  pinned: boolean
  bookmarked: boolean
  flaggedForReview: boolean

  // Metadata
  createdAt: ISODateTimeString // FIXED: ISO datetime string
  updatedAt: ISODateTimeString // FIXED: ISO datetime string (from Versioned)
  syncedAt: ISODateTimeString | null // FIXED: ISO datetime string

  // Versioning (from Versioned)
  version: number
}

/**
 * Session-level progress summary
 */
export interface ProgressSessionSummary {
  sessionId: string
  userId: string
  contentType: string

  // Session info
  startedAt: ISODateTimeString // FIXED: ISO datetime string
  endedAt: ISODateTimeString | null // FIXED: ISO datetime string
  duration: number // milliseconds

  // Items
  itemsViewed: string[]
  itemsInteracted: string[]
  itemsCompleted: string[]
  itemsSkipped: string[]

  // Metrics
  totalItems: number
  completionRate: number // percentage (0-100)
  accuracy: number       // percentage (0-100)
  averageResponseTime: number // milliseconds

  // Status
  completed: boolean
  syncedToCloud: boolean
}

/**
 * Progress update payload
 */
export interface ProgressUpdate {
  event: ProgressEvent
  metadata?: Partial<ProgressEventMetadata>
  delta?: Partial<ReviewProgressData>
}

/**
 * Batch progress update for efficiency
 */
export interface BatchProgressUpdate {
  contentType: string
  updates: Map<string, ProgressUpdate>
  sessionId?: string
}