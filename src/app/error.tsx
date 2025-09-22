'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import DoshiMascot from '@/components/ui/DoshiMascot'
import MoshimoshiLogo from '@/components/ui/MoshimoshiLogo'
import ThemeToggle from '@/components/ui/ThemeToggle'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [errorCode] = useState(() => {
    // Try to determine if this is a 500 error or something else
    return error.message?.includes('500') ? '500' : '⚠️'
  })

  useEffect(() => {
    setMounted(true)
    // Log the error to an error reporting service
    console.error('Error:', error)
  }, [error])

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-japanese-zen/10 to-japanese-zenDark/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800 transition-colors duration-500 flex flex-col">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-5 dark:opacity-10 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f4a261' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-dark-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="group">
              <MoshimoshiLogo size="small" animated={true} className="group-hover:scale-105 transition-transform" />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-2xl w-full">
          <div className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-12">
            {/* Error Display */}
            <div className="text-center mb-8">
              {/* Animated Doshi with Error */}
              <div className="relative inline-block mb-6">
                <DoshiMascot 
                  size="xlarge" 
                  
                  variant="animated"
                  className="animate-pulse"
                />
                <div className="absolute -top-4 -right-4 text-5xl animate-bounce">
                  💭
                </div>
              </div>

              {/* Error Code */}
              <div className="text-7xl md:text-8xl font-black bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent mb-4">
                {errorCode}
              </div>

              {/* Japanese Text */}
              <div className="mb-4">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  エラーが発生しました
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  (An error occurred)
                </p>
              </div>

              {/* Error Message */}
              <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                <p className="text-gray-700 dark:text-gray-300">
                  Something went wrong while loading this page. Doshi is trying to figure out what happened!
                </p>
                {process.env.NODE_ENV === 'development' && error.message && (
                  <details className="mt-4 text-left">
                    <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                      Technical details
                    </summary>
                    <pre className="mt-2 text-xs text-red-600 dark:text-red-400 overflow-auto p-2 bg-white dark:bg-dark-900 rounded">
                      {error.message}
                      {error.digest && `\nDigest: ${error.digest}`}
                    </pre>
                  </details>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={reset}
                  className="group inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  <span>Try again</span>
                  <span className="text-xl">🔄</span>
                </button>
                
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-dark-600 hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  <span>← Go home</span>
                  <DoshiMascot size="xsmall" />
                </Link>
              </div>

              {/* Support Message */}
              <div className="mt-12 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <DoshiMascot size="xsmall" />
                  <div className="text-left">
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-medium mb-1">
                      Need help?
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      If this error persists, please try clearing your browser cache or contact support.
                      Error code: {error.digest || 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}