/**
 * Firestore collection schemas for the review system
 * Defines the structure of documents in review-related collections
 */

import { Timestamp } from 'firebase-admin/firestore'

/**
 * Content types supported by the review system
 */
export type ContentType = 'kana' | 'kanji' | 'vocabulary' | 'sentence' | 'phrase' | 'grammar' | 'custom'

/**
 * Review status for tracking learning progress
 */
export type ReviewStatus = 'new' | 'learning' | 'mastered'

/**
 * Priority levels for review items
 */
export type Priority = 'low' | 'normal' | 'high'

/**
 * Review set categories
 */
export type SetCategory = 'official' | 'custom' | 'shared'

/**
 * Session types for different review contexts
 */
export type SessionType = 'daily' | 'quick' | 'custom' | 'test'

/**
 * Device types for session tracking
 */
export type DeviceType = 'web' | 'mobile' | 'tablet'

/**
 * Review ordering strategies
 */
export type ReviewOrder = 'sequential' | 'random' | 'difficulty'

/**
 * Document schema for review_items collection
 * Represents individual items in a user's review queue
 */
export interface ReviewItemDocument {
  id: string                    // Auto-generated document ID
  userId: string                // User reference
  
  // Content reference
  contentType: ContentType
  contentId: string
  contentData: {                // Denormalized for performance
    primary: string
    secondary?: string
    tertiary?: string
    audioUrl?: string
    imageUrl?: string
  }
  
  // Review data
  status: ReviewStatus
  srsData: {
    interval: number           // Days until next review
    easeFactor: number         // 1.3 to 2.5
    repetitions: number        // Consecutive correct reviews
    lastReviewedAt: Timestamp | null
    nextReviewAt: Timestamp
  }
  
  // Statistics
  reviewCount: number
  correctCount: number
  incorrectCount: number
  streak: number
  bestStreak: number
  averageResponseTime?: number  // milliseconds
  
  // Organization
  tags: string[]
  setIds: string[]
  priority: Priority
  
  // Metadata
  pinnedAt: Timestamp
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
  version: number              // For optimistic locking
}

/**
 * Document schema for review_sets collection
 * Represents collections of review items
 */
export interface ReviewSetDocument {
  id: string
  userId: string
  name: string
  description: string
  category: SetCategory
  
  // Content
  itemIds: string[]
  itemCount: number            // Denormalized
  contentTypes: ContentType[]
  
  // Sharing
  isPublic: boolean
  sharedWith: string[]         // User IDs
  originalSetId?: string        // If cloned from another set
  
  // Progress (denormalized for performance)
  progress: {
    new: number
    learning: number
    mastered: number
  }
  
  // Settings
  dailyNewLimit: number
  dailyReviewLimit?: number
  reviewOrder: ReviewOrder
  
  // Metadata
  createdAt: Timestamp
  updatedAt: Timestamp
  lastAccessedAt: Timestamp
}

/**
 * Individual review item result within a session
 */
export interface ReviewItemResult {
  itemId: string
  correct: boolean
  responseTime: number         // milliseconds
  attemptCount: number
  confidence?: number          // 1-5 scale
  hintsUsed?: number
}

/**
 * Document schema for review_sessions collection
 * Represents individual review sessions
 */
export interface ReviewSessionDocument {
  id: string
  userId: string
  
  // Session info
  startedAt: Timestamp
  completedAt: Timestamp | null
  duration: number             // seconds
  pausedDuration?: number      // seconds spent paused
  
  // Items reviewed
  itemsReviewed: ReviewItemResult[]
  
  // Statistics
  totalItems: number
  correctItems: number
  incorrectItems: number
  accuracy: number             // 0.0 to 1.0
  avgResponseTime: number      // milliseconds
  
  // Context
  sessionType: SessionType
  setId?: string               // If reviewing a specific set
  deviceType: DeviceType
  isCompleted: boolean
  
  // Additional metrics
  streakBroken?: boolean       // If user broke their streak
  newItemsIntroduced?: number
  itemsMastered?: number
  
  // User feedback
  rating?: number              // 1-5 stars
  feedback?: string
}

/**
 * Document schema for review_statistics collection
 * Aggregated statistics per user
 */
export interface ReviewStatisticsDocument {
  id: string                   // Same as userId for easy lookup
  userId: string
  
  // Overall statistics
  totalReviews: number
  totalCorrect: number
  totalIncorrect: number
  overallAccuracy: number      // 0.0 to 1.0
  
  // Streaks
  currentStreak: number
  bestStreak: number
  lastReviewDate: Timestamp
  
  // Progress
  totalItems: number
  newItems: number
  learningItems: number
  masteredItems: number
  
  // By content type
  statsByType: Record<ContentType, {
    total: number
    new: number
    learning: number
    mastered: number
    accuracy: number
  }>
  
  // Time-based stats
  dailyAverage: number         // Reviews per day
  weeklyAverage: number        // Reviews per week
  totalTimeSpent: number       // seconds
  averageSessionTime: number   // seconds
  
  // Achievements
  achievementsUnlocked: string[]
  level: number
  experience: number
  
  // Metadata
  firstReviewAt: Timestamp
  updatedAt: Timestamp
}

/**
 * Document schema for pinned_items collection
 * Tracks items manually pinned by users
 */
export interface PinnedItemDocument {
  id: string
  userId: string
  contentType: ContentType
  contentId: string
  
  // Pinning metadata
  pinnedAt: Timestamp
  priority: Priority
  tags: string[]
  setId?: string
  
  // Release schedule
  releaseSchedule?: 'immediate' | 'gradual'
  scheduledReleaseDate?: Timestamp
  releasedAt?: Timestamp
  
  // Review item reference
  reviewItemId?: string        // Link to review_items document
  
  // Metadata
  createdAt: Timestamp
  updatedAt: Timestamp
}

/**
 * Document schema for review_presets collection
 * Pre-configured review sets (system-provided)
 */
export interface ReviewPresetDocument {
  id: string
  name: string
  description: string
  category: string             // E.g., "JLPT", "Common", "Beginner"
  
  // Content definition
  contentFilters: {
    contentTypes: ContentType[]
    tags?: string[]
    difficultyRange?: {
      min: number
      max: number
    }
    sources?: string[]
  }
  
  // Pre-selected items (optional)
  itemIds?: string[]
  
  // Settings
  defaultDailyLimit: number
  recommendedOrder: ReviewOrder
  
  // Metadata
  icon?: string
  color?: string
  sortOrder: number
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

/**
 * Helper type for Firestore timestamps
 */
export type FirestoreTimestamp = Timestamp | Date | null

/**
 * Helper function to convert Date to Timestamp
 */
export function toTimestamp(date: Date | null): Timestamp | null {
  return date ? Timestamp.fromDate(date) : null
}

/**
 * Helper function to convert Timestamp to Date
 */
export function fromTimestamp(timestamp: Timestamp | null): Date | null {
  return timestamp ? timestamp.toDate() : null
}