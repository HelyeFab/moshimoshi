'use client'

import { useEffect, useMemo, useState } from 'react'
import { auth } from '@/lib/firebase/client'

type SessionResponse = {
  authenticated?: boolean
  user?: any
  error?: any
  expiresIn?: number
}

export function AuthDebugPanel({ visible }: { visible: boolean }) {
  const [sessionData, setSessionData] = useState<SessionResponse | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [runtimeInfo, setRuntimeInfo] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!visible || typeof window === 'undefined') return

    const url = new URL(window.location.href)
    const info = {
      href: url.href,
      pathname: url.pathname,
      search: url.search,
      searchParams: {
        state: url.searchParams.get('state'),
        code: url.searchParams.get('code'),
        __firebase_request_key: url.searchParams.get('__firebase_request_key'),
      },
      userAgent: navigator.userAgent,
      cookieEnabled: navigator.cookieEnabled,
      authDomain: auth?.app?.options?.authDomain || 'unknown',
      currentUser: auth?.currentUser
        ? { uid: auth.currentUser.uid, email: auth.currentUser.email }
        : null,
      sessionStorage: {
        authFlow: sessionStorage.getItem('auth-flow-in-progress'),
        appleRedirect: sessionStorage.getItem('apple-redirect-pending'),
      },
      localStorage: {
        emailForSignIn: localStorage.getItem('emailForSignIn'),
      },
      timestamp: new Date().toISOString(),
    }
    setRuntimeInfo(info)
  }, [visible])

  const prettyInfo = useMemo(() => JSON.stringify(runtimeInfo, null, 2), [runtimeInfo])
  const prettySession = useMemo(
    () => (sessionData ? JSON.stringify(sessionData, null, 2) : ''),
    [sessionData]
  )

  const refreshSession = async () => {
    setLoading(true)
    setSessionError(null)
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' })
      const data = await res.json()
      setSessionData(data)
      if (!res.ok) {
        setSessionError(`Session check failed: ${res.status}`)
      }
    } catch (err: any) {
      setSessionError(err?.message || 'Session check failed')
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-[360px] max-h-[70vh] overflow-auto rounded-xl border border-gray-200 bg-white/95 p-4 text-xs text-gray-900 shadow-xl backdrop-blur dark:border-dark-700 dark:bg-dark-900/95 dark:text-gray-100">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-semibold">Auth Debug Panel</div>
        <button
          type="button"
          onClick={refreshSession}
          disabled={loading}
          className="rounded bg-primary-600 px-2 py-1 text-white disabled:opacity-60"
        >
          {loading ? 'Checking…' : 'Check Session'}
        </button>
      </div>

      <div className="mb-2">
        <div className="mb-1 font-semibold">Runtime</div>
        <pre className="whitespace-pre-wrap break-words">{prettyInfo}</pre>
      </div>

      {sessionError && (
        <div className="mb-2 rounded border border-red-300 bg-red-50 p-2 text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
          {sessionError}
        </div>
      )}

      {sessionData && (
        <div>
          <div className="mb-1 font-semibold">/api/auth/session</div>
          <pre className="whitespace-pre-wrap break-words">{prettySession}</pre>
        </div>
      )}
    </div>
  )
}
