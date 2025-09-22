'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface SRSProgressProps {
  items: SRSItem[]
  showLabels?: boolean
  compact?: boolean
}

interface SRSItem {
  id: string
  state: 'new' | 'learning' | 'review' | 'mastered'
  interval: number // in days
  easeFactor: number
  consecutiveCorrect: number
  successRate: number
  lastReviewDate?: Date
  nextReviewDate?: Date
}

interface StateConfig {
  label: string
  color: string
  bgColor: string
  borderColor: string
  description: string
  icon: string
}

const stateConfigs: Record<string, StateConfig> = {
  new: {
    label: 'New',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    borderColor: 'border-gray-300 dark:border-gray-600',
    description: 'Never reviewed',
    icon: '📝'
  },
  learning: {
    label: 'Learning',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-300 dark:border-yellow-600',
    description: 'Review < 1 day',
    icon: '📚'
  },
  review: {
    label: 'Review',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    borderColor: 'border-blue-300 dark:border-blue-600',
    description: '1-21 days',
    icon: '🔄'
  },
  mastered: {
    label: 'Mastered',
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/20',
    borderColor: 'border-green-300 dark:border-green-600',
    description: '21+ days, 90%+',
    icon: '✨'
  }
}

function ProgressRing({ 
  value, 
  maxValue, 
  size = 120, 
  strokeWidth = 8,
  color = 'text-blue-500'
}: {
  value: number
  maxValue: number
  size?: number
  strokeWidth?: number
  color?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          className={color}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{
            strokeDasharray: circumference
          }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-xs text-gray-500">{percentage.toFixed(0)}%</span>
      </div>
    </div>
  )
}

function StateCard({ 
  state, 
  config, 
  count, 
  percentage,
  compact = false 
}: {
  state: string
  config: StateConfig
  count: number
  percentage: number
  compact?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        "p-4 border-2 transition-all hover:shadow-lg",
        config.borderColor,
        config.bgColor
      )}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{config.icon}</span>
            <div>
              <h3 className={cn("font-semibold", config.color)}>
                {config.label}
              </h3>
              {!compact && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {config.description}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className={cn("text-2xl font-bold", config.color)}>
              {count}
            </div>
            <div className="text-xs text-gray-500">
              {percentage.toFixed(1)}%
            </div>
          </div>
        </div>
        {!compact && (
          <Progress 
            value={percentage} 
            className="h-2"
            indicatorClassName={cn(
              state === 'new' && 'bg-gray-400',
              state === 'learning' && 'bg-yellow-400',
              state === 'review' && 'bg-blue-400',
              state === 'mastered' && 'bg-green-400'
            )}
          />
        )}
      </Card>
    </motion.div>
  )
}

export default function SRSProgress({ 
  items, 
  showLabels = true,
  compact = false 
}: SRSProgressProps) {
  const stats = useMemo(() => {
    const total = items.length
    const counts = {
      new: 0,
      learning: 0,
      review: 0,
      mastered: 0
    }

    items.forEach(item => {
      // Determine state based on interval and success rate
      if (!item.lastReviewDate) {
        counts.new++
      } else if (item.interval < 1) {
        counts.learning++
      } else if (item.interval >= 21 && item.successRate >= 0.9) {
        counts.mastered++
      } else {
        counts.review++
      }
    })

    return {
      total,
      counts,
      percentages: {
        new: total > 0 ? (counts.new / total) * 100 : 0,
        learning: total > 0 ? (counts.learning / total) * 100 : 0,
        review: total > 0 ? (counts.review / total) * 100 : 0,
        mastered: total > 0 ? (counts.mastered / total) * 100 : 0
      }
    }
  }, [items])

  const masteryRate = stats.percentages.mastered
  const learningVelocity = stats.counts.learning + stats.counts.review

  return (
    <div className="space-y-6">
      {showLabels && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            SRS Progress
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {stats.total} total items • {masteryRate.toFixed(1)}% mastery rate • {learningVelocity} in progress
          </p>
        </div>
      )}

      {/* Progress Rings View */}
      <Card className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {Object.entries(stats.counts).map(([state, count]) => (
            <motion.div
              key={state}
              className="flex flex-col items-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: Object.keys(stats.counts).indexOf(state) * 0.1 }}
            >
              <ProgressRing
                value={count}
                maxValue={stats.total}
                color={
                  state === 'new' ? 'text-gray-500' :
                  state === 'learning' ? 'text-yellow-500' :
                  state === 'review' ? 'text-blue-500' :
                  'text-green-500'
                }
                size={compact ? 80 : 120}
              />
              <div className="mt-3 text-center">
                <div className="flex items-center gap-1">
                  <span className="text-lg">{stateConfigs[state].icon}</span>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {stateConfigs[state].label}
                  </span>
                </div>
                {!compact && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {stateConfigs[state].description}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </Card>

      {/* State Cards View */}
      {!compact && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(stats.counts).map(([state, count], index) => (
            <StateCard
              key={state}
              state={state}
              config={stateConfigs[state]}
              count={count}
              percentage={stats.percentages[state as keyof typeof stats.percentages]}
              compact={compact}
            />
          ))}
        </div>
      )}

      {/* Progress Summary */}
      {!compact && (
        <Card className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Learning Journey
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Keep up the great work! You're making steady progress.
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {masteryRate.toFixed(0)}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Mastery Rate
              </div>
            </div>
          </div>
          
          <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-purple-200 dark:border-purple-700">
            <div>
              <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {stats.counts.new}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Ready to learn
              </div>
            </div>
            <div>
              <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {learningVelocity}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                In progress
              </div>
            </div>
            <div>
              <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {stats.counts.mastered}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Mastered
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}