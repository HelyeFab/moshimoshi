'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import DoshiMascot from '@/components/ui/DoshiMascot'
import MoshimoshiLogo from '@/components/ui/MoshimoshiLogo'
import ThemeToggle from '@/components/ui/ThemeToggle'

export default function Custom500() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-red-50 to-orange-50 dark:from-dark-900 dark:via-red-950/20 dark:to-orange-950/20 transition-colors duration-500 flex flex-col">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-5 dark:opacity-10 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23dc2626' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
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
            {/* 500 Number with Doshi */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-4 mb-6">
                <span className="text-7xl md:text-8xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                  5
                </span>
                <div className="relative">
                  <DoshiMascot 
                    size="large" 
                    
                    variant="animated"
                  />
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="flex gap-1">
                      <span className="text-2xl animate-pulse" style={{ animationDelay: '0ms' }}>💤</span>
                      <span className="text-xl animate-pulse" style={{ animationDelay: '200ms' }}>💤</span>
                      <span className="text-lg animate-pulse" style={{ animationDelay: '400ms' }}>💤</span>
                    </div>
                  </div>
                </div>
                <span className="text-7xl md:text-8xl font-black bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                  0
                </span>
              </div>

              {/* Japanese Text */}
              <div className="mb-4">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  サーバーエラー
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  (Server Error)
                </p>
              </div>

              {/* Message */}
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 mb-8 border border-red-200 dark:border-red-800">
                <p className="text-gray-700 dark:text-gray-300">
                  Our servers are taking a little nap. Even Doshi needs rest sometimes!
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Don't worry, we're working on waking them up. 
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => window.location.reload()}
                  className="group inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  <span>Refresh page</span>
                  <span className="text-xl">🔄</span>
                </button>
                
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-dark-600 hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  <span>← Back to safety</span>
                  <DoshiMascot size="xsmall" />
                </Link>
              </div>

              {/* Server Status */}
              <div className="mt-12 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-300 dark:border-yellow-700">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚡</span>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Server Status
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Our team has been notified and is investigating the issue.
                    </p>
                  </div>
                </div>
              </div>

              {/* Fun Fact */}
              <div className="mt-6 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-bold">Did you know?</span> In Japanese, "500" can be read as "go-hyaku" (五百).
                  It literally means "five hundred"! 
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}