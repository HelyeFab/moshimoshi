/**
 * Unified Review History Types
 * Single collection for tracking ALL learning events across all content types
 */

import { Timestamp } from 'firebase/firestore'
import { ProgressEvent } from './progress.types'

/**
 * Learning mode for the review
 */
export type LearningMode =
  | 'recognition'    // Multiple choice
  | 'recall'        // Type the answer
  | 'writing'       // Write/draw the character
  | 'listening'     // Audio-based
  | 'speaking'      // Speech recognition

/**
 * Universal review history entry
 * Stored in: users/{userId}/review_history/{entryId}
 */
export interface ReviewHistoryEntry {
  // Entry metadata
  id?: string                  // Auto-generated entry ID
  userId: string               // User who performed the review

  // Content identification
  contentType: string          // 'kana', 'kanji', 'word', 'sentence', 'grammar'
  contentId: string            // Unique identifier for the content
  content: string              // The actual content (e.g., 'あ', '水', 'こんにちは')

  // Temporal data
  timestamp: Date | Timestamp  // When this event occurred
  sessionId?: string           // Links to learning session

  // Event details
  event: ProgressEvent         // Type of event
  correct?: boolean            // Whether answer was correct (for COMPLETED events)
  responseTime?: number        // Time to respond in milliseconds
  interactionType?: string     // 'audio', 'hint', 'flip' (for INTERACTED events)

  // Learning context
  mode?: LearningMode          // How the content was reviewed
  difficulty?: number          // Current SRS difficulty factor
  interval?: number            // Days until next review
  srsLevel?: number            // Current SRS level

  // User context
  deviceType?: 'mobile' | 'tablet' | 'desktop'
  appVersion?: string          // App version for debugging
  isPremium: boolean           // User's subscription status at time of event

  // Additional metadata
  metadata?: Record<string, any>  // Flexible field for content-specific data
}

/**
 * Aggregated statistics for a time period
 */
export interface ReviewHistoryStats {
  userId: string
  period: 'day' | 'week' | 'month' | 'all'
  startDate: Date
  endDate: Date

  // Counts
  totalEvents: number
  totalViews: number
  totalInteractions: number
  totalCompleted: number
  totalCorrect: number
  totalIncorrect: number

  // By content type
  byContentType: Record<string, {
    views: number
    interactions: number
    completed: number
    correct: number
    accuracy: number  // percentage
  }>

  // Performance metrics
  averageResponseTime: number  // milliseconds
  averageAccuracy: number      // percentage
  streakDays: number           // Consecutive days with activity

  // Learning patterns
  mostActiveHour: number       // 0-23
  mostProductiveHour: number   // Hour with highest accuracy
  problemAreas: Array<{
    contentType: string
    contentId: string
    content: string
    errorCount: number
    accuracy: number
  }>
}

/**
 * Query filters for review history
 */
export interface ReviewHistoryFilter {
  userId?: string
  contentType?: string
  contentId?: string
  event?: ProgressEvent
  correct?: boolean
  sessionId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  orderBy?: 'timestamp' | 'responseTime' | 'accuracy'
  orderDirection?: 'asc' | 'desc'
}

/**
 * Batch write entry for performance
 */
export interface ReviewHistoryBatch {
  entries: ReviewHistoryEntry[]
  sessionId: string
  timestamp: Date
}