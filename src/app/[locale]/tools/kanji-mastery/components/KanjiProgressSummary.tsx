'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Trophy, Target, Flame } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { kanjiMasteryDB, type KanjiProgressRecord, type KanjiSession } from '@/lib/kanji-mastery/kanjiMasteryDB'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal'
import { kanjiService } from '@/services/kanjiService'
import type { Kanji } from '@/types/kanji'

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

interface MasteredKanji {
  character: string
  level?: string
  lastReviewed: string
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
  const [masteredKanji, setMasteredKanji] = useState<MasteredKanji[]>([])
  const [reviewKanji, setReviewKanji] = useState<MasteredKanji[]>([])
  const [learningKanji, setLearningKanji] = useState<MasteredKanji[]>([])
  const [modalKanji, setModalKanji] = useState<Kanji | null>(null)
  const { user } = useAuth()
  const { isPremium } = useSubscription()
  const { t } = useI18n()

  const handleKanjiClick = useCallback(async (character: string) => {
    const kanjiDetails = await kanjiService.getKanjiDetails(character)
    if (kanjiDetails) {
      setModalKanji(kanjiDetails)
    }
  }, [])

  useEffect(() => {
    const loadProgress = async () => {
      try {
        if (!user?.uid) {
          setProgress(buildEmptyProgress())
          return
        }

        const sortByDate = (a: MasteredKanji, b: MasteredKanji) =>
          new Date(b.lastReviewed).getTime() - new Date(a.lastReviewed).getTime()

        // For premium users, fetch from Firebase API
        if (isPremium) {
          console.log('[KanjiProgressSummary] Premium user - fetching from Firebase API')
          try {
            const response = await fetch('/api/kanji-mastery/session')
            if (response.ok) {
              const data = await response.json()
              console.log('[KanjiProgressSummary] Firebase API response:', data)

              if (data.progressSummary) {
                setProgress({
                  totalStudied: data.progressSummary.totalStudied || 0,
                  totalMastered: data.progressSummary.totalMastered || 0,
                  averageAccuracy: data.progressSummary.averageAccuracy || 0,
                  streakDays: data.progressSummary.streakDays || 0,
                  lastStudyDate: data.progressSummary.lastStudyDate || null,
                  levelProgress: data.progressSummary.levelProgress || buildEmptyProgress().levelProgress
                })
              }

              // Use kanji progress from Firebase
              if (data.kanjiProgress && Array.isArray(data.kanjiProgress)) {
                const allKanji = data.kanjiProgress as Array<{
                  character: string
                  level?: string
                  lastReviewed: string
                  srsStatus?: string
                }>
                console.log('[KanjiProgressSummary] Kanji from Firebase:', allKanji.length, allKanji)

                const mastered = allKanji
                  .filter(k => k.srsStatus === 'mastered')
                  .map(({ character, level, lastReviewed }) => ({ character, level, lastReviewed }))
                  .sort(sortByDate)
                setMasteredKanji(mastered)

                const inReview = allKanji
                  .filter(k => k.srsStatus === 'review')
                  .map(({ character, level, lastReviewed }) => ({ character, level, lastReviewed }))
                  .sort(sortByDate)
                setReviewKanji(inReview)

                const inLearning = allKanji
                  .filter(k =>
                    !k.srsStatus ||
                    k.srsStatus === 'learning' ||
                    k.srsStatus === 'new'
                  )
                  .map(({ character, level, lastReviewed }) => ({ character, level, lastReviewed }))
                  .sort(sortByDate)
                setLearningKanji(inLearning)
              }

              setLoading(false)
              return
            }
          } catch (apiError) {
            console.error('[KanjiProgressSummary] Firebase API error, falling back to IndexedDB:', apiError)
          }
        }

        // Fallback to IndexedDB for free users or if API fails
        console.log('[KanjiProgressSummary] Fetching records from IndexedDB for user:', user.uid)
        const [records, sessions, stats] = await Promise.all([
          kanjiMasteryDB.getProgressByUser(user.uid),
          kanjiMasteryDB.getSessionsByUser(user.uid),
          kanjiMasteryDB.getStatistics(user.uid)
        ])

        console.log('[KanjiProgressSummary] IndexedDB - Records:', records?.length, 'Sessions:', sessions?.length)

        const computed = computeProgressFromRecords(
          records,
          sessions,
          stats?.averageAccuracy ?? 0
        )
        setProgress(computed)

        // Extract kanji from sessions (kanji data is stored inside sessions, not as separate records)
        const kanjiMap = new Map<string, {
          character: string
          level: string
          lastReviewed: string
          srsStatus?: string
        }>()

        sessions.forEach(session => {
          session.kanji?.forEach(k => {
            const existing = kanjiMap.get(k.character)
            const sessionDate = session.endTime || session.startTime
            if (!existing || new Date(sessionDate) > new Date(existing.lastReviewed)) {
              kanjiMap.set(k.character, {
                character: k.character,
                level: session.level || 'Unknown',
                lastReviewed: sessionDate,
                srsStatus: k.srsData?.status
              })
            }
          })
        })

        const allKanji = Array.from(kanjiMap.values())

        const mastered = allKanji
          .filter(k => k.srsStatus === 'mastered')
          .map(({ character, level, lastReviewed }) => ({ character, level, lastReviewed }))
          .sort(sortByDate)
        setMasteredKanji(mastered)

        const inReview = allKanji
          .filter(k => k.srsStatus === 'review')
          .map(({ character, level, lastReviewed }) => ({ character, level, lastReviewed }))
          .sort(sortByDate)
        setReviewKanji(inReview)

        const inLearning = allKanji
          .filter(k =>
            !k.srsStatus ||
            k.srsStatus === 'learning' ||
            k.srsStatus === 'new'
          )
          .map(({ character, level, lastReviewed }) => ({ character, level, lastReviewed }))
          .sort(sortByDate)
        setLearningKanji(inLearning)
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
      <div className="space-y-4">
        {/* Stat card skeletons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 shadow-sm p-4 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 dark:bg-dark-700 rounded-lg mb-3"></div>
              <div className="h-7 bg-gray-200 dark:bg-dark-700 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded w-2/3"></div>
            </div>
          ))}
        </div>
        {/* Level progress skeleton */}
        <div className="bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 shadow-sm p-6 animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="space-y-1">
                <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded w-1/4"></div>
                <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded-full w-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!progress) return null

  const statCards = [
    {
      icon: BookOpen,
      value: progress.totalStudied,
      label: t('kanjiMasteryTool.progress.kanjiStudied'),
      iconBg: 'bg-primary-100 dark:bg-primary-900/30',
      iconColor: 'text-primary-600 dark:text-primary-400',
      valueColor: 'text-primary-600 dark:text-primary-400',
    },
    {
      icon: Trophy,
      value: progress.totalMastered,
      label: t('kanjiMasteryTool.progress.mastered'),
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
      valueColor: 'text-green-600 dark:text-green-400',
    },
    {
      icon: Target,
      value: `${progress.averageAccuracy}%`,
      label: t('kanjiMasteryTool.progress.accuracy'),
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      valueColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      icon: Flame,
      value: progress.streakDays,
      label: t('kanjiMasteryTool.progress.dayStreak'),
      iconBg: 'bg-orange-100 dark:bg-orange-900/30',
      iconColor: 'text-orange-600 dark:text-orange-400',
      valueColor: 'text-orange-600 dark:text-orange-400',
    },
  ]

  return (
    <div className="space-y-4">
      {/* Row 1: Stat Widget Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
            className="bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 shadow-sm p-4"
          >
            <div className={`w-10 h-10 ${card.iconBg} rounded-lg flex items-center justify-center mb-3`}>
              <card.icon className={`w-5 h-5 ${card.iconColor}`} />
            </div>
            <p className={`text-2xl font-bold ${card.valueColor}`}>{card.value}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{card.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Row 2: Level Progress Widget */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 shadow-sm p-6"
      >
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">{t('kanjiMasteryTool.progress.progressByLevel')}</h3>
        <div className="space-y-3">
          {Object.entries(progress.levelProgress).map(([level, data]) => {
            const percentage = data.total > 0 ? Math.round((data.studied / data.total) * 100) : 0
            const masteredPercentage = data.total > 0 ? Math.round((data.mastered / data.total) * 100) : 0

            return (
              <div key={level} className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{level}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {data.studied}/{data.total} {t('kanjiMasteryTool.progress.studied')} • {data.mastered} {t('kanjiMasteryTool.progress.mastered').toLowerCase()}
                  </span>
                </div>
                <div className="relative h-3 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-primary-300 dark:bg-primary-700"
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
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
      </motion.div>

      {/* Row 3: Kanji Collection Widget Cards */}
      {(masteredKanji.length > 0 || reviewKanji.length > 0 || learningKanji.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Mastered */}
          {masteredKanji.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 shadow-sm border-t-2 border-t-green-500 overflow-hidden"
            >
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                  <span className="text-green-500">✓</span>
                  {t('kanjiMasteryTool.progress.masteredKanji')} ({masteredKanji.length})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {masteredKanji.map((item, idx) => (
                    <button
                      key={`${item.character}-${idx}`}
                      onClick={() => handleKanjiClick(item.character)}
                      className="w-9 h-9 flex items-center justify-center bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-lg font-bold text-gray-900 dark:text-gray-100 hover:bg-green-100 dark:hover:bg-green-900/30 hover:scale-110 transition-all cursor-pointer"
                      title={`${item.level || 'Unknown level'} • Last reviewed: ${new Date(item.lastReviewed).toLocaleDateString()}`}
                      style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
                    >
                      {item.character}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* In Review */}
          {reviewKanji.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 shadow-sm border-t-2 border-t-blue-500 overflow-hidden"
            >
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                  <span className="text-blue-500">🔄</span>
                  {t('kanjiMasteryTool.progress.inReview')} ({reviewKanji.length})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {reviewKanji.map((item, idx) => (
                    <button
                      key={`${item.character}-${idx}`}
                      onClick={() => handleKanjiClick(item.character)}
                      className="w-9 h-9 flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-lg font-bold text-gray-900 dark:text-gray-100 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:scale-110 transition-all cursor-pointer"
                      title={`${item.level || 'Unknown level'} • Last reviewed: ${new Date(item.lastReviewed).toLocaleDateString()}`}
                      style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
                    >
                      {item.character}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* In Learning */}
          {learningKanji.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 shadow-sm border-t-2 border-t-amber-500 overflow-hidden"
            >
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                  <span className="text-amber-500">📖</span>
                  {t('kanjiMasteryTool.progress.inLearning')} ({learningKanji.length})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {learningKanji.map((item, idx) => (
                    <button
                      key={`${item.character}-${idx}`}
                      onClick={() => handleKanjiClick(item.character)}
                      className="w-9 h-9 flex items-center justify-center bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-lg font-bold text-gray-900 dark:text-gray-100 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:scale-110 transition-all cursor-pointer"
                      title={`${item.level || 'Unknown level'} • Last reviewed: ${new Date(item.lastReviewed).toLocaleDateString()}`}
                      style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
                    >
                      {item.character}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Last Study Date */}
      {progress.lastStudyDate && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {t('kanjiMasteryTool.progress.lastStudied')} {new Date(progress.lastStudyDate).toLocaleDateString()}
        </p>
      )}

      {/* Mobile spacer */}
      <MobileNavSpacer />

      {/* Kanji Details Modal */}
      <KanjiDetailsModal
        kanji={modalKanji}
        isOpen={!!modalKanji}
        onClose={() => setModalKanji(null)}
      />
    </div>
  )
}
