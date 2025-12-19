'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import CelebrationScreen from './CelebrationScreen'
import { useGamificationStore } from '@/state/userGamification'

/**
 * Global Celebration Provider
 *
 * Listens to gamification state changes (XP awards) and shows celebration
 * when user earns XP from any learning activity.
 *
 * This is connected to the gamification system via the Zustand store,
 * which updates whenever the gamification listener processes a SESSION_COMPLETED event.
 */
export default function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const totalXP = useGamificationStore((state) => state.totalXP)
  const sessionCount = useGamificationStore((state) => state.sessionCount)
  const lastSessionStats = useGamificationStore((state) => state.lastSessionStats)
  const clearLastSessionStats = useGamificationStore((state) => state.clearLastSessionStats)

  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationData, setCelebrationData] = useState<{
    xpGained: number
    accuracy: number
    duration: number
    itemsCompleted: number
  } | null>(null)

  const [previousXP, setPreviousXP] = useState(0)
  const [previousSessionCount, setPreviousSessionCount] = useState(0)

  // Detect XP changes (indicates a session was completed)
  useEffect(() => {
    // Skip initial load
    if (previousXP === 0 && previousSessionCount === 0) {
      setPreviousXP(totalXP)
      setPreviousSessionCount(sessionCount)
      return
    }

    // Check if XP increased (session completed)
    if (totalXP > previousXP && sessionCount > previousSessionCount) {
      // Use actual session stats from store (set by gamificationListener)
      if (lastSessionStats) {
        setCelebrationData({
          xpGained: lastSessionStats.xpGained,
          accuracy: lastSessionStats.accuracy,
          duration: lastSessionStats.duration,
          itemsCompleted: lastSessionStats.itemsCompleted
        })
      } else {
        // Fallback if stats not available
        const xpGained = totalXP - previousXP
        setCelebrationData({
          xpGained,
          accuracy: 100,
          duration: 0,
          itemsCompleted: 0
        })
      }
      setShowCelebration(true)

      // Update previous values
      setPreviousXP(totalXP)
      setPreviousSessionCount(sessionCount)
    }
  }, [totalXP, sessionCount, previousXP, previousSessionCount, lastSessionStats])

  return (
    <>
      {children}

      {/* Global Celebration Screen */}
      {celebrationData && (
        <CelebrationScreen
          isOpen={showCelebration}
          onClose={() => {
            setShowCelebration(false)
            setCelebrationData(null)
            clearLastSessionStats() // Clear stats from store
          }}
          userName={user?.displayName || user?.email?.split('@')[0] || 'Student'}
          xpGained={celebrationData.xpGained}
          accuracy={celebrationData.accuracy}
          duration={celebrationData.duration}
          itemsCompleted={celebrationData.itemsCompleted}
        />
      )}
    </>
  )
}
