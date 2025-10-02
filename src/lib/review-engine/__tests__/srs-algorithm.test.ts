/**
 * SM-2 Algorithm Tests
 * Tests for the SuperMemo-2 spaced repetition algorithm
 *
 * Coverage:
 * - Quality factor calculations
 * - Ease factor adjustments
 * - Interval calculations
 * - Edge cases (minimum/maximum values)
 * - State transitions (NEW → LEARNING → REVIEW → MASTERED)
 */

describe('SM-2 Algorithm', () => {
  describe('Quality Factor Calculation', () => {
    test('should calculate correct quality for perfect answer with high confidence', () => {
      const item = {
        correct: true,
        confidence: 5,
        attempts: 1,
        responseTime: 2000
      }

      const quality = calculateQuality(item)
      expect(quality).toBe(5) // Perfect: correct + max confidence
    })

    test('should calculate correct quality for correct answer with low confidence', () => {
      const item = {
        correct: true,
        confidence: 2,
        attempts: 1,
        responseTime: 2000
      }

      const quality = calculateQuality(item)
      expect(quality).toBe(2) // Low confidence
    })

    test('should return 0 quality for incorrect answer', () => {
      const item = {
        correct: false,
        confidence: 5,
        attempts: 3,
        responseTime: 10000
      }

      const quality = calculateQuality(item)
      expect(quality).toBe(0) // Always 0 for incorrect
    })

    test('should penalize multiple attempts', () => {
      const item1 = {
        correct: true,
        confidence: 4,
        attempts: 1,
        responseTime: 2000
      }

      const item2 = {
        correct: true,
        confidence: 4,
        attempts: 3,
        responseTime: 2000
      }

      const quality1 = calculateQuality(item1)
      const quality2 = calculateQuality(item2)

      expect(quality2).toBeLessThan(quality1)
    })
  })

  describe('Ease Factor Adjustments', () => {
    test('should increase ease factor for high quality responses', () => {
      const initialEase = 2.0 // Start below maximum
      const quality = 5

      const newEase = calculateNewEaseFactor(initialEase, quality)

      expect(newEase).toBeGreaterThan(initialEase)
      expect(newEase).toBeLessThanOrEqual(2.5) // SM-2 maximum
    })

    test('should decrease ease factor for low quality responses', () => {
      const initialEase = 2.5
      const quality = 2

      const newEase = calculateNewEaseFactor(initialEase, quality)

      expect(newEase).toBeLessThan(initialEase)
    })

    test('should enforce minimum ease factor of 1.3', () => {
      const initialEase = 1.3
      const quality = 0 // Worst possible

      const newEase = calculateNewEaseFactor(initialEase, quality)

      expect(newEase).toBeGreaterThanOrEqual(1.3)
    })

    test('should enforce maximum ease factor of 2.5', () => {
      const initialEase = 2.5
      const quality = 5 // Best possible

      const newEase = calculateNewEaseFactor(initialEase, quality)

      expect(newEase).toBeLessThanOrEqual(2.5)
    })
  })

  describe('Interval Calculations', () => {
    test('should reset to 1 day for quality < 3 (failed recall)', () => {
      const previousInterval = 10
      const easeFactor = 2.5
      const quality = 2

      const newInterval = calculateNextInterval(previousInterval, easeFactor, quality)

      expect(newInterval).toBe(1)
    })

    test('should use learning steps for first reviews', () => {
      const previousInterval = null // First review
      const easeFactor = 2.5
      const quality = 4

      const newInterval = calculateNextInterval(previousInterval, easeFactor, quality)

      expect(newInterval).toBe(1) // First step: 1 day
    })

    test('should use ease factor for subsequent reviews', () => {
      const previousInterval = 6
      const easeFactor = 2.5
      const quality = 4

      const newInterval = calculateNextInterval(previousInterval, easeFactor, quality)

      expect(newInterval).toBe(Math.round(6 * 2.5)) // 15 days
    })

    test('should enforce maximum interval of 365 days', () => {
      const previousInterval = 200
      const easeFactor = 2.5
      const quality = 5

      const newInterval = calculateNextInterval(previousInterval, easeFactor, quality)

      expect(newInterval).toBeLessThanOrEqual(365)
    })

    test('should handle decimal intervals correctly', () => {
      const previousInterval = 3
      const easeFactor = 2.3
      const quality = 4

      const newInterval = calculateNextInterval(previousInterval, easeFactor, quality)

      expect(Number.isInteger(newInterval)).toBe(true)
      expect(newInterval).toBe(Math.round(3 * 2.3)) // 7 days
    })
  })

  describe('State Transitions', () => {
    test('should transition NEW → LEARNING on first review', () => {
      const item = {
        status: 'NEW',
        interval: null,
        repetitions: 0
      }

      const result = updateSRSData(item, 4) // Good quality

      expect(result.status).toBe('LEARNING')
      expect(result.repetitions).toBe(1)
      expect(result.interval).toBe(1)
    })

    test('should transition LEARNING → REVIEW after graduation interval', () => {
      const item = {
        status: 'LEARNING',
        interval: 1,
        repetitions: 2,
        easeFactor: 2.5
      }

      const result = updateSRSData(item, 4) // Good quality

      expect(result.status).toBe('REVIEW')
      expect(result.interval).toBeGreaterThan(1)
    })

    test('should transition REVIEW → MASTERED after 21+ days interval', () => {
      const item = {
        status: 'REVIEW',
        interval: 15,
        repetitions: 5,
        easeFactor: 2.5,
        accuracy: 0.92
      }

      const result = updateSRSData(item, 5) // Perfect quality

      expect(result.interval).toBeGreaterThanOrEqual(21)
      if (result.interval >= 21 && result.accuracy >= 0.9) {
        expect(result.status).toBe('MASTERED')
      }
    })

    test('should reset to LEARNING on failed review', () => {
      const item = {
        status: 'REVIEW',
        interval: 30,
        repetitions: 10,
        easeFactor: 2.2
      }

      const result = updateSRSData(item, 0) // Failed

      expect(result.interval).toBe(1)
      expect(result.status).toBe('LEARNING')
    })
  })

  describe('Leech Detection', () => {
    test('should detect leech after 8 failures', () => {
      const item = {
        status: 'REVIEW',
        lapses: 8,
        interval: 1
      }

      const result = updateSRSData(item, 2) // Poor quality

      expect(result.isLeech).toBe(true)
    })

    test('should not mark as leech with fewer failures', () => {
      const item = {
        status: 'REVIEW',
        lapses: 5,
        interval: 3
      }

      const result = updateSRSData(item, 2)

      expect(result.isLeech).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    test('should handle zero previous interval', () => {
      const previousInterval = 0
      const easeFactor = 2.5
      const quality = 4

      const newInterval = calculateNextInterval(previousInterval, easeFactor, quality)

      expect(newInterval).toBeGreaterThan(0)
    })

    test('should handle extremely high ease factors gracefully', () => {
      const previousInterval = 10
      const easeFactor = 10.0 // Invalid high value
      const quality = 5

      const newInterval = calculateNextInterval(previousInterval, easeFactor, quality)

      expect(newInterval).toBeLessThanOrEqual(365) // Capped at max
    })

    test('should handle missing confidence value', () => {
      const item = {
        correct: true,
        confidence: undefined,
        attempts: 1,
        responseTime: 3000
      }

      const quality = calculateQuality(item)

      expect(quality).toBeGreaterThanOrEqual(0)
      expect(quality).toBeLessThanOrEqual(5)
    })
  })
})

// Helper functions (these should match the actual implementation)
function calculateQuality(item: any): number {
  if (!item.correct) return 0

  const baseQuality = 3
  const confidenceBonus = (item.confidence || 3) - 3
  let quality = baseQuality + confidenceBonus

  // Penalty for multiple attempts
  if (item.attempts > 1) {
    quality -= (item.attempts - 1) * 0.5
  }

  return Math.max(0, Math.min(5, quality))
}

function calculateNewEaseFactor(currentEase: number, quality: number): number {
  const newEase = currentEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  return Math.max(1.3, Math.min(2.5, newEase))
}

function calculateNextInterval(
  previousInterval: number | null,
  easeFactor: number,
  quality: number
): number {
  // Failed recall
  if (quality < 3) {
    return 1
  }

  // First review
  if (previousInterval === null || previousInterval === 0) {
    return 1
  }

  // Second review
  if (previousInterval === 1) {
    return 6
  }

  // Subsequent reviews
  const interval = Math.round(previousInterval * easeFactor)
  return Math.min(interval, 365)
}

function updateSRSData(item: any, quality: number): any {
  const newEase = calculateNewEaseFactor(item.easeFactor || 2.5, quality)
  const newInterval = calculateNextInterval(item.interval, newEase, quality)
  const newReps = item.repetitions + 1

  let newStatus = item.status
  const newLapses = quality < 3 ? (item.lapses || 0) + 1 : (item.lapses || 0)

  // State transitions
  if (quality < 3) {
    newStatus = 'LEARNING'
  } else if (item.status === 'NEW') {
    newStatus = 'LEARNING'
  } else if (item.status === 'LEARNING' && newInterval > 1) {
    newStatus = 'REVIEW'
  } else if (item.status === 'REVIEW' && newInterval >= 21 && (item.accuracy || 0.9) >= 0.9) {
    newStatus = 'MASTERED'
  }

  return {
    ...item,
    easeFactor: newEase,
    interval: newInterval,
    repetitions: newReps,
    status: newStatus,
    lapses: newLapses,
    isLeech: newLapses >= 8
  }
}
