// Shared Firebase client config (no initialization side effects)

// Default Firebase domain (fallback for non-production environments)
export const DEFAULT_FIREBASE_AUTH_DOMAIN = 'moshimoshi-de237.firebaseapp.com'

// Production domain - requests to /__/auth/* are proxied to Firebase
// This avoids cross-origin storage issues on Safari 16.1+ and other modern browsers
export const PRODUCTION_AUTH_DOMAIN = 'moshimoshi.app'

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim(),
}

/**
 * Get the auth domain to use.
 *
 * For production (moshimoshi.app), we use the app's own domain as authDomain.
 * This works because Next.js proxies /__/auth/* requests to Firebase.
 * This avoids cross-origin storage issues on Safari 16.1+, Chrome 115+, and Firefox 109+.
 *
 * See: https://firebase.google.com/docs/auth/web/redirect-best-practices
 */
export function getEffectiveAuthDomain(): string {
  // Server-side: use configured domain
  if (typeof window === 'undefined') {
    return firebaseConfig.authDomain || DEFAULT_FIREBASE_AUTH_DOMAIN
  }

  // Client-side: check if we're on production
  const hostname = window.location.hostname

  // On production, use the app's own domain (proxied to Firebase)
  if (hostname === 'moshimoshi.app' || hostname === 'www.moshimoshi.app') {
    console.log('[Firebase Config] Production detected, using same-origin authDomain for ITP compatibility')
    return hostname
  }

  // On Vercel preview deployments, also use same-origin
  if (hostname.endsWith('.vercel.app')) {
    console.log('[Firebase Config] Vercel preview detected, using same-origin authDomain')
    return hostname
  }

  // Development or other environments: use configured domain
  return firebaseConfig.authDomain || DEFAULT_FIREBASE_AUTH_DOMAIN
}

// Validate that all required config values are present
const requiredFields = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
] as const

for (const field of requiredFields) {
  if (!firebaseConfig[field]) {
    console.error(`Missing required Firebase config field: ${field}`)
  }
}
