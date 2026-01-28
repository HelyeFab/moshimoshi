'use client'

import { useEffect } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to console for debugging
    console.error('[Admin Error Boundary]', error)

    // TODO: Send error to monitoring service (Sentry, LogRocket, etc.)
    // if (typeof window !== 'undefined' && window.Sentry) {
    //   window.Sentry.captureException(error)
    // }
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Error Card */}
        <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-red-200 dark:border-red-800 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 text-3xl">⚠️</div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Something went wrong
                </h2>
                <p className="text-red-100 text-sm mt-1">
                  Admin panel encountered an error
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Error Message */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
                Error Details:
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 font-mono break-words">
                {error.message || 'Unknown error occurred'}
              </p>
              {error.digest && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  Error ID: {error.digest}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={reset}
                className="w-full px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Try Again
              </button>

              <button
                onClick={() => (window.location.href = '/admin')}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Back to Dashboard
              </button>
            </div>

            {/* Help Text */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Need help?</strong> If this error persists:
              </p>
              <ul className="text-xs text-blue-700 dark:text-blue-300 mt-2 space-y-1 list-disc list-inside">
                <li>Check your browser console for details</li>
                <li>Try refreshing the page</li>
                <li>Clear your browser cache</li>
                <li>Contact support if the issue continues</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Development Info (only shown in dev mode) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 bg-gray-800 rounded-lg p-4 overflow-auto max-h-64">
            <p className="text-xs text-gray-400 mb-2 font-mono">
              Stack Trace (Development Only):
            </p>
            <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
              {error.stack}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
