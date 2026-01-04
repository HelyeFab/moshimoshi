/**
 * Core interfaces for the Universal Review Engine
 * These interfaces define the contracts for all reviewable content
 */

import { ReviewMode } from './types'

// Re-export ReviewMode for convenience (many adapters import from interfaces)
export type { ReviewMode } from './types'

/**
 * Base interface for all reviewable content types
 * Content adapters will transform specific content types to this format
 */
export interface ReviewableContent {
  /**
   * Unique identifier for the content item
   */
  id: string
  
  /**
   * Content type for adapter selection and special handling
   */
  contentType: 'kana' | 'kanji' | 'vocabulary' | 'sentence' | 'phrase' | 'grammar' | 'custom'
  
  // Display fields
  /**
   * Main content shown to user (character, word, sentence)
   */
  primaryDisplay: string
  
  /**
   * Supporting information (meaning, translation, reading)
   */
  secondaryDisplay?: string
  
  /**
   * Additional context (usage examples, notes, hints)
   */
  tertiaryDisplay?: string

  /**
   * Reading/pronunciation (hiragana for Japanese content)
   */
  reading?: string

  // Input/Answer fields
  /**
   * Expected answer for validation
   */
  primaryAnswer: string
  
  /**
   * Acceptable alternative answers
   */
  alternativeAnswers?: string[]
  
  // Media assets
  /**
   * URL for audio content (for listening mode)
   */
  audioUrl?: string
  
  /**
   * URL for visual aids
   */
  imageUrl?: string
  
  /**
   * URL for video content
   */
  videoUrl?: string
  
  // Metadata
  /**
   * Difficulty level from 0.0 (easiest) to 1.0 (hardest)
   */
  difficulty: number
  
  /**
   * Tags for categorization and filtering
   */
  tags: string[]
  
  /**
   * Source of the content (e.g., "JLPT N5", "Custom List")
   */
  source?: string
  
  // Mode configuration
  /**
   * Which review modes this content supports
   */
  supportedModes: ReviewMode[]
  
  /**
   * Default/preferred mode for this content
   */
  preferredMode?: ReviewMode
  
  /**
   * Additional data specific to content types
   * E.g., stroke order for kanji, pitch accent for vocabulary
   */
  metadata?: Record<string, any>
}

/**
 * Extended metadata for specific content types
 */
export interface KanaMetadata {
  script: 'hiragana' | 'katakana'
  romaji: string
  dakuten?: boolean
  handakuten?: boolean
  combination?: boolean
}

export interface KanjiMetadata {
  strokeCount: number
  strokeOrderUrl?: string
  radicals?: string[]
  onyomi?: string[]
  kunyomi?: string[]
  jlptLevel?: number
  grade?: number
  frequency?: number
}

export interface VocabularyMetadata {
  reading?: string
  partOfSpeech?: string[]
  pitchAccent?: number
  commonUsage?: boolean
  exampleSentences?: Array<{
    japanese: string
    translation: string
    furigana?: string
  }>
}

export interface SentenceMetadata {
  translation: string
  furigana?: string
  grammarPoints?: string[]
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
}

/**
 * Interface for content validation result
 */
export interface ValidationResult {
  isCorrect: boolean
  confidence: number // 0.0 to 1.0
  corrections?: {
    expected: string
    received: string
    differences?: string[]
  }
  partialCredit?: number // For partial matches
  feedback?: string
}

/**
 * Interface for hint generation
 */
export interface Hint {
  level: 1 | 2 | 3 // Progressive hint levels
  content: string
  penalty: number // Score reduction for using this hint
  revealPercentage: number // How much of the answer is revealed (0.0 to 1.0)
}

/**
 * Interface for content filtering and selection
 */
export interface ContentFilter {
  contentTypes?: string[]
  tags?: string[]
  difficultyRange?: {
    min: number
    max: number
  }
  sources?: string[]
  excludeIds?: string[]
  includeIds?: string[]
  limit?: number
}

/**
 * Interface for content statistics
 */
export interface ContentStatistics {
  contentId: string
  timesReviewed: number
  averageResponseTime: number
  accuracy: number
  lastReviewedAt?: Date
  nextReviewAt?: Date
  difficulty: number // Dynamic difficulty based on user performance
}

/**
 * SRS (Spaced Repetition System) data for content items
 */
export interface SRSData {
  // ========================================
  // Common fields (used by both SM-2 and FSRS)
  // ========================================

  /**
   * Days until next review
   */
  interval: number

  /**
   * Last review timestamp
   */
  lastReviewedAt: Date | null

  /**
   * Next scheduled review
   */
  nextReviewAt: Date

  /**
   * Learning status
   */
  status: 'new' | 'learning' | 'review' | 'mastered'

  /**
   * Total review count
   */
  reviewCount: number

  /**
   * Correct answer count
   */
  correctCount: number

  /**
   * Current streak of correct answers
   */
  streak: number

  /**
   * Best streak achieved
   */
  bestStreak: number

  // ========================================
  // Algorithm identifier (NEW)
  // ========================================

  /**
   * Which SRS algorithm is being used
   * - 'sm2': SuperMemo 2 algorithm (legacy, default for existing cards)
   * - 'fsrs': Free Spaced Repetition Scheduler (modern, default for new cards)
   */
  algorithm: 'sm2' | 'fsrs'

  // ========================================
  // SM-2 specific fields (optional, used only when algorithm='sm2')
  // ========================================

  /**
   * Difficulty factor (1.3 to 2.5) - SM-2 only
   * Indicates how "easy" the card is
   */
  easeFactor?: number

  /**
   * Number of consecutive successful reviews - SM-2 only
   */
  repetitions?: number

  // ========================================
  // FSRS specific fields (optional, used only when algorithm='fsrs')
  // ========================================

  /**
   * Memory stability in days - FSRS only
   * Represents how long the memory will last before forgetting
   * Higher stability = longer intervals between reviews
   */
  stability?: number

  /**
   * Item difficulty (0-10) - FSRS only
   * 1 = easiest, 10 = hardest
   * Unlike SM-2's easeFactor, this represents intrinsic difficulty of the content
   */
  difficulty?: number

  /**
   * Current retrievability (0-1) - FSRS only
   * Probability that the user can recall this item right now
   * Calculated using the forgetting curve based on time since last review
   */
  retrievability?: number

  /**
   * FSRS internal state - FSRS only
   * Used for algorithm-specific state tracking
   */
  state?: number
}

/**
 * Extended ReviewableContent with SRS fields
 */
export interface ReviewableContentWithSRS extends ReviewableContent {
  /**
   * SRS learning data
   */
  srsData?: SRSData
  
  /**
   * Whether item is pinned for review
   */
  isPinned?: boolean
  
  /**
   * When item was pinned
   */
  pinnedAt?: Date
  
  /**
   * Priority for review ordering
   */
  priority?: 'low' | 'normal' | 'high'
  
  /**
   * Review set IDs this item belongs to
   */
  setIds?: string[]
}