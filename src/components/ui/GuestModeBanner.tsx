'use client'

import Link from 'next/link'
import { useState } from 'react'

interface GuestModeBannerProps {
  className?: string
}

export default function GuestModeBanner({ className = '' }: GuestModeBannerProps) {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  return (
    <div className={`bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <span className="text-2xl">👋</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              You're exploring as a guest
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Your progress won't be saved. Sign up to unlock all features and keep your achievements!
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/auth/signup"
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Sign Up Free
          </Link>
          <button
            onClick={() => setIsVisible(false)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}