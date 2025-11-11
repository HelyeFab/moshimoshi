'use client'

import { motion } from 'framer-motion'

interface ProgressHUDProps {
  currentQuestion: number
  totalQuestions: number
  score: number
  streak: number
  timeLeft: number
  isPaused: boolean
  onPause: () => void
}

export default function ProgressHUD({
  currentQuestion,
  totalQuestions,
  score,
  streak,
  timeLeft,
  isPaused,
  onPause
}: ProgressHUDProps) {
  const progressPercentage = (currentQuestion / totalQuestions) * 100

  // Time warning colors
  const timeColor = timeLeft <= 5 ? 'text-red-500' : timeLeft <= 10 ? 'text-yellow-500' : 'text-green-500'

  return (
    <div className="bg-white/90 dark:bg-dark-800/90 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Question Progress */}
        <div className="text-center">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Progress</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {currentQuestion} / {totalQuestions}
          </p>
          <div className="mt-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary-500"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Score */}
        <div className="text-center">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Score</p>
          <motion.p
            className="text-lg font-bold text-gray-900 dark:text-white"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.3 }}
            key={score}
          >
            {score}
          </motion.p>
          {streak > 1 && (
            <motion.div
              className="mt-1 text-xs text-orange-500 font-medium"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              🔥 ×{streak}
            </motion.div>
          )}
        </div>

        {/* Timer */}
        <div className="text-center">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Time</p>
          <motion.p
            className={`text-lg font-bold ${timeColor}`}
            animate={timeLeft <= 5 ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            {isPaused ? '⏸️' : `⏱️ ${timeLeft}s`}
          </motion.p>
        </div>

        {/* Pause Button */}
        <div className="text-center">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Control</p>
          <button
            onClick={onPause}
            className="px-4 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            {isPaused ? '▶️ Resume' : '⏸️ Pause'}
          </button>
        </div>
      </div>

      {/* Streak indicator */}
      {streak >= 3 && (
        <motion.div
          className="mt-3 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-full text-sm font-medium">
            <span>🔥</span>
            <span>{streak} answer streak!</span>
            <span>+{streak * 10} bonus points</span>
          </div>
        </motion.div>
      )}
    </div>
  )
}