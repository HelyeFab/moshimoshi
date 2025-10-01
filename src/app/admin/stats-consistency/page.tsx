'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Database, Zap, Shield } from 'lucide-react'

interface Inconsistency {
  userId: string
  email: string
  issues: {
    streak?: { userStats: number; leaderboard: number; diff: number }
    points?: { userStats: number; leaderboard: number; diff: number }
    xp?: { userStats: number; leaderboard: number; diff: number }
    missing?: string
  }
  severity: 'low' | 'medium' | 'high'
}

interface Summary {
  totalUsers: number
  inconsistentUsers: number
  highSeverity: number
  mediumSeverity: number
  lowSeverity: number
  lastFullScan: string
}

export default function StatsConsistencyPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [inconsistencies, setInconsistencies] = useState<Inconsistency[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [showRebuildConfirm, setShowRebuildConfirm] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Fetch consistency data
  const fetchData = async () => {
    try {
      setRefreshing(true)
      const response = await fetch('/api/admin/stats-consistency/check?limit=1000')

      if (!response.ok) {
        if (response.status === 403) {
          router.push('/dashboard')
          return
        }
        throw new Error('Failed to fetch consistency data')
      }

      const result = await response.json()
      if (result.success) {
        setInconsistencies(result.inconsistencies)
        setSummary(result.summary)
      }
    } catch (err) {
      console.error('Error fetching consistency data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchData()

    // Auto-refresh every 30 seconds
    const interval = autoRefresh ? setInterval(fetchData, 30000) : null

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  // Sync specific user
  const syncUser = async (userId: string) => {
    try {
      setSyncing(true)
      const response = await fetch('/api/admin/stats-consistency/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      if (!response.ok) throw new Error('Sync failed')

      const result = await response.json()
      if (result.success) {
        showToast('User synced successfully', 'success')
        // Refresh data
        await fetchData()
      }
    } catch (err) {
      console.error('Error syncing user:', err)
      showToast('Failed to sync user', 'error')
    } finally {
      setSyncing(false)
    }
  }

  // Sync all inconsistent users
  const syncAllInconsistent = async () => {
    try {
      setSyncing(true)
      const userIds = inconsistencies.map(i => i.userId)

      const response = await fetch('/api/admin/stats-consistency/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds })
      })

      if (!response.ok) throw new Error('Batch sync failed')

      const result = await response.json()
      if (result.success) {
        showToast(`Synced ${result.result.success} users successfully`, 'success')
        await fetchData()
      }
    } catch (err) {
      console.error('Error batch syncing:', err)
      showToast('Failed to sync users', 'error')
    } finally {
      setSyncing(false)
    }
  }

  // Rebuild entire leaderboard
  const rebuildLeaderboard = async () => {
    try {
      setRebuilding(true)
      const response = await fetch('/api/admin/stats-consistency/rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true })
      })

      if (!response.ok) throw new Error('Rebuild failed')

      const result = await response.json()
      if (result.success) {
        showToast(`Rebuilt leaderboard: ${result.result.synced} users synced`, 'success')
        await fetchData()
      }
    } catch (err) {
      console.error('Error rebuilding leaderboard:', err)
      showToast('Failed to rebuild leaderboard', 'error')
    } finally {
      setRebuilding(false)
      setShowRebuildConfirm(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
      case 'medium': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
      case 'low': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <XCircle className="w-5 h-5" />
      case 'medium': return <AlertTriangle className="w-5 h-5" />
      case 'low': return <CheckCircle className="w-5 h-5" />
      default: return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Checking consistency...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Stats Consistency Monitor
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor and repair inconsistencies between user_stats and leaderboard_stats
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Auto-refresh (30s)
          </label>
          <Button
            onClick={() => fetchData()}
            disabled={refreshing}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Users</p>
                <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{summary.totalUsers}</p>
              </div>
              <Database className="w-8 h-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">Consistent</p>
                <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                  {summary.totalUsers - summary.inconsistentUsers}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">Inconsistent</p>
                <p className="text-3xl font-bold text-red-900 dark:text-red-100">{summary.inconsistentUsers}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">High Severity</p>
                <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{summary.highSeverity}</p>
              </div>
              <XCircle className="w-8 h-8 text-purple-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Action Buttons */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Button
            onClick={syncAllInconsistent}
            disabled={syncing || inconsistencies.length === 0}
            className="flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            {syncing ? 'Syncing...' : `Sync All Inconsistent (${inconsistencies.length})`}
          </Button>

          <Button
            onClick={() => setShowRebuildConfirm(true)}
            disabled={rebuilding}
            variant="outline"
            className="flex items-center gap-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Shield className="w-4 h-4" />
            Rebuild Entire Leaderboard
          </Button>

          {summary && (
            <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              Last scan: {new Date(summary.lastFullScan).toLocaleString()}
            </div>
          )}
        </div>
      </Card>

      {/* Rebuild Confirmation Dialog */}
      {showRebuildConfirm && (
        <Card className="p-6 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-red-900 dark:text-red-100 mb-2">
                  Confirm Full Leaderboard Rebuild
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                  This will rebuild the entire leaderboard_stats collection from user_stats.
                  This operation may take several minutes and cannot be undone.
                  Are you sure you want to continue?
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={rebuildLeaderboard}
                    disabled={rebuilding}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {rebuilding ? 'Rebuilding...' : 'Yes, Rebuild'}
                  </Button>
                  <Button
                    onClick={() => setShowRebuildConfirm(false)}
                    disabled={rebuilding}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Inconsistencies Table */}
      {inconsistencies.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Issues
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                {inconsistencies.map((item) => (
                  <tr key={item.userId} className="hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {item.email}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {item.userId}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        {item.issues.missing && (
                          <div className="text-sm text-red-600 dark:text-red-400">
                            ⚠️ {item.issues.missing}
                          </div>
                        )}
                        {item.issues.streak && (
                          <div className="text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Streak:</span>{' '}
                            <span className="font-medium">{item.issues.streak.userStats}</span> →{' '}
                            <span className="text-red-600 dark:text-red-400">{item.issues.streak.leaderboard}</span>{' '}
                            <span className="text-xs text-gray-500">(diff: {item.issues.streak.diff})</span>
                          </div>
                        )}
                        {item.issues.points && (
                          <div className="text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Points:</span>{' '}
                            <span className="font-medium">{item.issues.points.userStats}</span> →{' '}
                            <span className="text-red-600 dark:text-red-400">{item.issues.points.leaderboard}</span>{' '}
                            <span className="text-xs text-gray-500">(diff: {item.issues.points.diff})</span>
                          </div>
                        )}
                        {item.issues.xp && (
                          <div className="text-sm">
                            <span className="text-gray-600 dark:text-gray-400">XP:</span>{' '}
                            <span className="font-medium">{item.issues.xp.userStats}</span> →{' '}
                            <span className="text-red-600 dark:text-red-400">{item.issues.xp.leaderboard}</span>{' '}
                            <span className="text-xs text-gray-500">(diff: {item.issues.xp.diff})</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(item.severity)}`}>
                        {getSeverityIcon(item.severity)}
                        {item.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button
                        onClick={() => syncUser(item.userId)}
                        disabled={syncing}
                        size="sm"
                        variant="outline"
                      >
                        Sync
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
          <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
            All Stats Consistent! 🎉
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            No inconsistencies detected between user_stats and leaderboard_stats.
          </p>
        </Card>
      )}
    </div>
  )
}
