/**
 * Firestore Helpers for Stripe Integration
 * Agent 2: Production-Grade, Zero-Surprises Implementation
 * 
 * Provides idempotency, logging, mapping, and fact management
 * for Stripe webhook processing and subscription management.
 */

import { getFirestore, Timestamp, FieldValue, DocumentReference } from 'firebase-admin/firestore';
import type { Firestore, WriteBatch, Transaction } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if needed
if (!admin.apps.length) {
  admin.initializeApp();
}

// Initialize Firestore
const db: Firestore = getFirestore();

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type SubscriptionPlan = 'free' | 'premium_monthly' | 'premium_yearly';
export type SubscriptionStatus = 'active' | 'incomplete' | 'past_due' | 'canceled' | 'trialing' | 'unpaid' | 'incomplete_expired';

export interface UserSubscriptionFacts {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  currentPeriodEnd?: Timestamp;
  currentPeriodStart?: Timestamp;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Timestamp | null;
  trialEnd?: Timestamp | null;
  metadata?: {
    source: 'stripe';
    updatedAt: Timestamp;
    updateEventId?: string;
  };
}

export interface UserDoc {
  profileVersion: 1;
  locale: string;
  email?: string;
  displayName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  subscription?: UserSubscriptionFacts;
}

export interface StripeEventLog {
  ts: Timestamp;
  eventId: string;
  type: string;
  requestId: string | null;
  livemode: boolean;
  uid?: string | null;
  customerId?: string | null;
  objectId?: string | null;
  payloadSummary?: Record<string, any>;
  processing: {
    deduped: boolean;
    applied: boolean;
    error: string | null;
    processingTimeMs?: number;
  };
}

export interface ProcessedEvent {
  ts: Timestamp;
  processedAt: Timestamp;
  ttl?: Timestamp; // For automatic cleanup
}

export interface CustomerMapping {
  customerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UidMapping {
  uid: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// IDEMPOTENCY MANAGEMENT
// ============================================================================

/**
 * Check if a Stripe event has already been processed
 */
export async function wasProcessed(eventId: string): Promise<boolean> {
  const ref = db.collection('ops').doc('stripe')
    .collection('processed_events').doc(eventId);
  const snap = await ref.get();
  return snap.exists;
}

/**
 * Mark a Stripe event as processed to prevent reprocessing
 */
export async function markProcessed(eventId: string): Promise<void> {
  const ref = db.collection('ops').doc('stripe')
    .collection('processed_events').doc(eventId);
  
  const ttl = Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days TTL
  
  const data: ProcessedEvent = {
    ts: Timestamp.now(),
    processedAt: Timestamp.now(),
    ttl
  };
  
  await ref.set(data, { merge: true });
}

/**
 * Batch mark multiple events as processed
 */
export async function batchMarkProcessed(eventIds: string[]): Promise<void> {
  const batch = db.batch();
  const ttl = Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  for (const eventId of eventIds) {
    const ref = db.collection('ops').doc('stripe')
      .collection('processed_events').doc(eventId);
    
    const data: ProcessedEvent = {
      ts: Timestamp.now(),
      processedAt: Timestamp.now(),
      ttl
    };
    
    batch.set(ref, data, { merge: true });
  }
  
  await batch.commit();
}

// ============================================================================
// EVENT LOGGING
// ============================================================================

/**
 * Log a Stripe event for audit and debugging
 */
export async function logStripeEvent(
  event: Stripe.Event,
  extra?: {
    uid?: string | null;
    customerId?: string | null;
    processingTimeMs?: number;
    error?: string | null;
  }
): Promise<void> {
  const ref = db.collection('logs').doc('stripe')
    .collection('events').doc();
  
  const payloadObject = event.data.object as any;
  
  const logEntry: StripeEventLog = {
    ts: Timestamp.now(),
    eventId: event.id,
    type: event.type,
    requestId: (event.request as any)?.id ?? null,
    livemode: event.livemode ?? false,
    uid: extra?.uid ?? null,
    customerId: extra?.customerId ?? payloadObject?.customer ?? null,
    objectId: payloadObject?.id ?? null,
    payloadSummary: {
      status: payloadObject?.status || null,
      priceId: payloadObject?.price?.id ?? payloadObject?.items?.data?.[0]?.price?.id ?? null,
      amount: payloadObject?.amount_paid ?? payloadObject?.amount ?? null,
      currency: payloadObject?.currency || null,
    },
    processing: {
      deduped: false,
      applied: !extra?.error,
      error: extra?.error ?? null,
      processingTimeMs: extra?.processingTimeMs ?? null,
    }
  };
  
  await ref.set(logEntry);
}

/**
 * Log a deduped event (already processed)
 */
export async function logDedupedEvent(event: Stripe.Event): Promise<void> {
  const ref = db.collection('logs').doc('stripe')
    .collection('events').doc();
  
  const logEntry: StripeEventLog = {
    ts: Timestamp.now(),
    eventId: event.id,
    type: event.type,
    requestId: (event.request as any)?.id ?? null,
    livemode: event.livemode ?? false,
    processing: {
      deduped: true,
      applied: false,
      error: null
    }
  };
  
  await ref.set(logEntry);
}

// ============================================================================
// CUSTOMER-UID MAPPING
// ============================================================================

/**
 * Create bidirectional mapping between Firebase UID and Stripe Customer ID
 */
export async function mapUidToCustomer(
  uid: string,
  customerId: string
): Promise<void> {
  const batch = db.batch();
  const now = Timestamp.now();
  
  // uid -> customerId mapping
  const uidRef = db.collection('stripe').doc('byUid')
    .collection('uidToCustomer').doc(uid);
  const uidMapping: CustomerMapping = {
    customerId,
    createdAt: now,
    updatedAt: now
  };
  batch.set(uidRef, uidMapping, { merge: true });
  
  // customerId -> uid mapping
  const customerRef = db.collection('stripe').doc('byCustomer')
    .collection('customerToUid').doc(customerId);
  const customerMapping: UidMapping = {
    uid,
    createdAt: now,
    updatedAt: now
  };
  batch.set(customerRef, customerMapping, { merge: true });
  
  await batch.commit();
}

/**
 * Get Stripe Customer ID by Firebase UID
 */
export async function getCustomerIdByUid(uid: string): Promise<string | null> {
  const ref = db.collection('stripe').doc('byUid')
    .collection('uidToCustomer').doc(uid);
  const snap = await ref.get();
  
  if (!snap.exists) return null;
  
  const data = snap.data() as CustomerMapping;
  return data.customerId;
}

/**
 * Get Firebase UID by Stripe Customer ID
 */
export async function getUidByCustomerId(customerId: string): Promise<string | null> {
  const ref = db.collection('stripe').doc('byCustomer')
    .collection('customerToUid').doc(customerId);
  const snap = await ref.get();
  
  if (!snap.exists) return null;
  
  const data = snap.data() as UidMapping;
  return data.uid;
}

/**
 * Check if a customer mapping exists
 */
export async function hasCustomerMapping(customerId: string): Promise<boolean> {
  const uid = await getUidByCustomerId(customerId);
  return uid !== null;
}

// ============================================================================
// USER SUBSCRIPTION FACTS MANAGEMENT
// ============================================================================

/**
 * Upsert user subscription facts by Customer ID
 * This is the main function handlers use to update subscription state
 */
export async function upsertUserSubscriptionByCustomerId(
  customerId: string,
  facts: Partial<{
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    currentPeriodEnd: number | null; // epoch seconds
    currentPeriodStart: number | null; // epoch seconds
    cancelAtPeriodEnd: boolean | null;
    canceledAt: number | null; // epoch seconds
    trialEnd: number | null; // epoch seconds
    eventId: string | null;
  }>
): Promise<void> {
  // Get the UID for this customer
  const uid = await getUidByCustomerId(customerId);
  if (!uid) {
    throw new Error(`No uid mapped for customer ${customerId}`);
  }
  
  await upsertUserSubscriptionByUid(uid, customerId, facts);
}

/**
 * Upsert user subscription facts by Firebase UID
 */
export async function upsertUserSubscriptionByUid(
  uid: string,
  customerId: string,
  facts: Partial<{
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    currentPeriodEnd: number | null;
    currentPeriodStart: number | null;
    cancelAtPeriodEnd: boolean | null;
    canceledAt: number | null;
    trialEnd: number | null;
    eventId: string | null;
  }>
): Promise<void> {
  const userRef = db.collection('users').doc(uid);
  
  // Build the subscription data object
  const subscriptionData: any = {
    stripeCustomerId: customerId,
    metadata: {
      source: 'stripe',
      updatedAt: Timestamp.now(),
    }
  };
  
  // Add event ID to metadata if provided
  if (facts.eventId) {
    subscriptionData.metadata.updateEventId = facts.eventId;
  }
  
  // Map all provided facts
  if (facts.plan !== undefined) {
    subscriptionData.plan = facts.plan;
  }
  
  if (facts.status !== undefined) {
    subscriptionData.status = facts.status;
  }
  
  if (facts.stripeSubscriptionId !== undefined) {
    subscriptionData.stripeSubscriptionId = facts.stripeSubscriptionId;
  }
  
  if (facts.stripePriceId !== undefined) {
    subscriptionData.stripePriceId = facts.stripePriceId;
  }
  
  if (facts.currentPeriodEnd !== undefined && facts.currentPeriodEnd !== null) {
    subscriptionData.currentPeriodEnd = Timestamp.fromMillis(facts.currentPeriodEnd * 1000);
  }
  
  if (facts.currentPeriodStart !== undefined && facts.currentPeriodStart !== null) {
    subscriptionData.currentPeriodStart = Timestamp.fromMillis(facts.currentPeriodStart * 1000);
  }
  
  if (facts.cancelAtPeriodEnd !== undefined) {
    subscriptionData.cancelAtPeriodEnd = facts.cancelAtPeriodEnd;
  }
  
  if (facts.canceledAt !== undefined) {
    subscriptionData.canceledAt = facts.canceledAt 
      ? Timestamp.fromMillis(facts.canceledAt * 1000)
      : null;
  }
  
  if (facts.trialEnd !== undefined) {
    subscriptionData.trialEnd = facts.trialEnd
      ? Timestamp.fromMillis(facts.trialEnd * 1000)
      : null;
  }
  
  // Use merge to preserve other user fields
  await userRef.set(
    {
      subscription: subscriptionData,
      updatedAt: Timestamp.now()
    },
    { merge: true }
  );
}

/**
 * Clear subscription facts (for subscription deletion)
 */
export async function clearUserSubscription(uid: string): Promise<void> {
  const userRef = db.collection('users').doc(uid);
  
  await userRef.update({
    subscription: {
      plan: 'free',
      status: 'canceled',
      stripeCustomerId: FieldValue.delete(),
      stripeSubscriptionId: FieldValue.delete(),
      stripePriceId: FieldValue.delete(),
      currentPeriodEnd: FieldValue.delete(),
      currentPeriodStart: FieldValue.delete(),
      cancelAtPeriodEnd: FieldValue.delete(),
      canceledAt: Timestamp.now(),
      trialEnd: FieldValue.delete(),
      metadata: {
        source: 'stripe',
        updatedAt: Timestamp.now()
      }
    },
    updatedAt: Timestamp.now()
  });
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Batch update multiple user subscriptions
 */
export async function batchUpdateSubscriptions(
  updates: Array<{
    customerId: string;
    facts: Parameters<typeof upsertUserSubscriptionByCustomerId>[1];
  }>
): Promise<void> {
  // Process in batches of 500 (Firestore limit)
  const batchSize = 500;
  
  for (let i = 0; i < updates.length; i += batchSize) {
    const batchUpdates = updates.slice(i, i + batchSize);
    const batch = db.batch();
    
    for (const update of batchUpdates) {
      const uid = await getUidByCustomerId(update.customerId);
      if (!uid) continue;
      
      const userRef = db.collection('users').doc(uid);
      const subscriptionData = buildSubscriptionData(update.customerId, update.facts);
      
      batch.set(
        userRef,
        {
          subscription: subscriptionData,
          updatedAt: Timestamp.now()
        },
        { merge: true }
      );
    }
    
    await batch.commit();
  }
}

/**
 * Helper to build subscription data object
 */
function buildSubscriptionData(
  customerId: string,
  facts: Parameters<typeof upsertUserSubscriptionByCustomerId>[1]
): any {
  const data: any = {
    stripeCustomerId: customerId,
    metadata: {
      source: 'stripe',
      updatedAt: Timestamp.now(),
    }
  };
  
  if (facts.eventId) {
    data.metadata.updateEventId = facts.eventId;
  }
  
  if (facts.plan !== undefined) data.plan = facts.plan;
  if (facts.status !== undefined) data.status = facts.status;
  if (facts.stripeSubscriptionId !== undefined) data.stripeSubscriptionId = facts.stripeSubscriptionId;
  if (facts.stripePriceId !== undefined) data.stripePriceId = facts.stripePriceId;
  
  if (facts.currentPeriodEnd !== undefined && facts.currentPeriodEnd !== null) {
    data.currentPeriodEnd = Timestamp.fromMillis(facts.currentPeriodEnd * 1000);
  }
  
  if (facts.currentPeriodStart !== undefined && facts.currentPeriodStart !== null) {
    data.currentPeriodStart = Timestamp.fromMillis(facts.currentPeriodStart * 1000);
  }
  
  if (facts.cancelAtPeriodEnd !== undefined) data.cancelAtPeriodEnd = facts.cancelAtPeriodEnd;
  
  if (facts.canceledAt !== undefined) {
    data.canceledAt = facts.canceledAt 
      ? Timestamp.fromMillis(facts.canceledAt * 1000)
      : null;
  }
  
  if (facts.trialEnd !== undefined) {
    data.trialEnd = facts.trialEnd
      ? Timestamp.fromMillis(facts.trialEnd * 1000)
      : null;
  }
  
  return data;
}

// ============================================================================
// TRANSACTION HELPERS
// ============================================================================

/**
 * Run a transaction with retry logic
 */
export async function runTransaction<T>(
  fn: (transaction: Transaction) => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await db.runTransaction(fn);
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on non-retryable errors
      if (error instanceof Error && 
          (error.message.includes('NOT_FOUND') || 
           error.message.includes('PERMISSION_DENIED'))) {
        throw error;
      }
      
      if (attempt < maxAttempts) {
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, attempt) * 100)
        );
      }
    }
  }
  
  throw lastError;
}

/**
 * Atomically update subscription with verification
 */
export async function atomicSubscriptionUpdate(
  uid: string,
  customerId: string,
  updater: (current: UserSubscriptionFacts | undefined) => UserSubscriptionFacts
): Promise<void> {
  await runTransaction(async (transaction) => {
    const userRef = db.collection('users').doc(uid);
    const doc = await transaction.get(userRef);
    
    const currentData = doc.data() as UserDoc | undefined;
    const currentSubscription = currentData?.subscription;
    
    const newSubscription = updater(currentSubscription);
    
    transaction.set(
      userRef,
      {
        subscription: {
          ...newSubscription,
          stripeCustomerId: customerId,
          metadata: {
            source: 'stripe',
            updatedAt: Timestamp.now()
          }
        },
        updatedAt: Timestamp.now()
      },
      { merge: true }
    );
  });
}

// ============================================================================
// CLEANUP & MAINTENANCE
// ============================================================================

/**
 * Clean up old processed events (TTL-based)
 */
export async function cleanupOldProcessedEvents(daysToKeep: number = 30): Promise<number> {
  const cutoffDate = Timestamp.fromMillis(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  
  const query = db.collection('ops').doc('stripe')
    .collection('processed_events')
    .where('ts', '<', cutoffDate)
    .limit(500); // Process in batches
  
  let totalDeleted = 0;
  let hasMore = true;
  
  while (hasMore) {
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      hasMore = false;
      break;
    }
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    totalDeleted += snapshot.size;
    
    // If we got a full batch, there might be more
    hasMore = snapshot.size === 500;
  }
  
  return totalDeleted;
}

/**
 * Clean up old event logs
 */
export async function cleanupOldEventLogs(daysToKeep: number = 90): Promise<number> {
  const cutoffDate = Timestamp.fromMillis(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  
  const query = db.collection('logs').doc('stripe')
    .collection('events')
    .where('ts', '<', cutoffDate)
    .limit(500);
  
  let totalDeleted = 0;
  let hasMore = true;
  
  while (hasMore) {
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      hasMore = false;
      break;
    }
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    totalDeleted += snapshot.size;
    
    hasMore = snapshot.size === 500;
  }
  
  return totalDeleted;
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Get user subscription facts
 */
export async function getUserSubscription(uid: string): Promise<UserSubscriptionFacts | null> {
  const userRef = db.collection('users').doc(uid);
  const doc = await userRef.get();
  
  if (!doc.exists) return null;
  
  const data = doc.data() as UserDoc;
  return data.subscription ?? null;
}

/**
 * Get recent Stripe events for a user
 */
export async function getRecentUserEvents(
  uid: string,
  limit: number = 10
): Promise<StripeEventLog[]> {
  const query = db.collection('logs').doc('stripe')
    .collection('events')
    .where('uid', '==', uid)
    .orderBy('ts', 'desc')
    .limit(limit);
  
  const snapshot = await query.get();
  
  return snapshot.docs.map(doc => doc.data() as StripeEventLog);
}

/**
 * Get recent Stripe events by type
 */
export async function getEventsByType(
  eventType: string,
  limit: number = 20
): Promise<StripeEventLog[]> {
  const query = db.collection('logs').doc('stripe')
    .collection('events')
    .where('type', '==', eventType)
    .orderBy('ts', 'desc')
    .limit(limit);
  
  const snapshot = await query.get();
  
  return snapshot.docs.map(doc => doc.data() as StripeEventLog);
}

/**
 * Check subscription health
 */
export async function checkSubscriptionHealth(uid: string): Promise<{
  hasSubscription: boolean;
  isActive: boolean;
  daysUntilRenewal: number | null;
  willCancel: boolean;
}> {
  const subscription = await getUserSubscription(uid);
  
  if (!subscription) {
    return {
      hasSubscription: false,
      isActive: false,
      daysUntilRenewal: null,
      willCancel: false
    };
  }
  
  const isActive = subscription.status === 'active' || subscription.status === 'trialing';
  const willCancel = subscription.cancelAtPeriodEnd ?? false;
  
  let daysUntilRenewal: number | null = null;
  if (subscription.currentPeriodEnd) {
    const endTime = subscription.currentPeriodEnd.toMillis();
    const now = Date.now();
    daysUntilRenewal = Math.floor((endTime - now) / (1000 * 60 * 60 * 24));
  }
  
  return {
    hasSubscription: true,
    isActive,
    daysUntilRenewal,
    willCancel
  };
}

// ============================================================================
// EXPORT SUMMARY
// ============================================================================

/**
 * Agent 2 Firestore Helpers Summary:
 * 
 * Idempotency:
 * - wasProcessed() - Check if event was already processed
 * - markProcessed() - Mark event as processed
 * - batchMarkProcessed() - Mark multiple events
 * 
 * Logging:
 * - logStripeEvent() - Log event for audit
 * - logDedupedEvent() - Log deduped event
 * 
 * Mapping:
 * - mapUidToCustomer() - Create bidirectional mapping
 * - getCustomerIdByUid() - Get customer from uid
 * - getUidByCustomerId() - Get uid from customer
 * - hasCustomerMapping() - Check if mapping exists
 * 
 * Facts Management:
 * - upsertUserSubscriptionByCustomerId() - Main upsert function
 * - upsertUserSubscriptionByUid() - Upsert by uid
 * - clearUserSubscription() - Clear subscription
 * 
 * Batch Operations:
 * - batchUpdateSubscriptions() - Update multiple subscriptions
 * 
 * Transactions:
 * - runTransaction() - Transaction with retry
 * - atomicSubscriptionUpdate() - Atomic update with verification
 * 
 * Cleanup:
 * - cleanupOldProcessedEvents() - Remove old processed events
 * - cleanupOldEventLogs() - Remove old logs
 * 
 * Queries:
 * - getUserSubscription() - Get user subscription
 * - getRecentUserEvents() - Get user's recent events
 * - getEventsByType() - Get events by type
 * - checkSubscriptionHealth() - Check subscription status
 */