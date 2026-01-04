/**
 * Simulation Helpers - Time-based simulation utilities
 */

import { SRSData, ReviewableContentWithSRS } from '../../../core/interfaces'
import { ReviewResult } from '../../algorithm'
import { TSFSRSWrapper } from '../../ts-fsrs-wrapper'
import { createMockReviewResult } from './test-data-factory'

/**
 * Simulate reviewing a card multiple times
 */
export function simulateReviews(
  wrapper: TSFSRSWrapper,
  card: ReviewableContentWithSRS,
  results: ReviewResult[]
): SRSData {
  let currentSRS = card.srsData

  for (const result of results) {
    const updatedCard = {
      ...card,
      srsData: currentSRS
    }
    currentSRS = wrapper.calculateNextReview(updatedCard, result)
  }

  return currentSRS
}

/**
 * Simulate a perfect study session (all correct)
 */
export function simulatePerfectSession(
  wrapper: TSFSRSWrapper,
  card: ReviewableContentWithSRS,
  reviewCount: number
): SRSData {
  const results: ReviewResult[] = Array(reviewCount)
    .fill(null)
    .map(() => createMockReviewResult({ correct: true, difficulty: 'good' }))

  return simulateReviews(wrapper, card, results)
}

/**
 * Simulate a poor study session (all incorrect)
 */
export function simulatePoorSession(
  wrapper: TSFSRSWrapper,
  card: ReviewableContentWithSRS,
  reviewCount: number
): SRSData {
  const results: ReviewResult[] = Array(reviewCount)
    .fill(null)
    .map(() => createMockReviewResult({ correct: false, difficulty: 'again' }))

  return simulateReviews(wrapper, card, results)
}

/**
 * Simulate a mixed study session (given accuracy rate)
 */
export function simulateMixedSession(
  wrapper: TSFSRSWrapper,
  card: ReviewableContentWithSRS,
  reviewCount: number,
  accuracy: number
): SRSData {
  const results: ReviewResult[] = Array(reviewCount)
    .fill(null)
    .map(() => {
      const correct = Math.random() < accuracy
      return createMockReviewResult({
        correct,
        difficulty: correct ? 'good' : 'again'
      })
    })

  return simulateReviews(wrapper, card, results)
}

/**
 * Simulate time passing (update dates)
 */
export function fastForwardTime(srsData: SRSData, days: number): SRSData {
  const millisecondsPerDay = 24 * 60 * 60 * 1000
  const offset = days * millisecondsPerDay

  return {
    ...srsData,
    lastReviewedAt: srsData.lastReviewedAt
      ? new Date(srsData.lastReviewedAt.getTime() - offset)
      : null,
    nextReviewAt: new Date(srsData.nextReviewAt.getTime() - offset)
  }
}

/**
 * Calculate how many days a card is overdue
 */
export function getDaysOverdue(srsData: SRSData): number {
  const now = new Date()
  const nextReview = new Date(srsData.nextReviewAt)
  const diffMs = now.getTime() - nextReview.getTime()
  const diffDays = diffMs / (24 * 60 * 60 * 1000)

  return Math.max(0, Math.floor(diffDays))
}

/**
 * Check if a card is due for review
 */
export function isCardDue(srsData: SRSData): boolean {
  const now = new Date()
  return new Date(srsData.nextReviewAt) <= now
}

/**
 * Simulate a learning progression: New -> Learning -> Review -> Mastered
 */
export function simulateLearningProgression(
  wrapper: TSFSRSWrapper,
  card: ReviewableContentWithSRS
): {
  newState: SRSData
  learningState: SRSData
  reviewState: SRSData
  masteredState: SRSData
} {
  // New -> Learning (first correct review)
  const learningState = wrapper.calculateNextReview(card, {
    correct: true,
    difficulty: 'good'
  })

  // Learning -> Review (multiple correct reviews to graduate)
  let reviewState = learningState
  for (let i = 0; i < 5; i++) {
    reviewState = wrapper.calculateNextReview(
      { ...card, srsData: reviewState },
      { correct: true, difficulty: 'good' }
    )
    if (reviewState.status === 'review') break
  }

  // Review -> Mastered (many successful reviews)
  let masteredState = reviewState
  for (let i = 0; i < 15; i++) {
    masteredState = wrapper.calculateNextReview(
      { ...card, srsData: masteredState },
      { correct: true, difficulty: 'good' }
    )

    // Fast forward time to simulate long-term retention
    if (i % 3 === 0) {
      masteredState = fastForwardTime(masteredState, masteredState.interval * 0.9)
    }
  }

  return {
    newState: card.srsData,
    learningState,
    reviewState,
    masteredState
  }
}

/**
 * Simulate forgetting (lapse): Review -> Relearning
 */
export function simulateForgetting(
  wrapper: TSFSRSWrapper,
  card: ReviewableContentWithSRS
): SRSData {
  // Make the card very overdue
  const overdueCard = {
    ...card,
    srsData: fastForwardTime(card.srsData, 30) // 30 days overdue
  }

  // Review and fail multiple times
  let currentSRS = overdueCard.srsData
  for (let i = 0; i < 3; i++) {
    currentSRS = wrapper.calculateNextReview(
      { ...overdueCard, srsData: currentSRS },
      { correct: false, difficulty: 'again' }
    )
  }

  return currentSRS
}

/**
 * Create a date at a specific offset from now
 */
export function createDateOffset(days: number, hours: number = 0, minutes: number = 0): Date {
  const now = new Date()
  const offset = days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000 + minutes * 60 * 1000
  return new Date(now.getTime() + offset)
}

/**
 * Create a date in the past
 */
export function createPastDate(days: number, hours: number = 0): Date {
  return createDateOffset(-days, -hours)
}

/**
 * Create a date in the future
 */
export function createFutureDate(days: number, hours: number = 0): Date {
  return createDateOffset(days, hours)
}

/**
 * Simulate a realistic study pattern over N days
 */
export function simulateStudyPattern(
  wrapper: TSFSRSWrapper,
  card: ReviewableContentWithSRS,
  days: number,
  pattern: 'perfect' | 'good' | 'poor' | 'realistic'
): SRSData[] {
  const history: SRSData[] = [card.srsData]
  let currentCard = card

  for (let day = 0; day < days; day++) {
    // Check if card is due
    const currentSRS = currentCard.srsData
    const dueDate = new Date(currentSRS.nextReviewAt)
    const today = createDateOffset(day)

    if (dueDate <= today) {
      // Review the card
      let result: ReviewResult

      switch (pattern) {
        case 'perfect':
          result = { correct: true, difficulty: 'easy' }
          break
        case 'good':
          result = { correct: Math.random() < 0.9, difficulty: 'good' }
          break
        case 'poor':
          result = { correct: Math.random() < 0.6, difficulty: Math.random() < 0.6 ? 'good' : 'again' }
          break
        case 'realistic':
          // Realistic pattern: 85% accuracy, varying difficulty
          const correct = Math.random() < 0.85
          const difficultyOptions = correct ? ['good', 'good', 'easy'] : ['again', 'hard']
          result = {
            correct,
            difficulty: difficultyOptions[Math.floor(Math.random() * difficultyOptions.length)] as any
          }
          break
      }

      const newSRS = wrapper.calculateNextReview(currentCard, result)
      history.push(newSRS)
      currentCard = { ...currentCard, srsData: newSRS }
    }
  }

  return history
}

/**
 * Calculate average interval from a study history
 */
export function calculateAverageInterval(history: SRSData[]): number {
  if (history.length === 0) return 0

  const totalInterval = history.reduce((sum, srs) => sum + srs.interval, 0)
  return totalInterval / history.length
}

/**
 * Calculate retention rate from a study history
 */
export function calculateRetentionRate(history: SRSData[]): number {
  if (history.length === 0) return 0

  const latest = history[history.length - 1]
  return latest.reviewCount > 0 ? latest.correctCount / latest.reviewCount : 0
}
