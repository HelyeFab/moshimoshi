'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import ContentCelebration from '@/components/shared/ContentCelebration'
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
  const hasHydrated = useGamificationStore((state) => state.hasHydrated)

  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationData, setCelebrationData] = useState<{
    xpGained: number
    accuracy: number
    duration: number
    itemsCompleted: number
    contentType?: 'story' | 'comic' | 'article' | 'book' | 'flashcard'
    contentTitle?: string
    difficulty?: string
    pageCount?: number
    panelCount?: number
    vocabularyCount?: number
    readingTimeMs?: number
  } | null>(null)

  const [previousXP, setPreviousXP] = useState(0)
  const [previousSessionCount, setPreviousSessionCount] = useState(0)
  const [isFirstRender, setIsFirstRender] = useState(true)

  // Detect XP changes (indicates a session was completed)
  useEffect(() => {
    console.log('🎊 [CelebrationProvider] Effect triggered:', {
      totalXP,
      previousXP,
      sessionCount,
      previousSessionCount,
      isFirstRender,
      hasHydrated,
      hasLastSessionStats: !!lastSessionStats,
      lastSessionStatsCleared: lastSessionStats?.clearedAt ? true : false
    })

    // CRITICAL: Don't trigger celebration before hydration completes
    // This prevents stale state from triggering celebrations on component remount
    if (!hasHydrated) {
      console.log('🎊 [CelebrationProvider] Skipping - not hydrated yet')
      return
    }

    // Set baseline values AFTER hydration completes (on first hydrated render)
    // This ensures we capture the real persisted values, not pre-hydration zeros
    if (isFirstRender) {
      console.log('🎊 [CelebrationProvider] First hydrated render, setting baseline values:', {
        totalXP,
        sessionCount
      })
      setPreviousXP(totalXP)
      setPreviousSessionCount(sessionCount)
      setIsFirstRender(false)
      return
    }

    // CRITICAL: Don't show celebration if it was already shown and cleared
    // This prevents duplicate celebrations when navigating back to dashboard
    if (lastSessionStats?.clearedAt) {
      console.log('🎊 [CelebrationProvider] Skipping - celebration already shown (clearedAt:', new Date(lastSessionStats.clearedAt).toISOString(), ')')
      return
    }

    // Check if XP increased (session completed)
    if (totalXP > previousXP && sessionCount > previousSessionCount) {
      console.log('🎊 [CelebrationProvider] Session completed detected!', {
        xpGained: totalXP - previousXP,
        sessionCountDiff: sessionCount - previousSessionCount
      })

      // Use actual session stats from store (set by gamificationListener)
      if (lastSessionStats) {
        console.log('🎊 [CelebrationProvider] Setting celebration data:', lastSessionStats)
        setCelebrationData({
          xpGained: lastSessionStats.xpGained,
          accuracy: lastSessionStats.accuracy,
          duration: lastSessionStats.duration,
          itemsCompleted: lastSessionStats.itemsCompleted,
          // Content-specific metadata (for adaptive celebrations)
          contentType: lastSessionStats.contentType,
          contentTitle: lastSessionStats.contentTitle,
          difficulty: lastSessionStats.difficulty,
          pageCount: lastSessionStats.pageCount,
          panelCount: lastSessionStats.panelCount,
          vocabularyCount: lastSessionStats.vocabularyCount,
          readingTimeMs: lastSessionStats.readingTimeMs
        })
      } else {
        console.log('⚠️ [CelebrationProvider] No lastSessionStats available!')
        // Fallback if stats not available
        const xpGained = totalXP - previousXP
        setCelebrationData({
          xpGained,
          accuracy: 100,
          duration: 0,
          itemsCompleted: 0
        })
      }
      console.log('🎊 [CelebrationProvider] Setting showCelebration = true!')
      setShowCelebration(true)

      // Clear lastSessionStats immediately to prevent re-showing on navigation
      console.log('🎊 [CelebrationProvider] Clearing lastSessionStats to prevent duplicate celebration')
      clearLastSessionStats()

      // Update previous values
      setPreviousXP(totalXP)
      setPreviousSessionCount(sessionCount)
    } else {
      console.log('🎊 [CelebrationProvider] Conditions not met for celebration:', {
        xpIncreased: totalXP > previousXP,
        sessionCountIncreased: sessionCount > previousSessionCount
      })
    }
  }, [totalXP, sessionCount, previousXP, previousSessionCount, lastSessionStats, hasHydrated])

  return (
    <>
      {children}

      {/* Global Celebration Screen - Using ContentCelebration for all features */}
      {celebrationData && showCelebration && (
        <ContentCelebration
          contentTitle={celebrationData.contentTitle || 'Quiz Complete!'}
          contentType={celebrationData.contentType || 'flashcard'}
          xpEarned={celebrationData.xpGained}
          readingTimeMs={
            celebrationData.readingTimeMs && celebrationData.readingTimeMs > 0
              ? celebrationData.readingTimeMs
              : celebrationData.duration && celebrationData.duration > 0
              ? celebrationData.duration
              : undefined
          }
          difficulty={celebrationData.difficulty}
          pageCount={celebrationData.pageCount}
          panelCount={celebrationData.panelCount}
          vocabularyCount={celebrationData.vocabularyCount}
          onClose={() => {
            setShowCelebration(false)
            setCelebrationData(null)
            clearLastSessionStats() // Clear stats from store
          }}
        />
      )}
    </>
  )
}
