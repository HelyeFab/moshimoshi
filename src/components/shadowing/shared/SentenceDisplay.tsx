'use client';

import React from 'react';
import { Bookmark } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { ShadowingSentence, ShadowingSettings } from '../types';

interface SentenceDisplayProps {
  sentence: ShadowingSentence | null;
  currentIndex: number;
  totalSentences: number;
  settings: ShadowingSettings;
  variant?: 'news' | 'stories';
  onBookmark?: (sentence: ShadowingSentence) => void;
  onSentenceClick?: (sentence: ShadowingSentence) => void;
  className?: string;

  // Style customization
  colors?: {
    primary?: string;
    background?: string;
    text?: string;
    secondary?: string;
  };

  // Progress display
  showProgress?: boolean;
  currentRepeat?: number;
  totalRepeats?: number;
}

export default function SentenceDisplay({
  sentence,
  currentIndex,
  totalSentences,
  settings,
  variant = 'news',
  onBookmark,
  onSentenceClick,
  className = '',
  colors = {},
  showProgress = true,
  currentRepeat,
  totalRepeats
}: SentenceDisplayProps) {
  const { t } = useI18n();

  const defaultColors = {
    primary: colors.primary || (variant === 'news'
      ? 'rgb(var(--palette-primary-600))'
      : '#3b82f6'),
    background: colors.background || (variant === 'news'
      ? 'var(--article-content-bg)'
      : 'rgb(248 250 252 / 0.5)'),
    text: colors.text || (variant === 'news'
      ? 'var(--article-text)'
      : 'rgb(17 24 39 / 1)'),
    secondary: colors.secondary || (variant === 'news'
      ? 'var(--article-text-secondary)'
      : 'rgb(107 114 128 / 1)')
  };

  // Render furigana text if available
  const renderText = () => {
    if (!sentence) {
      return (
        <p style={{ color: defaultColors.secondary }}>
          {t('shadowing.noSentenceAvailable')}
        </p>
      );
    }

    if (settings.showFurigana && sentence.furiganaText) {
      return (
        <div
          dangerouslySetInnerHTML={{ __html: sentence.furiganaText }}
          className="ruby-text"
          style={{ color: defaultColors.text }}
        />
      );
    }

    return (
      <p style={{ color: defaultColors.text }}>
        {sentence.text}
      </p>
    );
  };

  const NewsVariant = () => (
    <div className="space-y-6">
      {/* Progress Header */}
      {showProgress && (
        <div className="text-center">
          <span
            className="text-sm font-medium px-3 py-1 rounded-full"
            style={{
              backgroundColor: `${defaultColors.primary}1A`,
              color: defaultColors.primary
            }}
          >
            Sentence {currentIndex + 1} of {totalSentences}
            {totalRepeats && totalRepeats > 1 && currentRepeat !== undefined && (
              <span className="ml-2">
                (Repeat {currentRepeat + 1}/{totalRepeats})
              </span>
            )}
          </span>
        </div>
      )}

      {/* Main Sentence Display */}
      <div
        className="p-10 rounded-3xl shadow-lg relative cursor-pointer"
        style={{
          backgroundColor: defaultColors.background,
          border: '1px solid var(--article-border)'
        }}
        onClick={() => sentence && onSentenceClick?.(sentence)}
        role={onSentenceClick ? "button" : undefined}
        tabIndex={onSentenceClick ? 0 : undefined}
        aria-label={onSentenceClick ? "Click to interact with sentence" : undefined}
      >
        <div className="text-center" style={{ fontSize: '2rem' }}>
          {renderText()}
        </div>

        {/* Bookmark Button */}
        {onBookmark && sentence && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookmark(sentence);
            }}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            style={{ color: defaultColors.secondary }}
            title={t('shadowing.saveSentence')}
            aria-label={t('shadowing.saveSentence')}
          >
            <Bookmark className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );

  const StoriesVariant = () => (
    <div className="space-y-4">
      {/* Progress Text */}
      {showProgress && (
        <div className="text-sm text-muted-foreground">
          {t('shadowing.sentenceProgress', {
            current: currentIndex + 1,
            total: totalSentences
          })}
          {totalRepeats && totalRepeats > 1 && currentRepeat !== undefined && (
            <span className="ml-2">
              ({t('shadowing.repeatProgress', { current: currentRepeat + 1, total: totalRepeats })})
            </span>
          )}
        </div>
      )}

      {/* Sentence Container */}
      <div
        className="bg-soft-white/50 dark:bg-dark-800/50 rounded-lg p-6 min-h-[150px] flex items-center justify-center relative cursor-pointer"
        onClick={() => sentence && onSentenceClick?.(sentence)}
        role={onSentenceClick ? "button" : undefined}
        tabIndex={onSentenceClick ? 0 : undefined}
        aria-label={onSentenceClick ? "Click to interact with sentence" : undefined}
      >
        <div className="text-2xl leading-relaxed text-center japanese-text pr-12">
          {renderText()}
        </div>

        {/* Bookmark Button */}
        {onBookmark && sentence && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookmark(sentence);
            }}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-background/80 transition-colors text-muted-foreground hover:text-foreground"
            title={t('shadowing.saveSentence')}
            aria-label={t('shadowing.saveSentence')}
          >
            <Bookmark className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Translation if available */}
      {settings.showTranslation && sentence?.translation && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Translation:</p>
          <p>{sentence.translation}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className={className}>
      {variant === 'news' ? <NewsVariant /> : <StoriesVariant />}

      {/* Screen reader announcements for sentence changes */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {sentence && `Current sentence ${currentIndex + 1} of ${totalSentences}: ${sentence.text}`}
        {totalRepeats && totalRepeats > 1 && currentRepeat !== undefined &&
          ` Repeat ${currentRepeat + 1} of ${totalRepeats}`
        }
      </div>
    </div>
  );
}