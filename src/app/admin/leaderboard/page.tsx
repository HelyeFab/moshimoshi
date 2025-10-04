'use client'

import { useState, useEffect } from 'react'
import { useAdmin } from '@/hooks/useAdmin'
import { useToast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation'
import { Trophy, RefreshCw, Users, Clock, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'

interface LeaderboardSnapshot {
  timeframe: string
  timestamp: number
  entries: any[]
  totalPlayers: number
  lastUpdated: number
}

interface TriggerResult {
  success: boolean
  entriesCount?: number
  totalPlayers?: number
  topPlayer?: string
  timestamp?: number
  error?: string
}

export default function LeaderboardAdminPage() {
  const { isAdmin, isLoading: adminLoading } = useAdmin()
  const { showToast } = useToast()
  const router = useRouter()
  const [triggering, setTriggering] = useState(false)
  const [snapshot, setSnapshot] = useState<LeaderboardSnapshot | null>(null)
  const [loadingSnapshot, setLoadingSnapshot] = useState(true)
  const [lastTrigger, setLastTrigger] = useState<TriggerResult | null>(null)

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      router.push('/')
    }
  }, [isAdmin, adminLoading, router])

  useEffect(() => {
    loadSnapshot()
  }, [])

  const loadSnapshot = async () => {
    setLoadingSnapshot(true)
    try {
      const response = await fetch('/api/leaderboard?page=1&limit=10')
      if (response.ok) {
        const data = await response.json()
        setSnapshot({
          timeframe: 'allTime',
          timestamp: Date.now(),
          entries: data.entries,
          totalPlayers: data.metadata.totalPlayers,
          lastUpdated: data.metadata.lastUpdated
        })
      }
    } catch (error) {
      console.error('Failed to load snapshot:', error)
    } finally {
      setLoadingSnapshot(false)
    }
  }

  const triggerUpdate = async () => {
    setTriggering(true)
    try {
      const response = await fetch('/api/admin/leaderboard/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Request failed: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Update failed')
      }

      setLastTrigger({
        success: true,
        entriesCount: data.result?.entriesCount,
        totalPlayers: data.result?.totalPlayers,
        topPlayer: data.result?.topPlayer,
        timestamp: data.result?.timestamp || Date.now()
      })

      showToast('✅ Leaderboard updated successfully!', 'success')

      // Reload snapshot after a short delay
      setTimeout(() => loadSnapshot(), 2000)
    } catch (error) {
      console.error('Trigger failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      setLastTrigger({
        success: false,
        error: errorMessage
      })

      showToast(`❌ Update failed: ${errorMessage}`, 'error')
    } finally {
      setTriggering(false)
    }
  }

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-dark-900 rounded-xl border border-gray-200 dark:border-dark-700 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex-shrink-0">
              <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                Leaderboard Management
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                Manage and update competitive rankings
              </p>
            </div>
          </div>
          <button
            onClick={triggerUpdate}
            disabled={triggering}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 rounded-lg font-medium transition-all flex-shrink-0 ${
              triggering
                ? 'bg-gray-300 dark:bg-dark-700 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 shadow-lg hover:shadow-xl'
            }`}
          >
            <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${triggering ? 'animate-spin' : ''}`} />
            <span className="whitespace-nowrap">{triggering ? 'Updating...' : 'Update Now'}</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-dark-900 rounded-xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-blue-500" />
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Players</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {loadingSnapshot ? '...' : snapshot?.totalPlayers || 0}
          </p>
        </div>

        <div className="bg-white dark:bg-dark-900 rounded-xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Top 100 Ranked</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {loadingSnapshot ? '...' : snapshot?.entries.length || 0}
          </p>
        </div>

        <div className="bg-white dark:bg-dark-900 rounded-xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-purple-500" />
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Updated</h3>
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {loadingSnapshot
              ? '...'
              : snapshot?.lastUpdated
                ? new Date(snapshot.lastUpdated).toLocaleString()
                : 'Never'
            }
          </p>
        </div>
      </div>

      {/* Last Trigger Result */}
      {lastTrigger && (
        <div className={`rounded-xl border p-6 ${
          lastTrigger.success
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-start gap-3">
            {lastTrigger.success ? (
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h3 className={`font-semibold mb-2 ${
                lastTrigger.success
                  ? 'text-green-900 dark:text-green-100'
                  : 'text-red-900 dark:text-red-100'
              }`}>
                {lastTrigger.success ? 'Update Successful' : 'Update Failed'}
              </h3>
              {lastTrigger.success ? (
                <div className="space-y-1 text-sm text-green-800 dark:text-green-200">
                  <p>• Entries: {lastTrigger.entriesCount}</p>
                  <p>• Total Players: {lastTrigger.totalPlayers}</p>
                  <p>• Top Player: {lastTrigger.topPlayer}</p>
                  <p>• Timestamp: {new Date(lastTrigger.timestamp!).toLocaleString()}</p>
                </div>
              ) : (
                <p className="text-sm text-red-800 dark:text-red-200">
                  {lastTrigger.error}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Current Top 10 */}
      <div className="bg-white dark:bg-dark-900 rounded-xl border border-gray-200 dark:border-dark-700 p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Current Top 10
        </h2>
        {loadingSnapshot ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading rankings...</p>
          </div>
        ) : snapshot?.entries.length ? (
          <div className="space-y-2">
            {snapshot.entries.map((entry, index) => {
              const medalColors = ['text-yellow-500', 'text-gray-400', 'text-orange-600']
              const isTopThree = index < 3

              return (
                <div
                  key={entry.userId}
                  className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 dark:bg-dark-800 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                >
                  <div className="w-12 text-center font-bold">
                    {isTopThree ? (
                      <span className={medalColors[index]}>#{entry.rank}</span>
                    ) : (
                      <span className="text-gray-600 dark:text-gray-400">#{entry.rank}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {entry.displayName}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {entry.totalXP} XP • Level {entry.currentLevel} • Streak: {entry.currentStreak}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No leaderboard data available
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          About Leaderboard Updates
        </h3>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <p>• <strong>Automatic:</strong> Updates daily at 00:00 UTC via scheduled function</p>
          <p>• <strong>Manual:</strong> Click "Update Now" to trigger immediately</p>
          <p>• <strong>Scoring:</strong> Score = totalXP + (currentStreak × 3)</p>
          <p>• <strong>Privacy:</strong> Respects user opt-outs from leaderboard_optouts collection</p>
          <p>• <strong>Cache:</strong> Results cached in Redis for 5 minutes</p>
          <p>• <strong>Ranking:</strong> Top 100 users displayed with pagination (20/page)</p>
        </div>
      </div>
    </div>
  )
}
