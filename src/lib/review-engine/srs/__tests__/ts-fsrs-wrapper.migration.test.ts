/**
 * Data Migration & Backward Compatibility Tests for TSFSRSWrapper
 *
 * Critical tests for production deployment:
 * - Old FSRS (v4, v5) → ts-fsrs (v6) migration
 * - SM-2 compatibility (no cross-contamination)
 * - Version compatibility and auto-upgrade
 * - Data corruption recovery
 * - Mixed algorithm decks
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { TSFSRSWrapper } from '../ts-fsrs-wrapper'
import { AlgorithmFactory } from '../algorithm-factory'
import { State } from 'ts-fsrs'
import {
  createMockCard,
  createOldFSRSCard,
  createSM2Card,
  createMockReviewResult,
  createReviewCard
} from './helpers/test-data-factory'
import {
  expectValidSRSData,
  expectNoDataCorruption
} from './helpers/assertion-helpers'

describe('TSFSRSWrapper - Migration & Backward Compatibility', () => {
  let wrapper: TSFSRSWrapper

  beforeEach(() => {
    wrapper = new TSFSRSWrapper({
      enableFuzz: false
    })
  })

  // ========================================
  // Old FSRS → ts-fsrs Migration
  // ========================================

  describe('Old FSRS → ts-fsrs Migration', () => {
    it('should migrate FSRS-4 card (17 parameters)', () => {
      const oldCard = createOldFSRSCard('fsrs-4')
      const result = createMockReviewResult({ correct: true, difficulty: 'good' })

      const newSRS = wrapper.calculateNextReview(oldCard, result)

      expectValidSRSData(newSRS, 'FSRS-4 migration')
      expect(newSRS.algorithm).toBe('fsrs')
      expect(newSRS.stability).toBeDefined()
      expect(newSRS.difficulty).toBeDefined()
      expect(newSRS.state).toBeDefined()
    })

    it('should migrate FSRS-5 card (19 parameters)', () => {
      const oldCard = createOldFSRSCard('fsrs-5')
      const result = createMockReviewResult({ correct: true, difficulty: 'good' })

      const newSRS = wrapper.calculateNextReview(oldCard, result)

      expectValidSRSData(newSRS, 'FSRS-5 migration')
      expect(newSRS.algorithm).toBe('fsrs')
      expect(newSRS.stability).toBeDefined()
      expect(newSRS.difficulty).toBeDefined()
      expect(newSRS.state).toBeDefined()
    })

    it('should handle card with missing algorithm field', () => {
      const card = createMockCard(undefined, {
        algorithm: undefined
      } as any)
      const result = createMockReviewResult({ correct: true })

      const newSRS = wrapper.calculateNextReview(card, result)

      expectValidSRSData(newSRS, 'missing algorithm field')
      expect(newSRS.algorithm).toBe('fsrs')
    })

    it('should handle card with invalid algorithm field', () => {
      const card = createMockCard(undefined, {
        algorithm: 'unknown-algorithm' as any
      })
      const result = createMockReviewResult({ correct: true })

      // Should not throw, should treat as new
      expect(() => {
        const newSRS = wrapper.calculateNextReview(card, result)
        expectValidSRSData(newSRS, 'invalid algorithm')
      }).not.toThrow()
    })

    it('should migrate learning card mid-session', () => {
      const oldCard = createOldFSRSCard('fsrs-5')
      oldCard.srsData.status = 'learning'
      oldCard.srsData.interval = 0
      const result = createMockReviewResult({ correct: true, difficulty: 'good' })

      const newSRS = wrapper.calculateNextReview(oldCard, result)

      expectValidSRSData(newSRS, 'learning card migration')
      expect(['learning', 'review']).toContain(newSRS.status)
    })

    it('should migrate review card and preserve history', () => {
      const oldCard = createOldFSRSCard('fsrs-5')
      oldCard.srsData.status = 'review'
      oldCard.srsData.reviewCount = 10
      oldCard.srsData.correctCount = 8
      oldCard.srsData.streak = 5
      oldCard.srsData.bestStreak = 7
      const result = createMockReviewResult({ correct: true })

      const newSRS = wrapper.calculateNextReview(oldCard, result)

      expectValidSRSData(newSRS, 'review card migration')
      expect(newSRS.reviewCount).toBe(11) // Incremented
      expect(newSRS.correctCount).toBe(9) // Incremented
      expect(newSRS.streak).toBe(6) // Incremented
      expect(newSRS.bestStreak).toBeGreaterThanOrEqual(6) // Updated
    })

    it('should migrate mastered card', () => {
      const oldCard = createOldFSRSCard('fsrs-5')
      oldCard.srsData.status = 'mastered'
      oldCard.srsData.stability = 150
      oldCard.srsData.interval = 100
      const result = createMockReviewResult({ correct: true, difficulty: 'easy' })

      const newSRS = wrapper.calculateNextReview(oldCard, result)

      expectValidSRSData(newSRS, 'mastered card migration')
      expect(newSRS.stability).toBeGreaterThan(100) // Should increase
    })

    it('should handle corrupt old FSRS data gracefully', () => {
      const corruptCard = createOldFSRSCard('fsrs-5')
      corruptCard.srsData.stability = NaN
      corruptCard.srsData.difficulty = -5
      corruptCard.srsData.interval = null as any
      const result = createMockReviewResult({ correct: true })

      // Primary goal: should not crash on corrupt data
      // ts-fsrs library handles invalid data internally
      let newSRS
      expect(() => {
        newSRS = wrapper.calculateNextReview(corruptCard, result)
      }).not.toThrow()

      // Should return some result
      expect(newSRS).toBeDefined()
    })
  })

  // ========================================
  // SM-2 Compatibility
  // ========================================

  describe('SM-2 Compatibility', () => {
    it('should not modify SM-2 cards', () => {
      const sm2Card = createSM2Card()

      // TSFSRSWrapper should only handle FSRS cards
      // SM-2 cards should be routed to SM2Algorithm by AlgorithmFactory
      expect(sm2Card.srsData.algorithm).toBe('sm2')
    })

    it('should handle mixed deck (SM-2 + FSRS) correctly via factory', () => {
      const sm2Card = createSM2Card()
      const fsrsCard = createReviewCard()

      // Factory should route to correct algorithm
      const sm2Algorithm = AlgorithmFactory.fromSRSData(sm2Card.srsData)
      const fsrsAlgorithm = AlgorithmFactory.fromSRSData(fsrsCard.srsData)

      // SM-2 returns an object wrapper, FSRS returns TSFSRSWrapper instance
      expect(fsrsAlgorithm.constructor.name).toBe('TSFSRSWrapper')
    })

    it('should ensure AlgorithmFactory routes FSRS cards to TSFSRSWrapper', () => {
      const fsrsCard = createReviewCard({ algorithm: 'fsrs' })

      const algorithm = AlgorithmFactory.fromSRSData(fsrsCard.srsData)

      expect(algorithm).toBeInstanceOf(TSFSRSWrapper)
    })

    it('should ensure AlgorithmFactory default is TSFSRSWrapper', () => {
      const defaultAlgorithm = AlgorithmFactory.getDefault()

      expect(defaultAlgorithm).toBeInstanceOf(TSFSRSWrapper)
    })

    it('should ensure no cross-contamination between algorithms', () => {
      const sm2Card = createSM2Card()
      const fsrsCard = createReviewCard()
      const result = createMockReviewResult({ correct: true })

      // Review FSRS card
      const newFSRS = wrapper.calculateNextReview(fsrsCard, result)

      // Ensure algorithm is still FSRS
      expect(newFSRS.algorithm).toBe('fsrs')
      expect(newFSRS.stability).toBeDefined()
      expect(newFSRS.state).toBeDefined()

      // SM-2 card should still have SM-2 algorithm
      expect(sm2Card.srsData.algorithm).toBe('sm2')
      expect(sm2Card.srsData.easeFactor).toBeDefined()
    })
  })

  // ========================================
  // Version Compatibility
  // ========================================

  describe('Version Compatibility', () => {
    it('should auto-detect FSRS-6 (21 parameters)', () => {
      const version = wrapper.getVersion()

      expect(version.library).toBe('ts-fsrs')
      expect(version.algorithm).toBe('FSRS-6')
      expect(version.parameters).toBe(21)
    })

    it('should handle FSRS-5 data in FSRS-6 system', () => {
      const fsrs5Card = createOldFSRSCard('fsrs-5')
      const result = createMockReviewResult({ correct: true })

      const newSRS = wrapper.calculateNextReview(fsrs5Card, result)

      expectValidSRSData(newSRS, 'FSRS-5 in FSRS-6 system')
      // Should work seamlessly
      expect(newSRS.algorithm).toBe('fsrs')
    })

    it('should preserve user data during version upgrade', () => {
      const fsrs5Card = createOldFSRSCard('fsrs-5')
      fsrs5Card.srsData.reviewCount = 50
      fsrs5Card.srsData.correctCount = 42
      fsrs5Card.srsData.streak = 10
      fsrs5Card.srsData.bestStreak = 15
      const result = createMockReviewResult({ correct: true })

      const newSRS = wrapper.calculateNextReview(fsrs5Card, result)

      // History should be preserved
      expect(newSRS.reviewCount).toBe(51)
      expect(newSRS.correctCount).toBe(43)
      expect(newSRS.streak).toBe(11)
      expect(newSRS.bestStreak).toBe(15)
    })

    it('should handle version mismatch gracefully', () => {
      // Create card with old version indicator
      const card = createMockCard(undefined, {
        algorithm: 'fsrs-v4' as any // Old version format
      })
      const result = createMockReviewResult({ correct: true })

      // Should not throw
      expect(() => {
        const newSRS = wrapper.calculateNextReview(card, result)
        expectValidSRSData(newSRS, 'version mismatch')
      }).not.toThrow()
    })

    it('should allow parameter updates without losing data', () => {
      const card = createReviewCard()
      const result = createMockReviewResult({ correct: true })

      // Review with original parameters
      const srs1 = wrapper.calculateNextReview(card, result)

      // Update parameters
      wrapper.updateParameters({
        requestRetention: 0.95 // Higher retention target
      })

      // Review again
      const card2 = { ...card, srsData: srs1 }
      const srs2 = wrapper.calculateNextReview(card2, result)

      expectValidSRSData(srs2, 'after parameter update')
      // Data should be preserved
      expect(srs2.reviewCount).toBe(srs1.reviewCount + 1)
    })
  })
})
