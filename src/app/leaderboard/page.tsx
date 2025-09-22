'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import Navbar from '@/components/layout/Navbar'
import AchievementLeaderboard from '@/components/leaderboard/AchievementLeaderboard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nContext'
import { Trophy, Medal, Award, Target, Zap, Star, Users, Clock } from 'lucide-react'

type TimeFrame = 'daily' | 'weekly' | 'monthly' | 'allTime'

export default function LeaderboardPage() {
  const { user } = useAuth()
  const { t, strings } = useI18n()
  const [timeframe, setTimeframe] = useState<TimeFrame>('allTime')
  const [activeTab, setActiveTab] = useState<'global' | 'friends'>('global')

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
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Header with animated background */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 p-8 text-white shadow-xl"
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
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Trophy className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-4xl font-bold mb-2">
                  {strings.leaderboard?.title || 'Leaderboard'}
                </h1>
                <p className="text-lg opacity-90">
                  {strings.leaderboard?.description || 'Compete with learners worldwide'}
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <motion.div
                className="bg-white/10 backdrop-blur-sm rounded-lg p-3"
                whileHover={{ scale: 1.05 }}
              >
                <div className="flex items-center gap-2">
                  <Medal className="w-5 h-5 text-yellow-300" />
                  <div>
                    <div className="text-2xl font-bold">--</div>
                    <div className="text-sm opacity-75">{strings.leaderboard?.yourRank || 'Your Rank'}</div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white/10 backdrop-blur-sm rounded-lg p-3"
                whileHover={{ scale: 1.05 }}
              >
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-300" />
                  <div>
                    <div className="text-2xl font-bold">--</div>
                    <div className="text-sm opacity-75">{strings.leaderboard?.totalPoints || 'Total Points'}</div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white/10 backdrop-blur-sm rounded-lg p-3"
                whileHover={{ scale: 1.05 }}
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-300" />
                  <div>
                    <div className="text-2xl font-bold">--</div>
                    <div className="text-sm opacity-75">{strings.leaderboard?.streak || 'Streak Days'}</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Tab Selection */}
        <div className="flex gap-2 mb-6">
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
        <Card className="mb-6 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {strings.leaderboard?.timeFrame || 'Time Frame'}
            </h3>
            <div className="flex gap-2">
              {timeframeOptions.map((option) => (
                <motion.button
                  key={option.value}
                  onClick={() => setTimeframe(option.value)}
                  className={`
                    px-4 py-2 rounded-lg flex items-center gap-2 transition-all
                    ${timeframe === option.value
                      ? 'bg-primary-500 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                    }
                  `}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {option.icon}
                  <span className="font-medium">{option.label}</span>
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

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <Card className="p-4 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start gap-3">
              <Trophy className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-1" />
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  {strings.leaderboard?.howToClimb || 'How to Climb'}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {strings.leaderboard?.climbDescription || 'Complete lessons, unlock achievements, and maintain streaks to earn points.'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Medal className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-1" />
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  {strings.leaderboard?.rewards || 'Rewards'}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {strings.leaderboard?.rewardsDescription || 'Top performers unlock special badges and exclusive content.'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3">
              <Star className="w-5 h-5 text-green-600 dark:text-green-400 mt-1" />
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  {strings.leaderboard?.fairPlay || 'Fair Play'}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
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