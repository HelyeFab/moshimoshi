/**
 * Type definitions for the Pinning System
 */

import { ReviewableContentWithSRS } from '../core/interfaces'

/**
 * Priority levels for pinned items
 */
export type PinPriority = 'low' | 'normal' | 'high'

/**
 * Release schedule strategies
 */
export type ReleaseSchedule = 'immediate' | 'gradual'

/**
 * Options for pinning operations
 */
export interface PinOptions {
  /**
   * Priority level for review ordering
   */
  priority?: PinPriority
  
  /**
   * Tags to associate with pinned items
   */
  tags?: string[]
  
  /**
   * Review set ID to add items to
   */
  setId?: string
  
  /**
   * Release schedule strategy
   */
  releaseSchedule?: ReleaseSchedule
  
  /**
   * Maximum items to release per day (for gradual release)
   */
  dailyLimit?: number
  
  /**
   * Start date for gradual release
   */
  releaseStartDate?: Date
}

/**
 * Represents a pinned item with metadata
 */
export interface PinnedItem {
  /**
   * Unique identifier
   */
  id: string
  
  /**
   * User ID who pinned the item
   */
  userId: string
  
  /**
   * Content type
   */
  contentType: string
  
  /**
   * Content ID reference
   */
  contentId: string
  
  /**
   * Denormalized content data for performance
   */
  contentData?: {
    primary: string
    secondary?: string
    tertiary?: string
    audioUrl?: string
    imageUrl?: string
  }
  
  /**
   * When item was pinned
   */
  pinnedAt: Date
  
  /**
   * Priority level
   */
  priority: PinPriority
  
  /**
   * Associated tags
   */
  tags: string[]
  
  /**
   * Review set IDs this item belongs to
   */
  setIds: string[]
  
  /**
   * Whether item is currently active for review
   */
  isActive: boolean
  
  /**
   * Scheduled release date (for gradual release)
   */
  scheduledReleaseDate?: Date
  
  /**
   * Number of times reviewed while pinned
   */
  reviewCount: number
  
  /**
   * Last review date
   */
  lastReviewedAt?: Date
  
  /**
   * SRS data reference
   */
  srsDataId?: string
  
  /**
   * Review status for tracking learning progress
   */
  status?: 'new' | 'learning' | 'review' | 'mastered'
  
  /**
   * SRS (Spaced Repetition System) data
   */
  srsData?: {
    interval: number           // Days until next review
    easeFactor: number         // 1.3 to 2.5
    repetitions: number        // Consecutive correct reviews
    lastReviewedAt: Date | null
    nextReviewAt: Date
  }
  
  /**
   * Next scheduled review date (convenience field from srsData)
   */
  nextReviewAt?: Date
  
  /**
   * Statistics
   */
  correctCount?: number
  incorrectCount?: number
  streak?: number
  bestStreak?: number
  averageResponseTime?: number  // milliseconds
  
  /**
   * Difficulty rating (0.0 to 1.0)
   */
  difficulty?: number
  
  /**
   * Version for optimistic locking
   */
  version: number
}

/**
 * Bulk pin operation result
 */
export interface BulkPinResult {
  /**
   * Successfully pinned items
   */
  succeeded: PinnedItem[]
  
  /**
   * Failed items with reasons
   */
  failed: Array<{
    contentId: string
    reason: string
  }>
  
  /**
   * Total items processed
   */
  total: number
  
  /**
   * Items that were already pinned
   */
  alreadyPinned: string[]
}

/**
 * Release schedule entry
 */
export interface ReleaseScheduleEntry {
  /**
   * Item ID
   */
  itemId: string
  
  /**
   * Scheduled release date
   */
  releaseDate: Date
  
  /**
   * Batch number for grouping
   */
  batchNumber: number
  
  /**
   * Whether item has been released
   */
  released: boolean
}

/**
 * Pin statistics
 */
export interface PinStatistics {
  /**
   * Total pinned items
   */
  totalPinned: number
  
  /**
   * Items by priority
   */
  byPriority: {
    low: number
    normal: number
    high: number
  }
  
  /**
   * Items by content type
   */
  byContentType: Record<string, number>
  
  /**
   * Active items available for review
   */
  activeItems: number
  
  /**
   * Items scheduled for future release
   */
  scheduledItems: number
  
  /**
   * Average reviews per pinned item
   */
  avgReviewsPerItem: number
  
  /**
   * Most recent pin date
   */
  lastPinnedAt?: Date
}

/**
 * Pin manager configuration
 */
export interface PinManagerConfig {
  /**
   * Maximum items that can be pinned per user
   */
  maxPinnedItems?: number
  
  /**
   * Default priority for new pins
   */
  defaultPriority?: PinPriority
  
  /**
   * Default daily limit for gradual release
   */
  defaultDailyLimit?: number
  
  /**
   * Whether to auto-activate pinned items
   */
  autoActivate?: boolean
  
  /**
   * Cache TTL in seconds
   */
  cacheTTL?: number
}

/**
 * Events emitted by the pin manager
 */
export interface PinEvents {
  /**
   * Emitted when items are pinned
   */
  'items:pinned': {
    userId: string
    items: PinnedItem[]
    options: PinOptions
  }
  
  /**
   * Emitted when items are unpinned
   */
  'items:unpinned': {
    userId: string
    itemIds: string[]
  }
  
  /**
   * Emitted when items are released from schedule
   */
  'items:released': {
    userId: string
    items: PinnedItem[]
  }
  
  /**
   * Emitted when pin statistics change
   */
  'stats:updated': {
    userId: string
    stats: PinStatistics
  }
}