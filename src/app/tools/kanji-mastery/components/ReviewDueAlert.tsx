'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

interface ReviewStats {
  dueCount: number
  overdueCount: number
  nextReviewTime: string | null
}

export default function ReviewDueAlert() {
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    loadReviewStats()
  }, [])

  const loadReviewStats = async () => {
    try {
      // Load review stats from localStorage/IndexedDB
      // In production, this would integrate with the review engine
      const stored = localStorage.getItem('kanjiReviewStats')
      if (stored) {
        setStats(JSON.parse(stored))
      } else {
        // Mock data for demonstration
        setStats({
          dueCount: 0,
          overdueCount: 0,
          nextReviewTime: null
        })
      }
    } catch (error) {
      console.error('Failed to load review stats:', error)
    }
  }

  if (!stats || dismissed || (stats.dueCount === 0 && stats.overdueCount === 0)) {
    return null
  }

  const totalDue = stats.dueCount + stats.overdueCount

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`relative rounded-lg p-4 border-2 ${
          stats.overdueCount > 0
            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
        }`}
      >
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          aria-label="Dismiss"
        >
          ✕
        </button>

        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <span className="text-3xl">
              {stats.overdueCount > 0 ? '⚠️' : '📚'}
            </span>
          </div>
          <div className="flex-1">
            <h3 className={`font-semibold ${
              stats.overdueCount > 0
                ? 'text-orange-800 dark:text-orange-200'
                : 'text-blue-800 dark:text-blue-200'
            }`}>
              {totalDue} Kanji Reviews Due
            </h3>
            <p className={`text-sm mt-1 ${
              stats.overdueCount > 0
                ? 'text-orange-700 dark:text-orange-300'
                : 'text-blue-700 dark:text-blue-300'
            }`}>
              {stats.overdueCount > 0 ? (
                <>
                  {stats.overdueCount} overdue • {stats.dueCount} due today
                </>
              ) : (
                <>
                  Review now to maintain your progress
                </>
              )}
            </p>
          </div>
          <div className="flex-shrink-0">
            <Link
              href="/review-hub?source=kanji-mastery"
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                stats.overdueCount > 0
                  ? 'bg-orange-600 hover:bg-orange-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              Review Now
            </Link>
          </div>
        </div>

        {stats.nextReviewTime && totalDue === 0 && (
          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Next review: {stats.nextReviewTime}
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}