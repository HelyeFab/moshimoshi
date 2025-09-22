/**
 * Pin State Store
 * Global state management for pinned items using Zustand
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { PinnedItem, PinOptions, PinStatistics, BulkPinResult } from '@/lib/review-engine/pinning/types'
import { pinManager } from '@/lib/review-engine/pinning/pin-manager'

/**
 * Pin store state interface
 */
interface PinState {
  // State
  pinnedItems: Map<string, PinnedItem>
  statistics: PinStatistics | null
  isLoading: boolean
  isInitialized: boolean
  error: string | null
  lastSync: Date | null
  
  // Optimistic updates tracking
  pendingOperations: Set<string>
  optimisticUpdates: Map<string, PinnedItem>
  
  // Current user
  currentUserId: string | null
}

/**
 * Pin store actions interface
 */
interface PinActions {
  // Initialization
  initialize: (userId: string) => Promise<void>
  reset: () => void
  
  // Core operations
  loadPinnedItems: (userId: string) => Promise<void>
  pinItem: (contentId: string, contentType: string, options?: PinOptions) => Promise<void>
  unpinItem: (contentId: string) => Promise<void>
  pinBulk: (items: Array<{ contentId: string; contentType: string }>, options?: PinOptions) => Promise<BulkPinResult>
  unpinBulk: (contentIds: string[]) => Promise<void>
  
  // Update operations
  updatePriority: (contentId: string, priority: 'low' | 'normal' | 'high') => Promise<void>
  addTags: (contentId: string, tags: string[]) => Promise<void>
  removeTags: (contentId: string, tags: string[]) => Promise<void>
  
  // Query operations
  isPinned: (contentId: string) => boolean
  getPinnedItem: (contentId: string) => PinnedItem | undefined
  getPinnedCount: () => number
  getActiveItems: () => PinnedItem[]
  getItemsByTag: (tag: string) => PinnedItem[]
  getItemsByPriority: (priority: 'low' | 'normal' | 'high') => PinnedItem[]
  
  // Statistics
  loadStatistics: (userId: string) => Promise<void>
  
  // Error handling
  clearError: () => void
  
  // Sync operations
  syncWithServer: () => Promise<void>
  applyGradualRelease: () => Promise<void>
}

/**
 * Combined store type
 */
type PinStore = PinState & PinActions

/**
 * Create the pin store
 */
export const usePinStore = create<PinStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        pinnedItems: new Map(),
        statistics: null,
        isLoading: false,
        isInitialized: false,
        error: null,
        lastSync: null,
        pendingOperations: new Set(),
        optimisticUpdates: new Map(),
        currentUserId: null,
        
        // Initialize store for a user
        initialize: async (userId: string) => {
          const state = get()
          if (state.isInitialized && state.currentUserId === userId) {
            return
          }
          
          set({ 
            isLoading: true, 
            error: null,
            currentUserId: userId 
          })
          
          try {
            await get().loadPinnedItems(userId)
            await get().loadStatistics(userId)
            set({ isInitialized: true })
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to initialize',
              isInitialized: false 
            })
          } finally {
            set({ isLoading: false })
          }
        },
        
        // Reset store
        reset: () => {
          set({
            pinnedItems: new Map(),
            statistics: null,
            isLoading: false,
            isInitialized: false,
            error: null,
            lastSync: null,
            pendingOperations: new Set(),
            optimisticUpdates: new Map(),
            currentUserId: null
          })
        },
        
        // Load pinned items
        loadPinnedItems: async (userId: string) => {
          set({ isLoading: true, error: null })
          
          try {
            const items = await pinManager.getPinnedItems(userId)
            const itemsMap = new Map<string, PinnedItem>()
            items.forEach(item => itemsMap.set(item.contentId, item))
            
            set({
              pinnedItems: itemsMap,
              lastSync: new Date()
            })
          } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to load pinned items' })
            throw error
          } finally {
            set({ isLoading: false })
          }
        },
        
        // Pin a single item with optimistic update
        pinItem: async (contentId: string, contentType: string, options?: PinOptions) => {
          const state = get()
          const userId = state.currentUserId
          
          if (!userId) {
            throw new Error('User not initialized')
          }
          
          // Check if already pinned
          if (state.pinnedItems.has(contentId)) {
            return
          }
          
          // Create optimistic item
          const optimisticItem: PinnedItem = {
            id: `temp-${Date.now()}`,
            userId,
            contentType,
            contentId,
            pinnedAt: new Date(),
            priority: options?.priority || 'normal',
            tags: options?.tags || [],
            setIds: options?.setId ? [options.setId] : [],
            isActive: true,
            reviewCount: 0,
            version: 1
          }
          
          // Apply optimistic update
          const newItems = new Map(state.pinnedItems)
          newItems.set(contentId, optimisticItem)
          const newOptimistic = new Map(state.optimisticUpdates)
          newOptimistic.set(contentId, optimisticItem)
          const newPending = new Set(state.pendingOperations)
          newPending.add(contentId)
          
          set({ 
            pinnedItems: newItems,
            optimisticUpdates: newOptimistic,
            pendingOperations: newPending,
            error: null
          })
          
          try {
            // Perform actual operation
            const pinnedItem = await pinManager.pin(userId, contentId, contentType, options)
            
            // Update with real data
            const finalItems = new Map(get().pinnedItems)
            finalItems.set(contentId, pinnedItem)
            const finalOptimistic = new Map(get().optimisticUpdates)
            finalOptimistic.delete(contentId)
            const finalPending = new Set(get().pendingOperations)
            finalPending.delete(contentId)
            
            set({ 
              pinnedItems: finalItems,
              optimisticUpdates: finalOptimistic,
              pendingOperations: finalPending
            })
            
            // Reload statistics
            await get().loadStatistics(userId)
            
          } catch (error) {
            // Rollback optimistic update
            const rollbackItems = new Map(get().pinnedItems)
            rollbackItems.delete(contentId)
            const rollbackOptimistic = new Map(get().optimisticUpdates)
            rollbackOptimistic.delete(contentId)
            const rollbackPending = new Set(get().pendingOperations)
            rollbackPending.delete(contentId)
            
            set({ 
              pinnedItems: rollbackItems,
              optimisticUpdates: rollbackOptimistic,
              pendingOperations: rollbackPending,
              error: error instanceof Error ? error.message : 'Failed to pin item'
            })
            throw error
          }
        },
        
        // Unpin item with optimistic update
        unpinItem: async (contentId: string) => {
          const state = get()
          const userId = state.currentUserId
          
          if (!userId) {
            throw new Error('User not initialized')
          }
          
          // Check if item exists
          const item = state.pinnedItems.get(contentId)
          if (!item) {
            return
          }
          
          // Apply optimistic update
          const newItems = new Map(state.pinnedItems)
          newItems.delete(contentId)
          const newPending = new Set(state.pendingOperations)
          newPending.add(contentId)
          
          set({ 
            pinnedItems: newItems,
            pendingOperations: newPending,
            error: null
          })
          
          try {
            // Perform actual operation
            await pinManager.unpin(userId, contentId)
            
            // Confirm removal
            const finalPending = new Set(get().pendingOperations)
            finalPending.delete(contentId)
            
            set({ pendingOperations: finalPending })
            
            // Reload statistics
            await get().loadStatistics(userId)
            
          } catch (error) {
            // Rollback optimistic update
            const rollbackItems = new Map(get().pinnedItems)
            rollbackItems.set(contentId, item)
            const rollbackPending = new Set(get().pendingOperations)
            rollbackPending.delete(contentId)
            
            set({ 
              pinnedItems: rollbackItems,
              pendingOperations: rollbackPending,
              error: error instanceof Error ? error.message : 'Failed to unpin item'
            })
            throw error
          }
        },
        
        // Pin multiple items
        pinBulk: async (items: Array<{ contentId: string; contentType: string }>, options?: PinOptions) => {
          const state = get()
          const userId = state.currentUserId
          
          if (!userId) {
            throw new Error('User not initialized')
          }
          
          set({ isLoading: true, error: null })
          
          try {
            const result = await pinManager.pinBulk(userId, items, options)
            
            // Update state with new items
            const newItems = new Map(state.pinnedItems)
            result.succeeded.forEach(item => {
              newItems.set(item.contentId, item)
            })
            
            set({ pinnedItems: newItems })
            
            // Reload statistics
            await get().loadStatistics(userId)
            
            return result
          } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to pin items' })
            throw error
          } finally {
            set({ isLoading: false })
          }
        },
        
        // Unpin multiple items
        unpinBulk: async (contentIds: string[]) => {
          const state = get()
          const userId = state.currentUserId
          
          if (!userId) {
            throw new Error('User not initialized')
          }
          
          // Apply optimistic update
          const newItems = new Map(state.pinnedItems)
          const removedItems = new Map<string, PinnedItem>()
          
          contentIds.forEach(id => {
            const item = newItems.get(id)
            if (item) {
              removedItems.set(id, item)
              newItems.delete(id)
            }
          })
          
          set({ pinnedItems: newItems, error: null })
          
          try {
            await pinManager.unpinBulk(userId, contentIds)
            
            // Reload statistics
            await get().loadStatistics(userId)
            
          } catch (error) {
            // Rollback optimistic update
            const rollbackItems = new Map(get().pinnedItems)
            removedItems.forEach((item, id) => {
              rollbackItems.set(id, item)
            })
            
            set({ 
              pinnedItems: rollbackItems,
              error: error instanceof Error ? error.message : 'Failed to unpin items'
            })
            throw error
          }
        },
        
        // Update priority
        updatePriority: async (contentId: string, priority: 'low' | 'normal' | 'high') => {
          const state = get()
          const userId = state.currentUserId
          
          if (!userId) {
            throw new Error('User not initialized')
          }
          
          const item = state.pinnedItems.get(contentId)
          if (!item) {
            throw new Error('Item not found')
          }
          
          // Optimistic update
          const updatedItem = { ...item, priority }
          const newItems = new Map(state.pinnedItems)
          newItems.set(contentId, updatedItem)
          
          set({ pinnedItems: newItems })
          
          try {
            await pinManager.updatePriority(userId, contentId, priority)
          } catch (error) {
            // Rollback
            const rollbackItems = new Map(get().pinnedItems)
            rollbackItems.set(contentId, item)
            set({ 
              pinnedItems: rollbackItems,
              error: error instanceof Error ? error.message : 'Failed to update priority'
            })
            throw error
          }
        },
        
        // Add tags
        addTags: async (contentId: string, tags: string[]) => {
          const state = get()
          const userId = state.currentUserId
          
          if (!userId) {
            throw new Error('User not initialized')
          }
          
          const item = state.pinnedItems.get(contentId)
          if (!item) {
            throw new Error('Item not found')
          }
          
          // Optimistic update
          const uniqueTags = new Set([...item.tags, ...tags])
          const updatedItem = { ...item, tags: Array.from(uniqueTags) }
          const newItems = new Map(state.pinnedItems)
          newItems.set(contentId, updatedItem)
          
          set({ pinnedItems: newItems })
          
          try {
            await pinManager.addTags(userId, contentId, tags)
          } catch (error) {
            // Rollback
            const rollbackItems = new Map(get().pinnedItems)
            rollbackItems.set(contentId, item)
            set({ 
              pinnedItems: rollbackItems,
              error: error instanceof Error ? error.message : 'Failed to add tags'
            })
            throw error
          }
        },
        
        // Remove tags
        removeTags: async (contentId: string, tags: string[]) => {
          const state = get()
          const userId = state.currentUserId
          
          if (!userId) {
            throw new Error('User not initialized')
          }
          
          const item = state.pinnedItems.get(contentId)
          if (!item) {
            throw new Error('Item not found')
          }
          
          // Optimistic update
          const updatedItem = { 
            ...item, 
            tags: item.tags.filter(tag => !tags.includes(tag))
          }
          const newItems = new Map(state.pinnedItems)
          newItems.set(contentId, updatedItem)
          
          set({ pinnedItems: newItems })
          
          try {
            await pinManager.removeTags(userId, contentId, tags)
          } catch (error) {
            // Rollback
            const rollbackItems = new Map(get().pinnedItems)
            rollbackItems.set(contentId, item)
            set({ 
              pinnedItems: rollbackItems,
              error: error instanceof Error ? error.message : 'Failed to remove tags'
            })
            throw error
          }
        },
        
        // Check if item is pinned
        isPinned: (contentId: string) => {
          return get().pinnedItems.has(contentId)
        },
        
        // Get specific pinned item
        getPinnedItem: (contentId: string) => {
          return get().pinnedItems.get(contentId)
        },
        
        // Get pinned count
        getPinnedCount: () => {
          return get().pinnedItems.size
        },
        
        // Get active items
        getActiveItems: () => {
          return Array.from(get().pinnedItems.values()).filter(item => item.isActive)
        },
        
        // Get items by tag
        getItemsByTag: (tag: string) => {
          return Array.from(get().pinnedItems.values()).filter(item => 
            item.tags.includes(tag)
          )
        },
        
        // Get items by priority
        getItemsByPriority: (priority: 'low' | 'normal' | 'high') => {
          return Array.from(get().pinnedItems.values()).filter(item => 
            item.priority === priority
          )
        },
        
        // Load statistics
        loadStatistics: async (userId: string) => {
          try {
            const stats = await pinManager.getStatistics(userId)
            set({ statistics: stats })
          } catch (error) {
            console.error('Failed to load statistics:', error)
          }
        },
        
        // Clear error
        clearError: () => {
          set({ error: null })
        },
        
        // Sync with server
        syncWithServer: async () => {
          const state = get()
          const userId = state.currentUserId
          
          if (!userId) {
            throw new Error('User not initialized')
          }
          
          set({ isLoading: true })
          
          try {
            await get().loadPinnedItems(userId)
            await get().loadStatistics(userId)
            set({ lastSync: new Date() })
          } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Sync failed' })
            throw error
          } finally {
            set({ isLoading: false })
          }
        },
        
        // Apply gradual release
        applyGradualRelease: async () => {
          const state = get()
          const userId = state.currentUserId
          
          if (!userId) {
            throw new Error('User not initialized')
          }
          
          try {
            const releasedItems = await pinManager.applyGradualRelease(userId)
            
            // Update local state
            const newItems = new Map(state.pinnedItems)
            releasedItems.forEach(item => {
              newItems.set(item.contentId, item)
            })
            
            set({ pinnedItems: newItems })
            
            // Reload statistics
            await get().loadStatistics(userId)
            
          } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to apply gradual release' })
            throw error
          }
        }
      }),
      {
        name: 'pin-store',
        partialize: (state) => ({
          // Only persist essential data
          currentUserId: state.currentUserId,
          lastSync: state.lastSync
        })
      }
    )
  )
)