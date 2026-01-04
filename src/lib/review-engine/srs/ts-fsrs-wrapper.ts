/**
 * ts-fsrs Wrapper - Adapts official ts-fsrs library to our SRSAlgorithm interface
 *
 * This wrapper provides:
 * - Battle-tested FSRS-5 algorithm (19 parameters)
 * - Automatic updates when ts-fsrs releases new versions
 * - Zero maintenance of complex SRS mathematics
 * - Clean abstraction via our SRSAlgorithm interface
 *
 * @see https://github.com/open-spaced-repetition/ts-fsrs
 */

import { FSRS, Card, Rating, State, Grade, type FSRSParameters, createEmptyCard } from 'ts-fsrs'
import { SRSAlgorithm } from './base-algorithm'
import { ReviewableContent, ReviewableContentWithSRS, SRSData } from '../core/interfaces'
import { ReviewResult } from './algorithm'

/**
 * Configuration for the ts-fsrs wrapper
 * Mirrors FSRSParameters but with our naming conventions
 */
interface TSFSRSWrapperConfig {
  /**
   * Target retention rate (0-1)
   * Default: 0.9 (90% retention)
   * Higher = more reviews, better retention
   * Lower = fewer reviews, more forgetting
   */
  requestRetention?: number

  /**
   * Maximum interval in days
   * Default: 36500 (~100 years)
   */
  maximumInterval?: number

  /**
   * FSRS weight parameters
   * Default: ts-fsrs library defaults (auto-detected)
   */
  w?: number[]

  /**
   * Enable interval fuzz factor (±2.5% randomization)
   * Default: true
   * Prevents review clustering
   */
  enableFuzz?: boolean

  /**
   * Enable short-term learning steps
   * Default: true
   * When false, uses FSRS scheduling exclusively
   */
  enableShortTerm?: boolean

  /**
   * Learning steps (e.g., ['1m', '10m', '1d'])
   * Default: ['1m', '10m']
   */
  learningSteps?: string[]

  /**
   * Relearning steps (after lapse)
   * Default: ['10m']
   */
  relearningSteps?: string[]
}

/**
 * Default FSRS parameters (using ts-fsrs library defaults)
 * Note: ts-fsrs uses FSRS-6 by default with 21 parameters
 * We use these as fallback if we can't read from the FSRS instance
 */
const DEFAULT_FSRS6_PARAMS: number[] = [
  0.40255, 1.18385, 3.173, 15.69105,  // Initial stability
  7.1949, 0.5345, 1.4604,              // Difficulty
  0.0046,                               // Mean reversion
  1.54575, 0.1192, 1.01925,            // Recall
  1.9395, 0.11, 0.29605, 2.2698,       // Lapse
  0.2315, 2.9898,                      // Hard/Easy
  0.51655, 0.6621,                     // Same-day (FSRS-5)
  2.4, 1.0826                          // FSRS-6 parameters
]

/**
 * Wrapper class that adapts ts-fsrs to our SRSAlgorithm interface
 */
export class TSFSRSWrapper implements SRSAlgorithm {
  private fsrs: FSRS
  private config: Required<TSFSRSWrapperConfig>

  constructor(config: TSFSRSWrapperConfig = {}) {
    // Merge user config with defaults
    this.config = {
      requestRetention: config.requestRetention ?? 0.9,
      maximumInterval: config.maximumInterval ?? 36500,
      w: config.w ?? DEFAULT_FSRS6_PARAMS,
      enableFuzz: config.enableFuzz ?? true,
      enableShortTerm: config.enableShortTerm ?? true,
      learningSteps: config.learningSteps ?? ['1m', '10m'],
      relearningSteps: config.relearningSteps ?? ['10m']
    }

    // Initialize ts-fsrs with our parameters
    const fsrsParams: Partial<FSRSParameters> = {
      request_retention: this.config.requestRetention,
      maximum_interval: this.config.maximumInterval,
      w: this.config.w,
      enable_fuzz: this.config.enableFuzz,
      enable_short_term: this.config.enableShortTerm,
      learning_steps: this.config.learningSteps as any,
      relearning_steps: this.config.relearningSteps as any
    }

    this.fsrs = new FSRS(fsrsParams)

    // Get actual parameters from ts-fsrs (it may have upgraded to FSRS-6)
    // The fsrs instance stores parameters in its `p` property
    try {
      const actualParams = (this.fsrs as any).p
      if (actualParams && actualParams.w) {
        this.config.w = Array.isArray(actualParams.w) ? [...actualParams.w] : actualParams.w as any
      } else if (this.config.w === undefined) {
        // Fallback: use default FSRS-6 parameters (21 weights)
        // These are the ts-fsrs default weights
        this.config.w = [
          0.40255, 1.18385, 3.173, 15.69105,  // Initial stability
          7.1949, 0.5345, 1.4604,              // Difficulty
          0.0046,                               // Mean reversion
          1.54575, 0.1192, 1.01925,            // Recall
          1.9395, 0.11, 0.29605, 2.2698,       // Lapse
          0.2315, 2.9898,                      // Hard/Easy
          0.51655, 0.6621,                     // Same-day (FSRS-5)
          2.4, 1.0826                          // FSRS-6 parameters
        ] as any
      }
    } catch (error) {
      console.warn('[TSFSRSWrapper] Could not access parameters from FSRS instance:', error)
      if (this.config.w === undefined) {
        this.config.w = [] as any // Fallback to empty array
      }
    }

    console.log('[TSFSRSWrapper] Initialized with ts-fsrs')
    console.log('[TSFSRSWrapper] Parameters:', {
      retention: this.config.requestRetention,
      maxInterval: this.config.maximumInterval,
      weights: this.config.w?.length ?? 'unknown',
      fuzz: this.config.enableFuzz
    })
  }

  /**
   * Calculate next review schedule based on user's answer
   */
  calculateNextReview(
    item: ReviewableContentWithSRS,
    result: ReviewResult
  ): SRSData {
    // Convert our SRSData to ts-fsrs Card
    const card = this.toTSFSRSCard(item.srsData)

    // Convert our ReviewResult to ts-fsrs Rating
    const rating = this.toTSFSRSRating(result)

    // Use ts-fsrs to calculate next review
    const now = new Date()
    const schedulingCards = this.fsrs.repeat(card, now)

    // Get the card for the given rating
    // Note: Rating.Manual is not a valid grade for scheduling
    // Our toTSFSRSRating() method never returns Manual, but TypeScript doesn't know that
    if (rating === Rating.Manual) {
      throw new Error('Manual rating is not supported for scheduling')
    }

    // Type assertion: after the check above, rating is definitely a Grade (not Manual)
    const { card: updatedCard, log } = schedulingCards[rating as Grade]

    // Convert back to our SRSData format
    const srsData = this.toSRSData(updatedCard, log, item.srsData)

    return srsData
  }

  /**
   * Initialize SRS data for a brand new card
   */
  initializeCardSRS(item: ReviewableContent): SRSData {
    // Create empty ts-fsrs card
    const card = createEmptyCard(new Date())

    // Convert to our format
    return {
      interval: 0,
      lastReviewedAt: null,
      nextReviewAt: card.due,
      status: 'new',
      reviewCount: 0,
      correctCount: 0,
      streak: 0,
      bestStreak: 0,
      algorithm: 'fsrs',
      stability: card.stability,
      difficulty: card.difficulty,
      retrievability: 1.0, // New cards are fully retrievable
      state: card.state
    }
  }

  /**
   * Check if card should graduate from learning to review phase
   */
  shouldGraduate(srsData: SRSData): boolean {
    // ts-fsrs handles graduation automatically
    // We graduate when state changes from Learning to Review
    const card = this.toTSFSRSCard(srsData)
    return card.state === State.Review || card.state === State.Relearning
  }

  /**
   * Check if card has reached mastery level
   */
  shouldMaster(srsData: SRSData): boolean {
    // Mastery criteria:
    // 1. In Review state (graduated from learning)
    // 2. Stability >= 100 days (memory is very stable)
    // 3. High accuracy (90%+ correct)
    const card = this.toTSFSRSCard(srsData)

    const isInReview = card.state === State.Review
    const isStable = card.stability >= 100
    const hasHighAccuracy = srsData.correctCount / Math.max(srsData.reviewCount, 1) >= 0.9
    const hasEnoughReviews = srsData.reviewCount >= 5

    return isInReview && isStable && hasHighAccuracy && hasEnoughReviews
  }

  // ========================================
  // Type Conversion Utilities
  // ========================================

  /**
   * Convert our SRSData to ts-fsrs Card format
   */
  private toTSFSRSCard(srsData?: SRSData): Card {
    if (!srsData) {
      return createEmptyCard(new Date())
    }

    // Map our status to ts-fsrs State
    let state: State
    if (srsData.status === 'new') {
      state = State.New
    } else if (srsData.status === 'learning') {
      state = State.Learning
    } else if (srsData.status === 'review' || srsData.status === 'mastered') {
      // Both 'review' and 'mastered' map to Review state
      // We distinguish mastered via stability threshold
      state = State.Review
    } else {
      state = State.New
    }

    // Calculate scheduled_days (days since last review)
    const now = new Date()
    const lastReview = srsData.lastReviewedAt ? new Date(srsData.lastReviewedAt) : now
    const scheduled_days = Math.max(0, Math.floor(
      (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24)
    ))

    return {
      due: srsData.nextReviewAt,
      stability: srsData.stability ?? 0,
      difficulty: srsData.difficulty ?? 5,
      elapsed_days: scheduled_days, // deprecated but still required
      scheduled_days: scheduled_days,
      learning_steps: 0,
      reps: srsData.reviewCount,
      lapses: srsData.reviewCount - srsData.correctCount,
      state: state,
      last_review: srsData.lastReviewedAt ?? undefined
    }
  }

  /**
   * Convert ts-fsrs Card back to our SRSData format
   */
  private toSRSData(card: Card, log: any, previousData?: SRSData): SRSData {
    // Map ts-fsrs State to our status
    let status: SRSData['status']
    if (card.state === State.New) {
      status = 'new'
    } else if (card.state === State.Learning || card.state === State.Relearning) {
      status = 'learning'
    } else if (card.state === State.Review) {
      // Check if this should be 'mastered'
      if (card.stability >= 100 && previousData) {
        const accuracy = previousData.correctCount / Math.max(previousData.reviewCount, 1)
        status = accuracy >= 0.9 ? 'mastered' : 'review'
      } else {
        status = 'review'
      }
    } else {
      status = 'new'
    }

    // Calculate retrievability (forgetting curve)
    const retrievability = this.calculateRetrievability(card)

    // Preserve streak and accuracy data from previous state
    const newCorrectCount = previousData
      ? previousData.correctCount + (log.rating >= Rating.Good ? 1 : 0)
      : (log.rating >= Rating.Good ? 1 : 0)

    const newReviewCount = previousData
      ? previousData.reviewCount + 1
      : 1

    const newStreak = log.rating >= Rating.Good
      ? (previousData?.streak ?? 0) + 1
      : 0

    const newBestStreak = Math.max(
      previousData?.bestStreak ?? 0,
      newStreak
    )

    return {
      interval: card.scheduled_days,
      lastReviewedAt: card.last_review ?? new Date(),
      nextReviewAt: card.due,
      status: status,
      reviewCount: newReviewCount,
      correctCount: newCorrectCount,
      streak: newStreak,
      bestStreak: newBestStreak,
      algorithm: 'fsrs',
      stability: card.stability,
      difficulty: card.difficulty,
      retrievability: retrievability,
      state: card.state
    }
  }

  /**
   * Convert our ReviewResult to ts-fsrs Rating
   */
  private toTSFSRSRating(result: ReviewResult): Rating {
    // Use explicit difficulty rating if provided
    if (result.difficulty) {
      switch (result.difficulty) {
        case 'again':
          return Rating.Again
        case 'hard':
          return Rating.Hard
        case 'good':
          return Rating.Good
        case 'easy':
          return Rating.Easy
        default:
          return Rating.Good
      }
    }

    // Fallback to correct/incorrect
    if (!result.correct) {
      return Rating.Again
    }

    // Use confidence if available
    if (result.confidence !== undefined) {
      if (result.confidence >= 4) return Rating.Easy
      if (result.confidence >= 3) return Rating.Good
      if (result.confidence >= 2) return Rating.Hard
      return Rating.Again
    }

    // Use response time as heuristic
    if (result.responseTime) {
      if (result.responseTime < 2000) return Rating.Easy
      if (result.responseTime < 5000) return Rating.Good
      if (result.responseTime < 10000) return Rating.Hard
    }

    // Default to Good for correct answers
    return Rating.Good
  }

  /**
   * Calculate retrievability using FSRS forgetting curve
   * R(t,S) = (1 + t/(9*S))^(-1)
   */
  private calculateRetrievability(card: Card): number {
    if (!card.last_review) {
      return 1.0 // New cards are fully retrievable
    }

    const now = new Date()
    const lastReview = new Date(card.last_review)
    const elapsedDays = (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24)

    if (elapsedDays <= 0 || card.stability <= 0) {
      return 1.0
    }

    // FSRS forgetting curve formula
    const retrievability = Math.pow(1 + elapsedDays / (9 * card.stability), -1)

    return Math.max(0, Math.min(1, retrievability))
  }

  // ========================================
  // Utility Methods
  // ========================================

  /**
   * Get current FSRS parameters for inspection/debugging
   */
  getParameters(): Required<TSFSRSWrapperConfig> {
    return { ...this.config }
  }

  /**
   * Update parameters (creates new FSRS instance)
   * Use this to apply optimized parameters for specific users
   */
  updateParameters(config: Partial<TSFSRSWrapperConfig>): void {
    this.config = { ...this.config, ...config }

    const fsrsParams: Partial<FSRSParameters> = {
      request_retention: this.config.requestRetention,
      maximum_interval: this.config.maximumInterval,
      w: this.config.w,
      enable_fuzz: this.config.enableFuzz,
      enable_short_term: this.config.enableShortTerm,
      learning_steps: this.config.learningSteps as any,
      relearning_steps: this.config.relearningSteps as any
    }

    this.fsrs = new FSRS(fsrsParams)

    console.log('[TSFSRSWrapper] Parameters updated')
  }

  /**
   * Get algorithm version info
   */
  getVersion(): { library: string; algorithm: string; parameters: number } {
    // ts-fsrs auto-upgrades parameters: 17→19→21
    const paramCount = this.config.w?.length ?? 0
    let algorithmVersion = 'FSRS'

    if (paramCount === 17) {
      algorithmVersion = 'FSRS-4.5'
    } else if (paramCount === 19) {
      algorithmVersion = 'FSRS-5'
    } else if (paramCount === 21) {
      algorithmVersion = 'FSRS-6'
    }

    return {
      library: 'ts-fsrs',
      algorithm: algorithmVersion,
      parameters: paramCount
    }
  }
}
