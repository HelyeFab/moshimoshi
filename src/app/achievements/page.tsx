'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n/I18nContext'
import { useAchievementStore } from '@/stores/achievement-store'
import Navbar from '@/components/layout/Navbar'
import LearningPageHeader from '@/components/learn/LearningPageHeader'
import { LoadingOverlay } from '@/components/ui/Loading'
import { Trophy, Target, Flame, Zap, Star, Award, TrendingUp, Clock, BookOpen, Sparkles } from 'lucide-react'
import { cn } from '@/utils/cn'

// Achievement icons mapping
const achievementIcons: Record<string, any> = {
  'first-step': '🏃',
  'sharpshooter': '🎯',
  'consistent-performer': '🎯',
  'speed-demon': '⚡',
  'perfectionist': '💯',
  'night-owl': '🦉',
  'early-bird': '🌅',
  'marathon-runner': '🏃‍♂️',
  'quick-learner': '📚',
  'master-reviewer': '🎓',
  'streak-warrior': '🔥',
  'accuracy-ace': '🎯',
  'vocabulary-victor': '📖',
  'kanji-conqueror': '🉐',
  'hiragana-hero': 'あ',
  'katakana-king': 'カ',
  'daily-devotee': '📅',
  'weekend-warrior': '⚔️',
  'study-sensei': '🧘',
  'review-rookie': '🌱'
}

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

  // Achievement store
  const {
    achievements,
    userAchievements,
    isInitialized,
    isLoading,
    initialize: initializeAchievements,
    loadAchievements,
    getUnlockedAchievements,
    getTotalPoints,
    getCompletionPercentage
  } = useAchievementStore()

  // Initialize achievements
  useEffect(() => {
    if (user?.uid && !isInitialized) {
      initializeAchievements(user.uid, true).then(() => {
        loadAchievements()
      })
    }
  }, [user?.uid, isInitialized, initializeAchievements, loadAchievements])

  // Get unlocked achievement IDs
  const unlockedIds = userAchievements?.unlocked || new Set<string>()
  const unlockedCount = unlockedIds.size
  const totalPoints = getTotalPoints()
  const completionPercentage = Math.round(getCompletionPercentage())

  // Define all achievements (this would normally come from the achievement system)
  const allAchievements = [
    // Row 1
    { id: 'first-step', name: 'First Step', icon: '🏃', points: 10, category: 'progress', rarity: 'common' },
    { id: 'study-starter', name: 'Study Starter', icon: '📚', points: 25, category: 'progress', rarity: 'uncommon' },
    { id: 'sharpshooter', name: 'Sharpshooter', icon: '🎯', points: 50, category: 'accuracy', rarity: 'rare' },
    { id: 'daily-devotee', name: 'Daily Devotee', icon: '🇯🇵', points: 30, category: 'streak', rarity: 'uncommon' },
    { id: 'quick-learner', name: 'Quick Learner', icon: '📘', points: 30, category: 'speed', rarity: 'uncommon' },
    { id: 'kanji-novice', name: 'Kanji Novice', icon: '月', points: 20, category: 'progress', rarity: 'common' },
    { id: 'vocab-builder', name: 'Vocab Builder', icon: '📝', points: 50, category: 'progress', rarity: 'rare' },
    { id: 'streak-starter', name: 'Streak Starter', icon: '🔥', points: 20, category: 'streak', rarity: 'common' },

    // Row 2
    { id: 'speed-demon', name: 'Speed Demon', icon: '⚡', points: 50, category: 'speed', rarity: 'rare' },
    { id: 'perfectionist', name: 'Perfectionist', icon: '💯', points: 100, category: 'accuracy', rarity: 'epic' },
    { id: 'consistent-performer', name: 'Consistent', icon: '🎯', points: 15, category: 'accuracy', rarity: 'common' },
    { id: 'review-master', name: 'Review Master', icon: '⭐', points: 30, category: 'special', rarity: 'uncommon' }
  ]

  // Filter achievements by category
  const filteredAchievements = selectedCategory === 'all'
    ? allAchievements
    : allAchievements.filter(a => a.category === selectedCategory)

  // Categories for filter buttons
  const categories: { value: AchievementCategory; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'progress', label: 'Progress' },
    { value: 'streak', label: 'Streak' },
    { value: 'accuracy', label: 'Accuracy' },
    { value: 'speed', label: 'Speed' },
    { value: 'special', label: 'Special' }
  ]

  if (authLoading || isLoading) {
    return (
      <LoadingOverlay
        isLoading={true}
        message="Loading achievements..."
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

      {/* Learning Page Header - WITHOUT the 3 optional props */}
      <LearningPageHeader
        title="Achievements"
        description="Track your progress and unlock rewards"
        mascot="doshi"
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Stats Summary */}
        <div className="mb-8 text-center">
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {unlockedCount}/20 unlocked • {totalPoints} points • {completionPercentage}% complete
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
              const isUnlocked = unlockedIds.has(achievement.id)

              return (
                <div
                  key={achievement.id}
                  className={cn(
                    'relative group cursor-pointer transition-all duration-300',
                    'rounded-xl p-4 border-2',
                    isUnlocked
                      ? cn(rarityColors[achievement.rarity as keyof typeof rarityColors], 'scale-100 opacity-100')
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
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
            Your Unlocked Achievements
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {['first-step', 'sharpshooter', 'consistent-performer'].map(achievementId => {
              const achievement = allAchievements.find(a => a.id === achievementId)
              if (!achievement) return null

              return (
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
                      {achievement.points} points • {achievement.category}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}