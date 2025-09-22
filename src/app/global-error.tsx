'use client'

import { useEffect, useState } from 'react'
import DoshiMascot from '@/components/ui/DoshiMascot'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    console.error('Global error:', error)
  }, [error])

  if (!mounted) return null

  return (
    <html>
      <body>
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center px-4">
          <div className="max-w-lg w-full">
            <div className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl p-8 text-center">
              {/* Critical Error Icon */}
              <div className="relative inline-block mb-6">
                <DoshiMascot 
                  size="large" 
                  variant="static"
                />
                <div className="absolute -top-2 -right-2 text-4xl">
                  🚨
                </div>
              </div>

              {/* Error Message */}
              <h1 className="text-6xl font-black text-red-500 mb-4">
                500
              </h1>
              
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Critical Error
              </h2>
              
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Something went seriously wrong. Doshi is very concerned!
              </p>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={reset}
                  className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  Try to recover
                </button>
                
                <button
                  onClick={() => window.location.href = '/'}
                  className="w-full px-6 py-3 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-dark-600 transition-all duration-200"
                >
                  Return to homepage
                </button>
              </div>

              {/* Error Details */}
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-6 text-left">
                  <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                    Error details
                  </summary>
                  <pre className="mt-2 text-xs text-red-600 overflow-auto p-2 bg-gray-100 dark:bg-dark-900 rounded">
                    {error.message}
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}