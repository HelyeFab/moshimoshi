/**
 * Storage Helper for Premium-Only Firebase Writes
 *
 * CRITICAL: Storage Architecture
 * - Guest users: No storage
 * - Free users: IndexedDB/LocalStorage ONLY (local)
 * - Premium users: IndexedDB + Firebase (local + cloud sync)
 *
 * Free users save data locally and it persists on their device.
 * Premium users get the additional benefit of cloud sync across devices.
 */

import { adminDb } from '@/lib/firebase/admin'
import { NextResponse } from 'next/server'
import { firebaseTracker } from '@/lib/monitoring/firebase-tracker'

export interface StorageDecision {
  shouldWriteToFirebase: boolean
  storageLocation: 'none' | 'local' | 'both'
  isPremium: boolean
  plan: string
}

/**
 * Determines storage location based on user's subscription
 * @param session - User session with uid
 * @returns Storage decision with premium status
 */
export async function getStorageDecision(session: { uid: string }): Promise<StorageDecision> {
  try {
    // Track this read operation
    await firebaseTracker.trackOperation(
      session.uid,
      'read',
      'users',
      true, // This read is allowed for all authenticated users
      'getStorageDecision'
    )

    // Get FRESH user data (never trust cached session.tier)
    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    const plan = userData?.subscription?.plan || 'free'

    // Check if user has active premium subscription
    // NOTE: Moshimoshi only has TWO valid premium plans:
    // - premium_monthly
    // - premium_yearly
    // Any references to premium_annual, premium_lifetime, etc. in tests or elsewhere
    // are outdated and should be cleaned up. This implementation is correct.
    const isPremium = (
      userData?.subscription?.status === 'active' &&
      (plan === 'premium_monthly' || plan === 'premium_yearly')
    )

    return {
      shouldWriteToFirebase: isPremium,
      storageLocation: isPremium ? 'both' : 'local',
      isPremium,
      plan
    }
  } catch (error) {
    console.error('[Storage Helper] Error checking subscription:', error)
    // Default to local storage on error
    return {
      shouldWriteToFirebase: false,
      storageLocation: 'local',
      isPremium: false,
      plan: 'free'
    }
  }
}

/**
 * Standard API response for storage operations
 * Tells the client where data was stored
 */
export function createStorageResponse(
  data: any,
  decision: StorageDecision,
  additionalInfo?: Record<string, any>
) {
  return NextResponse.json({
    success: true,
    data,
    storage: {
      location: decision.storageLocation,
      syncEnabled: decision.shouldWriteToFirebase,
      plan: decision.plan
    },
    ...additionalInfo
  })
}

/**
 * Helper to check if we should write to Firebase
 * Used in API routes before Firebase operations
 *
 * Example usage:
 * ```typescript
 * const decision = await getStorageDecision(session)
 *
 * if (decision.shouldWriteToFirebase) {
 *   // Write to Firebase for premium users
 *   await adminDb.collection('users').doc(session.uid)
 *     .collection('data').doc(id).set(data)
 * }
 *
 * // Return response indicating storage location
 * return createStorageResponse(data, decision)
 * ```
 */
export async function conditionalFirebaseWrite(
  session: { uid: string },
  writeOperation: () => Promise<void>,
  collection: string = 'unknown'
): Promise<StorageDecision> {
  const decision = await getStorageDecision(session)

  if (decision.shouldWriteToFirebase) {
    // Track the write operation for premium users
    await firebaseTracker.trackOperation(
      session.uid,
      'write',
      collection,
      true,
      'conditionalFirebaseWrite'
    )
    await writeOperation()
    console.log(`[Storage] Firebase write for premium user ${session.uid}`)
  } else {
    console.log(`[Storage] Skipping Firebase write for free user ${session.uid} - data will be stored locally`)
    // Track attempted write by free user (this should not happen if properly implemented)
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[⚠️ Storage] Free user ${session.uid} attempted Firebase write to ${collection}`)
    }
  }

  return decision
}