'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'

const errorMessages: Record<string, { title: string; message: string }> = {
  INVALID_LINK: {
    title: 'Invalid Magic Link',
    message: 'This magic link is invalid or has been tampered with. Please request a new one.',
  },
  LINK_EXPIRED: {
    title: 'Link Expired',
    message: 'This magic link has expired. Magic links are valid for 1 hour. Please request a new one.',
  },
  ALREADY_USED: {
    title: 'Link Already Used',
    message: 'This magic link has already been used. Each link can only be used once.',
  },
  USER_NOT_FOUND: {
    title: 'User Not Found',
    message: 'We could not find an account associated with this email. Please sign up first.',
  },
  FIREBASE_ERROR: {
    title: 'Authentication Error',
    message: 'There was an error verifying your magic link. Please try again or contact support.',
  },
  NETWORK_ERROR: {
    title: 'Connection Error',
    message: 'Could not connect to our servers. Please check your internet connection and try again.',
  },
  DEFAULT: {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
  },
}

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const errorCode = searchParams?.get('code') || 'DEFAULT'
  const error = errorMessages[errorCode] || errorMessages.DEFAULT

  return (
    <div className="min-h-screen bg-gradient-to-b from-background-light to-japanese-mizu/20 dark:from-dark-850 dark:to-dark-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="text-center mb-6">
            <Link href="/" className="inline-flex items-center justify-center gap-2">
              <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                も
              </div>
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Moshimoshi
              </span>
            </Link>
          </div>

          {/* Error Icon */}
          <div className="w-20 h-20 mx-auto mb-6 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          {/* Error Message */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              {error.title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {error.message}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => router.push('/auth/signup')}
              className="w-full py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
            >
              Try Again
            </button>

            <button
              onClick={() => router.push('/')}
              className="w-full py-3 bg-gray-100 dark:bg-dark-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-dark-700 transition-colors"
            >
              Back to Home
            </button>
          </div>

          {/* Support Link */}
          <p className="text-center mt-6 text-sm text-gray-500 dark:text-gray-400">
            Need help?{' '}
            <a
              href="mailto:support@moshimoshi.app"
              className="text-primary-500 hover:text-primary-600 font-medium"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-background-light to-japanese-mizu/20 dark:from-dark-850 dark:to-dark-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}