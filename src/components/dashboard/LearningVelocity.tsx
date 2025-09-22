'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Area, AreaChart } from 'recharts'
import { ReviewableContentWithSRS } from '@/lib/review-engine/core/interfaces'
import { SRSStateManager } from '@/lib/review-engine/srs/state-manager'
import DoshiMascot from '@/components/ui/DoshiMascot'

interface LearningVelocityProps {
  items?: ReviewableContentWithSRS[]
  className?: string
}

interface VelocityData {
  date: string
  itemsMastered: number
  averageTime: number
  totalReviews: number
  accuracy: number
}

interface MetricCard {
  title: string
  value: string
  unit: string
  change: number
  icon: string
  color: string
  trend: 'up' | 'down' | 'stable'
}

// Generate mock velocity data for the past 30 days
const generateMockVelocityData = (): VelocityData[] => {
  const data: VelocityData[] = []
  const now = new Date()
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    
    // Simulate learning patterns with some randomness
    const baseItemsMastered = 2 + Math.random() * 8
    const baseAverageTime = 15 + Math.random() * 10
    const baseTotalReviews = 10 + Math.random() * 20
    const baseAccuracy = 0.7 + Math.random() * 0.25
    
    // Add weekly patterns (weekends might be different)
    const dayOfWeek = date.getDay()
    const weekendMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.7 : 1.0
    
    data.push({
      date: date.toISOString().split('T')[0],
      itemsMastered: Math.floor(baseItemsMastered * weekendMultiplier),
      averageTime: baseAverageTime / weekendMultiplier,
      totalReviews: Math.floor(baseTotalReviews * weekendMultiplier),
      accuracy: Math.min(0.95, baseAccuracy * (0.9 + weekendMultiplier * 0.1))
    })
  }
  
  return data
}

const generateProjectionData = (historicalData: VelocityData[]): { projectedMasteryDate: string, currentRate: number, pastAverage: number } => {
  // Calculate learning rates
  const recentData = historicalData.slice(-7) // Last 7 days
  const pastData = historicalData.slice(-14, -7) // Previous 7 days
  
  const currentRate = recentData.reduce((sum, day) => sum + day.itemsMastered, 0) / recentData.length
  const pastAverage = pastData.reduce((sum, day) => sum + day.itemsMastered, 0) / pastData.length
  
  // Project when remaining items will be mastered
  const remainingItems = 50 // Assume 50 items remaining to master
  const daysToComplete = Math.ceil(remainingItems / Math.max(currentRate, 0.1))
  
  const projectedDate = new Date()
  projectedDate.setDate(projectedDate.getDate() + daysToComplete)
  
  return {
    projectedMasteryDate: projectedDate.toLocaleDateString(),
    currentRate,
    pastAverage
  }
}

export default function LearningVelocity({ items, className = '' }: LearningVelocityProps) {
  const [velocityData] = useState<VelocityData[]>(() => generateMockVelocityData())
  const [chartView, setChartView] = useState<'mastery' | 'reviews' | 'accuracy'>('mastery')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading time
    const timer = setTimeout(() => setIsLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <div className={`bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl p-6 shadow-lg ${className}`}>
        <div className="flex items-center justify-center h-64">
          <DoshiMascot size="medium" variant="animated" />
          <div className="ml-4">
            <p className="text-gray-600 dark:text-gray-400">Analyzing learning velocity...</p>
          </div>
        </div>
      </div>
    )
  }

  const projection = generateProjectionData(velocityData)
  const totalItemsMastered = velocityData.reduce((sum, day) => sum + day.itemsMastered, 0)
  const averageTimeToMastery = velocityData.reduce((sum, day) => sum + day.averageTime, 0) / velocityData.length
  const overallAccuracy = velocityData.reduce((sum, day) => sum + day.accuracy, 0) / velocityData.length

  const metricCards: MetricCard[] = [
    {
      title: 'Items Mastered',
      value: totalItemsMastered.toString(),
      unit: 'past 30 days',
      change: ((projection.currentRate - projection.pastAverage) / projection.pastAverage) * 100,
      icon: '🏆',
      color: 'text-green-500',
      trend: projection.currentRate > projection.pastAverage ? 'up' : projection.currentRate < projection.pastAverage ? 'down' : 'stable'
    },
    {
      title: 'Average Time to Mastery',
      value: averageTimeToMastery.toFixed(1),
      unit: 'days',
      change: -5.2, // Mock improvement
      icon: '⏱️',
      color: 'text-blue-500',
      trend: 'up'
    },
    {
      title: 'Learning Rate',
      value: projection.currentRate.toFixed(1),
      unit: 'items/day',
      change: ((projection.currentRate - projection.pastAverage) / projection.pastAverage) * 100,
      icon: '📈',
      color: 'text-purple-500',
      trend: projection.currentRate > projection.pastAverage ? 'up' : 'down'
    },
    {
      title: 'Projected Completion',
      value: projection.projectedMasteryDate,
      unit: 'remaining items',
      change: 0,
      icon: '🎯',
      color: 'text-orange-500',
      trend: 'stable'
    }
  ]

  const chartData = velocityData.map(day => ({
    ...day,
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    accuracy: Math.round(day.accuracy * 100)
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="font-medium text-gray-900 dark:text-gray-100">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value} {entry.name === 'accuracy' ? '%' : ''}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className={`bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl p-6 shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Learning Velocity</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Track your learning speed and progress trends
          </p>
        </div>
        <DoshiMascot size="small" />
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {metricCards.map((metric, index) => (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white/50 dark:bg-dark-700/50 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg">{metric.icon}</span>
              {metric.change !== 0 && (
                <div className={`flex items-center text-xs ${
                  metric.trend === 'up' ? 'text-green-500' : metric.trend === 'down' ? 'text-red-500' : 'text-gray-500'
                }`}>
                  {metric.trend === 'up' ? '↗' : metric.trend === 'down' ? '↘' : '→'}
                  {Math.abs(metric.change).toFixed(1)}%
                </div>
              )}
            </div>
            <div className={`text-xl font-bold ${metric.color}`}>
              {metric.value}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {metric.unit}
            </div>
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">
              {metric.title}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Chart Controls */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { key: 'mastery', label: 'Items Mastered', icon: '🏆' },
          { key: 'reviews', label: 'Total Reviews', icon: '📚' },
          { key: 'accuracy', label: 'Accuracy %', icon: '🎯' }
        ].map((option) => (
          <button
            key={option.key}
            onClick={() => setChartView(option.key as any)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              chartView === option.key
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
            }`}
          >
            <span>{option.icon}</span>
            {option.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-64 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          {chartView === 'mastery' ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="itemsMastered" 
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                name="Items Mastered"
              />
            </BarChart>
          ) : chartView === 'reviews' ? (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="totalReviews" 
                stroke="#3b82f6" 
                fill="#3b82f6"
                fillOpacity={0.3}
                name="Total Reviews"
              />
            </AreaChart>
          ) : chartView === 'accuracy' ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="accuracy" 
                stroke="#f59e0b" 
                strokeWidth={3}
                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                name="Accuracy"
              />
            </LineChart>
          ) : (
            <BarChart data={[]} />
          )}
        </ResponsiveContainer>
      </div>

      {/* Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-lg">💡</span>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Learning Insights</h4>
            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <p>• Your current learning rate is {projection.currentRate.toFixed(1)} items per day</p>
              <p>• You've mastered {totalItemsMastered} items in the past 30 days</p>
              <p>• At this pace, you'll complete remaining items by {projection.projectedMasteryDate}</p>
              <p>• Your overall accuracy is {(overallAccuracy * 100).toFixed(1)}% - excellent work!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}