/**
 * PinManager Service
 * Manages pinning and unpinning of review items with support for
 * bulk operations, gradual release, and offline synchronization
 */

import { EventEmitter } from 'events'
import { reviewLogger } from '@/lib/monitoring/logger';
import { 
  PinnedItem, 
  PinOptions, 
  BulkPinResult, 
  PinStatistics, 
  PinManagerConfig,
  PinPriority,
  ReleaseSchedule
} from './types'
import { ReviewableContentWithSRS } from '../core/interfaces'
import { v4 as uuidv4 } from 'uuid'

/**
 * Default configuration
 */
const DEFAULT_CONFIG: PinManagerConfig = {
  maxPinnedItems: 1000,
  defaultPriority: 'normal',
  defaultDailyLimit: 10,
  autoActivate: true,
  cacheTTL: 300 // 5 minutes
}

/**
 * PinManager class for managing pinned review items
 */
export class PinManager extends EventEmitter {
  private config: PinManagerConfig
  private pinnedItemsCache: Map<string, Map<string, PinnedItem>> = new Map()
  private cacheTimestamps: Map<string, number> = new Map()
  
  constructor(config: PinManagerConfig = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  /**
   * Pin a single item for review
   */
  async pin(
    userId: string, 
    contentId: string, 
    contentType: string,
    options: PinOptions = {}
  ): Promise<PinnedItem> {
    // Check if already pinned
    const existingItem = await this.getPinnedItem(userId, contentId)
    if (existingItem) {
      throw new Error(`Item ${contentId} is already pinned`)
    }
    
    // Check max items limit
    const currentCount = await this.getPinnedCount(userId)
    if (currentCount >= (this.config.maxPinnedItems || 1000)) {
      throw new Error(`Maximum pinned items limit (${this.config.maxPinnedItems}) reached`)
    }
    
    // Create pinned item
    const pinnedItem: PinnedItem = {
      id: uuidv4(),
      userId,
      contentType,
      contentId,
      pinnedAt: new Date(),
      priority: options.priority || this.config.defaultPriority || 'normal',
      tags: options.tags || [],
      setIds: options.setId ? [options.setId] : [],
      isActive: this.config.autoActivate !== false,
      reviewCount: 0,
      version: 1
    }
    
    // Set scheduled release date if gradual release
    if (options.releaseSchedule === 'gradual') {
      const releaseDate = options.releaseStartDate || new Date()
      pinnedItem.scheduledReleaseDate = releaseDate
      pinnedItem.isActive = false // Will be activated on schedule
    }
    
    // Save to storage (would be Firestore in production)
    await this.savePinnedItem(pinnedItem)
    
    // Update cache
    this.updateCache(userId, pinnedItem)
    
    // Emit event
    this.emit('items:pinned', {
      userId,
      items: [pinnedItem],
      options
    })
    
    // Update statistics
    await this.updateStatistics(userId)
    
    return pinnedItem
  }
  
  /**
   * Pin multiple items in bulk
   */
  async pinBulk(
    userId: string,
    items: Array<{ contentId: string; contentType: string }>,
    options: PinOptions = {}
  ): Promise<BulkPinResult> {
    const result: BulkPinResult = {
      succeeded: [],
      failed: [],
      total: items.length,
      alreadyPinned: []
    }
    
    // Check max items limit
    const currentCount = await this.getPinnedCount(userId)
    const availableSlots = (this.config.maxPinnedItems || 1000) - currentCount
    
    if (availableSlots <= 0) {
      items.forEach(item => {
        result.failed.push({
          contentId: item.contentId,
          reason: 'Maximum pinned items limit reached'
        })
      })
      return result
    }
    
    // Process items with gradual release if specified
    const dailyLimit = options.dailyLimit || this.config.defaultDailyLimit || 10
    let batchNumber = 0
    let itemsInBatch = 0
    const releaseStartDate = options.releaseStartDate || new Date()
    
    for (let i = 0; i < items.length && i < availableSlots; i++) {
      const item = items[i]
      
      try {
        // Check if already pinned
        const existing = await this.getPinnedItem(userId, item.contentId)
        if (existing) {
          result.alreadyPinned.push(item.contentId)
          continue
        }
        
        // Calculate release date for gradual release
        let scheduledReleaseDate: Date | undefined
        if (options.releaseSchedule === 'gradual') {
          if (itemsInBatch >= dailyLimit) {
            batchNumber++
            itemsInBatch = 0
          }
          scheduledReleaseDate = new Date(releaseStartDate)
          scheduledReleaseDate.setDate(scheduledReleaseDate.getDate() + batchNumber)
          itemsInBatch++
        }
        
        // Create pinned item
        const pinnedItem: PinnedItem = {
          id: uuidv4(),
          userId,
          contentType: item.contentType,
          contentId: item.contentId,
          pinnedAt: new Date(),
          priority: options.priority || this.config.defaultPriority || 'normal',
          tags: options.tags || [],
          setIds: options.setId ? [options.setId] : [],
          isActive: options.releaseSchedule === 'gradual' ? false : (this.config.autoActivate !== false),
          scheduledReleaseDate,
          reviewCount: 0,
          version: 1
        }
        
        await this.savePinnedItem(pinnedItem)
        this.updateCache(userId, pinnedItem)
        result.succeeded.push(pinnedItem)
        
      } catch (error) {
        result.failed.push({
          contentId: item.contentId,
          reason: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    // Handle items that exceed available slots
    for (let i = availableSlots; i < items.length; i++) {
      result.failed.push({
        contentId: items[i].contentId,
        reason: 'Maximum pinned items limit reached'
      })
    }
    
    // Emit event if any items were pinned
    if (result.succeeded.length > 0) {
      this.emit('items:pinned', {
        userId,
        items: result.succeeded,
        options
      })
      
      await this.updateStatistics(userId)
    }
    
    return result
  }
  
  /**
   * Unpin a single item
   */
  async unpin(userId: string, contentId: string): Promise<void> {
    const item = await this.getPinnedItem(userId, contentId)
    if (!item) {
      throw new Error(`Item ${contentId} is not pinned`)
    }
    
    await this.deletePinnedItem(userId, item.id)
    this.removeFromCache(userId, contentId)
    
    this.emit('items:unpinned', {
      userId,
      itemIds: [contentId]
    })
    
    await this.updateStatistics(userId)
  }
  
  /**
   * Unpin multiple items
   */
  async unpinBulk(userId: string, contentIds: string[]): Promise<void> {
    const unpinnedIds: string[] = []
    
    for (const contentId of contentIds) {
      try {
        const item = await this.getPinnedItem(userId, contentId)
        if (item) {
          await this.deletePinnedItem(userId, item.id)
          this.removeFromCache(userId, contentId)
          unpinnedIds.push(contentId)
        }
      } catch (error) {
        reviewLogger.error(`Failed to unpin item ${contentId}:`, error)
      }
    }
    
    if (unpinnedIds.length > 0) {
      this.emit('items:unpinned', {
        userId,
        itemIds: unpinnedIds
      })
      
      await this.updateStatistics(userId)
    }
  }
  
  /**
   * Get all pinned items for a user
   */
  async getPinnedItems(userId: string): Promise<PinnedItem[]> {
    // Check cache first
    if (this.isCacheValid(userId)) {
      const userCache = this.pinnedItemsCache.get(userId)
      if (userCache) {
        return Array.from(userCache.values())
      }
    }
    
    // Load from storage
    const items = await this.loadPinnedItems(userId)
    
    // Update cache
    const userCache = new Map<string, PinnedItem>()
    items.forEach(item => userCache.set(item.contentId, item))
    this.pinnedItemsCache.set(userId, userCache)
    this.cacheTimestamps.set(userId, Date.now())
    
    return items
  }
  
  /**
   * Get a specific pinned item
   */
  async getPinnedItem(userId: string, contentId: string): Promise<PinnedItem | null> {
    const items = await this.getPinnedItems(userId)
    return items.find(item => item.contentId === contentId) || null
  }
  
  /**
   * Check if an item is pinned
   */
  async isPinned(userId: string, contentId: string): Promise<boolean> {
    const item = await this.getPinnedItem(userId, contentId)
    return item !== null
  }
  
  /**
   * Get count of pinned items
   */
  async getPinnedCount(userId: string): Promise<number> {
    const items = await this.getPinnedItems(userId)
    return items.length
  }
  
  /**
   * Apply gradual release schedule
   * Activates items scheduled for release today or earlier
   */
  async applyGradualRelease(userId: string): Promise<PinnedItem[]> {
    const items = await this.getPinnedItems(userId)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const itemsToRelease = items.filter(item => 
      !item.isActive && 
      item.scheduledReleaseDate && 
      item.scheduledReleaseDate <= today
    )
    
    for (const item of itemsToRelease) {
      item.isActive = true
      await this.savePinnedItem(item)
      this.updateCache(userId, item)
    }
    
    if (itemsToRelease.length > 0) {
      this.emit('items:released', {
        userId,
        items: itemsToRelease
      })
      
      await this.updateStatistics(userId)
    }
    
    return itemsToRelease
  }
  
  /**
   * Get items ready for review
   */
  async getActiveItems(userId: string): Promise<PinnedItem[]> {
    const items = await this.getPinnedItems(userId)
    return items.filter(item => item.isActive)
  }
  
  /**
   * Get items by priority
   */
  async getItemsByPriority(userId: string, priority: PinPriority): Promise<PinnedItem[]> {
    const items = await this.getPinnedItems(userId)
    return items.filter(item => item.priority === priority)
  }
  
  /**
   * Get items by tag
   */
  async getItemsByTag(userId: string, tag: string): Promise<PinnedItem[]> {
    const items = await this.getPinnedItems(userId)
    return items.filter(item => item.tags.includes(tag))
  }
  
  /**
   * Get pinning statistics
   */
  async getStatistics(userId: string): Promise<PinStatistics> {
    const items = await this.getPinnedItems(userId)
    
    const stats: PinStatistics = {
      totalPinned: items.length,
      byPriority: {
        low: 0,
        normal: 0,
        high: 0
      },
      byContentType: {},
      activeItems: 0,
      scheduledItems: 0,
      avgReviewsPerItem: 0
    }
    
    let totalReviews = 0
    
    for (const item of items) {
      // Count by priority
      stats.byPriority[item.priority]++
      
      // Count by content type
      stats.byContentType[item.contentType] = (stats.byContentType[item.contentType] || 0) + 1
      
      // Count active vs scheduled
      if (item.isActive) {
        stats.activeItems++
      } else if (item.scheduledReleaseDate) {
        stats.scheduledItems++
      }
      
      // Sum reviews
      totalReviews += item.reviewCount
      
      // Track last pinned date
      if (!stats.lastPinnedAt || item.pinnedAt > stats.lastPinnedAt) {
        stats.lastPinnedAt = item.pinnedAt
      }
    }
    
    // Calculate average reviews
    if (items.length > 0) {
      stats.avgReviewsPerItem = totalReviews / items.length
    }
    
    return stats
  }
  
  /**
   * Update priority of a pinned item
   */
  async updatePriority(userId: string, contentId: string, priority: PinPriority): Promise<void> {
    const item = await this.getPinnedItem(userId, contentId)
    if (!item) {
      throw new Error(`Item ${contentId} is not pinned`)
    }
    
    item.priority = priority
    item.version++
    await this.savePinnedItem(item)
    this.updateCache(userId, item)
  }
  
  /**
   * Add tags to a pinned item
   */
  async addTags(userId: string, contentId: string, tags: string[]): Promise<void> {
    const item = await this.getPinnedItem(userId, contentId)
    if (!item) {
      throw new Error(`Item ${contentId} is not pinned`)
    }
    
    const uniqueTags = new Set([...item.tags, ...tags])
    item.tags = Array.from(uniqueTags)
    item.version++
    await this.savePinnedItem(item)
    this.updateCache(userId, item)
  }
  
  /**
   * Remove tags from a pinned item
   */
  async removeTags(userId: string, contentId: string, tags: string[]): Promise<void> {
    const item = await this.getPinnedItem(userId, contentId)
    if (!item) {
      throw new Error(`Item ${contentId} is not pinned`)
    }
    
    item.tags = item.tags.filter(tag => !tags.includes(tag))
    item.version++
    await this.savePinnedItem(item)
    this.updateCache(userId, item)
  }
  
  /**
   * Clear all pinned items for a user
   */
  async clearAll(userId: string): Promise<void> {
    const items = await this.getPinnedItems(userId)
    const contentIds = items.map(item => item.contentId)
    
    if (contentIds.length > 0) {
      await this.unpinBulk(userId, contentIds)
    }
  }
  
  // Private helper methods
  
  private isCacheValid(userId: string): boolean {
    const timestamp = this.cacheTimestamps.get(userId)
    if (!timestamp) return false
    
    const ttl = (this.config.cacheTTL || 300) * 1000 // Convert to milliseconds
    return Date.now() - timestamp < ttl
  }
  
  private updateCache(userId: string, item: PinnedItem): void {
    let userCache = this.pinnedItemsCache.get(userId)
    if (!userCache) {
      userCache = new Map()
      this.pinnedItemsCache.set(userId, userCache)
    }
    userCache.set(item.contentId, item)
    this.cacheTimestamps.set(userId, Date.now())
  }
  
  private removeFromCache(userId: string, contentId: string): void {
    const userCache = this.pinnedItemsCache.get(userId)
    if (userCache) {
      userCache.delete(contentId)
    }
  }
  
  private async updateStatistics(userId: string): Promise<void> {
    const stats = await this.getStatistics(userId)
    this.emit('stats:updated', { userId, stats })
  }
  
  // Storage methods (would be implemented with Firestore in production)
  
  private async savePinnedItem(item: PinnedItem): Promise<void> {
    // In production, this would save to Firestore
    // For now, using in-memory storage
    reviewLogger.info('Saving pinned item:', item)
  }
  
  private async loadPinnedItems(userId: string): Promise<PinnedItem[]> {
    // In production, this would load from Firestore
    // For now, returning empty array
    return []
  }
  
  private async deletePinnedItem(userId: string, itemId: string): Promise<void> {
    // In production, this would delete from Firestore
    reviewLogger.info('Deleting pinned item:', itemId)
  }
}

// Export singleton instance
export const pinManager = new PinManager()