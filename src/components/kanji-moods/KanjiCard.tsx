'use client';

import { useState } from 'react';
import { KanjiCardProps } from '@/types/moodboard';
import { useI18n } from '@/i18n/I18nContext';
import { useTTS } from '@/hooks/useTTS';

export default function KanjiCard({
  kanji,
  isLearned,
  onToggleLearned,
  showBack = false
}: KanjiCardProps) {
  const { t } = useI18n();
  const { play } = useTTS({ cacheFirst: true });
  const [isFlipped, setIsFlipped] = useState(showBack);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleLearned(kanji.char);
  };

  const handlePlayAudio = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) return;

    setIsPlaying(true);
    try {
      // Play the kanji character pronunciation
      await play(kanji.char, {
        voice: 'ja-JP',
        rate: 0.9
      });
    } catch (error) {
      console.error('Failed to play audio:', error);
    } finally {
      setIsPlaying(false);
    }
  };

  return (
    <div className="relative h-64 w-full perspective-1000">
      <div
        className={`absolute inset-0 w-full h-full transition-transform duration-500 transform-style-preserve-3d cursor-pointer ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
        onClick={handleFlip}
      >
        {/* Front of card */}
        <div className="absolute inset-0 w-full h-full backface-hidden rounded-xl bg-soft-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 shadow-lg">
          <div className="h-full flex flex-col p-6">
            {/* Top actions */}
            <div className="flex justify-between items-start mb-4">
              <button
                onClick={handleToggle}
                className={`p-2 rounded-full transition-colors ${
                  isLearned
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-dark-700 text-gray-400 dark:text-dark-400'
                }`}
                aria-label={isLearned ? t('common.learned') : t('common.notLearned')}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>

              <button
                onClick={handlePlayAudio}
                className="p-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                disabled={isPlaying}
                aria-label={t('common.playAudio')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isPlaying ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.414a2 2 0 102.828-2.828l0 0a2 2 0 10-2.828 2.828z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  )}
                </svg>
              </button>
            </div>

            {/* Kanji character */}
            <div className="flex-1 flex items-center justify-center">
              <div className="text-7xl font-bold text-foreground dark:text-dark-100 font-japanese">
                {kanji.char}
              </div>
            </div>

            {/* Basic info */}
            <div className="text-center space-y-2">
              <p className="text-lg font-medium text-foreground dark:text-dark-100">
                {kanji.meaning}
              </p>
              <div className="flex justify-center gap-4 text-sm text-muted-foreground dark:text-dark-400">
                {kanji.strokeCount && (
                  <span>{kanji.strokeCount} {t('kanji.strokes')}</span>
                )}
                <span>{t('kanji.difficulty')}: {kanji.difficulty}/5</span>
              </div>
            </div>
          </div>
        </div>

        {/* Back of card */}
        <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 border border-primary-200 dark:border-primary-700 shadow-lg">
          <div className="h-full flex flex-col p-6 overflow-y-auto">
            {/* Character at top */}
            <div className="text-center mb-4">
              <span className="text-4xl font-bold text-primary-700 dark:text-primary-300 font-japanese">
                {kanji.char}
              </span>
            </div>

            {/* Readings */}
            <div className="space-y-3 mb-4">
              {kanji.readings.on.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-1">
                    {t('kanji.onReading')}
                  </p>
                  <p className="text-base text-foreground dark:text-dark-100 font-japanese">
                    {kanji.readings.on.join('、')}
                  </p>
                </div>
              )}

              {kanji.readings.kun.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-1">
                    {t('kanji.kunReading')}
                  </p>
                  <p className="text-base text-foreground dark:text-dark-100 font-japanese">
                    {kanji.readings.kun.join('、')}
                  </p>
                </div>
              )}
            </div>

            {/* Examples */}
            {kanji.examples.length > 0 && (
              <div className="flex-1">
                <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-2">
                  {t('kanji.examples')}
                </p>
                <div className="space-y-2">
                  {kanji.examples.slice(0, 3).map((example, index) => (
                    <p key={index} className="text-sm text-foreground dark:text-dark-200 font-japanese">
                      {example}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {kanji.tags && kanji.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {kanji.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs rounded-full bg-primary-200 dark:bg-primary-800 text-primary-700 dark:text-primary-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}