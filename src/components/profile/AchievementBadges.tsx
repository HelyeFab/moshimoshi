'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAchievementStore, Achievement } from '@/stores/achievement-store'
import { Card } from '@/components/ui/card'
import Tooltip from '@/components/ui/Tooltip'
import { useI18n } from '@/i18n/I18nContext'

interface AchievementBadgesProps {
  userId: string
  maxBadges?: number
  size?: 'small' | 'medium' | 'large'
  showEmpty?: boolean
  showProgress?: boolean
  layout?: 'horizontal' | 'grid'
}

interface BadgeProps {
  achievement?: Achievement
  isUnlocked: boolean
  size: 'small' | 'medium' | 'large'
  showProgress?: boolean
  isEmpty?: boolean
  index: number
}

const Badge = ({ achievement, isUnlocked, size, showProgress = false, isEmpty = false, index }: BadgeProps) => {
  const sizeClasses = {
    small: 'w-12 h-12 text-lg',
    medium: 'w-16 h-16 text-2xl',
    large: 'w-20 h-20 text-3xl'
  }

  const getRarityGradient = (rarity: string) => {
    const gradients = {
      common: 'from-gray-400 to-gray-600',
      uncommon: 'from-green-400 to-green-600',
      rare: 'from-blue-400 to-blue-600',
      epic: 'from-purple-400 to-purple-600',
      legendary: 'from-yellow-400 via-orange-400 to-red-400'
    }
    return gradients[rarity as keyof typeof gradients] || gradients.common
  }

  const getRarityRing = (rarity: string) => {
    const rings = {
      common: 'ring-gray-300',
      uncommon: 'ring-green-400',
      rare: 'ring-blue-400',
      epic: 'ring-purple-400',
      legendary: 'ring-yellow-400'
    }
    return rings[rarity as keyof typeof rings] || rings.common
  }

  // Empty badge slot
  if (isEmpty || !achievement) {
    return (
      <div className={`
        ${sizeClasses[size]}
        rounded-full border-2 border-dashed border-gray-300 dark:border-gray-700
        flex items-center justify-center
        bg-gray-50 dark:bg-gray-900
        opacity-50
      `}>
        <span className="text-gray-400 dark:text-gray-600">?</span>
      </div>
    )
  }

  const progress = achievement.progress && achievement.maxProgress
    ? (achievement.progress / achievement.maxProgress) * 100
    : 0

  return (
    <Tooltip
      content={
        <div className="text-center">
          <div className="font-bold">{achievement.name}</div>
          <div className="text-sm mt-1 opacity-90">{achievement.description}</div>
          <div className="text-xs mt-2">
            {achievement.points} points • {achievement.rarity}
          </div>
          {!isUnlocked && showProgress && progress > 0 && (
            <div className="text-xs mt-1">Progress: {progress.toFixed(0)}%</div>
          )}
        </div>
      }
    >
      <motion.div
        className="relative group cursor-pointer"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: "spring",
          duration: 0.5,
          delay: index * 0.05,
          bounce: 0.4
        }}
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className={`
          ${sizeClasses[size]}
          rounded-full relative overflow-hidden
          ${isUnlocked
            ? `bg-gradient-to-br ${getRarityGradient(achievement.rarity)} text-white shadow-lg ring-2 ${getRarityRing(achievement.rarity)}`
            : 'bg-gray-200 dark:bg-gray-800 text-gray-400'
          }
          transition-all duration-300
          flex items-center justify-center
        `}>
          {/* Shimmer effect for legendary */}
          {isUnlocked && achievement.rarity === 'legendary' && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />
          )}

          {/* Glow effect for epic */}
          {isUnlocked && achievement.rarity === 'epic' && (
            <motion.div
              className="absolute inset-0 bg-purple-400/20"
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}

          {/* Icon */}
          <span className="relative z-10">{achievement.icon}</span>

          {/* Progress ring for locked achievements */}
          {!isUnlocked && showProgress && progress > 0 && (
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r="48%"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={`${progress * 3.14} 314`}
                className="text-primary-500 opacity-50"
              />
            </svg>
          )}

          {/* Locked overlay */}
          {!isUnlocked && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
              <span className="text-xs">🔒</span>
            </div>
          )}
        </div>

        {/* Points indicator */}
        {isUnlocked && (
          <motion.div
            className="absolute -bottom-1 -right-1 bg-white dark:bg-dark-800 rounded-full px-1 py-0.5 text-xs font-bold shadow-md"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.05 + 0.3 }}
          >
            <span className={`bg-gradient-to-r ${getRarityGradient(achievement.rarity)} bg-clip-text text-transparent`}>
              {achievement.points}
            </span>
          </motion.div>
        )}
      </motion.div>
    </Tooltip>
  )
}

export default function AchievementBadges({
  userId,
  maxBadges = 8,
  size = 'medium',
  showEmpty = true,
  showProgress = true,
  layout = 'horizontal'
}: AchievementBadgesProps) {
  const {
    achievements,
    userAchievements,
    getUnlockedAchievements,
    getNextAchievable,
    initialize,
    isInitialized
  } = useAchievementStore()

  const { strings } = useI18n()
  const [displayAchievements, setDisplayAchievements] = useState<(Achievement | null)[]>([])

  // Initialize if needed
  useEffect(() => {
    if (!isInitialized && userId) {
      initialize(userId)
    }
  }, [userId, isInitialized, initialize])

  // Select achievements to display
  useEffect(() => {
    if (!userAchievements) return

    const unlocked = getUnlockedAchievements()
    const nextAchievable = getNextAchievable(maxBadges)

    // Prioritize display:
    // 1. Legendary/Epic unlocked achievements
    // 2. Other unlocked achievements
    // 3. Next achievable (close to completion)
    // 4. Empty slots

    const prioritized: (Achievement | null)[] = []

    // Add legendary/epic first
    const legendaryEpic = unlocked
      .filter(a => a.rarity === 'legendary' || a.rarity === 'epic')
      .sort((a, b) => {
        const rarityOrder = { legendary: 2, epic: 1 }
        return (rarityOrder[b.rarity as keyof typeof rarityOrder] || 0) -
               (rarityOrder[a.rarity as keyof typeof rarityOrder] || 0)
      })

    prioritized.push(...legendaryEpic)

    // Add other unlocked achievements
    const otherUnlocked = unlocked
      .filter(a => a.rarity !== 'legendary' && a.rarity !== 'epic')
      .sort((a, b) => b.points - a.points)

    prioritized.push(...otherUnlocked)

    // Add next achievable if room
    if (prioritized.length < maxBadges) {
      const remaining = maxBadges - prioritized.length
      prioritized.push(...nextAchievable.slice(0, remaining))
    }

    // Fill with empty slots if showEmpty
    if (showEmpty) {
      while (prioritized.length < maxBadges) {
        prioritized.push(null)
      }
    }

    // Limit to maxBadges
    setDisplayAchievements(prioritized.slice(0, maxBadges))
  }, [achievements, userAchievements, maxBadges, showEmpty])

  const layoutClasses = layout === 'grid'
    ? `grid grid-cols-4 gap-2`
    : `flex flex-wrap gap-2`

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {strings.profile?.achievements?.title || 'Achievement Badges'}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {getUnlockedAchievements().length} / {achievements.length} unlocked
        </p>
      </div>

      <div className={layoutClasses}>
        <AnimatePresence mode="popLayout">
          {displayAchievements.map((achievement, index) => (
            <motion.div
              key={achievement?.id || `empty-${index}`}
              layout
            >
              <Badge
                achievement={achievement || undefined}
                isUnlocked={achievement ? userAchievements?.unlocked.has(achievement.id) || false : false}
                size={size}
                showProgress={showProgress}
                isEmpty={!achievement}
                index={index}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Summary Stats */}
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between text-sm">
          <div className="text-center">
            <div className="font-semibold text-gray-900 dark:text-gray-100">
              {userAchievements?.totalPoints || 0}
            </div>
            <div className="text-xs text-gray-500">{strings.profile?.achievements?.totalPoints || 'Total Points'}</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-900 dark:text-gray-100">
              {userAchievements?.statistics?.byRarity?.get('legendary') || 0}
            </div>
            <div className="text-xs text-gray-500">{strings.profile?.achievements?.legendary || 'Legendary'}</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-900 dark:text-gray-100">
              {userAchievements?.statistics?.byRarity?.get('epic') || 0}
            </div>
            <div className="text-xs text-gray-500">{strings.profile?.achievements?.epic || 'Epic'}</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-900 dark:text-gray-100">
              {userAchievements?.statistics?.percentageComplete?.toFixed(0) || 0}%
            </div>
            <div className="text-xs text-gray-500">{strings.profile?.achievements?.complete || 'Complete'}</div>
          </div>
        </div>
      </div>
    </Card>
  )
}