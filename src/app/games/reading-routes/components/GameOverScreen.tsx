'use client'

import { motion } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'

interface GameOverScreenProps {
  score: number
  totalQuestions: number
  correctAnswers: number
  onPlayAgain: () => void
  onExit: () => void
}

export default function GameOverScreen({
  score,
  totalQuestions,
  correctAnswers,
  onPlayAgain,
  onExit
}: GameOverScreenProps) {
  const { strings } = useI18n()
  const accuracy = Math.round((correctAnswers / totalQuestions) * 100)

  // Determine performance level
  const getPerformanceLevel = () => {
    if (accuracy >= 90) return { emoji: '🏆', text: 'Excellent!', color: 'text-yellow-500' }
    if (accuracy >= 70) return { emoji: '⭐', text: 'Great job!', color: 'text-green-500' }
    if (accuracy >= 50) return { emoji: '👍', text: 'Good effort!', color: 'text-blue-500' }
    return { emoji: '💪', text: 'Keep practicing!', color: 'text-purple-500' }
  }

  const performance = getPerformanceLevel()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
        className="bg-white dark:bg-dark-800 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl"
      >
        {/* Performance Emoji */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.2, 1] }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center text-6xl mb-4"
        >
          {performance.emoji}
        </motion.div>

        {/* Title */}
        <h2 className="text-3xl font-bold text-center mb-2">
          {strings.games?.gameOver || 'Game Over!'}
        </h2>
        <p className={`text-xl text-center mb-6 ${performance.color}`}>
          {performance.text}
        </p>

        {/* Statistics */}
        <div className="bg-gray-100 dark:bg-dark-700 rounded-2xl p-6 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {strings.games?.score || 'Score'}
              </p>
              <p className="text-2xl font-bold text-primary-500">{score}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {strings.games?.accuracy || 'Accuracy'}
              </p>
              <p className="text-2xl font-bold text-green-500">{accuracy}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {strings.games?.correct || 'Correct'}
              </p>
              <p className="text-2xl font-bold text-blue-500">
                {correctAnswers}/{totalQuestions}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary-400 to-primary-600"
                initial={{ width: 0 }}
                animate={{ width: `${accuracy}%` }}
                transition={{ delay: 0.5, duration: 1 }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onExit}
            className="flex-1 py-3 px-6 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
          >
            {(strings.common as any)?.exit || 'Exit'}
          </button>
          <button
            onClick={onPlayAgain}
            className="flex-1 py-3 px-6 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium transition-colors"
          >
            {strings.games?.playAgain || 'Play Again'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}