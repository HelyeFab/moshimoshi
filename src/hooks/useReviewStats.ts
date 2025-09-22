'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { IndexedDBStorage } from '@/lib/review-engine/offline/indexed-db'
import logger from '@/lib/logger'

interface ReviewStats {
  dueNow: number
  newItems: number
  learningItems: number
  masteredItems: number
  todaysGoal: number
  todaysProgress: number
  currentStreak: number
  bestStreak: number
  totalStudied: number
  totalLearned: number
  totalMastered: number
  dueToday: number
  dueTomorrow: number
  dueThisWeek: number
}

export function useReviewStats() {
  const { user, isGuest } = useAuth()
  const { isPremium } = useSubscription()
  const [stats, setStats] = useState<ReviewStats>({
    dueNow: 0,
    newItems: 0,
    learningItems: 0,
    masteredItems: 0,
    todaysGoal: 30,
    todaysProgress: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalStudied: 0,
    totalLearned: 0,
    totalMastered: 0,
    dueToday: 0,
    dueTomorrow: 0,
    dueThisWeek: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStats()
  }, [user, isPremium])

  const loadStats = async () => {
    try {
      setLoading(true)
      setError(null)

      if (isGuest || !isPremium) {
        // Load from local storage for free/guest users
        await loadLocalStats()
      } else {
        // Load from cloud for premium users
        await loadCloudStats()
      }
    } catch (err) {
      logger.error('Failed to load review stats:', err)
      setError('Failed to load stats')
      // Fallback to local stats
      await loadLocalStats()
    } finally {
      setLoading(false)
    }
  }

  const loadLocalStats = async () => {
    try {
      const storage = new IndexedDBStorage()
      await storage.initialize()

      const userId = user?.uid || 'guest'

      // Get all sessions from IndexedDB
      const sessions = await storage.getAllSessions?.(userId) || []

      // Calculate stats from local data
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const weekEnd = new Date(today)
      weekEnd.setDate(weekEnd.getDate() + 7)

      // Count items by state
      let newCount = 0
      let learningCount = 0
      let masteredCount = 0
      let dueNowCount = 0
      let dueTodayCount = 0
      let dueTomorrowCount = 0
      let dueThisWeekCount = 0
      let totalStudiedCount = 0
      let totalLearnedCount = 0

      // Process all items from sessions
      sessions.forEach((session: any) => {
        if (session.items) {
          session.items.forEach((item: any) => {
            totalStudiedCount++

            // Determine state
            const state = determineItemState(item)
            if (state === 'new') newCount++
            else if (state === 'learning') learningCount++
            else if (state === 'mastered') {
              masteredCount++
              totalLearnedCount++
            } else if (state === 'review') {
              totalLearnedCount++
            }

            // Check due dates
            if (item.nextReviewAt) {
              const reviewDate = new Date(item.nextReviewAt)
              if (reviewDate <= now) dueNowCount++
              if (reviewDate <= tomorrow) dueTodayCount++
              if (reviewDate <= new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)) dueTomorrowCount++
              if (reviewDate <= weekEnd) dueThisWeekCount++
            }
          })
        }
      })

      // Calculate streak from localStorage
      const lastReviewDate = localStorage.getItem('lastReviewDate')
      const currentStreak = parseInt(localStorage.getItem('currentStreak') || '0')
      const bestStreak = parseInt(localStorage.getItem('bestStreak') || '0')

      // Calculate today's progress
      const todaysProgress = sessions.filter((s: any) => {
        const sessionDate = new Date(s.startedAt || s.date)
        return sessionDate >= today
      }).reduce((sum: number, s: any) => sum + (s.items?.length || 0), 0)

      setStats({
        dueNow: dueNowCount,
        newItems: newCount,
        learningItems: learningCount,
        masteredItems: masteredCount,
        todaysGoal: 30,
        todaysProgress,
        currentStreak,
        bestStreak: Math.max(bestStreak, currentStreak),
        totalStudied: totalStudiedCount,
        totalLearned: totalLearnedCount,
        totalMastered: masteredCount,
        dueToday: dueTodayCount,
        dueTomorrow: dueTomorrowCount - dueTodayCount,
        dueThisWeek: dueThisWeekCount
      })
    } catch (err) {
      logger.error('Failed to load local stats:', err)
      // Set default stats on error
      setStats({
        dueNow: 0,
        newItems: 0,
        learningItems: 0,
        masteredItems: 0,
        todaysGoal: 30,
        todaysProgress: 0,
        currentStreak: 0,
        bestStreak: 0,
        totalStudied: 0,
        totalLearned: 0,
        totalMastered: 0,
        dueToday: 0,
        dueTomorrow: 0,
        dueThisWeek: 0
      })
    }
  }

  const loadCloudStats = async () => {
    try {
      const response = await fetch('/api/review/stats')
      if (response.ok) {
        const data = await response.json()

        setStats({
          dueNow: data.dueNow || 0,
          newItems: data.newItems || 0,
          learningItems: data.learningItems || 0,
          masteredItems: data.totalMastered || 0,
          todaysGoal: 30,
          todaysProgress: data.todaysProgress || 0,
          currentStreak: data.streakDays || 0,
          bestStreak: data.bestStreak || data.streakDays || 0,
          totalStudied: data.totalStudied || 0,
          totalLearned: data.totalLearned || 0,
          totalMastered: data.totalMastered || 0,
          dueToday: data.dueToday || 0,
          dueTomorrow: data.dueTomorrow || 0,
          dueThisWeek: data.dueThisWeek || 0
        })

        // Also sync to local for offline access
        if (data.streakDays !== undefined) {
          localStorage.setItem('currentStreak', data.streakDays.toString())
          localStorage.setItem('bestStreak', (data.bestStreak || data.streakDays).toString())
          localStorage.setItem('lastReviewDate', new Date().toISOString())
        }
      } else {
        throw new Error('Failed to fetch cloud stats')
      }
    } catch (err) {
      logger.error('Failed to load cloud stats:', err)
      throw err
    }
  }

  const determineItemState = (item: any): string => {
    if (!item.lastReviewedAt) return 'new'

    const accuracy = item.accuracy || 0
    const interval = item.srsData?.interval || 0
    const reviewCount = item.reviewCount || 0

    if (interval >= 21 && accuracy >= 0.9) return 'mastered'
    if (interval < 1 || reviewCount < 3) return 'learning'
    return 'review'
  }

  return {
    stats,
    loading,
    error,
    refetch: loadStats
  }
}