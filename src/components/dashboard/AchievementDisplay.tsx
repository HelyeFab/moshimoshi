'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAchievementStore, Achievement } from '@/stores/achievement-store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Tooltip from '@/components/ui/Tooltip'
import { useI18n } from '@/i18n/I18nContext'

interface AchievementDisplayProps {
  showTitle?: boolean
  maxItems?: number
  filterCategory?: string
  compact?: boolean
}

interface AchievementCardProps {
  achievement: Achievement
  isUnlocked: boolean
  onClick?: () => void
  compact?: boolean
}

const AchievementCard = ({ achievement, isUnlocked, onClick, compact = false }: AchievementCardProps) => {
  const [isHovered, setIsHovered] = useState(false)
  
  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'from-gray-400 to-gray-600'
      case 'uncommon': return 'from-green-400 to-green-600'
      case 'rare': return 'from-blue-400 to-blue-600'
      case 'epic': return 'from-purple-400 to-purple-600'
      case 'legendary': return 'from-yellow-400 to-orange-500'
      default: return 'from-gray-400 to-gray-600'
    }
  }
  
  const getRarityBorder = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'border-gray-300 dark:border-gray-600'
      case 'uncommon': return 'border-green-300 dark:border-green-600'
      case 'rare': return 'border-blue-300 dark:border-blue-600'
      case 'epic': return 'border-purple-300 dark:border-purple-600'
      case 'legendary': return 'border-yellow-300 dark:border-orange-500'
      default: return 'border-gray-300 dark:border-gray-600'
    }
  }
  
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return null
    return new Date(timestamp).toLocaleDateString()
  }
  
  const getProgressPercentage = () => {
    if (!achievement.progress || !achievement.maxProgress) return 0
    return Math.min(100, (achievement.progress / achievement.maxProgress) * 100)
  }
  
  const cardSize = compact ? 'w-16 h-16' : 'w-24 h-24'
  const iconSize = compact ? 'text-xl' : 'text-3xl'
  
  return (
    <motion.div
      className={`relative group cursor-pointer ${compact ? 'p-2' : 'p-3'}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
    >
      <Card
        className={`
          ${cardSize} relative overflow-hidden transition-all duration-300
          ${isUnlocked 
            ? `bg-gradient-to-br ${getRarityColor(achievement.rarity)} text-white shadow-lg` 
            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
          }
          ${getRarityBorder(achievement.rarity)}
          ${isHovered ? 'shadow-xl ring-2 ring-primary-300' : ''}
        `}
      >
        {/* Rarity Glow Effect */}
        {isUnlocked && (
          <motion.div
            className={`absolute inset-0 bg-gradient-to-br ${getRarityColor(achievement.rarity)} opacity-20`}
            animate={{
              opacity: isHovered ? 0.4 : 0.2,
            }}
            transition={{ duration: 0.3 }}
          />
        )}
        
        {/* Achievement Icon */}
        <div className="relative z-10 w-full h-full flex items-center justify-center">
          <span className={`${iconSize} ${isUnlocked ? 'filter drop-shadow-sm' : 'opacity-50'}`}>
            {achievement.icon}
          </span>
        </div>
        
        {/* Progress Bar for Progressive Achievements */}
        {!isUnlocked && achievement.progress && achievement.maxProgress && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-300 dark:bg-gray-700">
            <motion.div
              className="h-full bg-primary-500"
              initial={{ width: 0 }}
              animate={{ width: `${getProgressPercentage()}%` }}
              transition={{ duration: 0.5, delay: 0.2 }}
            />
          </div>
        )}
        
        {/* Unlock Date Badge */}
        {isUnlocked && achievement.unlockedAt && !compact && (
          <div className="absolute top-1 right-1 bg-black/20 text-white text-xs px-1 py-0.5 rounded">
            {formatDate(achievement.unlockedAt)}
          </div>
        )}
        
        {/* Points Badge */}
        {!compact && (
          <div className={`
            absolute bottom-1 right-1 text-xs px-1 py-0.5 rounded
            ${isUnlocked 
              ? 'bg-white/20 text-white' 
              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }
          `}>
            {achievement.points}
          </div>
        )}
        
        {/* Unlock Animation */}
        <AnimatePresence>
          {isUnlocked && achievement.unlockedAt && Date.now() - achievement.unlockedAt < 5000 && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Sparkle Effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-yellow-200/50 to-orange-300/50"
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0.8, 1.2, 1],
                }}
                transition={{
                  duration: 1.5,
                  repeat: 2,
                  ease: "easeInOut"
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
      
      {/* Tooltip */}
      <Tooltip
        content={
          <div className="text-center">
            <div className="font-bold text-white">{achievement.name}</div>
            <div className="text-sm text-gray-200 mt-1">{achievement.description}</div>
            <div className="text-xs text-gray-300 mt-2">
              {achievement.points} points • {achievement.rarity}
            </div>
            {!isUnlocked && achievement.progress && achievement.maxProgress && (
              <div className="text-xs text-gray-300 mt-1">
                Progress: {achievement.progress}/{achievement.maxProgress} ({getProgressPercentage().toFixed(0)}%)
              </div>
            )}
            {isUnlocked && achievement.unlockedAt && (
              <div className="text-xs text-gray-300 mt-1">
                Unlocked: {formatDate(achievement.unlockedAt)}
              </div>
            )}
          </div>
        }
      >
        <div className="w-full h-full" />
      </Tooltip>
    </motion.div>
  )
}

export default function AchievementDisplay({ 
  showTitle = true, 
  maxItems, 
  filterCategory,
  compact = false 
}: AchievementDisplayProps) {
  const {
    achievements,
    userAchievements,
    isLoading,
    error,
    getUnlockedAchievements,
    getLockedAchievements,
    getAchievementsByCategory,
    getTotalPoints,
    getCompletionPercentage,
    clearError
  } = useAchievementStore()
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null)
  
  // Get achievements to display
  const getDisplayAchievements = () => {
    let filtered = achievements
    
    if (filterCategory) {
      filtered = getAchievementsByCategory(filterCategory)
    } else if (selectedCategory !== 'all') {
      filtered = getAchievementsByCategory(selectedCategory)
    }
    
    if (maxItems) {
      filtered = filtered.slice(0, maxItems)
    }
    
    return filtered
  }
  
  const displayAchievements = getDisplayAchievements()
  const unlockedAchievements = getUnlockedAchievements()
  const { strings } = useI18n()
  const categories = ['all', 'progress', 'streak', 'accuracy', 'speed', 'special']
  
  if (error) {
    return (
      <Card className="p-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
        <div className="text-red-600 dark:text-red-400 text-center">
          <div className="text-lg font-semibold mb-2">Error Loading Achievements</div>
          <div className="text-sm mb-4">{error}</div>
          <Button onClick={clearError} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      </Card>
    )
  }
  
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center space-x-2">
          <motion.div
            className="w-3 h-3 bg-primary-500 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />
          <motion.div
            className="w-3 h-3 bg-primary-500 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
          />
          <motion.div
            className="w-3 h-3 bg-primary-500 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
          />
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading achievements...</span>
        </div>
      </Card>
    )
  }
  
  return (
    <div className="space-y-6">
      {showTitle && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {strings.dashboard?.achievements?.title || 'Achievements'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {unlockedAchievements.length}/{achievements.length} {strings.dashboard?.achievements?.unlocked || 'unlocked'} • {getTotalPoints()} {strings.dashboard?.achievements?.points || 'points'} • {getCompletionPercentage().toFixed(0)}% {strings.dashboard?.achievements?.complete || 'complete'}
            </p>
          </div>
          
          {/* Category Filter */}
          {!filterCategory && !compact && (
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="capitalize"
                >
                  {strings.dashboard?.achievements?.categories?.[category] || category}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Achievement Grid */}
      <Card className="p-6">
        {displayAchievements.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <div className="text-4xl mb-4">🎯</div>
            <div className="text-lg font-medium mb-2">No achievements found</div>
            <div className="text-sm">
              {filterCategory || selectedCategory !== 'all' 
                ? 'Try selecting a different category' 
                : 'Start learning to unlock your first achievement!'
              }
            </div>
          </div>
        ) : (
          <motion.div
            className={`
              grid gap-4
              ${compact 
                ? 'grid-cols-6 sm:grid-cols-8 md:grid-cols-10' 
                : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8'
              }
            `}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {displayAchievements.map((achievement, index) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <AchievementCard
                  achievement={achievement}
                  isUnlocked={userAchievements?.unlocked.has(achievement.id) || false}
                  onClick={() => setSelectedAchievement(achievement)}
                  compact={compact}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </Card>
      
      {/* Achievement Detail Modal */}
      <AnimatePresence>
        {selectedAchievement && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedAchievement(null)}
          >
            <motion.div
              className="bg-white dark:bg-dark-800 rounded-2xl p-6 max-w-md w-full shadow-xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="text-6xl mb-4">{selectedAchievement.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {selectedAchievement.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {selectedAchievement.description}
                </p>
                
                <div className="flex items-center justify-center space-x-6 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      {selectedAchievement.points}
                    </div>
                    <div className="text-gray-500">Points</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 capitalize">
                      {selectedAchievement.rarity}
                    </div>
                    <div className="text-gray-500">Rarity</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 capitalize">
                      {selectedAchievement.category}
                    </div>
                    <div className="text-gray-500">Category</div>
                  </div>
                </div>
                
                {userAchievements?.unlocked.has(selectedAchievement.id) ? (
                  <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                    <div className="text-green-600 dark:text-green-400 font-medium">
                      ✓ Unlocked
                    </div>
                    {selectedAchievement.unlockedAt && (
                      <div className="text-green-600 dark:text-green-400 text-xs mt-1">
                        {new Date(selectedAchievement.unlockedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <div className="text-gray-600 dark:text-gray-400">
                      🔒 Locked
                    </div>
                    {selectedAchievement.progress && selectedAchievement.maxProgress && (
                      <div className="mt-2">
                        <div className="text-xs text-gray-500 mb-1">
                          Progress: {selectedAchievement.progress}/{selectedAchievement.maxProgress}
                        </div>
                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                          <div
                            className="h-full bg-primary-500 rounded-full"
                            style={{ 
                              width: `${(selectedAchievement.progress / selectedAchievement.maxProgress) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <Button
                  onClick={() => setSelectedAchievement(null)}
                  className="mt-6 w-full"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}