'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/hooks/useAdmin'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

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
}

export default function AuthDebugPage() {
  const { isAdmin, isLoading: adminLoading } = useAdmin()
  const [data, setData] = useState<AuthGoogleDebugPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDebug = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/auth-google-debug')
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load auth debug info')
      }
      setData(payload)
    } catch (err: any) {
      setError(err?.message || 'Failed to load auth debug info')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!adminLoading && isAdmin) {
      fetchDebug()
    }
  }, [adminLoading, isAdmin])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Auth Debug Panel</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Latest Google auth debug markers from production.
          </p>
        </div>
        <Button onClick={fetchDebug} disabled={loading} className="gap-2">
          <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
          Refresh
        </Button>
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Last Error</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : data?.lastError ? (
          <pre className="text-xs bg-gray-100 dark:bg-dark-800 p-3 rounded overflow-auto">
{JSON.stringify(data.lastError, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-gray-500">No recent error recorded.</p>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Last Success</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : data?.lastSuccess ? (
          <pre className="text-xs bg-gray-100 dark:bg-dark-800 p-3 rounded overflow-auto">
{JSON.stringify(data.lastSuccess, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-gray-500">No success recorded yet.</p>
        )}
      </Card>
    </div>
  )
}
