'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import DoshiMascot from '@/components/ui/DoshiMascot'
import MoshimoshiLogo from '@/components/ui/MoshimoshiLogo'
import ThemeToggle from '@/components/ui/ThemeToggle'

export default function Custom403() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-purple-50 to-indigo-50 dark:from-dark-900 dark:via-purple-950/20 dark:to-indigo-950/20 transition-colors duration-500 flex flex-col">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-5 dark:opacity-10 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%238b5cf6' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
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
            {/* 403 Display */}
            <div className="text-center mb-8">
              {/* Doshi Guard */}
              <div className="relative inline-block mb-6">
                <DoshiMascot 
                  size="xlarge" 
                  
                  variant="animated"
                />
                <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                    STOP
                  </div>
                </div>
              </div>

              {/* 403 Number */}
              <div className="text-7xl md:text-8xl font-black bg-gradient-to-r from-purple-500 to-indigo-500 bg-clip-text text-transparent mb-4">
                403
              </div>

              {/* Japanese Text */}
              <div className="mb-4">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  アクセス禁止
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  (Access Forbidden)
                </p>
              </div>

              {/* Message */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 mb-8 border border-purple-200 dark:border-purple-800">
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  Doshi is guarding this area! You need special permission to enter.
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This content requires authentication or higher privileges.
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/auth/signin"
                  className="group inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  <span>Sign in</span>
                  <span className="text-xl">🔐</span>
                </Link>
                
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-dark-600 hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  <span>← Go home</span>
                  <DoshiMascot size="xsmall" />
                </Link>
              </div>

              {/* Help Section */}
              <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">👤</span>
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Not signed in?
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Sign in to access your personalized content
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⭐</span>
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Need premium?
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Upgrade for full access to all features
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Japanese Lesson */}
              <div className="mt-6 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-bold">Japanese tip:</span> "禁止" (kinshi) means "forbidden" or "prohibited".
                  You'll see this on many signs in Japan! 🚫
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}