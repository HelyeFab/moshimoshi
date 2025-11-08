'use client'

import { useEffect, useState } from 'react'
import { getAllFeatureFlags, updateFeatureFlag, resetAllFeatureFlags, type FeatureFlag, FEATURE_METADATA } from '@/lib/features/runtimeFeatureFlags'
import { useToast } from '@/components/ui/Toast/ToastContext'

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<Record<FeatureFlag, boolean> | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const { showToast } = useToast()

  useEffect(() => {
    loadFlags()
  }, [])

  async function loadFlags() {
    try {
      const currentFlags = await getAllFeatureFlags()
      setFlags(currentFlags)
    } catch (error) {
      showToast('Failed to load feature flags', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggle(flag: FeatureFlag, currentValue: boolean) {
    setUpdating(flag)
    try {
      await updateFeatureFlag(flag, !currentValue)
      setFlags(prev => prev ? { ...prev, [flag]: !currentValue } : null)
      showToast(`${FEATURE_METADATA[flag].name} ${!currentValue ? 'enabled' : 'disabled'}`, 'success')
    } catch (error) {
      showToast('Failed to update feature flag', 'error')
      console.error(error)
    } finally {
      setUpdating(null)
    }
  }

  async function handleResetAll() {
    if (!confirm('Are you sure you want to reset all feature flags to their defaults?')) {
      return
    }

    setLoading(true)
    try {
      await resetAllFeatureFlags()
      await loadFlags()
      showToast('All feature flags reset to defaults', 'success')
    } catch (error) {
      showToast('Failed to reset feature flags', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !flags) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading feature flags...</p>
        </div>
      </div>
    )
  }

  const flagsByCategory: Record<string, Array<{ flag: FeatureFlag; enabled: boolean }>> = {}

  // Group flags by category
  Object.entries(flags).forEach(([flag, enabled]) => {
    const metadata = FEATURE_METADATA[flag as FeatureFlag]
    if (!flagsByCategory[metadata.category]) {
      flagsByCategory[metadata.category] = []
    }
    flagsByCategory[metadata.category].push({ flag: flag as FeatureFlag, enabled })
  })

  return (
    <div>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Feature Flags
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Toggle features on/off in real-time
            </p>
          </div>
          <button
            onClick={handleResetAll}
            className="px-4 py-2 bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
          >
            Reset All to Defaults
          </button>
        </div>

        {/* Info Banner */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <span className="text-2xl">ℹ️</span>
            <div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                Real-time Feature Control
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Changes take effect immediately for all users. No rebuild or deployment required. Flags are stored in Firestore.
              </p>
            </div>
          </div>
        </div>

        {/* Feature Flags by Category */}
        <div className="space-y-6">
          {Object.entries(flagsByCategory)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, categoryFlags]) => (
              <div key={category} className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 dark:bg-dark-900/50 border-b border-gray-200 dark:border-dark-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {category}
                  </h2>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-dark-700">
                  {categoryFlags
                    .sort((a, b) => a.flag.localeCompare(b.flag))
                    .map(({ flag, enabled }) => {
                      const metadata = FEATURE_METADATA[flag]
                      const isUpdating = updating === flag
                      return (
                        <div key={flag} className="px-6 py-4 flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                                {metadata.name}
                              </h3>
                              <code className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-dark-700 rounded text-gray-600 dark:text-gray-400">
                                {flag}
                              </code>
                            </div>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                              {metadata.description}
                            </p>
                          </div>
                          <div className="ml-4 flex items-center gap-3">
                            {/* Status Badge */}
                            <div
                              className={`
                                px-3 py-1 rounded-full text-sm font-medium
                                ${enabled
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                }
                              `}
                            >
                              {enabled ? 'Enabled' : 'Disabled'}
                            </div>

                            {/* Toggle Switch */}
                            <button
                              onClick={() => handleToggle(flag, enabled)}
                              disabled={isUpdating}
                              className={`
                                relative inline-flex h-6 w-11 items-center rounded-full
                                transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                                ${enabled
                                  ? 'bg-primary-600 dark:bg-primary-500'
                                  : 'bg-gray-200 dark:bg-gray-700'
                                }
                                ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                              `}
                              aria-label={`Toggle ${metadata.name}`}
                            >
                              <span
                                className={`
                                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                  ${enabled ? 'translate-x-6' : 'translate-x-1'}
                                `}
                              />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            ))}
        </div>

        {/* Usage Instructions */}
        <div className="mt-8 p-6 bg-gray-50 dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            How to Use Feature Flags in Code
          </h3>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <p className="text-gray-900 dark:text-gray-100">
              In your components, check feature flags before rendering features:
            </p>
            <pre className="p-4 bg-gray-900 dark:bg-black text-green-400 rounded overflow-x-auto">
{`import { isFeatureEnabled } from '@/lib/features/runtimeFeatureFlags'

// Client component - use with state
const [gamesEnabled, setGamesEnabled] = useState(false)

useEffect(() => {
  isFeatureEnabled('GAMES').then(setGamesEnabled)
}, [])

if (gamesEnabled) {
  return <GamesSection />
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
