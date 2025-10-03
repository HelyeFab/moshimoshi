'use client'

import { useState, useEffect } from 'react'
import { useAdmin } from '@/hooks/useAdmin'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'
import Link from 'next/link'
import { Switch } from '@headlessui/react'
import { PlusIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'

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
  antiCheat: {
    enabled: boolean
    globalDailyLimit: number
    suspiciousThreshold: number
  }
  activities: Record<string, ActivityConfig>
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
  notifications?: {
    enabled: boolean
    reminderHours: number[]
    description: string
  }
}

interface GamificationConfig {
  version: string
  baseXP: number
  bonuses: {
    accuracy: Array<{ threshold: number; multiplier: number; description: string }>
    speed: { thresholdMs: number; bonus: number; description: string }
    streak: { minStreak: number; bonusPerItem: number; maxBonus: number; description: string }
  }
  dailyXPCap: number
  antiCheat: {
    enabled: boolean
    maxPerSession: number
    suspiciousThreshold: number
    logSuspiciousActivity: boolean
  }
}

type TabType = 'activities' | 'gamification' | 'global'

export default function XPConfigPage() {
  const { isAdmin, isLoading: adminLoading } = useAdmin()
  const { showToast } = useToast()
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<XPConfig | null>(null)
  const [gamificationConfig, setGamificationConfig] = useState<GamificationConfig | null>(null)
  const [streakConfig, setStreakConfig] = useState<StreakConfig | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('activities')
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set())
  const [editingActivity, setEditingActivity] = useState<string | null>(null)

  useEffect(() => {
    if (adminLoading) return
    if (isAdmin) {
      loadConfigs()
    } else {
      setLoading(false)
    }
  }, [isAdmin, adminLoading])

  const loadConfigs = async () => {
    try {
      setLoading(true)
      const [activityRes, gamificationRes, streakRes] = await Promise.all([
        fetch('/api/admin/xp-config', { credentials: 'include' }),
        fetch('/api/admin/gamification-xp-config', { credentials: 'include' }),
        fetch('/api/admin/streak-config', { credentials: 'include' })
      ])

      if (activityRes.ok) {
        const data = await activityRes.json()
        setConfig(data.config)
      }

      if (gamificationRes.ok) {
        const data = await gamificationRes.json()
        setGamificationConfig(data.config)
      }

      if (streakRes.ok) {
        const data = await streakRes.json()
        setStreakConfig(data.config)
      }
    } catch (error) {
      console.error('[XP Config] Error loading:', error)
      showToast('Failed to load configuration', 'error')
    } finally {
      setLoading(false)
    }
  }

  const saveActivityConfig = async () => {
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
        throw new Error('Failed to save')
      }

      showToast('Activity configuration saved', 'success')
      await loadConfigs()
    } catch (error) {
      showToast('Failed to save configuration', 'error')
    } finally {
      setSaving(false)
    }
  }

  const saveGamificationConfig = async () => {
    if (!gamificationConfig) return
    setSaving(true)
    try {
      const response = await fetch('/api/admin/gamification-xp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ config: gamificationConfig })
      })

      if (!response.ok) {
        throw new Error('Failed to save')
      }

      showToast('Gamification configuration saved', 'success')
      await loadConfigs()
    } catch (error) {
      showToast('Failed to save configuration', 'error')
    } finally {
      setSaving(false)
    }
  }

  const saveStreakConfig = async () => {
    if (!streakConfig) return
    setSaving(true)
    try {
      const response = await fetch('/api/admin/streak-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ config: streakConfig })
      })

      if (!response.ok) {
        throw new Error('Failed to save')
      }

      showToast('Streak configuration saved', 'success')
      await loadConfigs()
    } catch (error) {
      showToast('Failed to save streak configuration', 'error')
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

  const updateActivity = (activityId: string, field: keyof ActivityConfig, value: any) => {
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

  const updateNestedField = (activityId: string, section: 'bonuses' | 'rewards' | 'thresholds', key: string, value: any) => {
    if (!config) return
    const activity = config.activities[activityId]
    setConfig({
      ...config,
      activities: {
        ...config.activities,
        [activityId]: {
          ...activity,
          [section]: {
            ...(activity[section] || {}),
            [key]: value
          }
        }
      }
    })
  }

  const deleteNestedField = (activityId: string, section: 'bonuses' | 'rewards' | 'thresholds', key: string) => {
    if (!config) return
    const activity = config.activities[activityId]
    const newSection = { ...(activity[section] || {}) }
    delete newSection[key]
    setConfig({
      ...config,
      activities: {
        ...config.activities,
        [activityId]: {
          ...activity,
          [section]: newSection
        }
      }
    })
  }

  const addNestedField = (activityId: string, section: 'bonuses' | 'rewards' | 'thresholds') => {
    const key = prompt(`Enter new ${section.slice(0, -1)} key:`)
    if (!key) return
    updateNestedField(activityId, section, key, 0)
  }

  const addNewActivity = () => {
    if (!config) return
    const id = prompt('Enter activity ID (e.g., "new_activity"):')
    if (!id || config.activities[id]) {
      showToast('Invalid or duplicate activity ID', 'error')
      return
    }

    setConfig({
      ...config,
      activities: {
        ...config.activities,
        [id]: {
          id,
          name: 'New Activity',
          description: 'Description here',
          enabled: false,
          baseXP: 10,
          maxPerSession: 100,
          cooldownMinutes: 5,
          countsForStreak: true,
          rewards: {},
          bonuses: {},
          thresholds: {}
        }
      }
    })
    setExpandedActivities(new Set([...expandedActivities, id]))
  }

  const deleteActivity = (activityId: string) => {
    if (!config) return
    if (!confirm(`Delete activity "${config.activities[activityId].name}"?`)) return
    const newActivities = { ...config.activities }
    delete newActivities[activityId]
    setConfig({ ...config, activities: newActivities })
  }

  const toggleExpanded = (activityId: string) => {
    const newExpanded = new Set(expandedActivities)
    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId)
    } else {
      newExpanded.add(activityId)
    }
    setExpandedActivities(newExpanded)
  }

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light to-background-alt dark:from-dark-850 dark:to-dark-900">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">{t('common.loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light to-background-alt dark:from-dark-850 dark:to-dark-900">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Access Denied</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">You need admin privileges.</p>
            <Link href="/dashboard" className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-alt dark:from-dark-850 dark:to-dark-900">
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
                  Manage all XP rewards, bonuses, and activities
                </p>
              </div>
              <button
                onClick={async () => {
                  if (activeTab === 'activities') {
                    await saveActivityConfig()
                  } else if (activeTab === 'gamification') {
                    await saveGamificationConfig()
                    await saveStreakConfig()
                  } else if (activeTab === 'global') {
                    await saveActivityConfig()
                  }
                }}
                disabled={saving}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mt-6 border-b border-gray-200 dark:border-dark-700">
              <button
                onClick={() => setActiveTab('activities')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'activities'
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Activities ({config ? Object.keys(config.activities).length : 0})
              </button>
              <button
                onClick={() => setActiveTab('gamification')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'gamification'
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Bonus Multipliers
              </button>
              <button
                onClick={() => setActiveTab('global')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'global'
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Global Settings
              </button>
            </div>
          </div>

          {/* Activities Tab */}
          {activeTab === 'activities' && config && (
            <>
              <button
                onClick={addNewActivity}
                className="mb-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <PlusIcon className="w-5 h-5" />
                Add New Activity
              </button>

              <div className="space-y-4">
                {Object.values(config.activities).map((activity) => (
                  <div key={activity.id} className="bg-white dark:bg-dark-800 rounded-lg shadow-sm overflow-hidden">
                    {/* Activity Header */}
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <Switch
                          checked={activity.enabled}
                          onChange={() => toggleActivity(activity.id)}
                          className={`${
                            activity.enabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'
                          } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                        >
                          <span className="sr-only">Enable</span>
                          <span
                            className={`${
                              activity.enabled ? 'translate-x-6' : 'translate-x-1'
                            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                          />
                        </Switch>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {activity.name}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{activity.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => deleteActivity(activity.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete activity"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => toggleExpanded(activity.id)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                        >
                          {expandedActivities.has(activity.id) ? (
                            <ChevronUpIcon className="w-5 h-5" />
                          ) : (
                            <ChevronDownIcon className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {expandedActivities.has(activity.id) && (
                      <div className="p-4 pt-0 space-y-6">
                        {/* Basic Fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Name
                            </label>
                            <input
                              type="text"
                              value={activity.name}
                              onChange={(e) => updateActivity(activity.id, 'name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Base XP
                            </label>
                            <input
                              type="number"
                              value={activity.baseXP}
                              onChange={(e) => updateActivity(activity.id, 'baseXP', parseInt(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Max/Session
                            </label>
                            <input
                              type="number"
                              value={activity.maxPerSession}
                              onChange={(e) => updateActivity(activity.id, 'maxPerSession', parseInt(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Cooldown (min)
                            </label>
                            <input
                              type="number"
                              value={activity.cooldownMinutes}
                              onChange={(e) => updateActivity(activity.id, 'cooldownMinutes', parseInt(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Description
                          </label>
                          <input
                            type="text"
                            value={activity.description}
                            onChange={(e) => updateActivity(activity.id, 'description', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                          />
                        </div>

                        {/* Bonuses Section */}
                        {activity.bonuses && Object.keys(activity.bonuses).length > 0 && (
                          <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Bonuses</h4>
                              <button
                                onClick={() => addNestedField(activity.id, 'bonuses')}
                                className="text-sm text-primary-600 hover:text-primary-700"
                              >
                                + Add Bonus
                              </button>
                            </div>
                            <div className="space-y-2">
                              {Object.entries(activity.bonuses).map(([key, value]) => (
                                <div key={key} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={key}
                                    readOnly
                                    className="flex-1 px-3 py-2 bg-gray-100 dark:bg-dark-600 rounded border-0 text-sm text-gray-600 dark:text-gray-400"
                                  />
                                  <input
                                    type="text"
                                    value={typeof value === 'object' ? JSON.stringify(value) : value}
                                    onChange={(e) => {
                                      try {
                                        const parsed = JSON.parse(e.target.value)
                                        updateNestedField(activity.id, 'bonuses', key, parsed)
                                      } catch {
                                        updateNestedField(activity.id, 'bonuses', key, e.target.value)
                                      }
                                    }}
                                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500"
                                  />
                                  <button
                                    onClick={() => deleteNestedField(activity.id, 'bonuses', key)}
                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Rewards Section */}
                        {activity.rewards && Object.keys(activity.rewards).length > 0 && (
                          <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Rewards</h4>
                              <button
                                onClick={() => addNestedField(activity.id, 'rewards')}
                                className="text-sm text-primary-600 hover:text-primary-700"
                              >
                                + Add Reward
                              </button>
                            </div>
                            <div className="space-y-2">
                              {Object.entries(activity.rewards).map(([key, value]) => (
                                <div key={key} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={key}
                                    readOnly
                                    className="flex-1 px-3 py-2 bg-gray-100 dark:bg-dark-600 rounded border-0 text-sm text-gray-600 dark:text-gray-400"
                                  />
                                  <input
                                    type="number"
                                    value={value as number}
                                    onChange={(e) => updateNestedField(activity.id, 'rewards', key, parseFloat(e.target.value) || 0)}
                                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500"
                                  />
                                  <button
                                    onClick={() => deleteNestedField(activity.id, 'rewards', key)}
                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Thresholds Section */}
                        {activity.thresholds && Object.keys(activity.thresholds).length > 0 && (
                          <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Thresholds</h4>
                              <button
                                onClick={() => addNestedField(activity.id, 'thresholds')}
                                className="text-sm text-primary-600 hover:text-primary-700"
                              >
                                + Add Threshold
                              </button>
                            </div>
                            <div className="space-y-2">
                              {Object.entries(activity.thresholds).map(([key, value]) => (
                                <div key={key} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={key}
                                    readOnly
                                    className="flex-1 px-3 py-2 bg-gray-100 dark:bg-dark-600 rounded border-0 text-sm text-gray-600 dark:text-gray-400"
                                  />
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={value as number}
                                    onChange={(e) => updateNestedField(activity.id, 'thresholds', key, parseFloat(e.target.value) || 0)}
                                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500"
                                  />
                                  <button
                                    onClick={() => deleteNestedField(activity.id, 'thresholds', key)}
                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Add Section Buttons */}
                        <div className="flex gap-2">
                          {!activity.bonuses && (
                            <button
                              onClick={() => updateActivity(activity.id, 'bonuses', {})}
                              className="text-sm px-3 py-1 bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded hover:bg-primary-200 dark:hover:bg-primary-900/30"
                            >
                              + Add Bonuses Section
                            </button>
                          )}
                          {!activity.rewards && (
                            <button
                              onClick={() => updateActivity(activity.id, 'rewards', {})}
                              className="text-sm px-3 py-1 bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded hover:bg-primary-200 dark:hover:bg-primary-900/30"
                            >
                              + Add Rewards Section
                            </button>
                          )}
                          {!activity.thresholds && (
                            <button
                              onClick={() => updateActivity(activity.id, 'thresholds', {})}
                              className="text-sm px-3 py-1 bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded hover:bg-primary-200 dark:hover:bg-primary-900/30"
                            >
                              + Add Thresholds Section
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Gamification Tab */}
          {activeTab === 'gamification' && gamificationConfig && (
            <div className="space-y-6">
              {/* Base Settings */}
              <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Base Settings</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Base XP per Item
                    </label>
                    <input
                      type="number"
                      value={gamificationConfig.baseXP}
                      onChange={(e) => setGamificationConfig({ ...gamificationConfig, baseXP: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Daily XP Cap
                    </label>
                    <input
                      type="number"
                      value={gamificationConfig.dailyXPCap}
                      onChange={(e) => setGamificationConfig({ ...gamificationConfig, dailyXPCap: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Accuracy Bonuses */}
              <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Accuracy Bonuses</h2>
                <div className="space-y-4">
                  {gamificationConfig.bonuses.accuracy.map((bonus, index) => (
                    <div key={index} className="p-4 bg-gray-50 dark:bg-dark-700 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Threshold (%)
                        </label>
                        <input
                          type="number"
                          value={bonus.threshold}
                          onChange={(e) => {
                            const newAccuracy = [...gamificationConfig.bonuses.accuracy]
                            newAccuracy[index] = { ...bonus, threshold: parseInt(e.target.value) || 0 }
                            setGamificationConfig({ ...gamificationConfig, bonuses: { ...gamificationConfig.bonuses, accuracy: newAccuracy } })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Multiplier
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={bonus.multiplier}
                          onChange={(e) => {
                            const newAccuracy = [...gamificationConfig.bonuses.accuracy]
                            newAccuracy[index] = { ...bonus, multiplier: parseFloat(e.target.value) || 1 }
                            setGamificationConfig({ ...gamificationConfig, bonuses: { ...gamificationConfig.bonuses, accuracy: newAccuracy } })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Description
                        </label>
                        <input
                          type="text"
                          value={bonus.description}
                          onChange={(e) => {
                            const newAccuracy = [...gamificationConfig.bonuses.accuracy]
                            newAccuracy[index] = { ...bonus, description: e.target.value }
                            setGamificationConfig({ ...gamificationConfig, bonuses: { ...gamificationConfig.bonuses, accuracy: newAccuracy } })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Speed & Streak Bonuses - Similar structure */}
              <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Speed Bonus</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Threshold (ms)</label>
                    <input
                      type="number"
                      value={gamificationConfig.bonuses.speed.thresholdMs}
                      onChange={(e) => setGamificationConfig({
                        ...gamificationConfig,
                        bonuses: { ...gamificationConfig.bonuses, speed: { ...gamificationConfig.bonuses.speed, thresholdMs: parseInt(e.target.value) || 0 } }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bonus XP</label>
                    <input
                      type="number"
                      value={gamificationConfig.bonuses.speed.bonus}
                      onChange={(e) => setGamificationConfig({
                        ...gamificationConfig,
                        bonuses: { ...gamificationConfig.bonuses, speed: { ...gamificationConfig.bonuses.speed, bonus: parseInt(e.target.value) || 0 } }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                    <input
                      type="text"
                      value={gamificationConfig.bonuses.speed.description}
                      onChange={(e) => setGamificationConfig({
                        ...gamificationConfig,
                        bonuses: { ...gamificationConfig.bonuses, speed: { ...gamificationConfig.bonuses.speed, description: e.target.value } }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Streak Bonus</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Min Streak</label>
                    <input
                      type="number"
                      value={gamificationConfig.bonuses.streak.minStreak}
                      onChange={(e) => setGamificationConfig({
                        ...gamificationConfig,
                        bonuses: { ...gamificationConfig.bonuses, streak: { ...gamificationConfig.bonuses.streak, minStreak: parseInt(e.target.value) || 0 } }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bonus/Item</label>
                    <input
                      type="number"
                      value={gamificationConfig.bonuses.streak.bonusPerItem}
                      onChange={(e) => setGamificationConfig({
                        ...gamificationConfig,
                        bonuses: { ...gamificationConfig.bonuses, streak: { ...gamificationConfig.bonuses.streak, bonusPerItem: parseInt(e.target.value) || 0 } }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Max Bonus</label>
                    <input
                      type="number"
                      value={gamificationConfig.bonuses.streak.maxBonus}
                      onChange={(e) => setGamificationConfig({
                        ...gamificationConfig,
                        bonuses: { ...gamificationConfig.bonuses, streak: { ...gamificationConfig.bonuses.streak, maxBonus: parseInt(e.target.value) || 0 } }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                    <input
                      type="text"
                      value={gamificationConfig.bonuses.streak.description}
                      onChange={(e) => setGamificationConfig({
                        ...gamificationConfig,
                        bonuses: { ...gamificationConfig.bonuses, streak: { ...gamificationConfig.bonuses.streak, description: e.target.value } }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Streak Settings */}
              <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Streak Configuration</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Control when daily streaks are counted and reset behavior
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Min XP for Streak
                    </label>
                    <input
                      type="number"
                      value={streakConfig?.minXPForStreak || 10}
                      onChange={(e) => streakConfig && setStreakConfig({ ...streakConfig, minXPForStreak: parseInt(e.target.value) || 10 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                      min="0"
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
                      value={streakConfig?.gracePeriodHours || 24}
                      onChange={(e) => streakConfig && setStreakConfig({ ...streakConfig, gracePeriodHours: parseInt(e.target.value) || 24 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                      min="0"
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
                      value={streakConfig?.resetTime || '00:00'}
                      onChange={(e) => streakConfig && setStreakConfig({ ...streakConfig, resetTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                      placeholder="HH:MM"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Time when daily streak resets (24-hour format)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Global Settings Tab */}
          {activeTab === 'global' && config && gamificationConfig && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Activity System Anti-Cheat</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Global Daily Limit
                    </label>
                    <input
                      type="number"
                      value={config.antiCheat.globalDailyLimit}
                      onChange={(e) => setConfig({
                        ...config,
                        antiCheat: { ...config.antiCheat, globalDailyLimit: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Maximum XP across all activities per day
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Suspicious Threshold
                    </label>
                    <input
                      type="number"
                      value={config.antiCheat.suspiciousThreshold}
                      onChange={(e) => setConfig({
                        ...config,
                        antiCheat: { ...config.antiCheat, suspiciousThreshold: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      XP threshold for suspicious activity flagging
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Gamification Anti-Cheat</h2>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="gamificationAntiCheat"
                      checked={gamificationConfig.antiCheat.enabled}
                      onChange={(e) => setGamificationConfig({
                        ...gamificationConfig,
                        antiCheat: { ...gamificationConfig.antiCheat, enabled: e.target.checked }
                      })}
                      className="w-4 h-4 text-primary-600 border-gray-300 dark:border-dark-600 rounded focus:ring-primary-500"
                    />
                    <label htmlFor="gamificationAntiCheat" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable Gamification Anti-Cheat
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Max XP per Session
                      </label>
                      <input
                        type="number"
                        value={gamificationConfig.antiCheat.maxPerSession}
                        onChange={(e) => setGamificationConfig({
                          ...gamificationConfig,
                          antiCheat: { ...gamificationConfig.antiCheat, maxPerSession: parseInt(e.target.value) || 0 }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Suspicious Threshold
                      </label>
                      <input
                        type="number"
                        value={gamificationConfig.antiCheat.suspiciousThreshold}
                        onChange={(e) => setGamificationConfig({
                          ...gamificationConfig,
                          antiCheat: { ...gamificationConfig.antiCheat, suspiciousThreshold: parseInt(e.target.value) || 0 }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
