'use client'

import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  data: any
}

export function CostProjection({ data }: Props) {
  if (!data) {
    return (
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Cost Projections
        </h2>
        <div className="h-64 flex items-center justify-center text-gray-500">
          No data available
        </div>
      </div>
    )
  }

  const costs = data.costEstimates

  return (
    <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Cost Projections
        </h2>
        <DollarSign className="w-5 h-5 text-gray-500" />
      </div>

      {/* Current Costs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Reads</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            ${costs.reads.cost}
          </p>
          <p className="text-xs text-gray-500">{costs.reads.count.toLocaleString()}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Writes</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            ${costs.writes.cost}
          </p>
          <p className="text-xs text-gray-500">{costs.writes.count.toLocaleString()}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Deletes</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            ${costs.deletes.cost}
          </p>
          <p className="text-xs text-gray-500">{costs.deletes.count.toLocaleString()}</p>
        </div>
      </div>

      {/* Projections */}
      <div className="space-y-3 border-t dark:border-gray-700 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Current Hour</span>
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            ${costs.total.cost}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Daily Projection</span>
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            ${costs.total.dailyProjection}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Monthly Projection</span>
          <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
            ${costs.total.monthlyProjection}
          </span>
        </div>
      </div>

      {/* Savings */}
      {parseFloat(costs.savings.monthlyPotential) > 0 && (
        <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <TrendingDown className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
              <span className="font-semibold text-green-900 dark:text-green-200">
                Potential Savings
              </span>
            </div>
            <span className="text-xl font-bold text-green-600 dark:text-green-400">
              ${costs.savings.monthlyPotential}/mo
            </span>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300">
            {costs.savings.percentage} of current costs from free users
          </p>
        </div>
      )}

      {/* Violations Cost */}
      {costs.violations.count > 0 && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-red-800 dark:text-red-200">
              Violations Cost
            </span>
            <span className="font-semibold text-red-600 dark:text-red-400">
              ${costs.violations.estimatedCost}
            </span>
          </div>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            {costs.violations.count} violations detected
          </p>
        </div>
      )}
    </div>
  )
}