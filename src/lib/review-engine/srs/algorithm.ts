/**
 * SRS Algorithm Implementation
 * Based on SM-2 algorithm with modifications for optimal learning
 */

import { SRSData, ReviewableContentWithSRS } from '../core/interfaces'
import { nowDate, daysFromNow } from '@/lib/time/dateProvider'

/**
 * Review result from a learning session
 */
export interface ReviewResult {
  /**
   * Whether the answer was correct
   */
  correct: boolean
  
  /**
   * Response time in milliseconds
   */
  responseTime: number
  
  /**
   * User's confidence level (1-5, where 5 is most confident)
   */
  confidence?: 1 | 2 | 3 | 4 | 5
  
  /**
   * Number of hints used
   */
  hintsUsed?: number
  
  /**
   * Number of attempts before correct answer
   */
  attemptCount?: number
}

/**
 * Configuration for SRS algorithm behavior
 */
export interface SRSConfig {
  /**
   * Initial ease factor for new items
   */
  initialEaseFactor: number
  
  /**
   * Minimum ease factor allowed
   */
  minEaseFactor: number
  
  /**
   * Maximum ease factor allowed
   */
  maxEaseFactor: number
  
  /**
   * Initial intervals for learning phase (in days)
   */
  learningSteps: number[]
  
  /**
   * Graduating interval when item moves from learning to review
   */
  graduatingInterval: number
  
  /**
   * Easy interval multiplier
   */
  easyMultiplier: number
  
  /**
   * Hard interval multiplier
   */
  hardMultiplier: number
  
  /**
   * Maximum interval in days
   */
  maxInterval: number
  
  /**
   * Leech threshold (number of lapses before marking as difficult)
   */
  leechThreshold: number
  
  /**
   * Factor for response time adjustment
   */
  responseTimeFactor: number
}

/**
 * Default configuration based on optimal learning research
 */
export const DEFAULT_SRS_CONFIG: SRSConfig = {
  initialEaseFactor: 2.5,
  minEaseFactor: 1.3,
  maxEaseFactor: 2.5,
  learningSteps: [0.0069, 0.0208], // 10 minutes, 30 minutes
  graduatingInterval: 1, // 1 day
  easyMultiplier: 1.3,
  hardMultiplier: 0.6,
  maxInterval: 365,
  leechThreshold: 8,
  responseTimeFactor: 0.001
}

/**
 * Main SRS Algorithm class implementing SM-2 with enhancements
 */
export class SRSAlgorithm {
  private config: SRSConfig
  
  constructor(config: Partial<SRSConfig> = {}) {
    this.config = { ...DEFAULT_SRS_CONFIG, ...config }
  }
  
  /**
   * Calculate next review data based on current state and review result
   */
  calculateNextReview(
    item: ReviewableContentWithSRS,
    result: ReviewResult
  ): SRSData {
    const currentSRS = item.srsData || this.initializeSRSData()
    const quality = this.getQualityFromResult(result)
    
    let newSRS: SRSData = { ...currentSRS }
    
    // Update counters
    newSRS.reviewCount++
    if (result.correct) {
      newSRS.correctCount++
      newSRS.streak++
      if (newSRS.streak > newSRS.bestStreak) {
        newSRS.bestStreak = newSRS.streak
      }
    } else {
      newSRS.streak = 0
    }
    
    // Calculate new values based on current status
    switch (currentSRS.status) {
      case 'new':
        newSRS = this.handleNewItem(newSRS, result)
        break
      case 'learning':
        newSRS = this.handleLearningItem(newSRS, result)
        break
      case 'review':
        newSRS = this.handleReviewItem(newSRS, result, quality)
        break
      case 'mastered':
        newSRS = this.handleMasteredItem(newSRS, result, quality)
        break
    }
    
    // Adjust for response time
    if (result.responseTime && result.correct) {
      newSRS.interval = this.adjustForResponseTime(
        newSRS.interval,
        result.responseTime
      )
    }
    
    // Set review dates
    newSRS.lastReviewedAt = nowDate()
    newSRS.nextReviewAt = this.calculateNextReviewDate(newSRS.interval)
    
    return newSRS
  }
  
  /**
   * Initialize SRS data for a new item
   */
  private initializeSRSData(): SRSData {
    return {
      interval: 0,
      easeFactor: this.config.initialEaseFactor,
      repetitions: 0,
      lastReviewedAt: null,
      nextReviewAt: nowDate(),
      status: 'new',
      reviewCount: 0,
      correctCount: 0,
      streak: 0,
      bestStreak: 0
    }
  }
  
  /**
   * Handle review of a new item
   */
  private handleNewItem(srs: SRSData, result: ReviewResult): SRSData {
    if (result.correct) {
      srs.status = 'learning'
      srs.repetitions = 1
      srs.interval = this.config.learningSteps[0]
    } else {
      srs.interval = 0.0035 // 5 minutes
    }
    return srs
  }
  
  /**
   * Handle review of an item in learning phase
   */
  private handleLearningItem(srs: SRSData, result: ReviewResult): SRSData {
    if (result.correct) {
      srs.repetitions++
      
      if (srs.repetitions - 1 < this.config.learningSteps.length) {
        // Still in learning steps
        srs.interval = this.config.learningSteps[srs.repetitions - 1]
      } else {
        // Graduate to review phase
        srs.status = 'review'
        srs.interval = this.config.graduatingInterval
      }
    } else {
      // Reset to first learning step
      srs.repetitions = 0
      srs.interval = this.config.learningSteps[0]
    }
    return srs
  }
  
  /**
   * Handle review of an item in review phase
   */
  private handleReviewItem(
    srs: SRSData,
    result: ReviewResult,
    quality: number
  ): SRSData {
    if (result.correct) {
      // Calculate new ease factor
      srs.easeFactor = this.calculateEaseFactor(srs.easeFactor, quality)
      
      // Calculate new interval
      if (srs.repetitions === 0) {
        srs.interval = 1
      } else if (srs.repetitions === 1) {
        srs.interval = 6
      } else {
        srs.interval = Math.round(srs.interval * srs.easeFactor)
      }
      
      srs.repetitions++
      
      // Check for mastery
      if (srs.interval >= 21 && srs.correctCount / srs.reviewCount >= 0.9) {
        srs.status = 'mastered'
      }
    } else {
      // Lapse: reset to learning
      srs.repetitions = 0
      srs.interval = this.config.learningSteps[0]
      srs.status = 'learning'
      
      // Adjust ease factor down for lapses
      srs.easeFactor = Math.max(
        this.config.minEaseFactor,
        srs.easeFactor - 0.2
      )
    }
    
    // Cap interval at maximum
    srs.interval = Math.min(srs.interval, this.config.maxInterval)
    
    return srs
  }
  
  /**
   * Handle review of a mastered item
   */
  private handleMasteredItem(
    srs: SRSData,
    result: ReviewResult,
    quality: number
  ): SRSData {
    if (result.correct) {
      // Continue increasing interval
      srs.easeFactor = this.calculateEaseFactor(srs.easeFactor, quality)
      srs.interval = Math.round(srs.interval * srs.easeFactor)
      srs.interval = Math.min(srs.interval, this.config.maxInterval)
      srs.repetitions++
    } else {
      // Demote from mastered
      srs.status = 'review'
      srs.interval = Math.max(1, Math.round(srs.interval * 0.5))
      srs.easeFactor = Math.max(
        this.config.minEaseFactor,
        srs.easeFactor - 0.3
      )
    }
    
    return srs
  }
  
  /**
   * Calculate ease factor based on quality of response
   */
  calculateEaseFactor(previousEF: number, quality: number): number {
    // SM-2 formula: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    let newEF = previousEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    
    // Clamp to configured bounds
    newEF = Math.max(this.config.minEaseFactor, newEF)
    newEF = Math.min(this.config.maxEaseFactor, newEF)
    
    return Number(newEF.toFixed(2))
  }
  
  /**
   * Calculate interval based on ease factor and repetitions
   */
  calculateInterval(easeFactor: number, repetitions: number): number {
    if (repetitions === 0) {
      return 0
    } else if (repetitions === 1) {
      return 1
    } else if (repetitions === 2) {
      return 6
    } else {
      // For subsequent repetitions, multiply previous interval by ease factor
      return Math.round(
        this.calculateInterval(easeFactor, repetitions - 1) * easeFactor
      )
    }
  }
  
  /**
   * Convert review result to quality score (0-5)
   */
  getQualityFromResult(result: ReviewResult): number {
    if (!result.correct) {
      return 0
    }
    
    // Use confidence if provided
    if (result.confidence !== undefined) {
      return result.confidence
    }
    
    // Otherwise, calculate based on other factors
    let quality = 3 // Base quality for correct answer
    
    // Adjust based on response time (faster = higher quality)
    if (result.responseTime) {
      if (result.responseTime < 2000) quality++
      else if (result.responseTime > 10000) quality--
    }
    
    // Adjust based on hints used
    if (result.hintsUsed) {
      quality -= Math.min(2, result.hintsUsed)
    }
    
    // Adjust based on attempts
    if (result.attemptCount && result.attemptCount > 1) {
      quality -= Math.min(2, result.attemptCount - 1)
    }
    
    return Math.max(1, Math.min(5, quality))
  }
  
  /**
   * Adjust interval based on response time
   */
  adjustForResponseTime(interval: number, responseTime: number): number {
    // Fast responses indicate easy recall, increase interval slightly
    // Slow responses indicate difficulty, decrease interval slightly
    const avgResponseTime = 5000 // 5 seconds average
    const ratio = responseTime / avgResponseTime
    
    if (ratio < 0.5) {
      // Very fast response
      return interval * 1.1
    } else if (ratio > 2) {
      // Very slow response
      return interval * 0.9
    }
    
    return interval
  }
  
  /**
   * Calculate next review date from interval
   */
  private calculateNextReviewDate(interval: number): Date {
    return daysFromNow(interval)
  }
  
  /**
   * Check if an item is due for review
   */
  isDue(item: ReviewableContentWithSRS): boolean {
    if (!item.srsData) return true
    
    const now = new Date()
    return item.srsData.nextReviewAt <= now
  }
  
  /**
   * Get items sorted by review priority
   */
  sortByPriority(items: ReviewableContentWithSRS[]): ReviewableContentWithSRS[] {
    return items.sort((a, b) => {
      // First, prioritize overdue items
      const aOverdue = this.getOverdueDays(a)
      const bOverdue = this.getOverdueDays(b)
      
      if (aOverdue !== bOverdue) {
        return bOverdue - aOverdue // More overdue first
      }
      
      // Then by priority
      const priorityOrder = { high: 3, normal: 2, low: 1 }
      const aPriority = priorityOrder[a.priority || 'normal']
      const bPriority = priorityOrder[b.priority || 'normal']
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority
      }
      
      // Finally by status (new > learning > review > mastered)
      const statusOrder = { new: 4, learning: 3, review: 2, mastered: 1 }
      const aStatus = statusOrder[a.srsData?.status || 'new']
      const bStatus = statusOrder[b.srsData?.status || 'new']
      
      return bStatus - aStatus
    })
  }
  
  /**
   * Get number of days an item is overdue
   */
  private getOverdueDays(item: ReviewableContentWithSRS): number {
    if (!item.srsData) return 0
    
    const now = new Date()
    const diff = now.getTime() - item.srsData.nextReviewAt.getTime()
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
  }
  
  /**
   * Calculate retention rate for an item
   */
  getRetention(item: ReviewableContentWithSRS): number {
    if (!item.srsData || item.srsData.reviewCount === 0) {
      return 0
    }
    
    return item.srsData.correctCount / item.srsData.reviewCount
  }
  
  /**
   * Check if an item is a leech (frequently failed)
   */
  isLeech(item: ReviewableContentWithSRS): boolean {
    if (!item.srsData) return false
    
    const lapses = item.srsData.reviewCount - item.srsData.correctCount
    return lapses >= this.config.leechThreshold
  }
}