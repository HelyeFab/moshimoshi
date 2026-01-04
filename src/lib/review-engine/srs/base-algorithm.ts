import { ReviewableContent, ReviewableContentWithSRS, SRSData } from '../core/interfaces'
import { ReviewResult } from './algorithm'

/**
 * Base interface for SRS (Spaced Repetition System) algorithms
 * Supports both SM-2 (legacy) and FSRS (modern) implementations
 */
export interface SRSAlgorithm {
  /**
   * Calculate next review schedule based on user's answer
   * @param item - Content item with current SRS data
   * @param result - User's review result (correct/incorrect, difficulty, response time)
   * @returns Updated SRS data with new interval, ease factor/stability, etc.
   */
  calculateNextReview(
    item: ReviewableContentWithSRS,
    result: ReviewResult
  ): SRSData

  /**
   * Initialize SRS data for a new card/item
   * @param item - Content item without SRS data
   * @returns Initial SRS data (status: 'new', interval: 0, etc.)
   */
  initializeCardSRS(item: ReviewableContent): SRSData

  /**
   * Check if card should graduate from learning to review phase
   * @param srsData - Current SRS data
   * @returns true if card meets graduation criteria
   */
  shouldGraduate(srsData: SRSData): boolean

  /**
   * Check if card has reached mastery level
   * @param srsData - Current SRS data
   * @returns true if card meets mastery criteria
   */
  shouldMaster(srsData: SRSData): boolean
}

/**
 * Supported algorithm types
 */
export type AlgorithmType = 'sm2' | 'fsrs'
