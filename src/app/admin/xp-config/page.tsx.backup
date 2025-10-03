'use client'

import { useState, useEffect } from 'react'
import { useAdmin } from '@/hooks/useAdmin'
import { useToast } from '@/components/ui/Toast'
import Link from 'next/link'
import { Switch } from '@headlessui/react'

interface ActivityConfig {
  id: string
  name: string
  description: string
  enabled: boolean
  baseXP: number
  maxPerSession: number
  cooldownMinutes: number
  countsForStreak: boolean
  bonuses?: Record<string, any>
  rewards?: Record<string, any>
  thresholds?: Record<string, any>
}

interface XPConfig {
  version: string
  lastUpdated: string
  minXPForStreak: number
  antiCheat: {
    enabled: boolean
    globalDailyLimit: number
    suspiciousThreshold: number
  }
  activities: Record<string, ActivityConfig>
}

export default function XPConfigPage() {
  const { isAdmin, isLoading: adminLoading, user } = useAdmin()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<XPConfig | null>(null)
  const [editingActivity, setEditingActivity] = useState<string | null>(null)
  const [testCalculation, setTestCalculation] = useState<any>(null)

  useEffect(() => {
    // Wait for admin check to complete
    if (adminLoading) {
      return
    }

    if (isAdmin) {
      console.log('XPConfigPage: User is admin, loading config')
      loadConfig()
    } else {
      console.log('XPConfigPage: User is not admin')
      setLoading(false)
    }
  }, [isAdmin, adminLoading])

  const loadConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/xp-config', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setConfig(data.config)
        console.log('[XP Config] Loaded configuration:', data.config)
      } else {
        console.error('Failed to load XP config:', response.status, response.statusText)
        const errorData = await response.json().catch(() => ({}))
        console.error('Error details:', errorData)
      }
    } catch (error) {
      console.error('[XP Config] Error loading:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    if (!config) return

    setSaving(true)
    try {
      const response = await fetch('/api/admin/xp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ config })
      })

      if (!response.ok) {
        console.error('Failed to save config:', response.status)
        showToast('Failed to save configuration', 'error')
        return
      }

      showToast('XP configuration saved successfully', 'success')
      await loadConfig()
    } catch (error) {
      console.error('[XP Config] Error saving:', error)
      showToast('Failed to save configuration', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleActivity = (activityId: string) => {
    if (!config) return

    setConfig({
      ...config,
      activities: {
        ...config.activities,
        [activityId]: {
          ...config.activities[activityId],
          enabled: !config.activities[activityId].enabled
        }
      }
    })
  }

  const updateActivityValue = (activityId: string, field: string, value: any) => {
    if (!config) return

    setConfig({
      ...config,
      activities: {
        ...config.activities,
        [activityId]: {
          ...config.activities[activityId],
          [field]: value
        }
      }
    })
  }

  const testXPCalculation = async (activityId: string) => {
    try {
      const response = await fetch('/api/admin/xp-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ activityId })
      })

      if (!response.ok) {
        console.error('Failed to test calculation:', response.status)
        showToast('Failed to test calculation', 'error')
        return
      }

      const data = await response.json()
      setTestCalculation(data.calculation)
      showToast(`Test calculation: ${data.calculation.cappedXP} XP`, 'info')
    } catch (error) {
      console.error('[XP Config] Error testing:', error)
      showToast('Failed to test calculation', 'error')
    }
  }

  // Show loading state while checking admin status or loading config
  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light to-background-alt dark:from-dark-850 dark:to-dark-900">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              {adminLoading ? 'Checking permissions...' : 'Loading XP configuration...'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Check admin access
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light to-background-alt dark:from-dark-850 dark:to-dark-900">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Access Denied
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You need admin privileges to access this page.
            </p>
            <Link
              href="/dashboard"
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-alt dark:from-dark-850 dark:to-dark-900">
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                    XP Configuration
                  </h1>
                  <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    Manage XP awards for all activities
                  </p>
                </div>
                <button
                  onClick={saveConfig}
                  disabled={saving}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

              {/* Global Settings */}
              {config && (
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Min XP for Streak
                    </label>
                    <input
                      type="number"
                      value={config.minXPForStreak}
                      onChange={(e) => setConfig({
                        ...config,
                        minXPForStreak: parseInt(e.target.value)
                      })}
                      className="mt-1 w-full px-3 py-2 border rounded-lg dark:bg-dark-700 dark:border-dark-600 text-sm sm:text-base"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Daily XP Limit
                    </label>
                    <input
                      type="number"
                      value={config.antiCheat.globalDailyLimit}
                      onChange={(e) => setConfig({
                        ...config,
                        antiCheat: {
                          ...config.antiCheat,
                          globalDailyLimit: parseInt(e.target.value)
                        }
                      })}
                      className="mt-1 w-full px-3 py-2 border rounded-lg dark:bg-dark-700 dark:border-dark-600 text-sm sm:text-base"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Suspicious Threshold
                    </label>
                    <input
                      type="number"
                      value={config.antiCheat.suspiciousThreshold}
                      onChange={(e) => setConfig({
                        ...config,
                        antiCheat: {
                          ...config.antiCheat,
                          suspiciousThreshold: parseInt(e.target.value)
                        }
                      })}
                      className="mt-1 w-full px-3 py-2 border rounded-lg dark:bg-dark-700 dark:border-dark-600 text-sm sm:text-base"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Activities - Mobile Cards / Desktop Table */}
            <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm">
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-dark-750">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Activity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Base XP
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Max/Session
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Cooldown
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Streak
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-dark-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {config && Object.values(config.activities).map((activity) => (
                      <tr key={activity.id} className={!activity.enabled ? 'opacity-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {activity.name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {activity.description}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Switch
                            checked={activity.enabled}
                            onChange={() => toggleActivity(activity.id)}
                            className={`${
                              activity.enabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'
                            } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                          >
                            <span className="sr-only">Enable {activity.name}</span>
                            <span
                              className={`${
                                activity.enabled ? 'translate-x-6' : 'translate-x-1'
                              } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                            />
                          </Switch>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingActivity === activity.id ? (
                            <input
                              type="number"
                              value={activity.baseXP}
                              onChange={(e) => updateActivityValue(activity.id, 'baseXP', parseInt(e.target.value))}
                              className="w-20 px-2 py-1 border rounded dark:bg-dark-700 dark:border-dark-600"
                              onBlur={() => setEditingActivity(null)}
                            />
                          ) : (
                            <span
                              onClick={() => setEditingActivity(activity.id)}
                              className="cursor-pointer text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-dark-700 px-2 py-1 rounded"
                            >
                              {activity.baseXP} XP
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {activity.maxPerSession} XP
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {activity.cooldownMinutes} min
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            activity.countsForStreak
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {activity.countsForStreak ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => testXPCalculation(activity.id)}
                            className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                          >
                            Test
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
                {config && Object.values(config.activities).map((activity) => (
                  <div key={activity.id} className={`p-4 ${!activity.enabled ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
                          {activity.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {activity.description}
                        </p>
                      </div>
                      <Switch
                        checked={activity.enabled}
                        onChange={() => toggleActivity(activity.id)}
                        className={`${
                          activity.enabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'
                        } relative inline-flex h-6 w-11 items-center rounded-full transition-colors ml-3`}
                      >
                        <span className="sr-only">Enable {activity.name}</span>
                        <span
                          className={`${
                            activity.enabled ? 'translate-x-6' : 'translate-x-1'
                          } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                      </Switch>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Base XP:</span>
                        {editingActivity === activity.id ? (
                          <input
                            type="number"
                            value={activity.baseXP}
                            onChange={(e) => updateActivityValue(activity.id, 'baseXP', parseInt(e.target.value))}
                            className="mt-1 w-full px-2 py-1 border rounded dark:bg-dark-700 dark:border-dark-600 text-sm"
                            onBlur={() => setEditingActivity(null)}
                            autoFocus
                          />
                        ) : (
                          <p
                            onClick={() => setEditingActivity(activity.id)}
                            className="font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-700 px-1 py-0.5 rounded"
                          >
                            {activity.baseXP} XP
                          </p>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Max/Session:</span>
                        <p className="font-medium">{activity.maxPerSession} XP</p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Cooldown:</span>
                        <p className="font-medium">{activity.cooldownMinutes} min</p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Counts for Streak:</span>
                        <p className="font-medium">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            activity.countsForStreak
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {activity.countsForStreak ? 'Yes' : 'No'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <button
                        onClick={() => testXPCalculation(activity.id)}
                        className="w-full px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        Test Calculation
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Calculation Result */}
            {testCalculation && (
              <div className="mt-6 bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6">
                <h3 className="text-lg font-semibold mb-4">Test Calculation Result</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Activity:</span>
                    <p className="font-medium">{testCalculation.activityId}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Base XP:</span>
                    <p className="font-medium">{testCalculation.baseXP}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Bonus XP:</span>
                    <p className="font-medium">{testCalculation.bonusXP}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Final XP:</span>
                    <p className="font-medium text-primary-600">{testCalculation.cappedXP}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
      </main>
    </div>
  )
}