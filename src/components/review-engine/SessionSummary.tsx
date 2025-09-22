'use client'

import { SessionStatistics } from '@/lib/review-engine/core/session.types'
import { motion } from 'framer-motion'

interface SessionSummaryProps {
  statistics: SessionStatistics
  onClose: () => void
}

export default function SessionSummary({
  statistics,
  onClose
}: SessionSummaryProps) {
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${seconds}s`
  }
  
  const getGrade = () => {
    const { accuracy } = statistics
    if (accuracy >= 95) return { grade: 'S', color: 'text-purple-600' }
    if (accuracy >= 90) return { grade: 'A+', color: 'text-green-600' }
    if (accuracy >= 85) return { grade: 'A', color: 'text-green-600' }
    if (accuracy >= 80) return { grade: 'B+', color: 'text-blue-600' }
    if (accuracy >= 75) return { grade: 'B', color: 'text-blue-600' }
    if (accuracy >= 70) return { grade: 'C+', color: 'text-yellow-600' }
    if (accuracy >= 65) return { grade: 'C', color: 'text-yellow-600' }
    if (accuracy >= 60) return { grade: 'D', color: 'text-orange-600' }
    return { grade: 'F', color: 'text-red-600' }
  }
  
  const { grade, color } = getGrade()
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-soft-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="inline-block"
          >
            <div className={`text-8xl font-bold ${color} mb-4`}>
              {grade}
            </div>
          </motion.div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
            Session Complete!
          </h2>
        </div>
        
        {/* Statistics Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* Accuracy */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4"
          >
            <div className="text-sm text-gray-500 mb-1">Accuracy</div>
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
              {Math.round(statistics.accuracy)}%
            </div>
          </motion.div>
          
          {/* Items Completed */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4"
          >
            <div className="text-sm text-gray-500 mb-1">Completed</div>
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
              {statistics.completedItems}/{statistics.totalItems}
            </div>
          </motion.div>
          
          {/* Correct Answers */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4"
          >
            <div className="text-sm text-gray-500 mb-1">Correct</div>
            <div className="text-2xl font-bold text-green-600">
              {statistics.correctItems}
            </div>
          </motion.div>
          
          {/* Max Streak */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4"
          >
            <div className="text-sm text-gray-500 mb-1">Best Streak</div>
            <div className="text-2xl font-bold text-orange-600">
              {statistics.bestStreak} 🔥
            </div>
          </motion.div>
          
          {/* Duration */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4"
          >
            <div className="text-sm text-gray-500 mb-1">Duration</div>
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
              {formatDuration(statistics.totalTime)}
            </div>
          </motion.div>
          
          {/* Avg Response Time */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4"
          >
            <div className="text-sm text-gray-500 mb-1">Avg Time</div>
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
              {(statistics.averageResponseTime / 1000).toFixed(1)}s
            </div>
          </motion.div>
        </div>
        
        {/* Additional Stats */}
        {(statistics.skippedItems > 0 || statistics.totalHintsUsed > 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex justify-center gap-6 mb-8 text-sm text-gray-500"
          >
            {statistics.skippedItems > 0 && (
              <div>
                Skipped: {statistics.skippedItems}
              </div>
            )}
            {statistics.totalHintsUsed > 0 && (
              <div>
                Hints used: {statistics.totalHintsUsed}
              </div>
            )}
          </motion.div>
        )}
        
        
        {/* Motivational Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-center mb-8 text-gray-600 dark:text-gray-400"
        >
          {statistics.accuracy >= 90 && "Outstanding work! Keep it up! 🌟"}
          {statistics.accuracy >= 75 && statistics.accuracy < 90 && "Great job! You're making excellent progress! 💪"}
          {statistics.accuracy >= 60 && statistics.accuracy < 75 && "Good effort! Keep practicing! 📚"}
          {statistics.accuracy < 60 && "Don't give up! Every session makes you stronger! 🚀"}
        </motion.div>
        
        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="flex gap-4"
        >
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium"
          >
            Continue
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}