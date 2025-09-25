'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStorageDecision } from '@/hooks/useStorageDecision'
import { IndexedDBStorage } from '@/lib/review-engine/offline/indexed-db'
import logger from '@/lib/logger'

interface ReviewItem {
  id: string
  contentType: 'kana' | 'kanji' | 'vocabulary' | 'sentence'
  primaryDisplay: string
  secondaryDisplay?: string
  state: 'new' | 'learning' | 'review' | 'mastered'
  interval: number
  easeFactor: number
  consecutiveCorrect: number
  successRate: number
  lastReviewDate?: Date
  nextReviewDate?: Date
}

interface LeechItem {
  id: string
  content: {
    primaryDisplay: string
    secondaryDisplay?: string
    contentType: string
    difficulty: number
  }
  failureCount: number
  successRate: number
  lastFailureDate: Date
  firstSeenDate: Date
  errorHistory: Array<{
    date: Date
    userAnswer: string
    correctAnswer: string
    errorType: 'typo' | 'confusion' | 'memory'
  }>
  srsData: {
    easeFactor: number
    interval: number
    consecutiveFailures: number
  }
}

interface ReviewSession {
  id: string
  date: Date
  duration: number
  itemsReviewed: number
  accuracy: number
  averageResponseTime: number
  mode: 'recognition' | 'recall'
  status: 'completed' | 'abandoned'
}

interface CurrentSession {
  id: string
  startTime: Date
  itemsCompleted: number
  itemsTotal: number
  currentAccuracy: number
  averageResponseTime: number
  streak: number
}

export function useReviewData() {
  const { user, isGuest } = useAuth()
  const { handleStorageResponse, shouldSaveToIndexedDB } = useStorageDecision()
  const [srsItems, setSrsItems] = useState<ReviewItem[]>([])
  const [queueItems, setQueueItems] = useState<any[]>([])
  const [sessions, setSessions] = useState<ReviewSession[]>([])
  const [currentSession, setCurrentSession] = useState<CurrentSession | null>(null)
  const [leeches, setLeeches] = useState<LeechItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadReviewData()
  }, [user])

  const loadReviewData = async () => {
    try {
      setLoading(true)
      setError(null)

      if (isGuest) {
        // Guest users only use local data
        await loadLocalData()
        return
      }

      // For authenticated users, check API response for storage location
      try {
        const response = await fetch('/api/review/stats')
        if (!response.ok) throw new Error('Failed to fetch review stats')

        const data = await response.json()
        const storageDecision = handleStorageResponse(data)

        if (storageDecision.storageLocation === 'local') {
          // Free user - load from local IndexedDB only
          console.log('[ReviewData] Free user - loading from IndexedDB')
          await loadLocalData()
        } else if (storageDecision.storageLocation === 'both') {
          // Premium user - load from cloud and cache locally
          console.log('[ReviewData] Premium user - loading from cloud')
          await loadCloudData()
          // Cache to IndexedDB for offline access
          if (shouldSaveToIndexedDB(storageDecision.storageLocation)) {
            await cacheDataLocally()
          }
        }
      } catch (apiError) {
        logger.error('API error, falling back to local data:', apiError)
        await loadLocalData()
      }
    } catch (err) {
      logger.error('Failed to load review data:', err)
      setError('Failed to load review data')
    } finally {
      setLoading(false)
    }
  }

  const loadLocalData = async () => {
    try {
      const storage = new IndexedDBStorage()
      await storage.initialize()

      // Load SRS items from IndexedDB
      const userId = user?.uid || 'guest'
      const storedSession = await storage.getSession(userId)

      if (storedSession?.items) {
        const items: ReviewItem[] = storedSession.items.map((item: any, index: number) => ({
          id: `item_${index}`,
          contentType: item.content?.contentType || 'vocabulary',
          primaryDisplay: item.content?.primaryDisplay || '',
          secondaryDisplay: item.content?.secondaryDisplay,
          state: determineState(item),
          interval: item.srsData?.interval || 0,
          easeFactor: item.srsData?.easeFactor || 2.5,
          consecutiveCorrect: item.srsData?.consecutiveCorrect || 0,
          successRate: item.accuracy || 0,
          lastReviewDate: item.lastReviewedAt,
          nextReviewDate: item.nextReviewAt
        }))
        setSrsItems(items)

        // Generate queue items (due for review)
        const due = items.filter(item => {
          if (!item.nextReviewDate) return item.state === 'new'
          return new Date(item.nextReviewDate) <= new Date()
        })
        setQueueItems(due)

        // Identify leeches (items with low success rate)
        const leechItems = items
          .filter(item => item.successRate < 0.6 && item.state !== 'new')
          .map(item => ({
            id: item.id,
            content: {
              primaryDisplay: item.primaryDisplay,
              secondaryDisplay: item.secondaryDisplay,
              contentType: item.contentType,
              difficulty: 1 - item.successRate
            },
            failureCount: Math.floor((1 - item.successRate) * 10),
            successRate: item.successRate,
            lastFailureDate: new Date(),
            firstSeenDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            errorHistory: [],
            srsData: {
              easeFactor: item.easeFactor,
              interval: item.interval,
              consecutiveFailures: Math.max(0, 3 - item.consecutiveCorrect)
            }
          }))
        setLeeches(leechItems)
      }

      // Load real sessions from IndexedDB
      const sessionHistory = await storage.getUserSessions(userId)
      const realSessions: ReviewSession[] = sessionHistory
        .filter((session: any) => session.status === 'completed')
        .map((session: any) => ({
          id: session.id,
          date: new Date(session.completedAt || session.startedAt),
          duration: session.duration || 0,
          itemsReviewed: session.items?.length || 0,
          accuracy: calculateAccuracy(session.items),
          averageResponseTime: session.averageResponseTime || 0,
          mode: session.mode || 'recognition',
          status: session.status || 'completed'
        }))
      setSessions(realSessions)

      // Check for active session
      if (storedSession?.status === 'active') {
        setCurrentSession({
          id: storedSession.id,
          startTime: storedSession.startedAt,
          itemsCompleted: storedSession.currentIndex || 0,
          itemsTotal: storedSession.items?.length || 0,
          currentAccuracy: calculateAccuracy(storedSession.items),
          averageResponseTime: 2.8,
          streak: calculateStreak(storedSession.items)
        })
      }
    } catch (err) {
      logger.error('Failed to load local data:', err)
      throw err
    }
  }

  const loadCloudData = async () => {
    try {
      // Fetch from API endpoints - they will return storage location
      const [statsRes, queueRes, progressRes, sessionsRes] = await Promise.all([
        fetch('/api/review/stats'),
        fetch('/api/review/queue'),
        fetch('/api/review/progress/studied'),
        fetch('/api/review/user-sessions')
      ])

      if (statsRes.ok && queueRes.ok && progressRes.ok) {
        const statsData = await statsRes.json()
        const progressData = await progressRes.json()
        const queueData = await queueRes.json()

        // Check storage location from response
        const storageDecision = handleStorageResponse(statsData)

        if (storageDecision.storageLocation !== 'both') {
          // If not premium, should not be loading cloud data
          console.warn('[ReviewData] Non-premium user attempted cloud load')
          await loadLocalData()
          return
        }

        // Transform API data to our format
        const items: ReviewItem[] = progressData.items?.map((item: any) => ({
          id: item.id,
          contentType: item.contentType,
          primaryDisplay: item.primaryDisplay,
          secondaryDisplay: item.secondaryDisplay,
          state: item.status,
          interval: item.srsLevel || 0,
          easeFactor: 2.5,
          consecutiveCorrect: item.correctCount || 0,
          successRate: item.accuracy || 0,
          lastReviewDate: item.lastReviewedAt ? new Date(item.lastReviewedAt) : undefined,
          nextReviewDate: item.nextReviewAt ? new Date(item.nextReviewAt) : undefined
        })) || []

        setSrsItems(items)
        setQueueItems(queueData.items || [])
      }

      // Load real sessions from Firebase
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json()
        if (sessionsData.success && sessionsData.data) {
          // Set the real sessions from Firebase
          const realSessions: ReviewSession[] = sessionsData.data.sessions.map((s: any) => ({
            id: s.id,
            date: new Date(s.date),
            duration: s.duration,
            itemsReviewed: s.itemsReviewed,
            accuracy: s.accuracy,
            averageResponseTime: s.averageResponseTime,
            mode: s.mode,
            status: s.status
          }))
          setSessions(realSessions)
        }
      }
    } catch (err) {
      logger.error('Failed to load cloud data:', err)
      throw err
    }
  }

  const determineState = (item: any): 'new' | 'learning' | 'review' | 'mastered' => {
    if (!item.lastReviewedAt) return 'new'
    const accuracy = item.accuracy || 0
    const interval = item.srsData?.interval || 0

    if (interval >= 21 && accuracy >= 0.9) return 'mastered'
    if (interval < 1) return 'learning'
    return 'review'
  }

  const calculateAccuracy = (items: any[]): number => {
    if (!items || items.length === 0) return 0
    const correct = items.filter(item => item.correct).length
    return correct / items.length
  }

  const calculateStreak = (items: any[]): number => {
    let streak = 0
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].correct) streak++
      else break
    }
    return streak
  }

  const cacheDataLocally = async () => {
    try {
      const storage = new IndexedDBStorage()
      await storage.initialize()
      await storage.cacheContent(srsItems)
    } catch (err) {
      logger.error('Failed to cache data locally:', err)
    }
  }

  return {
    srsItems,
    queueItems,
    sessions,
    currentSession,
    leeches,
    loading,
    error,
    refetch: loadReviewData
  }
}