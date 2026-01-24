'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { SessionState } from '../learn/LearnContent'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { Home, RefreshCw } from 'lucide-react'

interface SessionCompleteModalProps {
  sessionState: SessionState
  onGoToDashboard: () => Promise<void>
  onStartNewSession: () => Promise<void>
}

export default function SessionCompleteModal({ sessionState, onGoToDashboard, onStartNewSession }: SessionCompleteModalProps) {
  const [isNavigating, setIsNavigating] = useState(false)
  // Calculate session statistics
  const totalKanji = sessionState.kanji.length
  const completedKanji = Array.from(sessionState.progress.values()).filter(p => p.round3Rating).length
  const averageAccuracy = Array.from(sessionState.progress.values())
    .reduce((sum, p) => sum + (p.round2Accuracy || 0), 0) / totalKanji
  const reviewAgainCount = sessionState.reviewAgainPile.size

  const sessionDuration = Math.floor((Date.now() - sessionState.startTime.getTime()) / 1000 / 60)

  // Calculate mastery distribution
  const masteryDistribution = {
    perfect: 0,
    easy: 0,
    medium: 0,
    hard: 0,
    forgot: 0
  }

  Array.from(sessionState.progress.values()).forEach(progress => {
    const rating = progress.round3Rating || 0
    if (rating === 5) masteryDistribution.perfect++
    else if (rating === 4) masteryDistribution.easy++
    else if (rating === 3) masteryDistribution.medium++
    else if (rating === 2) masteryDistribution.hard++
    else if (rating === 1) masteryDistribution.forgot++
  })

  const getDoshiMood = () => {
    if (averageAccuracy >= 80) return 'excited' as const
    if (averageAccuracy >= 60) return 'happy' as const
    return 'thinking' as const
  }

  const getEncouragementMessage = () => {
    if (averageAccuracy >= 90) return 'Incredible performance! You\'re a kanji master! 🏆'
    if (averageAccuracy >= 75) return 'Excellent work! Keep up the great momentum! 🌟'
    if (averageAccuracy >= 60) return 'Good job! You\'re making solid progress! 💪'
    if (averageAccuracy >= 40) return 'Nice effort! Every session makes you stronger! 📈'
    return 'Keep practicing! You\'re building a strong foundation! 🌱'
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto scrollbar-hide"
      >
        {/* Celebration Header */}
        <div className="bg-gradient-to-r from-primary-400 to-primary-600 p-6 text-white text-center rounded-t-2xl">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            <DoshiMascot size="medium" mood={getDoshiMood()} />
          </motion.div>
          <h2 className="text-2xl font-bold mt-4 mb-2">Session Complete! 🎉</h2>
          <p className="text-white/90">{getEncouragementMessage()}</p>
        </div>

        {/* Statistics */}
        <div className="p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                {completedKanji}/{totalKanji}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Kanji Studied</div>
            </div>
            <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {Math.round(averageAccuracy)}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Accuracy</div>
            </div>
          </div>

          {/* Session Duration */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {sessionDuration} minutes
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Session Duration</div>
          </div>

          {/* Mastery Distribution */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Mastery Breakdown</h3>
            <div className="space-y-2">
              {masteryDistribution.perfect > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Perfect 🎉</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{masteryDistribution.perfect} kanji</span>
                </div>
              )}
              {masteryDistribution.easy > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Easy 😊</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{masteryDistribution.easy} kanji</span>
                </div>
              )}
              {masteryDistribution.medium > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Medium 🤔</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{masteryDistribution.medium} kanji</span>
                </div>
              )}
              {masteryDistribution.hard > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Hard 😰</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{masteryDistribution.hard} kanji</span>
                </div>
              )}
              {masteryDistribution.forgot > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Forgot 😓</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{masteryDistribution.forgot} kanji</span>
                </div>
              )}
            </div>
          </div>

          {/* Review Recommendation */}
          {reviewAgainCount > 0 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                💡 <strong>{reviewAgainCount} kanji</strong> need more practice. They'll appear more frequently in future sessions.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex p-1 bg-gray-100 dark:bg-dark-700 rounded-lg">
            <button
              onClick={async () => {
                setIsNavigating(true)
                await onGoToDashboard()
              }}
              disabled={isNavigating}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-dark-600 hover:shadow-sm disabled:opacity-50"
            >
              <Home className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={async () => {
                setIsNavigating(true)
                await onStartNewSession()
              }}
              disabled={isNavigating}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-medium transition-all bg-white dark:bg-dark-600 text-primary-600 dark:text-primary-400 shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isNavigating ? 'animate-spin' : ''}`} />
              <span>New Session</span>
            </button>
          </div>

          {/* Mobile bottom spacing */}
          <MobileNavSpacer />
        </div>
      </motion.div>
    </div>
  )
}
