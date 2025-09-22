'use client'

import { motion } from 'framer-motion'

interface ProgressBarProps {
  current: number
  total: number
  correct: number
  streak: number
}

export default function ProgressBar({
  current,
  total,
  correct,
  streak
}: ProgressBarProps) {
  const progress = (current / total) * 100
  const accuracy = current > 0 ? (correct / current) * 100 : 0
  
  return (
    <div className="mt-4 space-y-2">
      {/* Main progress bar */}
      <div className="relative">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
          <span>{current} / {total}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-primary-dark rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
      
      {/* Stats */}
      <div className="flex items-center gap-4 text-sm">
        {/* Accuracy */}
        <div className="flex items-center gap-1">
          <span className="text-gray-500">Accuracy:</span>
          <span className={`font-semibold ${
            accuracy >= 80 ? 'text-green-600' : 
            accuracy >= 60 ? 'text-yellow-600' : 
            'text-red-600'
          }`}>
            {Math.round(accuracy)}%
          </span>
        </div>
        
        {/* Streak */}
        {streak > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Streak:</span>
            <span className="font-semibold text-orange-600">
              {streak} 🔥
            </span>
          </div>
        )}
        
        {/* Correct count */}
        <div className="flex items-center gap-1">
          <span className="text-gray-500">Correct:</span>
          <span className="font-semibold text-green-600">
            {correct}
          </span>
        </div>
      </div>
    </div>
  )
}