/**
 * SRS Helper for Flashcards
 * Bridges flashcard system with the Universal Review Engine's SRS algorithm
 *
 * **UPDATED FOR FSRS**: All new cards now use FSRS algorithm by default for 20-30% efficiency improvement
 */

import { AlgorithmFactory } from '@/lib/review-engine/srs/algorithm-factory'
import type { FlashcardContent, CardStatus } from '@/types/flashcards'
import type { ReviewResult } from '@/lib/review-engine/srs'

export class FlashcardSRSHelper {
  /**
   * Get the appropriate SRS algorithm based on card's current state
   * Defaults to FSRS for new cards
   */
  private static getAlgorithmForCard(card: FlashcardContent) {
    // Infer algorithm from existing metadata
    const srsData = card.metadata ? {
      algorithm: card.metadata.algorithm as 'sm2' | 'fsrs' | undefined,
      easeFactor: card.metadata.easeFactor,
      repetitions: card.metadata.repetitions,
      stability: card.metadata.stability,
      difficulty: card.metadata.difficulty,
    } : undefined

    return AlgorithmFactory.fromSRSData(srsData)
  }

  /**
   * Convert difficulty response to quality rating for SRS
   */
  static difficultyToQuality(difficulty: 'again' | 'hard' | 'good' | 'easy'): number {
    const qualityMap = {
      again: 1, // Failed to recall
      hard: 3, // Difficult but correct
      good: 4, // Normal difficulty
      easy: 5, // Very easy
    }
    return qualityMap[difficulty]
  }

  /**
   * Initialize SRS metadata for a new card
   * **USES FSRS BY DEFAULT** for all new cards
   */
  static initializeCardSRS(card: FlashcardContent): FlashcardContent {
    // Get default algorithm (FSRS)
    const algorithm = AlgorithmFactory.getDefault()

    // Create minimal content item for initialization
    const contentItem = {
      id: card.id,
      contentType: 'custom' as const,
      primaryDisplay: card.front.text,
      primaryAnswer: card.back.text,
      difficulty: 0.5,
      tags: [],
      supportedModes: ['recognition' as const, 'recall' as const],
    }

    // Initialize SRS data using FSRS algorithm
    const srsData = algorithm.initializeCardSRS(contentItem)

    return {
      ...card,
      metadata: {
        ...card.metadata,
        // Core SRS fields (common to both algorithms)
        algorithm: srsData.algorithm, // 'fsrs' for new cards
        status: srsData.status, // 'new'
        interval: srsData.interval, // 0
        lastReviewed: undefined,
        nextReview: srsData.nextReviewAt.getTime(),
        reviewCount: srsData.reviewCount, // 0
        correctCount: srsData.correctCount, // 0
        streak: srsData.streak, // 0
        bestStreak: srsData.bestStreak, // 0

        // FSRS-specific fields (will be defined for FSRS cards)
        stability: srsData.stability, // 0
        difficulty: srsData.difficulty, // 5 (neutral)
        retrievability: srsData.retrievability, // 0

        // Legacy fields (for backward compatibility, will be undefined for FSRS cards)
        easeFactor: srsData.easeFactor,
        repetitions: srsData.repetitions,

        // Additional flashcard-specific fields
        lapses: 0,
        learningStep: 0,
        createdAt: card.metadata?.createdAt || Date.now(),
      },
    }
  }

  /**
   * Update card after review using SRS algorithm
   * **Automatically uses FSRS or SM-2** based on card's algorithm field
   */
  static async updateCardAfterReview(
    card: FlashcardContent,
    difficulty: 'again' | 'hard' | 'good' | 'easy',
    responseTime: number
  ): Promise<FlashcardContent> {
    const quality = this.difficultyToQuality(difficulty)
    const isCorrect = difficulty !== 'again'

    // Get the correct algorithm for this card (FSRS or SM-2)
    const algorithm = this.getAlgorithmForCard(card)

    // Create review result for SRS algorithm
    const reviewResult: ReviewResult = {
      correct: isCorrect,
      responseTime,
      confidence: quality as 1 | 2 | 3 | 4 | 5,
      difficulty, // Pass difficulty for FSRS (it uses this)
    }

    // Get current algorithm type
    const currentAlgorithm = (card.metadata?.algorithm || 'fsrs') as 'sm2' | 'fsrs'

    // Convert card to SRS-compatible format (ReviewableContentWithSRS)
    const reviewableItem = {
      id: card.id,
      contentType: 'custom' as const,
      primaryDisplay: card.front.text,
      primaryAnswer: card.back.text,
      difficulty: card.metadata?.difficulty || 0.5,
      tags: card.metadata?.tags || [],
      supportedModes: ['recognition' as const, 'recall' as const],
      srsData: {
        // Common fields
        interval: card.metadata?.interval || 0,
        lastReviewedAt: card.metadata?.lastReviewed ? new Date(card.metadata.lastReviewed) : null,
        nextReviewAt: card.metadata?.nextReview ? new Date(card.metadata.nextReview) : new Date(),
        status: (card.metadata?.status || 'new') as 'new' | 'learning' | 'review' | 'mastered',
        reviewCount: card.metadata?.reviewCount || 0,
        correctCount: card.metadata?.correctCount || 0,
        streak: card.metadata?.streak || 0,
        bestStreak: card.metadata?.bestStreak || 0,
        algorithm: currentAlgorithm,

        // SM-2 specific fields (if SM-2 card)
        easeFactor: card.metadata?.easeFactor,
        repetitions: card.metadata?.repetitions,

        // FSRS specific fields (if FSRS card)
        stability: card.metadata?.stability,
        difficulty: card.metadata?.difficulty,
        retrievability: card.metadata?.retrievability,
        state: card.metadata?.state,
      },
    }

    // Calculate next SRS state using the appropriate algorithm
    const newSRS = algorithm.calculateNextReview(reviewableItem, reviewResult)

    // Update card metadata with new SRS data
    const updatedCard: FlashcardContent = {
      ...card,
      metadata: {
        ...card.metadata,
        // Algorithm identifier (preserve the algorithm type)
        algorithm: newSRS.algorithm,

        // SRS Core Data (common to both algorithms)
        status: newSRS.status as CardStatus,
        interval: newSRS.interval,
        lapses: isCorrect ? card.metadata?.lapses || 0 : (card.metadata?.lapses || 0) + 1,

        // SM-2 specific fields (will be undefined for FSRS cards)
        easeFactor: newSRS.easeFactor,
        repetitions: newSRS.repetitions,

        // FSRS specific fields (will be undefined for SM-2 cards)
        stability: newSRS.stability,
        difficulty: newSRS.difficulty,
        retrievability: newSRS.retrievability,
        state: newSRS.state,

        // Review Tracking
        lastReviewed: Date.now(),
        nextReview: newSRS.nextReviewAt
          ? newSRS.nextReviewAt.getTime()
          : Date.now() + newSRS.interval * 24 * 60 * 60 * 1000,
        reviewCount: newSRS.reviewCount,
        correctCount: newSRS.correctCount,

        // Performance Metrics
        averageResponseTime: this.calculateAverageResponseTime(
          card.metadata?.averageResponseTime,
          responseTime,
          card.metadata?.reviewCount || 0
        ),
        lastResponseTime: responseTime,
        streak: newSRS.streak,
        bestStreak: newSRS.bestStreak,

        // Learning Progress
        learningStep: this.calculateLearningStep(
          newSRS.status as CardStatus,
          card.metadata?.learningStep || 0,
          isCorrect
        ),
        graduatedAt:
          newSRS.status === 'review' && card.metadata?.status === 'learning'
            ? Date.now()
            : card.metadata?.graduatedAt,
      },
    }

    return updatedCard
  }

  /**
   * Calculate average response time
   */
  private static calculateAverageResponseTime(
    currentAverage?: number,
    newTime?: number,
    reviewCount?: number
  ): number {
    if (!newTime) return currentAverage || 0
    if (!currentAverage || !reviewCount || reviewCount === 0) return newTime

    // Weighted average
    return (currentAverage * reviewCount + newTime) / (reviewCount + 1)
  }

  /**
   * Calculate learning step progression
   */
  private static calculateLearningStep(
    status: CardStatus,
    currentStep: number,
    isCorrect: boolean
  ): number {
    if (status !== 'learning') return 0

    if (isCorrect) {
      return Math.min(currentStep + 1, 2) // Max 2 learning steps
    } else {
      return 0 // Reset to first step on failure
    }
  }

  /**
   * Get cards due for review
   */
  static getDueCards(cards: FlashcardContent[]): FlashcardContent[] {
    const now = Date.now()
    return cards.filter(card => {
      // New cards are always due
      if (card.metadata?.status === 'new' || !card.metadata?.status) {
        return true
      }

      // Check if card's next review time has passed
      if (card.metadata?.nextReview) {
        return card.metadata.nextReview <= now
      }

      // If no next review set, it's due
      return true
    })
  }

  /**
   * Sort cards by priority for review
   */
  static sortByPriority(cards: FlashcardContent[]): FlashcardContent[] {
    const now = Date.now()

    return cards.sort((a, b) => {
      // Priority calculation
      const getPriority = (card: FlashcardContent): number => {
        let priority = 0

        // Overdue cards get highest priority
        if (card.metadata?.nextReview && card.metadata.nextReview < now) {
          const overdueDays = (now - card.metadata.nextReview) / (24 * 60 * 60 * 1000)
          priority += Math.min(100, overdueDays * 10)
        }

        // Failed cards get high priority
        if (card.metadata?.lapses) {
          priority += card.metadata.lapses * 20
        }

        // Learning cards get medium priority
        if (card.metadata?.status === 'learning') {
          priority += 30
        }

        // New cards get base priority
        if (card.metadata?.status === 'new' || !card.metadata?.status) {
          priority += 20
        }

        // Lower ease factor = higher priority
        if (card.metadata?.easeFactor) {
          priority += (2.5 - card.metadata.easeFactor) * 10
        }

        return priority
      }

      return getPriority(b) - getPriority(a)
    })
  }

  /**
   * Check if card is mastered (long-term retention achieved)
   */
  static isCardMastered(card: FlashcardContent): boolean {
    if (!card.metadata) return false

    return Boolean(
      card.metadata.status === 'mastered' ||
      (card.metadata.interval &&
        card.metadata.interval >= 21 && // 21+ day interval
        card.metadata.correctCount &&
        card.metadata.reviewCount &&
        card.metadata.correctCount / card.metadata.reviewCount >= 0.9) // 90% accuracy
    )
  }

  /**
   * Calculate card difficulty level for display
   */
  static getCardDifficultyLabel(card: FlashcardContent): 'easy' | 'medium' | 'hard' | 'very-hard' {
    if (!card.metadata) return 'medium'

    const easeFactor = card.metadata.easeFactor || 2.5
    const lapseRatio =
      card.metadata.lapses && card.metadata.reviewCount
        ? card.metadata.lapses / card.metadata.reviewCount
        : 0

    if (easeFactor >= 2.3 && lapseRatio < 0.1) return 'easy'
    if (easeFactor >= 2.0 && lapseRatio < 0.2) return 'medium'
    if (easeFactor >= 1.5 && lapseRatio < 0.4) return 'hard'
    return 'very-hard'
  }
}
