'use client';

import React from 'react';
import { DoshiLoading } from './DoshiMascot';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export function LoadingSpinner({ size = 'medium', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12',
  };

  return (
    <div className={`inline-block ${className}`}>
      <div
        className={`${sizeClasses[size]} border-3 border-primary-200 dark:border-primary-800 border-t-primary-500 dark:border-t-primary-400 rounded-full animate-spin`}
      />
    </div>
  );
}

interface LoadingDotsProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export function LoadingDots({ size = 'medium', className = '' }: LoadingDotsProps) {
  const sizeClasses = {
    small: 'w-1 h-1',
    medium: 'w-2 h-2',
    large: 'w-3 h-3',
  };

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`${sizeClasses[size]} bg-primary-500 dark:bg-primary-400 rounded-full animate-bounce`}
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
  showAvatar?: boolean;
}

export function LoadingSkeleton({ 
  className = '', 
  lines = 3,
  showAvatar = false 
}: LoadingSkeletonProps) {
  // Use deterministic widths based on index to avoid hydration mismatch
  const getLineWidth = (index: number) => {
    const widths = ['75%', '100%', '85%', '95%', '80%'];
    return widths[index % widths.length];
  };

  return (
    <div className={`animate-pulse ${className}`}>
      {showAvatar && (
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          </div>
        </div>
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"
          style={{ width: getLineWidth(i) }}
        />
      ))}
    </div>
  );
}

interface LoadingPageProps {
  message?: string;
  showDoshi?: boolean;
}

export function LoadingPage({ 
  message = 'Loading...', 
  showDoshi = true 
}: LoadingPageProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {showDoshi ? (
        <DoshiLoading size="large" />
      ) : (
        <LoadingSpinner size="large" />
      )}
      <p className="mt-4 text-gray-600 dark:text-gray-400 text-center">{message}</p>
      <LoadingDots className="mt-2" />
    </div>
  );
}

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  showDoshi?: boolean;
  fullScreen?: boolean;
}

export function LoadingOverlay({ 
  isLoading, 
  message,
  showDoshi = false,
  fullScreen = false 
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className={`${
      fullScreen ? 'fixed' : 'absolute'
    } inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm`}>
      <div className="text-center">
        {showDoshi ? (
          <DoshiLoading size="medium" />
        ) : (
          <LoadingSpinner size="large" />
        )}
        {message && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{message}</p>
        )}
      </div>
    </div>
  );
}

interface LoadingButtonProps {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function LoadingButton({ 
  isLoading, 
  children, 
  loadingText = 'Loading...',
  className = '',
  onClick,
  disabled = false
}: LoadingButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`relative ${className} ${
        isLoading || disabled ? 'cursor-not-allowed opacity-60' : ''
      }`}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <LoadingSpinner size="small" />
          {loadingText}
        </span>
      ) : (
        children
      )}
    </button>
  );
}