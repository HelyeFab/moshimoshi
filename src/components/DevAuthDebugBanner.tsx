'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export function DevAuthDebugBanner() {
  const pathname = usePathname()
  const { user, loading, isAuthenticated, isGuest, isOffline, debug } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setDismissed(false)
  }, [pathname])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const show = process.env.NODE_ENV !== 'production' && isMounted && !dismissed

  const summary = useMemo(() => {
    return {
      path: pathname,
      loading,
      isAuthenticated,
      isGuest,
      isOffline,
      user: user ? { uid: user.uid, email: user.email, emailVerified: user.emailVerified } : null,
      lastSessionCheckAt: debug?.lastSessionCheckAt,
      lastSessionCheck: debug?.lastSessionCheck,
      lastSessionError: debug?.lastSessionError,
      authFlowFlag: debug?.authFlowFlag,
      sessionHistory: debug?.sessionHistory || [],
    }
  }, [pathname, loading, isAuthenticated, isGuest, isOffline, user, debug])

  if (!show) {
    return null
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(summary, null, 2))
    } catch {
      // noop
    }
  }

  return (
    <div className="bg-blue-50/95 dark:bg-blue-950/80 border-b border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 px-4 py-2 text-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2">
        <span className="font-semibold">DEV AUTH DEBUG</span>
        <span>auth: {isAuthenticated ? 'yes' : 'no'}</span>
        <span>loading: {loading ? 'yes' : 'no'}</span>
        <span>guest: {isGuest ? 'yes' : 'no'}</span>
        <span>offline: {isOffline ? 'yes' : 'no'}</span>
        <span>flowFlag: {debug?.authFlowFlag ? 'on' : 'off'}</span>
        <span>user: {user?.email || 'none'}</span>
        {debug?.lastSessionError ? (
          <span className="text-red-600 dark:text-red-300">session error: {debug.lastSessionError}</span>
        ) : null}
        {debug?.sessionHistory?.length ? (
          <span>history: {debug.sessionHistory.length}</span>
        ) : null}
        <button
          type="button"
          onClick={copyToClipboard}
          className="ml-auto px-2 py-1 rounded border border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40"
        >
          Copy JSON
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="px-2 py-1 rounded border border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40"
        >
          Hide
        </button>
      </div>
    </div>
  )
}
