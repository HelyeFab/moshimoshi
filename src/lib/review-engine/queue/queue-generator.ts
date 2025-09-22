/**
 * Queue Generator for Review System
 * Generates prioritized review queues based on SRS algorithm and user preferences
 */

import { ReviewableContentWithSRS } from '../core/interfaces'
import { PinnedItem } from '../pinning/types'
import { SRSAlgorithm } from '../srs/algorithm'

export interface QueueOptions {
  limit?: number
  contentTypes?: string[]
  includeNew?: boolean
  includeDue?: boolean
  includeLearning?: boolean
  shuffleOrder?: boolean
  priorityBoost?: boolean
}

export interface QueueItem extends ReviewableContentWithSRS {
  queuePriority: number
  dueIn: number // minutes until due (negative if overdue)
  source: 'pinned' | 'scheduled' | 'new'
}

export interface QueueStatistics {
  totalItems: number
  dueNow: number
  dueToday: number
  newItems: number
  learningItems: number
  overdueItems: number
  nextReviewIn: number | null // minutes until next review
}

/**
 * Queue Generator class
 */
export class QueueGenerator {
  private srsAlgorithm: SRSAlgorithm
  
  constructor() {
    this.srsAlgorithm = new SRSAlgorithm()
  }
  
  /**
   * Generate a review queue for a user
   */
  async generateQueue(
    userId: string,
    pinnedItems: PinnedItem[],
    options: QueueOptions = {}
  ): Promise<{
    items: QueueItem[]
    stats: QueueStatistics
  }> {
    const {
      limit = 20,
      contentTypes,
      includeNew = true,
      includeDue = true,
      includeLearning = true,
      shuffleOrder = true,
      priorityBoost = true,
    } = options
    
    const now = new Date()
    const items: QueueItem[] = []
    
    // Filter active pinned items
    const activeItems = pinnedItems.filter(item => item.isActive)
    
    // Convert pinned items to queue items
    for (const pinnedItem of activeItems) {
      // Skip if content type filter doesn't match
      if (contentTypes && !contentTypes.includes(pinnedItem.contentType)) {
        continue
      }
      
      // Calculate due time
      const nextReview = pinnedItem.nextReviewAt || pinnedItem.srsData?.nextReviewAt || pinnedItem.pinnedAt
      const dueIn = Math.floor((nextReview.getTime() - now.getTime()) / (1000 * 60))
      
      // Determine if item should be included
      const isNew = pinnedItem.status === 'new'
      const isLearning = pinnedItem.status === 'learning'
      const isDue = dueIn <= 0
      
      if (
        (isNew && !includeNew) ||
        (isDue && !includeDue) ||
        (isLearning && !isLearning && !includeLearning)
      ) {
        continue
      }
      
      // Calculate queue priority
      let queuePriority = this.calculatePriority(
        pinnedItem,
        dueIn,
        priorityBoost
      )
      
      // Create queue item
      const queueItem: QueueItem = {
        // Base ReviewableContent fields
        id: pinnedItem.contentId,
        contentType: pinnedItem.contentType as any,
        primaryDisplay: '', // Will be populated by content adapter
        primaryAnswer: '', // Will be populated by content adapter
        difficulty: pinnedItem.difficulty || 0.5,
        tags: pinnedItem.tags,
        supportedModes: ['recognition', 'recall'],
        
        // SRS data wrapped properly
        srsData: pinnedItem.srsData ? {
          ...pinnedItem.srsData,
          status: pinnedItem.status || 'new',
          reviewCount: pinnedItem.reviewCount || 0,
          correctCount: pinnedItem.correctCount || 0,
          streak: pinnedItem.streak || 0,
          bestStreak: pinnedItem.bestStreak || 0,
        } : {
          status: pinnedItem.status || 'new',
          interval: 0,
          easeFactor: 2.5,
          repetitions: 0,
          lastReviewedAt: pinnedItem.lastReviewedAt || null,
          nextReviewAt: pinnedItem.nextReviewAt || new Date(),
          reviewCount: pinnedItem.reviewCount || 0,
          correctCount: pinnedItem.correctCount || 0,
          streak: pinnedItem.streak || 0,
          bestStreak: pinnedItem.bestStreak || 0,
        },
        
        // ReviewableContentWithSRS fields
        isPinned: true,
        pinnedAt: pinnedItem.pinnedAt,
        priority: pinnedItem.priority,
        
        // Queue-specific fields
        queuePriority,
        dueIn,
        source: isNew ? 'new' : isDue ? 'scheduled' : 'pinned',
      }
      
      items.push(queueItem)
    }
    
    // Sort items by priority
    items.sort((a, b) => b.queuePriority - a.queuePriority)
    
    // Apply limit
    const limitedItems = items.slice(0, limit)
    
    // Shuffle if requested (maintains some priority ordering)
    if (shuffleOrder) {
      this.smartShuffle(limitedItems)
    }
    
    // Calculate statistics
    const stats = this.calculateStatistics(items, now)
    
    return {
      items: limitedItems,
      stats,
    }
  }
  
  /**
   * Calculate priority for a queue item
   */
  private calculatePriority(
    item: PinnedItem,
    dueIn: number,
    priorityBoost: boolean
  ): number {
    let priority = 100
    
    // Overdue items get highest priority
    if (dueIn < 0) {
      priority += Math.min(Math.abs(dueIn), 1440) // Cap at 1 day overdue
    }
    
    // Apply priority level boost
    if (priorityBoost) {
      switch (item.priority) {
        case 'high':
          priority += 50
          break
        case 'normal':
          priority += 25
          break
        case 'low':
          priority += 0
          break
      }
    }
    
    // New items get a boost
    if (item.status === 'new') {
      priority += 30
    }
    
    // Learning items get moderate priority
    if (item.status === 'learning') {
      priority += 20
    }
    
    // Items with low success rate get priority
    if (item.reviewCount > 0) {
      const successRate = (item.correctCount || 0) / item.reviewCount
      if (successRate < 0.6) {
        priority += 40 * (1 - successRate)
      }
    }
    
    // Reduce priority for recently reviewed items
    if (item.lastReviewedAt) {
      const minutesSinceReview = Math.floor(
        (Date.now() - item.lastReviewedAt.getTime()) / (1000 * 60)
      )
      if (minutesSinceReview < 60) {
        priority -= (60 - minutesSinceReview)
      }
    }
    
    return Math.max(priority, 0)
  }
  
  /**
   * Smart shuffle that maintains some priority ordering
   */
  private smartShuffle(items: QueueItem[]): void {
    // Group items by priority ranges
    const highPriority = items.filter(i => i.queuePriority >= 150)
    const mediumPriority = items.filter(i => i.queuePriority >= 50 && i.queuePriority < 150)
    const lowPriority = items.filter(i => i.queuePriority < 50)
    
    // Shuffle within groups
    this.fisherYatesShuffle(highPriority)
    this.fisherYatesShuffle(mediumPriority)
    this.fisherYatesShuffle(lowPriority)
    
    // Rebuild array with some mixing between groups
    items.length = 0
    
    // Take items from each group in a weighted manner
    while (highPriority.length || mediumPriority.length || lowPriority.length) {
      // 60% chance to take from high priority
      if (highPriority.length && Math.random() < 0.6) {
        items.push(highPriority.shift()!)
      }
      // 30% chance to take from medium priority
      else if (mediumPriority.length && Math.random() < 0.75) {
        items.push(mediumPriority.shift()!)
      }
      // Otherwise take from low priority
      else if (lowPriority.length) {
        items.push(lowPriority.shift()!)
      }
      // If only one group has items, take from it
      else if (highPriority.length) {
        items.push(highPriority.shift()!)
      } else if (mediumPriority.length) {
        items.push(mediumPriority.shift()!)
      }
    }
  }
  
  /**
   * Fisher-Yates shuffle algorithm
   */
  private fisherYatesShuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]]
    }
  }
  
  /**
   * Calculate queue statistics
   */
  private calculateStatistics(
    items: QueueItem[],
    now: Date
  ): QueueStatistics {
    const stats: QueueStatistics = {
      totalItems: items.length,
      dueNow: 0,
      dueToday: 0,
      newItems: 0,
      learningItems: 0,
      overdueItems: 0,
      nextReviewIn: null,
    }
    
    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)
    const minutesUntilEndOfDay = Math.floor(
      (endOfDay.getTime() - now.getTime()) / (1000 * 60)
    )
    
    let nextReviewMinutes: number | null = null
    
    for (const item of items) {
      // Count by status
      if (item.srsData?.status === 'new') {
        stats.newItems++
      } else if (item.srsData?.status === 'learning') {
        stats.learningItems++
      }
      
      // Count due items
      if (item.dueIn <= 0) {
        stats.dueNow++
        if (item.dueIn < -1440) { // More than 1 day overdue
          stats.overdueItems++
        }
      }
      
      if (item.dueIn <= minutesUntilEndOfDay) {
        stats.dueToday++
      }
      
      // Track next review time
      if (item.dueIn > 0) {
        if (nextReviewMinutes === null || item.dueIn < nextReviewMinutes) {
          nextReviewMinutes = item.dueIn
        }
      }
    }
    
    stats.nextReviewIn = nextReviewMinutes
    
    return stats
  }
  
  /**
   * Apply daily limits to new items
   */
  applyDailyLimits(
    items: QueueItem[],
    newItemsToday: number,
    dailyNewLimit: number
  ): QueueItem[] {
    const remainingNewAllowed = Math.max(0, dailyNewLimit - newItemsToday)
    let newItemCount = 0
    
    return items.filter(item => {
      if (item.srsData?.status === 'new') {
        if (newItemCount >= remainingNewAllowed) {
          return false
        }
        newItemCount++
      }
      return true
    })
  }
  
  /**
   * Filter items for variety (mix content types)
   */
  shuffleForVariety(items: QueueItem[]): QueueItem[] {
    // Group by content type
    const grouped = new Map<string, QueueItem[]>()
    for (const item of items) {
      const group = grouped.get(item.contentType) || []
      group.push(item)
      grouped.set(item.contentType, group)
    }
    
    // Interleave groups
    const result: QueueItem[] = []
    const groups = Array.from(grouped.values())
    let index = 0
    
    while (result.length < items.length) {
      const group = groups[index % groups.length]
      if (group.length > 0) {
        result.push(group.shift()!)
      }
      index++
    }
    
    return result
  }
}