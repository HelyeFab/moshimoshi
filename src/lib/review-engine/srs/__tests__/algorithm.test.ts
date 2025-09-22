/**
 * Comprehensive tests for SRS Algorithm
 */

import { SRSAlgorithm, ReviewResult, DEFAULT_SRS_CONFIG } from '../algorithm'
import { ReviewableContentWithSRS, SRSData } from '../../core/interfaces'

describe('SRSAlgorithm', () => {
  let algorithm: SRSAlgorithm
  let mockItem: ReviewableContentWithSRS
  
  beforeEach(() => {
    algorithm = new SRSAlgorithm()
    mockItem = createMockItem()
  })
  
  describe('Interval Progression', () => {
    it('should progress intervals correctly for correct answers', () => {
      const result: ReviewResult = {
        correct: true,
        responseTime: 3000,
        confidence: 4
      }
      
      // First review (new -> learning)
      let srsData = algorithm.calculateNextReview(mockItem, result)
      expect(srsData.status).toBe('learning')
      expect(srsData.interval).toBeCloseTo(0.0069, 4) // 10 minutes
      
      // Second review (learning step 2)
      mockItem.srsData = srsData
      srsData = algorithm.calculateNextReview(mockItem, result)
      expect(srsData.status).toBe('learning')
      expect(srsData.interval).toBeCloseTo(0.0208, 4) // 30 minutes
      
      // Third review (graduate to review)
      mockItem.srsData = srsData
      srsData = algorithm.calculateNextReview(mockItem, result)
      expect(srsData.status).toBe('review')
      expect(srsData.interval).toBe(1) // 1 day
      
      // Fourth review (interval increases)
      mockItem.srsData = srsData
      srsData = algorithm.calculateNextReview(mockItem, result)
      expect(srsData.interval).toBeGreaterThan(1)
      expect(srsData.interval).toBeLessThanOrEqual(6)
    })
    
    it('should reset on wrong answer', () => {
      const correctResult: ReviewResult = {
        correct: true,
        responseTime: 3000
      }
      
      const wrongResult: ReviewResult = {
        correct: false,
        responseTime: 5000
      }
      
      // Progress to review phase
      let srsData = algorithm.calculateNextReview(mockItem, correctResult)
      mockItem.srsData = srsData
      srsData = algorithm.calculateNextReview(mockItem, correctResult)
      mockItem.srsData = srsData
      srsData = algorithm.calculateNextReview(mockItem, correctResult)
      
      expect(srsData.status).toBe('review')
      expect(srsData.interval).toBe(1)
      expect(srsData.repetitions).toBeGreaterThan(0)
      
      // Wrong answer resets
      mockItem.srsData = srsData
      srsData = algorithm.calculateNextReview(mockItem, wrongResult)
      
      expect(srsData.status).toBe('learning')
      expect(srsData.repetitions).toBe(0)
      expect(srsData.interval).toBeCloseTo(0.0069, 4)
      expect(srsData.streak).toBe(0)
    })
    
    it('should cap interval at maximum', () => {
      const result: ReviewResult = {
        correct: true,
        responseTime: 2000,
        confidence: 5
      }
      
      // Set up item with very high interval
      mockItem.srsData = {
        interval: 300,
        easeFactor: 2.5,
        repetitions: 10,
        lastReviewedAt: new Date(),
        nextReviewAt: new Date(),
        status: 'mastered',
        reviewCount: 50,
        correctCount: 49,
        streak: 20,
        bestStreak: 20
      }
      
      const srsData = algorithm.calculateNextReview(mockItem, result)
      expect(srsData.interval).toBeLessThanOrEqual(DEFAULT_SRS_CONFIG.maxInterval)
    })
  })
  
  describe('Ease Factor Adjustments', () => {
    it('should adjust ease factor based on quality', () => {
      // Quality 5 (perfect) should increase ease factor
      let newEF = algorithm.calculateEaseFactor(2.5, 5)
      expect(newEF).toBeGreaterThan(2.5)
      
      // Quality 3 (okay) should slightly decrease ease factor
      newEF = algorithm.calculateEaseFactor(2.5, 3)
      expect(newEF).toBeLessThan(2.5)
      expect(newEF).toBeGreaterThan(2.3)
      
      // Quality 0 (wrong) should significantly decrease ease factor
      newEF = algorithm.calculateEaseFactor(2.5, 0)
      expect(newEF).toBeLessThan(2.0)
    })
    
    it('should respect min and max ease factor bounds', () => {
      // Should not go below minimum
      let newEF = algorithm.calculateEaseFactor(1.3, 0)
      expect(newEF).toBeGreaterThanOrEqual(DEFAULT_SRS_CONFIG.minEaseFactor)
      
      // Should not go above maximum
      newEF = algorithm.calculateEaseFactor(2.5, 5)
      expect(newEF).toBeLessThanOrEqual(DEFAULT_SRS_CONFIG.maxEaseFactor)
    })
  })
  
  describe('State Transitions', () => {
    it('should transition from new to learning on first correct answer', () => {
      const result: ReviewResult = {
        correct: true,
        responseTime: 3000
      }
      
      const srsData = algorithm.calculateNextReview(mockItem, result)
      expect(srsData.status).toBe('learning')
    })
    
    it('should graduate from learning to review after completing steps', () => {
      const result: ReviewResult = {
        correct: true,
        responseTime: 3000
      }
      
      // Complete learning steps
      let srsData = algorithm.calculateNextReview(mockItem, result)
      mockItem.srsData = srsData
      srsData = algorithm.calculateNextReview(mockItem, result)
      mockItem.srsData = srsData
      srsData = algorithm.calculateNextReview(mockItem, result)
      
      expect(srsData.status).toBe('review')
    })
    
    it('should promote to mastered when interval >= 21 and accuracy >= 90%', () => {
      const result: ReviewResult = {
        correct: true,
        responseTime: 2000,
        confidence: 5
      }
      
      // Set up item close to mastery
      mockItem.srsData = {
        interval: 15,
        easeFactor: 2.5,
        repetitions: 5,
        lastReviewedAt: new Date(),
        nextReviewAt: new Date(),
        status: 'review',
        reviewCount: 10,
        correctCount: 9,
        streak: 5,
        bestStreak: 5
      }
      
      const srsData = algorithm.calculateNextReview(mockItem, result)
      // Should be mastered if interval crosses 21 days threshold
      if (srsData.interval >= 21) {
        expect(srsData.status).toBe('mastered')
      }
    })
    
    it('should demote from mastered on wrong answer', () => {
      const wrongResult: ReviewResult = {
        correct: false,
        responseTime: 8000
      }
      
      mockItem.srsData = {
        interval: 30,
        easeFactor: 2.5,
        repetitions: 10,
        lastReviewedAt: new Date(),
        nextReviewAt: new Date(),
        status: 'mastered',
        reviewCount: 20,
        correctCount: 19,
        streak: 10,
        bestStreak: 10
      }
      
      const srsData = algorithm.calculateNextReview(mockItem, wrongResult)
      expect(srsData.status).toBe('review')
      expect(srsData.interval).toBeLessThan(30)
    })
  })
  
  describe('Quality Calculation', () => {
    it('should calculate quality from confidence', () => {
      const result: ReviewResult = {
        correct: true,
        responseTime: 3000,
        confidence: 4
      }
      
      const quality = algorithm.getQualityFromResult(result)
      expect(quality).toBe(4)
    })
    
    it('should calculate quality from response time when confidence not provided', () => {
      // Very fast response
      let result: ReviewResult = {
        correct: true,
        responseTime: 1500
      }
      let quality = algorithm.getQualityFromResult(result)
      expect(quality).toBeGreaterThan(3)
      
      // Very slow response
      result = {
        correct: true,
        responseTime: 15000
      }
      quality = algorithm.getQualityFromResult(result)
      expect(quality).toBeLessThan(3)
    })
    
    it('should reduce quality for hints used', () => {
      const result: ReviewResult = {
        correct: true,
        responseTime: 3000,
        hintsUsed: 2
      }
      
      const quality = algorithm.getQualityFromResult(result)
      expect(quality).toBeLessThanOrEqual(1)
    })
    
    it('should reduce quality for multiple attempts', () => {
      const result: ReviewResult = {
        correct: true,
        responseTime: 3000,
        attemptCount: 3
      }
      
      const quality = algorithm.getQualityFromResult(result)
      expect(quality).toBeLessThanOrEqual(1)
    })
    
    it('should return 0 quality for wrong answers', () => {
      const result: ReviewResult = {
        correct: false,
        responseTime: 3000
      }
      
      const quality = algorithm.getQualityFromResult(result)
      expect(quality).toBe(0)
    })
  })
  
  describe('Response Time Adjustments', () => {
    it('should increase interval for very fast responses', () => {
      const fastResult: ReviewResult = {
        correct: true,
        responseTime: 1000
      }
      
      mockItem.srsData = {
        interval: 10,
        easeFactor: 2.5,
        repetitions: 3,
        lastReviewedAt: new Date(),
        nextReviewAt: new Date(),
        status: 'review',
        reviewCount: 5,
        correctCount: 5,
        streak: 3,
        bestStreak: 3
      }
      
      const srsData = algorithm.calculateNextReview(mockItem, fastResult)
      // Fast response should slightly increase interval
      expect(srsData.interval).toBeGreaterThan(10 * 2.5 * 0.9)
    })
    
    it('should decrease interval for very slow responses', () => {
      const slowResult: ReviewResult = {
        correct: true,
        responseTime: 12000
      }
      
      mockItem.srsData = {
        interval: 10,
        easeFactor: 2.5,
        repetitions: 3,
        lastReviewedAt: new Date(),
        nextReviewAt: new Date(),
        status: 'review',
        reviewCount: 5,
        correctCount: 5,
        streak: 3,
        bestStreak: 3
      }
      
      const srsData = algorithm.calculateNextReview(mockItem, slowResult)
      // Slow response should slightly decrease interval
      expect(srsData.interval).toBeLessThan(10 * 2.5)
    })
  })
  
  describe('Streak Tracking', () => {
    it('should increment streak on correct answer', () => {
      const result: ReviewResult = {
        correct: true,
        responseTime: 3000
      }
      
      let srsData = algorithm.calculateNextReview(mockItem, result)
      expect(srsData.streak).toBe(1)
      expect(srsData.bestStreak).toBe(1)
      
      mockItem.srsData = srsData
      srsData = algorithm.calculateNextReview(mockItem, result)
      expect(srsData.streak).toBe(2)
      expect(srsData.bestStreak).toBe(2)
    })
    
    it('should reset streak on wrong answer', () => {
      // Build up a streak
      const correctResult: ReviewResult = {
        correct: true,
        responseTime: 3000
      }
      
      let srsData = algorithm.calculateNextReview(mockItem, correctResult)
      mockItem.srsData = srsData
      srsData = algorithm.calculateNextReview(mockItem, correctResult)
      mockItem.srsData = srsData
      srsData = algorithm.calculateNextReview(mockItem, correctResult)
      
      expect(srsData.streak).toBe(3)
      expect(srsData.bestStreak).toBe(3)
      
      // Wrong answer resets current streak but not best
      const wrongResult: ReviewResult = {
        correct: false,
        responseTime: 5000
      }
      
      mockItem.srsData = srsData
      srsData = algorithm.calculateNextReview(mockItem, wrongResult)
      
      expect(srsData.streak).toBe(0)
      expect(srsData.bestStreak).toBe(3)
    })
  })
  
  describe('Utility Methods', () => {
    it('should correctly identify due items', () => {
      // New item should be due
      expect(algorithm.isDue(mockItem)).toBe(true)
      
      // Future item should not be due
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      
      mockItem.srsData = {
        interval: 1,
        easeFactor: 2.5,
        repetitions: 1,
        lastReviewedAt: new Date(),
        nextReviewAt: futureDate,
        status: 'review',
        reviewCount: 1,
        correctCount: 1,
        streak: 1,
        bestStreak: 1
      }
      
      expect(algorithm.isDue(mockItem)).toBe(false)
      
      // Past item should be due
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)
      mockItem.srsData.nextReviewAt = pastDate
      
      expect(algorithm.isDue(mockItem)).toBe(true)
    })
    
    it('should sort items by priority correctly', () => {
      const items: ReviewableContentWithSRS[] = [
        createMockItem('1', 'normal', 'review', 0), // Due today
        createMockItem('2', 'high', 'new', 0), // High priority new
        createMockItem('3', 'low', 'mastered', 1), // Not due
        createMockItem('4', 'normal', 'learning', -2), // Overdue
      ]
      
      const sorted = algorithm.sortByPriority(items)
      
      // Should prioritize: overdue > high priority > due > not due
      expect(sorted[0].id).toBe('4') // Most overdue
      expect(sorted[1].id).toBe('2') // High priority new
      expect(sorted[2].id).toBe('1') // Due today
      expect(sorted[3].id).toBe('3') // Not due mastered
    })
    
    it('should calculate retention correctly', () => {
      mockItem.srsData = {
        interval: 1,
        easeFactor: 2.5,
        repetitions: 1,
        lastReviewedAt: new Date(),
        nextReviewAt: new Date(),
        status: 'review',
        reviewCount: 10,
        correctCount: 8,
        streak: 2,
        bestStreak: 5
      }
      
      const retention = algorithm.getRetention(mockItem)
      expect(retention).toBe(0.8)
    })
    
    it('should identify leeches correctly', () => {
      // Not a leech - high accuracy
      mockItem.srsData = {
        interval: 1,
        easeFactor: 2.5,
        repetitions: 1,
        lastReviewedAt: new Date(),
        nextReviewAt: new Date(),
        status: 'review',
        reviewCount: 10,
        correctCount: 9,
        streak: 5,
        bestStreak: 5
      }
      
      expect(algorithm.isLeech(mockItem)).toBe(false)
      
      // Leech - many failures
      mockItem.srsData.reviewCount = 15
      mockItem.srsData.correctCount = 5
      
      expect(algorithm.isLeech(mockItem)).toBe(true)
    })
  })
  
  describe('Edge Cases', () => {
    it('should handle items without SRS data', () => {
      const itemWithoutSRS: ReviewableContentWithSRS = {
        ...mockItem,
        srsData: undefined
      }
      
      const result: ReviewResult = {
        correct: true,
        responseTime: 3000
      }
      
      const srsData = algorithm.calculateNextReview(itemWithoutSRS, result)
      expect(srsData).toBeDefined()
      expect(srsData.status).toBe('learning')
    })
    
    it('should handle zero response time', () => {
      const result: ReviewResult = {
        correct: true,
        responseTime: 0
      }
      
      const srsData = algorithm.calculateNextReview(mockItem, result)
      expect(srsData).toBeDefined()
      expect(srsData.interval).toBeGreaterThanOrEqual(0)
    })
    
    it('should handle undefined confidence', () => {
      const result: ReviewResult = {
        correct: true,
        responseTime: 3000,
        confidence: undefined
      }
      
      const quality = algorithm.getQualityFromResult(result)
      expect(quality).toBeGreaterThan(0)
      expect(quality).toBeLessThanOrEqual(5)
    })
  })
})

// Helper function to create mock items
function createMockItem(
  id: string = '1',
  priority: 'low' | 'normal' | 'high' = 'normal',
  status: 'new' | 'learning' | 'review' | 'mastered' = 'new',
  daysOffset: number = 0
): ReviewableContentWithSRS {
  const reviewDate = new Date()
  reviewDate.setDate(reviewDate.getDate() + daysOffset)
  
  return {
    id,
    contentType: 'vocabulary',
    primaryDisplay: 'test',
    primaryAnswer: 'test',
    difficulty: 0.5,
    tags: [],
    supportedModes: ['recognition', 'recall'],
    priority,
    srsData: status === 'new' ? undefined : {
      interval: 1,
      easeFactor: 2.5,
      repetitions: 1,
      lastReviewedAt: new Date(),
      nextReviewAt: reviewDate,
      status,
      reviewCount: 5,
      correctCount: 4,
      streak: 2,
      bestStreak: 3
    }
  }
}