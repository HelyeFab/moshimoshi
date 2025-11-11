'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

interface AudioButtonProps {
  onPlay: () => Promise<void> | void
  size?: 'sm' | 'md' | 'lg'
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'inline'
  className?: string
  disabled?: boolean
  loading?: boolean  // External loading state (e.g., from useTTS)
  playing?: boolean  // External playing state (e.g., from useTTS)
}

/**
 * Reusable audio button component that matches the design from the kana flashcards
 * Shows a speaker icon that animates when playing audio
 */
export default function AudioButton({
  onPlay,
  size = 'md',
  position = 'inline',
  className = '',
  disabled = false,
  loading: externalLoading,
  playing: externalPlaying
}: AudioButtonProps) {
  const [internalPlaying, setInternalPlaying] = useState(false)

  // Use external state if provided, otherwise use internal state
  const isLoading = externalLoading ?? false
  const isPlaying = externalPlaying ?? internalPlaying

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled || isLoading || isPlaying) return

    // Only use internal state if external state not provided
    if (externalPlaying === undefined) {
      setInternalPlaying(true)
    }

    try {
      await onPlay()
    } catch (error) {
      console.error('Audio playback failed:', error)
    } finally {
      // Keep the animation for a bit before resetting (only for internal state)
      if (externalPlaying === undefined) {
        setTimeout(() => setInternalPlaying(false), 500)
      }
    }
  }

  const sizeClasses = {
    sm: 'p-1.5 w-8 h-8',
    md: 'p-2 w-10 h-10',
    lg: 'p-2.5 w-12 h-12'
  }

  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7'
  }

  const positionClasses = {
    'top-left': 'absolute top-4 left-4',
    'top-right': 'absolute top-4 right-4',
    'bottom-left': 'absolute bottom-4 left-4',
    'bottom-right': 'absolute bottom-4 right-4',
    'inline': 'relative'
  }

  return (
    <motion.button
      onClick={handleClick}
      disabled={disabled || isLoading}
      whileTap={{ scale: 0.95 }}
      className={`
        ${positionClasses[position]}
        ${sizeClasses[size]}
        rounded-full transition-all duration-200
        ${isLoading
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 border-2 border-blue-300 dark:border-blue-700'
          : isPlaying
          ? 'bg-blue-500 text-white scale-110 shadow-lg'
          : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:text-gray-500 dark:hover:text-blue-400 dark:hover:bg-blue-900/20'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      aria-label={isLoading ? 'Loading audio...' : isPlaying ? 'Playing audio' : 'Play audio'}
      title={isLoading ? 'Loading...' : isPlaying ? 'Playing...' : 'Play audio'}
    >
      {isLoading ? (
        // Loading spinner
        <svg
          className={`${iconSizes[size]} animate-spin`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
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
      ) : (
        <svg
          className={`${iconSizes[size]} ${isPlaying ? 'animate-pulse' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isPlaying ? (
          <>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
            <circle
              cx="12"
              cy="12"
              r="10"
              className="animate-ping"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.3"
            />
          </>
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
          />
        )}
        </svg>
      )}
    </motion.button>
  )
}