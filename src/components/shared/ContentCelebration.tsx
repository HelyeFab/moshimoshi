'use client'

import { motion } from 'framer-motion'

interface ContentCelebrationProps {
  // Core (always required)
  contentTitle: string
  contentType: 'article' | 'book' | 'story' | 'comic' | 'flashcard'
  onClose: () => void

  // Optional - show only if provided
  xpEarned?: number
  readingTimeMs?: number
  difficulty?: string

  // Content-specific stats (optional)
  pageCount?: number
  panelCount?: number
  vocabularyCount?: number
  hasQuiz?: boolean
}

export default function ContentCelebration({
  contentTitle,
  contentType,
  onClose,
  xpEarned,
  readingTimeMs,
  difficulty,
  pageCount,
  panelCount,
  vocabularyCount,
  hasQuiz
}: ContentCelebrationProps) {
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${seconds}s`
  }

  const getDifficultyColor = () => {
    switch (difficulty?.toLowerCase()) {
      case 'easy':
      case 'beginner':
      case 'n5':
      case 'n4':
        return 'text-green-600 dark:text-green-400'
      case 'medium':
      case 'intermediate':
      case 'n3':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'hard':
      case 'advanced':
      case 'n2':
      case 'n1':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-blue-600 dark:text-blue-400'
    }
  }

  const getMotivationalMessage = () => {
    // Messages based on XP earned
    if (xpEarned && xpEarned >= 50) return "Outstanding dedication! 🌟"
    if (xpEarned && xpEarned >= 30) return "Great session! 📖✨"
    if (xpEarned && xpEarned >= 15) return "Keep up the good work! 💪"

    // For content without XP
    if (contentType === 'story') return "Great story! Keep reading! 📚"
    if (contentType === 'comic') return "Awesome! Keep exploring! 🎨"
    if (contentType === 'book') return "Every book brings you closer! 🚀"

    return "Every step brings you closer! 🚀"
  }

  const getHeaderText = () => {
    switch (contentType) {
      case 'article':
        return 'Article Complete!'
      case 'book':
        return 'Book Complete!'
      case 'story':
        return 'Story Complete!'
      case 'comic':
        return 'Comic Complete!'
      case 'flashcard':
        return 'Session Complete!'
      default:
        return 'Session Complete!'
    }
  }

  // Calculate grid columns based on available stats
  const statsToShow = [
    readingTimeMs && readingTimeMs > 0,
    difficulty,
    pageCount && pageCount > 0,
    panelCount && panelCount > 0,
    vocabularyCount && vocabularyCount > 0
  ].filter(Boolean).length

  // Better grid layout: single column for 1-2 stats, 2 columns for 3+
  const gridCols = statsToShow <= 2 ? 'grid-cols-1' : 'grid-cols-2'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800"
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
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-block mb-4"
          >
            <div className="text-6xl">
              🎉
            </div>
          </motion.div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
            {getHeaderText()}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {contentTitle}
          </p>
        </div>

        {/* XP Earned - Only show if > 0 */}
        {xpEarned && xpEarned > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="mb-6"
          >
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-6 text-center shadow-lg">
              <div className="text-sm font-medium text-white/90 mb-1">
                XP Earned
              </div>
              <div className="text-5xl font-bold text-white">
                +{xpEarned}
              </div>
            </div>
          </motion.div>
        )}

        {/* Statistics Grid - Adaptive */}
        {statsToShow > 0 && (
          <div className={`grid ${gridCols} gap-4 mb-8`}>
            {/* Time - Only show if tracked */}
            {readingTimeMs && readingTimeMs > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800"
              >
                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-2">Time</div>
                <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                  ⏱️ {formatDuration(readingTimeMs)}
                </div>
              </motion.div>
            )}

            {/* Difficulty - Only show if provided */}
            {difficulty && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-5 border border-purple-200 dark:border-purple-800"
              >
                <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-2">Difficulty</div>
                <div className={`text-3xl font-bold capitalize ${getDifficultyColor()}`}>
                  📊 {difficulty}
                </div>
              </motion.div>
            )}

            {/* Page Count - For stories */}
            {pageCount && pageCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-5 border border-green-200 dark:border-green-800"
              >
                <div className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide mb-2">Pages Read</div>
                <div className="text-3xl font-bold text-green-900 dark:text-green-100">
                  📄 {pageCount}
                </div>
              </motion.div>
            )}

            {/* Panel Count - For comics */}
            {panelCount && panelCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 rounded-xl p-5 border border-pink-200 dark:border-pink-800"
              >
                <div className="text-xs font-semibold text-pink-600 dark:text-pink-400 uppercase tracking-wide mb-2">Panels Read</div>
                <div className="text-3xl font-bold text-pink-900 dark:text-pink-100">
                  🎨 {panelCount}
                </div>
              </motion.div>
            )}

            {/* Vocabulary Count - For comics */}
            {vocabularyCount && vocabularyCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-xl p-5 border border-amber-200 dark:border-amber-800"
              >
                <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2">New Words</div>
                <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">
                  📚 {vocabularyCount}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Quiz Available Prompt - Show if no XP but has quiz */}
        {(!xpEarned || xpEarned === 0) && hasQuiz && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mb-8"
          >
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200 text-center">
                ✨ Quiz available! Complete it to earn XP!
              </p>
            </div>
          </motion.div>
        )}

        {/* Motivational Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mb-8 text-gray-600 dark:text-gray-400"
        >
          {getMotivationalMessage()}
        </motion.div>

        {/* Action Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium shadow-md hover:shadow-lg"
          >
            Continue
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
