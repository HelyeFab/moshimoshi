'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Tooltip from '@/components/ui/Tooltip'
import { useI18n } from '@/i18n/I18nContext'
import { xpSystem, UserLevel } from '@/lib/gamification/xp-system'

interface LevelProgressProps {
  userId: string
  totalXP: number
  showDetails?: boolean
  compact?: boolean
  onLevelUp?: (newLevel: number) => void
}

const LevelUpAnimation = ({ level, onComplete }: { level: number, onComplete: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Background Rays */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 0, rotate: 0 }}
        animate={{ scale: 2, rotate: 360 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      >
        <div className="w-full h-full bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 opacity-20 blur-3xl" />
      </motion.div>

      {/* Level Up Card */}
      <motion.div
        className="relative bg-white dark:bg-dark-800 rounded-2xl p-8 shadow-2xl"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", duration: 0.8, bounce: 0.5 }}
      >
        <motion.div
          className="text-6xl text-center mb-4"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            repeatType: "reverse"
          }}
        >
          {xpSystem.getLevelBadge(level)}
        </motion.div>

        <motion.h2
          className="text-3xl font-bold text-center mb-2"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          LEVEL UP!
        </motion.h2>

        <motion.div
          className="text-5xl font-bold text-center bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
        >
          Level {level}
        </motion.div>

        <motion.p
          className="text-center mt-4 text-gray-600 dark:text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {xpSystem.getUserLevel(xpSystem.calculateXPForLevel(level)).title}
        </motion.p>

        {/* Particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-yellow-400 rounded-full"
            style={{
              left: '50%',
              top: '50%',
            }}
            initial={{ x: 0, y: 0, scale: 0 }}
            animate={{
              x: (Math.random() - 0.5) * 400,
              y: (Math.random() - 0.5) * 400,
              scale: [0, 1, 0],
              opacity: [1, 1, 0]
            }}
            transition={{
              duration: 2,
              delay: Math.random() * 0.5,
              ease: "easeOut"
            }}
          />
        ))}
      </motion.div>
    </motion.div>
  )
}

export default function LevelProgress({
  userId,
  totalXP,
  showDetails = true,
  compact = false,
  onLevelUp
}: LevelProgressProps) {
  const { strings } = useI18n()
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null)
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [lastLevel, setLastLevel] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const level = xpSystem.getUserLevel(totalXP)
    setUserLevel(level)

    // Check for level up
    if (lastLevel > 0 && level.currentLevel > lastLevel) {
      setShowLevelUp(true)
      onLevelUp?.(level.currentLevel)
    }
    setLastLevel(level.currentLevel)
  }, [totalXP, lastLevel, onLevelUp])

  if (!userLevel) return null

  const levelColor = xpSystem.getLevelColor(userLevel.currentLevel)
  const levelBadge = xpSystem.getLevelBadge(userLevel.currentLevel)
  const xpMultiplier = xpSystem.getXPMultiplier(userLevel.currentLevel)

  if (compact) {
    return (
      <Tooltip
        content={
          <div className="text-center">
            <div className="font-bold">Level {userLevel.currentLevel}</div>
            <div className="text-sm">{userLevel.title}</div>
            <div className="text-xs mt-1">
              {userLevel.currentXP}/{userLevel.currentXP + userLevel.xpToNextLevel} XP
            </div>
          </div>
        }
      >
        <div className="flex items-center space-x-2">
          <div className="text-2xl">{levelBadge}</div>
          <div>
            <div className="text-sm font-bold">Lv.{userLevel.currentLevel}</div>
            <div className="w-20 h-1 bg-gray-200 dark:bg-gray-700 rounded-full">
              <div
                className={`h-full bg-gradient-to-r ${levelColor} rounded-full`}
                style={{ width: `${userLevel.progressPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </Tooltip>
    )
  }

  return (
    <>
      <Card className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-4">
            {/* Level Badge */}
            <motion.div
              className="text-5xl"
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              {levelBadge}
            </motion.div>

            {/* Level Info */}
            <div>
              <div className="flex items-center space-x-2">
                <h3 className={`text-2xl font-bold bg-gradient-to-r ${levelColor} bg-clip-text text-transparent`}>
                  Level {userLevel.currentLevel}
                </h3>
                {xpMultiplier > 1 && (
                  <div className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 text-xs rounded-full font-medium">
                    {xpMultiplier}x XP
                  </div>
                )}
              </div>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                {userLevel.title}
              </p>
            </div>
          </div>

          {/* Total XP */}
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {totalXP.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">Total XP</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>{userLevel.currentXP.toLocaleString()} XP</span>
            <span>{userLevel.xpToNextLevel.toLocaleString()} XP to Level {userLevel.currentLevel + 1}</span>
          </div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className={`h-full bg-gradient-to-r ${levelColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${userLevel.progressPercentage}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <div className="text-center text-xs text-gray-500 mt-1">
            {userLevel.progressPercentage.toFixed(1)}% Complete
          </div>
        </div>

        {/* Next Level Preview */}
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Next:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              Level {userLevel.currentLevel + 1}
            </span>
            <span className="text-gray-600 dark:text-gray-400">•</span>
            <span className="text-gray-600 dark:text-gray-400">{userLevel.nextLevelTitle}</span>
          </div>
          <div className="text-2xl">
            {xpSystem.getLevelBadge(userLevel.currentLevel + 1)}
          </div>
        </div>

        {/* Expandable Details */}
        {showDetails && (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full"
            >
              {isExpanded ? 'Hide' : 'Show'} Level Details
            </Button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-4 space-y-4"
                >
                  {/* Perks */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Level Perks
                    </h4>
                    <div className="space-y-1">
                      {xpSystem['getPerksForLevel'](userLevel.currentLevel).map((perk, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400"
                        >
                          <span className="text-green-500">✓</span>
                          <span>{perk}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Level Progression */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Level Progression
                    </h4>
                    <div className="grid grid-cols-5 gap-1">
                      {[...Array(10)].map((_, i) => {
                        const level = Math.max(1, userLevel.currentLevel - 4 + i)
                        const isCurrentLevel = level === userLevel.currentLevel
                        const isPastLevel = level < userLevel.currentLevel
                        const badge = xpSystem.getLevelBadge(level)

                        return (
                          <Tooltip
                            key={i}
                            content={`Level ${level}`}
                          >
                            <div
                              className={`
                                text-center p-2 rounded-lg transition-all cursor-pointer
                                ${isCurrentLevel
                                  ? 'bg-primary-100 dark:bg-primary-900 ring-2 ring-primary-500'
                                  : isPastLevel
                                  ? 'bg-green-50 dark:bg-green-900/20'
                                  : 'bg-gray-50 dark:bg-gray-900 opacity-50'
                                }
                              `}
                            >
                              <div className="text-xl">{badge}</div>
                              <div className="text-xs mt-1">{level}</div>
                            </div>
                          </Tooltip>
                        )
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </Card>

      {/* Level Up Animation */}
      <AnimatePresence>
        {showLevelUp && (
          <LevelUpAnimation
            level={userLevel.currentLevel}
            onComplete={() => setShowLevelUp(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}