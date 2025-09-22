'use client'

/**
 * PinButton Component
 * Interactive button for pinning/unpinning review items with optimistic updates
 */

import React, { useState, useCallback, useEffect } from 'react'
import { usePinStore } from '@/stores/pin-store'
import { PinOptions } from '@/lib/review-engine/pinning/types'

/**
 * Pin button props
 */
interface PinButtonProps {
  /**
   * Content type (kana, kanji, vocabulary, etc.)
   */
  contentType: string
  
  /**
   * Unique content identifier
   */
  contentId: string
  
  /**
   * Optional content data for display
   */
  contentData?: {
    primary: string
    meaning?: string
  }
  
  /**
   * Button size variant
   */
  size?: 'sm' | 'md' | 'lg'
  
  /**
   * Whether to show label text
   */
  showLabel?: boolean
  
  /**
   * Button variant style
   */
  variant?: 'icon' | 'button' | 'toggle'
  
  /**
   * Pin options
   */
  pinOptions?: PinOptions
  
  /**
   * Callback when pin state changes
   */
  onPinChange?: (isPinned: boolean) => void
  
  /**
   * Custom className
   */
  className?: string
  
  /**
   * Whether button is disabled
   */
  disabled?: boolean
}

/**
 * PinButton component
 */
export const PinButton: React.FC<PinButtonProps> = ({
  contentType,
  contentId,
  contentData,
  size = 'md',
  showLabel = false,
  variant = 'icon',
  pinOptions,
  onPinChange,
  className = '',
  disabled = false
}) => {
  const {
    isPinned: checkIsPinned,
    pinItem,
    unpinItem,
    isLoading,
    error,
    clearError,
    pendingOperations
  } = usePinStore()
  
  const [localLoading, setLocalLoading] = useState(false)
  const [animating, setAnimating] = useState(false)
  const isPinned = checkIsPinned(contentId)
  const isPending = pendingOperations.has(contentId)
  
  /**
   * Handle pin/unpin toggle
   */
  const handleToggle = useCallback(async () => {
    if (disabled || localLoading || isPending) return
    
    setLocalLoading(true)
    setAnimating(true)
    
    try {
      if (isPinned) {
        await unpinItem(contentId)
        onPinChange?.(false)
      } else {
        await pinItem(contentId, contentType, pinOptions)
        onPinChange?.(true)
      }
    } catch (error) {
      console.error('Pin operation failed:', error)
      // Error is handled by the store
    } finally {
      setLocalLoading(false)
      setTimeout(() => setAnimating(false), 300)
    }
  }, [
    isPinned,
    contentId,
    contentType,
    pinOptions,
    disabled,
    localLoading,
    isPending,
    pinItem,
    unpinItem,
    onPinChange
  ])
  
  /**
   * Handle keyboard interaction
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      handleToggle()
    }
  }, [handleToggle])
  
  /**
   * Clear error when component unmounts
   */
  useEffect(() => {
    return () => {
      if (error) {
        clearError()
      }
    }
  }, [error, clearError])
  
  // Size classes
  const sizeClasses = {
    sm: {
      icon: 'w-8 h-8',
      button: 'px-3 py-1.5 text-sm',
      iconSize: 'w-4 h-4'
    },
    md: {
      icon: 'w-10 h-10',
      button: 'px-4 py-2',
      iconSize: 'w-5 h-5'
    },
    lg: {
      icon: 'w-12 h-12',
      button: 'px-6 py-3 text-lg',
      iconSize: 'w-6 h-6'
    }
  }
  
  const currentSize = sizeClasses[size]
  const isLoadingState = localLoading || isPending || isLoading
  
  // Base classes
  const baseClasses = `
    relative inline-flex items-center justify-center
    transition-all duration-200 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-offset-2
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    ${animating ? 'scale-110' : 'scale-100'}
  `
  
  // Variant-specific classes
  const variantClasses = {
    icon: `
      ${currentSize.icon}
      rounded-full
      ${isPinned 
        ? 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-500' 
        : 'bg-gray-200 hover:bg-gray-300 text-gray-600 focus:ring-gray-500 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300'
      }
    `,
    button: `
      ${currentSize.button}
      rounded-md font-medium
      ${isPinned
        ? 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-500'
        : 'bg-soft-white hover:bg-gray-50 text-gray-700 border border-gray-300 focus:ring-blue-500 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
      }
    `,
    toggle: `
      ${currentSize.button}
      rounded-full font-medium
      ${isPinned
        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 focus:ring-blue-500 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
      }
    `
  }
  
  // Combine classes
  const buttonClasses = `${baseClasses} ${variantClasses[variant]} ${className}`
  
  // Pin icon SVG
  const PinIcon = ({ filled }: { filled: boolean }) => (
    <svg
      className={`${currentSize.iconSize} ${isLoadingState ? 'animate-pulse' : ''}`}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {filled ? (
        <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      )}
    </svg>
  )
  
  // Loading spinner
  const LoadingSpinner = () => (
    <svg
      className={`${currentSize.iconSize} animate-spin`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
  
  return (
    <>
      <button
        type="button"
        className={buttonClasses}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled || isLoadingState}
        aria-label={isPinned ? 'Unpin item' : 'Pin item'}
        aria-pressed={isPinned}
        title={
          contentData
            ? `${isPinned ? 'Unpin' : 'Pin'} ${contentData.primary}${
                contentData.meaning ? ` (${contentData.meaning})` : ''
              }`
            : isPinned
            ? 'Unpin item'
            : 'Pin item for review'
        }
      >
        {isLoadingState ? (
          <LoadingSpinner />
        ) : (
          <>
            <PinIcon filled={isPinned} />
            {showLabel && (
              <span className={variant === 'icon' ? 'sr-only' : 'ml-2'}>
                {isPinned ? 'Pinned' : 'Pin'}
              </span>
            )}
          </>
        )}
        
        {/* Visual feedback for state change */}
        {animating && (
          <span
            className={`
              absolute inset-0 rounded-full
              ${isPinned ? 'bg-blue-400' : 'bg-gray-400'}
              opacity-0 animate-ping
            `}
          />
        )}
      </button>
      
      {/* Error tooltip */}
      {error && contentId === contentId && (
        <div className="absolute z-10 mt-2 p-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 text-sm rounded-md shadow-lg">
          {error}
        </div>
      )}
    </>
  )
}

/**
 * PinButton with count display
 */
export const PinButtonWithCount: React.FC<PinButtonProps & { count?: number }> = ({
  count,
  ...props
}) => {
  const pinnedCount = usePinStore((state) => state.getPinnedCount())
  
  return (
    <div className="relative inline-flex items-center">
      <PinButton {...props} />
      {(count ?? pinnedCount) > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
          {count ?? pinnedCount}
        </span>
      )}
    </div>
  )
}