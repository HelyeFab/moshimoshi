'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { kanjiMasteryDB, type KanjiProgressRecord, type KanjiSession } from '@/lib/kanji-mastery/kanjiMasteryDB'

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

const LEVEL_TOTALS: Record<string, number> = {
  N5: 80,
  N4: 170,
  N3: 370,
  N2: 380,
  N1: 1200,
}

const buildEmptyProgress = (): ProgressData => ({
  totalStudied: 0,
  totalMastered: 0,
  averageAccuracy: 0,
  streakDays: 0,
  lastStudyDate: null,
  levelProgress: Object.fromEntries(
    Object.entries(LEVEL_TOTALS).map(([level, total]) => [level, { studied: 0, total, mastered: 0 }])
  ),
})

const getDayKey = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

const computeStreak = (dates: string[]): { streakDays: number; lastStudyDate: string | null } => {
  if (dates.length === 0) {
    return { streakDays: 0, lastStudyDate: null }
  }

  const uniqueDays = Array.from(
    new Set(
      dates
        .map(dateStr => {
          const parsed = new Date(dateStr)
          return Number.isNaN(parsed.getTime()) ? null : getDayKey(parsed)
        })
        .filter((value): value is number => value !== null)
    )
  ).sort((a, b) => b - a)

  if (uniqueDays.length === 0) {
    return { streakDays: 0, lastStudyDate: null }
  }

  let streak = 1
  for (let i = 0; i < uniqueDays.length - 1; i += 1) {
    const current = uniqueDays[i]
    const next = uniqueDays[i + 1]
    const dayDiff = (current - next) / (24 * 60 * 60 * 1000)
    if (dayDiff === 1) {
      streak += 1
    } else {
      break
    }
  }

  return {
    streakDays: streak,
    lastStudyDate: new Date(uniqueDays[0]).toISOString()
  }
}

const computeProgressFromRecords = (
  records: KanjiProgressRecord[],
  sessions: KanjiSession[],
  averageAccuracyRaw: number | null
): ProgressData => {
  const progress = buildEmptyProgress()
  const sessionDates = sessions.map(session => session.endTime || session.startTime)
  const { streakDays, lastStudyDate } = computeStreak(sessionDates)

  let totalMastered = 0

  records.forEach(record => {
    const level = record.level
    if (level && progress.levelProgress[level]) {
      progress.levelProgress[level].studied += 1
    }

    if (record.srsData?.status === 'mastered') {
      totalMastered += 1
      if (level && progress.levelProgress[level]) {
        progress.levelProgress[level].mastered += 1
      }
    }
  })

  progress.totalStudied = records.length
  progress.totalMastered = totalMastered
  progress.averageAccuracy = Math.round(Math.max(0, averageAccuracyRaw || 0) * 100)
  progress.streakDays = streakDays
  progress.lastStudyDate = lastStudyDate

  return progress
}

export default function KanjiProgressSummary() {
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const { isPremium } = useSubscription()

  useEffect(() => {
    const loadProgress = async () => {
      try {
        if (!user?.uid) {
          setProgress(buildEmptyProgress())
          return
        }

        if (isPremium) {
          const response = await fetch('/api/kanji-mastery/session', {
            method: 'GET',
            credentials: 'same-origin',
          })

          if (response.ok) {
            const data = await response.json()
            if (data?.progressSummary) {
              setProgress(data.progressSummary)
              return
            }
          }
        }

        const [records, sessions, stats] = await Promise.all([
          kanjiMasteryDB.getProgressByUser(user.uid),
          kanjiMasteryDB.getSessionsByUser(user.uid),
          kanjiMasteryDB.getStatistics(user.uid)
        ])

        const computed = computeProgressFromRecords(
          records,
          sessions,
          stats?.averageAccuracy ?? 0
        )
        setProgress(computed)
      } catch (error) {
        console.error('Failed to load progress:', error)
        setProgress(buildEmptyProgress())
      } finally {
        setLoading(false)
      }
    }

    loadProgress()
  }, [user?.uid, isPremium])

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
