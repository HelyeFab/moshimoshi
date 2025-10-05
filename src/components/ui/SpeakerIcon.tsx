'use client';

import React from 'react';
import { useTTS } from '@/hooks/useTTS';
import { TTSOptions } from '@/lib/tts/types';

interface SpeakerIconProps {
  text: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'outline' | 'filled' | 'ghost';
  disabled?: boolean;
  className?: string;
  options?: TTSOptions;
  onPlay?: () => void;
  onEnd?: () => void;
  showLoadingState?: boolean;
  showLoadingText?: boolean;  // Show "Loading..." text with spinner
}

export default function SpeakerIcon({
  text,
  size = 'md',
  variant = 'ghost',
  disabled = false,
  className = '',
  options,
  onPlay,
  onEnd,
  showLoadingState = true,
  showLoadingText = false,
}: SpeakerIconProps) {
  const { play, playing, loading, stop } = useTTS({
    onPlay,
    onEnd,
  });

  const handleClick = async () => {
    if (disabled) return;
    
    if (playing) {
      stop();
    } else {
      await play(text, options);
    }
  };

  const sizeClasses = {
    xs: 'w-6 h-6 p-1',
    sm: 'w-8 h-8 p-1.5',
    md: 'w-10 h-10 p-2',
    lg: 'w-12 h-12 p-2.5',
  };

  const iconSizes = {
    xs: 'w-4 h-4',
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7',
  };

  const variantClasses = {
    outline: 'border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800',
    filled: 'bg-primary-500 text-white hover:bg-primary-600',
    ghost: 'hover:bg-gray-100 dark:hover:bg-gray-800',
  };

  const isLoading = showLoadingState && loading;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center
        rounded-lg transition-all duration-200
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${playing ? 'animate-pulse' : ''}
        ${isLoading ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700' : ''}
        ${className}
      `}
      aria-label={isLoading ? 'Loading audio...' : playing ? 'Stop audio' : 'Play audio'}
      title={isLoading ? 'Loading...' : playing ? 'Stop' : 'Play'}
    >
      {isLoading ? (
        // Enhanced loading spinner with better visibility
        <div className="flex items-center gap-1 justify-center w-full h-full">
          <svg
            className={`${iconSizes[size]} animate-spin text-blue-600 dark:text-blue-400 flex-shrink-0`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
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
          {showLoadingText && size !== 'xs' && size !== 'sm' && (
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">
              Loading...
            </span>
          )}
        </div>
      ) : playing ? (
        // Stop icon
        <svg
          className={`${iconSizes[size]}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        // Speaker icon
        <svg
          className={`${iconSizes[size]}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11 5L6 9H2v6h4l5 4V5z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"
          />
        </svg>
      )}
    </button>
  );
}