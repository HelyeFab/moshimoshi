'use client'

import { useState, useEffect } from 'react'
import { useAdmin } from '@/hooks/useAdmin'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'
import Link from 'next/link'

interface AccuracyBonus {
  threshold: number
  multiplier: number
  description: string
}

interface SpeedBonus {
  thresholdMs: number
  bonus: number
  description: string
}

interface StreakBonus {
  minStreak: number
  bonusPerItem: number
  maxBonus: number
  description: string
}

interface AntiCheat {
  enabled: boolean
  maxPerSession: number
  suspiciousThreshold: number
  logSuspiciousActivity: boolean
}

interface XPConfig {
  version: string
  baseXP: number
  bonuses: {
    accuracy: AccuracyBonus[]
    speed: SpeedBonus
    streak: StreakBonus
  }
  dailyXPCap: number
  antiCheat: AntiCheat
}

export default function GamificationXPConfigPage() {
  const { isAdmin, isLoading: adminLoading, user } = useAdmin()
  const { showToast } = useToast()
  const { t, strings } = useI18n()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<XPConfig | null>(null)

  useEffect(() => {
    if (adminLoading) {
      return
    }

    if (isAdmin) {
      console.log('GamificationXPConfigPage: User is admin, loading config')
      loadConfig()
    } else {
      console.log('GamificationXPConfigPage: User is not admin')
      setLoading(false)
    }
  }, [isAdmin, adminLoading])

  const loadConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/gamification-xp-config', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        console.log('[Gamification XP Config] API Response:', data)
        console.log('[Gamification XP Config] Config structure:', JSON.stringify(data.config, null, 2))
        setConfig(data.config)
      } else {
        console.error('Failed to load gamification XP config:', response.status, response.statusText)
        const errorData = await response.json().catch(() => ({}))
        console.error('Error details:', errorData)
        showToast('Failed to load configuration', 'error')
      }
    } catch (error) {
      console.error('[Gamification XP Config] Error loading:', error)
      showToast('Failed to load configuration', 'error')
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    if (!config) return

    setSaving(true)
    try {
      const response = await fetch('/api/admin/gamification-xp-config', {
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

      showToast('Configuration saved successfully', 'success')
      await loadConfig()
    } catch (error) {
      console.error('[Gamification XP Config] Error saving:', error)
      showToast('Failed to save configuration', 'error')
    } finally {
      setSaving(false)
    }
  }

  const updateAccuracyBonus = (index: number, field: keyof AccuracyBonus, value: any) => {
    if (!config) return

    console.log(`[Update] Accuracy bonus ${index}, field: ${field}, value:`, value)
    const newAccuracy = [...config.bonuses.accuracy]
    newAccuracy[index] = {
      ...newAccuracy[index],
      [field]: value
    }

    const newConfig = {
      ...config,
      bonuses: {
        ...config.bonuses,
        accuracy: newAccuracy
      }
    }
    console.log('[Update] New config:', newConfig)
    setConfig(newConfig)
  }

  // Show loading state while checking admin status or loading config
  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light to-background-alt dark:from-dark-850 dark:to-dark-900">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              {adminLoading ? t('common.loading') : 'Loading XP configuration...'}
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
              {t('common.accessDenied')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You need admin privileges to access this page.
            </p>
            <Link
              href="/dashboard"
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              {t('common.goToDashboard')}
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
                  Gamification XP Configuration
                </h1>
                <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
                  Configure XP rewards, bonuses, and anti-cheat settings
                </p>
              </div>
              <button
                onClick={saveConfig}
                disabled={saving}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {saving ? t('common.saving') : t('common.saveChanges')}
              </button>
            </div>
          </div>

          {config && (
            <>
              {/* Base Settings */}
              <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Base Settings
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Base XP per Item
                    </label>
                    <input
                      type="number"
                      value={config.baseXP}
                      onChange={(e) => setConfig({ ...config, baseXP: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      min="0"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Base XP awarded for each correct answer
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Daily XP Cap
                    </label>
                    <input
                      type="number"
                      value={config.dailyXPCap}
                      onChange={(e) => setConfig({ ...config, dailyXPCap: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      min="0"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Maximum XP a user can earn per day
                    </p>
                  </div>
                </div>
              </div>

              {/* Accuracy Bonuses */}
              <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Accuracy Bonuses
                </h2>
                <div className="space-y-4">
                  {config.bonuses.accuracy.map((bonus, index) => (
                    <div key={index} className="p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Threshold (%)
                          </label>
                          <input
                            type="number"
                            value={bonus.threshold}
                            onChange={(e) => updateAccuracyBonus(index, 'threshold', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                            min="0"
                            max="100"
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
                            onChange={(e) => updateAccuracyBonus(index, 'multiplier', parseFloat(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                            min="1"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Description
                          </label>
                          <input
                            type="text"
                            value={bonus.description}
                            onChange={(e) => updateAccuracyBonus(index, 'description', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Speed Bonus */}
              <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Speed Bonus
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Threshold (ms)
                    </label>
                    <input
                      type="number"
                      value={config.bonuses.speed.thresholdMs}
                      onChange={(e) => setConfig({
                        ...config,
                        bonuses: {
                          ...config.bonuses,
                          speed: {
                            ...config.bonuses.speed,
                            thresholdMs: parseInt(e.target.value) || 0
                          }
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                      min="0"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Average response time threshold
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Bonus XP
                    </label>
                    <input
                      type="number"
                      value={config.bonuses.speed.bonus}
                      onChange={(e) => setConfig({
                        ...config,
                        bonuses: {
                          ...config.bonuses,
                          speed: {
                            ...config.bonuses.speed,
                            bonus: parseInt(e.target.value) || 0
                          }
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      value={config.bonuses.speed.description}
                      onChange={(e) => setConfig({
                        ...config,
                        bonuses: {
                          ...config.bonuses,
                          speed: {
                            ...config.bonuses.speed,
                            description: e.target.value
                          }
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Streak Bonus */}
              <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Streak Bonus
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Min Streak
                    </label>
                    <input
                      type="number"
                      value={config.bonuses.streak.minStreak}
                      onChange={(e) => setConfig({
                        ...config,
                        bonuses: {
                          ...config.bonuses,
                          streak: {
                            ...config.bonuses.streak,
                            minStreak: parseInt(e.target.value) || 0
                          }
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Bonus per Item
                    </label>
                    <input
                      type="number"
                      value={config.bonuses.streak.bonusPerItem}
                      onChange={(e) => setConfig({
                        ...config,
                        bonuses: {
                          ...config.bonuses,
                          streak: {
                            ...config.bonuses.streak,
                            bonusPerItem: parseInt(e.target.value) || 0
                          }
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Max Bonus
                    </label>
                    <input
                      type="number"
                      value={config.bonuses.streak.maxBonus}
                      onChange={(e) => setConfig({
                        ...config,
                        bonuses: {
                          ...config.bonuses,
                          streak: {
                            ...config.bonuses.streak,
                            maxBonus: parseInt(e.target.value) || 0
                          }
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      value={config.bonuses.streak.description}
                      onChange={(e) => setConfig({
                        ...config,
                        bonuses: {
                          ...config.bonuses,
                          streak: {
                            ...config.bonuses.streak,
                            description: e.target.value
                          }
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Anti-Cheat Settings */}
              <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm p-4 sm:p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Anti-Cheat Settings
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="antiCheatEnabled"
                      checked={config.antiCheat.enabled}
                      onChange={(e) => setConfig({
                        ...config,
                        antiCheat: {
                          ...config.antiCheat,
                          enabled: e.target.checked
                        }
                      })}
                      className="w-4 h-4 text-primary-600 border-gray-300 dark:border-dark-600 rounded focus:ring-primary-500"
                    />
                    <label htmlFor="antiCheatEnabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable Anti-Cheat
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Max XP per Session
                      </label>
                      <input
                        type="number"
                        value={config.antiCheat.maxPerSession}
                        onChange={(e) => setConfig({
                          ...config,
                          antiCheat: {
                            ...config.antiCheat,
                            maxPerSession: parseInt(e.target.value) || 0
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                        min="0"
                      />
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
                          antiCheat: {
                            ...config.antiCheat,
                            suspiciousThreshold: parseInt(e.target.value) || 0
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                        min="0"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="logSuspicious"
                      checked={config.antiCheat.logSuspiciousActivity}
                      onChange={(e) => setConfig({
                        ...config,
                        antiCheat: {
                          ...config.antiCheat,
                          logSuspiciousActivity: e.target.checked
                        }
                      })}
                      className="w-4 h-4 text-primary-600 border-gray-300 dark:border-dark-600 rounded focus:ring-primary-500"
                    />
                    <label htmlFor="logSuspicious" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Log Suspicious Activity
                    </label>
                  </div>
                </div>
              </div>

              {/* Info Card */}
              <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-primary-900 dark:text-primary-200 mb-2">
                  Configuration Info
                </h3>
                <p className="text-sm text-primary-800 dark:text-primary-300">
                  Version: <strong>{config.version}</strong>
                </p>
                <p className="text-xs text-primary-700 dark:text-primary-400 mt-2">
                  Changes will take effect immediately for new sessions. Active sessions will use the previous configuration.
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
