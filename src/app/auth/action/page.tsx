'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  applyActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
  checkActionCode
} from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useTranslation } from '@/i18n/I18nContext'
import { LoadingOverlay } from '@/components/ui/Loading'
import DoshiMascot from '@/components/ui/DoshiMascot'
import PageContainer from '@/components/ui/PageContainer'

function AuthActionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const { strings } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mode, setMode] = useState<string | null>(null)

  useEffect(() => {
    const handleAction = async () => {
      const actionMode = searchParams.get('mode')
      const actionCode = searchParams.get('oobCode')
      const continueUrl = searchParams.get('continueUrl')

      if (!actionMode || !actionCode) {
        setError('Invalid action link')
        setLoading(false)
        return
      }

      setMode(actionMode)

      try {
        switch (actionMode) {
          case 'resetPassword':
            // Verify the password reset code
            const email = await verifyPasswordResetCode(auth, actionCode)
            setEmail(email)
            setLoading(false)
            break

          case 'verifyEmail':
            // Apply the email verification code
            await applyActionCode(auth, actionCode)
            setSuccess(true)
            showToast('Email verified successfully!', 'success')

            // Redirect to dashboard or continue URL after 2 seconds
            setTimeout(() => {
              router.push(continueUrl || '/dashboard')
            }, 2000)
            break

          case 'recoverEmail':
            // Check the action code
            const info = await checkActionCode(auth, actionCode)
            // Apply the code to recover the email
            await applyActionCode(auth, actionCode)
            setEmail(info.data.email || null)
            setSuccess(true)
            showToast('Email recovered successfully!', 'success')

            setTimeout(() => {
              router.push(continueUrl || '/dashboard')
            }, 2000)
            break

          default:
            setError(`Unsupported action: ${actionMode}`)
        }
      } catch (error: any) {
        console.error('Action error:', error)
        setError(error.message || 'An error occurred processing your request')
      } finally {
        if (actionMode !== 'resetPassword') {
          setLoading(false)
        }
      }
    }

    handleAction()
  }, [searchParams, router, showToast])

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error')
      return
    }

    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error')
      return
    }

    setLoading(true)
    const actionCode = searchParams.get('oobCode')

    try {
      if (actionCode) {
        await confirmPasswordReset(auth, actionCode, newPassword)
        setSuccess(true)
        showToast('Password reset successfully!', 'success')

        // Redirect to sign in page
        setTimeout(() => {
          router.push('/auth/signin')
        }, 2000)
      }
    } catch (error: any) {
      console.error('Password reset error:', error)
      setError(error.message || 'Failed to reset password')
      showToast('Failed to reset password', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (loading && mode !== 'resetPassword') {
    return (
      <LoadingOverlay
        isLoading={true}
        message="Processing your request..."
        showDoshi={true}
        fullScreen={true}
      />
    )
  }

  return (
    <PageContainer gradient="default" showPattern={true}>
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <DoshiMascot size="medium" mood={success ? 'excited' : error ? 'sad' : 'happy'} />

            {/* Success State */}
            {success && (
              <div className="mt-8">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Success!
                </h2>
                <p className="mt-2 text-gray-600 dark:text-gray-300">
                  {mode === 'verifyEmail'
                    ? 'Your email has been verified successfully.'
                    : mode === 'recoverEmail'
                    ? 'Your email has been recovered successfully.'
                    : 'Your password has been reset successfully.'}
                </p>
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  Redirecting you...
                </p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="mt-8">
                <h2 className="text-3xl font-bold text-red-600 dark:text-red-400">
                  Oops!
                </h2>
                <p className="mt-2 text-gray-600 dark:text-gray-300">
                  {error}
                </p>
                <button
                  onClick={() => router.push('/auth/signin')}
                  className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Go to Sign In
                </button>
              </div>
            )}

            {/* Password Reset Form */}
            {mode === 'resetPassword' && !success && !error && (
              <div className="mt-8">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Reset Your Password
                </h2>
                {email && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    Enter a new password for {email}
                  </p>
                )}

                <form onSubmit={handlePasswordReset} className="mt-6 space-y-4">
                  <div>
                    <input
                      type="password"
                      placeholder="New Password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <input
                      type="password"
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                  >
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

export default function AuthActionPage() {
  return (
    <Suspense fallback={
      <LoadingOverlay
        isLoading={true}
        message="Loading..."
        showDoshi={true}
        fullScreen={true}
      />
    }>
      <AuthActionContent />
    </Suspense>
  )
}