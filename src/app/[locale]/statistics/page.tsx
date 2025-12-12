'use client'

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Flame,
  Zap,
  Trophy,
  Target,
  Play,
  Clock,
  BarChart3,
  Percent,
  Star,
  Calendar,
  Users,
  ChevronRight,
  BookOpen,
  FileText,
  Library
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useGamification } from '@/hooks/useGamification'
import { useLearningProgress } from '@/hooks/useLearningProgress'
import { useYouTubeStats } from '@/hooks/useYouTubeStats'
import { useReadingStats, formatReadingTime, formatReadingTimeSec } from '@/hooks/useReadingStats'
import { useSubscription } from '@/hooks/useSubscription'
import { useLeaderboardPreview } from '@/hooks/useLeaderboard'
import { DrillProgressManager } from '@/lib/review-engine/progress/DrillProgressManager'
import { validateStreakDisplay, getStreakDeadline } from '@/lib/gamification/utils/streakValidation'
import { useI18n, useLocalePath } from '@/i18n/I18nContext'
import { LoadingOverlay } from '@/components/ui/Loading'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import StatCard from '@/components/ui/StatCard'
import logger from '@/lib/logger'
import achievementsConfig from '@/config/gamification/achievements.json'

// Condition types that are NOT yet implemented (return 0 in gamificationListener.ts)
const UNIMPLEMENTED_CONDITIONS = ['kanji_learned', 'speed_reviews']

// Calculate implemented achievements count dynamically
const IMPLEMENTED_ACHIEVEMENTS = achievementsConfig.achievements.filter(
  a => !UNIMPLEMENTED_CONDITIONS.includes(a.condition.type)
).length

// Statistics snapshot storage key
const STATS_SNAPSHOT_KEY = 'moshimoshi_stats_snapshot'
const SNAPSHOT_INTERVAL = 7 * 24 * 60 * 60 * 1000 // 7 days

interface TrendData {
  direction: 'up' | 'down' | 'stable'
  value: string
}

interface StatsSnapshot {
  timestamp: number
  totalXP: number
  drillCount: number
  drillAccuracy: number
  achievementCount: number
  watchTimeMinutes: number
}

function StatisticsContent() {
  const router = useRouter()
  const { user, loading: authLoading, isGuest } = useAuth()
  const { strings } = useI18n()
  const { getLocalePath } = useLocalePath()
  const { isPremium } = useSubscription()

  // Gamification data
  const {
    totalXP,
    currentLevel,
    currentStreak,
    bestStreak,
    unlockedAchievements,
    lastActivityDate,
    loading: gamificationLoading,
    isEnabled: gamificationEnabled,
  } = useGamification()

  // Learning progress
  const {
    overall: learningProgress,
    loading: learningProgressLoading,
  } = useLearningProgress()

  // YouTube stats
  const { stats: youtubeStats, loading: youtubeStatsLoading } = useYouTubeStats()

  // Reading stats (articles, stories, books)
  const { stats: readingStats, loading: readingStatsLoading } = useReadingStats()

  // Leaderboard preview
  const {
    topEntries: leaderboardEntries,
    userRank,
    totalPlayers: leaderboardTotalPlayers,
    loading: leaderboardLoading,
    isEnabled: leaderboardEnabled
  } = useLeaderboardPreview(5)

  // Drill stats
  const [drillStats, setDrillStats] = useState<any>(null)
  const [loadingDrillStats, setLoadingDrillStats] = useState(false)

  // Modal state
  const [selectedStat, setSelectedStat] = useState<string | null>(null)
  const [isStatModalOpen, setIsStatModalOpen] = useState(false)

  // Trends state
  const [trends, setTrends] = useState<Record<string, TrendData>>({})

  // Validate streak
  const streakValidation = useMemo(() => {
    return validateStreakDisplay(currentStreak, lastActivityDate, 24)
  }, [currentStreak, lastActivityDate])

  const streakDeadline = useMemo(() => {
    return getStreakDeadline(lastActivityDate, 24)
  }, [lastActivityDate])

  const displayStreak = currentStreak

  // Calculate drill stats
  const drillAccuracy = drillStats ? Math.round(drillStats.accuracy || 0) : 0
  const drillCount = drillStats?.totalDrills || 0
  const drillMastery = learningProgress?.progressPercentage
    ? Math.round(learningProgress.progressPercentage)
    : 0

  // Format watch time
  const watchTimeMinutes = Math.round((youtubeStats?.watchTime || 0) / 60)
  const watchTimeHours = Math.floor(watchTimeMinutes / 60)
  const watchTimeRemainingMinutes = watchTimeMinutes % 60
  const watchTimeValue =
    watchTimeMinutes >= 60
      ? watchTimeRemainingMinutes > 0
        ? `${watchTimeHours}:${watchTimeRemainingMinutes.toString().padStart(2, '0')}`
        : `${watchTimeHours}`
      : watchTimeMinutes.toString()
  const watchTimeUnit = watchTimeMinutes >= 60 ? 'hrs' : 'min'

  // Achievement completion percentage
  const achievementCompletion =
    gamificationEnabled && unlockedAchievements.length > 0
      ? Math.round((unlockedAchievements.length / IMPLEMENTED_ACHIEVEMENTS) * 100)
      : 0

  // Calculate trends from localStorage snapshot
  const calculateTrends = useCallback(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(STATS_SNAPSHOT_KEY)
      const now = Date.now()

      const currentSnapshot: StatsSnapshot = {
        timestamp: now,
        totalXP,
        drillCount,
        drillAccuracy,
        achievementCount: unlockedAchievements.length,
        watchTimeMinutes
      }

      let calculatedTrends: Record<string, TrendData> = {
        xp: { direction: 'stable', value: '' },
        drills: { direction: 'stable', value: '' },
        accuracy: { direction: 'stable', value: '' },
        achievements: { direction: 'stable', value: '' },
        watchTime: { direction: 'stable', value: '' }
      }

      if (stored) {
        const previousSnapshot: StatsSnapshot = JSON.parse(stored)
        const timeDiff = now - previousSnapshot.timestamp

        // Only calculate trends if snapshot is at least 1 day old
        if (timeDiff >= 24 * 60 * 60 * 1000) {
          const xpChange = currentSnapshot.totalXP - previousSnapshot.totalXP
          const drillChange = currentSnapshot.drillCount - previousSnapshot.drillCount
          const accuracyChange = currentSnapshot.drillAccuracy - previousSnapshot.drillAccuracy
          const achievementChange = currentSnapshot.achievementCount - previousSnapshot.achievementCount
          const watchTimeChange = currentSnapshot.watchTimeMinutes - previousSnapshot.watchTimeMinutes

          if (xpChange !== 0) {
            calculatedTrends.xp = {
              direction: xpChange > 0 ? 'up' : 'down',
              value: xpChange > 0 ? `+${xpChange.toLocaleString()}` : `${xpChange.toLocaleString()}`
            }
          }

          if (drillChange !== 0) {
            calculatedTrends.drills = {
              direction: drillChange > 0 ? 'up' : 'down',
              value: drillChange > 0 ? `+${drillChange}` : `${drillChange}`
            }
          }

          if (accuracyChange !== 0) {
            calculatedTrends.accuracy = {
              direction: accuracyChange > 0 ? 'up' : 'down',
              value: accuracyChange > 0 ? `+${accuracyChange}%` : `${accuracyChange}%`
            }
          }

          if (achievementChange !== 0) {
            calculatedTrends.achievements = {
              direction: achievementChange > 0 ? 'up' : 'down',
              value: achievementChange > 0 ? `+${achievementChange}` : `${achievementChange}`
            }
          }

          if (watchTimeChange !== 0) {
            calculatedTrends.watchTime = {
              direction: watchTimeChange > 0 ? 'up' : 'down',
              value: watchTimeChange > 0 ? `+${watchTimeChange}m` : `${watchTimeChange}m`
            }
          }
        }

        // Update snapshot if interval has passed
        if (timeDiff >= SNAPSHOT_INTERVAL) {
          localStorage.setItem(STATS_SNAPSHOT_KEY, JSON.stringify(currentSnapshot))
        }
      } else {
        // First time - create initial snapshot
        localStorage.setItem(STATS_SNAPSHOT_KEY, JSON.stringify(currentSnapshot))
      }

      setTrends(calculatedTrends)
    } catch (error) {
      logger.error('[Statistics] Error calculating trends:', error)
    }
  }, [totalXP, drillCount, drillAccuracy, unlockedAchievements.length, watchTimeMinutes])

  // Load drill stats
  useEffect(() => {
    const loadDrillStats = async () => {
      if (!user?.uid) return

      setLoadingDrillStats(true)
      try {
        const drillManager = DrillProgressManager.getInstance()
        const stats = await drillManager.getDrillStats(user.uid, isPremium || false)
        setDrillStats(stats)
      } catch (error) {
        logger.error('[Statistics] Failed to load drill stats:', error)
      } finally {
        setLoadingDrillStats(false)
      }
    }

    loadDrillStats()
  }, [user?.uid, isPremium])

  // Calculate trends when data is loaded
  useEffect(() => {
    if (!gamificationLoading && !loadingDrillStats && !youtubeStatsLoading) {
      calculateTrends()
    }
  }, [gamificationLoading, loadingDrillStats, youtubeStatsLoading, calculateTrends])

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user && !isGuest) {
      router.push(getLocalePath('/auth/signin'))
    }
  }, [authLoading, user, isGuest, router, getLocalePath])

  // Calculate hours until streak deadline
  const calculateTimeUntilDeadline = (): { hours: number; isActiveToday: boolean } | null => {
    if (streakValidation.isStale || displayStreak === 0) return null
    if (!streakDeadline) return null

    const now = new Date()
    const lastActivity = lastActivityDate ? new Date(lastActivityDate) : null

    const todayStart = new Date(now)
    todayStart.setUTCHours(0, 0, 0, 0)

    if (lastActivity) {
      const lastActivityDayStart = new Date(lastActivity)
      lastActivityDayStart.setUTCHours(0, 0, 0, 0)

      if (todayStart.getTime() === lastActivityDayStart.getTime()) {
        return { hours: 0, isActiveToday: true }
      }
    }

    const hoursUntilDeadline = (streakDeadline.getTime() - now.getTime()) / (1000 * 60 * 60)
    if (hoursUntilDeadline <= 0) return null

    return {
      hours: Math.max(0, Math.ceil(hoursUntilDeadline)),
      isActiveToday: false,
    }
  }

  const deadlineInfo = calculateTimeUntilDeadline()

  // Stat breakdown details for modal
  const getStatBreakdown = (statId: string) => {
    switch (statId) {
      case 'streak':
        return {
          title: 'Daily Streak',
          description: "Your streak shows how many consecutive days you've practiced Japanese",
          formula: 'Consecutive days with ≥25 XP earned',
          breakdown: [
            { label: 'Current streak', value: `${displayStreak} days` },
            { label: 'Longest streak', value: `${bestStreak} days` },
            {
              label: 'Last activity',
              value: lastActivityDate ? new Date(lastActivityDate).toLocaleDateString() : 'Never',
            },
            { label: 'Min XP per day', value: '25 XP' },
          ],
        }
      case 'xp':
        return {
          title: 'XP Earned',
          description: 'Experience Points measure your learning activity and achievement',
          formula: 'Base XP + Bonuses',
          breakdown: [
            { label: 'Total XP', value: `${totalXP} XP` },
            { label: 'Current level', value: `Level ${currentLevel}` },
            { label: 'XP to next level', value: `${currentLevel * 1000 - totalXP} XP` },
            { label: 'Daily cap', value: '500 XP' },
          ],
        }
      case 'progress':
        return {
          title: 'Achievement Progress',
          description: 'Track your journey by unlocking achievements',
          formula: '(Unlocked / Total) × 100',
          breakdown: [
            { label: 'Unlocked achievements', value: `${unlockedAchievements.length}` },
            { label: 'Total available', value: `${IMPLEMENTED_ACHIEVEMENTS}` },
            { label: 'Completion rate', value: `${achievementCompletion}%` },
          ],
        }
      case 'achievements':
        return {
          title: 'Achievements Unlocked',
          description: 'Achievements are rewards for reaching milestones',
          formula: 'Count of unlocked achievements',
          breakdown: [
            { label: 'Unlocked', value: `${unlockedAchievements.length}` },
            { label: 'Available', value: `${IMPLEMENTED_ACHIEVEMENTS} total` },
            {
              label: 'How to earn more',
              value: 'Complete drills, maintain streaks, practice regularly',
            },
          ],
        }
      case 'drills':
        return {
          title: 'Drills Completed',
          description: 'Every drill session helps build your conjugation skills',
          formula: 'Total finished drill sessions',
          breakdown: [
            { label: 'Total drills', value: `${drillCount}` },
            { label: 'Perfect drills', value: `${Math.round((drillCount * drillAccuracy) / 100)}` },
            { label: 'Types', value: 'Conjugation practice' },
          ],
        }
      case 'accuracy':
        return {
          title: 'Drill Accuracy',
          description: 'Your accuracy reflects how well you understand conjugations',
          formula: '(Correct / Total) × 100',
          breakdown: [
            { label: 'Current accuracy', value: `${drillAccuracy}%` },
            { label: 'Total drills', value: `${drillCount}` },
            { label: 'Goal', value: '80% or higher' },
          ],
        }
      case 'mastery':
        return {
          title: 'Drill Mastery Score',
          description: 'Comprehensive quality score (0-100)',
          formula: '4-factor weighted calculation',
          breakdown: [
            { label: 'Volume (30 pts)', value: `${Math.min(30, drillCount * 0.3).toFixed(1)} pts` },
            { label: 'Accuracy (40 pts)', value: `${((drillAccuracy / 100) * 40).toFixed(1)} pts` },
            { label: 'Total Score', value: `${drillMastery}/100` },
          ],
        }
      case 'videos':
        return {
          title: 'Videos Practiced',
          description: 'Total unique videos accessed for shadowing',
          formula: 'Count of unique videos loaded',
          breakdown: [
            { label: 'Total videos accessed', value: `${youtubeStats?.videosPracticed || 0}` },
            { label: 'Quota limit', value: `${youtubeStats?.quotaLimit || 0} per day` },
          ],
        }
      case 'remaining':
        return {
          title: 'Videos Remaining',
          description: 'New videos available today',
          formula: 'Daily limit − Videos loaded today',
          breakdown: [
            { label: 'Remaining today', value: `${youtubeStats?.videosRemaining || 0}` },
            { label: 'Daily limit', value: `${youtubeStats?.quotaLimit || 0}` },
            { label: 'Used today', value: `${youtubeStats?.quotaUsed || 0}` },
            { label: 'Resets at', value: 'Midnight UTC' },
          ],
        }
      case 'watchtime':
        return {
          title: 'Watch Time',
          description: 'Total shadowing practice time',
          formula: 'Sum of all practice durations',
          breakdown: [
            { label: 'Total watch time', value: `${watchTimeValue} ${watchTimeUnit}` },
            { label: 'In minutes', value: `${watchTimeMinutes} min` },
          ],
        }
      case 'articles':
        return {
          title: 'Articles Read',
          description: 'NHK Easy News articles you have completed reading',
          formula: 'Count of articles marked as complete',
          breakdown: [
            { label: 'Articles completed', value: `${readingStats.articles.count}` },
            { label: 'Reading time', value: formatReadingTime(readingStats.articles.readingTimeMs) },
            { label: 'Source', value: 'NHK Easy News' },
          ],
        }
      case 'stories':
        return {
          title: 'Stories Completed',
          description: 'Japanese stories you have finished reading',
          formula: 'Count of stories marked as complete',
          breakdown: [
            { label: 'Stories completed', value: `${readingStats.stories.count}` },
            { label: 'Reading time', value: formatReadingTimeSec(readingStats.stories.readingTimeSec) },
            { label: 'Includes', value: 'All JLPT levels' },
          ],
        }
      case 'books':
        return {
          title: 'Books Completed',
          description: 'Library books you have finished reading',
          formula: 'Count of books marked as complete',
          breakdown: [
            { label: 'Books completed', value: `${readingStats.books.count}` },
            { label: 'Reading time', value: formatReadingTimeSec(readingStats.books.readingTimeSec) },
            { label: 'Source', value: 'Moshimoshi Library' },
          ],
        }
      default:
        return null
    }
  }

  // Loading state
  if (authLoading) {
    return (
      <LoadingOverlay
        isLoading={true}
        message="Loading statistics..."
        showDoshi={true}
        fullScreen={true}
      />
    )
  }

  if (!user && !isGuest) {
    return (
      <LoadingOverlay
        isLoading={true}
        message="Redirecting..."
        showDoshi={false}
        fullScreen={true}
      />
    )
  }

  const isLoading =
    gamificationLoading || learningProgressLoading || youtubeStatsLoading || readingStatsLoading || loadingDrillStats

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
      <Navbar user={user} showUserMenu={true} />

      <PageHeader
        title={strings.statistics?.title || 'Your Statistics'}
        description={strings.statistics?.subtitle || 'Track your Japanese learning journey'}
        showDoshi={false}
        backHref="/dashboard"
      />

      <main className="container mx-auto px-4 py-8">
        {/* Streak Banner */}
        {displayStreak > 0 && !streakValidation.isStale && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Flame className="w-8 h-8 animate-pulse" />
                <div>
                  <p className="text-2xl font-bold">{displayStreak} Day Streak!</p>
                  <p className="text-sm opacity-90">
                    {deadlineInfo?.isActiveToday
                      ? '✓ Active today - Keep it going!'
                      : deadlineInfo
                        ? `⏰ ${deadlineInfo.hours}h left to maintain streak`
                        : 'Keep learning to maintain your streak!'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-75">Best Streak</p>
                <p className="text-xl font-bold">{bestStreak} days</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Broken Streak Notice */}
        {streakValidation.isStale && currentStreak > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">💔</span>
              <div>
                <p className="font-semibold text-gray-700 dark:text-gray-300">Streak Broken</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Last active {streakValidation.daysSinceActivity} days ago. Start fresh today!
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading Skeleton */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-2xl bg-gray-200 dark:bg-dark-700 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {/* Gamification Stats Section */}
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-8"
            >
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Gamification
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  label="Current Streak"
                  value={displayStreak}
                  unit="days"
                  icon={<Flame className="w-6 h-6" />}
                  accentGradient="from-orange-400 to-red-500"
                  animated={true}
                  animationDelay={0}
                  description="Consecutive days with learning activity"
                  showInfoIcon={true}
                  trendPosition="top-right"
                  onClick={() => {
                    setSelectedStat('streak')
                    setIsStatModalOpen(true)
                  }}
                />
                <StatCard
                  label="XP Earned"
                  value={totalXP.toLocaleString()}
                  unit="points"
                  icon={<Zap className="w-6 h-6" />}
                  accentGradient="from-blue-400 to-purple-500"
                  animated={true}
                  animationDelay={1}
                  description="Total experience points earned"
                  showInfoIcon={true}
                  trend={trends.xp?.direction}
                  trendValue={trends.xp?.value}
                  trendPosition="top-right"
                  onClick={() => {
                    setSelectedStat('xp')
                    setIsStatModalOpen(true)
                  }}
                />
                <StatCard
                  label="Progress"
                  value={achievementCompletion}
                  unit="%"
                  icon={<Target className="w-6 h-6" />}
                  accentGradient="from-green-400 to-teal-500"
                  animated={true}
                  animationDelay={2}
                  description="Achievement completion percentage"
                  showInfoIcon={true}
                  trendPosition="top-right"
                  onClick={() => {
                    setSelectedStat('progress')
                    setIsStatModalOpen(true)
                  }}
                />
                <StatCard
                  label="Achievements"
                  value={unlockedAchievements.length}
                  unit="unlocked"
                  icon={<Star className="w-6 h-6" />}
                  accentGradient="from-pink-400 to-rose-500"
                  animated={true}
                  animationDelay={3}
                  description="Total achievements unlocked"
                  showInfoIcon={true}
                  trend={trends.achievements?.direction}
                  trendValue={trends.achievements?.value}
                  trendPosition="top-right"
                  onClick={() => {
                    setSelectedStat('achievements')
                    setIsStatModalOpen(true)
                  }}
                />
              </div>
            </motion.section>

            {/* Drill Stats Section */}
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                Drill Performance
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard
                  label="Drills Completed"
                  value={drillCount}
                  unit="sessions"
                  icon={<BarChart3 className="w-6 h-6" />}
                  accentGradient="from-indigo-400 to-blue-500"
                  animated={true}
                  animationDelay={4}
                  description="Total drill sessions completed"
                  showInfoIcon={true}
                  trend={trends.drills?.direction}
                  trendValue={trends.drills?.value}
                  trendPosition="top-right"
                  onClick={() => {
                    setSelectedStat('drills')
                    setIsStatModalOpen(true)
                  }}
                />
                <StatCard
                  label="Drill Accuracy"
                  value={drillAccuracy}
                  unit="%"
                  icon={<Percent className="w-6 h-6" />}
                  accentGradient="from-teal-400 to-green-500"
                  animated={true}
                  animationDelay={5}
                  description="Average accuracy across all drills"
                  showInfoIcon={true}
                  trend={trends.accuracy?.direction}
                  trendValue={trends.accuracy?.value}
                  trendPosition="top-right"
                  onClick={() => {
                    setSelectedStat('accuracy')
                    setIsStatModalOpen(true)
                  }}
                />
                <StatCard
                  label="Drill Mastery"
                  value={drillMastery}
                  unit="%"
                  icon={<Trophy className="w-6 h-6" />}
                  accentGradient="from-purple-400 to-indigo-500"
                  animated={true}
                  animationDelay={6}
                  description="Overall mastery score (0-100)"
                  showInfoIcon={true}
                  trendPosition="top-right"
                  onClick={() => {
                    setSelectedStat('mastery')
                    setIsStatModalOpen(true)
                  }}
                />
              </div>
            </motion.section>

            {/* Reading Progress Section */}
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="mb-8"
            >
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-500" />
                Reading Progress
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard
                  label="Articles Read"
                  value={readingStats.articles.count}
                  unit="articles"
                  icon={<FileText className="w-6 h-6" />}
                  accentGradient="from-emerald-400 to-teal-500"
                  animated={true}
                  animationDelay={7}
                  description="NHK Easy News articles completed"
                  showInfoIcon={true}
                  trendPosition="top-right"
                  onClick={() => {
                    setSelectedStat('articles')
                    setIsStatModalOpen(true)
                  }}
                />
                <StatCard
                  label="Stories Completed"
                  value={readingStats.stories.count}
                  unit="stories"
                  icon={<BookOpen className="w-6 h-6" />}
                  accentGradient="from-violet-400 to-purple-500"
                  animated={true}
                  animationDelay={8}
                  description="Japanese stories finished"
                  showInfoIcon={true}
                  trendPosition="top-right"
                  onClick={() => {
                    setSelectedStat('stories')
                    setIsStatModalOpen(true)
                  }}
                />
                <StatCard
                  label="Books Completed"
                  value={readingStats.books.count}
                  unit="books"
                  icon={<Library className="w-6 h-6" />}
                  accentGradient="from-amber-400 to-orange-500"
                  animated={true}
                  animationDelay={9}
                  description="Library books finished"
                  showInfoIcon={true}
                  trendPosition="top-right"
                  onClick={() => {
                    setSelectedStat('books')
                    setIsStatModalOpen(true)
                  }}
                />
              </div>
            </motion.section>

            {/* YouTube Shadowing Stats Section */}
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="mb-8"
            >
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                <Play className="w-5 h-5 text-red-500" />
                YouTube Shadowing
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard
                  label="Videos Practiced"
                  value={youtubeStats?.videosPracticed || 0}
                  unit="videos"
                  icon={<Play className="w-6 h-6" />}
                  accentGradient="from-red-400 to-pink-500"
                  animated={true}
                  animationDelay={7}
                  description="Total unique videos accessed"
                  showInfoIcon={true}
                  trendPosition="top-right"
                  onClick={() => {
                    setSelectedStat('videos')
                    setIsStatModalOpen(true)
                  }}
                />
                <StatCard
                  label="Videos Remaining"
                  value={youtubeStats?.videosRemaining || 0}
                  unit="today"
                  icon={<Calendar className="w-6 h-6" />}
                  accentGradient="from-green-400 to-teal-500"
                  animated={true}
                  animationDelay={8}
                  description="Daily quota remaining"
                  showInfoIcon={true}
                  trendPosition="top-right"
                  onClick={() => {
                    setSelectedStat('remaining')
                    setIsStatModalOpen(true)
                  }}
                />
                <StatCard
                  label="Watch Time"
                  value={watchTimeValue}
                  unit={watchTimeUnit}
                  icon={<Clock className="w-6 h-6" />}
                  accentGradient="from-purple-400 to-indigo-500"
                  animated={true}
                  animationDelay={9}
                  description="Total practice time"
                  showInfoIcon={true}
                  trend={trends.watchTime?.direction}
                  trendValue={trends.watchTime?.value}
                  trendPosition="top-right"
                  onClick={() => {
                    setSelectedStat('watchtime')
                    setIsStatModalOpen(true)
                  }}
                />
              </div>
            </motion.section>

            {/* Leaderboard Preview Section */}
            {leaderboardEnabled && (
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mb-8"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-500" />
                    Leaderboard
                  </h2>
                  <Link
                    href="/leaderboard"
                    className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium flex items-center gap-1 transition-colors"
                  >
                    View Full Leaderboard
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                <div className="bg-white/90 dark:bg-dark-800/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-dark-700">
                  {/* User's Rank */}
                  {user && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 rounded-xl border border-primary-200 dark:border-primary-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Your Rank</p>
                          <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                            {leaderboardLoading ? '...' : userRank !== null ? `#${userRank}` : totalXP === 0 ? 'Unranked' : '100+'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Your XP</p>
                          <p className="text-xl font-bold text-gray-800 dark:text-gray-200">
                            {totalXP.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top 5 Preview */}
                  {leaderboardLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-14 rounded-lg bg-gray-100 dark:bg-dark-700 animate-pulse" />
                      ))}
                    </div>
                  ) : leaderboardEntries.length > 0 ? (
                    <div className="space-y-2">
                      {leaderboardEntries.map((entry, idx) => {
                        const isCurrentUser = entry.userId === user?.uid
                        const medalEmojis = ['🥇', '🥈', '🥉']

                        return (
                          <div
                            key={entry.userId}
                            className={`
                              flex items-center gap-3 p-3 rounded-lg transition-all
                              ${isCurrentUser
                                ? 'bg-primary-100 dark:bg-primary-900/30 border-2 border-primary-500'
                                : 'bg-gray-50 dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600'
                              }
                            `}
                          >
                            <span className="text-lg font-bold w-8 text-center">
                              {idx < 3 ? medalEmojis[idx] : `#${entry.rank}`}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                {entry.displayName}
                                {isCurrentUser && (
                                  <span className="ml-2 text-xs bg-primary-500 text-white px-2 py-0.5 rounded-full">
                                    You
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Level {entry.currentLevel}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-gray-800 dark:text-gray-200">
                                {entry.totalXP.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">XP</p>
                            </div>
                            <div className="flex items-center gap-1 text-orange-500">
                              <Flame className="w-4 h-4" />
                              <span className="text-sm font-semibold">{entry.currentStreak}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No leaderboard data available yet</p>
                    </div>
                  )}

                  {/* View Full Leaderboard Button */}
                  {leaderboardEntries.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-600">
                      <Link
                        href="/leaderboard"
                        className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium transition-colors"
                      >
                        <Trophy className="w-4 h-4" />
                        View Full Rankings
                        {leaderboardTotalPlayers > 0 && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            ({leaderboardTotalPlayers} players)
                          </span>
                        )}
                      </Link>
                    </div>
                  )}
                </div>
              </motion.section>
            )}
          </>
        )}
      </main>

      {/* Stat Details Modal */}
      <Modal
        isOpen={isStatModalOpen}
        onClose={() => {
          setIsStatModalOpen(false)
          setSelectedStat(null)
        }}
        title={selectedStat ? getStatBreakdown(selectedStat)?.title : ''}
        size="md"
      >
        {selectedStat && getStatBreakdown(selectedStat) && (
          <div className="space-y-5">
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              {getStatBreakdown(selectedStat)?.description}
            </p>

            <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 border border-primary-100 dark:border-primary-900/30">
              <h3 className="text-sm font-semibold text-primary-700 dark:text-primary-300 mb-2 flex items-center gap-2">
                📐 Formula
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 font-mono bg-white dark:bg-dark-800 px-3 py-2 rounded">
                {getStatBreakdown(selectedStat)?.formula}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                📊 Breakdown
              </h3>
              {getStatBreakdown(selectedStat)?.breakdown.map((item: { label: string; value: string }, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-3 bg-gray-50 dark:bg-dark-700 rounded-lg"
                >
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {item.label}
                  </p>
                  <p className="text-sm font-bold text-primary-600 dark:text-primary-400">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setIsStatModalOpen(false)
                  setSelectedStat(null)
                }}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default function StatisticsPage() {
  return (
    <Suspense
      fallback={
        <LoadingOverlay
          isLoading={true}
          message="Loading statistics..."
          showDoshi={true}
          fullScreen={true}
        />
      }
    >
      <StatisticsContent />
    </Suspense>
  )
}
