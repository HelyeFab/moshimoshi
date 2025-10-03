'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useGamification } from '@/hooks/useGamification'
import { useI18n } from '@/i18n/I18nContext'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/layout/PageHeader'
import { LoadingOverlay } from '@/components/ui/Loading'
import { cn } from '@/utils/cn'
import achievementsConfig from '@/config/gamification/achievements.json'

// Achievement rarity colors
const rarityColors = {
  common: 'border-gray-400 bg-gray-100 dark:bg-gray-800',
  uncommon: 'border-green-400 bg-green-100 dark:bg-green-900/30',
  rare: 'border-blue-400 bg-blue-100 dark:bg-blue-900/30',
  epic: 'border-purple-400 bg-purple-100 dark:bg-purple-900/30',
  legendary: 'border-yellow-400 bg-yellow-100 dark:bg-yellow-900/30'
}

// Category type
type AchievementCategory = 'all' | 'progress' | 'streak' | 'accuracy' | 'speed' | 'special'

export default function AchievementsPage() {
  const { user, loading: authLoading } = useAuth()
  const { t, strings } = useI18n()
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory>('all')

  // Get real gamification data
  const {
    unlockedAchievements,
    loading: gamificationLoading,
    isEnabled: gamificationEnabled
  } = useGamification()

  // Load achievements from config and map unlock status
  const allAchievements = useMemo(() => {
    return achievementsConfig.achievements.map(achievement => ({
      ...achievement,
      unlocked: unlockedAchievements.includes(achievement.id)
    }))
  }, [unlockedAchievements])

  // Filter by category
  const filteredAchievements = useMemo(() => {
    if (selectedCategory === 'all') return allAchievements
    return allAchievements.filter(a => a.category === selectedCategory)
  }, [allAchievements, selectedCategory])

  // Calculate real stats
  const stats = useMemo(() => {
    const unlockedList = allAchievements.filter(a => a.unlocked)
    return {
      unlockedCount: unlockedList.length,
      totalCount: allAchievements.length,
      totalPoints: unlockedList.reduce((sum, a) => sum + a.points, 0),
      completionPercentage: Math.round((unlockedList.length / allAchievements.length) * 100)
    }
  }, [allAchievements])

  // Get unlocked achievements list for separate section
  const unlockedAchievementsList = useMemo(() => {
    return allAchievements.filter(a => a.unlocked)
  }, [allAchievements])

  // Categories for filter buttons
  const categories: { value: AchievementCategory; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'progress', label: 'Progress' },
    { value: 'streak', label: 'Streak' },
    { value: 'accuracy', label: 'Accuracy' },
    { value: 'speed', label: 'Speed' },
    { value: 'special', label: 'Special' }
  ]

  if (authLoading || gamificationLoading) {
    return (
      <LoadingOverlay
        isLoading={true}
        message={strings.common?.loading || "Loading achievements..."}
        showDoshi={true}
        fullScreen={true}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-background-lighter to-background-accent dark:from-dark-900 dark:via-dark-800 dark:to-dark-850">
      {/* Standard Navbar */}
      <Navbar
        user={user}
        showUserMenu={true}
        backLink="/dashboard"
      />

      {/* Page Header */}
      <PageHeader
        title="Achievements"
        description="Track your progress and unlock rewards"
        mascot="doshi"
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Gamification Disabled Message */}
        {!gamificationEnabled && (
          <div className="mb-8 text-center bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
            <p className="text-lg text-gray-700 dark:text-gray-300">
              Gamification system is currently disabled.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Enable it in your environment configuration to track achievements.
            </p>
          </div>
        )}

        {/* Stats Summary */}
        <div className="mb-8 text-center">
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {stats.unlockedCount}/{stats.totalCount} unlocked • {stats.totalPoints} points • {stats.completionPercentage}% complete
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {categories.map(category => (
            <button
              key={category.value}
              onClick={() => setSelectedCategory(category.value)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all',
                selectedCategory === category.value
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-dark-600'
              )}
            >
              {category.label}
            </button>
          ))}
        </div>

        {/* Achievements Grid */}
        <div className="bg-gray-900/50 dark:bg-dark-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 dark:border-dark-600">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {filteredAchievements.map(achievement => {
              const isUnlocked = achievement.unlocked

              return (
                <div
                  key={achievement.id}
                  className={cn(
                    'relative group cursor-pointer transition-all duration-300',
                    'rounded-xl p-4 border-2',
                    isUnlocked
                      ? cn(rarityColors[achievement.rarity], 'scale-100 opacity-100')
                      : 'border-gray-600 bg-gray-800/50 opacity-50 grayscale hover:opacity-70'
                  )}
                >
                  {/* Achievement Icon */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="text-4xl mb-2">
                      {achievement.icon}
                    </div>

                    {/* Points */}
                    <div className="text-sm font-bold text-gray-300">
                      {achievement.points}
                    </div>
                  </div>

                  {/* Unlocked indicator */}
                  {isUnlocked && (
                    <div className="absolute -top-2 -right-2">
                      <div className="bg-green-500 rounded-full p-1">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Hover tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                      <div className="font-bold">{achievement.name}</div>
                      <div className="text-gray-400">{achievement.description}</div>
                      <div className="text-gray-400">{achievement.points} points</div>
                    </div>
                    <div className="w-2 h-2 bg-gray-900 transform rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1"></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Your Unlocked Achievements Section */}
        {gamificationEnabled && unlockedAchievementsList.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
              Your Unlocked Achievements
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {unlockedAchievementsList.map(achievement => (
                <div
                  key={achievement.id}
                  className={cn(
                    'p-4 rounded-xl border-2 flex items-center gap-4',
                    rarityColors[achievement.rarity as keyof typeof rarityColors]
                  )}
                >
                  <div className="text-4xl">{achievement.icon}</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100">
                      {achievement.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {achievement.description}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {achievement.points} points • {achievement.category}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
