'use client'

/**
 * Admin Streak Page
 * Phase 3.3: Analytics Dashboard for Streak Save System
 *
 * Features:
 * - Analytics: Usage stats, XP spent, conversion rates
 * - Configuration: Edit streak.json (grace period, save costs, etc.)
 * - Logs: Recent streak saves with details
 */

import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'
import {
  ChartBarIcon,
  CogIcon,
  ClockIcon,
  FireIcon,
  CurrencyDollarIcon,
  UsersIcon,
  ArrowTrendingUpIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'

interface StreakAnalytics {
  totalSaves: number
  totalXPSpent: number
  averageCost: number
  uniqueUsers: number
  savesLast7Days: number
  savesLast30Days: number
  conversionRate: number
  mostCommonDaysSince: number
  recentSaves: Array<{
    userId: string
    streakSaved: number
    xpDeducted: number
    daysSinceActivity: number
    timestamp: string
  }>
}

interface StreakConfig {
  version: string
  minXPForStreak: number
  gracePeriodHours: number
  resetTime: string
  timezone: string
  streakFreeze?: {
    enabled: boolean
    requiresPremium: boolean
    maxFreezes: number
    freezeDurationDays: number
    description: string
  }
  streakSave?: {
    enabled: boolean
    costMode: 'fixed' | 'dynamic'
    baseCost: number
    surgePricing: boolean
    surgeMultiplier: number
    maxSaveWindow: number
    requiresPremium: boolean
    description: string
  }
  notifications?: {
    enabled: boolean
    reminderHours: number[]
    description: string
  }
}

type TabType = 'analytics' | 'config' | 'logs'

export default function StreakAdminPage() {
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('analytics')

  const [analytics, setAnalytics] = useState<StreakAnalytics | null>(null)
  const [config, setConfig] = useState<StreakConfig | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [analyticsRes, configRes] = await Promise.all([
        fetch('/api/admin/streak-analytics', { credentials: 'include' }),
        fetch('/api/admin/streak-config', { credentials: 'include' })
      ])

      if (analyticsRes.ok) {
        const data = await analyticsRes.json()
        setAnalytics(data.analytics)
      }

      if (configRes.ok) {
        const data = await configRes.json()
        setConfig(data.config)
      }
    } catch (error) {
      console.error('[Streak Admin] Error loading:', error)
      showToast('Failed to load streak data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    if (!config) return
    setSaving(true)
    try {
      const response = await fetch('/api/admin/streak-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ config })
      })

      if (!response.ok) {
        throw new Error('Failed to save')
      }

      showToast('Streak configuration saved', 'success')
      await loadData()
    } catch (error) {
      showToast('Failed to save configuration', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading streak data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FireIcon className="w-8 h-8 text-orange-500" />
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                Streak Management
              </h1>
            </div>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Analytics, configuration, and logs for the streak save system
            </p>
          </div>
          {activeTab === 'config' && (
            <button
              onClick={saveConfig}
              disabled={saving}
              className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 sm:gap-2 mt-6 border-b border-gray-200 dark:border-dark-700 overflow-x-auto">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 font-medium transition-colors whitespace-nowrap text-sm sm:text-base ${
              activeTab === 'analytics'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <ChartBarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline">Analytics</span>
            <span className="inline xs:hidden">Stats</span>
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 font-medium transition-colors whitespace-nowrap text-sm sm:text-base ${
              activeTab === 'config'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <CogIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline">Configuration</span>
            <span className="inline xs:hidden">Config</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 font-medium transition-colors whitespace-nowrap text-sm sm:text-base ${
              activeTab === 'logs'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <DocumentTextIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Logs</span>
          </button>
        </div>
      </div>

      {/* Analytics Tab */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Saves</h3>
                <FireIcon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                {analytics.totalSaves.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                All time
              </p>
            </div>

            <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total XP Spent</h3>
                <CurrencyDollarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                {analytics.totalXPSpent.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Avg: {Math.round(analytics.averageCost)} XP/save
              </p>
            </div>

            <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Unique Users</h3>
                <UsersIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                {analytics.uniqueUsers.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Who saved streaks
              </p>
            </div>

            <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Conversion Rate</h3>
                <ArrowTrendingUpIcon className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                {(analytics.conversionRate * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Saves / breaks
              </p>
            </div>
          </div>

          {/* Time-based stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <ClockIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 dark:text-gray-400" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">Last 7 Days</h3>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                {analytics.savesLast7Days.toLocaleString()}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                {(analytics.savesLast7Days / 7).toFixed(1)} saves/day
              </p>
            </div>

            <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <ClockIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 dark:text-gray-400" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">Last 30 Days</h3>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                {analytics.savesLast30Days.toLocaleString()}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                {(analytics.savesLast30Days / 30).toFixed(1)} saves/day
              </p>
            </div>

            <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <ChartBarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 dark:text-gray-400" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">Most Common</h3>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                Day {analytics.mostCommonDaysSince}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                Days since last activity
              </p>
            </div>
          </div>

          {/* Insights */}
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Insights</h3>
            <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              <p>
                💡 <strong>Average save cost:</strong> {Math.round(analytics.averageCost)} XP per streak save
              </p>
              <p>
                💡 <strong>Usage rate:</strong> {analytics.uniqueUsers} users have saved their streaks at least once
              </p>
              <p>
                💡 <strong>Recent activity:</strong> {analytics.savesLast7Days} saves in the last week ({((analytics.savesLast7Days / Math.max(analytics.totalSaves, 1)) * 100).toFixed(1)}% of all-time saves)
              </p>
              <p>
                💡 <strong>Most users save:</strong> {analytics.mostCommonDaysSince} {analytics.mostCommonDaysSince === 1 ? 'day' : 'days'} after their last activity
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Tab */}
      {activeTab === 'config' && config && (
        <div className="space-y-4 sm:space-y-6">
          {/* Basic Streak Settings */}
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Basic Settings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Min XP for Streak
                </label>
                <input
                  type="number"
                  value={config.minXPForStreak}
                  onChange={(e) => setConfig({ ...config, minXPForStreak: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Minimum XP needed to count for daily streak
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Grace Period (hours)
                </label>
                <input
                  type="number"
                  value={config.gracePeriodHours}
                  onChange={(e) => setConfig({ ...config, gracePeriodHours: parseInt(e.target.value) || 24 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Hours allowed between activities before streak breaks
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reset Time (UTC)
                </label>
                <input
                  type="text"
                  value={config.resetTime}
                  onChange={(e) => setConfig({ ...config, resetTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                  placeholder="HH:MM"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Time when daily streak resets (24-hour format)
                </p>
              </div>
            </div>
          </div>

          {/* Streak Save Settings */}
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 gap-2">
              <h2 className="text-base sm:text-xl font-bold text-gray-900 dark:text-gray-100">Streak Save (XP Trade)</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.streakSave?.enabled || false}
                  onChange={(e) => setConfig({
                    ...config,
                    streakSave: { ...(config.streakSave || {} as any), enabled: e.target.checked }
                  })}
                  className="w-4 h-4 text-primary-600 border-gray-300 dark:border-dark-600 rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {config.streakSave?.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>

            {config.streakSave && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Base Cost (XP)
                    </label>
                    <input
                      type="number"
                      value={config.streakSave.baseCost}
                      onChange={(e) => setConfig({
                        ...config,
                        streakSave: { ...config.streakSave!, baseCost: parseInt(e.target.value) || 25 }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Max Save Window (days)
                    </label>
                    <input
                      type="number"
                      value={config.streakSave.maxSaveWindow}
                      onChange={(e) => setConfig({
                        ...config,
                        streakSave: { ...config.streakSave!, maxSaveWindow: parseInt(e.target.value) || 3 }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Days after break to allow save
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Surge Multiplier
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={config.streakSave.surgeMultiplier}
                      onChange={(e) => setConfig({
                        ...config,
                        streakSave: { ...config.streakSave!, surgeMultiplier: parseFloat(e.target.value) || 1.0 }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="flex flex-col justify-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.streakSave.surgePricing}
                        onChange={(e) => setConfig({
                          ...config,
                          streakSave: { ...config.streakSave!, surgePricing: e.target.checked }
                        })}
                        className="w-4 h-4 text-primary-600 border-gray-300 dark:border-dark-600 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Surge Pricing
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer mt-2">
                      <input
                        type="checkbox"
                        checked={config.streakSave.requiresPremium}
                        onChange={(e) => setConfig({
                          ...config,
                          streakSave: { ...config.streakSave!, requiresPremium: e.target.checked }
                        })}
                        className="w-4 h-4 text-primary-600 border-gray-300 dark:border-dark-600 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Premium Only
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={config.streakSave.description}
                    onChange={(e) => setConfig({
                      ...config,
                      streakSave: { ...config.streakSave!, description: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Cost Formula
                  </h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    {config.streakSave.surgePricing
                      ? `Cost = ${config.streakSave.baseCost} XP × (days inactive)`
                      : `Cost = ${config.streakSave.baseCost} XP (fixed)`
                    }
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Example: 3 days inactive = {config.streakSave.surgePricing ? config.streakSave.baseCost * 3 : config.streakSave.baseCost} XP
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Streak Freeze Settings */}
          {config.streakFreeze && (
            <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 gap-2">
                <h2 className="text-base sm:text-xl font-bold text-gray-900 dark:text-gray-100">Streak Freeze</h2>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.streakFreeze.enabled}
                    onChange={(e) => setConfig({
                      ...config,
                      streakFreeze: { ...config.streakFreeze!, enabled: e.target.checked }
                    })}
                    className="w-4 h-4 text-primary-600 border-gray-300 dark:border-dark-600 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {config.streakFreeze.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Freezes
                  </label>
                  <input
                    type="number"
                    value={config.streakFreeze.maxFreezes}
                    onChange={(e) => setConfig({
                      ...config,
                      streakFreeze: { ...config.streakFreeze!, maxFreezes: parseInt(e.target.value) || 3 }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Freeze Duration (days)
                  </label>
                  <input
                    type="number"
                    value={config.streakFreeze.freezeDurationDays}
                    onChange={(e) => setConfig({
                      ...config,
                      streakFreeze: { ...config.streakFreeze!, freezeDurationDays: parseInt(e.target.value) || 1 }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={config.streakFreeze.requiresPremium}
                      onChange={(e) => setConfig({
                        ...config,
                        streakFreeze: { ...config.streakFreeze!, requiresPremium: e.target.checked }
                      })}
                      className="w-4 h-4 text-primary-600 border-gray-300 dark:border-dark-600 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Premium Only
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* JSON Preview */}
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6">
            <h2 className="text-base sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Configuration JSON</h2>
            <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-3 sm:p-4 overflow-x-auto">
              <pre className="text-xs text-gray-800 dark:text-gray-200 font-mono">
                {JSON.stringify(config, null, 2)}
              </pre>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 break-all">
              File: <code className="bg-gray-100 dark:bg-dark-700 px-1 py-0.5 rounded">src/config/gamification/streak.json</code>
            </p>
          </div>
        </div>
      )}

      {/* Recent Saves Tab */}
      {activeTab === 'logs' && analytics && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-dark-700">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">Recent Streak Saves</h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                Last {analytics.recentSaves.length} streak saves
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                <thead className="bg-gray-50 dark:bg-dark-700">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      User ID
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Streak
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      XP
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                      Days
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-dark-800 divide-y divide-gray-200 dark:divide-dark-700">
                  {analytics.recentSaves.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 sm:px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        No streak saves yet
                      </td>
                    </tr>
                  ) : (
                    analytics.recentSaves.map((save, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-mono text-gray-900 dark:text-gray-100">
                          {save.userId.substring(0, 6)}...
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-1">
                            <FireIcon className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
                            <span className="hidden xs:inline">{save.streakSaved} days</span>
                            <span className="inline xs:hidden">{save.streakSaved}d</span>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                          {save.xpDeducted}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100 hidden sm:table-cell">
                          {save.daysSinceActivity} days
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                          {new Date(save.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
