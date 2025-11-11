'use client'

import { useState } from 'react'
import { X, Mail, CheckCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export function EmailVerificationBanner() {
  const { user } = useAuth()
  const [isDismissed, setIsDismissed] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Don't show if user is verified or banner is dismissed
  if (!user || user.emailVerified || isDismissed) {
    return null
  }

  const handleResendEmail = async () => {
    setIsSending(true)
    setMessage(null)

    try {
      const response = await fetch('/api/auth/email/send-verification', {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({
          type: 'success',
          text: data.alreadyVerified
            ? 'Your email is already verified!'
            : 'Verification email sent! Please check your inbox.',
        })
      } else {
        setMessage({
          type: 'error',
          text: data.error?.message || 'Failed to send verification email. Please try again.',
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Network error. Please check your connection and try again.',
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div
      role="alert"
      className="bg-yellow-50/95 dark:bg-yellow-950/95 border-b-2 border-yellow-300 dark:border-yellow-700 backdrop-blur-md shadow-lg shadow-yellow-500/20"
    >
      <div className="max-w-7xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex-1 flex items-start gap-2 sm:gap-3 min-w-0">
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5 sm:mt-0">
              <div className="flex p-1.5 sm:p-2 rounded-lg bg-yellow-100/80 dark:bg-yellow-900/40 backdrop-blur-sm">
                <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-yellow-900 dark:text-yellow-100">
                Please verify your email address
              </p>

              {message ? (
                <div className={`flex items-start sm:items-center gap-1.5 mt-1 sm:mt-1.5 ${
                  message.type === 'success'
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  {message.type === 'success' ? (
                    <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 mt-0.5 sm:mt-0" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 mt-0.5 sm:mt-0" />
                  )}
                  <p className="text-xs sm:text-sm font-medium break-words">{message.text}</p>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-yellow-900/90 dark:text-yellow-100/90 mt-1 break-words">
                  Check your inbox at <strong className="font-semibold break-all">{user.email}</strong> for the verification link
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 w-full sm:w-auto">
            <button
              onClick={handleResendEmail}
              disabled={isSending}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg
                bg-primary-500 hover:bg-primary-600 dark:bg-primary-600 dark:hover:bg-primary-700
                text-white
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200
                shadow-sm hover:shadow-md"
            >
              {isSending ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="hidden min-[400px]:inline">Sending...</span>
                  <span className="min-[400px]:hidden">...</span>
                </>
              ) : (
                <>
                  <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden min-[400px]:inline">Resend Email</span>
                  <span className="min-[400px]:hidden">Resend</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsDismissed(true)}
              className="p-2 rounded-lg text-yellow-700 dark:text-yellow-300
                hover:bg-yellow-200/50 dark:hover:bg-yellow-900/50
                focus:outline-none focus:ring-2 focus:ring-yellow-500
                transition-colors duration-200"
              aria-label="Dismiss verification reminder"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
