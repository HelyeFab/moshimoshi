'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { createUuid } from '@/lib/utils/uuid'

const ANON_VISITOR_KEY = 'analytics_anon_visitor_id'

function getOrCreateAnonVisitorId(): string {
  if (typeof window === 'undefined') return createUuid()
  const existing = localStorage.getItem(ANON_VISITOR_KEY)
  if (existing) return existing
  const next = createUuid()
  localStorage.setItem(ANON_VISITOR_KEY, next)
  return next
}

function getLocaleFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/([a-z]{2})(?:\/|$)/)
  return match ? match[1] : null
}

type VisitorInfo = {
  type: 'user' | 'guest'
  userId: string | null
  anonId: string
}

export default function PageVisitTracker() {
  const pathname = usePathname()
  const { user } = useAuth()

  const visitorRef = useRef<VisitorInfo | null>(null)
  const visitIdRef = useRef<string | null>(null)
  const currentPathRef = useRef<string | null>(null)
  const startedAtIsoRef = useRef<string | null>(null)
  const visibleStartRef = useRef<number | null>(null)
  const accumulatedVisibleMsRef = useRef(0)
  const durationSentRef = useRef(false)

  const ensureVisitor = () => {
    if (visitorRef.current) return visitorRef.current
    const anonId = getOrCreateAnonVisitorId()
    const info: VisitorInfo = user?.uid
      ? { type: 'user', userId: user.uid, anonId }
      : { type: 'guest', userId: null, anonId }
    visitorRef.current = info
    return info
  }

  const sendEvent = (payload: Record<string, unknown>, keepalive = false) => {
    fetch('/api/analytics/page-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
      keepalive,
    }).catch((err) => console.error('[PageVisitTracker] Failed to send event:', err))
  }

  const startVisit = (path: string) => {
    const visitor = ensureVisitor()
    const visitId = createUuid()
    const locale = getLocaleFromPath(path)
    const startedAtIso = new Date().toISOString()

    visitIdRef.current = visitId
    currentPathRef.current = path
    startedAtIsoRef.current = startedAtIso
    accumulatedVisibleMsRef.current = 0
    durationSentRef.current = false
    visibleStartRef.current = document.visibilityState === 'visible' ? performance.now() : null

    sendEvent({
      type: 'start',
      visitId,
      path,
      locale,
      startedAt: startedAtIso,
      visitorType: visitor.type,
      userId: visitor.userId,
      anonId: visitor.anonId,
      referrer: document.referrer || null,
    })
  }

  const flushDuration = () => {
    const visitId = visitIdRef.current
    const path = currentPathRef.current
    if (!visitId || !path) return

    if (visibleStartRef.current !== null) {
      accumulatedVisibleMsRef.current += performance.now() - visibleStartRef.current
      visibleStartRef.current = null
    }

    if (durationSentRef.current) return
    durationSentRef.current = true

    const durationMs = Math.max(0, Math.round(accumulatedVisibleMsRef.current))
    const startedAt = startedAtIsoRef.current
    const endedAt = new Date().toISOString()
    const locale = getLocaleFromPath(path)
    const visitor = ensureVisitor()

    sendEvent(
      {
        type: 'end',
        visitId,
        path,
        locale,
        startedAt,
        endedAt,
        durationMs,
        visitorType: visitor.type,
        userId: visitor.userId,
        anonId: visitor.anonId,
      },
      true
    )
  }

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!currentPathRef.current) return
      if (document.visibilityState === 'hidden') {
        if (visibleStartRef.current !== null) {
          accumulatedVisibleMsRef.current += performance.now() - visibleStartRef.current
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
    if (!user?.uid) return
    const anonId = getOrCreateAnonVisitorId()
    visitorRef.current = { type: 'user', userId: user.uid, anonId }
  }, [user?.uid])

  useEffect(() => {
    if (!pathname) return

    if (currentPathRef.current && currentPathRef.current !== pathname) {
      flushDuration()
    }

    if (currentPathRef.current !== pathname) {
      startVisit(pathname)
    }
  }, [pathname])

  return null
}
