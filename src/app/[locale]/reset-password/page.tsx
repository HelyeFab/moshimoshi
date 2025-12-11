'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { getUserFriendlyErrorMessage } from '@/utils/errorMessages'
import MoshimoshiLogo from '@/components/ui/MoshimoshiLogo'

function ResetPasswordConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [error, setError] = useState('')
  const [tokenError, setTokenError] = useState('')
  const [email, setEmail] = useState('')
  const [success, setSuccess] = useState(false)

  const token = searchParams?.get('token')

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setTokenError('No reset token provided. Please request a new password reset link.')
        setValidating(false)
        return
      }

      try {
        const response = await fetch(`/api/auth/password/reset-request?token=${token}`)
        const data = await response.json()

        if (response.ok && data.success) {
          setEmail(data.data.email)
        } else {
          const errorMessage = data.error?.message || 'Invalid or expired reset link'
          setTokenError(errorMessage)
        }
      } catch (err) {
        setTokenError('Failed to validate reset link. Please try again.')
      } finally {
        setValidating(false)
      }
    }

    validateToken()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password strength
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    const hasLower = /[a-z]/.test(password)
    const hasUpper = /[A-Z]/.test(password)
    const hasNumber = /\d/.test(password)
    const hasSpecial = /[@$!%*?&]/.test(password)

    if (!hasLower || !hasUpper || !hasNumber || !hasSpecial) {
      setError('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (@$!%*?&)')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/password/reset-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        showToast('Password reset successfully!', 'success')

        // Redirect to dashboard after short delay
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      } else {
        const errorMessage = data.error?.message || 'Failed to reset password'
        setError(getUserFriendlyErrorMessage(errorMessage))
      }
    } catch (err) {
      setError(getUserFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  // Show loading state while validating token
  if (validating) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background-light to-japanese-mizu/20 dark:from-dark-850 dark:to-dark-900 overflow-y-auto">
        <div className="min-h-screen flex items-center justify-center px-4 pb-24 sm:pb-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Validating reset link...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show error if token is invalid
  if (tokenError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background-light to-japanese-mizu/20 dark:from-dark-850 dark:to-dark-900 overflow-y-auto">
        <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:py-12 pb-24 sm:pb-12">
          <div className="max-w-md w-full">
            <Link href="/" className="flex items-center justify-center mb-8">
              <MoshimoshiLogo
                size="medium"
                variant="stacked"
                showRomaji={true}
                className="text-gray-900 dark:text-gray-100"
              />
            </Link>

            <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl p-8 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Invalid Reset Link
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {tokenError}
              </p>
              <Link
                href="/auth/reset-password"
                className="inline-block px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all font-medium"
              >
                Request New Reset Link
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background-light to-japanese-mizu/20 dark:from-dark-850 dark:to-dark-900 overflow-y-auto">
        <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:py-12 pb-24 sm:pb-12">
          <div className="max-w-md w-full">
            <Link href="/" className="flex items-center justify-center mb-8">
              <MoshimoshiLogo
                size="medium"
                variant="stacked"
                showRomaji={true}
                className="text-gray-900 dark:text-gray-100"
              />
            </Link>

            <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl p-8 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Password Reset!
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Your password has been reset successfully.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Redirecting you to the dashboard...
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show password reset form
  return (
    <div className="min-h-screen bg-gradient-to-b from-background-light to-japanese-mizu/20 dark:from-dark-850 dark:to-dark-900 overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:py-12 pb-24 sm:pb-12">
        <div className="max-w-md w-full">
          <Link href="/" className="flex items-center justify-center mb-8">
            <MoshimoshiLogo
              size="medium"
              variant="stacked"
              showRomaji={true}
              className="text-gray-900 dark:text-gray-100"
            />
          </Link>

          <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl p-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Create New Password
            </h1>
            {email && (
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Enter a new password for <strong>{email}</strong>
              </p>
            )}

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
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter new password"
                  required
                  minLength={8}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Must be at least 8 characters with uppercase, lowercase, number, and special character
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Confirm new password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ResetPasswordConfirmContent />
    </Suspense>
  )
}
