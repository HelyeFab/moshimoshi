/**
 * Integration Tests for TSFSRSWrapper
 *
 * Tests integration with:
 * - AlgorithmFactory
 * - Review workflows
 * - Session management
 * - Statistics tracking
 * - Multi-card scenarios
 * - Flashcard system compatibility
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { TSFSRSWrapper } from '../ts-fsrs-wrapper'
import { AlgorithmFactory } from '../algorithm-factory'
import { State } from 'ts-fsrs'
import {
  createNewCard,
  createLearningCard,
  createReviewCard,
  createMockReviewResult,
  createMockCard
} from './helpers/test-data-factory'
import {
  expectValidSRSData,
  expectReasonableInterval,
  expectCorrectStreakTracking
} from './helpers/assertion-helpers'
import {
  simulatePerfectSession,
  simulateMixedSession,
  simulateLearningProgression,
  simulateStudyPattern,
  calculateAverageInterval,
  calculateRetentionRate,
  isCardDue
} from './helpers/simulation-helpers'

describe('TSFSRSWrapper - Integration Tests', () => {
  let wrapper: TSFSRSWrapper

  beforeEach(() => {
    wrapper = new TSFSRSWrapper({
      enableFuzz: false
    })
  })

  // ========================================
  // AlgorithmFactory Integration
  // ========================================

  describe('AlgorithmFactory Integration', () => {
    it('should be created via AlgorithmFactory for FSRS cards', () => {
      const card = createReviewCard({ algorithm: 'fsrs' })

      const algorithm = AlgorithmFactory.fromSRSData(card.srsData)

      expect(algorithm).toBeInstanceOf(TSFSRSWrapper)
    })

    it('should be the default algorithm from factory', () => {
      const defaultAlgorithm = AlgorithmFactory.getDefault()

      expect(defaultAlgorithm).toBeInstanceOf(TSFSRSWrapper)
    })

    it('should handle card creation with factory', () => {
      const algorithm = AlgorithmFactory.create('fsrs')

      expect(algorithm).toBeInstanceOf(TSFSRSWrapper)
    })
  })

  // ========================================
  // Complete Review Workflows
  // ========================================

  describe('Complete Review Workflows', () => {
    it('should handle full learning progression: new -> learning -> review -> mastered', () => {
      const newCard = createNewCard()

      const progression = simulateLearningProgression(wrapper, newCard)

      // Verify each state
      expect(progression.newState.status).toBe('new')
      expect(progression.learningState.status).toBe('learning')
      expect(progression.reviewState.status).toBe('review')
      expect(progression.masteredState.status).toMatch(/review|mastered/)

      // Verify stats increased
      expect(progression.masteredState.reviewCount).toBeGreaterThan(progression.reviewState.reviewCount)
      expect(progression.masteredState.stability).toBeGreaterThan(progression.reviewState.stability!)
    })

    it('should handle 10-card study session', () => {
      const cards = Array.from({ length: 10 }, () => createNewCard())
      const results: any[] = []

      cards.forEach(card => {
        const result = wrapper.calculateNextReview(card, {
          correct: true,
          difficulty: 'good'
        })
        results.push(result)
      })

      // All should succeed
      expect(results).toHaveLength(10)
      results.forEach((srs, i) => {
        expectValidSRSData(srs, `card ${i}`)
        expect(srs.reviewCount).toBe(1)
        expect(srs.correctCount).toBe(1)
      })
    })

    it('should handle mixed session (new + learning + review)', () => {
      const newCards = [createNewCard(), createNewCard()]
      const learningCards = [createLearningCard(), createLearningCard()]
      const reviewCards = [createReviewCard()]

      const allCards = [...newCards, ...learningCards, ...reviewCards]
      const results: any[] = []

      allCards.forEach(card => {
        const result = wrapper.calculateNextReview(card, {
          correct: Math.random() > 0.3, // 70% accuracy
          difficulty: 'good'
        })
        results.push(result)
      })

      expect(results).toHaveLength(5)
      results.forEach((srs, i) => {
        expectValidSRSData(srs, `mixed card ${i}`)
      })
    })

    it('should handle perfect 30-day review simulation', () => {
      const card = createNewCard()

      const history = simulateStudyPattern(wrapper, card, 30, 'perfect')

      // Should have multiple reviews over 30 days
      expect(history.length).toBeGreaterThan(1)

      // Final card should have high retention
      const final = history[history.length - 1]
      expectValidSRSData(final, '30-day simulation')
      expect(final.correctCount).toBe(final.reviewCount) // 100% correct
      expect(final.interval).toBeGreaterThan(0)
    })

    it('should handle realistic 90-day study pattern', () => {
      const card = createNewCard()

      const history = simulateStudyPattern(wrapper, card, 90, 'realistic')

      // Calculate final metrics
      const retentionRate = calculateRetentionRate(history)
      const avgInterval = calculateAverageInterval(history)

      expect(retentionRate).toBeGreaterThan(0.7) // At least 70% retention
      expect(avgInterval).toBeGreaterThan(0)
      expect(history.length).toBeGreaterThan(5) // Multiple reviews
    })
  })

  // ========================================
  // Statistics Tracking
  // ========================================

  describe('Statistics Tracking', () => {
    it('should track review counts accurately', () => {
      const card = createNewCard()

      const srs1 = wrapper.calculateNextReview(card, { correct: true })
      const srs2 = wrapper.calculateNextReview(
        { ...card, srsData: srs1 },
        { correct: true }
      )
      const srs3 = wrapper.calculateNextReview(
        { ...card, srsData: srs2 },
        { correct: false }
      )

      expect(srs1.reviewCount).toBe(1)
      expect(srs2.reviewCount).toBe(2)
      expect(srs3.reviewCount).toBe(3)
    })

    it('should track correct counts accurately', () => {
      const card = createNewCard()

      const srs1 = wrapper.calculateNextReview(card, { correct: true })
      const srs2 = wrapper.calculateNextReview(
        { ...card, srsData: srs1 },
        { correct: true }
      )
      const srs3 = wrapper.calculateNextReview(
        { ...card, srsData: srs2 },
        { correct: false }
      )

      expect(srs1.correctCount).toBe(1)
      expect(srs2.correctCount).toBe(2)
      expect(srs3.correctCount).toBe(2) // No increase on fail
    })

    it('should track streak correctly', () => {
      const card = createNewCard()

      const srs1 = wrapper.calculateNextReview(card, { correct: true, difficulty: 'good' })
      const srs2 = wrapper.calculateNextReview(
        { ...card, srsData: srs1 },
        { correct: true, difficulty: 'good' }
      )
      const srs3 = wrapper.calculateNextReview(
        { ...card, srsData: srs2 },
        { correct: false, difficulty: 'again' }
      )
      const srs4 = wrapper.calculateNextReview(
        { ...card, srsData: srs3 },
        { correct: true, difficulty: 'good' }
      )

      expectCorrectStreakTracking(0, srs1.streak, srs1.bestStreak, 'correct')
      expectCorrectStreakTracking(srs1.streak, srs2.streak, srs2.bestStreak, 'correct')
      expectCorrectStreakTracking(srs2.streak, srs3.streak, srs3.bestStreak, 'incorrect')
      expectCorrectStreakTracking(srs3.streak, srs4.streak, srs4.bestStreak, 'correct')
    })

    it('should maintain best streak across reviews', () => {
      const card = createNewCard()

      // Build 5-card streak
      let current = card.srsData
      for (let i = 0; i < 5; i++) {
        current = wrapper.calculateNextReview(
          { ...card, srsData: current },
          { correct: true, difficulty: 'good' }
        )
      }
      expect(current.streak).toBe(5)
      expect(current.bestStreak).toBe(5)

      // Fail once
      current = wrapper.calculateNextReview(
        { ...card, srsData: current },
        { correct: false, difficulty: 'again' }
      )
      expect(current.streak).toBe(0)
      expect(current.bestStreak).toBe(5) // Best streak preserved

      // Build smaller streak
      for (let i = 0; i < 3; i++) {
        current = wrapper.calculateNextReview(
          { ...card, srsData: current },
          { correct: true, difficulty: 'good' }
        )
      }
      expect(current.streak).toBe(3)
      expect(current.bestStreak).toBe(5) // Still 5
    })

    it('should calculate accuracy correctly', () => {
      const card = createNewCard()

      const finalSRS = simulateMixedSession(wrapper, card, 100, 0.85)

      const accuracy = finalSRS.correctCount / finalSRS.reviewCount
      expect(accuracy).toBeGreaterThan(0.8)
      expect(accuracy).toBeLessThan(0.9)
    })
  })

  // ========================================
  // Due Date Calculations
  // ========================================

  describe('Due Date Calculations', () => {
    it('should set reasonable next review dates', () => {
      const card = createNewCard()

      const srs = wrapper.calculateNextReview(card, {
        correct: true,
        difficulty: 'good'
      })

      expectValidSRSData(srs, 'due date calculation')
      expect(srs.nextReviewAt).toBeInstanceOf(Date)
      expect(srs.nextReviewAt.getTime()).toBeGreaterThan(Date.now())
    })

    it('should calculate if card is due', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow

      const dueCard = createMockCard(undefined, { nextReviewAt: pastDate })
      const notDueCard = createMockCard(undefined, { nextReviewAt: futureDate })

      expect(isCardDue(dueCard.srsData)).toBe(true)
      expect(isCardDue(notDueCard.srsData)).toBe(false)
    })

    it('should increase intervals on successful reviews', () => {
      const card = createLearningCard()
      const oldInterval = card.srsData.interval

      const srs = wrapper.calculateNextReview(card, {
        correct: true,
        difficulty: 'good'
      })

      expectReasonableInterval(srs.interval, oldInterval, 'correct', 'interval increase')
    })
  })

  // ========================================
  // Multi-Card Scenarios
  // ========================================

  describe('Multi-Card Scenarios', () => {
    it('should handle 100 cards in sequence', () => {
      const cards = Array.from({ length: 100 }, () => createNewCard())

      const results = cards.map(card =>
        wrapper.calculateNextReview(card, { correct: true, difficulty: 'good' })
      )

      expect(results).toHaveLength(100)
      results.forEach((srs, i) => {
        expectValidSRSData(srs, `bulk card ${i}`)
      })
    })

    it('should handle deck with mixed states', () => {
      const deck = [
        ...Array.from({ length: 10 }, () => createNewCard()),
        ...Array.from({ length: 15 }, () => createLearningCard()),
        ...Array.from({ length: 25 }, () => createReviewCard())
      ]

      const processed = deck.map(card => {
        try {
          return wrapper.calculateNextReview(card, {
            correct: Math.random() > 0.2,
            difficulty: 'good'
          })
        } catch (error) {
          throw new Error(`Failed on card ${card.id}: ${error}`)
        }
      })

      expect(processed).toHaveLength(50)
      processed.forEach(srs => expectValidSRSData(srs, 'mixed deck'))
    })

    it('should process cards concurrently without interference', () => {
      const card1 = createNewCard()
      const card2 = createLearningCard()
      const card3 = createReviewCard()

      // Process in parallel
      const [srs1, srs2, srs3] = [
        wrapper.calculateNextReview(card1, { correct: true }),
        wrapper.calculateNextReview(card2, { correct: true }),
        wrapper.calculateNextReview(card3, { correct: false })
      ]

      // Each should have valid, independent results
      expectValidSRSData(srs1, 'concurrent card 1')
      expectValidSRSData(srs2, 'concurrent card 2')
      expectValidSRSData(srs3, 'concurrent card 3')

      // Results should not interfere
      expect(srs1.reviewCount).toBe(1)
      expect(srs2.reviewCount).toBe(3) // learning card starts with 2
      expect(srs3.reviewCount).toBe(6) // review card starts with 5
    })
  })

  // ========================================
  // Configuration & Customization
  // ========================================

  describe('Configuration & Customization', () => {
    it('should allow custom retention target', () => {
      const highRetentionWrapper = new TSFSRSWrapper({
        requestRetention: 0.95, // 95% target
        enableFuzz: false
      })

      const card = createReviewCard()
      const srs = highRetentionWrapper.calculateNextReview(card, {
        correct: true,
        difficulty: 'good'
      })

      expectValidSRSData(srs, 'high retention')
    })

    it('should allow custom maximum interval', () => {
      const shortIntervalWrapper = new TSFSRSWrapper({
        maximumInterval: 30, // Max 30 days
        enableFuzz: false
      })

      const card = createMockCard(undefined, {
        stability: 1000, // Very stable
        interval: 25
      })

      const srs = shortIntervalWrapper.calculateNextReview(card, {
        correct: true,
        difficulty: 'easy'
      })

      expect(srs.interval).toBeLessThanOrEqual(30)
    })

    it('should provide version information', () => {
      const version = wrapper.getVersion()

      expect(version).toEqual({
        library: 'ts-fsrs',
        algorithm: 'FSRS-6',
        parameters: 21
      })
    })
  })
})
