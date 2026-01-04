import { SRSAlgorithm } from './base-algorithm'
import { ReviewableContent, ReviewableContentWithSRS, SRSData } from '../core/interfaces'
import { ReviewResult } from './algorithm'

/**
 * FSRS Algorithm Parameters
 * Based on research: https://github.com/open-spaced-repetition/fsrs4anki
 */
interface FSRSParameters {
  requestRetention: number  // Target retention rate (0-1)
  maximumInterval: number   // Max days between reviews
  w: number[]              // 17 weight parameters (learned from data)
}

/**
 * Default FSRS parameters (optimized for general use)
 * These are the universal default weights from FSRS research
 */
const DEFAULT_FSRS_PARAMS: FSRSParameters = {
  requestRetention: 0.9,  // 90% retention target
  maximumInterval: 36500, // ~100 years
  w: [
    // Initial stability for each rating (1-4)
    0.4, 0.6, 2.4, 5.8,
    // Difficulty parameters
    4.93, 0.94, 0.86,
    // Mean reversion
    0.01,
    // Recall multiplier
    1.49,
    // Recall power
    0.14,
    // Recall sensitivity
    0.94,
    // Lapse parameters
    2.18, 0.05, 0.34, 1.26,
    // Hard/easy bonuses
    0.29, 2.61
  ]
}

/**
 * Free Spaced Repetition Scheduler (FSRS)
 * Modern algorithm with 20-30% efficiency improvement over SM-2
 *
 * Key concepts:
 * - **Stability**: How long a memory lasts (in days)
 * - **Difficulty**: Intrinsic difficulty of the item (1-10)
 * - **Retrievability**: Current probability of recall (0-1)
 *
 * The algorithm uses a forgetting curve to predict when you'll forget,
 * and schedules reviews just before that happens.
 */
export class FSRSAlgorithm implements SRSAlgorithm {
  private params: FSRSParameters

  constructor(params: Partial<FSRSParameters> = {}) {
    this.params = { ...DEFAULT_FSRS_PARAMS, ...params }
  }

  calculateNextReview(
    item: ReviewableContentWithSRS,
    result: ReviewResult
  ): SRSData {
    const srsData = item.srsData || this.initializeCardSRS(item)
    const rating = this.mapResultToRating(result)

    // Route by current status
    if (srsData.status === 'new') {
      return this.handleNewCard(srsData, rating)
    } else if (srsData.status === 'learning') {
      return this.handleLearningCard(srsData, rating)
    } else {
      return this.handleReviewCard(srsData, rating)
    }
  }

  /**
   * Handle first review of a new card
   */
  private handleNewCard(srsData: SRSData, rating: number): SRSData {
    const stability = this.initStability(rating)
    const difficulty = this.initDifficulty(rating)
    const interval = this.nextInterval(stability)

    return {
      ...srsData,
      algorithm: 'fsrs',
      status: rating >= 3 ? 'learning' : 'new',  // Good/Easy → learning
      stability,
      difficulty,
      interval,
      nextReviewAt: this.calculateDueDate(interval),
      reviewCount: 1,
      correctCount: rating >= 3 ? 1 : 0,
      streak: rating >= 3 ? 1 : 0,
      bestStreak: rating >= 3 ? 1 : srsData.bestStreak,
      lastReviewedAt: new Date()
    }
  }

  /**
   * Handle card in learning phase
   */
  private handleLearningCard(srsData: SRSData, rating: number): SRSData {
    const newStability = this.nextStability(
      srsData.stability!,
      srsData.difficulty!,
      srsData.retrievability || 0,
      rating
    )
    const newDifficulty = this.nextDifficulty(srsData.difficulty!, rating)
    const interval = this.nextInterval(newStability)

    // Graduate to review after 2+ successful reviews
    const graduated = rating >= 3 && srsData.reviewCount >= 2

    return {
      ...srsData,
      algorithm: 'fsrs',
      status: graduated ? 'review' : 'learning',
      stability: newStability,
      difficulty: newDifficulty,
      interval,
      nextReviewAt: this.calculateDueDate(interval),
      reviewCount: srsData.reviewCount + 1,
      correctCount: srsData.correctCount + (rating >= 3 ? 1 : 0),
      streak: rating >= 3 ? (srsData.streak + 1) : 0,
      bestStreak: Math.max(srsData.bestStreak, rating >= 3 ? (srsData.streak + 1) : 0),
      lastReviewedAt: new Date()
    }
  }

  /**
   * Handle card in review phase
   */
  private handleReviewCard(srsData: SRSData, rating: number): SRSData {
    const elapsedDays = this.daysSince(srsData.lastReviewedAt)
    const retrievability = this.forgettingCurve(elapsedDays, srsData.stability!)

    const newStability = this.nextStability(
      srsData.stability!,
      srsData.difficulty!,
      retrievability,
      rating
    )
    const newDifficulty = this.nextDifficulty(srsData.difficulty!, rating)
    const interval = this.nextInterval(newStability)

    // Master if stability >= 100 days and 90%+ accuracy
    const mastered = newStability >= 100 &&
                     (srsData.correctCount / srsData.reviewCount >= 0.9)

    return {
      ...srsData,
      algorithm: 'fsrs',
      status: mastered ? 'mastered' : 'review',
      stability: newStability,
      difficulty: newDifficulty,
      retrievability,
      interval,
      nextReviewAt: this.calculateDueDate(interval),
      reviewCount: srsData.reviewCount + 1,
      correctCount: srsData.correctCount + (rating >= 3 ? 1 : 0),
      streak: rating >= 3 ? (srsData.streak + 1) : 0,
      bestStreak: Math.max(srsData.bestStreak, rating >= 3 ? (srsData.streak + 1) : 0),
      lastReviewedAt: new Date()
    }
  }

  // ========================================
  // FSRS Core Formulas
  // ========================================

  /**
   * Initialize stability for new card based on first rating
   * Uses FSRS weight parameters w[0-3]
   */
  private initStability(rating: number): number {
    const w = this.params.w
    return Math.max(w[rating - 1], 0.1)
  }

  /**
   * Initialize difficulty for new card
   * Uses FSRS weight parameters w[4-5]
   */
  private initDifficulty(rating: number): number {
    const w = this.params.w
    const difficulty = w[4] - w[5] * (rating - 3)
    return Math.min(Math.max(difficulty, 1), 10)
  }

  /**
   * Forgetting curve: P(recall) = (1 + t/(9*S))^-1
   * Where t = elapsed time, S = stability
   */
  private forgettingCurve(elapsedDays: number, stability: number): number {
    return Math.pow(1 + elapsedDays / (9 * stability), -1)
  }

  /**
   * Calculate next stability after review
   * Core FSRS formula - most complex calculation
   */
  private nextStability(
    currentStability: number,
    difficulty: number,
    retrievability: number,
    rating: number
  ): number {
    const w = this.params.w

    // Hard/easy modifiers
    const hardPenalty = rating === 2 ? w[15] : 1
    const easyBonus = rating === 4 ? w[16] : 1

    let newStability: number

    if (rating === 1) {
      // Forgot (Again): Reset stability with lapse formula
      newStability = w[11] *
        Math.pow(difficulty, -w[12]) *
        (Math.pow(currentStability + 1, w[13]) - 1) *
        Math.exp(w[14] * (1 - retrievability))
    } else {
      // Recalled (Hard/Good/Easy): Increase stability
      newStability = currentStability * (
        1 + Math.exp(w[8]) *
        (11 - difficulty) *
        Math.pow(currentStability, -w[9]) *
        (Math.exp((1 - retrievability) * w[10]) - 1) *
        hardPenalty *
        easyBonus
      )
    }

    // Clamp to reasonable range
    return Math.min(Math.max(newStability, 0.1), 36500)
  }

  /**
   * Calculate next difficulty after review
   * Uses mean reversion to prevent extreme values
   */
  private nextDifficulty(currentDifficulty: number, rating: number): number {
    const w = this.params.w

    // Difficulty change based on rating
    const deltaD = -w[6] * (rating - 3)  // Good = 0 change
    const newDifficulty = currentDifficulty + deltaD

    // Apply mean reversion
    const revertedDifficulty = this.meanReversion(currentDifficulty, newDifficulty)

    // Clamp to 1-10 range
    return Math.min(Math.max(revertedDifficulty, 1), 10)
  }

  /**
   * Mean reversion prevents difficulty from drifting too far
   * Formula: D' = w[7] * D_0 + (1 - w[7]) * D
   */
  private meanReversion(init: number, current: number): number {
    const w = this.params.w
    return w[7] * init + (1 - w[7]) * current
  }

  /**
   * Calculate interval in days from stability
   * Formula: I = S * 9 * (1/R - 1) where R = target retention
   */
  private nextInterval(stability: number): number {
    const interval = Math.round(
      stability * 9 * (1 / this.params.requestRetention - 1)
    )
    return Math.min(Math.max(interval, 1), this.params.maximumInterval)
  }

  /**
   * Calculate due date from interval
   */
  private calculateDueDate(interval: number): Date {
    const due = new Date()
    due.setDate(due.getDate() + interval)
    return due
  }

  /**
   * Calculate days since last review
   */
  private daysSince(date: Date | null): number {
    if (!date) return 0
    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
  }

  /**
   * Map ReviewResult to FSRS rating (1-4)
   * 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
   */
  private mapResultToRating(result: ReviewResult): number {
    if (result.difficulty === 'again') return 1
    if (result.difficulty === 'hard') return 2
    if (result.difficulty === 'easy') return 4
    return 3  // 'good' or undefined
  }

  // ========================================
  // SRSAlgorithm Interface Implementation
  // ========================================

  /**
   * Initialize SRS data for brand new card
   */
  initializeCardSRS(item: ReviewableContent): SRSData {
    return {
      interval: 0,
      lastReviewedAt: null,
      nextReviewAt: new Date(),
      status: 'new',
      reviewCount: 0,
      correctCount: 0,
      streak: 0,
      bestStreak: 0,
      algorithm: 'fsrs',
      stability: 0,
      difficulty: 5,  // Neutral starting difficulty
      retrievability: 0,
      state: 0
    }
  }

  /**
   * Check if card should graduate from learning
   */
  shouldGraduate(srsData: SRSData): boolean {
    return srsData.reviewCount >= 2 &&
           srsData.correctCount / srsData.reviewCount >= 0.75
  }

  /**
   * Check if card has reached mastery
   */
  shouldMaster(srsData: SRSData): boolean {
    return srsData.stability! >= 100 &&
           srsData.correctCount / srsData.reviewCount >= 0.9
  }
}
