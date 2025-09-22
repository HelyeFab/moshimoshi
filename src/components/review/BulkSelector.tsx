'use client'

/**
 * BulkSelector Component
 * Interface for selecting multiple items with various selection modes
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { ReviewableContentWithSRS } from '@/lib/review-engine/core/interfaces'
import { PinButton } from './PinButton'
import { usePinStore } from '@/stores/pin-store'
import { PinOptions } from '@/lib/review-engine/pinning/types'

/**
 * Selection mode types
 */
export type SelectionMode = 'single' | 'multiple' | 'range'

/**
 * Layout options
 */
export type LayoutMode = 'grid' | 'list'

/**
 * BulkSelector props
 */
interface BulkSelectorProps {
  /**
   * Items to display for selection
   */
  items: ReviewableContentWithSRS[]
  
  /**
   * Callback when selection changes
   */
  onSelectionChange: (selected: Set<string>) => void
  
  /**
   * Maximum number of items that can be selected
   */
  maxSelection?: number
  
  /**
   * Layout mode
   */
  layout?: LayoutMode
  
  /**
   * Selection mode
   */
  selectionMode?: SelectionMode
  
  /**
   * Show pinned status
   */
  showPinStatus?: boolean
  
  /**
   * Enable bulk actions
   */
  enableBulkActions?: boolean
  
  /**
   * Custom item renderer
   */
  renderItem?: (item: ReviewableContentWithSRS, isSelected: boolean) => React.ReactNode
  
  /**
   * Class name for container
   */
  className?: string
}

/**
 * BulkSelector component
 */
export const BulkSelector: React.FC<BulkSelectorProps> = ({
  items,
  onSelectionChange,
  maxSelection,
  layout = 'grid',
  selectionMode = 'multiple',
  showPinStatus = true,
  enableBulkActions = true,
  renderItem,
  className = ''
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  
  const { pinBulk, unpinBulk, isPinned, isLoading } = usePinStore()
  
  /**
   * Handle individual item selection
   */
  const handleItemClick = useCallback((
    item: ReviewableContentWithSRS,
    index: number,
    event: React.MouseEvent
  ) => {
    const itemId = item.id
    const newSelected = new Set(selected)
    
    if (selectionMode === 'single') {
      // Single selection mode
      if (newSelected.has(itemId)) {
        newSelected.clear()
      } else {
        newSelected.clear()
        newSelected.add(itemId)
      }
      setLastSelectedIndex(index)
      
    } else if (selectionMode === 'multiple') {
      // Multiple selection mode
      if (event.shiftKey && lastSelectedIndex !== null) {
        // Range selection with Shift
        const start = Math.min(lastSelectedIndex, index)
        const end = Math.max(lastSelectedIndex, index)
        
        for (let i = start; i <= end; i++) {
          if (i < items.length) {
            newSelected.add(items[i].id)
          }
        }
      } else if (event.ctrlKey || event.metaKey) {
        // Toggle selection with Ctrl/Cmd
        if (newSelected.has(itemId)) {
          newSelected.delete(itemId)
        } else {
          if (!maxSelection || newSelected.size < maxSelection) {
            newSelected.add(itemId)
          }
        }
      } else {
        // Regular click - toggle single item
        if (newSelected.has(itemId)) {
          newSelected.delete(itemId)
        } else {
          if (!maxSelection || newSelected.size < maxSelection) {
            newSelected.add(itemId)
          }
        }
      }
      setLastSelectedIndex(index)
      
    } else if (selectionMode === 'range') {
      // Range selection mode
      if (lastSelectedIndex === null) {
        newSelected.clear()
        newSelected.add(itemId)
        setLastSelectedIndex(index)
      } else {
        const start = Math.min(lastSelectedIndex, index)
        const end = Math.max(lastSelectedIndex, index)
        
        newSelected.clear()
        for (let i = start; i <= end; i++) {
          if (i < items.length) {
            if (!maxSelection || newSelected.size < maxSelection) {
              newSelected.add(items[i].id)
            }
          }
        }
        setLastSelectedIndex(null)
      }
    }
    
    setSelected(newSelected)
    onSelectionChange(newSelected)
  }, [selected, selectionMode, lastSelectedIndex, items, maxSelection, onSelectionChange])
  
  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent, index: number) => {
    const item = items[index]
    if (!item) return
    
    switch (event.key) {
      case ' ':
      case 'Enter':
        event.preventDefault()
        handleItemClick(item, index, event as any)
        break
      
      case 'a':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault()
          selectAll()
        }
        break
      
      case 'Escape':
        event.preventDefault()
        clearSelection()
        break
    }
  }, [items, handleItemClick])
  
  /**
   * Select all items
   */
  const selectAll = useCallback(() => {
    const newSelected = new Set<string>()
    const limit = maxSelection || items.length
    
    for (let i = 0; i < Math.min(items.length, limit); i++) {
      newSelected.add(items[i].id)
    }
    
    setSelected(newSelected)
    onSelectionChange(newSelected)
  }, [items, maxSelection, onSelectionChange])
  
  /**
   * Clear selection
   */
  const clearSelection = useCallback(() => {
    setSelected(new Set())
    onSelectionChange(new Set())
    setLastSelectedIndex(null)
  }, [onSelectionChange])
  
  /**
   * Invert selection
   */
  const invertSelection = useCallback(() => {
    const newSelected = new Set<string>()
    const limit = maxSelection || items.length
    let added = 0
    
    for (const item of items) {
      if (!selected.has(item.id)) {
        if (added < limit) {
          newSelected.add(item.id)
          added++
        }
      }
    }
    
    setSelected(newSelected)
    onSelectionChange(newSelected)
  }, [items, selected, maxSelection, onSelectionChange])
  
  /**
   * Pin selected items
   */
  const pinSelected = useCallback(async (options?: PinOptions) => {
    if (selected.size === 0) return
    
    setIsSelecting(true)
    
    const itemsToPin = items
      .filter(item => selected.has(item.id) && !isPinned(item.id))
      .map(item => ({
        contentId: item.id,
        contentType: item.contentType
      }))
    
    if (itemsToPin.length > 0) {
      try {
        await pinBulk(itemsToPin, options)
        clearSelection()
      } catch (error) {
        console.error('Failed to pin items:', error)
      }
    }
    
    setIsSelecting(false)
  }, [selected, items, isPinned, pinBulk, clearSelection])
  
  /**
   * Unpin selected items
   */
  const unpinSelected = useCallback(async () => {
    if (selected.size === 0) return
    
    setIsSelecting(true)
    
    const itemsToUnpin = Array.from(selected).filter(id => isPinned(id))
    
    if (itemsToUnpin.length > 0) {
      try {
        await unpinBulk(itemsToUnpin)
        clearSelection()
      } catch (error) {
        console.error('Failed to unpin items:', error)
      }
    }
    
    setIsSelecting(false)
  }, [selected, isPinned, unpinBulk, clearSelection])
  
  /**
   * Calculate selection statistics
   */
  const selectionStats = useMemo(() => {
    const pinnedCount = Array.from(selected).filter(id => isPinned(id)).length
    const unpinnedCount = selected.size - pinnedCount
    
    return {
      total: selected.size,
      pinned: pinnedCount,
      unpinned: unpinnedCount
    }
  }, [selected, isPinned])
  
  /**
   * Default item renderer
   */
  const defaultRenderItem = useCallback((
    item: ReviewableContentWithSRS,
    isSelected: boolean
  ) => (
    <div className="flex flex-col p-3">
      <div className="text-lg font-medium">{item.primaryDisplay}</div>
      {item.secondaryDisplay && (
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {item.secondaryDisplay}
        </div>
      )}
      {item.tertiaryDisplay && (
        <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          {item.tertiaryDisplay}
        </div>
      )}
    </div>
  ), [])
  
  const itemRenderer = renderItem || defaultRenderItem
  
  // Layout classes
  const layoutClasses = {
    grid: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3',
    list: 'flex flex-col space-y-2'
  }
  
  return (
    <div className={`relative ${className}`}>
      {/* Bulk actions toolbar */}
      {enableBulkActions && (
        <div className="sticky top-0 z-10 bg-soft-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Selection controls */}
              <button
                onClick={selectAll}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                disabled={isLoading || isSelecting}
              >
                Select All
              </button>
              <button
                onClick={clearSelection}
                className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                disabled={isLoading || isSelecting || selected.size === 0}
              >
                Clear
              </button>
              <button
                onClick={invertSelection}
                className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                disabled={isLoading || isSelecting}
              >
                Invert
              </button>
              
              {/* Selection count */}
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {selected.size} of {items.length} selected
                {maxSelection && ` (max: ${maxSelection})`}
              </span>
            </div>
            
            {/* Action buttons */}
            {selected.size > 0 && (
              <div className="flex items-center space-x-2">
                {selectionStats.unpinned > 0 && (
                  <button
                    onClick={() => pinSelected()}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                    disabled={isLoading || isSelecting}
                  >
                    Pin {selectionStats.unpinned} item{selectionStats.unpinned !== 1 ? 's' : ''}
                  </button>
                )}
                {selectionStats.pinned > 0 && (
                  <button
                    onClick={unpinSelected}
                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:opacity-50"
                    disabled={isLoading || isSelecting}
                  >
                    Unpin {selectionStats.pinned} item{selectionStats.pinned !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Items grid/list */}
      <div className={layoutClasses[layout]}>
        {items.map((item, index) => {
          const isSelected = selected.has(item.id)
          const isItemPinned = isPinned(item.id)
          
          return (
            <div
              key={item.id}
              className={`
                relative rounded-lg border-2 transition-all cursor-pointer
                ${isSelected 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
                ${isItemPinned ? 'ring-2 ring-blue-300 dark:ring-blue-700' : ''}
              `}
              onClick={(e) => handleItemClick(item, index, e)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              tabIndex={0}
              role="checkbox"
              aria-checked={isSelected}
              aria-label={`${item.primaryDisplay} ${item.secondaryDisplay || ''}`}
            >
              {/* Selection indicator */}
              <div className="absolute top-2 left-2">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              
              {/* Pin indicator */}
              {showPinStatus && (
                <div className="absolute top-2 right-2">
                  <div onClick={(e) => e.stopPropagation()}>
                    <PinButton
                      contentType={item.contentType}
                      contentId={item.id}
                      size="sm"
                      variant="icon"
                      disabled={isSelecting}
                    />
                  </div>
                </div>
              )}
              
              {/* Item content */}
              <div className="pt-8">
                {itemRenderer(item, isSelected)}
              </div>
              
              {/* Selection number badge */}
              {isSelected && selectionMode === 'range' && (
                <div className="absolute bottom-2 right-2 w-6 h-6 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                  {Array.from(selected).indexOf(item.id) + 1}
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      {/* Loading overlay */}
      {(isLoading || isSelecting) && (
        <div className="absolute inset-0 bg-soft-white/50 dark:bg-gray-900/50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}
    </div>
  )
}