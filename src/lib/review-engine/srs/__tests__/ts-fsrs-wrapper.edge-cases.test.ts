/**
 * Edge Cases & Boundary Conditions Tests for TSFSRSWrapper
 *
 * Critical tests for production deployment:
 * - Extreme intervals (0, max, negative)
 * - Extreme stability (0, very high, NaN)
 * - Extreme difficulty (0, 10, negative)
 * - Overdue cards (1d, 7d, 30d, 100d+)
 * - Date edge cases (leap year, year boundary, far future)
 * - Null/undefined handling
 * - Data corruption scenarios
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { TSFSRSWrapper } from '../ts-fsrs-wrapper'
import { State } from 'ts-fsrs'
import {
  createMockCard,
  createExtremeCard,
  createOverdueCard,
  createCorruptCard,
  createMockReviewResult,
  createNewCard,
  createCardAtDate
} from './helpers/test-data-factory'
import {
  expectValidSRSData,
  expectStabilityInRange,
  expectDifficultyInRange,
  expectReasonableInterval,
  expectNoDataCorruption,
  expectReasonableStability
} from './helpers/assertion-helpers'
import { fastForwardTime } from './helpers/simulation-helpers'

describe('TSFSRSWrapper - Edge Cases & Boundary Conditions', () => {
  let wrapper: TSFSRSWrapper

  beforeEach(() => {
    wrapper = new TSFSRSWrapper({
      enableFuzz: false // Disable for deterministic tests
    })
  })

  // ========================================
  // Extreme Intervals
  // ========================================

  describe('Extreme Intervals', () => {
    it('should handle cards with max interval (36500 days)', () => {
      const card = createExtremeCard('maxInterval')
      const result = createMockReviewResult({ correct: true, difficulty: 'good' })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, 'max interval card')
      expectNoDataCorruption(newSRS, 'max interval card')
      expect(newSRS.interval).toBeLessThanOrEqual(36500)
    })

    it('should handle cards with 0 interval', () => {
      const card = createMockCard(undefined, { interval: 0, status: 'new' })
      const result = createMockReviewResult({ correct: true })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, 'zero interval card')
      expect(newSRS.interval).toBeGreaterThanOrEqual(0)
    })

    it('should handle cards approaching max interval (36000 days)', () => {
      const now = new Date()
      const card = createMockCard(undefined, {
        interval: 36000,
        stability: 10000,
        difficulty: 3,
        nextReviewAt: new Date(now.getTime() + 36000 * 24 * 60 * 60 * 1000),
        status: 'review'
      })
      const result = createMockReviewResult({ correct: true, difficulty: 'good' })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, 'approaching max interval')
      expect(newSRS.interval).toBeLessThanOrEqual(36500)
    })

    it('should gracefully handle negative intervals (data corruption)', () => {
      const card = createMockCard(undefined, { interval: -5 })
      const result = createMockReviewResult({ correct: true })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, 'negative interval recovery')
      expect(newSRS.interval).toBeGreaterThanOrEqual(0)
    })
  })

  // ========================================
  // Extreme Stability
  // ========================================

  describe('Extreme Stability', () => {
    it('should handle stability = 0 (new cards)', () => {
      const card = createNewCard()
      const result = createMockReviewResult({ correct: true, difficulty: 'good' })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, 'zero stability')
      expectReasonableStability(newSRS.stability, 'new card first review')
    })

    it('should handle very low stability (0.0001)', () => {
      const card = createExtremeCard('minStability')
      const result = createMockReviewResult({ correct: true, difficulty: 'good' })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, 'min stability')
      expectReasonableStability(newSRS.stability, 'after review with min stability')
    })

    it('should handle very high stability (10000)', () => {
      const card = createExtremeCard('maxStability')
      const result = createMockReviewResult({ correct: true, difficulty: 'good' })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, 'max stability')
      expectNoDataCorruption(newSRS, 'max stability')
      expect(newSRS.stability).toBeGreaterThan(0)
      expect(newSRS.stability).toBeLessThan(50000) // Reasonable upper bound
    })

    it('should handle NaN stability (data corruption)', () => {
      const corruptCard = createCorruptCard('nanValues') as any
      const result = createMockReviewResult({ correct: true })

      // Primary goal: should not crash the application
      // ts-fsrs will handle the corrupt data internally
      let newSRS
      expect(() => {
        newSRS = wrapper.calculateNextReview(corruptCard, result)
      }).not.toThrow()

      // Should return some result (even if not perfect)
      expect(newSRS).toBeDefined()
    })

    it('should handle negative stability (data corruption)', () => {
      const card = createMockCard(undefined, { stability: -10 })
      const result = createMockReviewResult({ correct: true })

      // Should not crash
      let newSRS
      expect(() => {
        newSRS = wrapper.calculateNextReview(card, result)
      }).not.toThrow()

      // Should return a result
      expect(newSRS).toBeDefined()
    })
  })

  // ========================================
  // Extreme Difficulty
  // ========================================

  describe('Extreme Difficulty', () => {
    it('should handle difficulty = 0 (minimum)', () => {
      const card = createExtremeCard('minDifficulty')
      const result = createMockReviewResult({ correct: false, difficulty: 'again' })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, 'min difficulty')
      expectDifficultyInRange(newSRS.difficulty, 0, 10, 'after failed review')
    })

    it('should handle difficulty = 10 (maximum)', () => {
      const card = createExtremeCard('maxDifficulty')
      const result = createMockReviewResult({ correct: true, difficulty: 'easy' })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, 'max difficulty')
      expectDifficultyInRange(newSRS.difficulty, 0, 10, 'after easy review')
    })

    it('should handle difficulty > 10 (data corruption)', () => {
      const card = createMockCard(undefined, { difficulty: 15 })
      const result = createMockReviewResult({ correct: true })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, 'over-max difficulty recovery')
      expectDifficultyInRange(newSRS.difficulty, 0, 10, 'recovered difficulty')
    })

    it('should handle negative difficulty (data corruption)', () => {
      const card = createMockCard(undefined, { difficulty: -3 })
      const result = createMockReviewResult({ correct: true })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, 'negative difficulty recovery')
      expectDifficultyInRange(newSRS.difficulty, 0, 10, 'recovered difficulty')
    })
  })

  // ========================================
  // Overdue Cards
  // ========================================

  describe('Overdue Cards', () => {
    it('should handle 1 day overdue card', () => {
      const card = createOverdueCard(1)
      const result = createMockReviewResult({ correct: true, difficulty: 'good' })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, '1 day overdue')
      expectReasonableInterval(newSRS.interval, card.srsData.interval, 'correct', '1 day overdue')
    })

    it('should handle 7 days overdue card (week)', () => {
      const card = createOverdueCard(7)
      const result = createMockReviewResult({ correct: true, difficulty: 'good' })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, '7 days overdue')
      expectReasonableInterval(newSRS.interval, card.srsData.interval, 'correct', '7 days overdue')
    })

    it('should handle 30 days overdue card (month)', () => {
      const card = createOverdueCard(30)
      const result = createMockReviewResult({ correct: true, difficulty: 'good' })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, '30 days overdue')
      expectNoDataCorruption(newSRS, '30 days overdue')
    })

    it('should handle 100+ days overdue card (severely overdue)', () => {
      const card = createOverdueCard(100)
      const result = createMockReviewResult({ correct: true, difficulty: 'good' })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, '100+ days overdue')
      expectNoDataCorruption(newSRS, '100+ days overdue')
    })

    it('should handle 365+ days overdue card (year+)', () => {
      const card = createOverdueCard(365)
      const result = createMockReviewResult({ correct: false, difficulty: 'again' })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, '365+ days overdue')
      // Failed review of very overdue card should reset to learning
      expect(['learning', 'new']).toContain(newSRS.status)
    })
  })

  // ========================================
  // Date Edge Cases
  // ========================================

  describe('Date Edge Cases', () => {
    it('should handle leap year (Feb 29)', () => {
      const leapYearDate = new Date('2024-02-29T12:00:00Z')
      const card = createCardAtDate(leapYearDate, {
        interval: 1,
        nextReviewAt: new Date('2024-03-01T12:00:00Z')
      })
      const result = createMockReviewResult({ correct: true })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, 'leap year')
      expect(newSRS.nextReviewAt.getTime()).not.toBeNaN()
    })

    it('should handle year boundary (Dec 31 -> Jan 1)', () => {
      const endOfYear = new Date('2025-12-31T23:59:59Z')
      const card = createCardAtDate(endOfYear, {
        interval: 1,
        nextReviewAt: new Date('2026-01-01T00:00:00Z')
      })
      const result = createMockReviewResult({ correct: true })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, 'year boundary')
      expect(newSRS.nextReviewAt.getFullYear()).toBeGreaterThanOrEqual(2026)
    })

    it('should handle far future dates (2050+)', () => {
      const farFuture = new Date('2050-01-01T00:00:00Z')
      const card = createCardAtDate(farFuture, {
        interval: 100,
        nextReviewAt: new Date('2050-04-11T00:00:00Z'),
        status: 'review',
        reviewCount: 5,
        correctCount: 4
      })
      const result = createMockReviewResult({ correct: true })

      // Should not crash on far future dates
      let newSRS
      expect(() => {
        newSRS = wrapper.calculateNextReview(card, result)
      }).not.toThrow()

      expect(newSRS).toBeDefined()
      expect(newSRS.nextReviewAt).toBeInstanceOf(Date)
    })

    it('should handle cards reviewed "in the future" (clock skew)', () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24) // +1 day
      const card = createCardAtDate(future, {
        lastReviewedAt: future,
        nextReviewAt: future
      })
      const result = createMockReviewResult({ correct: true })

      // Should not throw
      expect(() => {
        const newSRS = wrapper.calculateNextReview(card, result)
        expectValidSRSData(newSRS, 'future clock skew')
      }).not.toThrow()
    })
  })

  // ========================================
  // Null/Undefined Handling
  // ========================================

  describe('Null/Undefined Handling', () => {
    it('should handle missing srsData (new card initialization)', () => {
      const content = {
        id: 'test-1',
        contentType: 'vocabulary' as const,
        primaryDisplay: 'test',
        difficulty: 0.5,
        tags: [],
        supportedModes: ['recognition' as const],
        primaryAnswer: 'answer'
      }

      const srsData = wrapper.initializeCardSRS(content)

      expectValidSRSData(srsData, 'initialized from no srsData')
      expect(srsData.status).toBe('new')
      expect(srsData.reviewCount).toBe(0)
    })

    it('should handle null lastReviewedAt', () => {
      const card = createNewCard()
      const result = createMockReviewResult({ correct: true })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, 'null lastReviewedAt')
      expect(newSRS.lastReviewedAt).not.toBeNull()
    })

    it('should handle undefined stability/difficulty gracefully', () => {
      const card = createMockCard(undefined, {
        stability: undefined,
        difficulty: undefined,
        reviewCount: 1,
        correctCount: 1
      } as any)
      const result = createMockReviewResult({ correct: true })

      // Should not crash with undefined FSRS fields
      let newSRS
      expect(() => {
        newSRS = wrapper.calculateNextReview(card, result)
      }).not.toThrow()

      // Should return a result
      expect(newSRS).toBeDefined()
    })

    it('should handle partial srsData (missing optional fields)', () => {
      const partialCard = createCorruptCard('missingFields') as any
      const result = createMockReviewResult({ correct: true })

      // Should not throw
      expect(() => {
        wrapper.calculateNextReview(partialCard, result)
      }).not.toThrow()
    })
  })
})
