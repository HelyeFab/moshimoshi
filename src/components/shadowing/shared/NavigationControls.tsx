'use client';

import React from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';

interface NavigationControlsProps {
  isPlaying: boolean;
  isLoading: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPlay: () => void;
  onPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  variant?: 'news' | 'stories'; // Different styling for each context
  className?: string;

  // Style customization
  colors?: {
    primary?: string;
    background?: string;
    text?: string;
    disabled?: string;
  };
}

export default function NavigationControls({
  isPlaying,
  isLoading,
  canGoPrevious,
  canGoNext,
  onPlay,
  onPause,
  onPrevious,
  onNext,
  variant = 'news',
  className = '',
  colors = {}
}: NavigationControlsProps) {
  const { t } = useI18n();

  // Default colors that adapt to context
  const defaultColors = {
    primary: colors.primary || (variant === 'news'
      ? 'rgb(var(--palette-primary-500))'
      : '#3b82f6'),
    background: colors.background || (variant === 'news'
      ? 'var(--article-accent-bg)'
      : 'rgb(243 244 246 / 1)'),
    text: colors.text || (variant === 'news'
      ? 'var(--article-text)'
      : 'rgb(17 24 39 / 1)'),
    disabled: colors.disabled || (variant === 'news'
      ? 'var(--article-text-secondary)'
      : 'rgb(156 163 175 / 1)')
  };

  const NewsVariant = () => (
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className="w-12 h-12 rounded-full flex items-center justify-center font-medium transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
        style={{
          backgroundColor: defaultColors.background,
          color: canGoPrevious ? defaultColors.text : defaultColors.disabled
        }}
        title={t('common.previous')}
        aria-label={t('common.previous')}
      >
        ←
      </button>

      <button
        onClick={isPlaying ? onPause : onPlay}
        disabled={isLoading}
        className="w-16 h-16 rounded-full font-semibold transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-70 flex items-center justify-center gap-1 shadow-lg"
        style={{
          backgroundColor: defaultColors.primary,
          color: 'white'
        }}
        title={isLoading ? t('common.loading') : isPlaying ? t('common.pause') : t('common.play')}
        aria-label={isLoading ? t('common.loading') : isPlaying ? t('common.pause') : t('common.play')}
      >
        {isLoading ? (
          <span className="animate-pulse text-lg" aria-hidden="true">●</span>
        ) : isPlaying ? (
          <span className="text-lg" aria-hidden="true">⏸</span>
        ) : (
          <Play className="w-6 h-6" fill="currentColor" aria-hidden="true" />
        )}
      </button>

      <button
        onClick={onNext}
        disabled={!canGoNext}
        className="w-12 h-12 rounded-full flex items-center justify-center font-medium transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
        style={{
          backgroundColor: defaultColors.background,
          color: canGoNext ? defaultColors.text : defaultColors.disabled
        }}
        title={t('common.next')}
        aria-label={t('common.next')}
      >
        →
      </button>
    </div>
  );

  const StoriesVariant = () => (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className="p-3 rounded-full bg-soft-white dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={t('common.previous')}
        aria-label={t('common.previous')}
      >
        <SkipBack className="w-6 h-6" aria-hidden="true" />
      </button>

      <button
        onClick={isPlaying ? onPause : onPlay}
        disabled={isLoading}
        className="p-4 rounded-full bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={isLoading ? t('common.loading') : isPlaying ? t('common.pause') : t('common.play')}
        aria-label={isLoading ? t('common.loading') : isPlaying ? t('common.pause') : t('common.play')}
      >
        {isLoading ? (
          <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        ) : isPlaying ? (
          <Pause className="w-6 h-6" aria-hidden="true" />
        ) : (
          <Play className="w-6 h-6 ml-0.5" aria-hidden="true" />
        )}
      </button>

      <button
        onClick={onNext}
        disabled={!canGoNext}
        className="p-3 rounded-full bg-soft-white dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={t('common.next')}
        aria-label={t('common.next')}
      >
        <SkipForward className="w-6 h-6" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <div className={className} role="group" aria-label="Playback controls">
      {variant === 'news' ? <NewsVariant /> : <StoriesVariant />}

      {/* Screen reader status updates */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {isLoading && t('common.loading')}
        {isPlaying && !isLoading && t('common.playing')}
        {!isPlaying && !isLoading && t('common.paused')}
      </div>
    </div>
  );
}