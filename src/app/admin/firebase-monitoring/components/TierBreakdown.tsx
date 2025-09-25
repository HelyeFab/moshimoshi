'use client'

import { PieChart, Users } from 'lucide-react'

interface Props {
  data: any
}

export function TierBreakdown({ data }: Props) {
  if (!data) {
    return (
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Usage by User Tier
        </h2>
        <div className="h-64 flex items-center justify-center text-gray-500">
          No data available
        </div>
      </div>
    )
  }

  const freeOps = data.summary.freeUserOperations || 0
  const premiumOps = data.summary.premiumUserOperations || 0
  const total = freeOps + premiumOps || 1

  const freePercentage = (freeOps / total) * 100
  const premiumPercentage = (premiumOps / total) * 100

  // Create SVG pie chart
  const createPieSlice = (percentage: number, offset: number, color: string) => {
    const angle = (percentage / 100) * 360
    const largeArcFlag = angle > 180 ? 1 : 0
    const endAngleRad = ((offset + angle - 90) * Math.PI) / 180
    const startAngleRad = ((offset - 90) * Math.PI) / 180
    const x1 = 100 + 80 * Math.cos(startAngleRad)
    const y1 = 100 + 80 * Math.sin(startAngleRad)
    const x2 = 100 + 80 * Math.cos(endAngleRad)
    const y2 = 100 + 80 * Math.sin(endAngleRad)

    if (percentage === 100) {
      return `M 100,20 A 80,80 0 1,1 99.99,20`
    }

    return `M 100,100 L ${x1},${y1} A 80,80 0 ${largeArcFlag},1 ${x2},${y2} Z`
  }

  return (
    <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Usage by User Tier
        </h2>
        <Users className="w-5 h-5 text-gray-500" />
      </div>

      <div className="flex items-center justify-center">
        <div className="relative">
          {/* SVG Pie Chart */}
          <svg width="200" height="200" viewBox="0 0 200 200">
            {premiumPercentage > 0 && (
              <path
                d={createPieSlice(premiumPercentage, 0, '#10b981')}
                fill="#10b981"
                className="transition-all duration-500 hover:opacity-80"
              />
            )}
            {freePercentage > 0 && (
              <path
                d={createPieSlice(freePercentage, premiumPercentage, '#f97316')}
                fill="#f97316"
                className="transition-all duration-500 hover:opacity-80"
              />
            )}
          </svg>

          {/* Center hole for donut effect */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-white dark:bg-dark-800 rounded-full flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {total.toLocaleString()}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Total Ops</span>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
            <span className="text-sm text-gray-700 dark:text-gray-300">Premium Users</span>
          </div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {premiumOps.toLocaleString()} ({premiumPercentage.toFixed(1)}%)
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-orange-500 rounded mr-2"></div>
            <span className="text-sm text-gray-700 dark:text-gray-300">Free Users</span>
          </div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {freeOps.toLocaleString()} ({freePercentage.toFixed(1)}%)
          </div>
        </div>
      </div>

      {freeOps > 0 && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200 font-semibold">
            ⚠️ Free users should have 0 operations!
          </p>
        </div>
      )}
    </div>
  )
}