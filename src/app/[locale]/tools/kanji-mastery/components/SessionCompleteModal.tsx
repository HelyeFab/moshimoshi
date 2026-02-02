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
  canStartNewSession?: boolean
}

export default function SessionCompleteModal({ sessionState, onGoToDashboard, onStartNewSession, canStartNewSession = true }: SessionCompleteModalProps) {
  const [isNavigating, setIsNavigating] = useState(false)
  // Calculate session statistics
  const totalKanji = sessionState.kanji.length
  const completedKanji = Array.from(sessionState.progress.values()).filter(p => p.round3Rating).length
  const averageAccuracy = Array.from(sessionState.progress.values())
    .reduce((sum, p) => sum + (p.round2Accuracy || 0), 0) / totalKanji
  const averageAccuracyPercent = Math.round(averageAccuracy * 100)
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
    if (averageAccuracy >= 0.8) return 'excited' as const
    if (averageAccuracy >= 0.6) return 'happy' as const
    return 'thinking' as const
  }

  const getEncouragementMessage = () => {
    if (averageAccuracy >= 0.9) return 'Incredible performance! You\'re a kanji master! 🏆'
    if (averageAccuracy >= 0.75) return 'Excellent work! Keep up the great momentum! 🌟'
    if (averageAccuracy >= 0.6) return 'Good job! You\'re making solid progress! 💪'
    if (averageAccuracy >= 0.4) return 'Nice effort! Every session makes you stronger! 📈'
    return 'Keep practicing! You\'re building a strong foundation! 🌱'
  }

  // Get mastery items that have values > 0
  const masteryItems = [
    { label: 'Perfect', emoji: '🎉', count: masteryDistribution.perfect },
    { label: 'Easy', emoji: '😊', count: masteryDistribution.easy },
    { label: 'Medium', emoji: '🤔', count: masteryDistribution.medium },
    { label: 'Hard', emoji: '😰', count: masteryDistribution.hard },
    { label: 'Forgot', emoji: '😓', count: masteryDistribution.forgot },
  ].filter(item => item.count > 0)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-[476px] w-full max-h-[90vh] overflow-y-auto scrollbar-hide"
      >
        {/* Celebration Header - more compact on desktop */}
        <div className="bg-gradient-to-r from-primary-400 to-primary-600 p-4 md:p-5 text-white text-center rounded-t-2xl">
          <div className="md:flex md:items-center md:justify-center md:gap-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="md:flex-shrink-0"
            >
              <DoshiMascot size="small" mood={getDoshiMood()} />
            </motion.div>
            <div className="mt-3 md:mt-0 md:text-left">
              <h2 className="text-xl md:text-2xl font-bold">Session Complete! 🎉</h2>
              <p className="text-white/90 text-sm md:text-base mt-1">{getEncouragementMessage()}</p>
            </div>
          </div>
        </div>

        {/* Statistics - responsive grid layout */}
        <div className="p-4 md:p-5 space-y-4">
          {/* Key Metrics - 3 columns on desktop */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-3 text-center">
              <div className="text-2xl md:text-3xl font-bold text-primary-600 dark:text-primary-400">
                {completedKanji}/{totalKanji}
              </div>
              <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Kanji Studied</div>
            </div>
            <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-3 text-center">
              <div className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-400">
                {averageAccuracyPercent}%
              </div>
              <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Accuracy</div>
            </div>
            <div className="col-span-2 md:col-span-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
              <div className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400">
                {sessionDuration}m
              </div>
              <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Duration</div>
            </div>
          </div>

          {/* Mastery Distribution - horizontal chips on desktop */}
          {masteryItems.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Mastery Breakdown</h3>
              <div className="flex flex-wrap gap-2">
                {masteryItems.map(item => (
                  <div
                    key={item.label}
                    className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-dark-700 rounded-full px-3 py-1.5"
                  >
                    <span className="text-sm">{item.emoji}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.count}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review Recommendation */}
          {reviewAgainCount > 0 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                💡 <strong>{reviewAgainCount} kanji</strong> need more practice. They'll appear more frequently in future sessions.
              </p>
            </div>
          )}

          {/* Daily limit message */}
          {!canStartNewSession && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                You've reached your daily session limit. Come back tomorrow or upgrade for unlimited sessions.
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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-dark-600 hover:shadow-sm disabled:opacity-50"
            >
              <Home className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={async () => {
                setIsNavigating(true)
                await onStartNewSession()
              }}
              disabled={isNavigating || !canStartNewSession}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all shadow-sm disabled:opacity-50 ${
                canStartNewSession
                  ? 'bg-white dark:bg-dark-600 text-primary-600 dark:text-primary-400'
                  : 'bg-gray-200 dark:bg-dark-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }`}
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
