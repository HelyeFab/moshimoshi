/**
 * SRS State Manager
 * Manages review states and transitions for content items
 */

import { ReviewableContentWithSRS, SRSData } from '../core/interfaces'
import { ReviewResult, SRSAlgorithm } from './algorithm'

/**
 * Statistics for a collection of items
 */
export interface CollectionStats {
  total: number
  new: number
  learning: number
  review: number
  mastered: number
  due: number
  overdue: number
}

/**
 * Configuration for state transitions
 */
export interface StateTransitionConfig {
  /**
   * Minimum correct answers to graduate from learning
   */
  graduationThreshold: number
  
  /**
   * Minimum interval (days) to be considered mastered
   */
  masteryIntervalThreshold: number
  
  /**
   * Minimum accuracy to be considered mastered
   */
  masteryAccuracyThreshold: number
  
  /**
   * Number of lapses before demoting from mastered
   */
  demotionThreshold: number
  
  /**
   * Whether to automatically graduate items
   */
  autoGraduate: boolean
  
  /**
   * Whether to automatically promote to mastered
   */
  autoMaster: boolean
}

/**
 * Default state transition configuration
 */
export const DEFAULT_STATE_CONFIG: StateTransitionConfig = {
  graduationThreshold: 3,
  masteryIntervalThreshold: 21,
  masteryAccuracyThreshold: 0.9,
  demotionThreshold: 2,
  autoGraduate: true,
  autoMaster: true
}

/**
 * Manages SRS state transitions and tracking
 */
export class SRSStateManager {
  private algorithm: SRSAlgorithm
  private config: StateTransitionConfig
  private stateChangeListeners: Array<(item: ReviewableContentWithSRS, oldState: string, newState: string) => void> = []
  
  constructor(
    algorithm?: SRSAlgorithm,
    config: Partial<StateTransitionConfig> = {}
  ) {
    this.algorithm = algorithm || new SRSAlgorithm()
    this.config = { ...DEFAULT_STATE_CONFIG, ...config }
  }
  
  /**
   * Update item state based on review result
   */
  updateItemState(
    item: ReviewableContentWithSRS,
    result: ReviewResult
  ): ReviewableContentWithSRS {
    const oldState = item.srsData?.status || 'new'
    
    // Calculate new SRS data
    const newSRSData = this.algorithm.calculateNextReview(item, result)
    
    // Check for state transitions
    const updatedSRSData = this.checkStateTransitions(newSRSData, result)
    
    // Create updated item
    const updatedItem: ReviewableContentWithSRS = {
      ...item,
      srsData: updatedSRSData
    }
    
    // Notify listeners if state changed
    if (oldState !== updatedSRSData.status) {
      this.notifyStateChange(updatedItem, oldState, updatedSRSData.status)
    }
    
    return updatedItem
  }
  
  /**
   * Check and apply state transitions
   */
  private checkStateTransitions(
    srsData: SRSData,
    result: ReviewResult
  ): SRSData {
    const updatedData = { ...srsData }
    
    switch (srsData.status) {
      case 'learning':
        if (this.shouldGraduate(srsData) && this.config.autoGraduate) {
          updatedData.status = 'review'
        }
        break
        
      case 'review':
        if (this.shouldPromoteToMastered(srsData) && this.config.autoMaster) {
          updatedData.status = 'mastered'
        } else if (this.shouldDemoteToLearning(srsData, result)) {
          updatedData.status = 'learning'
        }
        break
        
      case 'mastered':
        if (this.shouldDemoteFromMastered(srsData, result)) {
          updatedData.status = 'review'
        }
        break
    }
    
    return updatedData
  }
  
  /**
   * Get the current state of an item
   */
  getItemState(item: ReviewableContentWithSRS): 'new' | 'learning' | 'review' | 'mastered' {
    return item.srsData?.status || 'new'
  }
  
  /**
   * Check if item should graduate from learning to review
   */
  shouldGraduate(srsData: SRSData): boolean {
    return (
      srsData.status === 'learning' &&
      srsData.repetitions >= this.config.graduationThreshold &&
      srsData.streak >= this.config.graduationThreshold
    )
  }
  
  /**
   * Check if item should be promoted to mastered
   */
  shouldPromoteToMastered(srsData: SRSData): boolean {
    const accuracy = srsData.reviewCount > 0
      ? srsData.correctCount / srsData.reviewCount
      : 0
    
    return (
      srsData.status === 'review' &&
      srsData.interval >= this.config.masteryIntervalThreshold &&
      accuracy >= this.config.masteryAccuracyThreshold
    )
  }
  
  /**
   * Check if item should be demoted from review to learning
   */
  shouldDemoteToLearning(srsData: SRSData, result: ReviewResult): boolean {
    return (
      srsData.status === 'review' &&
      !result.correct &&
      srsData.streak === 0
    )
  }
  
  /**
   * Check if item should be demoted from mastered
   */
  shouldDemoteFromMastered(srsData: SRSData, result: ReviewResult): boolean {
    if (srsData.status !== 'mastered') return false
    
    const recentLapses = this.countRecentLapses(srsData)
    return !result.correct && recentLapses >= this.config.demotionThreshold
  }
  
  /**
   * Count recent lapses (failures) for an item
   */
  private countRecentLapses(srsData: SRSData): number {
    // This is a simplified version
    // In production, you'd track individual review history
    const accuracy = srsData.reviewCount > 0
      ? srsData.correctCount / srsData.reviewCount
      : 1
    
    return Math.floor((1 - accuracy) * srsData.reviewCount)
  }
  
  /**
   * Force transition to a specific state
   */
  forceState(
    item: ReviewableContentWithSRS,
    newState: 'new' | 'learning' | 'review' | 'mastered'
  ): ReviewableContentWithSRS {
    const oldState = item.srsData?.status || 'new'
    
    const updatedItem: ReviewableContentWithSRS = {
      ...item,
      srsData: {
        ...(item.srsData || this.createInitialSRSData()),
        status: newState
      }
    }
    
    if (oldState !== newState) {
      this.notifyStateChange(updatedItem, oldState, newState)
    }
    
    return updatedItem
  }
  
  /**
   * Reset item to new state
   */
  resetItem(item: ReviewableContentWithSRS): ReviewableContentWithSRS {
    const oldState = item.srsData?.status || 'new'
    
    const updatedItem: ReviewableContentWithSRS = {
      ...item,
      srsData: this.createInitialSRSData()
    }
    
    if (oldState !== 'new') {
      this.notifyStateChange(updatedItem, oldState, 'new')
    }
    
    return updatedItem
  }
  
  /**
   * Create initial SRS data for a new item
   */
  private createInitialSRSData(): SRSData {
    return {
      interval: 0,
      easeFactor: 2.5,
      repetitions: 0,
      lastReviewedAt: null,
      nextReviewAt: new Date(),
      status: 'new',
      reviewCount: 0,
      correctCount: 0,
      streak: 0,
      bestStreak: 0
    }
  }
  
  /**
   * Get statistics for a collection of items
   */
  getCollectionStats(items: ReviewableContentWithSRS[]): CollectionStats {
    const now = new Date()
    
    const stats: CollectionStats = {
      total: items.length,
      new: 0,
      learning: 0,
      review: 0,
      mastered: 0,
      due: 0,
      overdue: 0
    }
    
    for (const item of items) {
      const state = this.getItemState(item)
      stats[state]++
      
      if (item.srsData) {
        if (item.srsData.nextReviewAt <= now) {
          stats.due++
          
          const daysDiff = Math.floor(
            (now.getTime() - item.srsData.nextReviewAt.getTime()) / 
            (1000 * 60 * 60 * 24)
          )
          
          if (daysDiff > 0) {
            stats.overdue++
          }
        }
      }
    }
    
    return stats
  }
  
  /**
   * Filter items by state
   */
  filterByState(
    items: ReviewableContentWithSRS[],
    states: Array<'new' | 'learning' | 'review' | 'mastered'>
  ): ReviewableContentWithSRS[] {
    return items.filter(item => {
      const state = this.getItemState(item)
      return states.includes(state)
    })
  }
  
  /**
   * Get items due for review
   */
  getDueItems(
    items: ReviewableContentWithSRS[],
    includeOverdue: boolean = true
  ): ReviewableContentWithSRS[] {
    const now = new Date()
    
    return items.filter(item => {
      if (!item.srsData) return true // New items are always due
      
      if (includeOverdue) {
        return item.srsData.nextReviewAt <= now
      } else {
        // Only today's items
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        
        return (
          item.srsData.nextReviewAt >= today &&
          item.srsData.nextReviewAt < tomorrow
        )
      }
    })
  }
  
  /**
   * Add a state change listener
   */
  onStateChange(
    listener: (item: ReviewableContentWithSRS, oldState: string, newState: string) => void
  ): void {
    this.stateChangeListeners.push(listener)
  }
  
  /**
   * Remove a state change listener
   */
  offStateChange(
    listener: (item: ReviewableContentWithSRS, oldState: string, newState: string) => void
  ): void {
    const index = this.stateChangeListeners.indexOf(listener)
    if (index > -1) {
      this.stateChangeListeners.splice(index, 1)
    }
  }
  
  /**
   * Notify all listeners of a state change
   */
  private notifyStateChange(
    item: ReviewableContentWithSRS,
    oldState: string,
    newState: string
  ): void {
    for (const listener of this.stateChangeListeners) {
      listener(item, oldState, newState)
    }
  }
  
  /**
   * Get learning forecast (how many items will be due in coming days)
   */
  getForecast(
    items: ReviewableContentWithSRS[],
    days: number = 7
  ): Map<string, number> {
    const forecast = new Map<string, number>()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      forecast.set(dateStr, 0)
    }
    
    for (const item of items) {
      if (item.srsData && item.srsData.nextReviewAt) {
        const reviewDate = new Date(item.srsData.nextReviewAt)
        reviewDate.setHours(0, 0, 0, 0)
        const dateStr = reviewDate.toISOString().split('T')[0]
        
        if (forecast.has(dateStr)) {
          forecast.set(dateStr, (forecast.get(dateStr) || 0) + 1)
        }
      }
    }
    
    return forecast
  }
  
  /**
   * Calculate optimal review time for an item
   */
  getOptimalReviewTime(item: ReviewableContentWithSRS): Date {
    if (!item.srsData) {
      return new Date() // Review immediately if new
    }
    
    // Optimal review time is when retention drops to ~90%
    // This is a simplified calculation
    const optimalTime = new Date(item.srsData.nextReviewAt)
    
    // Adjust based on item difficulty
    if (item.difficulty > 0.7) {
      // Difficult items should be reviewed slightly earlier
      optimalTime.setHours(optimalTime.getHours() - 2)
    } else if (item.difficulty < 0.3) {
      // Easy items can be reviewed slightly later
      optimalTime.setHours(optimalTime.getHours() + 2)
    }
    
    return optimalTime
  }
}