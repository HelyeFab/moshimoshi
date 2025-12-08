'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  TrendingDown,
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
  Activity,
  Info,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useGamification } from '@/hooks/useGamification'
import { useLearningProgress } from '@/hooks/useLearningProgress'
import { useYouTubeStats } from '@/hooks/useYouTubeStats'
import { useSubscription } from '@/hooks/useSubscription'
import { DrillProgressManager } from '@/lib/review-engine/progress/DrillProgressManager'
import { validateStreakDisplay, getStreakDeadline } from '@/lib/gamification/utils/streakValidation'
import { useI18n } from '@/i18n/I18nContext'
import { LoadingOverlay } from '@/components/ui/Loading'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import logger from '@/lib/logger'
import achievementsConfig from '@/config/gamification/achievements.json'

// Condition types that are NOT yet implemented (return 0 in gamificationListener.ts)
const UNIMPLEMENTED_CONDITIONS = ['kanji_learned', 'speed_reviews']

// Calculate implemented achievements count dynamically
const IMPLEMENTED_ACHIEVEMENTS = achievementsConfig.achievements.filter(
  a => !UNIMPLEMENTED_CONDITIONS.includes(a.condition.type)
).length

interface StatCardProps {
  label: string
  value: string | number
  unit: string
  icon: React.ReactNode
  color: string
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  onClick?: () => void
  description?: string
}

function StatCard({
  label,
  value,
  unit,
  icon,
  color,
  trend,
  trendValue,
  onClick,
  description,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-2xl p-6
        bg-white/90 dark:bg-dark-800/90 backdrop-blur-sm
        border border-gray-200 dark:border-dark-700
        shadow-lg hover:shadow-xl
        transition-all duration-300 cursor-pointer
        group
      `}
    >
      {/* Gradient accent */}
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${color}`} />

      {/* Icon */}
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${color} text-white shadow-lg`}>
          {icon}
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              trend === 'up'
                ? 'text-green-600'
                : trend === 'down'
                  ? 'text-red-600'
                  : 'text-gray-500'
            }`}
          >
            {trend === 'up' ? (
              <TrendingUp className="w-4 h-4" />
            ) : trend === 'down' ? (
              <TrendingDown className="w-4 h-4" />
            ) : (
              <Activity className="w-4 h-4" />
            )}
            {trendValue && <span>{trendValue}</span>}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="mb-2">
        <span className="text-4xl font-bold text-gray-900 dark:text-white">{value}</span>
        <span className="ml-2 text-lg text-gray-500 dark:text-gray-400">{unit}</span>
      </div>

      {/* Label */}
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>

      {/* Description on hover */}
      {description && (
        <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-4 rounded-2xl">
          <p className="text-white text-sm text-center">{description}</p>
        </div>
      )}

      {/* Info icon */}
      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <Info className="w-4 h-4 text-gray-400" />
      </div>
    </motion.div>
  )
}

function StatisticsContent() {
  const router = useRouter()
  const { user, loading: authLoading, isGuest } = useAuth()
  const { strings } = useI18n()
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
    categories: learningCategories,
    loading: learningProgressLoading,
  } = useLearningProgress()

  // YouTube stats
  const { stats: youtubeStats, loading: youtubeStatsLoading } = useYouTubeStats()

  // Drill stats
  const [drillStats, setDrillStats] = useState<any>(null)
  const [loadingDrillStats, setLoadingDrillStats] = useState(false)

  // Modal state
  const [selectedStat, setSelectedStat] = useState<string | null>(null)
  const [isStatModalOpen, setIsStatModalOpen] = useState(false)

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

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user && !isGuest) {
      router.push('/auth/signin')
    }
  }, [authLoading, user, isGuest, router])

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

  // Achievement completion percentage (dynamic based on implemented achievements)
  const achievementCompletion =
    gamificationEnabled && unlockedAchievements.length > 0
      ? Math.round((unlockedAchievements.length / IMPLEMENTED_ACHIEVEMENTS) * 100)
      : 0

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
    gamificationLoading || learningProgressLoading || youtubeStatsLoading || loadingDrillStats

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
      <Navbar user={user} showUserMenu={true} />

      <PageHeader
        title={strings.statistics?.title || 'Your Statistics'}
        description={strings.statistics?.subtitle || 'Track your Japanese learning journey'}
        showDoshi={true}
        doshiMood="happy"
        doshiSize="large"
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
                  color="from-orange-400 to-red-500"
                  onClick={() => {
                    setSelectedStat('streak')
                    setIsStatModalOpen(true)
                  }}
                  description="Consecutive days with learning activity"
                />
                <StatCard
                  label="XP Earned"
                  value={totalXP.toLocaleString()}
                  unit="points"
                  icon={<Zap className="w-6 h-6" />}
                  color="from-blue-400 to-purple-500"
                  onClick={() => {
                    setSelectedStat('xp')
                    setIsStatModalOpen(true)
                  }}
                  description="Total experience points earned"
                />
                <StatCard
                  label="Progress"
                  value={achievementCompletion}
                  unit="%"
                  icon={<Target className="w-6 h-6" />}
                  color="from-green-400 to-teal-500"
                  onClick={() => {
                    setSelectedStat('progress')
                    setIsStatModalOpen(true)
                  }}
                  description="Achievement completion percentage"
                />
                <StatCard
                  label="Achievements"
                  value={unlockedAchievements.length}
                  unit="unlocked"
                  icon={<Star className="w-6 h-6" />}
                  color="from-pink-400 to-rose-500"
                  onClick={() => {
                    setSelectedStat('achievements')
                    setIsStatModalOpen(true)
                  }}
                  description="Total achievements unlocked"
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
                  color="from-indigo-400 to-blue-500"
                  onClick={() => {
                    setSelectedStat('drills')
                    setIsStatModalOpen(true)
                  }}
                  description="Total drill sessions completed"
                />
                <StatCard
                  label="Drill Accuracy"
                  value={drillAccuracy}
                  unit="%"
                  icon={<Percent className="w-6 h-6" />}
                  color="from-teal-400 to-green-500"
                  onClick={() => {
                    setSelectedStat('accuracy')
                    setIsStatModalOpen(true)
                  }}
                  description="Average accuracy across all drills"
                />
                <StatCard
                  label="Drill Mastery"
                  value={drillMastery}
                  unit="%"
                  icon={<Trophy className="w-6 h-6" />}
                  color="from-purple-400 to-indigo-500"
                  onClick={() => {
                    setSelectedStat('mastery')
                    setIsStatModalOpen(true)
                  }}
                  description="Overall mastery score (0-100)"
                />
              </div>
            </motion.section>

            {/* YouTube Shadowing Stats Section */}
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
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
                  color="from-red-400 to-pink-500"
                  onClick={() => {
                    setSelectedStat('videos')
                    setIsStatModalOpen(true)
                  }}
                  description="Total unique videos accessed"
                />
                <StatCard
                  label="Videos Remaining"
                  value={youtubeStats?.videosRemaining || 0}
                  unit="today"
                  icon={<Calendar className="w-6 h-6" />}
                  color="from-green-400 to-teal-500"
                  onClick={() => {
                    setSelectedStat('remaining')
                    setIsStatModalOpen(true)
                  }}
                  description="Daily quota remaining"
                />
                <StatCard
                  label="Watch Time"
                  value={watchTimeValue}
                  unit={watchTimeUnit}
                  icon={<Clock className="w-6 h-6" />}
                  color="from-purple-400 to-indigo-500"
                  onClick={() => {
                    setSelectedStat('watchtime')
                    setIsStatModalOpen(true)
                  }}
                  description="Total practice time"
                />
              </div>
            </motion.section>
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
              {getStatBreakdown(selectedStat)?.breakdown.map((item: any, idx: number) => (
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
