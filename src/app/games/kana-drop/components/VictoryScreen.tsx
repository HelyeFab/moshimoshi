'use client';

import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/I18nContext';
import { GameStats } from '../types';

interface VictoryScreenProps {
  stats: GameStats;
  onPlayAgain: () => void;
  onClose: () => void;
}

export default function VictoryScreen({ stats, onPlayAgain, onClose }: VictoryScreenProps) {
  const { t } = useI18n();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50"
    >
      <div className="bg-white dark:bg-dark-850 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center">
          {/* Trophy icon */}
          <div className="text-6xl mb-4">🏆</div>

          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('games.victory')}
          </h2>

          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('games.congratulations')}
          </p>

          {/* Stats */}
          <div className="bg-gray-100 dark:bg-dark-900 rounded-lg p-4 mb-6 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('games.finalScore')}:</span>
              <span className="font-bold text-2xl text-primary-600 dark:text-primary-400">
                {stats.finalScore}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('games.timeTaken')}:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {Math.floor(stats.timeTaken / 60)}:{String(stats.timeTaken % 60).padStart(2, '0')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('games.accuracy')}:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {stats.accuracy}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('games.perfectHits')}:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {stats.correctClicks}/{stats.totalClicks}
              </span>
            </div>
          </div>

          {/* Star rating */}
          <div className="flex justify-center gap-1 mb-6">
            {[1, 2, 3].map((star) => (
              <span
                key={star}
                className={`text-3xl ${
                  star <= Math.ceil((stats.accuracy / 100) * 3)
                    ? 'text-yellow-400'
                    : 'text-gray-300 dark:text-gray-600'
                }`}
              >
                ⭐
              </span>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onPlayAgain}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors"
            >
              {t('games.playAgain')}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-semibold transition-colors"
            >
              {t('common.close')}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}