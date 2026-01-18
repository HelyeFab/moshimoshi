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
  OAuthProvider,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import logger from '@/lib/logger'
import { migrateUserStores, cleanupNonUserSpecificStores } from '@/lib/storage/migrate-stores'
import { isIOSPWAStandalone, getDeviceInfo, getAuthRedirectTimeout } from '@/lib/utils/device-detection'
import { requestManager } from '@/lib/api/requestManager'
import { storeEntitlementsSnapshotToken } from '@/lib/pwa/offline-entitlements'

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
  isOffline: boolean
}

interface AuthMethods {
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithApple: () => Promise<void>
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
const OFFLINE_AUTH_CACHE_KEY = 'auth-user-cache'
const AUTH_FLOW_FLAG = 'auth-flow-in-progress'

// Hook to consume auth context
export function useAuth(): Auth {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

function getCachedAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(OFFLINE_AUTH_CACHE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch (error) {
    logger.error('Failed to parse offline auth cache:', error)
    return null
  }
}

// Internal hook for AuthProvider to manage auth state
function useAuthProvider(): Auth {
  // State - this will be shared via Context
  const [user, setUserState] = useState<AuthUser | null>(() => getCachedAuthUser())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isGuest, setIsGuest] = useState(false)
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof navigator === 'undefined') return false
    return !navigator.onLine && !!getCachedAuthUser()
  })

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
      const providerIds = firebaseUser.providerData.map((provider) => provider.providerId)
      const isGoogleSignIn = providerIds.includes('google.com')
      const isAppleSignIn = providerIds.includes('apple.com')
      const endpoint = isGoogleSignIn
        ? '/api/auth/google'
        : isAppleSignIn
          ? '/api/auth/apple'
          : '/api/auth/login'

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

  const refreshEntitlementsSnapshot = useCallback(async () => {
    try {
      const response = await fetch('/api/entitlements/snapshot', {
        method: 'GET',
        credentials: 'include'
      })
      if (!response.ok) return
      const data = await response.json()
      if (data?.token) {
        await storeEntitlementsSnapshotToken(data.token)
      }
    } catch (error) {
      logger.warn('Failed to refresh entitlements snapshot:', error)
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
        setIsOffline(false)
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
          setIsOffline(false)
        } else {
          setUser(null)
          setIsOffline(false)
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
          setIsOffline(false)
        } else {
          setUser(null)
          setIsOffline(false)
        }
        setLoading(false)
        return data
      }

      const fetchSession = async () => {
        const response = await fetch('/api/auth/session', {
          credentials: 'include'
        })
        return response.json()
      }

      const shouldRetryAfterAuthFlow = () => {
        if (typeof window === 'undefined') return false
        return sessionStorage.getItem(AUTH_FLOW_FLAG) === 'true'
      }

      // Create new request and cache the promise
      // Fetching /api/auth/session
      const requestPromise = fetchSession()
      sessionCache.promise = requestPromise
      sessionCache.timestamp = now

      // Wait for the response
      const data = await requestPromise
      sessionCache.data = data

      logger.auth('[useAuthProvider] Session data from API:', data)

      if (!data.authenticated && shouldRetryAfterAuthFlow()) {
        logger.auth('[useAuthProvider] Session not ready after auth flow, retrying...')
        const retryDelays = [300, 600, 900]
        let retryData = data
        for (let i = 0; i < retryDelays.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, retryDelays[i]))
          retryData = await fetchSession()
          logger.auth('[useAuthProvider] Session retry result', { attempt: i + 1, authenticated: retryData?.authenticated })
          if (retryData?.authenticated) {
            sessionCache.data = retryData
            break
          }
        }
        if (retryData?.authenticated) {
          logger.auth('[useAuthProvider] Session established after retry')
          sessionStorage.removeItem(AUTH_FLOW_FLAG)
          sessionCache.data = retryData
          if (retryData.user) {
            const authUser = {
              uid: retryData.user.uid,
              email: retryData.user.email,
              displayName: retryData.user.displayName || retryData.user.name,
              photoURL: retryData.user.photoURL || retryData.user.avatar,
              emailVerified: retryData.user.emailVerified ?? true,
              isAnonymous: false,
              isAdmin: retryData.user.isAdmin,
              metadata: {
                creationTime: retryData.user.createdAt,
                lastSignInTime: retryData.user.lastLoginAt
              },
              providerData: retryData.user.providerData || []
            }
            setUser(authUser)
            setIsOffline(false)
            if (typeof window !== 'undefined' && authUser) {
              localStorage.setItem('auth-user', JSON.stringify({
                uid: authUser.uid,
                email: authUser.email
              }))
              localStorage.setItem(OFFLINE_AUTH_CACHE_KEY, JSON.stringify(authUser))
              await migrateUserStores(authUser.uid)
            }
            refreshEntitlementsSnapshot()
            setLoading(false)
            return retryData
          }
        } else {
          logger.auth('[useAuthProvider] Session retry failed after auth flow')
          sessionStorage.removeItem(AUTH_FLOW_FLAG)
        }
      }

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
        setIsOffline(false)

        // Store user info for theme/language contexts to access
        if (typeof window !== 'undefined' && authUser) {
          localStorage.setItem('auth-user', JSON.stringify({
            uid: authUser.uid,
            email: authUser.email
          }))
          localStorage.setItem(OFFLINE_AUTH_CACHE_KEY, JSON.stringify(authUser))

          // SECURITY FIX: Migrate any old non-user-specific store data
          // This ensures old data is moved to user-specific keys
          await migrateUserStores(authUser.uid)
        }

        refreshEntitlementsSnapshot()
        setLoading(false)
      } else {
        logger.auth('[useAuthProvider] No authenticated user in session response')
        setUser(null)
        setIsOffline(false)
        setLoading(false)
      }

      return data
    } catch (err: any) {
      logger.error('Session check error:', err)
      const isNavigatorOffline = typeof navigator !== 'undefined' && !navigator.onLine
      if (isNavigatorOffline && typeof window !== 'undefined') {
        const cachedAuth = localStorage.getItem(OFFLINE_AUTH_CACHE_KEY)
        if (cachedAuth) {
          try {
            const cachedUser = JSON.parse(cachedAuth) as AuthUser
            setUser(cachedUser)
            setIsOffline(true)
            setError(null)
            sessionCache.data = { authenticated: true, user: cachedUser }
            sessionCache.promise = Promise.resolve(sessionCache.data)
            sessionCache.timestamp = Date.now()
            return sessionCache.data
          } catch (parseError) {
            logger.error('Failed to parse offline auth cache:', parseError)
          }
        }
      }
      setError('Failed to check authentication status')
      setIsOffline(false)
      sessionCache.promise = null
      sessionCache.data = null
      return null
    } finally {
      setLoading(false)
    }
  }, [refreshEntitlementsSnapshot])

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

  // Sign in with Apple
  const signInWithApple = useCallback(async () => {
    setError(null)
    setLoading(true)

    try {
      // Clear guest mode before signing in with Apple
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('isGuestUser')
      }
      setIsGuest(false)

      const provider = new OAuthProvider('apple.com')
      provider.addScope('email')
      provider.addScope('name')

      // iOS PWA standalone mode blocks popups - skip popup attempt
      const isIOSPWA = isIOSPWAStandalone()

      if (isIOSPWA) {
        logger.auth('[iOS PWA] Detected standalone mode - using redirect flow directly')
        const deviceInfo = getDeviceInfo()
        logger.auth('[Device Info]', {
          platform: deviceInfo.platform,
          isPWA: deviceInfo.isPWA,
          isIOSPWA: deviceInfo.isIOSPWA
        })

        await signInWithRedirect(auth, provider)
        return
      }

      // Standard flow: Try popup first, fallback to redirect
      try {
        const credential = await signInWithPopup(auth, provider)
        await createServerSession(credential.user)
      } catch (popupError: any) {
        if (popupError.code === 'auth/popup-blocked' ||
            popupError.code === 'auth/cancelled-popup-request') {
          logger.auth('[Popup Blocked] Falling back to redirect flow')
          await signInWithRedirect(auth, provider)
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

      // IMPROVEMENT #1: iOS PWA Preemptive Redirect
      // iOS PWA standalone mode blocks popups - skip popup attempt
      const isIOSPWA = isIOSPWAStandalone()

      if (isIOSPWA) {
        logger.auth('[iOS PWA] Detected standalone mode - using redirect flow directly')
        const deviceInfo = getDeviceInfo()
        logger.auth('[Device Info]', {
          platform: deviceInfo.platform,
          isPWA: deviceInfo.isPWA,
          isIOSPWA: deviceInfo.isIOSPWA
        })

        await signInWithRedirect(auth, provider)
        return
      }

      // Standard flow: Try popup first, fallback to redirect
      try {
        const credential = await signInWithPopup(auth, provider)
        await createServerSession(credential.user)
      } catch (popupError: any) {
        // If popup is blocked, use redirect
        if (popupError.code === 'auth/popup-blocked' ||
            popupError.code === 'auth/cancelled-popup-request') {
          logger.auth('[Popup Blocked] Falling back to redirect flow')
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
      // STEP 1: Cancel all pending API requests to prevent 401 errors
      requestManager.cancelAllRequests('User signed out')

      // STEP 2: Use direct Firebase auth and clear server session
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
        cleanupNonUserSpecificStores()

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

    // Timeout for auth initialization to prevent PWA getting stuck on splash screen
    const AUTH_INIT_TIMEOUT = 10000 // 10 seconds max for initial auth

    const initAuth = async () => {
      // Create timeout promise to prevent infinite loading on PWA launch
      const timeoutPromise = new Promise<'timeout'>((resolve) => {
        setTimeout(() => {
          logger.warn('[Auth] Initialization timed out after', AUTH_INIT_TIMEOUT, 'ms - PWA recovery mode')
          resolve('timeout')
        }, AUTH_INIT_TIMEOUT)
      })

      // Main auth initialization logic
      const authInitPromise = (async () => {
        // Check for redirect result on mount (for Google sign-in)
        try {
          // IMPROVEMENT #2: Platform-specific timeout
          // iOS PWA needs 15s timeout due to slower auth flow
          const redirectTimeout = getAuthRedirectTimeout()

          logger.auth('[Auth Init] Checking redirect result with', redirectTimeout, 'ms timeout')

          const redirectPromise = getRedirectResult(auth)
          const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => {
              logger.auth('[Auth Init] Redirect result timed out after', redirectTimeout, 'ms')
              resolve(null)
            }, redirectTimeout)
          })

          const result = await Promise.race([redirectPromise, timeoutPromise])

          if (result?.user) {
            logger.auth('[Auth Init] Redirect result found - creating session')
            await createServerSession(result.user)
          } else if (result === null) {
            logger.auth('[Auth Init] No redirect result or timeout occurred')
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

        return sessionData
      })()

      // Race auth init against timeout
      const result = await Promise.race([authInitPromise, timeoutPromise])

      // If we timed out, ensure loading is false so app can render
      if (result === 'timeout') {
        logger.warn('[Auth] Forcing loading=false due to timeout - app will render without auth')
        setLoading(false)
        // User can still authenticate later when onAuthStateChanged fires
      }

      // Mark as initialized regardless of timeout
      hasInitializedRef.current = true
      initializingRef.current = false

      // Listen to auth state changes but handle race conditions properly
      // This runs AFTER the timeout check, so the app can render while we wait
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

  // Listen for PWA soft refresh events (when app returns from background)
  useEffect(() => {
    const handleSoftRefresh = async () => {
      logger.info('[Auth] PWA soft refresh triggered - re-checking session')
      try {
        // Force a fresh session check (bypass cache)
        sessionCache.data = null
        sessionCache.promise = null
        sessionCache.timestamp = 0
        await checkSession(true)
      } catch (err) {
        logger.error('[Auth] Soft refresh session check failed:', err)
      }
    }

    window.addEventListener('pwa-soft-refresh', handleSoftRefresh)

    return () => {
      window.removeEventListener('pwa-soft-refresh', handleSoftRefresh)
    }
  }, [checkSession])

  // Return auth object - memoize to ensure proper change detection
  const authValue = useMemo(() => ({
    // State
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isGuest,
    isOffline,

    // Methods
    signIn,
    signUp,
    signInWithGoogle,
    signInWithApple,
    signOut: signOutUser,
    refreshSession,
    clearError
  }), [user, loading, error, isGuest, isOffline, signIn, signUp, signInWithGoogle, signInWithApple, signOutUser, refreshSession, clearError])

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
