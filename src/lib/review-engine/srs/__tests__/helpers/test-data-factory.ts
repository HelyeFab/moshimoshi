/**
 * Test Data Factory - Create realistic test data for FSRS testing
 */

import { SRSData, ReviewableContent, ReviewableContentWithSRS } from '../../../core/interfaces'
import { ReviewResult } from '../../algorithm'
import { State } from 'ts-fsrs'

/**
 * Create a mock ReviewableContent item
 */
export function createMockContent(overrides?: Partial<ReviewableContent>): ReviewableContent {
  return {
    id: `test-${Date.now()}-${Math.random()}`,
    contentType: 'vocabulary',
    primaryDisplay: 'こんにちは',
    difficulty: 0.5,
    tags: [],
    supportedModes: ['recognition'],
    primaryAnswer: 'hello',
    ...overrides
  }
}

/**
 * Create a mock SRSData with realistic values
 */
export function createMockSRSData(overrides?: Partial<SRSData>): SRSData {
  const now = new Date()
  return {
    interval: 1,
    lastReviewedAt: now,
    nextReviewAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // +1 day
    status: 'learning',
    reviewCount: 1,
    correctCount: 1,
    streak: 1,
    bestStreak: 1,
    algorithm: 'fsrs',
    stability: 1.5,
    difficulty: 5.0,
    retrievability: 0.9,
    state: State.Learning,
    ...overrides
  }
}

/**
 * Create a ReviewableContentWithSRS
 */
export function createMockCard(
  contentOverrides?: Partial<ReviewableContent>,
  srsOverrides?: Partial<SRSData>
): ReviewableContentWithSRS {
  return {
    ...createMockContent(contentOverrides),
    srsData: createMockSRSData(srsOverrides)
  }
}

/**
 * Create a new card (never reviewed)
 */
export function createNewCard(overrides?: Partial<ReviewableContent>): ReviewableContentWithSRS {
  return {
    ...createMockContent(overrides),
    srsData: {
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
      difficulty: 5,
      retrievability: 1.0,
      state: State.New
    }
  }
}

/**
 * Create a learning card (in learning phase)
 */
export function createLearningCard(overrides?: Partial<SRSData>): ReviewableContentWithSRS {
  const now = new Date()
  return createMockCard(undefined, {
    interval: 0,
    lastReviewedAt: now,
    nextReviewAt: new Date(now.getTime() + 10 * 60 * 1000), // +10 minutes
    status: 'learning',
    reviewCount: 2,
    correctCount: 1,
    streak: 1,
    bestStreak: 1,
    algorithm: 'fsrs',
    stability: 0.5,
    difficulty: 6.0,
    retrievability: 0.95,
    state: State.Learning,
    ...overrides
  })
}

/**
 * Create a review card (graduated)
 */
export function createReviewCard(overrides?: Partial<SRSData>): ReviewableContentWithSRS {
  const now = new Date()
  return createMockCard(undefined, {
    interval: 7,
    lastReviewedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // -7 days
    nextReviewAt: now,
    status: 'review',
    reviewCount: 5,
    correctCount: 4,
    streak: 3,
    bestStreak: 4,
    algorithm: 'fsrs',
    stability: 10.0,
    difficulty: 5.5,
    retrievability: 0.85,
    state: State.Review,
    ...overrides
  })
}

/**
 * Create a mastered card (very stable)
 */
export function createMasteredCard(overrides?: Partial<SRSData>): ReviewableContentWithSRS {
  const now = new Date()
  return createMockCard(undefined, {
    interval: 100,
    lastReviewedAt: new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000), // -100 days
    nextReviewAt: now,
    status: 'mastered',
    reviewCount: 15,
    correctCount: 14,
    streak: 10,
    bestStreak: 10,
    algorithm: 'fsrs',
    stability: 150.0,
    difficulty: 4.0,
    retrievability: 0.92,
    state: State.Review,
    ...overrides
  })
}

/**
 * Create an overdue card
 */
export function createOverdueCard(daysOverdue: number): ReviewableContentWithSRS {
  const now = new Date()
  const lastReview = new Date(now.getTime() - (7 + daysOverdue) * 24 * 60 * 60 * 1000)
  const nextReview = new Date(now.getTime() - daysOverdue * 24 * 60 * 60 * 1000)

  return createMockCard(undefined, {
    interval: 7,
    lastReviewedAt: lastReview,
    nextReviewAt: nextReview,
    status: 'review',
    reviewCount: 5,
    correctCount: 4,
    streak: 3,
    bestStreak: 4,
    algorithm: 'fsrs',
    stability: 10.0,
    difficulty: 5.5,
    retrievability: 0.5,
    state: State.Review
  })
}

/**
 * Create a card with extreme values
 */
export function createExtremeCard(type: 'maxStability' | 'minStability' | 'maxDifficulty' | 'minDifficulty' | 'maxInterval'): ReviewableContentWithSRS {
  const now = new Date()
  const baseCard = createReviewCard()

  switch (type) {
    case 'maxStability':
      return createMockCard(undefined, {
        ...baseCard.srsData,
        stability: 10000,
        interval: 365,
        nextReviewAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
      })

    case 'minStability':
      return createMockCard(undefined, {
        ...baseCard.srsData,
        stability: 0.0001,
        interval: 0,
        nextReviewAt: now
      })

    case 'maxDifficulty':
      return createMockCard(undefined, {
        ...baseCard.srsData,
        difficulty: 10
      })

    case 'minDifficulty':
      return createMockCard(undefined, {
        ...baseCard.srsData,
        difficulty: 0
      })

    case 'maxInterval':
      return createMockCard(undefined, {
        ...baseCard.srsData,
        interval: 36500, // ~100 years
        nextReviewAt: new Date(now.getTime() + 36500 * 24 * 60 * 60 * 1000)
      })
  }
}

/**
 * Create a corrupt card (missing/invalid data)
 */
export function createCorruptCard(corruptionType: 'missingFields' | 'nanValues' | 'negativeValues' | 'invalidState'): Partial<ReviewableContentWithSRS> {
  const baseCard = createReviewCard()

  switch (corruptionType) {
    case 'missingFields':
      return {
        ...baseCard,
        srsData: {
          interval: 1,
          lastReviewedAt: new Date(),
          nextReviewAt: new Date(),
          status: 'review',
          reviewCount: 5,
          correctCount: 4,
          streak: 3,
          bestStreak: 4,
          algorithm: 'fsrs'
          // Missing: stability, difficulty, retrievability, state
        } as any
      }

    case 'nanValues':
      return {
        ...baseCard,
        srsData: {
          ...baseCard.srsData,
          stability: NaN,
          difficulty: NaN,
          retrievability: NaN
        }
      }

    case 'negativeValues':
      return {
        ...baseCard,
        srsData: {
          ...baseCard.srsData,
          interval: -5,
          stability: -10,
          difficulty: -2,
          reviewCount: -3
        }
      }

    case 'invalidState':
      return {
        ...baseCard,
        srsData: {
          ...baseCard.srsData,
          state: 999 as any, // Invalid state
          status: 'invalid' as any
        }
      }
  }
}

/**
 * Create a ReviewResult
 */
export function createMockReviewResult(overrides?: Partial<ReviewResult>): ReviewResult {
  return {
    correct: true,
    responseTime: 3000,
    difficulty: 'good',
    ...overrides
  }
}

/**
 * Create a review history (array of results)
 */
export function createReviewHistory(count: number, accuracy: number): ReviewResult[] {
  const results: ReviewResult[] = []

  for (let i = 0; i < count; i++) {
    const correct = Math.random() < accuracy
    results.push(createMockReviewResult({
      correct,
      difficulty: correct ? 'good' : 'again',
      responseTime: correct ? 3000 : 8000
    }))
  }

  return results
}

/**
 * Create a card at a specific date
 */
export function createCardAtDate(date: Date, overrides?: Partial<SRSData>): ReviewableContentWithSRS {
  return createMockCard(undefined, {
    lastReviewedAt: date,
    nextReviewAt: new Date(date.getTime() + 24 * 60 * 60 * 1000),
    ...overrides
  })
}

/**
 * Create an old FSRS card (FSRS-4 or FSRS-5 data format)
 */
export function createOldFSRSCard(version: 'fsrs-4' | 'fsrs-5'): any {
  const now = new Date()
  return {
    ...createMockContent(),
    srsData: {
      interval: 7,
      lastReviewedAt: now,
      nextReviewAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      status: 'review',
      reviewCount: 5,
      correctCount: 4,
      streak: 3,
      bestStreak: 4,
      algorithm: version,
      stability: 10.0,
      difficulty: 5.5,
      // Old FSRS might not have these fields
      retrievability: undefined,
      state: undefined
    }
  }
}

/**
 * Create an SM-2 card
 */
export function createSM2Card(): ReviewableContentWithSRS {
  const now = new Date()
  return {
    ...createMockContent(),
    srsData: {
      interval: 7,
      lastReviewedAt: now,
      nextReviewAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      status: 'review',
      reviewCount: 5,
      correctCount: 4,
      streak: 3,
      bestStreak: 4,
      algorithm: 'sm2',
      // SM-2 specific fields
      easeFactor: 2.5,
      // No FSRS fields
      stability: undefined,
      difficulty: undefined,
      retrievability: undefined,
      state: undefined
    } as any
  }
}
