'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { useGamification } from '@/hooks/useGamification'
import Navbar from '@/components/layout/Navbar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nContext'
import { Trophy, Medal, Zap, Star, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { LoadingOverlay } from '@/components/ui/Loading'
import type { LeaderboardEntry, LeaderboardResponse, UserRankResponse } from '@/lib/leaderboard/types'

export default function LeaderboardPage() {
  const { user } = useAuth()
  const { t, strings } = useI18n()
  const [activeTab, setActiveTab] = useState<'global' | 'friends'>('global')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([])
  const [pagination, setPagination] = useState<LeaderboardResponse['pagination'] | null>(null)
  const [metadata, setMetadata] = useState<LeaderboardResponse['metadata'] | null>(null)
  const [userRank, setUserRank] = useState<number | null>(null)

  // Get real gamification data for current user
  const {
    totalXP,
    currentLevel,
    currentStreak,
    isEnabled: gamificationEnabled
  } = useGamification()

  // Fetch leaderboard data
  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true)
      try {
        const response = await fetch(`/api/leaderboard?page=${page}&limit=20`)
        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard')
        }
        const data: LeaderboardResponse = await response.json()
        setLeaderboardData(data.entries)
        setPagination(data.pagination)
        setMetadata(data.metadata)
      } catch (error) {
        console.error('[Leaderboard] Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchLeaderboard()
  }, [page])

  // Fetch user rank if authenticated
  useEffect(() => {
    async function fetchUserRank() {
      if (!user?.uid) return
      try {
        const response = await fetch('/api/leaderboard/user-rank')
        if (response.ok) {
          const data: UserRankResponse = await response.json()
          setUserRank(data.rank)
        }
      } catch (error) {
        console.error('[Leaderboard] Error fetching user rank:', error)
      }
    }
    fetchUserRank()
  }, [user?.uid])

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
                  Top 100 learners • Updates daily at midnight UTC
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
                      {userRank ? `#${userRank}` : user ? '...' : 'N/A'}
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
                      {totalXP}
                    </div>
                    <div className="text-xs sm:text-sm opacity-75">{strings.leaderboard?.totalXP || 'Total XP'}</div>
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
                      {currentStreak}
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

        {/* Main Leaderboard */}
        <div className="relative min-h-[400px]">
          {loading ? (
            <LoadingOverlay
              isLoading={true}
              message={strings.common?.loading || "Loading leaderboard..."}
              showDoshi={true}
              fullScreen={false}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
            {activeTab === 'global' && (
              <Card className="overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {pagination ? `Showing ${leaderboardData.length} of Top ${pagination.total}` : 'Leaderboard'}
                    </h2>
                    {metadata && (
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {metadata.totalPlayers} total players
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {leaderboardData.map((entry) => {
                      const isCurrentUser = entry.userId === user?.uid
                      const isTopThree = entry.rank <= 3
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
                              <Medal className={`w-6 h-6 mx-auto ${medalColors[entry.rank - 1]}`} />
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
                              {entry.totalXP} XP • Level {entry.currentLevel}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-orange-500" />
                            <span className="text-sm font-semibold">{entry.currentStreak}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Pagination Controls */}
                  {pagination && pagination.totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-dark-700">
                      <Button
                        variant="outline"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="flex items-center gap-2"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => setPage(p => p + 1)}
                        disabled={!pagination.hasMore}
                        className="flex items-center gap-2"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
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
          )}
        </div>
      </div>
    </div>
  )
}
