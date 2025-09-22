'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { getUserFriendlyErrorMessage } from '@/utils/errorMessages'
import { useTranslation } from '@/i18n/I18nContext'
import logger from '@/lib/logger'

function SignInContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const { strings } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  useEffect(() => {
    // Show message if redirected from signup
    if (searchParams?.get('signup') === 'success') {
      showToast(strings.auth.signin.messages.signupSuccess, 'success')
    }
  }, [searchParams, showToast, strings.auth.signin.messages.signupSuccess])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    logger.auth('Sign in attempt', { email })
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()
      logger.auth('Sign in response', { status: response.status, data })

      if (response.ok) {
        logger.auth('Sign in successful, redirecting to dashboard')
        showToast(strings.auth.signin.messages.signinSuccess, 'success')
        // Use window.location for a hard redirect to ensure navigation
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 100)
      } else {
        console.error('Sign in error:', data.error, 'Full response:', data)
        // Handle various error response structures
        let errorMessage = strings.auth.signin.errors.signinFailed

        if (data.error) {
          // Check if error has code or message properties
          if (data.error.code) {
            errorMessage = getUserFriendlyErrorMessage(data.error.code)
          } else if (data.error.message) {
            errorMessage = getUserFriendlyErrorMessage(data.error.message)
          } else if (typeof data.error === 'string') {
            errorMessage = getUserFriendlyErrorMessage(data.error)
          }
          // If error is an empty object or has no useful properties, use default message
        } else if (data.message) {
          // Sometimes the error might be at the root level
          errorMessage = getUserFriendlyErrorMessage(data.message)
        }

        setError(errorMessage)
      }
    } catch (err) {
      console.error('Sign in exception:', err)
      setError(getUserFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    logger.auth('Google sign in clicked')
    setLoading(true)
    setError('')
    
    try {
      // Use Firebase client SDK for Google auth
      const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth')
      const { auth } = await import('@/lib/firebase/config')
      
      if (!auth) {
        throw new Error('Firebase not initialized')
      }
      
      const provider = new GoogleAuthProvider()
      // Force account selection every time
      provider.setCustomParameters({
        prompt: 'select_account'
      })
      
      const result = await signInWithPopup(auth, provider)
      logger.auth('Google sign in successful', { email: result.user.email })
      
      // Get the ID token
      const idToken = await result.user.getIdToken()
      
      // Send token to backend to create session
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        logger.auth('Session created, redirecting to dashboard')
        showToast(strings.auth.signin.messages.signinSuccess, 'success')
        // Use window.location for a hard redirect to ensure navigation
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 100)
      } else {
        console.error('Session creation failed:', data)
        const errorMessage = data.error?.message || data.error || strings.auth.signin.errors.sessionCreationFailed
        setError(getUserFriendlyErrorMessage(errorMessage))
      }
    } catch (err: any) {
      console.error('Google sign in error:', err)
      setError(getUserFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLink = async () => {
    if (!email) {
      setError(strings.auth.signin.messages.magicLinkError)
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/magic-link/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (response.ok) {
        setError('') // Clear any errors
        showToast(strings.auth.signin.messages.magicLinkSuccess || 'Check your email for the magic link!', 'success', 5000)
      } else {
        const errorMessage = data.error?.message || strings.auth.signin.errors.magicLinkFailed
        setError(getUserFriendlyErrorMessage(errorMessage))
      }
    } catch (err) {
      setError(getUserFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background-light to-japanese-mizu/20 dark:from-dark-850 dark:to-dark-900 overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="max-w-md w-full">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white font-bold text-xl">
            {strings.auth.signin.branding.logoText}
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{strings.common.brand}</span>
        </Link>

        {/* Sign In Card */}
        <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {strings.auth.signin.page.title}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {strings.auth.signin.page.subtitle}
          </p>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 rounded-lg mb-4 flex items-start gap-2">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {strings.auth.signin.form.labels.email}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder={strings.auth.signin.form.placeholders.email}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {strings.auth.signin.form.labels.password}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder={strings.auth.signin.form.placeholders.password}
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 dark:border-dark-600 text-primary-500 focus:ring-primary-500" />
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">{strings.auth.signin.form.checkbox}</span>
              </label>
              <Link href="/auth/reset-password" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
                {strings.auth.signin.links.forgotPassword}
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? strings.auth.signin.form.submitButton.loading : strings.auth.signin.form.submitButton.default}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-dark-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-surface-dark text-gray-500">{strings.auth.signin.alternativeAuth.divider}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleMagicLink}
            disabled={loading || !email}
            className="w-full py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed mb-3"
          >
            {strings.auth.signin.alternativeAuth.magicLinkButton}
          </button>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3 bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 border-2 border-gray-300 dark:border-dark-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-600 transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {strings.auth.signin.alternativeAuth.googleButton}
          </button>

          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
            <Link href="/auth/signup" className="text-primary-600 dark:text-primary-400 hover:underline font-medium">
              {strings.auth.signin.links.signupLink}
            </Link>
          </p>
        </div>
        </div>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  )
}