'use client'

import { useState, useEffect } from 'react'
import { useSubscription } from '@/hooks/useSubscription'
import { AlertCircle, HardDrive } from 'lucide-react'

export function AnkiMediaQuotaBadge() {
  const [quota, setQuota] = useState<any>(null)
  const { isPremium } = useSubscription()

  useEffect(() => {
    if (!isPremium) return

    const fetchQuota = async () => {
      try {
        const response = await fetch('/api/anki/media/quota', {
          credentials: 'include'
        })

        if (response.ok) {
          const data = await response.json()
          setQuota(data)
        }
      } catch (error) {
        console.error('[AnkiMediaQuotaBadge] Failed to fetch quota:', error)
      }
    }

    fetchQuota() // Initial fetch
    const interval = setInterval(fetchQuota, 60000) // Refresh every minute

    return () => clearInterval(interval)
  }, [isPremium])

  if (!quota || !isPremium) return null

  const percentage = quota.percentage || 0
  const isWarning = percentage >= 90

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-dark-800 dark:to-dark-700 rounded-lg border border-gray-200 dark:border-dark-600">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Media Storage
          </h3>
        </div>
        <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
          {quota.formatted.current} / {quota.formatted.limit}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2.5 bg-gray-200 dark:bg-dark-600 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full transition-all duration-300 ${
            isWarning
              ? 'bg-gradient-to-r from-orange-500 to-red-500'
              : 'bg-gradient-to-r from-blue-500 to-cyan-500'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Warning message */}
      {isWarning && (
        <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
          <AlertCircle className="w-4 h-4" />
          <span>
            Storage {percentage >= 100 ? 'limit reached' : `at ${Math.round(percentage)}%`}.
            Consider deleting unused decks.
          </span>
        </div>
      )}

      {!isWarning && (
        <p className="text-xs text-gray-500 dark:text-gray-500">
          {quota.formatted.available} available
        </p>
      )}
    </div>
  )
}
