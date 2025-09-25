'use client'

import React, { useState, useEffect, useCallback, useRef, createContext, useContext, ReactNode, useMemo } from 'react'
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import logger from '@/lib/logger'
import { migrateUserStores } from '@/lib/storage/migrate-stores'

// Types
interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  emailVerified: boolean
  isAnonymous: boolean
  isAdmin?: boolean
  metadata: {
    creationTime?: string
    lastSignInTime?: string
  }
  providerData: any[]
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  error: string | null
  isAuthenticated: boolean
  isGuest: boolean
}

interface AuthMethods {
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
  clearError: () => void
}

export interface Auth extends AuthState, AuthMethods {}

// Create Auth Context
const AuthContext = createContext<Auth | null>(null)

/**
 * Authentication Hook
 *
 * Provides a consistent authentication interface with:
 * - Firebase Auth integration
 * - JWT session management
 * - Session caching and deduplication
 * - Guest mode support
 * - Automatic session refresh
 */

// Global session cache to prevent duplicate requests
let sessionCache: {
  promise: Promise<any> | null
  timestamp: number
  data: any | null
} = {
  promise: null,
  timestamp: 0,
  data: null
}


// Clear cache on module load to force fresh data
if (typeof window !== 'undefined') {
  sessionCache.data = null
  sessionCache.promise = null
  sessionCache.timestamp = 0
}

const SESSION_CACHE_TTL = 5000 // 5 seconds cache TTL

// Hook to consume auth context
export function useAuth(): Auth {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Internal hook for AuthProvider to manage auth state
function useAuthProvider(): Auth {
  // State - this will be shared via Context
  const [user, setUserState] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isGuest, setIsGuest] = useState(false)

  // Wrap setUser for consistency
  const setUser = useCallback((newUser: AuthUser | null) => {
    setUserState(newUser)
  }, [])

  // Track if we've already initialized to prevent duplicate calls
  const initializingRef = useRef(false)
  const hasInitializedRef = useRef(false)
  const lastAuthStateRef = useRef<string | null>(null)

  // Helper function to convert Firebase User to AuthUser
  const convertFirebaseUser = (firebaseUser: User | null): AuthUser | null => {
    if (!firebaseUser) return null

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      emailVerified: firebaseUser.emailVerified,
      isAnonymous: firebaseUser.isAnonymous,
      metadata: {
        creationTime: firebaseUser.metadata.creationTime,
        lastSignInTime: firebaseUser.metadata.lastSignInTime
      },
      providerData: firebaseUser.providerData
    }
  }

  // Send ID token to server to create session
  const createServerSession = useCallback(async (firebaseUser: User) => {
    try {
      // Clear guest mode when creating a real session
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('isGuestUser')
      }
      setIsGuest(false)

      const idToken = await firebaseUser.getIdToken()

      // Determine which endpoint to use based on the sign-in provider
      const providerData = firebaseUser.providerData[0]
      const isGoogleSignIn = providerData?.providerId === 'google.com'
      const endpoint = isGoogleSignIn ? '/api/auth/google' : '/api/auth/login'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to create session')
      }

      // Clear cache after creating new session
      sessionCache.promise = null
      sessionCache.data = null
      sessionCache.timestamp = 0

      // Set initial user data
      const authUser = convertFirebaseUser(firebaseUser)
      setUser(authUser)

      // Store user info for theme/language contexts to access
      if (typeof window !== 'undefined' && authUser) {
        localStorage.setItem('auth-user', JSON.stringify({
          uid: authUser.uid,
          email: authUser.email
        }))

        // SECURITY FIX: Migrate any old non-user-specific store data
        // This ensures old data is moved to user-specific keys
        await migrateUserStores(authUser.uid)
      }

      setError(null)

      // The session will be fetched in the auth state listener to get isAdmin
    } catch (err: any) {
      logger.error('Session creation error:', err)
      setError(err.message)
      throw err
    }
  }, [])

  // Check session from API with caching and deduplication
  const checkSession = useCallback(async (forceRefresh = false) => {
    try {
      // Check if this is a guest - guest mode takes precedence over authenticated sessions
      const isGuestUser = typeof window !== 'undefined' &&
                         sessionStorage.getItem('isGuestUser') === 'true'

      if (isGuestUser) {
        // Guest mode is active - ignore any existing authenticated session
        setIsGuest(true)
        setUser(null) // Clear any existing user to ensure guest mode
        setLoading(false)
        // Clear session cache to prevent authenticated user from leaking through
        sessionCache.data = null
        sessionCache.promise = null
        sessionCache.timestamp = 0
        return null
      }

      // Use cached data if available and not expired
      const now = Date.now()
      if (!forceRefresh && sessionCache.data && (now - sessionCache.timestamp) < SESSION_CACHE_TTL) {
        const cachedData = sessionCache.data
        if (cachedData.authenticated && cachedData.user) {
          const cachedAuthUser = {
            uid: cachedData.user.uid,
            email: cachedData.user.email,
            displayName: cachedData.user.displayName || cachedData.user.name,
            photoURL: cachedData.user.photoURL || cachedData.user.avatar,
            emailVerified: cachedData.user.emailVerified ?? true,
            isAnonymous: false,
            isAdmin: cachedData.user.isAdmin,
            metadata: {
              creationTime: cachedData.user.createdAt,
              lastSignInTime: cachedData.user.lastLoginAt
            },
            providerData: cachedData.user.providerData || []
          }
          setUser(cachedAuthUser)
        } else {
          setUser(null)
        }
        setLoading(false)
        return cachedData
      }

      // If there's an ongoing request, wait for it
      if (sessionCache.promise && (now - sessionCache.timestamp) < SESSION_CACHE_TTL) {
        const data = await sessionCache.promise
        if (data.authenticated && data.user) {
          const dataAuthUser = {
            uid: data.user.uid,
            email: data.user.email,
            displayName: data.user.displayName || data.user.name,
            photoURL: data.user.photoURL || data.user.avatar,
            emailVerified: data.user.emailVerified ?? true,
            isAnonymous: false,
            isAdmin: data.user.isAdmin,
            metadata: {
              creationTime: data.user.createdAt,
              lastSignInTime: data.user.lastLoginAt
            },
            providerData: data.user.providerData || []
          }
          setUser(dataAuthUser)
        } else {
          setUser(null)
        }
        setLoading(false)
        return data
      }

      // Create new request and cache the promise
      // Fetching /api/auth/session
      const requestPromise = fetch('/api/auth/session', {
        credentials: 'include'
      }).then(res => res.json())
      sessionCache.promise = requestPromise
      sessionCache.timestamp = now

      // Wait for the response
      const data = await requestPromise
      sessionCache.data = data

      logger.auth('[useAuthProvider] Session data from API:', data)

      if (data.authenticated && data.user) {
        // Convert API user data to AuthUser format
        const authUser = {
          uid: data.user.uid,
          email: data.user.email,
          displayName: data.user.displayName || data.user.name,
          photoURL: data.user.photoURL || data.user.avatar,
          emailVerified: data.user.emailVerified ?? true,
          isAnonymous: false,
          isAdmin: data.user.isAdmin,
          metadata: {
            creationTime: data.user.createdAt,
            lastSignInTime: data.user.lastLoginAt
          },
          providerData: data.user.providerData || []
        }
        setUser(authUser)

        // Store user info for theme/language contexts to access
        if (typeof window !== 'undefined' && authUser) {
          localStorage.setItem('auth-user', JSON.stringify({
            uid: authUser.uid,
            email: authUser.email
          }))

          // SECURITY FIX: Migrate any old non-user-specific store data
          // This ensures old data is moved to user-specific keys
          await migrateUserStores(authUser.uid)
        }

        setLoading(false)
      } else {
        logger.auth('[useAuthProvider] No authenticated user in session response')
        setUser(null)
        setLoading(false)
      }

      return data
    } catch (err: any) {
      logger.error('Session check error:', err)
      setError('Failed to check authentication status')
      sessionCache.promise = null
      sessionCache.data = null
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Refresh session
  const refreshSession = useCallback(async () => {
    setLoading(true)
    setError(null)

    // Clear the session cache to force fresh data
    sessionCache.data = null
    sessionCache.promise = null
    sessionCache.timestamp = 0

    // Check current Firebase auth state
    const currentUser = auth.currentUser
    if (currentUser) {
      await createServerSession(currentUser)
    } else {
      // Use API pattern with force refresh
      await checkSession(true)
    }

    setLoading(false)
  }, [checkSession, createServerSession])

  // Sign in with email and password
  const signIn = useCallback(async (email: string, password: string) => {
    setError(null)
    setLoading(true)

    try {
      // Clear guest mode before signing in
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('isGuestUser')
      }
      setIsGuest(false)

      // Use direct Firebase auth
      const credential = await signInWithEmailAndPassword(auth, email, password)
      await createServerSession(credential.user)
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [createServerSession])

  // Sign up with email and password
  const signUp = useCallback(async (email: string, password: string) => {
    setError(null)
    setLoading(true)

    try {
      // Clear guest mode before signing up
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('isGuestUser')
      }
      setIsGuest(false)

      // Use direct Firebase auth
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      await createServerSession(credential.user)
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [createServerSession])

  // Sign in with Google
  const signInWithGoogle = useCallback(async () => {
    setError(null)
    setLoading(true)

    try {
      // Clear guest mode before signing in with Google
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('isGuestUser')
      }
      setIsGuest(false)

      // Use direct Firebase auth
      const provider = new GoogleAuthProvider()

      try {
        const credential = await signInWithPopup(auth, provider)
        await createServerSession(credential.user)
      } catch (popupError: any) {
        // If popup is blocked, use redirect
        if (popupError.code === 'auth/popup-blocked' ||
            popupError.code === 'auth/cancelled-popup-request') {
          await signInWithRedirect(auth, provider)
          // The redirect will happen, session will be created when user returns
        } else {
          throw popupError
        }
      }
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [createServerSession])

  // Sign out
  const signOutUser = useCallback(async () => {
    setError(null)
    setLoading(true)

    try {
      // Use direct Firebase auth and clear server session
      await signOut(auth)
      await fetch('/api/auth/logout', { method: 'POST' })

      // Clear all caches
      sessionCache.promise = null
      sessionCache.data = null
      sessionCache.timestamp = 0
      lastAuthStateRef.current = null

      setUser(null)

      // Clear guest status if it exists
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('isGuestUser')

        // Clear non-user-specific preferences to prevent cross-user contamination
        localStorage.removeItem('moshimoshi-theme')
        localStorage.removeItem('moshimoshi-language')
        localStorage.removeItem('user-preferences')
        localStorage.removeItem('auth-user')

        // SECURITY FIX: Clean up any non-user-specific store data to prevent leakage
        // Remove old non-user-specific Zustand stores
        localStorage.removeItem('streak-storage')
        localStorage.removeItem('achievement-store')
        localStorage.removeItem('pin-store')

        // Also clear any user-specific data for the current user
        // This ensures a clean slate on logout
        const userPattern = new RegExp(`^moshimoshi_.*_${user?.uid}$`)
        const keysToRemove: string[] = []

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && userPattern.test(key)) {
            keysToRemove.push(key)
          }
        }

        keysToRemove.forEach(key => {
          localStorage.removeItem(key)
        })
      }
      setIsGuest(false)
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Initialize auth state
  useEffect(() => {
    // Prevent duplicate initialization
    if (initializingRef.current || hasInitializedRef.current) {
      return
    }
    initializingRef.current = true

    // Check session and listen to auth state changes
    let unsubscribe: (() => void) | undefined

    const initAuth = async () => {
      // Check for redirect result on mount (for Google sign-in)
      try {
        const result = await getRedirectResult(auth)
        if (result?.user) {
          await createServerSession(result.user)
        }
      } catch (err) {
        logger.error('Error handling redirect result:', err)
      }

      // Check existing session only once
      // Initial session check on mount
      const sessionData = await checkSession()
      // Initial session check complete

      // Log if we detect a race condition on mount
      if (sessionData?.authenticated && !auth.currentUser) {
        logger.race('Session exists but Firebase Auth not initialized on mount', {
          sessionUser: sessionData.user?.uid,
          firebaseUser: null
        })
      }

      // Mark as initialized
      hasInitializedRef.current = true
      initializingRef.current = false

      // Listen to auth state changes but handle race conditions properly
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        // Check if guest mode is active - it takes precedence
        const isGuestUser = typeof window !== 'undefined' &&
                           sessionStorage.getItem('isGuestUser') === 'true'

        if (isGuestUser) {
          // Don't process auth state changes in guest mode
          setIsGuest(true)
          setUser(null)
          setLoading(false)
          return
        }

        const authStateKey = firebaseUser ? firebaseUser.uid : 'null'

        // Skip if auth state hasn't actually changed
        if (lastAuthStateRef.current === authStateKey) {
          return
        }
        lastAuthStateRef.current = authStateKey

        if (firebaseUser) {
          // Firebase has a user - sync with server session
          const currentCachedUser = sessionCache.data?.user
          if (!currentCachedUser || currentCachedUser.uid !== firebaseUser.uid) {
            try {
              // Check if session exists with cached request
              const sessionData = await checkSession()
              if (!sessionData || !sessionData.authenticated) {
                // Session doesn't exist, create it
                await createServerSession(firebaseUser)
              } else {
                // Use the session data which includes isAdmin
                // The checkSession function already sets the user with isAdmin
                // No need to setUser here as checkSession already does it
              }
            } catch (err) {
              logger.error('Session sync error:', err)
            }
          } else {
            // Use cached user data which already includes isAdmin
            // Don't override with convertFirebaseUser as it loses isAdmin
            // The user is already set from checkSession
          }
        } else {
          // Firebase reports no user - this could be:
          // 1. User actually signed out
          // 2. Firebase Auth not yet initialized (race condition)
          // 3. Firebase Auth token expired but session still valid

          // Check server session to determine actual auth state
          try {
            const sessionData = await checkSession(true) // Force refresh to get latest
            if (sessionData && sessionData.authenticated) {
              // We have a valid server session but Firebase Auth is empty
              // This is likely a race condition during initialization
              // Keep the session but log for monitoring
              logger.race('Auth initialization race detected', {
                sessionValid: true,
                firebaseUser: null,
                sessionUser: sessionData.user?.uid,
                message: 'Valid session exists but Firebase Auth is empty'
              })

              // Attempt to restore Firebase Auth state if we have a refresh token
              // This ensures Stripe webhooks and Firebase updates work properly
              if (typeof window !== 'undefined') {
                // The session is valid, Firebase will eventually sync
                // Don't clear the user
              }
            } else {
              // No valid session - user is truly signed out
              setUser(null)
              // Clear cache when user signs out
              sessionCache.promise = null
              sessionCache.data = null
              sessionCache.timestamp = 0
            }
          } catch (err) {
            logger.error('Session check error during auth state change:', err)
            // On error, clear user to be safe
            setUser(null)
            sessionCache.promise = null
            sessionCache.data = null
            sessionCache.timestamp = 0
          }
        }
        setLoading(false)
      })
    }

    initAuth()

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [checkSession, createServerSession])

  // Return auth object - memoize to ensure proper change detection
  const authValue = useMemo(() => ({
    // State
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isGuest,

    // Methods
    signIn,
    signUp,
    signInWithGoogle,
    signOut: signOutUser,
    refreshSession,
    clearError
  }), [user, loading, error, isGuest, signIn, signUp, signInWithGoogle, signOutUser, refreshSession, clearError])

  return authValue
}

/**
 * AuthProvider Component
 *
 * Provides authentication context to all child components.
 * This ensures all components share the same auth state.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthProvider()

  // Use createElement to avoid JSX in .ts file
  return React.createElement(
    AuthContext.Provider,
    { value: auth },
    children
  )
}