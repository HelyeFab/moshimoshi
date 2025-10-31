/**
 * Accuracy Normalization Utility
 *
 * Fixes Issue #8: Statistics drift due to inconsistent accuracy representation
 *
 * Design Decisions:
 * - ALWAYS store accuracy as 0-100 (percentage)
 * - Never store as 0.0-1.0 (decimal)
 * - Provides utilities for safe conversion and formatting
 * - Prevents display bugs where 0.85 shows as "0.85%"
 */

/**
 * Accuracy utilities
 * Ensures consistent representation across the app
 */
export const Accuracy = {
  /**
   * Normalize accuracy value to 0-100 range
   * Handles both percentage (0-100) and decimal (0.0-1.0) inputs
   *
   * @param value - Input value (can be 0-100 or 0.0-1.0)
   * @returns Normalized value in 0-100 range
   */
  normalize(value: number): number {
    // If value is likely a decimal (<=1.0), convert to percentage
    if (value <= 1.0 && value >= 0.0) {
      return value * 100
    }

    // Otherwise clamp to 0-100
    return Math.min(100, Math.max(0, value))
  },

  /**
   * Format accuracy for display
   *
   * @param value - Accuracy value (any format)
   * @param precision - Decimal places (default: 1)
   * @returns Formatted string with % symbol
   */
  format(value: number, precision: number = 1): string {
    const normalized = Accuracy.normalize(value)
    return `${normalized.toFixed(precision)}%`
  },

  /**
   * Convert to decimal (0.0-1.0) for calculations
   * Some algorithms expect decimal format
   *
   * @param value - Accuracy value (any format)
   * @returns Decimal value in 0.0-1.0 range
   */
  toDecimal(value: number): number {
    const normalized = Accuracy.normalize(value)
    return normalized / 100
  },

  /**
   * Calculate accuracy from counts
   *
   * @param correct - Number of correct answers
   * @param total - Total number of questions
   * @returns Accuracy as percentage (0-100)
   */
  calculate(correct: number, total: number): number {
    if (total === 0) return 0
    return (correct / total) * 100
  },

  /**
   * Calculate weighted accuracy
   * Useful for giving more weight to recent performance
   *
   * @param accuracies - Array of accuracy values
   * @param weights - Array of weights (same length as accuracies)
   * @returns Weighted accuracy (0-100)
   */
  calculateWeighted(accuracies: number[], weights: number[]): number {
    if (accuracies.length === 0) return 0
    if (accuracies.length !== weights.length) {
      throw new Error('Accuracies and weights must have same length')
    }

    const normalized = accuracies.map(a => Accuracy.normalize(a))
    const totalWeight = weights.reduce((sum, w) => sum + w, 0)

    if (totalWeight === 0) return 0

    const weightedSum = normalized.reduce(
      (sum, acc, i) => sum + acc * weights[i],
      0
    )

    return weightedSum / totalWeight
  },

  /**
   * Get color for accuracy value (for UI)
   *
   * @param value - Accuracy value
   * @returns Color code
   */
  getColor(value: number): string {
    const normalized = Accuracy.normalize(value)

    if (normalized >= 90) return 'green'
    if (normalized >= 80) return 'blue'
    if (normalized >= 70) return 'yellow'
    if (normalized >= 60) return 'orange'
    return 'red'
  },

  /**
   * Get grade for accuracy value
   *
   * @param value - Accuracy value
   * @returns Letter grade
   */
  getGrade(value: number): string {
    const normalized = Accuracy.normalize(value)

    if (normalized >= 97) return 'A+'
    if (normalized >= 93) return 'A'
    if (normalized >= 90) return 'A-'
    if (normalized >= 87) return 'B+'
    if (normalized >= 83) return 'B'
    if (normalized >= 80) return 'B-'
    if (normalized >= 77) return 'C+'
    if (normalized >= 73) return 'C'
    if (normalized >= 70) return 'C-'
    if (normalized >= 67) return 'D+'
    if (normalized >= 63) return 'D'
    if (normalized >= 60) return 'D-'
    return 'F'
  },

  /**
   * Check if accuracy meets threshold
   *
   * @param value - Accuracy value
   * @param threshold - Minimum acceptable accuracy (0-100)
   * @returns True if meets threshold
   */
  meetsThreshold(value: number, threshold: number): boolean {
    const normalized = Accuracy.normalize(value)
    const normalizedThreshold = Accuracy.normalize(threshold)
    return normalized >= normalizedThreshold
  }
}

/**
 * Common accuracy thresholds
 */
export const AccuracyThresholds = {
  PERFECT: 100,
  EXCELLENT: 90,
  GOOD: 80,
  DECENT: 70,
  PASSING: 60,
  MIN_FOR_MASTERY: 90 // URE mastery threshold
}
