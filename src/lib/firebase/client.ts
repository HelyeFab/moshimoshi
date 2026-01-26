// Client-side Firebase initialization
// Only for non-sensitive operations like reading public data
// Auth and other sensitive operations go through API routes

import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, enableNetwork, disableNetwork } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { firebaseConfig, getEffectiveAuthDomain } from './config-base'

// Get the effective auth domain (Safari uses default Firebase domain due to ITP issues)
const effectiveConfig = {
  ...firebaseConfig,
  authDomain: getEffectiveAuthDomain(),
}

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(effectiveConfig) : getApp()

// Initialize services
export const auth = getAuth(app)

// Ensure persistence is set explicitly to avoid Safari redirect loss
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      console.log('[Auth] Persistence set to localStorage')
    })
    .catch((error) => {
      console.warn('[Auth] Persistence failed, redirect results may be lost', error)
    })
}

// Initialize Firestore with enhanced error handling and offline persistence
let firestore: ReturnType<typeof getFirestore>

try {
  // Try to initialize with persistent cache for better offline support
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalForceLongPolling: false, // Disable long polling to reduce network errors
    experimentalAutoDetectLongPolling: false,
    // Add settings to handle WebChannel errors better
    ignoreUndefinedProperties: true
  })
} catch (error) {
  console.warn('Firestore enhanced features unavailable, using standard initialization')
  // Fallback to regular initialization if enhanced features fail
  firestore = getFirestore(app)
}

// Handle network changes gracefully
if (typeof window !== 'undefined') {
  let isOnline = navigator.onLine

  window.addEventListener('online', async () => {
    if (!isOnline) {
      isOnline = true
      try {
        await enableNetwork(firestore)
      } catch (err) {
        // Silently ignore network enable errors
      }
    }
  })

  window.addEventListener('offline', async () => {
    if (isOnline) {
      isOnline = false
      try {
        await disableNetwork(firestore)
      } catch (err) {
        // Silently ignore network disable errors
      }
    }
  })
}

export { firestore }
export const db = firestore
export const storage = getStorage(app)

// Initialize analytics only on client side and if supported
export const getFirebaseAnalytics = async () => {
  if (typeof window !== 'undefined') {
    const analyticsSupported = await isSupported()
    if (analyticsSupported) {
      return getAnalytics(app)
    }
  }
  return null
}

// Disable network access for Firestore in development
// This ensures all data operations go through API routes
// if (process.env.NODE_ENV === 'development') {
//   console.log('🔒 Firebase client initialized (auth operations will go through API routes)')
// }

export { app }
