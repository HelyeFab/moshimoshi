/**
 * Virtual List Component
 * Week 2 - Performance Optimization
 * 
 * Implements virtual scrolling for large lists to improve render performance
 * Only renders visible items + overscan buffer
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'

interface VirtualListProps<T> {
  items: T[]
  itemHeight: number | ((index: number) => number)
  renderItem: (item: T, index: number) => React.ReactNode
  height: number
  width?: string | number
  overscan?: number
  className?: string
  onScroll?: (scrollTop: number) => void
  estimatedItemHeight?: number
  getItemKey?: (item: T, index: number) => string | number
}

interface ItemPosition {
  index: number
  top: number
  height: number
}

/**
 * High-performance virtual list component
 */
export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  height,
  width = '100%',
  overscan = 3,
  className = '',
  onScroll,
  estimatedItemHeight = 50,
  getItemKey,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null)
  
  // Calculate item positions
  const itemPositions = useMemo(() => {
    const positions: ItemPosition[] = []
    let currentTop = 0
    
    for (let i = 0; i < items.length; i++) {
      const height = typeof itemHeight === 'function' 
        ? itemHeight(i) 
        : itemHeight
      
      positions.push({
        index: i,
        top: currentTop,
        height,
      })
      
      currentTop += height
    }
    
    return positions
  }, [items, itemHeight])
  
  // Calculate total height
  const totalHeight = useMemo(() => {
    if (itemPositions.length === 0) return 0
    const lastItem = itemPositions[itemPositions.length - 1]
    return lastItem.top + lastItem.height
  }, [itemPositions])
  
  // Calculate visible range
  const visibleRange = useMemo(() => {
    const containerHeight = height
    
    // Find first visible item
    let startIndex = 0
    for (let i = 0; i < itemPositions.length; i++) {
      if (itemPositions[i].top + itemPositions[i].height > scrollTop) {
        startIndex = Math.max(0, i - overscan)
        break
      }
    }
    
    // Find last visible item
    let endIndex = items.length - 1
    for (let i = startIndex; i < itemPositions.length; i++) {
      if (itemPositions[i].top > scrollTop + containerHeight) {
        endIndex = Math.min(items.length - 1, i + overscan)
        break
      }
    }
    
    return { startIndex, endIndex }
  }, [scrollTop, height, itemPositions, items.length, overscan])
  
  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop
    setScrollTop(newScrollTop)
    
    // Set scrolling state for performance optimization
    setIsScrolling(true)
    
    // Clear existing timeout
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current)
    }
    
    // Set new timeout to detect scroll end
    scrollTimeout.current = setTimeout(() => {
      setIsScrolling(false)
    }, 150)
    
    // Call external scroll handler
    if (onScroll) {
      onScroll(newScrollTop)
    }
  }, [onScroll])
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current)
      }
    }
  }, [])
  
  // Render visible items
  const visibleItems = useMemo(() => {
    const { startIndex, endIndex } = visibleRange
    const visibleItems: React.ReactNode[] = []
    
    for (let i = startIndex; i <= endIndex; i++) {
      const item = items[i]
      const position = itemPositions[i]
      
      if (!item || !position) continue
      
      const key = getItemKey ? getItemKey(item, i) : i
      
      visibleItems.push(
        <div
          key={key}
          style={{
            position: 'absolute',
            top: position.top,
            left: 0,
            right: 0,
            height: position.height,
            // Reduce render quality while scrolling
            willChange: isScrolling ? 'transform' : 'auto',
          }}
        >
          {renderItem(item, i)}
        </div>
      )
    }
    
    return visibleItems
  }, [visibleRange, items, itemPositions, renderItem, getItemKey, isScrolling])
  
  return (
    <div
      ref={containerRef}
      className={`virtual-list-container ${className}`}
      style={{
        height,
        width,
        overflow: 'auto',
        position: 'relative',
      }}
      onScroll={handleScroll}
    >
      {/* Total height placeholder */}
      <div
        style={{
          height: totalHeight,
          width: '100%',
          position: 'relative',
        }}
      >
        {/* Visible items */}
        {visibleItems}
      </div>
    </div>
  )
}

/**
 * Variable height virtual list
 */
export function DynamicVirtualList<T>({
  items,
  estimatedItemHeight = 50,
  renderItem,
  height,
  width = '100%',
  overscan = 3,
  className = '',
  getItemKey,
}: Omit<VirtualListProps<T>, 'itemHeight'> & { estimatedItemHeight?: number }) {
  const [measuredHeights, setMeasuredHeights] = useState<Map<number, number>>(new Map())
  const measureCache = useRef<Map<number, number>>(new Map())
  
  // Calculate item height with measurements
  const getItemHeight = useCallback((index: number) => {
    return measuredHeights.get(index) || estimatedItemHeight
  }, [measuredHeights, estimatedItemHeight])
  
  // Measure item callback
  const measureItem = useCallback((index: number, element: HTMLElement | null) => {
    if (!element) return
    
    const height = element.getBoundingClientRect().height
    
    if (measureCache.current.get(index) !== height) {
      measureCache.current.set(index, height)
      
      // Batch update measurements
      requestAnimationFrame(() => {
        setMeasuredHeights(new Map(measureCache.current))
      })
    }
  }, [])
  
  // Wrapped render function with measurement
  const wrappedRenderItem = useCallback((item: T, index: number) => {
    return (
      <div
        ref={(el) => measureItem(index, el)}
        style={{ width: '100%' }}
      >
        {renderItem(item, index)}
      </div>
    )
  }, [renderItem, measureItem])
  
  return (
    <VirtualList
      items={items}
      itemHeight={getItemHeight}
      renderItem={wrappedRenderItem}
      height={height}
      width={width}
      overscan={overscan}
      className={className}
      estimatedItemHeight={estimatedItemHeight}
      getItemKey={getItemKey}
    />
  )
}

/**
 * Hook for virtual scrolling
 */
export function useVirtualScroll<T>(
  items: T[],
  containerHeight: number,
  itemHeight: number,
  overscan: number = 3
) {
  const [scrollTop, setScrollTop] = useState(0)
  
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )
    
    return { startIndex, endIndex }
  }, [scrollTop, containerHeight, itemHeight, items.length, overscan])
  
  const visibleItems = useMemo(() => {
    const { startIndex, endIndex } = visibleRange
    return items.slice(startIndex, endIndex + 1)
  }, [items, visibleRange])
  
  const totalHeight = items.length * itemHeight
  const offsetY = visibleRange.startIndex * itemHeight
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll: (e: React.UIEvent<HTMLElement>) => {
      setScrollTop(e.currentTarget.scrollTop)
    },
  }
}