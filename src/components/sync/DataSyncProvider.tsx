'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import logger from '@/lib/logger'

/**
 * DataSyncProvider - Auto-syncs premium user data to Firebase on page load/refresh
 *
 * This component ensures that premium users' local data is synced to Firebase
 * whenever the app loads or refreshes, preventing data loss.
 */
export function DataSyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { subscription, isPremium } = useSubscription()
  const syncRef = useRef(false)

  useEffect(() => {
    // Only sync once per page load
    if (syncRef.current) return

    async function syncDataToFirebase() {
      if (!user?.uid || !isPremium) {
        logger.info('[DataSyncProvider] Skipping sync - not premium user', {
          userId: user?.uid,
          isPremium
        })
        return
      }

      syncRef.current = true

      logger.info('[DataSyncProvider] Starting auto-sync for premium user', {
        userId: user.uid,
        plan: subscription?.plan
      })

      try {
        // Load local streak data
        const localActivities = localStorage.getItem(`activities_${user.uid}`)

        if (!localActivities) {
          logger.info('[DataSyncProvider] No local activities to sync')
          return
        }

        const activities = JSON.parse(localActivities)
        logger.info('[DataSyncProvider] Found local activities to sync', activities)

        // Clean nested dates structure if needed (handle multiple levels)
        let dates = activities.dates
        while (dates?.dates) {
          logger.info('[DataSyncProvider] Found nested dates, unwrapping...')
          dates = dates.dates // Keep unwrapping until we get to the actual dates
        }

        // Prepare streak data
        const streakData = {
          dates: dates || {},
          current: activities.currentStreak || 0,
          best: activities.bestStreak || 0,
          lastActivityTimestamp: activities.lastActivity || Date.now()
        }

        // Sync to Firebase via unified API
        const response = await fetch('/api/stats/unified', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            type: 'streak',
            data: streakData
          })
        })

        if (!response.ok) {
          logger.error('[DataSyncProvider] Failed to sync streak data', await response.text())
        } else {
          const result = await response.json()
          logger.info('[DataSyncProvider] Successfully synced streak data', result.summary)
        }

      } catch (error) {
        logger.error('[DataSyncProvider] Auto-sync failed', error)
      }
    }

    // Run sync when user and subscription status are loaded
    if (user?.uid && subscription !== undefined) {
      syncDataToFirebase()
    }
  }, [user?.uid, isPremium, subscription])

  return <>{children}</>
}