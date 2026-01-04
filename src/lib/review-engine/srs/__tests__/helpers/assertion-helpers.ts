/**
 * Assertion Helpers - Custom assertions for FSRS testing
 */

import { SRSData } from '../../../core/interfaces'
import { State } from 'ts-fsrs'

/**
 * Assert that SRSData has all required fields and valid values
 */
export function expectValidSRSData(srsData: SRSData | undefined, message?: string): void {
  // Should exist
  expect(srsData).toBeDefined()
  if (!srsData) return

  // Required fields
  expect(srsData.interval).toBeDefined()
  expect(srsData.nextReviewAt).toBeDefined()
  expect(srsData.status).toBeDefined()
  expect(srsData.reviewCount).toBeDefined()
  expect(srsData.correctCount).toBeDefined()
  expect(srsData.streak).toBeDefined()
  expect(srsData.bestStreak).toBeDefined()
  expect(srsData.algorithm).toBeDefined()

  // Valid ranges
  expect(srsData.interval).toBeGreaterThanOrEqual(0)
  expect(srsData.reviewCount).toBeGreaterThanOrEqual(0)
  expect(srsData.correctCount).toBeGreaterThanOrEqual(0)
  expect(srsData.streak).toBeGreaterThanOrEqual(0)
  expect(srsData.bestStreak).toBeGreaterThanOrEqual(0)

  // Correctness <= reviewCount
  expect(srsData.correctCount).toBeLessThanOrEqual(srsData.reviewCount)

  // BestStreak >= streak
  expect(srsData.bestStreak).toBeGreaterThanOrEqual(srsData.streak)

  // Valid status
  expect(['new', 'learning', 'review', 'mastered']).toContain(srsData.status)

  // FSRS-specific fields
  if (srsData.algorithm === 'fsrs') {
    expect(srsData.stability).toBeDefined()
    expect(srsData.difficulty).toBeDefined()
    expect(srsData.state).toBeDefined()

    // Valid FSRS ranges
    if (srsData.stability !== undefined) {
      expect(srsData.stability).toBeGreaterThanOrEqual(0)
      expect(Number.isNaN(srsData.stability)).toBe(false)
      expect(Number.isFinite(srsData.stability)).toBe(true)
    }

    if (srsData.difficulty !== undefined) {
      expect(srsData.difficulty).toBeGreaterThanOrEqual(0)
      expect(srsData.difficulty).toBeLessThanOrEqual(10)
      expect(Number.isNaN(srsData.difficulty)).toBe(false)
    }

    if (srsData.retrievability !== undefined) {
      expect(srsData.retrievability).toBeGreaterThanOrEqual(0)
      expect(srsData.retrievability).toBeLessThanOrEqual(1)
      expect(Number.isNaN(srsData.retrievability)).toBe(false)
    }

    // Valid state
    const validStates = [State.New, State.Learning, State.Review, State.Relearning]
    expect(validStates).toContain(srsData.state)
  }
}

/**
 * Assert that stability is within a reasonable range
 */
export function expectStabilityInRange(
  stability: number | undefined,
  min: number,
  max: number,
  message?: string
): void {
  expect(stability).toBeDefined()
  if (stability === undefined) return

  expect(Number.isNaN(stability)).toBe(false)
  expect(Number.isFinite(stability)).toBe(true)
  expect(stability).toBeGreaterThanOrEqual(min)
  expect(stability).toBeLessThanOrEqual(max)
}

/**
 * Assert that difficulty is within valid range
 */
export function expectDifficultyInRange(
  difficulty: number | undefined,
  min: number,
  max: number,
  message?: string
): void {
  expect(difficulty).toBeDefined()
  if (difficulty === undefined) return

  expect(Number.isNaN(difficulty)).toBe(false)
  expect(difficulty).toBeGreaterThanOrEqual(min)
  expect(difficulty).toBeLessThanOrEqual(max)
}

/**
 * Assert that interval is reasonable compared to previous interval
 */
export function expectReasonableInterval(
  newInterval: number,
  oldInterval: number,
  result: 'correct' | 'incorrect',
  message?: string
): void {
  expect(Number.isNaN(newInterval)).toBe(false)
  expect(Number.isFinite(newInterval)).toBe(true)
  expect(newInterval).toBeGreaterThanOrEqual(0)
  expect(newInterval).toBeLessThanOrEqual(36500) // Max ~100 years

  if (result === 'correct') {
    // Correct answers should increase or maintain interval
    expect(newInterval).toBeGreaterThanOrEqual(oldInterval * 0.8)
  } else {
    // Incorrect answers should decrease interval
    expect(newInterval).toBeLessThan(oldInterval + 1)
  }
}

/**
 * Assert that dates are valid and in correct order
 */
export function expectValidDates(
  lastReviewedAt: Date | null,
  nextReviewAt: Date,
  message?: string
): void {
  expect(nextReviewAt).toBeInstanceOf(Date)
  expect(nextReviewAt.getTime()).not.toBeNaN()

  if (lastReviewedAt) {
    expect(lastReviewedAt).toBeInstanceOf(Date)
    expect(lastReviewedAt.getTime()).not.toBeNaN()

    // nextReviewAt should be after lastReviewedAt
    expect(nextReviewAt.getTime()).toBeGreaterThanOrEqual(lastReviewedAt.getTime())
  }
}

/**
 * Assert that retention rate is close to target
 */
export function expectRetentionRate(
  correctCount: number,
  totalCount: number,
  targetRate: number,
  tolerance: number,
  message?: string
): void {
  const actualRate = totalCount > 0 ? correctCount / totalCount : 0

  expect(actualRate).toBeGreaterThanOrEqual(targetRate - tolerance)
  expect(actualRate).toBeLessThanOrEqual(targetRate + tolerance)
}

/**
 * Assert that state transition is valid
 */
export function expectValidStateTransition(
  oldState: State,
  newState: State,
  result: 'correct' | 'incorrect',
  message?: string
): void {
  // Valid transitions on correct answer:
  // New -> Learning, Learning -> Learning/Review, Review -> Review, Relearning -> Review
  if (result === 'correct') {
    if (oldState === State.New) {
      expect([State.Learning, State.Review]).toContain(newState)
    } else if (oldState === State.Learning) {
      expect([State.Learning, State.Review]).toContain(newState)
    } else if (oldState === State.Review) {
      expect(newState).toBe(State.Review)
    } else if (oldState === State.Relearning) {
      expect([State.Relearning, State.Review]).toContain(newState)
    }
  } else {
    // Invalid transitions on incorrect answer:
    // New -> New/Learning, Learning -> Learning, Review -> Relearning, Relearning -> Relearning
    if (oldState === State.New) {
      expect([State.New, State.Learning]).toContain(newState)
    } else if (oldState === State.Learning) {
      expect([State.Learning, State.New]).toContain(newState)
    } else if (oldState === State.Review) {
      expect([State.Relearning, State.Learning]).toContain(newState)
    } else if (oldState === State.Relearning) {
      expect([State.Relearning, State.Learning]).toContain(newState)
    }
  }
}

/**
 * Assert that no data corruption occurred (no NaN, Infinity, etc.)
 */
export function expectNoDataCorruption(srsData: SRSData, message?: string): void {
  // Check all numeric fields
  const numericFields = ['interval', 'reviewCount', 'correctCount', 'streak', 'bestStreak']
  numericFields.forEach(field => {
    const value = (srsData as any)[field]
    if (value !== undefined) {
      expect(Number.isNaN(value)).toBe(false)
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  // Check FSRS-specific fields
  if (srsData.stability !== undefined) {
    expect(Number.isNaN(srsData.stability)).toBe(false)
    expect(Number.isFinite(srsData.stability)).toBe(true)
  }

  if (srsData.difficulty !== undefined) {
    expect(Number.isNaN(srsData.difficulty)).toBe(false)
    expect(Number.isFinite(srsData.difficulty)).toBe(true)
  }

  if (srsData.retrievability !== undefined) {
    expect(Number.isNaN(srsData.retrievability)).toBe(false)
    expect(Number.isFinite(srsData.retrievability)).toBe(true)
  }

  // Check dates
  if (srsData.lastReviewedAt) {
    expect(srsData.lastReviewedAt.getTime()).not.toBeNaN()
  }
  expect(srsData.nextReviewAt.getTime()).not.toBeNaN()
}

/**
 * Assert that a value is a reasonable FSRS stability value
 */
export function expectReasonableStability(stability: number | undefined, context: string): void {
  expect(stability).toBeDefined()
  if (!stability) return

  expect(Number.isNaN(stability)).toBe(false)
  expect(Number.isFinite(stability)).toBe(true)
  expect(stability).toBeGreaterThanOrEqual(0)
  expect(stability).toBeLessThan(50000) // Reasonable upper bound
}

/**
 * Assert that streak tracking is correct
 */
export function expectCorrectStreakTracking(
  oldStreak: number,
  newStreak: number,
  bestStreak: number,
  result: 'correct' | 'incorrect',
  message?: string
): void {
  if (result === 'correct') {
    expect(newStreak).toBe(oldStreak + 1)
    expect(bestStreak).toBe(Math.max(oldStreak + 1, bestStreak))
  } else {
    expect(newStreak).toBe(0)
    expect(bestStreak).toBeGreaterThanOrEqual(oldStreak)
  }
}
