'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import DoshiMascot from '@/components/ui/DoshiMascot'
import MoshimoshiLogo from '@/components/ui/MoshimoshiLogo'
import ThemeToggle from '@/components/ui/ThemeToggle'

export default function NotFound() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const messages = [
    "Looks like you wandered off the path!",
    "This page went on a journey without us!",
    "Even Doshi can&apos;t find this page!",
    "Oops! This path leads nowhere!",
    "This page is playing hide and seek!"
  ]

  const randomMessage = messages[Math.floor(Math.random() * messages.length)]

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800 transition-colors duration-500 flex flex-col">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-5 dark:opacity-10 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ef4444' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
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
            {/* 404 Number with Doshi */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-4 mb-6">
                <span className="text-8xl md:text-9xl font-black bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                  4
                </span>
                <div className="relative">
                  <DoshiMascot 
                    size="large" 
                    
                    variant="animated"
                    className="animate-bounce"
                  />
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 text-4xl animate-pulse">
                    ❓
                  </div>
                </div>
                <span className="text-8xl md:text-9xl font-black bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
                  4
                </span>
              </div>

              {/* Japanese Text */}
              <div className="mb-4">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  ページが見つかりません
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  (Page Not Found)
                </p>
              </div>

              {/* Message */}
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-8">
                {randomMessage}
              </p>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/"
                  className="group inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  <span>← Take me home</span>
                  <DoshiMascot size="xsmall" />
                </Link>
                
                <button
                  onClick={() => window.history.back()}
                  className="px-6 py-3 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-dark-600 hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  Go back
                </button>
              </div>

              {/* Fun Fact */}
              <div className="mt-12 p-4 bg-japanese-mizu/20 dark:bg-japanese-mizuDark/20 rounded-xl">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-bold">Fun fact:</span> In Japanese, "404" can be read as "yo-rei-shi" (よれいし), 
                  which sounds like "ghost" (幽霊, yūrei). Spooky, right? 👻
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}