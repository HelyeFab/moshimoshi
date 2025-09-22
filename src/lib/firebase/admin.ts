// Server-side Firebase Admin SDK
// This file should ONLY be imported in API routes and server-side code
// Never import this in client components

import { initializeApp, getApps, cert, ServiceAccount } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

// Initialize Firebase Admin only once
function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    // Check if we have the required environment variables
    if (!process.env.FIREBASE_ADMIN_PROJECT_ID) {
      console.error('❌ Firebase Admin SDK not configured. Missing FIREBASE_ADMIN_PROJECT_ID')
      console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('FIREBASE')).join(', '))
      return null
    }

    // In production, use service account credentials
    if (process.env.FIREBASE_ADMIN_PRIVATE_KEY && process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
      try {
        const serviceAccount: ServiceAccount = {
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }

        console.log('✅ Initializing Firebase Admin with service account')
        console.log('Project ID:', process.env.FIREBASE_ADMIN_PROJECT_ID)

        const app = initializeApp({
          credential: cert(serviceAccount),
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || `${process.env.FIREBASE_ADMIN_PROJECT_ID}.appspot.com`,
        })

        console.log('✅ Firebase Admin initialized successfully')
        return app
      } catch (error) {
        console.error('❌ Failed to initialize Firebase Admin:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        throw error
      }
    }

    // In development, you can use default credentials if configured
    console.log('🔧 Initializing Firebase Admin with project ID only (limited functionality)')
    return initializeApp({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    })
  }

  return getApps()[0]
}

const adminApp = initializeFirebaseAdmin()

// If initialization failed, log the error
if (!adminApp) {
  console.error('❌ Firebase Admin App initialization returned null')
}

// Export admin services only if properly initialized
export const adminAuth = adminApp ? getAuth(adminApp) : null
export const adminFirestore = adminApp ? getFirestore(adminApp) : null
export const adminStorage = adminApp ? getStorage(adminApp) : null

// Log the initialization state
console.log('Firebase Admin initialization state:', {
  adminApp: !!adminApp,
  adminAuth: !!adminAuth,
  adminFirestore: !!adminFirestore,
  adminStorage: !!adminStorage
})

// Additional aliases for compatibility
export const auth = adminAuth
export const db = adminFirestore
export const storage = adminStorage

// Export init function for routes that need to ensure initialization
export const initAdmin = initializeFirebaseAdmin

// Stripe-related helper functions
export async function getCustomerIdByUid(uid: string): Promise<string | null> {
  if (!adminFirestore) return null;
  
  try {
    const docRef = adminFirestore
      .collection('stripe')
      .doc('byUid')
      .collection('uidToCustomer')
      .doc(uid);
    
    const doc = await docRef.get();
    return doc.exists ? doc.data()?.customerId : null;
  } catch (error) {
    console.error('Error getting customer ID:', error);
    return null;
  }
}

export async function mapUidToCustomer(uid: string, customerId: string): Promise<void> {
  if (!adminFirestore) return;
  
  const batch = adminFirestore.batch();
  
  // Map uid -> customerId
  const uidRef = adminFirestore
    .collection('stripe')
    .doc('byUid')
    .collection('uidToCustomer')
    .doc(uid);
  
  batch.set(uidRef, { customerId }, { merge: true });
  
  // Map customerId -> uid
  const customerRef = adminFirestore
    .collection('stripe')
    .doc('byCustomer')
    .collection('customerToUid')
    .doc(customerId);
  
  batch.set(customerRef, { uid }, { merge: true });
  
  await batch.commit();
}

export async function getUidByCustomerId(customerId: string): Promise<string | null> {
  if (!adminFirestore) return null;
  
  try {
    const docRef = adminFirestore
      .collection('stripe')
      .doc('byCustomer')
      .collection('customerToUid')
      .doc(customerId);
    
    const doc = await docRef.get();
    return doc.exists ? doc.data()?.uid : null;
  } catch (error) {
    console.error('Error getting UID by customer ID:', error);
    return null;
  }
}

export const adminDb = adminFirestore

// Helper function to verify admin app is initialized
export function ensureAdminInitialized() {
  if (!adminApp) {
    console.error('❌ Firebase Admin SDK is not initialized')
    console.error('adminApp:', adminApp)
    console.error('adminAuth:', adminAuth)
    console.error('Environment check:')
    console.error('  FIREBASE_ADMIN_PROJECT_ID:', !!process.env.FIREBASE_ADMIN_PROJECT_ID)
    console.error('  FIREBASE_ADMIN_CLIENT_EMAIL:', !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL)
    console.error('  FIREBASE_ADMIN_PRIVATE_KEY exists:', !!process.env.FIREBASE_ADMIN_PRIVATE_KEY)
    throw new Error('Firebase Admin SDK is not initialized. Please configure your service account credentials.')
  }
  console.log('✅ Firebase Admin SDK is properly initialized')
  return true
}

// Helper function to verify ID tokens
export async function verifyIdToken(token: string) {
  if (!adminAuth) {
    throw new Error('Firebase Admin Auth is not initialized')
  }
  
  try {
    const decodedToken = await adminAuth.verifyIdToken(token)
    return decodedToken
  } catch (error) {
    console.error('Error verifying ID token:', error)
    throw new Error('Invalid authentication token')
  }
}

// Helper function to set custom claims (for admin users)
export async function setAdminClaim(uid: string, isAdmin: boolean = true) {
  if (!adminAuth) {
    throw new Error('Firebase Admin Auth is not initialized')
  }
  
  try {
    await adminAuth.setCustomUserClaims(uid, { admin: isAdmin })
    return { success: true }
  } catch (error) {
    console.error('Error setting admin claim:', error)
    throw new Error('Failed to set admin claim')
  }
}

// User document type for DoshiSensei Entitlements v2
export interface UserDoc {
  profileVersion: 1
  locale: string
  createdAt: FirebaseFirestore.Timestamp
  updatedAt: FirebaseFirestore.Timestamp
  subscription?: {
    plan: 'free' | 'premium_monthly' | 'premium_yearly'
    status: 'active' | 'incomplete' | 'past_due' | 'canceled' | 'trialing'
    stripeCustomerId?: string
    stripeSubscriptionId?: string
    stripePriceId?: string
    currentPeriodEnd?: FirebaseFirestore.Timestamp
    cancelAtPeriodEnd?: boolean
    metadata?: {
      source: 'stripe'
      createdAt: FirebaseFirestore.Timestamp
      updatedAt: FirebaseFirestore.Timestamp
    }
  }
}

// Helper function to get user subscription plan
export async function getUserSubscriptionPlan(uid: string): Promise<'guest' | 'free' | 'premium_monthly' | 'premium_yearly'> {
  if (!adminFirestore) {
    throw new Error('Firebase Admin Firestore is not initialized')
  }
  
  try {
    const userDoc = await adminFirestore.collection('users').doc(uid).get()
    
    if (!userDoc.exists) {
      // User doesn't exist in database, treat as guest
      return 'guest'
    }
    
    const userData = userDoc.data() as UserDoc
    
    // Check subscription status
    if (!userData.subscription) {
      return 'free'
    }
    
    // Only return premium plans if subscription is active or trialing
    if (userData.subscription.status === 'active' || userData.subscription.status === 'trialing') {
      return userData.subscription.plan
    }
    
    // Any other status means free tier
    return 'free'
  } catch (error) {
    console.error('Error getting user subscription plan:', error)
    // Default to guest on error
    return 'guest'
  }
}

// Helper function to create or update user profile
export async function ensureUserProfile(uid: string, email?: string | null): Promise<void> {
  if (!adminFirestore) {
    throw new Error('Firebase Admin Firestore is not initialized')
  }

  try {
    const userRef = adminFirestore.collection('users').doc(uid)
    const userDoc = await userRef.get()

    if (!userDoc.exists) {
      // Create new user profile with complete default schema
      const newUser: any = {
        // Core fields
        profileVersion: 1,
        locale: 'en',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),

        // Subscription - default to free tier
        subscription: {
          plan: 'free',
          status: 'active',
          metadata: {
            source: 'auth', // Initial auth, not Stripe
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          }
        },

        // Profile data - identity only, no gamification
        profile: {
          displayName: email?.split('@')[0] || 'User',
          avatarUrl: null
        },

        // Default preferences (consistent across all auth methods)
        preferences: {
          language: 'en',
          theme: 'dark',  // Default to dark theme as per your recent changes
          dailyGoalMinutes: 10,  // Default daily goal
          notifications: {
            email: true,
            push: false
          }
        },

        // User state
        userState: 'active'
      }

      // Add email if provided
      if (email) {
        newUser.email = email
        newUser.emailVerified = false  // Will be updated by auth method
      }

      await userRef.set(newUser)
      console.log(`Created new user profile for ${uid} with complete default schema`)
    }
  } catch (error) {
    console.error('Error ensuring user profile:', error)
    throw new Error('Failed to ensure user profile')
  }
}

// Helper function to get user's daily usage for a feature
export async function getUserDailyUsage(uid: string, featureId: string, date?: Date): Promise<number> {
  if (!adminFirestore) {
    throw new Error('Firebase Admin Firestore is not initialized')
  }
  
  try {
    // Use provided date or current date
    const targetDate = date || new Date()
    const dateStr = targetDate.toISOString().split('T')[0] // YYYY-MM-DD format
    
    // Get usage document
    const usageDoc = await adminFirestore
      .collection('usage')
      .doc(uid)
      .collection('daily')
      .doc(dateStr)
      .get()
    
    if (!usageDoc.exists) {
      return 0
    }
    
    const usage = usageDoc.data()
    return usage?.[featureId] || 0
  } catch (error) {
    console.error('Error getting user daily usage:', error)
    return 0
  }
}

/**
 * Set custom claims for admin users
 * This enables Firebase security rules to check admin status
 */
export async function setAdminClaims(uid: string, isAdmin: boolean = false) {
  try {
    ensureAdminInitialized()
    
    console.log(`[Firebase Admin] Setting admin claims for ${uid}: ${isAdmin}`)
    
    // Set custom user claims
    await adminAuth!.setCustomUserClaims(uid, { 
      admin: isAdmin,
      // Keep track of when admin was granted
      adminGrantedAt: isAdmin ? new Date().toISOString() : null
    })
    
    console.log(`[Firebase Admin] Successfully set admin claims for ${uid}`)
    
    // Also update the user profile to keep track
    if (adminFirestore) {
      await adminFirestore.collection('users').doc(uid).update({
        isAdmin,
        adminUpdatedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })
    }
    
    return true
  } catch (error) {
    console.error('Error setting admin claims:', error)
    // Don't throw - this is not critical for auth to work
    return false
  }
}


/**
 * Check if a user is an admin based on Firebase data
 * This is the primary method for checking admin status
 * @param uid - The user ID to check
 * @returns Promise<boolean> - True if user is admin, false otherwise
 */
export async function isAdminUser(uid: string): Promise<boolean> {
  if (!uid) {
    return false
  }

  try {
    ensureAdminInitialized()

    // Check Firebase user document for isAdmin field
    const userDoc = await adminFirestore!.collection('users').doc(uid).get()

    if (!userDoc.exists) {
      console.warn(`[Admin Check] User document not found for uid: ${uid}`)
      return false
    }

    const userData = userDoc.data()
    const isAdmin = userData?.isAdmin === true

    // Log admin check for audit purposes (without exposing sensitive data)
    if (isAdmin) {
      console.log(`[Admin Check] Admin access verified for user: ${uid.substring(0, 8)}...`)
    }

    return isAdmin
  } catch (error) {
    console.error('[Admin Check] Error checking admin status:', error)
    return false
  }
}

/**
 * Get admin user data with caching for performance
 * Use this for repeated admin checks in the same request
 */
const adminCache = new Map<string, { isAdmin: boolean; timestamp: number }>()
const ADMIN_CACHE_TTL = 60000 // 1 minute cache

export async function isAdminUserCached(uid: string): Promise<boolean> {
  const cached = adminCache.get(uid)

  if (cached && (Date.now() - cached.timestamp) < ADMIN_CACHE_TTL) {
    return cached.isAdmin
  }

  const isAdmin = await isAdminUser(uid)
  adminCache.set(uid, { isAdmin, timestamp: Date.now() })

  // Clean up old cache entries
  if (adminCache.size > 100) {
    const oldestKey = adminCache.keys().next().value
    if (oldestKey) adminCache.delete(oldestKey)
  }

  return isAdmin
}