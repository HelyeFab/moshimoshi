'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface AuthGoogleDebugPayload {
  lastError: {
    stage: string
    timestamp: string
    message?: string
    code?: string | null
    uid?: string
    email?: string
    isNewUser?: boolean
  } | null
  lastSuccess: {
    stage: string
    timestamp: string
    uid?: string
    email?: string
    isNewUser?: boolean
  } | null
  env?: {
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY?: string
    RECAPTCHA_SECRET_KEY?: string
  }
  error?: string
}

export default function AuthGoogleDebugPublicPage() {
  const searchParams = useSearchParams()
  const token = searchParams?.get('token') || ''
  const [data, setData] = useState<AuthGoogleDebugPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDebug = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/debug/auth-google?token=${encodeURIComponent(token)}`)
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load debug info')
      }
      setData(payload)
    } catch (err: any) {
      setError(err?.message || 'Failed to load debug info')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      fetchDebug()
    } else {
      setLoading(false)
      setError('Missing token')
    }
  }, [token])

  const lastErrorJson = useMemo(() => JSON.stringify(data?.lastError, null, 2), [data?.lastError])
  const lastSuccessJson = useMemo(() => JSON.stringify(data?.lastSuccess, null, 2), [data?.lastSuccess])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Auth Debug (Public)</h1>
          <p className="text-sm text-slate-400">
            Requires `token` query param matching DEBUG_ADMIN_TOKEN.
          </p>
        </header>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchDebug}
            disabled={loading || !token}
            className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          {error ? <span className="text-sm text-red-400">{error}</span> : null}
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Last Error</h2>
          <pre className="bg-slate-900 border border-slate-800 rounded p-4 text-xs overflow-auto min-h-[120px]">
{lastErrorJson || 'null'}
          </pre>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">reCAPTCHA Env</h2>
          <pre className="bg-slate-900 border border-slate-800 rounded p-4 text-xs overflow-auto min-h-[80px]">
{JSON.stringify(data?.env ?? null, null, 2)}
          </pre>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Last Success</h2>
          <pre className="bg-slate-900 border border-slate-800 rounded p-4 text-xs overflow-auto min-h-[120px]">
{lastSuccessJson || 'null'}
          </pre>
        </section>
      </div>
    </div>
  )
}
