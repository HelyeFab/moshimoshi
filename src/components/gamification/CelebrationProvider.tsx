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
      const xpGained = totalXP - previousXP

      // Show celebration with estimated stats
      // Note: We don't have exact session stats here, but we show a celebration anyway
      setCelebrationData({
        xpGained,
        accuracy: 100, // Default to 100% for celebration
        duration: 0,   // We don't track duration at this level
        itemsCompleted: 0 // We don't track items at this level
      })
      setShowCelebration(true)

      // Update previous values
      setPreviousXP(totalXP)
      setPreviousSessionCount(sessionCount)
    }
  }, [totalXP, sessionCount, previousXP, previousSessionCount])

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
