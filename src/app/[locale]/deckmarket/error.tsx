'use client'

import { useEffect } from 'react'

export default function DeckMarketError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[DeckMarket Error Boundary]', error)
  }, [error])

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-red-200 dark:border-red-800 overflow-hidden">
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl">⚠️</div>
            <div>
              <h2 className="text-xl font-bold text-white">Something went wrong</h2>
              <p className="text-red-100 text-sm mt-1">Failed to load the deck catalogue.</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {error.message && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-300 font-mono break-words">
                {error.message}
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
            >
              Try again
            </button>
            <button
              onClick={() => (window.location.href = '/deckmarket')}
              className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
            >
              Back to catalogue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
