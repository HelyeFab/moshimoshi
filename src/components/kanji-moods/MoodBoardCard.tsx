'use client';

import { MoodBoardCardProps } from '@/types/moodboard';
import { useI18n } from '@/i18n/I18nContext';

interface ProgressIndicatorProps {
  current: number;
  total: number;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

function ProgressIndicator({ current, total, size = 'md', showText = true }: ProgressIndicatorProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  const heights = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className="w-full">
      <div className={`bg-gray-200 dark:bg-dark-700 rounded-full ${heights[size]} overflow-hidden`}>
        <div
          className={`bg-gradient-to-r from-primary-500 to-primary-600 ${heights[size]} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showText && (
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-muted-foreground dark:text-dark-400">
            {current}/{total}
          </span>
          <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
            {percentage}%
          </span>
        </div>
      )}
    </div>
  );
}

export default function MoodBoardCard({ board, progress, onClick }: MoodBoardCardProps) {
  const { t } = useI18n();

  const handleClick = () => {
    onClick(board.id);
  };

  const learnedCount = progress?.learnedKanji.length || 0;
  const totalCount = board.kanji.length;
  const isCompleted = progress?.progressPercentage === 100;

  return (
    <div
      className="group cursor-pointer bg-soft-white dark:bg-dark-800 rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden border border-gray-100 dark:border-dark-700"
      onClick={handleClick}
    >
      {/* Card Background with Gradient */}
      <div
        className="relative h-48 overflow-hidden"
        style={{ background: board.background }}
      >
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/20 to-transparent" />

        {/* Completion Badge */}
        {isCompleted && (
          <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            {t('common.complete')}
          </div>
        )}

        {/* Content */}
        <div className="relative h-full flex flex-col justify-between p-6 text-white">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-4xl mb-2">{board.emoji}</div>
              <h3 className="text-xl font-bold text-white drop-shadow-sm">{board.title}</h3>
              <p className="text-sm text-white/90 mt-1">{board.jlpt} {t('common.level')}</p>
            </div>
          </div>

          {/* Kanji Preview */}
          <div className="flex justify-center">
            <div className="flex gap-2">
              {board.kanji.slice(0, 5).map((kanji, index) => (
                <div
                  key={`${kanji.char}-${index}`}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-200 ${
                    progress?.learnedKanji.includes(kanji.char)
                      ? 'bg-green-500/80 text-white shadow-sm'
                      : 'bg-soft-white/20 text-white/90 backdrop-blur-sm'
                  }`}
                >
                  {kanji.char}
                </div>
              ))}
              {board.kanji.length > 5 && (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-soft-white/20 text-white/90 backdrop-blur-sm">
                  +{board.kanji.length - 5}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card Info */}
      <div className="p-4 space-y-3">
        <div>
          <h4 className="font-semibold text-foreground dark:text-dark-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            {board.title}
          </h4>
          <p className="text-sm text-muted-foreground dark:text-dark-400 line-clamp-2 mt-1">
            {board.description}
          </p>
        </div>

        {/* Progress */}
        <ProgressIndicator
          current={learnedCount}
          total={totalCount}
          size="sm"
          showText={true}
        />
      </div>
    </div>
  );
}