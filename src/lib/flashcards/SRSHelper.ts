/**
 * SRS Helper for Flashcards
 * Bridges flashcard system with the Universal Review Engine's SRS algorithm
 */

import { SRSAlgorithm } from '@/lib/review-engine/srs'
import type { FlashcardContent, CardStatus } from '@/types/flashcards'
import type { ReviewResult } from '@/lib/review-engine/srs'

export class FlashcardSRSHelper {
  private static srsAlgorithm = new SRSAlgorithm()

  /**
   * Convert difficulty response to quality rating for SRS
   */
  static difficultyToQuality(difficulty: 'again' | 'hard' | 'good' | 'easy'): number {
    const qualityMap = {
      'again': 1,  // Failed to recall
      'hard': 3,   // Difficult but correct
      'good': 4,   // Normal difficulty
      'easy': 5    // Very easy
    }
    return qualityMap[difficulty]
  }

  /**
   * Initialize SRS metadata for a new card
   */
  static initializeCardSRS(card: FlashcardContent): FlashcardContent {
    return {
      ...card,
      metadata: {
        ...card.metadata,
        status: 'new',
        interval: 0,
        easeFactor: 2.5,
        repetitions: 0,
        lapses: 0,
        lastReviewed: undefined,
        nextReview: Date.now(), // Due immediately
        reviewCount: 0,
        correctCount: 0,
        streak: 0,
        bestStreak: 0,
        learningStep: 0,
        createdAt: card.metadata?.createdAt || Date.now()
      }
    }
  }

  /**
   * Update card after review using SRS algorithm
   */
  static async updateCardAfterReview(
    card: FlashcardContent,
    difficulty: 'again' | 'hard' | 'good' | 'easy',
    responseTime: number
  ): Promise<FlashcardContent> {
    const quality = this.difficultyToQuality(difficulty)
    const isCorrect = difficulty !== 'again'

    // Create review result for SRS algorithm
    const reviewResult: ReviewResult = {
      correct: isCorrect,
      responseTime,
      confidence: quality as 1 | 2 | 3 | 4 | 5
    }

    // Convert card to SRS-compatible format
    const currentSRS = {
      interval: card.metadata?.interval || 0,
      easeFactor: card.metadata?.easeFactor || 2.5,
      repetitions: card.metadata?.repetitions || 0,
      lastReviewedAt: card.metadata?.lastReviewed ? new Date(card.metadata.lastReviewed) : null,
      nextReviewAt: card.metadata?.nextReview ? new Date(card.metadata.nextReview) : new Date(),
      status: card.metadata?.status || 'new' as CardStatus,
      reviewCount: card.metadata?.reviewCount || 0,
      correctCount: card.metadata?.correctCount || 0,
      streak: card.metadata?.streak || 0,
      bestStreak: card.metadata?.bestStreak || 0
    }

    // Calculate next SRS state
    const newSRS = this.srsAlgorithm.calculateNext(currentSRS, reviewResult, quality)

    // Update card metadata
    const updatedCard: FlashcardContent = {
      ...card,
      metadata: {
        ...card.metadata,
        // SRS Core Data
        status: newSRS.status as CardStatus,
        interval: newSRS.interval,
        easeFactor: newSRS.easeFactor,
        repetitions: newSRS.repetitions,
        lapses: isCorrect ? (card.metadata?.lapses || 0) : (card.metadata?.lapses || 0) + 1,

        // Review Tracking
        lastReviewed: Date.now(),
        nextReview: newSRS.nextReviewAt ? newSRS.nextReviewAt.getTime() : Date.now() + (newSRS.interval * 24 * 60 * 60 * 1000),
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
        learningStep: this.calculateLearningStep(newSRS.status as CardStatus, card.metadata?.learningStep || 0, isCorrect),
        graduatedAt: newSRS.status === 'review' && card.metadata?.status === 'learning'
          ? Date.now()
          : card.metadata?.graduatedAt
      }
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
    if (!currentAverage || reviewCount === 0) return newTime

    // Weighted average
    return ((currentAverage * reviewCount) + newTime) / (reviewCount + 1)
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

    return (
      card.metadata.status === 'mastered' ||
      (card.metadata.interval && card.metadata.interval >= 21 && // 21+ day interval
       card.metadata.correctCount && card.metadata.reviewCount &&
       (card.metadata.correctCount / card.metadata.reviewCount) >= 0.9) // 90% accuracy
    )
  }

  /**
   * Calculate card difficulty level for display
   */
  static getCardDifficultyLabel(card: FlashcardContent): 'easy' | 'medium' | 'hard' | 'very-hard' {
    if (!card.metadata) return 'medium'

    const easeFactor = card.metadata.easeFactor || 2.5
    const lapseRatio = card.metadata.lapses && card.metadata.reviewCount
      ? card.metadata.lapses / card.metadata.reviewCount
      : 0

    if (easeFactor >= 2.3 && lapseRatio < 0.1) return 'easy'
    if (easeFactor >= 2.0 && lapseRatio < 0.2) return 'medium'
    if (easeFactor >= 1.5 && lapseRatio < 0.4) return 'hard'
    return 'very-hard'
  }
}