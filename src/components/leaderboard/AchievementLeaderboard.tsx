'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nContext'
import Image from 'next/image'

export interface LeaderboardEntry {
  rank: number
  userId: string
  username: string
  displayName: string
  avatar?: string
  totalPoints: number
  achievementCount: number
  level: number
  xp: number
  streak: number
  rarity: {
    legendary: number
    epic: number
    rare: number
    uncommon: number
    common: number
  }
  isCurrentUser?: boolean
  change?: 'up' | 'down' | 'same' // Position change from last period
  changeAmount?: number
}

interface LeaderboardProps {
  currentUserId?: string
  timeframe?: 'daily' | 'weekly' | 'monthly' | 'allTime'
  limit?: number
  showCurrentUserAlways?: boolean
}

const RankBadge = ({ rank }: { rank: number }) => {
  if (rank === 1) {
    return (
      <motion.div
        className="w-8 h-8 flex items-center justify-center"
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <span className="text-2xl">🥇</span>
      </motion.div>
    )
  }
  if (rank === 2) {
    return (
      <motion.div
        className="w-8 h-8 flex items-center justify-center"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <span className="text-2xl">🥈</span>
      </motion.div>
    )
  }
  if (rank === 3) {
    return (
      <motion.div
        className="w-8 h-8 flex items-center justify-center"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <span className="text-2xl">🥉</span>
      </motion.div>
    )
  }

  return (
    <div className="w-8 h-8 flex items-center justify-center">
      <span className="text-lg font-bold text-gray-600 dark:text-gray-400">
        {rank}
      </span>
    </div>
  )
}

const ChangeIndicator = ({ change, amount }: { change?: string, amount?: number }) => {
  if (!change || change === 'same') return null

  return (
    <div className={`
      flex items-center text-xs font-medium
      ${change === 'up' ? 'text-green-500' : 'text-red-500'}
    `}>
      {change === 'up' ? '↑' : '↓'}
      {amount && <span className="ml-0.5">{amount}</span>}
    </div>
  )
}

const LeaderboardRow = ({ entry, index }: { entry: LeaderboardEntry, index: number }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`
        relative overflow-hidden rounded-lg mb-2
        ${entry.isCurrentUser
          ? 'bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 ring-2 ring-primary-300 dark:ring-primary-700'
          : 'bg-white dark:bg-dark-800'
        }
        shadow-sm hover:shadow-md transition-all duration-300
      `}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          {/* Left Section: Rank & User Info */}
          <div className="flex items-center space-x-4">
            <RankBadge rank={entry.rank} />

            <ChangeIndicator change={entry.change} amount={entry.changeAmount} />

            {/* Avatar */}
            <div className="relative">
              {entry.avatar ? (
                <Image
                  src={entry.avatar}
                  alt={entry.displayName}
                  width={40}
                  height={40}
                  className="rounded-full ring-2 ring-gray-200 dark:ring-gray-700"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold">
                  {entry.displayName[0].toUpperCase()}
                </div>
              )}

              {/* Level Badge */}
              <div className="absolute -bottom-1 -right-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {entry.level}
              </div>
            </div>

            {/* Name & Username */}
            <div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">
                {entry.displayName}
                {entry.isCurrentUser && <span className="ml-2 text-xs text-primary-500">(You)</span>}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                @{entry.username}
              </div>
            </div>
          </div>

          {/* Right Section: Stats */}
          <div className="flex items-center space-x-6">
            {/* Achievements */}
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {entry.achievementCount}
              </div>
              <div className="text-xs text-gray-500">Achievements</div>
            </div>

            {/* Points */}
            <div className="text-center">
              <div className="text-lg font-bold text-primary-600 dark:text-primary-400">
                {entry.totalPoints.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Points</div>
            </div>

            {/* Streak */}
            {entry.streak > 0 && (
              <div className="text-center">
                <div className="text-lg font-bold text-orange-500 flex items-center">
                  🔥 {entry.streak}
                </div>
                <div className="text-xs text-gray-500">Streak</div>
              </div>
            )}
          </div>
        </div>

        {/* Expanded Details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
            >
              <div className="grid grid-cols-5 gap-4 text-center">
                <div>
                  <div className="text-2xl mb-1">🏆</div>
                  <div className="text-xs text-gray-500">Legendary</div>
                  <div className="font-bold">{entry.rarity.legendary}</div>
                </div>
                <div>
                  <div className="text-2xl mb-1">💎</div>
                  <div className="text-xs text-gray-500">Epic</div>
                  <div className="font-bold">{entry.rarity.epic}</div>
                </div>
                <div>
                  <div className="text-2xl mb-1">💙</div>
                  <div className="text-xs text-gray-500">Rare</div>
                  <div className="font-bold">{entry.rarity.rare}</div>
                </div>
                <div>
                  <div className="text-2xl mb-1">💚</div>
                  <div className="text-xs text-gray-500">Uncommon</div>
                  <div className="font-bold">{entry.rarity.uncommon}</div>
                </div>
                <div>
                  <div className="text-2xl mb-1">⚪</div>
                  <div className="text-xs text-gray-500">Common</div>
                  <div className="font-bold">{entry.rarity.common}</div>
                </div>
              </div>

              {/* XP Progress Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Level {entry.level}</span>
                  <span>{entry.xp} XP</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary-400 to-primary-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${(entry.xp % 1000) / 10}%` }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default function AchievementLeaderboard({
  currentUserId,
  timeframe = 'allTime',
  limit = 10,
  showCurrentUserAlways = true
}: LeaderboardProps) {
  const { strings } = useI18n()
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [currentUserEntry, setCurrentUserEntry] = useState<LeaderboardEntry | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch leaderboard data
  useEffect(() => {
    fetchLeaderboard()
  }, [selectedTimeframe, currentUserId])

  const fetchLeaderboard = async () => {
    setIsLoading(true)

    try {
      // This would be an API call in production
      const response = await fetch(`/api/leaderboard?timeframe=${selectedTimeframe}&limit=${limit}`)
      const data = await response.json()

      if (data.success) {
        setLeaderboard(data.entries)

        // Find current user entry
        if (currentUserId) {
          const userEntry = data.entries.find((e: LeaderboardEntry) => e.userId === currentUserId)
          if (userEntry) {
            setCurrentUserEntry(userEntry)
          } else if (showCurrentUserAlways) {
            // Fetch current user's position separately if not in top entries
            const userResponse = await fetch(`/api/leaderboard/user/${currentUserId}?timeframe=${selectedTimeframe}`)
            const userData = await userResponse.json()
            if (userData.success) {
              setCurrentUserEntry(userData.entry)
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error)

      // Mock data for demonstration
      const mockData: LeaderboardEntry[] = [
        {
          rank: 1,
          userId: '1',
          username: 'sakura_master',
          displayName: 'Sakura Master',
          totalPoints: 12500,
          achievementCount: 45,
          level: 28,
          xp: 2850,
          streak: 142,
          rarity: { legendary: 3, epic: 8, rare: 12, uncommon: 15, common: 7 },
          change: 'same'
        },
        {
          rank: 2,
          userId: '2',
          username: 'nihongo_ninja',
          displayName: 'Nihongo Ninja',
          totalPoints: 11200,
          achievementCount: 42,
          level: 25,
          xp: 2520,
          streak: 98,
          rarity: { legendary: 2, epic: 7, rare: 11, uncommon: 14, common: 8 },
          change: 'up',
          changeAmount: 1
        },
        {
          rank: 3,
          userId: '3',
          username: 'kanji_king',
          displayName: 'Kanji King',
          totalPoints: 10800,
          achievementCount: 40,
          level: 24,
          xp: 2410,
          streak: 76,
          rarity: { legendary: 2, epic: 6, rare: 10, uncommon: 14, common: 8 },
          change: 'down',
          changeAmount: 1
        },
        {
          rank: 4,
          userId: currentUserId || '4',
          username: 'you',
          displayName: 'You',
          totalPoints: 8500,
          achievementCount: 32,
          level: 18,
          xp: 1820,
          streak: 15,
          rarity: { legendary: 1, epic: 4, rare: 8, uncommon: 12, common: 7 },
          isCurrentUser: true,
          change: 'up',
          changeAmount: 2
        }
      ]

      setLeaderboard(mockData.slice(0, limit))
      if (currentUserId) {
        setCurrentUserEntry(mockData.find(e => e.isCurrentUser) || null)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const timeframes = [
    { value: 'daily', label: strings.leaderboard?.daily || 'Today' },
    { value: 'weekly', label: strings.leaderboard?.weekly || 'This Week' },
    { value: 'monthly', label: strings.leaderboard?.monthly || 'This Month' },
    { value: 'allTime', label: strings.leaderboard?.allTime || 'All Time' }
  ]

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {strings.leaderboard?.title || 'Achievement Leaderboard'}
        </h2>

        {/* Timeframe Selector */}
        <div className="flex gap-2">
          {timeframes.map((tf) => (
            <Button
              key={tf.value}
              variant={selectedTimeframe === tf.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeframe(tf.value as typeof timeframe)}
            >
              {tf.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Leaderboard List */}
      <div className="space-y-2">
        {leaderboard.map((entry, index) => (
          <LeaderboardRow key={entry.userId} entry={entry} index={index} />
        ))}
      </div>

      {/* Current User Position (if not in top list) */}
      {showCurrentUserAlways && currentUserEntry && !leaderboard.find(e => e.isCurrentUser) && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 mb-2">Your Position</div>
          <LeaderboardRow entry={currentUserEntry} index={0} />
        </div>
      )}
    </Card>
  )
}