'use client'

/**
 * DEPRECATED: This hook is maintained for backward compatibility.
 * New code should use useUserStats() instead.
 *
 * This file now acts as a wrapper around useUserStats to maintain
 * compatibility with existing components that use useXP.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { xpSystem, UserLevel } from '@/lib/gamification/xp-system'
import logger from '@/lib/logger'

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
 * DEPRECATED: Wrapper around useUserStats for backward compatibility
 *
 * @deprecated Use useUserStats() instead
 */
export function useXP(): UseXPReturn {
  const { user, isAuthenticated } = useAuth()
  const { showToast } = useToast()

  // TEMPORARY FIX: Don't use useUserStats to avoid circular dependency
  // This should be replaced with direct useUserStats usage in components
  const [totalXP, setTotalXP] = useState(0)
  const [currentLevel, setCurrentLevel] = useState(1)
  const [levelInfo, setLevelInfo] = useState<UserLevel | null>(null)
  const [loading, setLoading] = useState(true) // Start with loading true
  const [error, setError] = useState<string | null>(null)
  const [hasInitialized, setHasInitialized] = useState(false)

  // Log deprecation warning in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      logger.warn('[useXP] This hook is deprecated. Please use useUserStats() instead.')
    }
  }, [])

  // Initialize from localStorage if available
  useEffect(() => {
    if (typeof window !== 'undefined' && user?.uid && !hasInitialized) {
      const stored = localStorage.getItem(`xp_${user.uid}`)
      if (stored) {
        const xp = parseInt(stored, 10)
        setTotalXP(xp)
        setCurrentLevel(xpSystem.getLevelFromXP(xp))
        setLevelInfo(xpSystem.getUserLevel(xp))
        setHasInitialized(true)
        setLoading(false) // Got data from localStorage
      }
      // If no localStorage data, wait for refreshXP to complete
    }
  }, [user?.uid, hasInitialized])

  // Track XP gain - redirect to unified stats API
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

    logger.info('[useXP] Redirecting to unified stats API', {
      type,
      amount,
      source
    })

    // Ensure metadata includes required fields
    const enhancedMetadata = {
      ...metadata,
      timestamp: metadata?.timestamp || Date.now(),
      feature: metadata?.feature || inferFeatureFromType(type),
      idempotencyKey: metadata?.idempotencyKey || generateIdempotencyKey(type, source, metadata)
    }

    try {
      // Call unified stats API directly
      const response = await fetch('/api/stats/unified', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          type: 'xp',
          data: {
            add: amount,
            source,
            metadata: enhancedMetadata
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to track XP')
      }

      const data = await response.json()

      if (data.stats?.xp) {
        // Update local state
        setTotalXP(data.stats.xp.total)
        setCurrentLevel(data.stats.xp.level)
        setLevelInfo(xpSystem.getUserLevel(data.stats.xp.total))

        // Store in localStorage
        if (user?.uid) {
          localStorage.setItem(`xp_${user.uid}`, data.stats.xp.total.toString())
        }

        // Check if leveled up
        if (data.stats.xp.level > currentLevel) {
          showToast(
            `🎉 Level ${data.stats.xp.level}! ${xpSystem.getUserLevel(data.stats.xp.total).title}`,
            'success'
          )
        }
      }
    } catch (err: any) {
      console.error('[useXP] Error tracking XP:', err)
      setError(err.message)
      // Silently fail - XP tracking shouldn't break the app
    }
  }, [isAuthenticated, user?.uid, currentLevel, showToast])

  // Refresh XP from unified API
  const refreshXP = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/stats/unified', {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch XP')
      }

      const data = await response.json()

      if (data.stats?.xp) {
        setTotalXP(data.stats.xp.total || 0)
        setCurrentLevel(data.stats.xp.level || 1)
        setLevelInfo(xpSystem.getUserLevel(data.stats.xp.total || 0))
        setHasInitialized(true)

        // Store in localStorage
        if (user?.uid) {
          localStorage.setItem(`xp_${user.uid}`, (data.stats.xp.total || 0).toString())
        }
      }
    } catch (err: any) {
      console.error('[useXP] Error refreshing XP:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, user?.uid])

  // Listen for XP gain events for real-time updates
  useEffect(() => {
    const handleXPGained = (event: CustomEvent) => {
      const { leveledUp, newLevelTitle, currentLevel: newLevel } = event.detail

      // Show level up notification if needed
      if (leveledUp && newLevelTitle) {
        showToast(`🎉 Level ${newLevel}! ${newLevelTitle}`, 'success')
      }
    }

    window.addEventListener('xpGained', handleXPGained as EventListener)
    return () => window.removeEventListener('xpGained', handleXPGained as EventListener)
  }, [showToast])

  // Calculate derived values
  const xpToNextLevel = levelInfo?.xpToNextLevel || 100
  const progressPercentage = levelInfo?.progressPercentage || 0

  // Fetch initial XP when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.uid && !hasInitialized) {
      refreshXP()
    }
  }, [isAuthenticated, user?.uid, hasInitialized, refreshXP]) // Trigger when authentication is confirmed

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