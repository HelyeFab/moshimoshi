'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { xpSystem, UserLevel } from '@/lib/gamification/xp-system'

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

  // Track XP gain
  const trackXP = useCallback(async (
    type: string,
    amount: number,
    source: string,
    metadata?: any
  ) => {
    if (!isAuthenticated) {
      return
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
          metadata
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