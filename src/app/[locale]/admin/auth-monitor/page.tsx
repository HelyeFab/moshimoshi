'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdmin } from '@/hooks/useAdmin'
import { AdminErrorBoundary } from '@/components/admin/AdminErrorBoundary'
import {
  RefreshCw,
  AlertTriangle,
  Shield,
  Users,
  LogIn,
  UserPlus,
  XCircle,
  Activity,
} from 'lucide-react'

interface AuthEventData {
  recentEvents: Array<{
    id: string
    event: string
    timestamp: string
    userId?: string
    email?: string
    outcome: string
    severity: string
    ipAddress?: string
    details?: Record<string, unknown>
  }>
  stats: {
    totalSignIns: number
    totalSignUps: number
    failedLogins: number
    activeSessionsEstimate: number
    securityEvents: number
  }
  recentUsers: Array<{
    uid: string
    email: string
    lastSignIn: string | null
    creationTime: string
    providers: string[]
  }>
  securityAlerts: Array<{
    id: string
    event: string
    timestamp: string
    severity: string
    details: Record<string, unknown>
  }>
}

function formatEventName(event: string): string {
  return event
    .replace('auth.', '')
    .replace('security.', '')
    .replace('user.', '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    case 'high':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

function getOutcomeColor(outcome: string): string {
  switch (outcome) {
    case 'success':
      return 'text-green-600 dark:text-green-400'
    case 'failure':
      return 'text-red-600 dark:text-red-400'
    case 'warning':
      return 'text-yellow-600 dark:text-yellow-400'
    default:
      return 'text-gray-600 dark:text-gray-400'
  }
}

function formatTimeAgo(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

export default function AuthMonitorPage() {
  const { isAdmin, isLoading: adminLoading } = useAdmin()
  const router = useRouter()
  const [data, setData] = useState<AuthEventData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  // Redirect if not admin
  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      router.push('/')
    }
  }, [isAdmin, adminLoading, router])

  // Fetch auth events
  const fetchData = async () => {
    try {
      setRefreshing(true)
      const response = await fetch('/api/admin/auth-events', {
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 403) {
          setError('Admin access required')
          router.push('/dashboard')
          return
        }
        throw new Error('Failed to fetch auth events')
      }

      const result = await response.json()
      if (result.success) {
        setData(result.data)
        setError(null)
      }
    } catch (err) {
      console.error('Error fetching auth events:', err)
      setError('Failed to load auth events')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Initial fetch and auto-refresh
  useEffect(() => {
    if (!adminLoading && isAdmin) {
      fetchData()
    }

    const interval = autoRefresh ? setInterval(fetchData, 30000) : null

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [adminLoading, isAdmin, autoRefresh])

  if (adminLoading || loading) {
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

  return (
    <AdminErrorBoundary componentName="Auth Monitor">
    <div className="min-h-screen bg-gradient-to-br from-background-light to-primary-50 dark:from-dark-850 dark:to-dark-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-primary-500" />
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Auth Monitor
              </h1>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                  Auto-refresh
                </span>
              </label>
              <button
                onClick={fetchData}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Read-only view of authentication events and security metrics
          </p>
        </div>

        {/* Security Alerts */}
        {data && data.securityAlerts.length > 0 && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-200">
                  Security Alerts ({data.securityAlerts.length})
                </h3>
                <div className="mt-2 space-y-2">
                  {data.securityAlerts.slice(0, 3).map((alert) => (
                    <div
                      key={alert.id}
                      className="text-sm text-red-700 dark:text-red-300"
                    >
                      <span className="font-medium">{formatEventName(alert.event)}</span>
                      {' - '}
                      <span>{formatTimeAgo(alert.timestamp)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <LogIn className="w-6 h-6 sm:w-7 sm:h-7 text-green-500" />
              <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {data?.stats.totalSignIns || 0}
              </span>
            </div>
            <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
              Sign Ins
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 hidden sm:block">Last 3 days</p>
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <UserPlus className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500" />
              <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {data?.stats.totalSignUps || 0}
              </span>
            </div>
            <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
              Sign Ups
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 hidden sm:block">Last 3 days</p>
          </div>

          <div
            className={`bg-white dark:bg-dark-800 rounded-lg shadow-lg p-4 sm:p-5 ${
              data && data.stats.failedLogins > 5 ? 'border-2 border-orange-500' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <XCircle className="w-6 h-6 sm:w-7 sm:h-7 text-red-500" />
              <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {data?.stats.failedLogins || 0}
              </span>
            </div>
            <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
              Failed Logins
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 hidden sm:block">Last 3 days</p>
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-6 h-6 sm:w-7 sm:h-7 text-purple-500" />
              <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {data?.stats.activeSessionsEstimate || 0}
              </span>
            </div>
            <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
              Sessions
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 hidden sm:block">Estimated</p>
          </div>

          <div
            className={`bg-white dark:bg-dark-800 rounded-lg shadow-lg p-4 sm:p-5 col-span-2 sm:col-span-1 ${
              data && data.stats.securityEvents > 0 ? 'border-2 border-yellow-500' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-500" />
              <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {data?.stats.securityEvents || 0}
              </span>
            </div>
            <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
              Security Events
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 hidden sm:block">Last 3 days</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Recent Auth Events */}
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-500" />
              Recent Auth Events
            </h2>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {data?.recentEvents.slice(0, 20).map((event) => (
                <div
                  key={event.id}
                  className="flex items-start justify-between p-3 bg-gray-50 dark:bg-dark-700 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-white text-sm">
                        {formatEventName(event.event)}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${getSeverityColor(
                          event.severity
                        )}`}
                      >
                        {event.severity}
                      </span>
                      <span className={`text-xs font-medium ${getOutcomeColor(event.outcome)}`}>
                        {event.outcome}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {event.email || event.userId?.slice(0, 8) || 'Unknown user'}
                      {event.ipAddress && (
                        <span className="ml-2 text-gray-400">({event.ipAddress})</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap ml-2">
                    {formatTimeAgo(event.timestamp)}
                  </div>
                </div>
              ))}
              {(!data?.recentEvents || data.recentEvents.length === 0) && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No recent auth events found
                </p>
              )}
            </div>
          </div>

          {/* Recent Users (by last sign-in) */}
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-500" />
              Recently Active Users
            </h2>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {data?.recentUsers.map((user) => (
                <div
                  key={user.uid}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-700 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {user.email}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {user.providers.map((provider) => (
                        <span
                          key={provider}
                          className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-dark-600 text-gray-600 dark:text-gray-300 rounded"
                        >
                          {provider.replace('.com', '')}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {user.lastSignIn ? formatTimeAgo(user.lastSignIn) : 'Never'}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      Joined {formatTimeAgo(user.creationTime)}
                    </div>
                  </div>
                </div>
              ))}
              {(!data?.recentUsers || data.recentUsers.length === 0) && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No users found
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Info Note */}
        <div className="mt-4 sm:mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
            <strong>Note:</strong> Read-only dashboard. Data from audit logs (Redis), Firebase Auth, and active sessions. Events retained 30 days.
          </p>
        </div>
      </div>
    </div>
    </AdminErrorBoundary>
  )
}
