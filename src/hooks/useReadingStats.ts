/**
 * useReadingStats Hook
 *
 * Fetches reading statistics for articles, stories, and books.
 * Used by the statistics page to display reading progress.
 */

import { useState, useEffect } from 'react'
import { useAuth } from './useAuth'

export interface ReadingStats {
  articles: {
    count: number
    readingTimeMs: number
  }
  stories: {
    count: number
    readingTimeSec: number
  }
  books: {
    count: number
    readingTimeSec: number
  }
}

interface UseReadingStatsReturn {
  stats: ReadingStats
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const defaultStats: ReadingStats = {
  articles: { count: 0, readingTimeMs: 0 },
  stories: { count: 0, readingTimeSec: 0 },
  books: { count: 0, readingTimeSec: 0 }
}

export function useReadingStats(): UseReadingStatsReturn {
  const { user, isGuest } = useAuth()
  const [stats, setStats] = useState<ReadingStats>(defaultStats)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    // Guest users have no stats
    if (isGuest || !user) {
      setStats(defaultStats)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/reading-stats')

      if (!response.ok) {
        throw new Error('Failed to fetch reading stats')
      }

      const data = await response.json()

      if (data.success) {
        setStats({
          articles: {
            count: data.stats.articles?.count ?? 0,
            readingTimeMs: data.stats.articles?.readingTimeMs ?? 0
          },
          stories: {
            count: data.stats.stories?.count ?? 0,
            readingTimeSec: data.stats.stories?.readingTimeSec ?? 0
          },
          books: {
            count: data.stats.books?.count ?? 0,
            readingTimeSec: data.stats.books?.readingTimeSec ?? 0
          }
        })
      }
    } catch (err) {
      console.error('[useReadingStats] Error fetching stats:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isGuest])

  return {
    stats,
    loading,
    error,
    refresh: fetchStats
  }
}

/**
 * Format reading time for display
 * @param ms - Time in milliseconds
 * @returns Formatted string (e.g., "2h 30m" or "45m")
 */
export function formatReadingTime(ms: number): string {
  const totalMinutes = Math.round(ms / 60000)
  if (totalMinutes < 60) {
    return `${totalMinutes}m`
  }
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

/**
 * Format reading time from seconds
 * @param sec - Time in seconds
 * @returns Formatted string (e.g., "2h 30m" or "45m")
 */
export function formatReadingTimeSec(sec: number): string {
  return formatReadingTime(sec * 1000)
}
