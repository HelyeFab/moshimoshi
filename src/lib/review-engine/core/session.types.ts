/**
 * Session-related types for the Universal Review Engine
 * Defines review sessions, items, and statistics
 */

import { ReviewableContent } from './interfaces'
import { ReviewMode, SessionStatus, SessionSource } from './types'
import { ReviewModeConfig } from './types'

/**
 * Represents a single review session
 */
export interface ReviewSession {
  // Identification
  /**
   * Unique session identifier
   */
  id: string
  
  /**
   * User identifier
   */
  userId: string
  
  // Timing
  /**
   * When the session started
   */
  startedAt: Date
  
  /**
   * When the session ended (if completed/abandoned)
   */
  endedAt?: Date
  
  /**
   * Last activity timestamp for timeout detection
   */
  lastActivityAt: Date
  
  // Content
  /**
   * All items in this session
   */
  items: ReviewSessionItem[]
  
  /**
   * Current position in the items array
   */
  currentIndex: number
  
  // Configuration
  /**
   * Review mode for this session
   */
  mode: ReviewMode
  
  /**
   * Configuration for the review mode
   */
  config: ReviewModeConfig
  
  // State
  /**
   * Current session status
   */
  status: SessionStatus
  
  // Metadata
  /**
   * How this session was initiated
   */
  source: SessionSource
  
  /**
   * Tags for categorization
   */
  tags?: string[]
  
  /**
   * Custom metadata
   */
  metadata?: Record<string, any>
  
  /**
   * Session statistics
   */
  stats?: SessionStatistics
}

/**
 * Represents a single item within a review session
 */
export interface ReviewSessionItem {
  // Reference
  /**
   * The content being reviewed
   */
  content: ReviewableContent
  
  // Timing
  /**
   * When this item was shown to the user
   */
  presentedAt: Date
  
  /**
   * When the user answered (if they did)
   */
  answeredAt?: Date
  
  /**
   * Time taken to answer in milliseconds
   */
  responseTime?: number
  
  // Response
  /**
   * The user's answer
   */
  userAnswer?: string
  
  /**
   * Whether the answer was correct
   */
  correct?: boolean
  
  /**
   * User's confidence rating (1-5 scale)
   */
  confidence?: 1 | 2 | 3 | 4 | 5
  
  // Hints used
  /**
   * Number of hints used for this item
   */
  hintsUsed: number
  
  // Attempts (if retry allowed)
  /**
   * Number of attempts made
   */
  attempts: number
  
  // Score calculation
  /**
   * Base score before modifiers
   */
  baseScore: number
  
  /**
   * Final score after all modifiers
   */
  finalScore: number
  
  // For spaced repetition
  /**
   * Previous interval in days
   */
  previousInterval?: number
  
  /**
   * Next scheduled interval in days
   */
  nextInterval?: number
  
  /**
   * Ease factor for SuperMemo algorithm
   */
  easeFactor?: number
  
  // Additional data
  /**
   * Any validation errors or warnings
   */
  validationFeedback?: string
  
  /**
   * Whether this item was skipped
   */
  skipped?: boolean
}

/**
 * Statistics for a review session
 */
export interface SessionStatistics {
  /**
   * Session identifier
   */
  sessionId: string
  
  // Counts
  /**
   * Total number of items in session
   */
  totalItems: number
  
  /**
   * Number of items completed
   */
  completedItems: number
  
  /**
   * Number of correct answers
   */
  correctItems: number
  
  /**
   * Number of incorrect answers
   */
  incorrectItems: number
  
  /**
   * Number of skipped items
   */
  skippedItems: number
  
  // Performance
  /**
   * Accuracy as a percentage (0-100)
   */
  accuracy: number
  
  /**
   * Average response time in milliseconds
   */
  averageResponseTime: number
  
  /**
   * Total time spent in milliseconds
   */
  totalTime: number
  
  // Streaks
  /**
   * Current streak of correct answers
   */
  currentStreak: number
  
  /**
   * Best streak in this session
   */
  bestStreak: number
  
  // By difficulty
  /**
   * Performance breakdown by difficulty level
   */
  performanceByDifficulty: {
    easy: { correct: number; total: number; avgTime: number }
    medium: { correct: number; total: number; avgTime: number }
    hard: { correct: number; total: number; avgTime: number }
  }
  
  // By mode
  /**
   * Performance breakdown by review mode (if mixed session)
   */
  performanceByMode?: {
    [key in ReviewMode]?: {
      correct: number
      total: number
      avgTime: number
    }
  }
  
  // Score
  /**
   * Total score earned
   */
  totalScore: number
  
  /**
   * Maximum possible score
   */
  maxPossibleScore: number
  
  // Hints
  /**
   * Total hints used
   */
  totalHintsUsed: number
  
  /**
   * Average hints per item
   */
  averageHintsPerItem: number
}

/**
 * Session creation options
 */
export interface CreateSessionOptions {
  /**
   * User identifier
   */
  userId: string
  
  /**
   * Content items to review
   */
  items: ReviewableContent[]
  
  /**
   * Review mode
   */
  mode: ReviewMode
  
  /**
   * Optional mode configuration override
   */
  config?: Partial<ReviewModeConfig>
  
  /**
   * Session source
   */
  source: SessionSource
  
  /**
   * Optional tags
   */
  tags?: string[]
  
  /**
   * Whether to shuffle items
   */
  shuffle?: boolean
  
  /**
   * Maximum session duration in minutes
   */
  maxDuration?: number
  
  /**
   * Custom metadata
   */
  metadata?: Record<string, any>
}

/**
 * Session update payload
 */
export interface UpdateSessionPayload {
  /**
   * Update session status
   */
  status?: SessionStatus
  
  /**
   * Update current index
   */
  currentIndex?: number
  
  /**
   * Update last activity
   */
  lastActivityAt?: Date
  
  /**
   * Mark session as ended
   */
  endedAt?: Date
  
  /**
   * Update metadata
   */
  metadata?: Record<string, any>
}

/**
 * Item answer payload
 */
export interface AnswerItemPayload {
  /**
   * Session ID
   */
  sessionId: string
  
  /**
   * Item index in session
   */
  itemIndex: number
  
  /**
   * User's answer
   */
  userAnswer: string
  
  /**
   * Time taken to answer
   */
  responseTime: number
  
  /**
   * Number of hints used
   */
  hintsUsed: number
  
  /**
   * Number of attempts made
   */
  attempts: number
  
  /**
   * User's confidence rating
   */
  confidence?: 1 | 2 | 3 | 4 | 5
}

/**
 * Session summary for listings
 */
export interface SessionSummary {
  /**
   * Session ID
   */
  id: string
  
  /**
   * When session occurred
   */
  date: Date
  
  /**
   * Session duration in minutes
   */
  duration: number
  
  /**
   * Number of items reviewed
   */
  itemCount: number
  
  /**
   * Accuracy percentage
   */
  accuracy: number
  
  /**
   * Review mode used
   */
  mode: ReviewMode
  
  /**
   * Session status
   */
  status: SessionStatus
  
  /**
   * Total score
   */
  score: number
  
  /**
   * Content types reviewed
   */
  contentTypes: string[]
}

/**
 * Aggregate statistics across multiple sessions
 */
export interface AggregateStatistics {
  /**
   * Total number of sessions
   */
  totalSessions: number
  
  /**
   * Total items reviewed
   */
  totalItemsReviewed: number
  
  /**
   * Overall accuracy
   */
  overallAccuracy: number
  
  /**
   * Total time spent in minutes
   */
  totalTimeSpent: number
  
  /**
   * Average session duration in minutes
   */
  averageSessionDuration: number
  
  /**
   * Longest streak across all sessions
   */
  longestStreak: number
  
  /**
   * Current active streak (consecutive days)
   */
  currentDayStreak: number
  
  /**
   * Performance trend (improving/stable/declining)
   */
  trend: 'improving' | 'stable' | 'declining'
  
  /**
   * Favorite review mode
   */
  favoriteMode: ReviewMode
  
  /**
   * Most reviewed content type
   */
  mostReviewedContentType: string
}