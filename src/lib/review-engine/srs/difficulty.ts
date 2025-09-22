/**
 * Difficulty Calculator
 * Calculates and adjusts difficulty for review items based on various factors
 */

import { ReviewableContent, ReviewableContentWithSRS } from '../core/interfaces'
import { ReviewResult } from './algorithm'

/**
 * Factors that influence difficulty calculation
 */
export interface DifficultyFactors {
  /**
   * Character/word length
   */
  length?: number
  
  /**
   * Stroke count (for kanji)
   */
  strokeCount?: number
  
  /**
   * JLPT level (1-5, where 1 is hardest)
   */
  jlptLevel?: number
  
  /**
   * Frequency rank (lower is more common)
   */
  frequencyRank?: number
  
  /**
   * Number of similar items
   */
  similarityCount?: number
  
  /**
   * Number of meanings/readings
   */
  polysemyCount?: number
  
  /**
   * Contains irregular patterns
   */
  hasIrregularities?: boolean
  
  /**
   * User's historical performance
   */
  userPerformance?: {
    accuracy: number
    avgResponseTime: number
    lapseCount: number
  }
}

/**
 * Configuration for difficulty calculation
 */
export interface DifficultyConfig {
  /**
   * Weight for each factor (0-1)
   */
  weights: {
    length: number
    strokeCount: number
    jlptLevel: number
    frequency: number
    similarity: number
    polysemy: number
    irregularity: number
    userPerformance: number
  }
  
  /**
   * Thresholds for difficulty levels
   */
  thresholds: {
    easy: number      // 0 - easy
    medium: number    // easy - medium
    hard: number      // medium - hard
    veryHard: number  // hard - veryHard
  }
  
  /**
   * Rate at which difficulty adjusts based on performance
   */
  adjustmentRate: number
  
  /**
   * Minimum number of reviews before adjusting difficulty
   */
  minReviewsForAdjustment: number
}

/**
 * Default configuration
 */
export const DEFAULT_DIFFICULTY_CONFIG: DifficultyConfig = {
  weights: {
    length: 0.15,
    strokeCount: 0.2,
    jlptLevel: 0.2,
    frequency: 0.15,
    similarity: 0.1,
    polysemy: 0.1,
    irregularity: 0.1,
    userPerformance: 0.3
  },
  thresholds: {
    easy: 0.3,
    medium: 0.5,
    hard: 0.7,
    veryHard: 0.85
  },
  adjustmentRate: 0.1,
  minReviewsForAdjustment: 3
}

/**
 * Calculates and manages difficulty for review items
 */
export class DifficultyCalculator {
  private config: DifficultyConfig
  
  constructor(config: Partial<DifficultyConfig> = {}) {
    this.config = {
      ...DEFAULT_DIFFICULTY_CONFIG,
      ...config,
      weights: {
        ...DEFAULT_DIFFICULTY_CONFIG.weights,
        ...(config.weights || {})
      },
      thresholds: {
        ...DEFAULT_DIFFICULTY_CONFIG.thresholds,
        ...(config.thresholds || {})
      }
    }
  }
  
  /**
   * Calculate initial difficulty for a content item
   */
  calculateInitialDifficulty(
    content: ReviewableContent,
    factors?: DifficultyFactors
  ): number {
    let difficulty = 0
    let totalWeight = 0
    
    // Length factor
    if (content.primaryDisplay && this.config.weights.length > 0) {
      const lengthScore = this.calculateLengthScore(content.primaryDisplay.length)
      difficulty += lengthScore * this.config.weights.length
      totalWeight += this.config.weights.length
    }
    
    // Content-specific factors from metadata
    if (content.metadata) {
      // Stroke count (kanji)
      if (content.metadata.strokeCount && this.config.weights.strokeCount > 0) {
        const strokeScore = this.calculateStrokeScore(content.metadata.strokeCount)
        difficulty += strokeScore * this.config.weights.strokeCount
        totalWeight += this.config.weights.strokeCount
      }
      
      // JLPT level
      if (content.metadata.jlptLevel && this.config.weights.jlptLevel > 0) {
        const jlptScore = this.calculateJLPTScore(content.metadata.jlptLevel)
        difficulty += jlptScore * this.config.weights.jlptLevel
        totalWeight += this.config.weights.jlptLevel
      }
      
      // Frequency
      if (content.metadata.frequency && this.config.weights.frequency > 0) {
        const freqScore = this.calculateFrequencyScore(content.metadata.frequency)
        difficulty += freqScore * this.config.weights.frequency
        totalWeight += this.config.weights.frequency
      }
      
      // Multiple readings/meanings
      const polysemyCount = this.countPolysemy(content.metadata)
      if (polysemyCount > 0 && this.config.weights.polysemy > 0) {
        const polyScore = this.calculatePolysemyScore(polysemyCount)
        difficulty += polyScore * this.config.weights.polysemy
        totalWeight += this.config.weights.polysemy
      }
    }
    
    // Additional factors if provided
    if (factors) {
      // Similarity to other items
      if (factors.similarityCount !== undefined && this.config.weights.similarity > 0) {
        const simScore = this.calculateSimilarityScore(factors.similarityCount)
        difficulty += simScore * this.config.weights.similarity
        totalWeight += this.config.weights.similarity
      }
      
      // Irregularities
      if (factors.hasIrregularities && this.config.weights.irregularity > 0) {
        difficulty += 0.8 * this.config.weights.irregularity
        totalWeight += this.config.weights.irregularity
      }
    }
    
    // Normalize difficulty to 0-1 range
    if (totalWeight > 0) {
      difficulty = difficulty / totalWeight
    }
    
    return Math.max(0, Math.min(1, difficulty))
  }
  
  /**
   * Adjust difficulty based on user performance
   */
  adjustDifficulty(
    currentDifficulty: number,
    performance: ReviewResult[]
  ): number {
    if (performance.length < this.config.minReviewsForAdjustment) {
      return currentDifficulty
    }
    
    // Calculate performance metrics
    const accuracy = this.calculateAccuracy(performance)
    const avgResponseTime = this.calculateAverageResponseTime(performance)
    const consistencyScore = this.calculateConsistency(performance)
    
    // Calculate adjustment
    let adjustment = 0
    
    // High accuracy suggests item is easier than current difficulty
    if (accuracy > 0.9) {
      adjustment = -this.config.adjustmentRate * (accuracy - 0.9) * 2
    } else if (accuracy < 0.6) {
      adjustment = this.config.adjustmentRate * (0.6 - accuracy) * 2
    }
    
    // Fast response times suggest familiarity
    if (avgResponseTime < 2000) {
      adjustment -= this.config.adjustmentRate * 0.5
    } else if (avgResponseTime > 10000) {
      adjustment += this.config.adjustmentRate * 0.5
    }
    
    // Inconsistent performance suggests difficulty
    if (consistencyScore < 0.5) {
      adjustment += this.config.adjustmentRate * 0.3
    }
    
    // Apply adjustment
    const newDifficulty = currentDifficulty + adjustment
    
    return Math.max(0, Math.min(1, newDifficulty))
  }
  
  /**
   * Get difficulty modifier for scoring/interval calculation
   */
  getDifficultyModifier(difficulty: number): number {
    // Returns a modifier between 0.5 (very hard) and 1.5 (very easy)
    return 1.5 - difficulty
  }
  
  /**
   * Get difficulty level as a string
   */
  getDifficultyLevel(difficulty: number): 'easy' | 'medium' | 'hard' | 'very-hard' {
    if (difficulty < this.config.thresholds.easy) {
      return 'easy'
    } else if (difficulty < this.config.thresholds.medium) {
      return 'medium'
    } else if (difficulty < this.config.thresholds.hard) {
      return 'hard'
    } else {
      return 'very-hard'
    }
  }
  
  /**
   * Calculate difficulty score based on text length
   */
  private calculateLengthScore(length: number): number {
    // Normalize length to 0-1 scale
    if (length <= 1) return 0
    if (length <= 3) return 0.2
    if (length <= 5) return 0.4
    if (length <= 10) return 0.6
    if (length <= 20) return 0.8
    return 1
  }
  
  /**
   * Calculate difficulty score based on stroke count
   */
  private calculateStrokeScore(strokes: number): number {
    // Normalize stroke count to 0-1 scale
    if (strokes <= 3) return 0
    if (strokes <= 6) return 0.2
    if (strokes <= 10) return 0.4
    if (strokes <= 15) return 0.6
    if (strokes <= 20) return 0.8
    return 1
  }
  
  /**
   * Calculate difficulty score based on JLPT level
   */
  private calculateJLPTScore(level: number): number {
    // JLPT N5 (easiest) = 5, N1 (hardest) = 1
    const scores: Record<number, number> = {
      5: 0.2,  // N5
      4: 0.4,  // N4
      3: 0.6,  // N3
      2: 0.8,  // N2
      1: 1.0   // N1
    }
    return scores[level] || 0.5
  }
  
  /**
   * Calculate difficulty score based on frequency
   */
  private calculateFrequencyScore(frequency: number): number {
    // Lower frequency rank = more common = easier
    if (frequency <= 100) return 0
    if (frequency <= 500) return 0.2
    if (frequency <= 1000) return 0.4
    if (frequency <= 2000) return 0.6
    if (frequency <= 5000) return 0.8
    return 1
  }
  
  /**
   * Calculate difficulty score based on similarity count
   */
  private calculateSimilarityScore(count: number): number {
    // More similar items = harder to distinguish
    if (count <= 1) return 0
    if (count <= 3) return 0.3
    if (count <= 5) return 0.5
    if (count <= 10) return 0.7
    return 1
  }
  
  /**
   * Calculate difficulty score based on polysemy
   */
  private calculatePolysemyScore(count: number): number {
    // More meanings/readings = harder
    if (count <= 1) return 0
    if (count <= 2) return 0.3
    if (count <= 3) return 0.5
    if (count <= 5) return 0.7
    return 1
  }
  
  /**
   * Count polysemy (multiple meanings/readings)
   */
  private countPolysemy(metadata: Record<string, any>): number {
    let count = 0
    
    // Count kanji readings
    if (metadata.onyomi) count += metadata.onyomi.length
    if (metadata.kunyomi) count += metadata.kunyomi.length
    
    // Count vocabulary meanings
    if (metadata.meanings && Array.isArray(metadata.meanings)) {
      count += metadata.meanings.length
    }
    
    return count
  }
  
  /**
   * Calculate accuracy from performance history
   */
  private calculateAccuracy(performance: ReviewResult[]): number {
    if (performance.length === 0) return 0
    
    const correct = performance.filter(p => p.correct).length
    return correct / performance.length
  }
  
  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(performance: ReviewResult[]): number {
    if (performance.length === 0) return 0
    
    const totalTime = performance.reduce((sum, p) => sum + (p.responseTime || 0), 0)
    return totalTime / performance.length
  }
  
  /**
   * Calculate consistency score (how consistent performance is)
   */
  private calculateConsistency(performance: ReviewResult[]): number {
    if (performance.length < 2) return 1
    
    // Calculate variance in correctness
    let switches = 0
    for (let i = 1; i < performance.length; i++) {
      if (performance[i].correct !== performance[i - 1].correct) {
        switches++
      }
    }
    
    // More switches = less consistent
    const maxSwitches = performance.length - 1
    return 1 - (switches / maxSwitches)
  }
  
  /**
   * Predict difficulty for a new user based on similar users
   */
  predictDifficultyForUser(
    content: ReviewableContent,
    similarUsersPerformance: Map<string, number>
  ): number {
    if (similarUsersPerformance.size === 0) {
      return this.calculateInitialDifficulty(content)
    }
    
    // Average difficulty from similar users
    let totalDifficulty = 0
    for (const difficulty of similarUsersPerformance.values()) {
      totalDifficulty += difficulty
    }
    
    return totalDifficulty / similarUsersPerformance.size
  }
  
  /**
   * Group items by difficulty level
   */
  groupByDifficulty(
    items: ReviewableContentWithSRS[]
  ): Map<string, ReviewableContentWithSRS[]> {
    const groups = new Map<string, ReviewableContentWithSRS[]>()
    groups.set('easy', [])
    groups.set('medium', [])
    groups.set('hard', [])
    groups.set('very-hard', [])
    
    for (const item of items) {
      const level = this.getDifficultyLevel(item.difficulty)
      const group = groups.get(level) || []
      group.push(item)
      groups.set(level, group)
    }
    
    return groups
  }
  
  /**
   * Balance review session by difficulty
   */
  balanceByDifficulty(
    items: ReviewableContentWithSRS[],
    sessionSize: number,
    distribution: { easy: number; medium: number; hard: number; veryHard: number } = {
      easy: 0.3,
      medium: 0.4,
      hard: 0.25,
      veryHard: 0.05
    }
  ): ReviewableContentWithSRS[] {
    const grouped = this.groupByDifficulty(items)
    const balanced: ReviewableContentWithSRS[] = []
    
    // Calculate target counts for each difficulty
    const targets = {
      easy: Math.floor(sessionSize * distribution.easy),
      medium: Math.floor(sessionSize * distribution.medium),
      hard: Math.floor(sessionSize * distribution.hard),
      veryHard: Math.floor(sessionSize * distribution.veryHard)
    }
    
    // Add items from each group
    for (const [level, target] of Object.entries(targets)) {
      const group = grouped.get(level) || []
      const toAdd = Math.min(target, group.length)
      balanced.push(...group.slice(0, toAdd))
    }
    
    // Fill remaining slots with medium difficulty
    while (balanced.length < sessionSize) {
      const medium = grouped.get('medium') || []
      const remaining = medium.slice(targets.medium)
      if (remaining.length === 0) break
      balanced.push(remaining.shift()!)
    }
    
    return balanced
  }
}