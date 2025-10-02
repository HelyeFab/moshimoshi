'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { useGamification } from '@/hooks/useGamification'
import Navbar from '@/components/layout/Navbar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nContext'
import { Trophy, Medal, Award, Target, Zap, Star, Users, Clock, Info } from 'lucide-react'
import { MOCK_LEADERBOARD, MOCK_CURRENT_USER_STATS, getMockLeaderboard, getMockTopN } from '@/mocks/leaderboard.mock'

type TimeFrame = 'daily' | 'weekly' | 'monthly' | 'allTime'

export default function LeaderboardPage() {
  const { user } = useAuth()
  const { t, strings } = useI18n()
  const [timeframe, setTimeframe] = useState<TimeFrame>('allTime')
  const [activeTab, setActiveTab] = useState<'global' | 'friends'>('global')

  // Get real gamification data for current user
  const {
    totalXP,
    currentLevel,
    currentStreak,
    isEnabled: gamificationEnabled
  } = useGamification()

  // Use mock data for leaderboard (no server-side rankings yet)
  const leaderboardData = getMockLeaderboard(50)

  // Update user stats with real data if gamification is enabled
  const userStats = gamificationEnabled
    ? {
        rank: MOCK_CURRENT_USER_STATS.rank, // Keep mock rank
        score: totalXP, // Real XP
        streak: currentStreak, // Real streak
        level: currentLevel // Real level
      }
    : MOCK_CURRENT_USER_STATS // Fall back to mock when disabled

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
                  (Mock data - gamification system removed)
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
                      {userStats.rank}
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
                      {userStats.score}
                    </div>
                    <div className="text-xs sm:text-sm opacity-75">{strings.leaderboard?.achievementPoints || 'Points'}</div>
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
                      {userStats.streak}
                    </div>
                    <div className="text-xs sm:text-sm opacity-75">{strings.leaderboard?.streak || 'Streak'}</div>
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
            <Card className="overflow-hidden">
              <div className="p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                  Top 50 Learners
                </h2>
                <div className="space-y-2">
                  {leaderboardData.map((entry, index) => {
                    const isCurrentUser = entry.userId === user?.uid
                    const isTopThree = index < 3
                    const medalColors = ['text-yellow-500', 'text-gray-400', 'text-orange-600']

                    return (
                      <div
                        key={entry.userId}
                        className={`
                          flex items-center gap-4 p-3 rounded-lg transition-all
                          ${isCurrentUser
                            ? 'bg-primary-100 dark:bg-primary-900/30 border-2 border-primary-500'
                            : 'bg-gray-50 dark:bg-dark-800 hover:bg-gray-100 dark:hover:bg-dark-700'
                          }
                        `}
                      >
                        <div className="w-12 text-center">
                          {isTopThree ? (
                            <Medal className={`w-6 h-6 mx-auto ${medalColors[index]}`} />
                          ) : (
                            <span className="text-gray-600 dark:text-gray-400 font-semibold">
                              #{entry.rank}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            {entry.displayName}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs bg-primary-500 text-white px-2 py-1 rounded-full">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {entry.score} points • Level {entry.level}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-orange-500" />
                          <span className="text-sm font-semibold">{entry.streak}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Card>
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

        {/* Info Message */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
                Mock Leaderboard Data
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                This leaderboard displays mock data for demonstration purposes.
                Real competitive leaderboards coming soon!
                {gamificationEnabled && (
                  <span className="block mt-1 text-green-600 dark:text-green-400">
                    ✓ Your personal stats (XP: {totalXP}, Level: {currentLevel}, Streak: {currentStreak}) are real.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
