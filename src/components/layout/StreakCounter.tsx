'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSubscription } from '@/hooks/useSubscription'
import { useReviewStats } from '@/hooks/useReviewStats'
import Tooltip from '@/components/ui/Tooltip'
import { differenceInDays, parseISO, startOfDay } from 'date-fns'

interface StreakCounterProps {
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'compact' | 'minimal'
  onClick?: () => void
  userId?: string | null
}

const StreakCounter = ({
  showLabel = true,
  size = 'md',
  variant = 'default',
  onClick,
  userId
}: StreakCounterProps) => {
  // Use useReviewStats as single source of truth for streak data
  const { stats } = useReviewStats()
  const { subscription, isPremium } = useSubscription()
  const [showMilestone, setShowMilestone] = useState(false)

  // Get streak data from unified stats
  const currentStreak = stats.currentStreak || 0
  const longestStreak = stats.bestStreak || currentStreak || 0
  const [previousStreak, setPreviousStreak] = useState(currentStreak)

  // Helper function to calculate days since last activity (from stats)
  const getDaysSinceLastActivity = (): number | null => {
    // We would need lastActivityDate from stats - for now return null
    // This could be enhanced by adding lastActivityDate to ReviewStats interface
    return null
  }

  const lastActiveDay = null // Would need to be added to ReviewStats if needed
  
  // Track streak changes for animations
  useEffect(() => {
    if (currentStreak > previousStreak) {
      setShowMilestone(true)
      const timer = setTimeout(() => setShowMilestone(false), 2000)
      return () => clearTimeout(timer)
    }
    setPreviousStreak(currentStreak)
  }, [currentStreak, previousStreak])
  
  // Get size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'px-2 py-1',
          flame: 'text-lg',
          number: 'text-sm font-semibold',
          label: 'text-xs'
        }
      case 'lg':
        return {
          container: 'px-4 py-3',
          flame: 'text-3xl',
          number: 'text-xl font-bold',
          label: 'text-sm'
        }
      default: // md
        return {
          container: 'px-3 py-2',
          flame: 'text-xl',
          number: 'text-base font-semibold',
          label: 'text-xs'
        }
    }
  }
  
  const sizeClasses = getSizeClasses()
  
  // Get streak status and colors
  const getStreakStatus = () => {
    if (currentStreak === 0) {
      return {
        color: 'text-gray-400 dark:text-gray-600',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        flame: '🔥',
        status: 'No streak',
        message: 'Start learning to begin your streak!'
      }
    } else if (currentStreak < 3) {
      return {
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        flame: '🔥',
        status: 'Getting started',
        message: 'Keep going to build your streak!'
      }
    } else if (currentStreak < 7) {
      return {
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        flame: '🔥',
        status: 'Building momentum',
        message: 'You\'re on fire! Keep it up!'
      }
    } else if (currentStreak < 30) {
      return {
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        flame: '🔥',
        status: 'Week Warrior',
        message: 'Amazing dedication! You\'re unstoppable!'
      }
    } else if (currentStreak < 100) {
      return {
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        flame: '🔥',
        status: 'Monthly Master',
        message: 'Incredible consistency! You\'re a learning machine!'
      }
    } else {
      return {
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20',
        flame: '🔥',
        status: 'Legendary Learner',
        message: 'You\'ve achieved legendary status! Truly inspiring!'
      }
    }
  }
  
  const streakStatus = getStreakStatus()
  
  // Get milestone animation trigger
  const getMilestoneAnimation = () => {
    if (currentStreak > 0 && (currentStreak % 7 === 0 || currentStreak % 30 === 0 || currentStreak % 100 === 0)) {
      return true
    }
    return false
  }
  
  const shouldShowMilestone = getMilestoneAnimation()
  
  // Format last update time based on lastActiveDay
  const formatLastUpdate = () => {
    const daysSince = getDaysSinceLastActivity()

    if (daysSince === null) return 'Never'
    if (daysSince === 0) return 'Today'
    if (daysSince === 1) return 'Yesterday'
    if (daysSince < 7) return `${daysSince} days ago`

    return lastActiveDay || 'Never'
  }
  
  const tooltipContent = (
    <div className="text-center">
      <div className="font-bold text-white mb-1">Learning Streak</div>
      <div className="text-sm text-gray-200">
        Current: {currentStreak} day{currentStreak !== 1 ? 's' : ''}
      </div>
      <div className="text-sm text-gray-200">
        Best: {longestStreak} day{longestStreak !== 1 ? 's' : ''}
      </div>
      <div className="text-xs text-gray-300 mt-2">
        Status: {streakStatus.status}
      </div>
      <div className="text-xs text-gray-300">
        Last updated: {formatLastUpdate()}
      </div>
      <div className="text-xs text-gray-300 mt-1 italic">
        {streakStatus.message}
      </div>
    </div>
  )
  
  const renderContent = () => {
    if (variant === 'minimal') {
      return (
        <div className="flex items-center space-x-1">
          <motion.span
            className={sizeClasses.flame}
            animate={{
              scale: currentStreak > 0 ? [1, 1.1, 1] : 1,
            }}
            transition={{
              duration: 2,
              repeat: currentStreak > 0 ? Infinity : 0,
              ease: "easeInOut"
            }}
          >
            {streakStatus.flame}
          </motion.span>
          <span className={`${sizeClasses.number} ${streakStatus.color}`}>
            {currentStreak}
          </span>
        </div>
      )
    }
    
    if (variant === 'compact') {
      return (
        <div className={`flex items-center space-x-2 rounded-full ${streakStatus.bgColor} ${sizeClasses.container}`}>
          <motion.span
            className={sizeClasses.flame}
            animate={{
              scale: currentStreak > 0 ? [1, 1.1, 1] : 1,
              rotate: showMilestone ? [0, 10, -10, 0] : 0
            }}
            transition={{
              scale: {
                duration: 2,
                repeat: currentStreak > 0 ? Infinity : 0,
                ease: "easeInOut"
              },
              rotate: {
                duration: 0.5,
                ease: "easeInOut"
              }
            }}
          >
            {streakStatus.flame}
          </motion.span>
          <span className={`${sizeClasses.number} ${streakStatus.color}`}>
            {currentStreak}
          </span>
          {showLabel && (
            <span className={`${sizeClasses.label} text-gray-600 dark:text-gray-400`}>
              day{currentStreak !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )
    }
    
    // Default variant
    return (
      <div className={`flex items-center space-x-3 rounded-xl ${streakStatus.bgColor} ${sizeClasses.container} border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-300`}>
        <motion.div
          className="relative"
          animate={{
            scale: showMilestone ? [1, 1.3, 1] : 1,
          }}
          transition={{ duration: 0.6 }}
        >
          <motion.span
            className={sizeClasses.flame}
            animate={{
              scale: currentStreak > 0 ? [1, 1.1, 1] : 1,
              rotate: showMilestone ? [0, 15, -15, 0] : 0
            }}
            transition={{
              scale: {
                duration: 2,
                repeat: currentStreak > 0 ? Infinity : 0,
                ease: "easeInOut"
              },
              rotate: {
                duration: 0.8,
                ease: "easeInOut"
              }
            }}
          >
            {streakStatus.flame}
          </motion.span>
          
          {/* Milestone Sparkles */}
          <AnimatePresence>
            {showMilestone && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-yellow-400 rounded-full"
                    style={{
                      left: '50%',
                      top: '50%',
                    }}
                    animate={{
                      x: [0, (Math.cos(i * 60 * Math.PI / 180) * 20)],
                      y: [0, (Math.sin(i * 60 * Math.PI / 180) * 20)],
                      opacity: [1, 0],
                      scale: [0, 1, 0]
                    }}
                    transition={{
                      duration: 1,
                      ease: "easeOut"
                    }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        
        <div className="flex flex-col">
          <motion.span
            className={`${sizeClasses.number} ${streakStatus.color}`}
            animate={{
              scale: currentStreak > previousStreak ? [1, 1.2, 1] : 1
            }}
            transition={{ duration: 0.3 }}
          >
            {currentStreak}
          </motion.span>
          {showLabel && (
            <span className={`${sizeClasses.label} text-gray-600 dark:text-gray-400 leading-none`}>
              day streak
            </span>
          )}
        </div>
        
        {longestStreak > currentStreak && (
          <div className="flex flex-col items-end">
            <span className={`${sizeClasses.label} text-gray-500 dark:text-gray-500`}>
              best: {longestStreak}
            </span>
          </div>
        )}
      </div>
    )
  }
  
  return (
    <Tooltip content={tooltipContent}>
      <motion.div
        className={`cursor-pointer select-none ${onClick ? 'hover:scale-105' : ''}`}
        whileTap={onClick ? { scale: 0.95 } : {}}
        onClick={onClick}
      >
        {renderContent()}
        
        {/* Milestone Celebration */}
        <AnimatePresence>
          {shouldShowMilestone && currentStreak > previousStreak && (
            <motion.div
              className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap shadow-lg"
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.8 }}
              transition={{ duration: 0.5 }}
            >
              🎉 Milestone Reached!
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </Tooltip>
  )
}

export default StreakCounter