/**
 * Blast Mode Type Definitions
 * PLACEHOLDER TYPES - Will be finalized by Agent B
 */

/**
 * Type of content being reviewed in Blast Mode
 */
export type BlastContentType = 'kanji' | 'vocabulary' | 'list' | 'sentence' | 'mixed'

/**
 * Type of step/screen in the blast sequence
 */
export type BlastStepType =
  | 'meaning_to_jp_mcq'
  | 'jp_reassemble'
  | 'onyomi_mcq'
  | 'kunyomi_mcq'
  | 'other_reading_mcq'
  | 'jp_to_meaning_mcq'

/**
 * Normalized content item for Blast Mode
 * Will be provided by Agent B's adapters
 */
export interface BlastItem {
  id: string
  contentType: BlastContentType
  kanji?: string
  kana?: string
  meaningEn: string
  readings?: {
    onyomi?: string[]
    kunyomi?: string[]
    other?: string[]
  }
  tokens?: string[]        // For tile reconstruction
  sourceTags?: string[]    // JLPT, listId, etc.
}

/**
 * A single step/screen in the blast flow
 * Contains all data needed to render and validate the step
 */
export interface BlastStep {
  stepType: BlastStepType
  itemId: string          // Reference back to the BlastItem
  prompt: string
  answer: string | string[]  // Correct answer(s)
  options?: string[]      // For MCQ steps
  tiles?: string[]        // For reassemble step
  metadata?: Record<string, any>
}

/**
 * User's answer to a step
 */
export interface BlastStepAnswer {
  stepIndex: number
  itemId: string
  stepType: BlastStepType
  userAnswer: string | string[]
  correct: boolean
  responseTime: number  // milliseconds
  timestamp: Date
}

/**
 * Session configuration
 */
export interface BlastSessionConfig {
  sessionId: string
  userId: string
  items: BlastItem[]
  source?: string       // Where the session was initiated from
  metadata?: Record<string, any>
}

/**
 * Session statistics
 */
export interface BlastSessionStats {
  sessionId: string
  totalSteps: number
  completedSteps: number
  correctSteps: number
  incorrectSteps: number
  accuracy: number
  totalTime: number  // milliseconds
  averageResponseTime: number
  stepTypeBreakdown: {
    [key in BlastStepType]?: {
      total: number
      correct: number
      avgTime: number
    }
  }
}
