/**
 * Apple Sign-In using Apple's native JS SDK
 *
 * This bypasses Firebase's signInWithRedirect which has issues with Safari's ITP.
 * Instead, we use Apple's JS SDK directly and then sign in to Firebase with the credential.
 *
 * See: https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js
 */

import { OAuthProvider, signInWithCredential } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'

// Apple's Sign In with Apple JS types
declare global {
  interface Window {
    AppleID: {
      auth: {
        init: (config: AppleAuthConfig) => void
        signIn: () => Promise<AppleSignInResponse>
      }
    }
    __appleAuthReady?: boolean
    __appleAuthInitialized?: boolean
  }
}

interface AppleAuthConfig {
  clientId: string
  scope: string
  redirectURI: string
  usePopup: boolean
  state?: string
  nonce?: string
}

interface AppleSignInResponse {
  authorization: {
    code: string
    id_token: string
    state?: string
  }
  user?: {
    email?: string
    name?: {
      firstName?: string
      lastName?: string
    }
  }
}

/**
 * Preload Apple's JS SDK. Call this on page load for Safari/iOS.
 * This ensures the SDK is ready when user clicks the button.
 */
export function preloadAppleSDK(): void {
  if (typeof window === 'undefined') return
  if (window.__appleAuthReady || document.querySelector('script[src*="appleid.auth.js"]')) {
    return
  }

  console.log('[Apple Native] Preloading Apple SDK...')
  const script = document.createElement('script')
  script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'
  script.async = true
  script.onload = () => {
    console.log('[Apple Native] SDK preloaded successfully')
    window.__appleAuthReady = true
    // Initialize immediately after load
    initAppleAuth()
  }
  script.onerror = () => {
    console.error('[Apple Native] Failed to preload Apple SDK')
  }
  document.head.appendChild(script)
}

// Initialize Apple Auth
function initAppleAuth(): void {
  if (window.__appleAuthInitialized) return
  if (!window.AppleID) return

  // For usePopup: true, redirectURI MUST be the current origin (not a different domain)
  // Apple's popup uses postMessage to communicate back, which requires same-origin
  // See: https://developer.apple.com/forums/thread/130666
  const redirectURI = window.location.origin

  console.log('[Apple Native] Initializing Apple Auth with redirect:', redirectURI)

  window.AppleID.auth.init({
    clientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || 'com.moshimoshi.web',
    scope: 'email name',
    redirectURI: redirectURI,
    usePopup: true,
  })

  window.__appleAuthInitialized = true
  console.log('[Apple Native] Auth initialized')
}

/**
 * Wait for Apple SDK to be ready (with timeout)
 */
function waitForAppleSDK(timeoutMs: number = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.AppleID && window.__appleAuthInitialized) {
      resolve()
      return
    }

    const startTime = Date.now()
    const checkInterval = setInterval(() => {
      if (window.AppleID && window.__appleAuthInitialized) {
        clearInterval(checkInterval)
        resolve()
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(checkInterval)
        reject(new Error('Apple SDK load timeout'))
      }
    }, 50)
  })
}

/**
 * Sign in with Apple using the native JS SDK, then authenticate with Firebase.
 *
 * IMPORTANT: Call preloadAppleSDK() on page mount for Safari/iOS to avoid popup blocking.
 */
export async function signInWithAppleNative(): Promise<{
  user: import('firebase/auth').User
  isNewUser: boolean
}> {
  console.log('[Apple Native] Starting Apple Sign-In')

  // If SDK not preloaded, try to load it now (may cause popup block on Safari)
  if (!window.AppleID) {
    console.log('[Apple Native] SDK not preloaded, loading now...')
    preloadAppleSDK()
  }

  // Wait for SDK to be ready
  await waitForAppleSDK()
  console.log('[Apple Native] SDK ready, triggering sign-in')

  // Trigger Apple Sign-In - this should be immediate after user click
  const response = await window.AppleID.auth.signIn()
  console.log('[Apple Native] Got Apple response:', {
    hasCode: !!response.authorization?.code,
    hasIdToken: !!response.authorization?.id_token,
    hasUser: !!response.user,
  })

  if (!response.authorization?.id_token) {
    throw new Error('No ID token received from Apple')
  }

  // Create Firebase credential from Apple's response
  const provider = new OAuthProvider('apple.com')
  const credential = provider.credential({
    idToken: response.authorization.id_token,
    rawNonce: undefined,
  })

  console.log('[Apple Native] Created Firebase credential, signing in...')

  // Sign in to Firebase with the Apple credential
  if (!auth) {
    throw new Error('Firebase not initialized')
  }

  const result = await signInWithCredential(auth, credential)
  console.log('[Apple Native] Firebase sign-in successful:', result.user.email)

  // Check if this is a new user (first sign-in)
  const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime

  return {
    user: result.user,
    isNewUser,
  }
}
