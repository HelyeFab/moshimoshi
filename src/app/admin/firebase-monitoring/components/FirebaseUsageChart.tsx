'use client'

import { BarChart, Activity } from 'lucide-react'

interface Props {
  data: any
}

export function FirebaseUsageChart({ data }: Props) {
  if (!data) {
    return (
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Usage by Operation Type
        </h2>
        <div className="h-64 flex items-center justify-center text-gray-500">
          No data available
        </div>
      </div>
    )
  }

  const operations = data.summary.operationsByType || {}
  const maxCount = Math.max(...Object.values(operations as Record<string, number>), 1)

  return (
    <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Usage by Operation Type
        </h2>
        <Activity className="w-5 h-5 text-gray-500" />
      </div>

      <div className="space-y-4">
        {Object.entries(operations).map(([type, count]) => {
          const percentage = (count / maxCount) * 100
          const isWrite = type === 'write' || type === 'delete'

          return (
            <div key={type} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">
                  {type}
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  {(count as number).toLocaleString()}
                </span>
              </div>
              <div className="relative h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`absolute left-0 top-0 h-full transition-all duration-500 ${
                    isWrite
                      ? 'bg-gradient-to-r from-orange-400 to-orange-500'
                      : 'bg-gradient-to-r from-blue-400 to-blue-500'
                  }`}
                  style={{ width: `${percentage}%` }}
                >
                  <div className="h-full flex items-center px-3">
                    <span className="text-xs text-white font-semibold">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {data.summary.freeUserOperations > 0 && (
        <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <p className="text-sm text-orange-800 dark:text-orange-200">
            ⚠️ {data.summary.freeUserOperations} operations from free users detected
          </p>
        </div>
      )}
    </div>
  )
}