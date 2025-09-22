'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface ProgressData {
  totalStudied: number
  totalMastered: number
  averageAccuracy: number
  streakDays: number
  lastStudyDate: string | null
  levelProgress: {
    [key: string]: {
      studied: number
      total: number
      mastered: number
    }
  }
}

export default function KanjiProgressSummary() {
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProgress()
  }, [])

  const loadProgress = async () => {
    try {
      // Load progress from localStorage for now
      // In production, this would come from the review engine
      const stored = localStorage.getItem('kanjiMasteryProgress')
      if (stored) {
        setProgress(JSON.parse(stored))
      } else {
        // Initialize with default data
        setProgress({
          totalStudied: 0,
          totalMastered: 0,
          averageAccuracy: 0,
          streakDays: 0,
          lastStudyDate: null,
          levelProgress: {
            N5: { studied: 0, total: 80, mastered: 0 },
            N4: { studied: 0, total: 170, mastered: 0 },
            N3: { studied: 0, total: 370, mastered: 0 },
            N2: { studied: 0, total: 380, mastered: 0 },
            N1: { studied: 0, total: 1200, mastered: 0 }
          }
        })
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded w-1/2"></div>
                <div className="h-6 bg-gray-200 dark:bg-dark-700 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!progress) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-6"
    >
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
        <span>📊</span>
        Your Progress
      </h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {progress.totalStudied}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Kanji Studied</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {progress.totalMastered}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Mastered</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {progress.averageAccuracy}%
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Accuracy</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {progress.streakDays}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Day Streak</p>
        </div>
      </div>

      {/* Level Progress */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Progress by Level</h3>
        {Object.entries(progress.levelProgress).map(([level, data]) => {
          const percentage = data.total > 0 ? Math.round((data.studied / data.total) * 100) : 0
          const masteredPercentage = data.total > 0 ? Math.round((data.mastered / data.total) * 100) : 0

          return (
            <div key={level} className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-gray-900 dark:text-gray-100">{level}</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {data.studied}/{data.total} studied • {data.mastered} mastered
                </span>
              </div>
              <div className="relative h-3 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                {/* Studied progress */}
                <motion.div
                  className="absolute inset-y-0 left-0 bg-primary-300 dark:bg-primary-700"
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
                {/* Mastered progress */}
                <motion.div
                  className="absolute inset-y-0 left-0 bg-primary-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${masteredPercentage}%` }}
                  transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Last Study Date */}
      {progress.lastStudyDate && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-700">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Last studied: {new Date(progress.lastStudyDate).toLocaleDateString()}
          </p>
        </div>
      )}
    </motion.div>
  )
}