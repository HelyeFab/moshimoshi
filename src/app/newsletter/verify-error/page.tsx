'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { XCircle, AlertTriangle, Mail, Home } from 'lucide-react'

const ERROR_MESSAGES: Record<string, { title: string; description: string; action?: string }> = {
  MISSING_TOKEN: {
    title: 'Invalid verification link',
    description: 'The verification link is missing required information. Please use the link from your email.',
  },
  INVALID_TOKEN: {
    title: 'Invalid verification link',
    description: 'This verification link is invalid or has been tampered with. Please request a new verification email.',
    action: 'Request new link',
  },
  TOKEN_EXPIRED: {
    title: 'Verification link expired',
    description: 'This verification link has expired or has already been used. Newsletter verification links are valid for 24 hours.',
    action: 'Subscribe again',
  },
  SUBSCRIBER_NOT_FOUND: {
    title: 'Subscription not found',
    description: 'We couldn\'t find your newsletter subscription. Please try subscribing again.',
    action: 'Subscribe to newsletter',
  },
  VERIFICATION_FAILED: {
    title: 'Verification failed',
    description: 'An error occurred while verifying your subscription. Please try again or contact support if the problem persists.',
  },
  INTERNAL_ERROR: {
    title: 'Something went wrong',
    description: 'An unexpected error occurred. Please try again later or contact support if the problem persists.',
  },
}

function ErrorContent() {
  const searchParams = useSearchParams()
  const errorCode = searchParams.get('code') || 'INTERNAL_ERROR'
  const error = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.INTERNAL_ERROR

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Error Icon */}
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
          <XCircle className="h-16 w-16 text-red-600 dark:text-red-400" />
        </div>

        {/* Title */}
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          {error.title}
        </h2>

        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Newsletter subscription verification failed
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-lg py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-200 dark:border-gray-700">

          {/* Error Message */}
          <div className="space-y-6">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900 dark:text-red-100">
                  What happened?
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {error.description}
                </p>
              </div>
            </div>

            {/* Error code */}
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Error code: <code className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{errorCode}</code>
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              {/* Primary action based on error */}
              {error.action && (
                <Link
                  href="/blog"
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white
                    bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700
                    dark:from-primary-600 dark:to-primary-700 dark:hover:from-primary-700 dark:hover:to-primary-800
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
                    transition-all duration-200 hover:shadow-lg"
                >
                  <Mail className="h-4 w-4" />
                  <span>{error.action}</span>
                </Link>
              )}

              {/* Return home */}
              <Link
                href="/"
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200
                  bg-white dark:bg-dark-700 hover:bg-gray-50 dark:hover:bg-dark-600
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
                  transition-colors"
              >
                <Home className="h-4 w-4" />
                <span>Return to home</span>
              </Link>
            </div>

            {/* Help text */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-center text-gray-600 dark:text-gray-400">
                Need help?{' '}
                <a
                  href="mailto:support@moshimoshi.app"
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Contact support
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NewsletterVerifyErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
        </div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}
