'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n/I18nContext'
import Navbar from '@/components/layout/Navbar'
import { FirebaseUsageChart } from './components/FirebaseUsageChart'
import { TierBreakdown } from './components/TierBreakdown'
import { CostProjection } from './components/CostProjection'
import { AnomalyAlerts } from './components/AnomalyAlerts'
import { RefreshCw, AlertTriangle, Database, DollarSign } from 'lucide-react'

interface MonitoringData {
  summary: {
    totalOperations: number
    freeUserOperations: number
    premiumUserOperations: number
    violations: number
    operationsByType: Record<string, number>
    operationsByCollection: Record<string, number>
  }
  violations: {
    recent: any[]
    count: number
  }
  costEstimates: {
    reads: { count: number; cost: string }
    writes: { count: number; cost: string }
    deletes: { count: number; cost: string }
    total: {
      operations: number
      cost: string
      dailyProjection: string
      monthlyProjection: string
    }
    savings: {
      potential: string
      percentage: string
      monthlyPotential: string
    }
    violations: {
      count: number
      estimatedCost: string
    }
  }
  timestamp: string
}

export default function FirebaseMonitoringDashboard() {
  const { user } = useAuth()
  const router = useRouter()
  const { t, strings } = useI18n()
  const [data, setData] = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Fetch monitoring data
  const fetchData = async () => {
    try {
      setRefreshing(true)
      const response = await fetch('/api/admin/monitoring/firebase-usage')

      if (!response.ok) {
        if (response.status === 403) {
          setError('Admin access required')
          router.push('/dashboard')
          return
        }
        throw new Error('Failed to fetch monitoring data')
      }

      const result = await response.json()
      if (result.success) {
        setData(result.data)
        setError(null)
      }
    } catch (err) {
      console.error('Error fetching monitoring data:', err)
      setError('Failed to load monitoring data')
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light to-primary-50 dark:from-dark-850 dark:to-dark-900">
        <Navbar user={user} showUserMenu={true} />
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
        <Navbar user={user} showUserMenu={true} />
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
    <div className="min-h-screen bg-gradient-to-br from-background-light to-primary-50 dark:from-dark-850 dark:to-dark-900">
      <Navbar user={user} showUserMenu={true} />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Firebase Usage Monitoring
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
        {data && data.summary.violations > 0 && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-4 animate-pulse">
            <div className="flex items-center">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-200">
                  🚨 Critical: Free Users Accessing Firebase!
                </h3>
                <p className="text-red-700 dark:text-red-300">
                  {data.summary.violations} violations detected. Free users are still writing to Firebase.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Operations */}
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Database className="w-8 h-8 text-primary-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {data?.summary.totalOperations.toLocaleString() || 0}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Operations</h3>
          </div>

          {/* Free User Operations */}
          <div className={`bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6 ${data && data.summary.freeUserOperations > 0 ? 'border-2 border-red-500' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-8 h-8 text-orange-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {data?.summary.freeUserOperations.toLocaleString() || 0}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Free User Ops</h3>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              Should be 0 after fixes
            </p>
          </div>

          {/* Monthly Cost */}
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-green-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                ${data?.costEstimates.total.monthlyProjection || '0'}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Monthly Cost</h3>
          </div>

          {/* Potential Savings */}
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-blue-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                ${data?.costEstimates.savings.monthlyPotential || '0'}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Potential Savings</h3>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {data?.costEstimates.savings.percentage || '0%'} of current usage
            </p>
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Usage Chart */}
          <FirebaseUsageChart data={data} />

          {/* Tier Breakdown */}
          <TierBreakdown data={data} />

          {/* Cost Projection */}
          <CostProjection data={data} />

          {/* Anomaly Alerts */}
          <AnomalyAlerts data={data} />
        </div>

        {/* Operations by Collection Table */}
        {data && (
          <div className="mt-8 bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Operations by Collection
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Collection
                    </th>
                    <th className="text-right py-2 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Operations
                    </th>
                    <th className="text-right py-2 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Percentage
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.summary.operationsByCollection || {})
                    .sort(([, a], [, b]) => b - a)
                    .map(([collection, count]) => (
                      <tr key={collection} className="border-b dark:border-gray-700">
                        <td className="py-2 px-4 text-gray-900 dark:text-gray-100">
                          {collection}
                        </td>
                        <td className="text-right py-2 px-4 text-gray-600 dark:text-gray-300">
                          {count.toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-4 text-gray-600 dark:text-gray-300">
                          {((count / data.summary.totalOperations) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}