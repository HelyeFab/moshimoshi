/**
 * Type definitions for the Universal Review Engine
 * Defines review modes, configurations, and related types
 */

/**
 * Available review modes
 */
export type ReviewMode = 'recognition' | 'recall' | 'listening'

/**
 * Input types for different review modes
 */
export type InputType = 'multiple-choice' | 'text' | 'drawing' | 'speech' | 'custom'

/**
 * Option sources for multiple choice questions
 */
export type OptionSource = 'similar' | 'random' | 'curated'

/**
 * Validation strategies for answer checking
 */
export type ValidationStrategy = 'exact' | 'fuzzy' | 'custom'

/**
 * Font size options for display
 */
export type FontSize = 'small' | 'medium' | 'large' | 'extra-large'

/**
 * Session status states
 */
export type SessionStatus = 'active' | 'paused' | 'completed' | 'abandoned'

/**
 * Session sources
 */
export type SessionSource = 'manual' | 'scheduled' | 'quick' | 'test'

/**
 * Difficulty levels
 */
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'

/**
 * Configuration for a specific review mode
 */
export interface ReviewModeConfig {
  /**
   * The review mode this configuration applies to
   */
  mode: ReviewMode
  
  // Display configuration
  /**
   * Whether to show the primary display (main content)
   */
  showPrimary: boolean
  
  /**
   * Whether to show the secondary display (supporting info)
   */
  showSecondary: boolean
  
  /**
   * Whether to show the tertiary display (additional context)
   */
  showTertiary: boolean
  
  /**
   * Whether to show media (images, videos)
   */
  showMedia: boolean
  
  // Input configuration
  /**
   * Type of input method for this mode
   */
  inputType: InputType
  
  // Options for multiple choice
  /**
   * Number of options to show (including correct answer)
   */
  optionCount?: number
  
  /**
   * Source for generating wrong options
   */
  optionSource?: OptionSource
  
  // Timing
  /**
   * Time limit in seconds (optional)
   */
  timeLimit?: number
  
  /**
   * Minimum time before accepting answer (prevents accidental clicks)
   */
  minResponseTime?: number
  
  // Hints
  /**
   * Whether hints are allowed in this mode
   */
  allowHints: boolean
  
  /**
   * Score reduction for using hints (0.0 to 1.0)
   */
  hintPenalty?: number
  
  // Audio
  /**
   * Whether to automatically play audio when available
   */
  autoPlayAudio?: boolean
  
  /**
   * Maximum number of times audio can be repeated
   */
  repeatLimit?: number
  
  // Validation
  /**
   * Whether to show immediate feedback
   */
  immediateValidation?: boolean
  
  /**
   * Whether to allow retries on wrong answers
   */
  allowRetry?: boolean
  
  /**
   * Maximum number of retry attempts
   */
  maxRetries?: number
}

/**
 * Configuration for a specific content type
 */
export interface ContentTypeConfig {
  /**
   * The content type this configuration applies to
   */
  contentType: string
  
  /**
   * Available review modes for this content type
   */
  availableModes: ReviewModeConfig[]
  
  /**
   * Default review mode for this content type
   */
  defaultMode: ReviewMode
  
  // Validation rules
  /**
   * Strategy for validating answers
   */
  validationStrategy: ValidationStrategy
  
  /**
   * Options for the validation strategy
   */
  validationOptions?: {
    /**
     * For fuzzy matching: similarity threshold (0.0 to 1.0)
     */
    threshold?: number
    
    /**
     * Whether to ignore case
     */
    ignoreCase?: boolean
    
    /**
     * Whether to ignore whitespace
     */
    ignoreWhitespace?: boolean
    
    /**
     * Whether to ignore punctuation
     */
    ignorePunctuation?: boolean
    
    /**
     * Custom validation function name
     */
    customValidator?: string
  }
  
  // Display preferences
  /**
   * Font size for this content type
   */
  fontSize?: FontSize
  
  /**
   * Font family for this content type
   */
  fontFamily?: string
  
  /**
   * Custom CSS class for styling
   */
  customClass?: string
  
  // Special features
  /**
   * Content-type specific features
   */
  features?: {
    /**
     * Show stroke order animation (kanji)
     */
    strokeOrder?: boolean
    
    /**
     * Show furigana reading aid (vocabulary/sentences)
     */
    furigana?: boolean
    
    /**
     * Show pitch accent indicator (vocabulary)
     */
    pitch?: boolean
    
    /**
     * Show conjugation forms (verbs/adjectives)
     */
    conjugation?: boolean
    
    /**
     * Show character variants (kana/kanji)
     */
    variants?: boolean
    
    /**
     * Enable handwriting recognition (kanji/kana)
     */
    handwriting?: boolean
    
    /**
     * Show etymology/origin information
     */
    etymology?: boolean
    
    /**
     * Display script for kana (hiragana/katakana)
     */
    displayScript?: 'hiragana' | 'katakana'
  }
}

/**
 * Default configurations for review modes
 */
export const DEFAULT_MODE_CONFIGS: Record<ReviewMode, Partial<ReviewModeConfig>> = {
  recognition: {
    showPrimary: true,
    showSecondary: false,
    showTertiary: false,
    showMedia: true,
    inputType: 'multiple-choice',
    optionCount: 4,
    optionSource: 'similar',
    allowHints: true,
    hintPenalty: 0.1,
    immediateValidation: true,
    allowRetry: false
  },
  recall: {
    showPrimary: false,
    showSecondary: true,
    showTertiary: true,
    showMedia: false,
    inputType: 'text',
    allowHints: true,
    hintPenalty: 0.2,
    immediateValidation: true,
    allowRetry: true,
    maxRetries: 2
  },
  listening: {
    showPrimary: false,
    showSecondary: false,
    showTertiary: false,
    showMedia: false,
    inputType: 'multiple-choice',
    optionCount: 4,
    optionSource: 'similar',
    autoPlayAudio: true,
    repeatLimit: 3,
    allowHints: false,
    immediateValidation: true,
    allowRetry: false
  }
}

/**
 * Performance thresholds for different metrics
 */
export interface PerformanceThresholds {
  /**
   * Minimum accuracy to consider mastered (0.0 to 1.0)
   */
  masteryThreshold: number
  
  /**
   * Minimum accuracy to pass (0.0 to 1.0)
   */
  passingThreshold: number
  
  /**
   * Maximum response time for bonus points (milliseconds)
   */
  fastResponseTime: number
  
  /**
   * Minimum response time to be valid (milliseconds)
   */
  minValidResponseTime: number
}

/**
 * Scoring configuration
 */
export interface ScoringConfig {
  /**
   * Base points for correct answer
   */
  basePoints: number
  
  /**
   * Multiplier for speed bonus
   */
  speedBonusMultiplier: number
  
  /**
   * Multiplier for streak bonus
   */
  streakBonusMultiplier: number
  
  /**
   * Points deducted for hints
   */
  hintPenalty: number
  
  /**
   * Points deducted for retries
   */
  retryPenalty: number
  
  /**
   * Whether to use weighted scoring based on difficulty
   */
  useDifficultyWeighting: boolean
}