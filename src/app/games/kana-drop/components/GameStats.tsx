'use client';

import { useI18n } from '@/i18n/I18nContext';

interface GameStatsProps {
  score: number;
  correctClicks: number;
  wrongClicks: number;
  distractorClicks: number;
}

export default function GameStats({
  score,
  correctClicks,
  wrongClicks,
  distractorClicks
}: GameStatsProps) {
  const { t } = useI18n();

  const totalClicks = correctClicks + wrongClicks + distractorClicks;
  const accuracy = totalClicks > 0
    ? Math.round((correctClicks / totalClicks) * 100)
    : 0;

  return (
    <div className="absolute top-4 left-4 z-20">
      <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-gray-600 dark:text-gray-400">{t('games.score')}:</span>
            <span className="font-bold text-gray-900 dark:text-white">{score}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600 dark:text-gray-400">{t('games.accuracy')}:</span>
            <span className="font-bold text-gray-900 dark:text-white">{accuracy}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span className="font-semibold text-green-600 dark:text-green-400">{correctClicks}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-red-600 dark:text-red-400">✗</span>
            <span className="font-semibold text-red-600 dark:text-red-400">{wrongClicks}</span>
          </div>
        </div>
      </div>
    </div>
  );
}