'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithEmailLink, isSignInWithEmailLink } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useTranslation } from '@/i18n/I18nContext'

function VerifyMagicLinkContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const { strings } = useTranslation()
  const [verifying, setVerifying] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsEmail, setNeedsEmail] = useState(false)
  const [emailInput, setEmailInput] = useState('')

  useEffect(() => {
    const verifyMagicLink = async () => {
      if (!auth) {
        setError('Firebase not initialized')
        setVerifying(false)
        return
      }

      // Check if this is a sign-in with email link
      if (isSignInWithEmailLink(auth, window.location.href)) {
        // Get the email from localStorage (set when the link was requested)
        let email = window.localStorage.getItem('emailForSignIn')

        // If email is not in localStorage, show email input form
        if (!email) {
          setNeedsEmail(true)
          setVerifying(false)
          return
        }

        try {
          // Sign in with the email link
          const result = await signInWithEmailLink(auth, email, window.location.href)
          console.log('Magic link sign-in successful:', result.user.email)

          // Get the ID token
          const idToken = await result.user.getIdToken()

          // Create server session - temporarily using google endpoint which handles photoURL correctly
          const response = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          })

          const data = await response.json()

          if (response.ok) {
            // Clear the email from localStorage
            window.localStorage.removeItem('emailForSignIn')

            showToast('Successfully signed in!', 'success')
            router.push('/dashboard')
          } else {
            console.error('Session creation failed:', data.error)
            setError(data.error?.message || 'Failed to create session')
          }
        } catch (error: any) {
          console.error('Magic link verification error:', error)

          // Handle specific Firebase errors
          if (error.code === 'auth/invalid-action-code') {
            router.push('/auth/error?code=INVALID_LINK')
          } else if (error.code === 'auth/expired-action-code') {
            router.push('/auth/error?code=LINK_EXPIRED')
          } else if (error.code === 'auth/user-not-found') {
            router.push('/auth/error?code=USER_NOT_FOUND')
          } else if (error.code?.startsWith('auth/')) {
            router.push('/auth/error?code=FIREBASE_ERROR')
          } else {
            setError(error.message || 'Failed to verify magic link')
          }
        }
      } else {
        setError('Invalid magic link')
      }

      setVerifying(false)
    }

    if (!needsEmail) {
      verifyMagicLink()
    }
  }, [router, showToast, needsEmail])

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!emailInput) {
      showToast('Please enter your email', 'error')
      return
    }

    // Store email and reload the verification
    window.localStorage.setItem('emailForSignIn', emailInput)
    setNeedsEmail(false)
    setVerifying(true)

    // Trigger re-verification with the email
    window.location.reload()
  }

  // If we need email input, show a nice form
  if (needsEmail) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background-light to-japanese-mizu/20 dark:from-dark-850 dark:to-dark-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl p-8">
            {/* Logo */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center gap-2 mb-4">
                <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                  も
                </div>
                <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Moshimoshi
                </span>
              </div>
            </div>
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 dark:bg-primary-900/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Confirm Your Email
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                To complete sign-in, please enter the email address you used to request this magic link
              </p>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                  autoFocus
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
              >
                Continue
              </button>

              <button
                type="button"
                onClick={() => router.push('/auth/signup')}
                className="w-full py-3 bg-gray-100 dark:bg-dark-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-dark-700 transition-colors"
              >
                Back to Sign Up
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background-light to-japanese-mizu/20 dark:from-dark-850 dark:to-dark-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl p-8 text-center">
          {/* Logo */}
          <div className="inline-flex items-center justify-center gap-2 mb-6">
            <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center text-white font-bold text-xl">
              も
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Moshimoshi
            </span>
          </div>

          {verifying ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4">
                <svg className="animate-spin w-full h-full text-primary-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Verifying Magic Link
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Please wait while we sign you in...
              </p>
            </>
          ) : error ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 text-red-500">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Verification Failed
              </h1>
              <p className="text-red-600 dark:text-red-400 mb-4">
                {error}
              </p>
              <button
                onClick={() => router.push('/auth/signup')}
                className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Back to Sign Up
              </button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-4 text-green-500">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Success!
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Redirecting to dashboard...
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerifyMagicLinkPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-background-light to-japanese-mizu/20 dark:from-dark-850 dark:to-dark-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4">
              <svg className="animate-spin w-full h-full text-primary-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Loading...
            </h1>
          </div>
        </div>
      </div>
    }>
      <VerifyMagicLinkContent />
    </Suspense>
  )
}