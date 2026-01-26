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

// Load Apple's JS SDK
function loadAppleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.AppleID) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Apple Sign-In SDK'))
    document.head.appendChild(script)
  })
}

// Initialize Apple Auth
function initAppleAuth(): void {
  // Get the current URL for redirect (Apple requires exact match)
  const redirectURI = `${window.location.origin}${window.location.pathname}`

  window.AppleID.auth.init({
    clientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || 'com.moshimoshi.web',
    scope: 'email name',
    redirectURI,
    usePopup: true, // Use popup mode - works better across browsers
  })
}

/**
 * Sign in with Apple using the native JS SDK, then authenticate with Firebase.
 * This approach works on Safari and other browsers that block Firebase's redirect flow.
 */
export async function signInWithAppleNative(): Promise<{
  user: import('firebase/auth').User
  isNewUser: boolean
}> {
  console.log('[Apple Native] Starting Apple Sign-In')

  // Load Apple's SDK
  await loadAppleScript()
  console.log('[Apple Native] SDK loaded')

  // Initialize
  initAppleAuth()
  console.log('[Apple Native] Auth initialized')

  // Trigger Apple Sign-In
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
    rawNonce: undefined, // We're not using nonce for simplicity
  })

  console.log('[Apple Native] Created Firebase credential, signing in...')

  // Sign in to Firebase with the Apple credential
  if (!auth) {
    throw new Error('Firebase not initialized')
  }

  const result = await signInWithCredential(auth, credential)
  console.log('[Apple Native] Firebase sign-in successful:', result.user.email)

  // Check if this is a new user (first sign-in)
  // Firebase doesn't directly tell us, but we can check metadata
  const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime

  return {
    user: result.user,
    isNewUser,
  }
}
