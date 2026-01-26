// Shared Firebase client config (no initialization side effects)

// Default Firebase domain (fallback if custom domain is missing)
export const DEFAULT_FIREBASE_AUTH_DOMAIN = 'moshimoshi-de237.firebaseapp.com'

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
 * Prefer the configured custom domain when available.
 */
export function getEffectiveAuthDomain(): string {
  // Server-side: use configured domain
  if (typeof window === 'undefined') {
    return firebaseConfig.authDomain || DEFAULT_FIREBASE_AUTH_DOMAIN
  }

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
