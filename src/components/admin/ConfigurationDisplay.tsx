'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Check, X, AlertCircle, Code, FileJson } from 'lucide-react'

interface Feature {
  id: string
  name: string
  category: string
  limitType: string
  description: string
  metadata?: any
}

interface ConfigData {
  version: number
  lastUpdated: string
  plans: Record<string, any>
  features: Feature[]
  limits: Record<string, any>
  metadata: any
}

interface CodeData {
  featureIds: string[]
  planTypes: string[]
  limits: Record<string, Record<string, number>>
}

interface ConfigurationDisplayProps {
  configData: ConfigData | null
  codeData?: CodeData | null
  onRegenerateTypes: () => void
  generating: boolean
}

export default function ConfigurationDisplay({
  configData,
  codeData,
  onRegenerateTypes,
  generating
}: ConfigurationDisplayProps) {
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [showComparison, setShowComparison] = useState(false)

  if (!configData) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading configuration...</p>
      </div>
    )
  }

  const formatLimit = (limit: number | undefined) => {
    if (limit === undefined) return <span className="text-gray-400">-</span>
    if (limit === 0) return <span className="text-gray-500">Not available</span>
    if (limit === -1) return <span className="text-green-600 dark:text-green-400 font-semibold">Unlimited</span>
    return <span className="font-medium">{limit}</span>
  }

  const plans = ['guest', 'free', 'premium_monthly', 'premium_yearly']
  const planLabels = {
    guest: 'Guest',
    free: 'Free',
    premium_monthly: 'Premium Monthly',
    premium_yearly: 'Premium Yearly'
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <h2 className="text-base sm:text-lg font-semibold">Current Configuration</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm ${
                viewMode === 'table'
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm ${
                viewMode === 'cards'
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              Card View
            </button>
          </div>
        </div>
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="w-full sm:w-auto px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs sm:text-sm flex items-center justify-center sm:justify-start gap-1"
        >
          <Code className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="sm:hidden">Code Comparison</span>
          <span className="hidden sm:inline">{showComparison ? 'Hide' : 'Show'} Code Comparison</span>
        </button>
      </div>

      {/* Comparison View */}
      {showComparison && codeData && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 sm:p-4">
          <h3 className="text-sm sm:text-base font-medium text-yellow-800 dark:text-yellow-200 mb-3 flex items-center gap-2">
            <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4" />
            JSON vs TypeScript Comparison
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <h4 className="text-xs sm:text-sm font-medium mb-2 flex items-center gap-1">
                <FileJson className="w-3 h-3 sm:w-4 sm:h-4" />
                From features.v1.json
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded p-2 sm:p-3 text-xs space-y-1 overflow-x-auto">
                <div>Features: {configData.features.map(f => f.id).join(', ')}</div>
                <div>Plans: {Object.keys(configData.plans).join(', ')}</div>
                <div>Version: {configData.version}</div>
              </div>
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-medium mb-2 flex items-center gap-1">
                <Code className="w-3 h-3 sm:w-4 sm:h-4" />
                From TypeScript Types
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded p-2 sm:p-3 text-xs space-y-1 overflow-x-auto">
                <div>FeatureIds: {codeData.featureIds?.join(', ') || 'Loading...'}</div>
                <div>PlanTypes: {codeData.planTypes?.join(', ') || 'Loading...'}</div>
                <div className={configData.features.length !== codeData.featureIds?.length ? 'text-red-500' : 'text-green-500'}>
                  {configData.features.length === codeData.featureIds?.length ? '✓ Synced' : '⚠ Mismatch!'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Feature</th>
                {plans.map(plan => (
                  <th key={plan} className="text-center py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[80px] sm:min-w-[120px]">
                    <div className="hidden sm:block">{planLabels[plan as keyof typeof planLabels]}</div>
                    <div className="sm:hidden">{plan === 'guest' ? 'G' : plan === 'free' ? 'F' : plan === 'premium_monthly' ? 'PM' : 'PY'}</div>
                    {(plan === 'premium_monthly' || plan === 'premium_yearly') && (
                      <div className="hidden sm:block text-xs font-normal text-primary-500 mt-0.5">Premium</div>
                    )}
                  </th>
                ))}
                <th className="text-center py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Type</th>
              </tr>
            </thead>
            <tbody>
              {configData.features.map((feature, idx) => (
                <React.Fragment key={feature.id}>
                  <tr
                    className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer ${
                      expandedFeature === feature.id ? 'bg-gray-50 dark:bg-gray-800/50' : ''
                    }`}
                    onClick={() => setExpandedFeature(expandedFeature === feature.id ? null : feature.id)}
                  >
                    <td className="py-2 sm:py-3 px-2 sm:px-4">
                      <div className="flex items-center gap-1 sm:gap-2">
                        {expandedFeature === feature.id ? (
                          <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{feature.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{feature.id}</div>
                        </div>
                      </div>
                    </td>
                    {plans.map(plan => {
                      const limit = configData.limits[plan]?.daily?.[feature.id]
                      return (
                        <td key={plan} className="text-center py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm">
                          {formatLimit(limit)}
                        </td>
                      )
                    })}
                    <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                      <span className={`px-1 sm:px-2 py-0.5 rounded text-xs ${
                        feature.limitType === 'daily'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      }`}>
                        <span className="hidden sm:inline">{feature.limitType}</span>
                        <span className="sm:hidden">{feature.limitType === 'daily' ? 'D' : 'M'}</span>
                      </span>
                    </td>
                  </tr>
                  {expandedFeature === feature.id && (
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <td colSpan={plans.length + 2} className="py-3 px-4 bg-gray-50/50 dark:bg-gray-800/25">
                        <div className="pl-8 space-y-2">
                          <p className="text-sm text-gray-600 dark:text-gray-400">{feature.description}</p>
                          <div className="flex flex-wrap gap-2">
                            <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
                              Category: {feature.category}
                            </span>
                            {feature.metadata?.producesReviewable && (
                              <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                                Produces Reviewable
                              </span>
                            )}
                            {feature.metadata?.countsForStreak && (
                              <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded">
                                Counts for Streak
                              </span>
                            )}
                            {feature.metadata?.givesXp && (
                              <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                                Gives XP
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Card View */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div key={plan} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-lg mb-3 flex items-center justify-between">
                {planLabels[plan as keyof typeof planLabels]}
                {(plan === 'premium_monthly' || plan === 'premium_yearly') && (
                  <span className="text-xs px-2 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full">
                    Premium
                  </span>
                )}
              </h3>
              <div className="space-y-2">
                {configData.features.map(feature => {
                  const limit = configData.limits[plan]?.daily?.[feature.id]
                  return (
                    <div key={feature.id} className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{feature.name}</span>
                      <span className="text-sm font-medium">{formatLimit(limit)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 order-2 sm:order-1">
          <span className="block sm:inline">Version: {configData.version}</span>
          <span className="hidden sm:inline"> | </span>
          <span className="block sm:inline">Last Updated: {configData.lastUpdated}</span>
          <span className="hidden lg:inline"> | Schema: /config/features.v1.json</span>
        </p>
        <button
          onClick={onRegenerateTypes}
          disabled={generating}
          className={`w-full sm:w-auto order-1 sm:order-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
            generating
              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-primary-500 hover:bg-primary-600 text-white'
          }`}
        >
          {generating ? 'Generating...' : 'Regenerate Types'}
        </button>
      </div>
    </div>
  )
}