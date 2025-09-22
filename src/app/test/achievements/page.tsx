'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Navbar from '@/components/layout/Navbar'
import AchievementDisplay from '@/components/dashboard/AchievementDisplay'
import AchievementBadges from '@/components/profile/AchievementBadges'
import AchievementLeaderboard from '@/components/leaderboard/AchievementLeaderboard'
import AchievementToast from '@/components/notifications/AchievementToast'
import LevelProgress from '@/components/profile/LevelProgress'
import { useAchievementStore } from '@/stores/achievement-store'
import { useI18n } from '@/i18n/I18nContext'
import { xpSystem } from '@/lib/gamification/xp-system'

export default function AchievementsTestPage() {
  const { user } = useAuth()
  const { strings } = useI18n()
  const [activeTab, setActiveTab] = useState<'overview' | 'badges' | 'leaderboard' | 'test'>('overview')
  const [testXP, setTestXP] = useState(2500)

  const {
    achievements,
    userAchievements,
    initialize,
    isInitialized,
    showAchievementToast,
    unlockAchievement,
    getTotalPoints
  } = useAchievementStore()

  // Initialize achievement system
  useEffect(() => {
    if (user?.uid && !isInitialized) {
      initialize(user.uid, false) // You might want to check premium status differently
    }
  }, [user, isInitialized, initialize])

  // Test functions
  const triggerTestAchievement = () => {
    // Find a random locked achievement to unlock
    const lockedAchievements = achievements.filter(
      a => !userAchievements?.unlocked.has(a.id)
    )

    if (lockedAchievements.length > 0) {
      const randomAchievement = lockedAchievements[
        Math.floor(Math.random() * lockedAchievements.length)
      ]

      // Simulate unlocking
      showAchievementToast({
        ...randomAchievement,
        unlockedAt: Date.now()
      })
    } else {
      alert('All achievements already unlocked!')
    }
  }

  const addTestXP = (amount: number) => {
    setTestXP(prev => prev + amount)
  }

  const resetTestData = () => {
    setTestXP(0)
    // You could add more reset logic here
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'badges', label: 'Badges' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'test', label: 'Test Controls' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-dark-900 dark:via-dark-800 dark:to-dark-900">
      <Navbar />

      {/* Achievement Toasts */}
      <AchievementToast position="top-right" />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Achievement System Test Page
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Test and preview all achievement system components
          </p>
        </motion.div>

        {/* User Info Bar */}
        {user && (
          <Card className="mb-6 p-4 bg-gradient-to-r from-primary-100 to-secondary-100 dark:from-primary-900/20 dark:to-secondary-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-xl">
                  {user.displayName?.[0] || user.email?.[0] || 'U'}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {user.displayName || 'Test User'}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {user.email}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {getTotalPoints()}
                  </div>
                  <div className="text-xs text-gray-500">Total Points</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {userAchievements?.unlocked.size || 0}
                  </div>
                  <div className="text-xs text-gray-500">Achievements</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-500">
                    {testXP}
                  </div>
                  <div className="text-xs text-gray-500">Test XP</div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Tab Navigation */}
        <div className="flex space-x-2 mb-6">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'outline'}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex-1 sm:flex-initial"
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Level Progress */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <LevelProgress
                  userId={user?.uid || 'test'}
                  totalXP={testXP}
                  showDetails={true}
                  onLevelUp={(level) => {
                    console.log('Level up!', level)
                    alert(`Congratulations! You reached level ${level}!`)
                  }}
                />
              </motion.div>

              {/* Main Achievement Display */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <AchievementDisplay
                  showTitle={true}
                  compact={false}
                />
              </motion.div>
            </>
          )}

          {activeTab === 'badges' && (
            <>
              {/* Badge Display Variations */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-semibold mb-3">Large Badges (Profile View)</h2>
                  <AchievementBadges
                    userId={user?.uid || 'test'}
                    maxBadges={8}
                    size="large"
                    showEmpty={true}
                    showProgress={true}
                  />
                </div>

                <div>
                  <h2 className="text-xl font-semibold mb-3">Medium Badges (Default)</h2>
                  <AchievementBadges
                    userId={user?.uid || 'test'}
                    maxBadges={6}
                    size="medium"
                    showEmpty={true}
                    showProgress={true}
                  />
                </div>

                <div>
                  <h2 className="text-xl font-semibold mb-3">Small Badges (Compact)</h2>
                  <AchievementBadges
                    userId={user?.uid || 'test'}
                    maxBadges={10}
                    size="small"
                    showEmpty={false}
                    showProgress={false}
                  />
                </div>
              </motion.div>
            </>
          )}

          {activeTab === 'leaderboard' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AchievementLeaderboard
                currentUserId={user?.uid}
                timeframe="allTime"
                limit={10}
                showCurrentUserAlways={true}
              />
            </motion.div>
          )}

          {activeTab === 'test' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Test Controls */}
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Test Controls</h2>

                <div className="space-y-4">
                  {/* Achievement Tests */}
                  <div>
                    <h3 className="font-medium mb-2">Achievement Actions</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={triggerTestAchievement}
                        variant="outline"
                      >
                        Trigger Random Achievement
                      </Button>
                      <Button
                        onClick={() => {
                          const legendaryAchievement = achievements.find(
                            a => a.rarity === 'legendary' && !userAchievements?.unlocked.has(a.id)
                          )
                          if (legendaryAchievement) {
                            showAchievementToast({
                              ...legendaryAchievement,
                              unlockedAt: Date.now()
                            })
                          }
                        }}
                        variant="outline"
                        className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                      >
                        Trigger Legendary Achievement
                      </Button>
                    </div>
                  </div>

                  {/* XP Tests */}
                  <div>
                    <h3 className="font-medium mb-2">XP Actions</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => addTestXP(100)}
                        variant="outline"
                      >
                        Add 100 XP
                      </Button>
                      <Button
                        onClick={() => addTestXP(500)}
                        variant="outline"
                      >
                        Add 500 XP
                      </Button>
                      <Button
                        onClick={() => addTestXP(1000)}
                        variant="outline"
                      >
                        Add 1000 XP
                      </Button>
                      <Button
                        onClick={() => {
                          const xpForNextLevel = xpSystem.calculateXPForLevel(
                            xpSystem.getLevelFromXP(testXP) + 1
                          )
                          setTestXP(xpForNextLevel)
                        }}
                        variant="outline"
                        className="border-primary-500 text-primary-600"
                      >
                        Jump to Next Level
                      </Button>
                    </div>
                  </div>

                  {/* Reset */}
                  <div>
                    <h3 className="font-medium mb-2">Reset Options</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={resetTestData}
                        variant="destructive"
                      >
                        Reset Test Data
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Achievement Statistics */}
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Statistics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-2xl font-bold">{achievements.length}</div>
                    <div className="text-sm text-gray-500">Total Achievements</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-2xl font-bold">{userAchievements?.unlocked.size || 0}</div>
                    <div className="text-sm text-gray-500">Unlocked</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-2xl font-bold">
                      {userAchievements?.statistics?.percentageComplete?.toFixed(0) || 0}%
                    </div>
                    <div className="text-sm text-gray-500">Complete</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-2xl font-bold">{getTotalPoints()}</div>
                    <div className="text-sm text-gray-500">Points</div>
                  </div>
                </div>

                {/* Rarity Breakdown */}
                <div className="mt-4 pt-4 border-t">
                  <h3 className="font-medium mb-2">Rarity Breakdown</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {['legendary', 'epic', 'rare', 'uncommon', 'common'].map(rarity => (
                      <div key={rarity} className="text-center">
                        <div className="text-lg font-bold">
                          {userAchievements?.statistics?.byRarity?.get(rarity) || 0}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">{rarity}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}