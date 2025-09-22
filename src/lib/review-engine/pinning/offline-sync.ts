/**
 * Offline Sync Support for Pinning System
 * Integrates with the existing sync queue for offline-first functionality
 */

import { PinnedItem, PinOptions, BulkPinResult } from './types'
import { SyncQueue, SyncQueueItem } from '../offline/sync-queue'
import { IndexedDBStorage } from '../offline/indexed-db'
import { reviewLogger } from '@/lib/monitoring/logger';

/**
 * Pin sync operations
 */
export type PinSyncOperation = 
  | 'pin'
  | 'unpin'
  | 'bulkPin'
  | 'bulkUnpin'
  | 'updatePriority'
  | 'addTags'
  | 'removeTags'
  | 'applyRelease'

/**
 * Pin sync data for queue
 */
export interface PinSyncData {
  operation: PinSyncOperation
  userId: string
  contentId?: string
  contentType?: string
  contentIds?: string[]
  items?: Array<{ contentId: string; contentType: string }>
  options?: PinOptions
  priority?: 'low' | 'normal' | 'high'
  tags?: string[]
  timestamp: Date
}

/**
 * Offline-capable pin sync service
 */
export class PinOfflineSync {
  private syncQueue: SyncQueue
  private storage: IndexedDBStorage
  private pendingOperations: Map<string, PinSyncData> = new Map()
  
  constructor(syncQueue: SyncQueue, storage: IndexedDBStorage) {
    this.syncQueue = syncQueue
    this.storage = storage
    this.setupEventListeners()
  }
  
  /**
   * Setup network event listeners
   */
  private setupEventListeners(): void {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      reviewLogger.info('Online: Processing pending pin operations')
      this.processPendingOperations()
    })
    
    window.addEventListener('offline', () => {
      reviewLogger.info('Offline: Pin operations will be queued')
    })
    
    // Listen for storage events (sync across tabs)
    window.addEventListener('storage', (e) => {
      if (e.key === 'pin-sync-update') {
        this.handleCrossTabSync(e.newValue)
      }
    })
  }
  
  /**
   * Queue a pin operation for offline sync
   */
  async queuePinOperation(data: PinSyncData): Promise<void> {
    const operationId = this.generateOperationId(data)
    
    // Store in pending operations
    this.pendingOperations.set(operationId, data)
    
    // Add to sync queue
    await this.syncQueue.add({
      type: 'pin' as any,
      action: this.mapOperationToAction(data.operation),
      data: data
    })
    
    // Store locally for immediate access
    await this.storeLocally(data)
    
    // Notify other tabs
    this.notifyCrossTabSync(data)
  }
  
  /**
   * Store pin operation locally for offline access
   */
  private async storeLocally(data: PinSyncData): Promise<void> {
    try {
      // Store in IndexedDB based on operation type
      switch (data.operation) {
        case 'pin':
          if (data.contentId && data.contentType) {
            const pinnedItem: Partial<PinnedItem> = {
              userId: data.userId,
              contentId: data.contentId,
              contentType: data.contentType,
              pinnedAt: data.timestamp,
              priority: data.options?.priority || 'normal',
              tags: data.options?.tags || [],
              setIds: data.options?.setId ? [data.options.setId] : [],
              isActive: true,
              reviewCount: 0,
              version: 1
            }
            await this.storage.savePinnedItem(pinnedItem as PinnedItem)
          }
          break
          
        case 'unpin':
          if (data.contentId) {
            await this.storage.removePinnedItem(data.userId, data.contentId)
          }
          break
          
        case 'bulkPin':
          if (data.items) {
            for (const item of data.items) {
              const pinnedItem: Partial<PinnedItem> = {
                userId: data.userId,
                contentId: item.contentId,
                contentType: item.contentType,
                pinnedAt: data.timestamp,
                priority: data.options?.priority || 'normal',
                tags: data.options?.tags || [],
                setIds: data.options?.setId ? [data.options.setId] : [],
                isActive: data.options?.releaseSchedule !== 'gradual',
                reviewCount: 0,
                version: 1
              }
              await this.storage.savePinnedItem(pinnedItem as PinnedItem)
            }
          }
          break
          
        case 'bulkUnpin':
          if (data.contentIds) {
            for (const contentId of data.contentIds) {
              await this.storage.removePinnedItem(data.userId, contentId)
            }
          }
          break
          
        case 'updatePriority':
          if (data.contentId && data.priority) {
            await this.storage.updatePinnedItemPriority(
              data.userId,
              data.contentId,
              data.priority
            )
          }
          break
          
        case 'addTags':
        case 'removeTags':
          if (data.contentId && data.tags) {
            await this.storage.updatePinnedItemTags(
              data.userId,
              data.contentId,
              data.tags,
              data.operation === 'addTags'
            )
          }
          break
      }
    } catch (error) {
      reviewLogger.error('Failed to store pin operation locally:', error)
    }
  }
  
  /**
   * Process pending operations when coming back online
   */
  async processPendingOperations(): Promise<void> {
    if (!navigator.onLine) return
    
    const operations = Array.from(this.pendingOperations.values())
    
    for (const operation of operations) {
      try {
        await this.syncOperation(operation)
        
        // Remove from pending on success
        const operationId = this.generateOperationId(operation)
        this.pendingOperations.delete(operationId)
      } catch (error) {
        reviewLogger.error('Failed to sync pin operation:', error)
      }
    }
  }
  
  /**
   * Sync a single operation with the server
   */
  private async syncOperation(data: PinSyncData): Promise<void> {
    // This would call the actual API endpoints
    // For now, just logging the operation
    reviewLogger.info('Syncing pin operation:', data)
    
    // In production, this would make API calls like:
    // await fetch('/api/review/pin', { method: 'POST', body: JSON.stringify(data) })
  }
  
  /**
   * Load cached pinned items from IndexedDB
   */
  async loadCachedPinnedItems(userId: string): Promise<PinnedItem[]> {
    try {
      return await this.storage.getPinnedItems(userId)
    } catch (error) {
      reviewLogger.error('Failed to load cached pinned items:', error)
      return []
    }
  }
  
  /**
   * Clear cached data for a user
   */
  async clearCache(userId: string): Promise<void> {
    try {
      await this.storage.clearPinnedItems(userId)
      this.pendingOperations.clear()
    } catch (error) {
      reviewLogger.error('Failed to clear pin cache:', error)
    }
  }
  
  /**
   * Get pending operations count
   */
  getPendingCount(): number {
    return this.pendingOperations.size
  }
  
  /**
   * Check if there are pending operations
   */
  hasPendingOperations(): boolean {
    return this.pendingOperations.size > 0
  }
  
  /**
   * Generate unique operation ID
   */
  private generateOperationId(data: PinSyncData): string {
    return `${data.operation}-${data.userId}-${data.contentId || 'bulk'}-${data.timestamp.getTime()}`
  }
  
  /**
   * Map operation to sync action
   */
  private mapOperationToAction(operation: PinSyncOperation): 'create' | 'update' | 'delete' {
    switch (operation) {
      case 'pin':
      case 'bulkPin':
        return 'create'
      case 'unpin':
      case 'bulkUnpin':
        return 'delete'
      default:
        return 'update'
    }
  }
  
  /**
   * Handle cross-tab synchronization
   */
  private handleCrossTabSync(data: string | null): void {
    if (!data) return
    
    try {
      const syncData = JSON.parse(data) as PinSyncData
      // Update local state based on sync from another tab
      this.storeLocally(syncData)
    } catch (error) {
      reviewLogger.error('Failed to handle cross-tab sync:', error)
    }
  }
  
  /**
   * Notify other tabs of sync update
   */
  private notifyCrossTabSync(data: PinSyncData): void {
    try {
      localStorage.setItem('pin-sync-update', JSON.stringify(data))
      // Clear after a moment to prevent stale data
      setTimeout(() => {
        localStorage.removeItem('pin-sync-update')
      }, 100)
    } catch (error) {
      reviewLogger.error('Failed to notify cross-tab sync:', error)
    }
  }
}

/**
 * Extend IndexedDB storage with pin-specific methods
 */
declare module '../offline/indexed-db' {
  interface IndexedDBStorage {
    savePinnedItem(item: PinnedItem): Promise<void>
    removePinnedItem(userId: string, contentId: string): Promise<void>
    getPinnedItems(userId: string): Promise<PinnedItem[]>
    clearPinnedItems(userId: string): Promise<void>
    updatePinnedItemPriority(userId: string, contentId: string, priority: 'low' | 'normal' | 'high'): Promise<void>
    updatePinnedItemTags(userId: string, contentId: string, tags: string[], add: boolean): Promise<void>
  }
}

// Export singleton instance
let pinOfflineSync: PinOfflineSync | null = null

export function initializePinOfflineSync(syncQueue: SyncQueue, storage: IndexedDBStorage): PinOfflineSync {
  if (!pinOfflineSync) {
    pinOfflineSync = new PinOfflineSync(syncQueue, storage)
  }
  return pinOfflineSync
}

export function getPinOfflineSync(): PinOfflineSync | null {
  return pinOfflineSync
}