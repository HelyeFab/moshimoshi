'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
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
  const [showMasteredList, setShowMasteredList] = useState(false)
  const [showReviewList, setShowReviewList] = useState(false)
  const [showLearningList, setShowLearningList] = useState(false)
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
        {t('kanjiMasteryTool.progress.title')}
      </h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {progress.totalStudied}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">{t('kanjiMasteryTool.progress.kanjiStudied')}</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {progress.totalMastered}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">{t('kanjiMasteryTool.progress.mastered')}</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {progress.averageAccuracy}%
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">{t('kanjiMasteryTool.progress.accuracy')}</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {progress.streakDays}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">{t('kanjiMasteryTool.progress.dayStreak')}</p>
        </div>
      </div>

      {/* Level Progress */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('kanjiMasteryTool.progress.progressByLevel')}</h3>
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

      {/* Mastered Kanji List */}
      {masteredKanji.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-dark-700">
          <button
            onClick={() => setShowMasteredList(!showMasteredList)}
            className="flex items-center justify-between w-full text-left"
          >
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="text-green-500">✓</span>
              {t('kanjiMasteryTool.progress.masteredKanji')} ({masteredKanji.length})
            </h3>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${showMasteredList ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showMasteredList && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3"
            >
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
              {masteredKanji.length > 30 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                  {t('kanjiMasteryTool.progress.hoverForDetails')}
                </p>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* In Review Kanji List */}
      {reviewKanji.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-700">
          <button
            onClick={() => setShowReviewList(!showReviewList)}
            className="flex items-center justify-between w-full text-left"
          >
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="text-blue-500">🔄</span>
              {t('kanjiMasteryTool.progress.inReview')} ({reviewKanji.length})
            </h3>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${showReviewList ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showReviewList && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3"
            >
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
            </motion.div>
          )}
        </div>
      )}

      {/* In Learning Kanji List */}
      {learningKanji.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-700">
          <button
            onClick={() => setShowLearningList(!showLearningList)}
            className="flex items-center justify-between w-full text-left"
          >
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="text-amber-500">📖</span>
              {t('kanjiMasteryTool.progress.inLearning')} ({learningKanji.length})
            </h3>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${showLearningList ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showLearningList && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3"
            >
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
            </motion.div>
          )}
        </div>
      )}

      {/* Last Study Date */}
      {progress.lastStudyDate && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-700">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {t('kanjiMasteryTool.progress.lastStudied')} {new Date(progress.lastStudyDate).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Mobile spacer */}
      <MobileNavSpacer />

      {/* Kanji Details Modal */}
      <KanjiDetailsModal
        kanji={modalKanji}
        isOpen={!!modalKanji}
        onClose={() => setModalKanji(null)}
      />
    </motion.div>
  )
}
