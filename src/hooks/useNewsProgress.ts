/**
 * useNewsProgress Hook
 * React hook for tracking reading progress on news articles
 *
 * Features:
 * - Automatic session start/end on mount/unmount
 * - Visibility detection (pause when tab hidden)
 * - Idle detection (pause after 60s no activity)
 * - Mark complete with XP reward
 */

'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getNewsProgressManager } from '@/lib/review-engine/progress/NewsProgressManager'
import type { NewsProgressCompleteResponse } from '@/lib/review-engine/progress/news-progress.types'

interface UseNewsProgressOptions {
  articleId: string
  difficulty: string
  enabled?: boolean
}

interface UseNewsProgressReturn {
  /** Current active reading time in milliseconds */
  activeTimeMs: number
  /** Whether the session is currently paused */
  isPaused: boolean
  /** Whether the article has been marked complete this session */
  isCompleted: boolean
  /** Loading state for mark complete action */
  isSubmitting: boolean
  /** Mark the article as complete and receive XP */
  markComplete: () => Promise<NewsProgressCompleteResponse>
  /** Manually pause the session */
  pause: () => void
  /** Manually resume the session */
  resume: () => void
}

export function useNewsProgress({
  articleId,
  difficulty,
  enabled = true,
}: UseNewsProgressOptions): UseNewsProgressReturn {
  const { user } = useAuth()
  const managerRef = useRef(getNewsProgressManager())
  const [activeTimeMs, setActiveTimeMs] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start session on mount, end on unmount
  useEffect(() => {
    if (!enabled || !user?.uid || !articleId) return

    const manager = managerRef.current

    // Start the session
    manager.startSession(articleId, user.uid, difficulty)

    // Update active time every second
    intervalRef.current = setInterval(() => {
      setActiveTimeMs(manager.getActiveTimeMs())
      setIsPaused(manager.isPaused())
    }, 1000)

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      manager.endSession()
    }
  }, [articleId, user?.uid, difficulty, enabled])

  // Handle visibility change (tab switching)
  useEffect(() => {
    if (!enabled) return

    const manager = managerRef.current

    const handleVisibilityChange = () => {
      if (document.hidden) {
        manager.pauseSession()
        setIsPaused(true)
      } else {
        manager.resumeSession()
        setIsPaused(false)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled])

  // Manual pause
  const pause = useCallback(() => {
    managerRef.current.pauseSession()
    setIsPaused(true)
  }, [])

  // Manual resume
  const resume = useCallback(() => {
    managerRef.current.resumeSession()
    setIsPaused(false)
  }, [])

  // Mark complete and receive XP
  const markComplete = useCallback(async (): Promise<NewsProgressCompleteResponse> => {
    if (!user?.uid) {
      return {
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'You must be logged in to earn XP',
        },
      }
    }

    if (isCompleted) {
      return {
        success: true,
        data: {
          xpEarned: 0,
          newTotalXP: 0,
          newLevel: 1,
          streakIncremented: false,
          currentStreak: 0,
          bestStreak: 0,
          alreadyCompleted: true,
        },
      }
    }

    setIsSubmitting(true)

    try {
      const manager = managerRef.current
      const currentTimeMs = manager.getActiveTimeMs()

      // Call API to record completion
      const response = await fetch('/api/news/progress/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleId,
          readingTimeMs: currentTimeMs,
          difficulty,
        }),
      })

      const result: NewsProgressCompleteResponse = await response.json()

      if (result.success) {
        setIsCompleted(true)
        console.log('[useNewsProgress] Article completed:', {
          articleId,
          readingTimeMs: currentTimeMs,
          xpEarned: result.data?.xpEarned,
        })
      }

      return result
    } catch (error) {
      console.error('[useNewsProgress] Failed to mark complete:', error)
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to save progress. Please try again.',
        },
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [articleId, difficulty, user?.uid, isCompleted])

  return {
    activeTimeMs,
    isPaused,
    isCompleted,
    isSubmitting,
    markComplete,
    pause,
    resume,
  }
}
