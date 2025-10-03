/**
 * Learning Progress Hook
 * Tracks user's learning progress across all content categories
 * Phase 1: Drills only (expandable to kana, kanji, vocabulary later)
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { DrillProgressManager } from '@/lib/review-engine/progress/DrillProgressManager'
import logger from '@/lib/logger'

/**
 * Category-specific progress data
 */
export interface CategoryProgress {
  started: boolean
  masteryScore: number      // 0-100 mastery percentage
  totalDrills?: number       // For drills category
  accuracy?: number          // For drills category
  displayName: string
}

/**
 * Overall learning progress structure
 */
export interface LearningProgress {
  overall: {
    progressPercentage: number  // 0-100 overall progress
    categoriesStarted: number   // Number of categories user has begun
  }
  categories: {
    drills?: CategoryProgress
    // Future: hiragana, katakana, kanji, vocabulary_minna_1, etc.
  }
  loading: boolean
  error: Error | null
}

/**
 * Hook to track personalized learning progress
 * Following Bunpro approach: only track what user has actually started
 */
export function useLearningProgress(): LearningProgress {
  const { user } = useAuth()
  const { isPremium } = useSubscription()

  const [progress, setProgress] = useState<LearningProgress>({
    overall: {
      progressPercentage: 0,
      categoriesStarted: 0
    },
    categories: {},
    loading: true,
    error: null
  })

  useEffect(() => {
    // Guest users or no user: return empty progress
    if (!user?.uid) {
      setProgress({
        overall: { progressPercentage: 0, categoriesStarted: 0 },
        categories: {},
        loading: false,
        error: null
      })
      return
    }

    const loadProgress = async () => {
      try {
        logger.debug('[useLearningProgress] Loading progress for user:', user.uid)

        // Load drill progress
        const drillManager = DrillProgressManager.getInstance()
        const drillStats = await drillManager.getDrillStats(user.uid, isPremium || false)

        let overallProgress = 0
        let categoriesStarted = 0
        const categories: LearningProgress['categories'] = {}

        // Calculate drill progress if user has started drills
        if (drillStats && drillStats.totalDrills > 0) {
          categoriesStarted += 1
          const drillMasteryScore = drillManager.calculateMasteryLevel(drillStats)

          categories.drills = {
            started: true,
            masteryScore: drillMasteryScore,
            totalDrills: drillStats.totalDrills,
            accuracy: Math.round(drillStats.accuracy || 0),
            displayName: 'Conjugation Drills'
          }

          // For now, overall progress = drill progress (only category)
          overallProgress = drillMasteryScore

          logger.info('[useLearningProgress] Drill progress calculated:', {
            totalDrills: drillStats.totalDrills,
            accuracy: drillStats.accuracy,
            masteryScore: drillMasteryScore
          })
        } else {
          logger.debug('[useLearningProgress] No drill progress found')
        }

        setProgress({
          overall: {
            progressPercentage: overallProgress,
            categoriesStarted
          },
          categories,
          loading: false,
          error: null
        })
      } catch (error) {
        logger.error('[useLearningProgress] Failed to load progress:', error)
        setProgress(prev => ({
          ...prev,
          loading: false,
          error: error as Error
        }))
      }
    }

    loadProgress()
  }, [user?.uid, isPremium])

  return progress
}
