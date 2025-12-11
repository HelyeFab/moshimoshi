'use client'

import { useState, useEffect } from 'react'
import { useAdmin } from '@/hooks/useAdmin'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw,
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Activity,
  Play,
} from 'lucide-react'

interface IntegrityLog {
  id: string
  type: 'scheduled' | 'manual'
  checkId?: string
  timestamp: string | null
  duration: number
  newsArticles?: {
    checked: number
    missingAudio: string[]
    missingTranslations: string[]
    missingWordExplanations: string[]
    failedAudio: string[]
    repaired: {
      audio: number
      translations: number
      wordExplanations: number
    }
    repairFailed: {
      audio: number
      translations: number
      wordExplanations: number
    }
  }
  stories?: {
    checked: number
    missingAudio: string[]
    missingImages: string[]
    missingTranslations: string[]
    stalledDrafts: string[]
    repaired: {
      audio: number
      images: number
      translations: number
    }
    repairFailed: {
      audio: number
      images: number
      translations: number
    }
  }
  books?: {
    checked: number
    missingTranslations: string[]
  }
  triggeredBy?: string
  success?: boolean
  error?: string
}

interface IntegrityStats {
  totalChecks: number
  successfulChecks: number
  failedChecks: number
  repairSuccessRate: number
  currentQueueDepth: number
  lastRunTimestamp: string | null
  lastRunDuration: number
  trends: {
    date: string
    repairsSucceeded: number
    repairsFailed: number
    checksRun: number
  }[]
  contentBreakdown: {
    type: string
    missing: number
    repaired: number
  }[]
}

export default function IntegrityMonitorDashboard() {
  const { isAdmin, isLoading: adminLoading } = useAdmin()
  const [stats, setStats] = useState<IntegrityStats | null>(null)
  const [logs, setLogs] = useState<IntegrityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'manual'>('all')
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [triggering, setTriggering] = useState(false)
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null)
  const [maxStories, setMaxStories] = useState(1)
  const [maxArticles, setMaxArticles] = useState(1)

  const fetchStats = async () => {
    try {
      const typeParam = filter === 'all' ? '' : `&type=${filter}`
      const response = await fetch(`/api/admin/integrity/stats?limit=50&days=7${typeParam}`)
      if (!response.ok) {
        throw new Error('Failed to fetch integrity stats')
      }
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
        setLogs(data.logs || [])
      } else {
        setError(data.error || 'Failed to fetch stats')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const triggerManualCheck = async () => {
    setTriggering(true)
    setTriggerMessage(null)

    try {
      const response = await fetch('/api/admin/integrity/stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxStories,
          maxArticles,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setTriggerMessage('Integrity check triggered successfully! Results will appear shortly.')
        setTimeout(() => {
          fetchStats()
        }, 3000)
      } else {
        setTriggerMessage(`Failed: ${result.error || 'Unknown error'}`)
      }
    } catch (err) {
      setTriggerMessage(`Error: ${err instanceof Error ? err.message : 'Failed to trigger check'}`)
    } finally {
      setTriggering(false)
      setTimeout(() => setTriggerMessage(null), 10000)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      fetchStats()
    }
  }, [isAdmin, filter])

  useEffect(() => {
    if (!isAdmin || !autoRefresh) return

    const interval = setInterval(fetchStats, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [isAdmin, autoRefresh, filter])

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusColor = (log: IntegrityLog) => {
    if (log.error || log.success === false) return 'bg-red-500'
    const totalFailed =
      (log.newsArticles?.repairFailed?.audio || 0) +
      (log.newsArticles?.repairFailed?.translations || 0) +
      (log.newsArticles?.repairFailed?.wordExplanations || 0) +
      (log.stories?.repairFailed?.audio || 0) +
      (log.stories?.repairFailed?.images || 0) +
      (log.stories?.repairFailed?.translations || 0)
    if (totalFailed > 0) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getStatusIcon = (log: IntegrityLog) => {
    if (log.error || log.success === false) return <XCircle className="w-4 h-4 text-red-500" />
    const totalFailed =
      (log.newsArticles?.repairFailed?.audio || 0) +
      (log.newsArticles?.repairFailed?.translations || 0) +
      (log.newsArticles?.repairFailed?.wordExplanations || 0) +
      (log.stories?.repairFailed?.audio || 0) +
      (log.stories?.repairFailed?.images || 0) +
      (log.stories?.repairFailed?.translations || 0)
    if (totalFailed > 0) return <AlertTriangle className="w-4 h-4 text-yellow-500" />
    return <CheckCircle className="w-4 h-4 text-green-500" />
  }

  const getTotalRepairs = (log: IntegrityLog) => {
    return (
      (log.newsArticles?.repaired?.audio || 0) +
      (log.newsArticles?.repaired?.translations || 0) +
      (log.newsArticles?.repaired?.wordExplanations || 0) +
      (log.stories?.repaired?.audio || 0) +
      (log.stories?.repaired?.images || 0) +
      (log.stories?.repaired?.translations || 0)
    )
  }

  const getTotalMissing = (log: IntegrityLog) => {
    return (
      (log.newsArticles?.missingAudio?.length || 0) +
      (log.newsArticles?.missingTranslations?.length || 0) +
      (log.newsArticles?.missingWordExplanations?.length || 0) +
      (log.stories?.missingAudio?.length || 0) +
      (log.stories?.missingImages?.length || 0) +
      (log.stories?.missingTranslations?.length || 0) +
      (log.books?.missingTranslations?.length || 0)
    )
  }

  if (adminLoading || (loading && !stats)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            {adminLoading ? 'Verifying admin access...' : 'Loading integrity data...'}
          </p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400">You do not have admin privileges</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary-500" />
            Integrity Monitor
          </h1>
          <p className="text-muted-foreground">Content integrity checker status and repair logs</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            onClick={() => setAutoRefresh(!autoRefresh)}
            size="sm"
          >
            Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button onClick={fetchStats} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>

          {/* Max items selectors for manual run */}
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Max Stories:</label>
            <select
              value={maxStories}
              onChange={(e) => setMaxStories(parseInt(e.target.value))}
              className="text-sm font-semibold bg-transparent border-none focus:ring-0 cursor-pointer text-gray-900 dark:text-white pr-6"
              disabled={triggering}
            >
              {[1, 2, 3, 4, 5].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Max Articles:</label>
            <select
              value={maxArticles}
              onChange={(e) => setMaxArticles(parseInt(e.target.value))}
              className="text-sm font-semibold bg-transparent border-none focus:ring-0 cursor-pointer text-gray-900 dark:text-white pr-6"
              disabled={triggering}
            >
              {[1, 2, 3, 4, 5].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <Button
            onClick={triggerManualCheck}
            disabled={triggering}
            size="sm"
            className="bg-primary-500 hover:bg-primary-600"
          >
            <Play className={`w-4 h-4 mr-2 ${triggering ? 'animate-pulse' : ''}`} />
            {triggering ? 'Running...' : 'Run Check'}
          </Button>
        </div>
      </div>

      {/* Trigger Message */}
      {triggerMessage && (
        <Card
          className={`p-4 ${
            triggerMessage.startsWith('Failed') || triggerMessage.startsWith('Error')
              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
              : 'border-green-500 bg-green-50 dark:bg-green-900/20'
          }`}
        >
          <p
            className={
              triggerMessage.startsWith('Failed') || triggerMessage.startsWith('Error')
                ? 'text-red-700 dark:text-red-300'
                : 'text-green-700 dark:text-green-300'
            }
          >
            {triggerMessage}
          </p>
        </Card>
      )}

      {error && (
        <Card className="p-4 border-red-500 bg-red-50 dark:bg-red-900/20">
          <p className="text-red-600 dark:text-red-400">Error: {error}</p>
        </Card>
      )}

      {/* Stats Cards */}
      {stats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Checks */}
            <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3 mb-2">
                <Activity className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-muted-foreground">Total Checks (7d)</span>
              </div>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {stats.totalChecks}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.successfulChecks} successful, {stats.failedChecks} failed
              </p>
            </Card>

            {/* Success Rate */}
            <Card className="p-6 bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm text-muted-foreground">Repair Success Rate</span>
              </div>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {stats.repairSuccessRate.toFixed(1)}%
              </p>
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-green-500"
                  style={{ width: `${Math.min(stats.repairSuccessRate, 100)}%` }}
                />
              </div>
            </Card>

            {/* Queue Depth */}
            <Card
              className={`p-6 bg-gradient-to-br ${
                stats.currentQueueDepth > 10
                  ? 'from-red-500/10 to-red-600/5 border-red-200 dark:border-red-800'
                  : stats.currentQueueDepth > 0
                    ? 'from-yellow-500/10 to-yellow-600/5 border-yellow-200 dark:border-yellow-800'
                    : 'from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle
                  className={`w-5 h-5 ${
                    stats.currentQueueDepth > 10
                      ? 'text-red-500'
                      : stats.currentQueueDepth > 0
                        ? 'text-yellow-500'
                        : 'text-green-500'
                  }`}
                />
                <span className="text-sm text-muted-foreground">Queue Depth</span>
              </div>
              <p
                className={`text-3xl font-bold ${
                  stats.currentQueueDepth > 10
                    ? 'text-red-600 dark:text-red-400'
                    : stats.currentQueueDepth > 0
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-green-600 dark:text-green-400'
                }`}
              >
                {stats.currentQueueDepth}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.currentQueueDepth === 0 ? 'All content healthy' : 'items need repair'}
              </p>
            </Card>

            {/* Last Run */}
            <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-purple-500" />
                <span className="text-sm text-muted-foreground">Last Run</span>
              </div>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {formatDate(stats.lastRunTimestamp)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Duration: {formatDuration(stats.lastRunDuration)}
              </p>
            </Card>
          </div>

          {/* Content Breakdown */}
          {stats.contentBreakdown.length > 0 && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Content Breakdown</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {stats.contentBreakdown.map(item => (
                  <div key={item.type} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {item.type}
                    </p>
                    <div className="flex justify-between text-sm">
                      <span className="text-yellow-600 dark:text-yellow-400">
                        {item.missing} missing
                      </span>
                      <span className="text-green-600 dark:text-green-400">
                        {item.repaired} fixed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Trends Chart */}
          {stats.trends.length > 0 && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Daily Trends</h2>
              <div className="overflow-x-auto">
                <div className="flex gap-2 min-w-max">
                  {stats.trends.map(day => (
                    <div key={day.date} className="flex flex-col items-center w-20">
                      <div className="flex gap-1 h-32 items-end">
                        <div
                          className="w-4 bg-green-500 rounded-t"
                          style={{
                            height: `${Math.max((day.repairsSucceeded / Math.max(...stats.trends.map(t => t.repairsSucceeded + t.repairsFailed), 1)) * 100, 4)}%`,
                          }}
                          title={`${day.repairsSucceeded} succeeded`}
                        />
                        <div
                          className="w-4 bg-red-500 rounded-t"
                          style={{
                            height: `${Math.max((day.repairsFailed / Math.max(...stats.trends.map(t => t.repairsSucceeded + t.repairsFailed), 1)) * 100, 4)}%`,
                          }}
                          title={`${day.repairsFailed} failed`}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{day.date.slice(5)}</p>
                      <p className="text-xs text-muted-foreground">{day.checksRun} runs</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 justify-center mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded" />
                  <span className="text-muted-foreground">Repairs Succeeded</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded" />
                  <span className="text-muted-foreground">Repairs Failed</span>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Logs Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span className="text-primary-500">📋</span>
            Check Logs
          </h2>

          {/* Filter Tabs */}
          <div className="flex gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
            {(['all', 'scheduled', 'manual'] as const).map(filterType => (
              <button
                key={filterType}
                onClick={() => setFilter(filterType)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  filter === filterType
                    ? 'bg-white dark:bg-dark-600 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {filterType === 'all'
                  ? 'All'
                  : filterType === 'scheduled'
                    ? '⏰ Auto'
                    : '👆 Manual'}
              </button>
            ))}
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No integrity check logs found
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            <AnimatePresence>
              {logs.map((log, index) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="border border-gray-200 dark:border-dark-600 rounded-xl overflow-hidden"
                >
                  {/* Log Header */}
                  <button
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                  >
                    {/* Status Indicator */}
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(log)}`} />

                    {/* Status Icon */}
                    {getStatusIcon(log)}

                    {/* Type Badge */}
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        log.type === 'scheduled'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      }`}
                    >
                      {log.type === 'scheduled' ? '⏰ Auto' : '👆 Manual'}
                    </span>

                    {/* Summary */}
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {getTotalMissing(log)} missing, {getTotalRepairs(log)} repaired
                    </span>

                    {/* Duration */}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDuration(log.duration)}
                    </span>

                    {/* Spacer */}
                    <div className="flex-grow" />

                    {/* Time */}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(log.timestamp)}
                    </span>

                    {/* Expand Icon */}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${expandedLog === log.id ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {expandedLog === log.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-700/50 px-4 py-3"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {/* News Articles */}
                          {log.newsArticles && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                                News Articles
                              </p>
                              <div className="space-y-1 text-gray-700 dark:text-gray-300">
                                <p>Checked: {log.newsArticles.checked}</p>
                                <p className="text-yellow-600 dark:text-yellow-400">
                                  Missing: {log.newsArticles.missingAudio?.length || 0} audio,{' '}
                                  {log.newsArticles.missingTranslations?.length || 0} translations,{' '}
                                  {log.newsArticles.missingWordExplanations?.length || 0} word
                                  explanations
                                </p>
                                <p className="text-green-600 dark:text-green-400">
                                  Repaired: {log.newsArticles.repaired?.audio || 0} audio,{' '}
                                  {log.newsArticles.repaired?.translations || 0} translations,{' '}
                                  {log.newsArticles.repaired?.wordExplanations || 0} word
                                  explanations
                                </p>
                                {(log.newsArticles.repairFailed?.audio || 0) +
                                  (log.newsArticles.repairFailed?.translations || 0) +
                                  (log.newsArticles.repairFailed?.wordExplanations || 0) >
                                  0 && (
                                  <p className="text-red-600 dark:text-red-400">
                                    Failed: {log.newsArticles.repairFailed?.audio || 0} audio,{' '}
                                    {log.newsArticles.repairFailed?.translations || 0} translations,{' '}
                                    {log.newsArticles.repairFailed?.wordExplanations || 0} word
                                    explanations
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Stories */}
                          {log.stories && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                                Stories
                              </p>
                              <div className="space-y-1 text-gray-700 dark:text-gray-300">
                                <p>Checked: {log.stories.checked}</p>
                                <p className="text-yellow-600 dark:text-yellow-400">
                                  Missing: {log.stories.missingAudio?.length || 0} audio,{' '}
                                  {log.stories.missingImages?.length || 0} images,{' '}
                                  {log.stories.missingTranslations?.length || 0} translations
                                </p>
                                {log.stories.stalledDrafts?.length > 0 && (
                                  <p className="text-orange-600 dark:text-orange-400">
                                    Stalled drafts: {log.stories.stalledDrafts.length}
                                  </p>
                                )}
                                <p className="text-green-600 dark:text-green-400">
                                  Repaired: {log.stories.repaired?.audio || 0} audio,{' '}
                                  {log.stories.repaired?.images || 0} images,{' '}
                                  {log.stories.repaired?.translations || 0} translations
                                </p>
                                {(log.stories.repairFailed?.audio || 0) +
                                  (log.stories.repairFailed?.images || 0) +
                                  (log.stories.repairFailed?.translations || 0) >
                                  0 && (
                                  <p className="text-red-600 dark:text-red-400">
                                    Failed: {log.stories.repairFailed?.audio || 0} audio,{' '}
                                    {log.stories.repairFailed?.images || 0} images,{' '}
                                    {log.stories.repairFailed?.translations || 0} translations
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Books */}
                          {log.books && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                                Books
                              </p>
                              <div className="space-y-1 text-gray-700 dark:text-gray-300">
                                <p>Checked: {log.books.checked}</p>
                                {log.books.missingTranslations?.length > 0 ? (
                                  <p className="text-yellow-600 dark:text-yellow-400">
                                    Missing translations: {log.books.missingTranslations.length}
                                  </p>
                                ) : (
                                  <p className="text-green-600 dark:text-green-400">
                                    All translations present
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Check ID */}
                          {log.checkId && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                                Check ID
                              </p>
                              <p className="text-xs font-mono text-gray-600 dark:text-gray-400">
                                {log.checkId}
                              </p>
                            </div>
                          )}

                          {/* Triggered By */}
                          {log.triggeredBy && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                                Triggered By
                              </p>
                              <p className="text-gray-700 dark:text-gray-300">{log.triggeredBy}</p>
                            </div>
                          )}

                          {/* Error */}
                          {log.error && (
                            <div className="md:col-span-2">
                              <p className="text-xs font-semibold text-red-500 mb-1">Error</p>
                              <p className="text-red-600 dark:text-red-400 text-xs font-mono bg-red-50 dark:bg-red-900/20 p-2 rounded">
                                {log.error}
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Card>
    </div>
  )
}
