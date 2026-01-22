'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import {
  getLearningVillageStorageKey,
  isLearningVillageTrackedRoute,
  normalizeLearningVillagePath,
} from '@/lib/analytics/learningVillageRoutes'

export default function LearningVillageTracker() {
  const pathname = usePathname()
  const lastTrackedRef = useRef<string | null>(null)
  const currentPathRef = useRef<string | null>(null)
  const visibleStartRef = useRef<number | null>(null)
  const accumulatedMsRef = useRef(0)
  const durationSentRef = useRef(false)

  const flushDuration = () => {
    const path = currentPathRef.current
    if (!path || !isLearningVillageTrackedRoute(path)) return

    if (visibleStartRef.current !== null) {
      accumulatedMsRef.current += performance.now() - visibleStartRef.current
      visibleStartRef.current = null
    }

    if (durationSentRef.current) return
    const durationMs = accumulatedMsRef.current
    if (!Number.isFinite(durationMs) || durationMs <= 0) return

    durationSentRef.current = true

    fetch('/api/waitlist/track-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ page: path, durationMs }),
    }).catch((err) => console.error('Failed to track Learning Village duration:', err))
  }

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!currentPathRef.current) return

      if (document.visibilityState === 'hidden') {
        if (visibleStartRef.current !== null) {
          accumulatedMsRef.current += performance.now() - visibleStartRef.current
          visibleStartRef.current = null
        }
      } else if (document.visibilityState === 'visible') {
        if (visibleStartRef.current === null) {
          visibleStartRef.current = performance.now()
        }
      }
    }

    const handlePageHide = () => {
      flushDuration()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      flushDuration()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [])

  useEffect(() => {
    if (!pathname) return

    const normalizedPath = normalizeLearningVillagePath(pathname)
    if (!isLearningVillageTrackedRoute(normalizedPath)) {
      if (currentPathRef.current) {
        flushDuration()
        currentPathRef.current = null
        visibleStartRef.current = null
        accumulatedMsRef.current = 0
        durationSentRef.current = false
      }
      lastTrackedRef.current = null
      return
    }

    if (currentPathRef.current && currentPathRef.current !== normalizedPath) {
      flushDuration()
      accumulatedMsRef.current = 0
      durationSentRef.current = false
      visibleStartRef.current = null
    }

    if (lastTrackedRef.current === normalizedPath) return
    lastTrackedRef.current = normalizedPath

    try {
      const storageKey = getLearningVillageStorageKey(normalizedPath)
      const hasVisited = localStorage.getItem(storageKey) === 'true'
      const isUniqueVisitor = !hasVisited

      currentPathRef.current = normalizedPath
      accumulatedMsRef.current = 0
      durationSentRef.current = false
      if (document.visibilityState === 'visible') {
        visibleStartRef.current = performance.now()
      } else {
        visibleStartRef.current = null
      }

      fetch('/api/waitlist/track-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: normalizedPath, isUniqueVisitor }),
      }).catch((err) => console.error('Failed to track Learning Village visit:', err))

      if (isUniqueVisitor) {
        localStorage.setItem(storageKey, 'true')
      }
    } catch (error) {
      console.error('Learning Village tracking failed:', error)
    }
  }, [pathname])

  return null
}
