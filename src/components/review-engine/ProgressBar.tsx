'use client'

import { motion } from 'framer-motion'

interface ProgressBarProps {
  current: number
  total: number
  correct: number
  streak: number
}

export default function ProgressBar({ current, total, correct, streak }: ProgressBarProps) {
  const progress = (current / total) * 100
  const accuracy = current > 0 ? (correct / current) * 100 : 0

  return (
    <div className="mt-2 sm:mt-4 space-y-1 sm:space-y-2">
      {/* Main progress bar */}
      <div className="relative">
        <div className="flex justify-between text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">
          <span>
            {current} / {total}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 sm:h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats - simplified on mobile */}
      <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
        {/* Accuracy */}
        <div className="flex items-center gap-1">
          <span className="text-gray-500 hidden sm:inline">Accuracy:</span>
          <span
            className={`font-semibold ${
              accuracy >= 80
                ? 'text-green-600'
                : accuracy >= 60
                  ? 'text-yellow-600'
                  : 'text-red-600'
            }`}
          >
            {Math.round(accuracy)}%
          </span>
        </div>

        {/* Streak */}
        {streak > 0 && (
          <div className="flex items-center gap-1">
            <span className="font-semibold text-orange-600">{streak} 🔥</span>
          </div>
        )}

        {/* Correct count */}
        <div className="flex items-center gap-1">
          <span className="text-gray-500 hidden sm:inline">Correct:</span>
          <span className="font-semibold text-green-600">✓ {correct}</span>
        </div>
      </div>
    </div>
  )
}
