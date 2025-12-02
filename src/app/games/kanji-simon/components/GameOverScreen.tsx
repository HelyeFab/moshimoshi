'use client';

import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/I18nContext';

interface GameOverScreenProps {
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  onPlayAgain: () => void;
  onExit: () => void;
}

export default function GameOverScreen({
  score,
  totalQuestions,
  correctAnswers,
  onPlayAgain,
  onExit
}: GameOverScreenProps) {
  const { t, strings } = useI18n();
  const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md mx-auto p-8 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="text-6xl mb-6"
      >
        🎯
      </motion.div>

      <h2 className="text-3xl font-bold mb-8">
        {strings.games?.kanjiSimon?.gameComplete || 'Game Complete!'}
      </h2>

      {/* Score Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-lg p-4 border border-border"
        >
          <div className="text-2xl font-bold text-primary-500">{score}</div>
          <div className="text-sm text-muted-foreground">
            {strings.games?.kanjiSimon?.score || 'Score'}
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-card rounded-lg p-4 border border-border"
        >
          <div className="text-2xl font-bold text-japanese-matcha dark:text-japanese-matchaDark">
            {correctAnswers}/{totalQuestions}
          </div>
          <div className="text-sm text-muted-foreground">
            {strings.games?.kanjiSimon?.correct || 'Correct'}
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-card rounded-lg p-4 border border-border"
        >
          <div className="text-2xl font-bold text-japanese-mizu dark:text-japanese-mizuDark">{accuracy}%</div>
          <div className="text-sm text-muted-foreground">
            {strings.games?.kanjiSimon?.accuracy || 'Accuracy'}
          </div>
        </motion.div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-center">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onExit}
          className="px-6 py-3 border border-border rounded-lg hover:bg-muted transition-colors"
        >
          {(strings.common as any)?.exit || 'Exit'}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onPlayAgain}
          className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
        >
          {strings.games?.kanjiSimon?.playAgain || 'Play Again'}
        </motion.button>
      </div>
    </motion.div>
  );
}