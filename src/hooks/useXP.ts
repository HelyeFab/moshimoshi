'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { xpSystem, UserLevel } from '@/lib/gamification/xp-system'

// Helper function to infer feature from event type
function inferFeatureFromType(type: string): string {
  const featureMap: Record<string, string> = {
    review_completed: 'review',
    drill_completed: 'drill',
    achievement_unlocked: 'achievements',
    streak_bonus: 'streaks',
    perfect_session: 'review',
    speed_bonus: 'review',
    daily_bonus: 'daily',
    lesson_completed: 'lessons',
    quiz_completed: 'quiz',
    milestone_reached: 'milestones'
  }
  return featureMap[type] || 'unknown'
}

// Helper function to generate idempotency key
function generateIdempotencyKey(type: string, source: string, metadata?: any): string {
  // If sessionId exists, use it
  if (metadata?.sessionId) {
    return `${type}_${metadata.sessionId}`
  }

  // If specific ID exists (achievementId, lessonId, etc.), use it
  if (metadata?.achievementId) {
    return `achievement_${metadata.achievementId}`
  }
  if (metadata?.lessonId) {
    return `lesson_${metadata.lessonId}`
  }
  if (metadata?.drillId) {
    return `drill_${metadata.drillId}`
  }

  // Fallback: create key from type, timestamp, and a hash of the source
  const timestamp = metadata?.timestamp || Date.now()
  const sourceHash = source.split('').reduce((hash, char) => {
    return ((hash << 5) - hash) + char.charCodeAt(0)
  }, 0).toString(36)

  return `${type}_${timestamp}_${sourceHash}`
}

interface UseXPReturn {
  totalXP: number
  currentLevel: number
  levelInfo: UserLevel | null
  xpToNextLevel: number
  progressPercentage: number
  loading: boolean
  error: string | null
  refreshXP: () => Promise<void>
  trackXP: (type: string, amount: number, source: string, metadata?: any) => Promise<void>
}

/**
 * Hook for managing XP state and tracking
 * Follows patterns from FEATURE_IMPLEMENTATION.md
 */
export function useXP(): UseXPReturn {
  const { user, isAuthenticated } = useAuth()
  const { showToast } = useToast()

  // Initialize from localStorage if available
  const getInitialXP = () => {
    if (typeof window !== 'undefined' && user?.uid) {
      const stored = localStorage.getItem(`xp_${user.uid}`)
      return stored ? parseInt(stored, 10) : 0
    }
    return 0
  }

  const [totalXP, setTotalXP] = useState(getInitialXP)
  const [currentLevel, setCurrentLevel] = useState(() => xpSystem.getLevelFromXP(getInitialXP()))
  const [levelInfo, setLevelInfo] = useState<UserLevel | null>(() => xpSystem.getUserLevel(getInitialXP()))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch XP status from server
  const fetchXPStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/xp/track', {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch XP status')
      }

      const data = await response.json()

      if (data.success && data.data) {
        setTotalXP(data.data.totalXP || 0)
        setCurrentLevel(data.data.currentLevel || 1)
        setLevelInfo(data.data.levelInfo || xpSystem.getUserLevel(data.data.totalXP || 0))
      }
    } catch (err: any) {
      console.error('Error fetching XP status:', err)
      setError(err.message)

      // Fallback to localStorage if server fails
      const localXP = localStorage.getItem(`xp_${user?.uid}`)
      if (localXP) {
        const xp = parseInt(localXP)
        setTotalXP(xp)
        setCurrentLevel(xpSystem.getLevelFromXP(xp))
        setLevelInfo(xpSystem.getUserLevel(xp))
      }
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, user?.uid])

  // Track XP gain with idempotency and feature tracking
  const trackXP = useCallback(async (
    type: string,
    amount: number,
    source: string,
    metadata?: any
  ) => {
    if (!isAuthenticated) {
      console.warn('[useXP] Cannot track XP - user not authenticated')
      return
    }

    // Ensure metadata includes required fields
    const enhancedMetadata = {
      ...metadata,
      // Add timestamp if not provided
      timestamp: metadata?.timestamp || Date.now(),
      // Add feature if not provided (try to infer from type)
      feature: metadata?.feature || inferFeatureFromType(type),
      // Ensure idempotency key exists
      idempotencyKey: metadata?.idempotencyKey || generateIdempotencyKey(type, source, metadata)
    }

    try {
      const response = await fetch('/api/xp/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          eventType: type as any,
          amount,
          source,
          metadata: enhancedMetadata
        })
      })

      if (!response.ok) {
        throw new Error('Failed to track XP')
      }

      const data = await response.json()

      if (data.success && data.data) {
        // Update local state
        setTotalXP(data.data.totalXP)
        setCurrentLevel(data.data.currentLevel)
        setLevelInfo(data.data.levelInfo)

        // Store in localStorage as backup
        localStorage.setItem(`xp_${user?.uid}`, data.data.totalXP.toString())

        // Show level up toast if applicable
        if (data.data.leveledUp) {
          showToast(
            `🎉 Level ${data.data.currentLevel}! ${data.data.newLevelTitle}`,
            'success'
          )
        }
      }
    } catch (err: any) {
      console.error('Error tracking XP:', err)
      // Silently fail - XP tracking shouldn't break the app
    }
  }, [isAuthenticated, user?.uid, showToast])

  // Refresh XP status
  const refreshXP = useCallback(async () => {
    await fetchXPStatus()
  }, [fetchXPStatus])

  // Load XP on mount and auth change
  useEffect(() => {
    fetchXPStatus()
  }, [fetchXPStatus])

  // Listen for XP gain events for real-time updates
  useEffect(() => {
    const handleXPGained = (event: CustomEvent) => {
      const { xpGained, totalXP: newTotalXP, currentLevel: newLevel, leveledUp, newLevelTitle } = event.detail

      // Update state with new values
      setTotalXP(newTotalXP)
      setCurrentLevel(newLevel)
      setLevelInfo(xpSystem.getUserLevel(newTotalXP))

      // Store in localStorage
      if (user?.uid) {
        localStorage.setItem(`xp_${user.uid}`, newTotalXP.toString())
      }

      // Show level up notification if needed
      if (leveledUp && newLevelTitle) {
        showToast(`🎉 Level ${newLevel}! ${newLevelTitle}`, 'success')
      }
    }

    window.addEventListener('xpGained', handleXPGained as EventListener)
    return () => window.removeEventListener('xpGained', handleXPGained as EventListener)
  }, [user?.uid, showToast])

  // Calculate derived values
  const xpToNextLevel = levelInfo?.xpToNextLevel || 100
  const progressPercentage = levelInfo?.progressPercentage || 0

  return {
    totalXP,
    currentLevel,
    levelInfo,
    xpToNextLevel,
    progressPercentage,
    loading,
    error,
    refreshXP,
    trackXP
  }
}