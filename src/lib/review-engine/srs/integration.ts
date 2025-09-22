/**
 * SRS Integration Module
 * Integrates SRS with existing progress tracker and review engine
 */

import { ReviewableContentWithSRS, SRSData } from '../core/interfaces'
import { SRSAlgorithm, ReviewResult } from './algorithm'
import { SRSStateManager } from './state-manager'
import { DifficultyCalculator } from './difficulty'
import { reviewLogger } from '@/lib/monitoring/logger';

/**
 * Progress update event
 */
export interface ProgressUpdateEvent {
  userId: string
  contentId: string
  contentType: string
  oldState?: 'new' | 'learning' | 'review' | 'mastered'
  newState: 'new' | 'learning' | 'review' | 'mastered'
  progress: number // 0-100
  timestamp: Date
}

/**
 * Achievement trigger event
 */
export interface AchievementEvent {
  userId: string
  type: 'streak' | 'mastery' | 'milestone' | 'perfect_session'
  data: Record<string, any>
  timestamp: Date
}

/**
 * Integration configuration
 */
export interface IntegrationConfig {
  /**
   * Whether to sync with progress tracker
   */
  syncProgress: boolean
  
  /**
   * Whether to trigger achievements
   */
  triggerAchievements: boolean
  
  /**
   * Whether to update learning village
   */
  updateLearningVillage: boolean
  
  /**
   * Whether to persist to IndexedDB
   */
  persistOffline: boolean
  
  /**
   * Progress calculation method
   */
  progressCalculation: 'linear' | 'weighted' | 'custom'
}

/**
 * Default integration configuration
 */
export const DEFAULT_INTEGRATION_CONFIG: IntegrationConfig = {
  syncProgress: true,
  triggerAchievements: true,
  updateLearningVillage: true,
  persistOffline: true,
  progressCalculation: 'weighted'
}

/**
 * Integrates SRS with existing review engine components
 */
export class SRSIntegration {
  private algorithm: SRSAlgorithm
  private stateManager: SRSStateManager
  private difficultyCalculator: DifficultyCalculator
  private config: IntegrationConfig
  
  // Event listeners
  private progressListeners: Array<(event: ProgressUpdateEvent) => void> = []
  private achievementListeners: Array<(event: AchievementEvent) => void> = []
  
  constructor(
    algorithm?: SRSAlgorithm,
    stateManager?: SRSStateManager,
    difficultyCalculator?: DifficultyCalculator,
    config: Partial<IntegrationConfig> = {}
  ) {
    this.algorithm = algorithm || new SRSAlgorithm()
    this.stateManager = stateManager || new SRSStateManager(this.algorithm)
    this.difficultyCalculator = difficultyCalculator || new DifficultyCalculator()
    this.config = { ...DEFAULT_INTEGRATION_CONFIG, ...config }
    
    // Set up state change listener
    this.stateManager.onStateChange(this.handleStateChange.bind(this))
  }
  
  /**
   * Process a review and update all systems
   */
  async processReview(
    userId: string,
    item: ReviewableContentWithSRS,
    result: ReviewResult
  ): Promise<ReviewableContentWithSRS> {
    const startTime = performance.now()
    
    // Store old state for comparison
    const oldState = item.srsData?.status || 'new'
    const oldProgress = this.calculateProgress(item)
    
    // Update SRS data
    const updatedItem = this.stateManager.updateItemState(item, result)
    
    // Adjust difficulty based on performance
    if (updatedItem.srsData && updatedItem.srsData.reviewCount >= 3) {
      const performanceHistory = this.getPerformanceHistory(updatedItem)
      updatedItem.difficulty = this.difficultyCalculator.adjustDifficulty(
        updatedItem.difficulty,
        performanceHistory
      )
    }
    
    // Calculate new progress
    const newProgress = this.calculateProgress(updatedItem)
    
    // Sync progress if enabled
    if (this.config.syncProgress) {
      await this.syncProgressUpdate(userId, updatedItem, oldState, newProgress)
    }
    
    // Check for achievements
    if (this.config.triggerAchievements) {
      await this.checkAchievements(userId, updatedItem, result)
    }
    
    // Update learning village if enabled
    if (this.config.updateLearningVillage) {
      await this.updateLearningVillage(userId, updatedItem, oldProgress, newProgress)
    }
    
    // Persist offline if enabled
    if (this.config.persistOffline) {
      await this.persistOffline(userId, updatedItem)
    }
    
    const processingTime = performance.now() - startTime
    if (processingTime > 10) {
      reviewLogger.warn(`SRS processing took ${processingTime.toFixed(2)}ms`)
    }
    
    return updatedItem
  }
  
  /**
   * Calculate progress percentage for an item
   */
  calculateProgress(item: ReviewableContentWithSRS): number {
    if (!item.srsData) return 0
    
    switch (this.config.progressCalculation) {
      case 'linear':
        return this.calculateLinearProgress(item.srsData)
      case 'weighted':
        return this.calculateWeightedProgress(item.srsData)
      case 'custom':
        return this.calculateCustomProgress(item.srsData)
      default:
        return 0
    }
  }
  
  /**
   * Linear progress calculation (simple state-based)
   */
  private calculateLinearProgress(srsData: SRSData): number {
    const stateProgress: Record<string, number> = {
      'new': 0,
      'learning': 33,
      'review': 66,
      'mastered': 100
    }
    
    return stateProgress[srsData.status] || 0
  }
  
  /**
   * Weighted progress calculation (considers multiple factors)
   */
  private calculateWeightedProgress(srsData: SRSData): number {
    let progress = 0
    
    // Base progress from status (40%)
    const statusProgress: Record<string, number> = {
      'new': 0,
      'learning': 25,
      'review': 50,
      'mastered': 100
    }
    progress += (statusProgress[srsData.status] || 0) * 0.4
    
    // Progress from interval (30%)
    const intervalProgress = Math.min(100, (srsData.interval / 30) * 100)
    progress += intervalProgress * 0.3
    
    // Progress from accuracy (20%)
    const accuracy = srsData.reviewCount > 0
      ? (srsData.correctCount / srsData.reviewCount) * 100
      : 0
    progress += accuracy * 0.2
    
    // Progress from streak (10%)
    const streakProgress = Math.min(100, (srsData.streak / 10) * 100)
    progress += streakProgress * 0.1
    
    return Math.round(Math.min(100, Math.max(0, progress)))
  }
  
  /**
   * Custom progress calculation (can be overridden)
   */
  protected calculateCustomProgress(srsData: SRSData): number {
    // Override this method for custom progress calculation
    return this.calculateWeightedProgress(srsData)
  }
  
  /**
   * Sync progress update with external systems
   */
  private async syncProgressUpdate(
    userId: string,
    item: ReviewableContentWithSRS,
    oldState: string,
    newProgress: number
  ): Promise<void> {
    const event: ProgressUpdateEvent = {
      userId,
      contentId: item.id,
      contentType: item.contentType,
      oldState: oldState as any,
      newState: item.srsData?.status || 'new',
      progress: newProgress,
      timestamp: new Date()
    }
    
    // Notify progress listeners
    this.notifyProgressUpdate(event)
    
    // Here you would integrate with actual progress tracker
    // For now, we'll just log it
    if (process.env.NODE_ENV === 'development') {
      reviewLogger.info('Progress Update:', event)
    }
  }
  
  /**
   * Check and trigger achievements
   */
  private async checkAchievements(
    userId: string,
    item: ReviewableContentWithSRS,
    result: ReviewResult
  ): Promise<void> {
    if (!item.srsData) return
    
    // Check streak achievements
    if (item.srsData.streak === 7) {
      this.triggerAchievement(userId, 'streak', { days: 7, itemId: item.id })
    } else if (item.srsData.streak === 30) {
      this.triggerAchievement(userId, 'streak', { days: 30, itemId: item.id })
    } else if (item.srsData.streak === 100) {
      this.triggerAchievement(userId, 'streak', { days: 100, itemId: item.id })
    }
    
    // Check mastery achievement
    if (item.srsData.status === 'mastered' && 
        item.srsData.reviewCount === item.srsData.correctCount) {
      this.triggerAchievement(userId, 'mastery', { 
        itemId: item.id,
        perfectRecord: true
      })
    }
    
    // Check milestone achievements
    if (item.srsData.reviewCount === 10 || 
        item.srsData.reviewCount === 50 || 
        item.srsData.reviewCount === 100) {
      this.triggerAchievement(userId, 'milestone', {
        itemId: item.id,
        reviews: item.srsData.reviewCount
      })
    }
  }
  
  /**
   * Update learning village progress
   */
  private async updateLearningVillage(
    userId: string,
    item: ReviewableContentWithSRS,
    oldProgress: number,
    newProgress: number
  ): Promise<void> {
    // Map content types to stall IDs
    const stallMapping: Record<string, string> = {
      'kana': 'kana-stall',
      'kanji': 'kanji-stall',
      'vocabulary': 'vocabulary-stall',
      'sentence': 'sentence-stall',
      'grammar': 'grammar-stall'
    }
    
    const stallId = stallMapping[item.contentType]
    if (!stallId) return
    
    // Here you would integrate with actual Learning Village
    // For now, we'll just prepare the update
    const villageUpdate = {
      userId,
      stallId,
      progress: newProgress,
      delta: newProgress - oldProgress,
      timestamp: new Date()
    }
    
    if (process.env.NODE_ENV === 'development') {
      reviewLogger.info('Learning Village Update:', villageUpdate)
    }
  }
  
  /**
   * Persist item to offline storage
   */
  private async persistOffline(
    userId: string,
    item: ReviewableContentWithSRS
  ): Promise<void> {
    // Here you would integrate with IndexedDB
    // For now, we'll just prepare the data
    const offlineData = {
      userId,
      itemId: item.id,
      srsData: item.srsData,
      difficulty: item.difficulty,
      timestamp: new Date()
    }
    
    if (process.env.NODE_ENV === 'development') {
      reviewLogger.info('Offline Persist:', offlineData)
    }
  }
  
  /**
   * Get performance history for difficulty adjustment
   */
  private getPerformanceHistory(item: ReviewableContentWithSRS): ReviewResult[] {
    // In a real implementation, this would fetch from storage
    // For now, we'll simulate based on current stats
    if (!item.srsData) return []
    
    const history: ReviewResult[] = []
    const correctRatio = item.srsData.correctCount / item.srsData.reviewCount
    
    // Simulate recent performance
    for (let i = 0; i < Math.min(5, item.srsData.reviewCount); i++) {
      history.push({
        correct: Math.random() < correctRatio,
        responseTime: 3000 + Math.random() * 5000,
        confidence: Math.floor(Math.random() * 3) + 2 as any
      })
    }
    
    return history
  }
  
  /**
   * Handle state change events from state manager
   */
  private handleStateChange(
    item: ReviewableContentWithSRS,
    oldState: string,
    newState: string
  ): void {
    // Log state transitions for debugging
    if (process.env.NODE_ENV === 'development') {
      reviewLogger.info(`State transition: ${item.id} ${oldState} → ${newState}`)
    }
    
    // Trigger special handling for promotions
    if (newState === 'mastered' && oldState !== 'mastered') {
      // Celebrate mastery
      reviewLogger.info(`🎉 Item ${item.id} has been mastered!`)
    }
  }
  
  /**
   * Batch process multiple reviews
   */
  async processBatch(
    userId: string,
    reviews: Array<{ item: ReviewableContentWithSRS; result: ReviewResult }>
  ): Promise<ReviewableContentWithSRS[]> {
    const results: ReviewableContentWithSRS[] = []
    
    for (const { item, result } of reviews) {
      const updated = await this.processReview(userId, item, result)
      results.push(updated)
    }
    
    // Batch notifications
    if (this.config.syncProgress) {
      // Here you would batch sync with backend
    }
    
    return results
  }
  
  /**
   * Get review queue with SRS prioritization
   */
  getReviewQueue(
    items: ReviewableContentWithSRS[],
    limit: number = 20,
    options: {
      includeNew?: boolean
      includeOverdue?: boolean
      balanceByDifficulty?: boolean
    } = {}
  ): ReviewableContentWithSRS[] {
    const {
      includeNew = true,
      includeOverdue = true,
      balanceByDifficulty = true
    } = options
    
    // Get due items
    let dueItems = this.stateManager.getDueItems(items, includeOverdue)
    
    // Include new items if requested
    if (includeNew) {
      const newItems = items.filter(item => !item.srsData || item.srsData.status === 'new')
      dueItems = [...dueItems, ...newItems]
    }
    
    // Sort by priority
    dueItems = this.algorithm.sortByPriority(dueItems)
    
    // Balance by difficulty if requested
    if (balanceByDifficulty && dueItems.length > limit) {
      dueItems = this.difficultyCalculator.balanceByDifficulty(dueItems, limit)
    } else {
      dueItems = dueItems.slice(0, limit)
    }
    
    return dueItems
  }
  
  /**
   * Get learning forecast
   */
  getForecast(
    items: ReviewableContentWithSRS[],
    days: number = 7
  ): Map<string, { due: number; new: number; review: number }> {
    const forecast = new Map<string, { due: number; new: number; review: number }>()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Initialize forecast days
    for (let i = 0; i < days; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      forecast.set(dateStr, { due: 0, new: 0, review: 0 })
    }
    
    // Count items per day
    for (const item of items) {
      if (!item.srsData) {
        // New items can be done today
        const todayStr = today.toISOString().split('T')[0]
        const todayForecast = forecast.get(todayStr)
        if (todayForecast) {
          todayForecast.new++
        }
      } else if (item.srsData.nextReviewAt) {
        const reviewDate = new Date(item.srsData.nextReviewAt)
        reviewDate.setHours(0, 0, 0, 0)
        const dateStr = reviewDate.toISOString().split('T')[0]
        
        const dayForecast = forecast.get(dateStr)
        if (dayForecast) {
          dayForecast.due++
          if (item.srsData.status === 'review' || item.srsData.status === 'mastered') {
            dayForecast.review++
          }
        }
      }
    }
    
    return forecast
  }
  
  /**
   * Add progress update listener
   */
  onProgressUpdate(listener: (event: ProgressUpdateEvent) => void): void {
    this.progressListeners.push(listener)
  }
  
  /**
   * Remove progress update listener
   */
  offProgressUpdate(listener: (event: ProgressUpdateEvent) => void): void {
    const index = this.progressListeners.indexOf(listener)
    if (index > -1) {
      this.progressListeners.splice(index, 1)
    }
  }
  
  /**
   * Notify progress update listeners
   */
  private notifyProgressUpdate(event: ProgressUpdateEvent): void {
    for (const listener of this.progressListeners) {
      listener(event)
    }
  }
  
  /**
   * Add achievement listener
   */
  onAchievement(listener: (event: AchievementEvent) => void): void {
    this.achievementListeners.push(listener)
  }
  
  /**
   * Remove achievement listener
   */
  offAchievement(listener: (event: AchievementEvent) => void): void {
    const index = this.achievementListeners.indexOf(listener)
    if (index > -1) {
      this.achievementListeners.splice(index, 1)
    }
  }
  
  /**
   * Trigger achievement
   */
  private triggerAchievement(
    userId: string,
    type: AchievementEvent['type'],
    data: Record<string, any>
  ): void {
    const event: AchievementEvent = {
      userId,
      type,
      data,
      timestamp: new Date()
    }
    
    for (const listener of this.achievementListeners) {
      listener(event)
    }
  }
}