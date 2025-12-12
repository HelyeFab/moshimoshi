'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { getUserFriendlyErrorMessage } from '@/utils/errorMessages'
import { useLocalePath } from '@/i18n/I18nContext'
import MoshimoshiLogo from '@/components/ui/MoshimoshiLogo'

export default function ResetPasswordPage() {
  const { showToast } = useToast()
  const { getLocalePath } = useLocalePath()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/password/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (response.ok) {
        setSubmitted(true)
        showToast('Check your email for the reset link!', 'success')
      } else {
        const errorMessage = data.error?.message || 'Failed to send reset email'
        setError(getUserFriendlyErrorMessage(errorMessage))
      }
    } catch (err) {
      setError(getUserFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background-light to-japanese-mizu/20 dark:from-dark-850 dark:to-dark-900 overflow-y-auto">
        <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:py-12 pb-24 sm:pb-12">
          <div className="max-w-md w-full">
            {/* Logo */}
            <Link href="/" className="flex items-center justify-center mb-8">
              <MoshimoshiLogo
                size="medium"
                variant="stacked"
                showRomaji={true}
                className="text-gray-900 dark:text-gray-100"
              />
            </Link>

            {/* Success Card */}
            <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl p-8 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Check Your Email
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                If an account exists for <strong>{email}</strong>, we've sent a password reset link.
                The link will expire in 1 hour.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
                Don't see the email? Check your spam folder.
              </p>
              <Link
                href={getLocalePath('/auth/signin')}
                className="inline-block px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all font-medium"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background-light to-japanese-mizu/20 dark:from-dark-850 dark:to-dark-900 overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:py-12 pb-24 sm:pb-12">
        <div className="max-w-md w-full">
          {/* Logo */}
          <Link href="/" className="flex items-center justify-center mb-8">
            <MoshimoshiLogo
              size="medium"
              variant="stacked"
              showRomaji={true}
              className="text-gray-900 dark:text-gray-100"
            />
          </Link>

          {/* Reset Password Card */}
          <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl p-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Reset Your Password
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 rounded-lg mb-4 flex items-start gap-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
              Remember your password?{' '}
              <Link href={getLocalePath('/auth/signin')} className="text-primary-600 dark:text-primary-400 hover:underline font-medium">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
