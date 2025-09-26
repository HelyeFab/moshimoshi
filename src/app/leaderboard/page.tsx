'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import Navbar from '@/components/layout/Navbar'
import AchievementLeaderboard from '@/components/leaderboard/AchievementLeaderboard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nContext'
import { Trophy, Medal, Award, Target, Zap, Star, Users, Clock, Info, Calculator, Shield, TrendingUp } from 'lucide-react'

type TimeFrame = 'daily' | 'weekly' | 'monthly' | 'allTime'

interface UserStats {
  rank: number
  totalPoints: number
  currentStreak: number
}

export default function LeaderboardPage() {
  const { user } = useAuth()
  const { t, strings } = useI18n()
  const [timeframe, setTimeframe] = useState<TimeFrame>('allTime')
  const [activeTab, setActiveTab] = useState<'global' | 'friends'>('global')
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [showTransparency, setShowTransparency] = useState(false)

  // Fetch user stats when user or timeframe changes
  useEffect(() => {
    const fetchUserStats = async () => {
      if (!user?.uid) {
        setIsLoadingStats(false)
        return
      }

      setIsLoadingStats(true)
      try {
        // Fetch user's leaderboard position and stats
        const response = await fetch(`/api/leaderboard/user/${user.uid}?timeframe=${timeframe}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.entry) {
            setUserStats({
              rank: data.entry.rank,
              totalPoints: data.entry.totalPoints,
              currentStreak: data.entry.currentStreak || 0
            })
          }
        }
      } catch (error) {
        console.error('Failed to fetch user stats:', error)
      } finally {
        setIsLoadingStats(false)
      }
    }

    fetchUserStats()
  }, [user?.uid, timeframe])

  const timeframeOptions: { value: TimeFrame; label: string; icon: JSX.Element }[] = [
    {
      value: 'daily',
      label: strings.leaderboard?.daily || 'Today',
      icon: <Clock className="w-4 h-4" />
    },
    {
      value: 'weekly',
      label: strings.leaderboard?.weekly || 'This Week',
      icon: <Target className="w-4 h-4" />
    },
    {
      value: 'monthly',
      label: strings.leaderboard?.monthly || 'This Month',
      icon: <Award className="w-4 h-4" />
    },
    {
      value: 'allTime',
      label: strings.leaderboard?.allTime || 'All Time',
      icon: <Trophy className="w-4 h-4" />
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-dark-900 dark:via-dark-800 dark:to-dark-900">
      <Navbar user={user} showUserMenu={true} />

      <div className="container mx-auto px-4 py-8">
        {/* Header with animated background */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6 md:mb-8 relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 p-4 sm:p-6 md:p-8 text-white shadow-xl"
        >
          {/* Dark overlay for better text contrast */}
          <div className="absolute inset-0 bg-black/10"></div>

          {/* Animated background elements */}
          <div className="absolute inset-0 opacity-20">
            <motion.div
              className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full filter blur-3xl"
              animate={{
                x: [0, 50, 0],
                y: [0, -30, 0],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "linear"
              }}
            />
            <motion.div
              className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-300 rounded-full filter blur-3xl"
              animate={{
                x: [0, -30, 0],
                y: [0, 50, 0],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          </div>

          {/* Content */}
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-4">
              <div className="p-2 sm:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Trophy className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 sm:mb-2">
                  {strings.leaderboard?.title || 'Leaderboard'}
                </h1>
                <p className="text-sm sm:text-base md:text-lg opacity-90">
                  {strings.leaderboard?.description || 'Compete with learners worldwide'}
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mt-4 sm:mt-6">
              <motion.div
                className="bg-white/10 backdrop-blur-sm rounded-lg p-2 sm:p-3"
                whileHover={{ scale: 1.05 }}
              >
                <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                  <Medal className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-300" />
                  <div className="text-right sm:text-left">
                    <div className="text-xl sm:text-2xl font-bold">
                      {isLoadingStats ? '...' : userStats?.rank || '--'}
                    </div>
                    <div className="text-xs sm:text-sm opacity-75">{strings.leaderboard?.yourRank || 'Your Rank'}</div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white/10 backdrop-blur-sm rounded-lg p-2 sm:p-3"
                whileHover={{ scale: 1.05 }}
              >
                <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-300" />
                  <div className="text-right sm:text-left">
                    <div className="text-xl sm:text-2xl font-bold">
                      {isLoadingStats ? '...' : userStats?.totalPoints?.toLocaleString() || '--'}
                    </div>
                    <div className="text-xs sm:text-sm opacity-75">{strings.leaderboard?.achievementPoints || 'Achievement Pts'}</div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white/10 backdrop-blur-sm rounded-lg p-2 sm:p-3"
                whileHover={{ scale: 1.05 }}
              >
                <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-300" />
                  <div className="text-right sm:text-left">
                    <div className="text-xl sm:text-2xl font-bold">
                      {isLoadingStats ? '...' : userStats?.currentStreak || '0'}
                    </div>
                    <div className="text-xs sm:text-sm opacity-75">{strings.leaderboard?.streak || 'Streak Days'}</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Tab Selection */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4 sm:mb-6">
          <Button
            variant={activeTab === 'global' ? 'default' : 'outline'}
            onClick={() => setActiveTab('global')}
            className="flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            {strings.leaderboard?.global || 'Global'}
          </Button>
          <Button
            variant={activeTab === 'friends' ? 'default' : 'outline'}
            onClick={() => setActiveTab('friends')}
            className="flex items-center gap-2"
            disabled
          >
            <Users className="w-4 h-4" />
            {strings.leaderboard?.friends || 'Friends'}
            <span className="text-xs bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">
              {strings.common?.comingSoon || 'Soon'}
            </span>
          </Button>
        </div>

        {/* Time Frame Selection */}
        <Card className="mb-4 sm:mb-6 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
              {strings.leaderboard?.timeFrame || 'Time Frame'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {timeframeOptions.map((option) => (
                <motion.button
                  key={option.value}
                  onClick={() => setTimeframe(option.value)}
                  className={`
                    px-3 py-2 sm:px-4 rounded-lg flex items-center gap-1 sm:gap-2 transition-all text-xs sm:text-sm
                    ${timeframe === option.value
                      ? 'bg-primary-500 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                    }
                  `}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {option.icon}
                  <span className="font-medium hidden sm:inline">{option.label}</span>
                  <span className="font-medium sm:hidden">{option.value === 'allTime' ? 'All' : option.value.charAt(0).toUpperCase() + option.value.slice(1, 3)}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </Card>

        {/* Main Leaderboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {activeTab === 'global' && (
            <AchievementLeaderboard
              currentUserId={user?.uid}
              timeframe={timeframe}
              limit={50}
              showCurrentUserAlways={true}
            />
          )}

          {activeTab === 'friends' && (
            <Card className="p-12 text-center">
              <div className="max-w-md mx-auto">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
                  {strings.leaderboard?.friendsComingSoon || 'Friends Leaderboard Coming Soon'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {strings.leaderboard?.friendsDescription || 'Connect with friends and compete together in your learning journey.'}
                </p>
              </div>
            </Card>
          )}
        </motion.div>

        {/* Transparency Button */}
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => setShowTransparency(!showTransparency)}
            className="flex items-center gap-2"
          >
            <Info className="w-4 h-4" />
            {showTransparency ? 'Hide' : 'Show'} How Stats Are Calculated
          </Button>
        </div>

        {/* Transparency Section */}
        {showTransparency && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6"
          >
            <Card className="p-6 bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 border-2 border-blue-200 dark:border-blue-800">
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                    <Calculator className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    How Leaderboard Stats Are Calculated
                  </h3>
                </div>

                {/* Points Calculation */}
                <div className="space-y-4">
                  <div className="border-l-4 border-yellow-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-600" />
                      Achievement Points
                    </h4>
                    <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <li>• <strong>Common achievements:</strong> 10 points each</li>
                      <li>• <strong>Uncommon achievements:</strong> 25 points each</li>
                      <li>• <strong>Rare achievements:</strong> 50 points each</li>
                      <li>• <strong>Epic achievements:</strong> 100 points each</li>
                      <li>• <strong>Legendary achievements:</strong> 250 points each</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      XP (Experience Points)
                    </h4>
                    <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <li>• <strong>Lesson completion:</strong> 10-50 XP based on difficulty</li>
                      <li>• <strong>Perfect score bonus:</strong> +20% XP</li>
                      <li>• <strong>Speed bonus:</strong> +10% XP for fast completion</li>
                      <li>• <strong>Daily practice:</strong> 5-15 XP per item reviewed</li>
                      <li>• <strong>First try bonus:</strong> +5 XP for correct first attempt</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-purple-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-purple-600" />
                      Streak Calculation
                    </h4>
                    <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <li>• <strong>Daily streak:</strong> Practice at least once per day</li>
                      <li>• <strong>Reset time:</strong> Midnight in your timezone</li>
                      <li>• <strong>Grace period:</strong> None - must practice every day</li>
                      <li>• <strong>Streak bonus:</strong> +1 point per day in current streak</li>
                      <li>• <strong>Milestone bonuses:</strong> Extra points at 7, 30, 100 days</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-red-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-red-600" />
                      Time-Based Rankings
                    </h4>
                    <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <li>• <strong>Daily:</strong> Points earned in the last 24 hours</li>
                      <li>• <strong>Weekly:</strong> Points from the last 7 days</li>
                      <li>• <strong>Monthly:</strong> Points from the last 30 days</li>
                      <li>• <strong>All Time:</strong> Total accumulated points</li>
                      <li>• <strong>Updates:</strong> Real-time with 1-minute rate limiting</li>
                    </ul>
                  </div>
                </div>

                {/* Data Storage Info */}
                <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        Fair Play & Data Storage
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        All users can participate in the leaderboard regardless of their subscription tier:
                      </p>
                      <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <li>• <strong>Free users:</strong> Stats stored locally and synced to leaderboard</li>
                        <li>• <strong>Premium users:</strong> Full cloud sync with backup</li>
                        <li>• <strong>Privacy:</strong> You can opt-out of the leaderboard anytime</li>
                        <li>• <strong>Updates:</strong> Stats update after significant changes (50+ XP or daily events)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4"
        >
          <Card className="p-3 sm:p-4 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start gap-2 sm:gap-3">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 dark:text-yellow-400 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100 mb-1">
                  {strings.leaderboard?.howToClimb || 'How to Climb'}
                </h4>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {strings.leaderboard?.climbDescription || 'Complete lessons, unlock achievements, and maintain streaks to earn points.'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2 sm:gap-3">
              <Medal className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100 mb-1">
                  {strings.leaderboard?.rewards || 'Rewards'}
                </h4>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {strings.leaderboard?.rewardsDescription || 'Top performers unlock special badges and exclusive content.'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-3 sm:p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
            <div className="flex items-start gap-2 sm:gap-3">
              <Star className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100 mb-1">
                  {strings.leaderboard?.fairPlay || 'Fair Play'}
                </h4>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {strings.leaderboard?.fairPlayDescription || 'Rankings reset periodically to give everyone a chance to shine.'}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}