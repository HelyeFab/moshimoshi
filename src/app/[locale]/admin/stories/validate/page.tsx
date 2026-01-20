'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n/I18nContext'
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, FileText, Activity } from 'lucide-react'

interface ValidationData {
  success: boolean
  healthScore: number
  currentSchemaVersion: string
  totalStories: number
  validStories: number
  storiesWithIssues: number
  schemaVersions: Record<string, number>
  summary: {
    missingFurigana: number
    missingQuizFields: number
    incompletePages: number
    outdatedSchema: number
  }
  issues: Array<{
    storyId: string
    title: string
    titleJa: string
    jlptLevel: string
    publishedAt: string
    schemaVersion: string
    issues: string[]
    issueCount: number
  }>
  timestamp: string
}

export default function StoryValidationDashboard() {
  const { user } = useAuth()
  const router = useRouter()
  const { t, strings } = useI18n()
  const [data, setData] = useState<ValidationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  // Fetch validation data
  const fetchData = async () => {
    try {
      setRefreshing(true)
      const response = await fetch('/api/admin/stories/validate')

      if (!response.ok) {
        if (response.status === 403) {
          setError('Admin access required')
          router.push('/dashboard')
          return
        }
        throw new Error('Failed to fetch validation data')
      }

      const result = await response.json()
      if (result.success) {
        setData(result)
        setError(null)
      }
    } catch (err) {
      console.error('Error fetching validation data:', err)
      setError('Failed to load validation data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchData()

    // Auto-refresh every 60 seconds if enabled
    const interval = autoRefresh ? setInterval(fetchData, 60000) : null

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light to-primary-50 dark:from-dark-850 dark:to-dark-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light to-primary-50 dark:from-dark-850 dark:to-dark-900">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-center">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 mr-3" />
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const healthScoreColor = data
    ? data.healthScore === 100
      ? 'text-green-600 dark:text-green-400'
      : data.healthScore >= 80
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-red-600 dark:text-red-400'
    : ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-primary-50 dark:from-dark-850 dark:to-dark-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Story Data Validation
            </h1>
            <div className="flex items-center gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">Auto-refresh</span>
              </label>
              <button
                onClick={fetchData}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {data && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {new Date(data.timestamp).toLocaleString()}
            </p>
          )}
        </div>

        {/* Critical Alerts */}
        {data && data.storiesWithIssues > 0 && (
          <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-200">
                  ⚠️ Data Integrity Issues Detected
                </h3>
                <p className="text-yellow-700 dark:text-yellow-300">
                  {data.storiesWithIssues} {data.storiesWithIssues === 1 ? 'story has' : 'stories have'} validation issues. See details below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Health Score */}
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-8 h-8 text-primary-500" />
              <span className={`text-3xl font-bold ${healthScoreColor}`}>
                {data?.healthScore || 0}%
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Health Score</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {data?.healthScore === 100 ? 'Perfect!' : (data?.healthScore ?? 0) >= 80 ? 'Good' : 'Needs attention'}
            </p>
          </div>

          {/* Total Stories */}
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <FileText className="w-8 h-8 text-blue-500" />
              <span className="text-3xl font-bold text-gray-900 dark:text-white">
                {data?.totalStories || 0}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Stories</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Published & validated
            </p>
          </div>

          {/* Valid Stories */}
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <span className="text-3xl font-bold text-green-600 dark:text-green-400">
                {data?.validStories || 0}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Valid Stories</h3>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              No issues detected
            </p>
          </div>

          {/* Stories with Issues */}
          <div className={`bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6 ${data && data.storiesWithIssues > 0 ? 'border-2 border-yellow-500' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <XCircle className="w-8 h-8 text-orange-500" />
              <span className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                {data?.storiesWithIssues || 0}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">With Issues</h3>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              Require attention
            </p>
          </div>
        </div>

        {/* Issue Summary */}
        {data && (
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Issue Breakdown
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {data.summary.missingFurigana}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Missing Furigana</div>
              </div>
              <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {data.summary.missingQuizFields}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Missing Quiz Fields</div>
              </div>
              <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {data.summary.incompletePages}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Incomplete Pages</div>
              </div>
              <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {data.summary.outdatedSchema}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Outdated Schema</div>
              </div>
            </div>
          </div>
        )}

        {/* Schema Versions */}
        {data && (
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Schema Version Distribution
            </h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Current Schema Version: <span className="font-mono font-semibold text-primary-500">{data.currentSchemaVersion}</span>
              </p>
            </div>
            <div className="space-y-2">
              {Object.entries(data.schemaVersions)
                .sort(([versionA], [versionB]) => versionB.localeCompare(versionA))
                .map(([version, count]) => {
                  const isLatest = version === data.currentSchemaVersion
                  const percentage = ((count / data.totalStories) * 100).toFixed(1)
                  return (
                    <div key={version} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-sm ${isLatest ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-gray-600 dark:text-gray-400'}`}>
                          {version}
                        </span>
                        {isLatest && (
                          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${isLatest ? 'bg-green-500' : 'bg-gray-400'}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-300 w-20 text-right">
                          {count} ({percentage}%)
                        </span>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Issues Table */}
        {data && data.issues.length > 0 && (
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Stories with Issues ({data.issues.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Story
                    </th>
                    <th className="text-center py-2 px-4 font-medium text-gray-700 dark:text-gray-300">
                      JLPT
                    </th>
                    <th className="text-center py-2 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Schema
                    </th>
                    <th className="text-center py-2 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Issues
                    </th>
                    <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.issues.map((issue) => (
                    <tr key={issue.storyId} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-dark-700">
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {issue.title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {issue.titleJa}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                          {issue.storyId}
                        </div>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                          {issue.jlptLevel}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                          {issue.schemaVersion}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                          {issue.issueCount}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-400 space-y-1">
                          {issue.issues.slice(0, 3).map((issueDetail, idx) => (
                            <li key={idx}>{issueDetail}</li>
                          ))}
                          {issue.issues.length > 3 && (
                            <li className="text-gray-500 dark:text-gray-500">
                              ... and {issue.issues.length - 3} more
                            </li>
                          )}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No Issues State */}
        {data && data.issues.length === 0 && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-green-900 dark:text-green-200 mb-2">
              All Stories Valid! 🎉
            </h3>
            <p className="text-green-700 dark:text-green-300">
              All {data.totalStories} published stories have passed validation with no issues detected.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
