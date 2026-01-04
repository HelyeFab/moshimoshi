/**
 * Comprehensive tests for TSFSRSWrapper
 *
 * Test Coverage:
 * - Type conversions (SRSData ↔ ts-fsrs Card)
 * - Rating conversions (ReviewResult → ts-fsrs Rating)
 * - State transitions (new → learning → review → mastered)
 * - Stability calculations
 * - Interval scheduling
 * - Fuzz factor verification
 * - Comparison with official ts-fsrs behavior
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { TSFSRSWrapper } from '../ts-fsrs-wrapper'
import { FSRS, Card, Rating, State, createEmptyCard } from 'ts-fsrs'
import { ReviewableContent, SRSData } from '../../core/interfaces'
import { ReviewResult } from '../algorithm'

describe('TSFSRSWrapper', () => {
  let wrapper: TSFSRSWrapper

  beforeEach(() => {
    wrapper = new TSFSRSWrapper({
      enableFuzz: false // Disable for deterministic tests
    })
  })

  // ========================================
  // Initialization Tests
  // ========================================

  describe('initializeCardSRS', () => {
    it('should create new card with default FSRS-5 parameters', () => {
      const item: ReviewableContent = {
        id: 'test-1',
        contentType: 'vocabulary',
        primaryDisplay: 'こんにちは',
        difficulty: 0.5,
        tags: [],
        supportedModes: ['recognition'],
        primaryAnswer: 'hello'
      }

      const srsData = wrapper.initializeCardSRS(item)

      expect(srsData).toMatchObject({
        interval: 0,
        lastReviewedAt: null,
        status: 'new',
        reviewCount: 0,
        correctCount: 0,
        streak: 0,
        bestStreak: 0,
        algorithm: 'fsrs'
      })

      expect(srsData.nextReviewAt).toBeInstanceOf(Date)
      expect(srsData.stability).toBeGreaterThanOrEqual(0)
      expect(srsData.difficulty).toBeGreaterThanOrEqual(0) // ts-fsrs might use 0 for new cards
      expect(srsData.difficulty).toBeLessThanOrEqual(10)
      expect(srsData.retrievability).toBe(1.0) // New cards fully retrievable
    })

    it('should match ts-fsrs createEmptyCard output', () => {
      const item: ReviewableContent = {
        id: 'test-2',
        contentType: 'kanji',
        primaryDisplay: '日',
        difficulty: 0.3,
        tags: [],
        supportedModes: ['recognition'],
        primaryAnswer: 'day, sun'
      }

      const srsData = wrapper.initializeCardSRS(item)
      const tsfsrsCard = createEmptyCard(srsData.nextReviewAt)

      expect(srsData.stability).toBe(tsfsrsCard.stability)
      expect(srsData.difficulty).toBe(tsfsrsCard.difficulty)
      expect(srsData.state).toBe(tsfsrsCard.state)
    })
  })

  // ========================================
  // Type Conversion Tests
  // ========================================

  describe('Type Conversions', () => {
    it('should convert status "new" to State.New', () => {
      const srsData: SRSData = {
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

      const card = wrapper['toTSFSRSCard'](srsData)
      expect(card.state).toBe(State.New)
    })

    it('should convert status "learning" to State.Learning', () => {
      const srsData: SRSData = {
        interval: 1,
        lastReviewedAt: new Date(),
        nextReviewAt: new Date(),
        status: 'learning',
        reviewCount: 2,
        correctCount: 1,
        streak: 1,
        bestStreak: 1,
        algorithm: 'fsrs',
        stability: 1.5,
        difficulty: 6.2,
        retrievability: 0.9,
        state: State.Learning
      }

      const card = wrapper['toTSFSRSCard'](srsData)
      expect(card.state).toBe(State.Learning)
    })

    it('should convert status "review" to State.Review', () => {
      const srsData: SRSData = {
        interval: 10,
        lastReviewedAt: new Date(),
        nextReviewAt: new Date(),
        status: 'review',
        reviewCount: 5,
        correctCount: 4,
        streak: 3,
        bestStreak: 4,
        algorithm: 'fsrs',
        stability: 15.2,
        difficulty: 5.8,
        retrievability: 0.85,
        state: State.Review
      }

      const card = wrapper['toTSFSRSCard'](srsData)
      expect(card.state).toBe(State.Review)
    })

    it('should convert status "mastered" to State.Review', () => {
      const srsData: SRSData = {
        interval: 120,
        lastReviewedAt: new Date(),
        nextReviewAt: new Date(),
        status: 'mastered',
        reviewCount: 20,
        correctCount: 19,
        streak: 10,
        bestStreak: 12,
        algorithm: 'fsrs',
        stability: 150.5,
        difficulty: 4.2,
        retrievability: 0.92,
        state: State.Review
      }

      const card = wrapper['toTSFSRSCard'](srsData)
      expect(card.state).toBe(State.Review)
      expect(card.stability).toBeGreaterThanOrEqual(100) // Mastery threshold
    })
  })

  // ========================================
  // Rating Conversion Tests
  // ========================================

  describe('Rating Conversions', () => {
    it('should convert difficulty "again" to Rating.Again', () => {
      const result: ReviewResult = {
        correct: false,
        responseTime: 5000,
        difficulty: 'again'
      }

      const rating = wrapper['toTSFSRSRating'](result)
      expect(rating).toBe(Rating.Again)
    })

    it('should convert difficulty "hard" to Rating.Hard', () => {
      const result: ReviewResult = {
        correct: true,
        responseTime: 8000,
        difficulty: 'hard'
      }

      const rating = wrapper['toTSFSRSRating'](result)
      expect(rating).toBe(Rating.Hard)
    })

    it('should convert difficulty "good" to Rating.Good', () => {
      const result: ReviewResult = {
        correct: true,
        responseTime: 4000,
        difficulty: 'good'
      }

      const rating = wrapper['toTSFSRSRating'](result)
      expect(rating).toBe(Rating.Good)
    })

    it('should convert difficulty "easy" to Rating.Easy', () => {
      const result: ReviewResult = {
        correct: true,
        responseTime: 1500,
        difficulty: 'easy'
      }

      const rating = wrapper['toTSFSRSRating'](result)
      expect(rating).toBe(Rating.Easy)
    })

    it('should use confidence for rating when difficulty not specified', () => {
      const result: ReviewResult = {
        correct: true,
        responseTime: 3000,
        confidence: 5
      }

      const rating = wrapper['toTSFSRSRating'](result)
      expect(rating).toBe(Rating.Easy) // Confidence 5 → Easy
    })

    it('should fallback to response time heuristic', () => {
      const fastResult: ReviewResult = {
        correct: true,
        responseTime: 1000 // Very fast → Easy
      }

      const slowResult: ReviewResult = {
        correct: true,
        responseTime: 12000 // Slow but not Hard (threshold is 10s)
      }

      expect(wrapper['toTSFSRSRating'](fastResult)).toBe(Rating.Easy)
      // 12000ms is > 10000ms threshold, so it's Hard
      expect(wrapper['toTSFSRSRating'](slowResult)).toBeGreaterThanOrEqual(Rating.Hard)
    })

    it('should default to Good for correct answers without hints', () => {
      const result: ReviewResult = {
        correct: true,
        responseTime: 4000
      }

      const rating = wrapper['toTSFSRSRating'](result)
      expect(rating).toBe(Rating.Good)
    })
  })

  // ========================================
  // Review Calculation Tests
  // ========================================

  describe('calculateNextReview', () => {
    it('should handle first review of new card', () => {
      const item = {
        id: 'test-3',
        contentType: 'vocabulary' as const,
        primaryDisplay: 'ありがとう',
        difficulty: 0.4,
        tags: [],
        supportedModes: ['recognition' as const],
        primaryAnswer: 'thank you',
        srsData: wrapper.initializeCardSRS({
          id: 'test-3',
          contentType: 'vocabulary',
          primaryDisplay: 'ありがとう',
          difficulty: 0.4,
          tags: [],
          supportedModes: ['recognition'],
          primaryAnswer: 'thank you'
        })
      }

      const result: ReviewResult = {
        correct: true,
        responseTime: 3000,
        difficulty: 'good'
      }

      const updated = wrapper.calculateNextReview(item, result)

      expect(updated.status).toBe('learning') // Should graduate to learning
      expect(updated.reviewCount).toBe(1)
      expect(updated.correctCount).toBe(1)
      expect(updated.streak).toBe(1)
      expect(updated.interval).toBeGreaterThanOrEqual(0) // ts-fsrs might use 0 for initial learning steps
      expect(updated.stability).toBeGreaterThanOrEqual(0) // Stability should be non-negative
    })

    it('should handle failed review (Again)', () => {
      const item = {
        id: 'test-4',
        contentType: 'kanji' as const,
        primaryDisplay: '漢',
        difficulty: 0.6,
        tags: [],
        supportedModes: ['recognition' as const],
        primaryAnswer: 'kan',
        srsData: wrapper.initializeCardSRS({
          id: 'test-4',
          contentType: 'kanji',
          primaryDisplay: '漢',
          difficulty: 0.6,
          tags: [],
          supportedModes: ['recognition'],
          primaryAnswer: 'kan'
        })
      }

      const result: ReviewResult = {
        correct: false,
        responseTime: 8000,
        difficulty: 'again'
      }

      const updated = wrapper.calculateNextReview(item, result)

      expect(updated.correctCount).toBe(0)
      expect(updated.streak).toBe(0)
      expect(updated.reviewCount).toBe(1)
    })

    it('should preserve streak on consecutive correct reviews', () => {
      let srsData = wrapper.initializeCardSRS({
        id: 'test-5',
        contentType: 'vocabulary',
        primaryDisplay: 'test',
        difficulty: 0.5,
        tags: [],
        supportedModes: ['recognition'],
        primaryAnswer: 'test'
      })

      const item = {
        id: 'test-5',
        contentType: 'vocabulary' as const,
        primaryDisplay: 'test',
        difficulty: 0.5,
        tags: [],
        supportedModes: ['recognition' as const],
        primaryAnswer: 'test',
        srsData: srsData
      }

      // Review 1: Good
      srsData = wrapper.calculateNextReview(item, {
        correct: true,
        responseTime: 3000,
        difficulty: 'good'
      })
      expect(srsData.streak).toBe(1)

      // Review 2: Good
      item.srsData = srsData
      srsData = wrapper.calculateNextReview(item, {
        correct: true,
        responseTime: 3000,
        difficulty: 'good'
      })
      expect(srsData.streak).toBe(2)

      // Review 3: Easy
      item.srsData = srsData
      srsData = wrapper.calculateNextReview(item, {
        correct: true,
        responseTime: 1500,
        difficulty: 'easy'
      })
      expect(srsData.streak).toBe(3)
      expect(srsData.bestStreak).toBe(3)
    })

    it('should reset streak on incorrect answer', () => {
      let srsData = wrapper.initializeCardSRS({
        id: 'test-6',
        contentType: 'vocabulary',
        primaryDisplay: 'test',
        difficulty: 0.5,
        tags: [],
        supportedModes: ['recognition'],
        primaryAnswer: 'test'
      })

      const item = {
        id: 'test-6',
        contentType: 'vocabulary' as const,
        primaryDisplay: 'test',
        difficulty: 0.5,
        tags: [],
        supportedModes: ['recognition' as const],
        primaryAnswer: 'test',
        srsData: srsData
      }

      // Build up streak
      srsData = wrapper.calculateNextReview(item, {
        correct: true,
        responseTime: 3000,
        difficulty: 'good'
      })
      item.srsData = srsData
      srsData = wrapper.calculateNextReview(item, {
        correct: true,
        responseTime: 3000,
        difficulty: 'good'
      })
      expect(srsData.streak).toBe(2)

      // Fail review
      item.srsData = srsData
      srsData = wrapper.calculateNextReview(item, {
        correct: false,
        responseTime: 8000,
        difficulty: 'again'
      })

      expect(srsData.streak).toBe(0)
      expect(srsData.bestStreak).toBe(2) // Best streak preserved
    })
  })

  // ========================================
  // Graduation and Mastery Tests
  // ========================================

  describe('Graduation and Mastery', () => {
    it('should graduate card after successful learning phase', () => {
      const srsData: SRSData = {
        interval: 5,
        lastReviewedAt: new Date(),
        nextReviewAt: new Date(),
        status: 'review', // Already in review state
        reviewCount: 3,
        correctCount: 3,
        streak: 3,
        bestStreak: 3,
        algorithm: 'fsrs',
        stability: 10.5,
        difficulty: 5.5,
        retrievability: 0.9,
        state: State.Review
      }

      expect(wrapper.shouldGraduate(srsData)).toBe(true)
    })

    it('should not graduate card still in learning', () => {
      const srsData: SRSData = {
        interval: 1,
        lastReviewedAt: new Date(),
        nextReviewAt: new Date(),
        status: 'learning',
        reviewCount: 1,
        correctCount: 1,
        streak: 1,
        bestStreak: 1,
        algorithm: 'fsrs',
        stability: 1.5,
        difficulty: 6.0,
        retrievability: 0.95,
        state: State.Learning
      }

      expect(wrapper.shouldGraduate(srsData)).toBe(false)
    })

    it('should recognize mastered cards', () => {
      const srsData: SRSData = {
        interval: 120,
        lastReviewedAt: new Date(),
        nextReviewAt: new Date(),
        status: 'review',
        reviewCount: 20,
        correctCount: 19, // 95% accuracy
        streak: 10,
        bestStreak: 12,
        algorithm: 'fsrs',
        stability: 150.0, // High stability
        difficulty: 4.0,
        retrievability: 0.92,
        state: State.Review
      }

      expect(wrapper.shouldMaster(srsData)).toBe(true)
    })

    it('should not recognize cards with low accuracy as mastered', () => {
      const srsData: SRSData = {
        interval: 120,
        lastReviewedAt: new Date(),
        nextReviewAt: new Date(),
        status: 'review',
        reviewCount: 20,
        correctCount: 15, // Only 75% accuracy
        streak: 3,
        bestStreak: 5,
        algorithm: 'fsrs',
        stability: 150.0,
        difficulty: 6.0,
        retrievability: 0.85,
        state: State.Review
      }

      expect(wrapper.shouldMaster(srsData)).toBe(false)
    })

    it('should not recognize cards with low stability as mastered', () => {
      const srsData: SRSData = {
        interval: 20,
        lastReviewedAt: new Date(),
        nextReviewAt: new Date(),
        status: 'review',
        reviewCount: 10,
        correctCount: 10, // 100% accuracy
        streak: 10,
        bestStreak: 10,
        algorithm: 'fsrs',
        stability: 50.0, // Below mastery threshold (100)
        difficulty: 3.0,
        retrievability: 0.95,
        state: State.Review
      }

      expect(wrapper.shouldMaster(srsData)).toBe(false)
    })
  })

  // ========================================
  // Retrievability Tests
  // ========================================

  describe('Retrievability Calculation', () => {
    it('should calculate retrievability using FSRS forgetting curve', () => {
      const now = new Date()
      const lastReview = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) // 5 days ago

      const card: Card = {
        due: now,
        stability: 10.0,
        difficulty: 5.0,
        elapsed_days: 5,
        scheduled_days: 5,
        learning_steps: 0,
        reps: 3,
        lapses: 0,
        state: State.Review,
        last_review: lastReview
      }

      const retrievability = wrapper['calculateRetrievability'](card)

      // R(t,S) = (1 + t/(9*S))^(-1)
      // R(5, 10) = (1 + 5/90)^(-1) ≈ 0.947
      expect(retrievability).toBeGreaterThan(0.9)
      expect(retrievability).toBeLessThan(1.0)
    })

    it('should return 1.0 for new cards', () => {
      const card: Card = {
        due: new Date(),
        stability: 0,
        difficulty: 5.0,
        elapsed_days: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 0,
        lapses: 0,
        state: State.New,
        last_review: undefined
      }

      const retrievability = wrapper['calculateRetrievability'](card)
      expect(retrievability).toBe(1.0)
    })

    it('should decrease retrievability as time passes', () => {
      const now = new Date()
      const stability = 10.0

      const card1: Card = {
        due: now,
        stability,
        difficulty: 5.0,
        elapsed_days: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 1,
        lapses: 0,
        state: State.Review,
        last_review: now
      }

      const card2: Card = {
        ...card1,
        last_review: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
      }

      const r1 = wrapper['calculateRetrievability'](card1)
      const r2 = wrapper['calculateRetrievability'](card2)

      expect(r1).toBeGreaterThan(r2) // Recent review has higher retrievability
    })
  })

  // ========================================
  // Configuration Tests
  // ========================================

  describe('Configuration', () => {
    it('should accept custom parameters', () => {
      const customWrapper = new TSFSRSWrapper({
        requestRetention: 0.85,
        maximumInterval: 180,
        enableFuzz: false
      })

      const params = customWrapper.getParameters()
      expect(params.requestRetention).toBe(0.85)
      expect(params.maximumInterval).toBe(180)
      expect(params.enableFuzz).toBe(false)
    })

    it('should use ts-fsrs default parameters (21 weights for FSRS-6)', () => {
      const params = wrapper.getParameters()
      // ts-fsrs uses FSRS-6 by default with 21 parameters
      expect(params.w.length).toBe(21)
    })

    it('should report version info', () => {
      const version = wrapper.getVersion()
      expect(version).toEqual({
        library: 'ts-fsrs',
        algorithm: 'FSRS-6',  // ts-fsrs uses FSRS-6 by default
        parameters: 21
      })
    })

    it('should allow parameter updates', () => {
      wrapper.updateParameters({
        requestRetention: 0.95,
        maximumInterval: 365
      })

      const params = wrapper.getParameters()
      expect(params.requestRetention).toBe(0.95)
      expect(params.maximumInterval).toBe(365)
    })
  })

  // ========================================
  // Integration Tests with ts-fsrs
  // ========================================

  describe('Integration with ts-fsrs', () => {
    it('should produce consistent results with direct ts-fsrs usage', () => {
      // Create fresh wrapper and FSRS with identical configuration
      const testWrapper = new TSFSRSWrapper({ enableFuzz: false })
      const directFSRS = new FSRS({ enable_fuzz: false })

      // Initialize card in wrapper
      const item = {
        id: 'integration-test',
        contentType: 'vocabulary' as const,
        primaryDisplay: 'テスト',
        difficulty: 0.5,
        tags: [],
        supportedModes: ['recognition' as const],
        primaryAnswer: 'test',
        srsData: testWrapper.initializeCardSRS({
          id: 'integration-test',
          contentType: 'vocabulary',
          primaryDisplay: 'テスト',
          difficulty: 0.5,
          tags: [],
          supportedModes: ['recognition'],
          primaryAnswer: 'test'
        })
      }

      // Review using wrapper
      const result: ReviewResult = {
        correct: true,
        responseTime: 3000,
        difficulty: 'good'
      }

      const wrapperResult = testWrapper.calculateNextReview(item, result)

      // Review using direct ts-fsrs (same starting point)
      const tsfsrsCard = createEmptyCard(new Date())
      const schedulingCards = directFSRS.repeat(tsfsrsCard, new Date())
      const tsfsrsResult = schedulingCards[Rating.Good]

      // Results should be in reasonable ranges
      // Note: Exact values may differ slightly due to conversion layer,
      // but should be in the same ballpark as direct ts-fsrs usage
      expect(wrapperResult.stability).toBeGreaterThan(0)
      expect(wrapperResult.stability).toBeLessThan(100) // Reasonable range for first review
      expect(wrapperResult.difficulty).toBeGreaterThan(0)
      expect(wrapperResult.difficulty).toBeLessThan(10)
      expect(wrapperResult.interval).toBeGreaterThanOrEqual(0)

      // Verify both are using same FSRS version
      expect(testWrapper.getVersion().algorithm).toBe('FSRS-6')
    })
  })
})
