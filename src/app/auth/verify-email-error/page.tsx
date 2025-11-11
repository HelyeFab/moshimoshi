'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, Mail, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const errorMessages: Record<string, { title: string; message: string; canResend: boolean }> = {
  MISSING_TOKEN: {
    title: 'Missing Verification Token',
    message: 'The verification link is incomplete. Please check your email for the correct link.',
    canResend: true,
  },
  INVALID_TOKEN: {
    title: 'Invalid Verification Link',
    message: 'This verification link is invalid or has been tampered with.',
    canResend: true,
  },
  TOKEN_EXPIRED: {
    title: 'Verification Link Expired',
    message: 'This verification link has expired. Verification links are valid for 24 hours.',
    canResend: true,
  },
  USER_NOT_FOUND: {
    title: 'Account Not Found',
    message: 'The account associated with this verification link could not be found.',
    canResend: false,
  },
  VERIFICATION_FAILED: {
    title: 'Verification Failed',
    message: 'We encountered an error while verifying your email. Please try again.',
    canResend: true,
  },
  INTERNAL_ERROR: {
    title: 'Server Error',
    message: 'We encountered an internal error. Please try again later.',
    canResend: true,
  },
}

function VerifyEmailErrorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorCode = searchParams.get('code') || 'VERIFICATION_FAILED'
  const error = errorMessages[errorCode] || errorMessages.VERIFICATION_FAILED

  const [isSending, setIsSending] = useState(false)
  const [resendMessage, setResendMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleResendEmail = async () => {
    setIsSending(true)
    setResendMessage(null)

    try {
      const response = await fetch('/api/auth/email/send-verification', {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok) {
        setResendMessage({
          type: 'success',
          text: data.alreadyVerified
            ? 'Your email is already verified! Redirecting...'
            : 'Verification email sent! Please check your inbox.',
        })

        if (data.alreadyVerified) {
          setTimeout(() => router.push('/dashboard'), 2000)
        }
      } else {
        setResendMessage({
          type: 'error',
          text: data.error?.message || 'Failed to send verification email. Please try again.',
        })
      }
    } catch (error) {
      setResendMessage({
        type: 'error',
        text: 'Network error. Please check your connection and try again.',
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
          <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          {error.title}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          {error.message}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error.canResend && (
            <>
              <div className="space-y-4">
                <button
                  onClick={handleResendEmail}
                  disabled={isSending}
                  className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Mail className="h-5 w-5" />
                  {isSending ? 'Sending...' : 'Resend Verification Email'}
                </button>

                {resendMessage && (
                  <div
                    className={`p-4 rounded-md ${
                      resendMessage.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                    }`}
                  >
                    <p className="text-sm font-medium">{resendMessage.text}</p>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      Or
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className={error.canResend ? 'mt-6' : ''}>
            <Link
              href="/dashboard"
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Dashboard
            </Link>
          </div>

          <div className="mt-6">
            <p className="text-center text-xs text-gray-500 dark:text-gray-400">
              Need help?{' '}
              <a
                href="mailto:support@moshimoshi.app"
                className="font-medium text-pink-600 hover:text-pink-500 dark:text-pink-400 dark:hover:text-pink-300"
              >
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <VerifyEmailErrorContent />
    </Suspense>
  )
}
