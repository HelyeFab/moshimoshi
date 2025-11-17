"use strict";
/**
 * Firestore Helpers for Stripe Integration
 * Agent 2: Production-Grade, Zero-Surprises Implementation
 *
 * Provides idempotency, logging, mapping, and fact management
 * for Stripe webhook processing and subscription management.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.wasProcessed = wasProcessed;
exports.markProcessed = markProcessed;
exports.batchMarkProcessed = batchMarkProcessed;
exports.logStripeEvent = logStripeEvent;
exports.logDedupedEvent = logDedupedEvent;
exports.mapUidToCustomer = mapUidToCustomer;
exports.getCustomerIdByUid = getCustomerIdByUid;
exports.getUidByCustomerId = getUidByCustomerId;
exports.hasCustomerMapping = hasCustomerMapping;
exports.upsertUserSubscriptionByCustomerId = upsertUserSubscriptionByCustomerId;
exports.upsertUserSubscriptionByUid = upsertUserSubscriptionByUid;
exports.clearUserSubscription = clearUserSubscription;
exports.batchUpdateSubscriptions = batchUpdateSubscriptions;
exports.runTransaction = runTransaction;
exports.atomicSubscriptionUpdate = atomicSubscriptionUpdate;
exports.cleanupOldProcessedEvents = cleanupOldProcessedEvents;
exports.cleanupOldEventLogs = cleanupOldEventLogs;
exports.getUserSubscription = getUserSubscription;
exports.getRecentUserEvents = getRecentUserEvents;
exports.getEventsByType = getEventsByType;
exports.checkSubscriptionHealth = checkSubscriptionHealth;
const firestore_1 = require("firebase-admin/firestore");
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin if needed
if (!admin.apps.length) {
    admin.initializeApp();
}
// Initialize Firestore
const db = (0, firestore_1.getFirestore)();
// ============================================================================
// IDEMPOTENCY MANAGEMENT
// ============================================================================
/**
 * Check if a Stripe event has already been processed
 */
async function wasProcessed(eventId) {
    const ref = db.collection('ops').doc('stripe')
        .collection('processed_events').doc(eventId);
    const snap = await ref.get();
    return snap.exists;
}
/**
 * Mark a Stripe event as processed to prevent reprocessing
 */
async function markProcessed(eventId) {
    const ref = db.collection('ops').doc('stripe')
        .collection('processed_events').doc(eventId);
    const ttl = firestore_1.Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days TTL
    const data = {
        ts: firestore_1.Timestamp.now(),
        processedAt: firestore_1.Timestamp.now(),
        ttl
    };
    await ref.set(data, { merge: true });
}
/**
 * Batch mark multiple events as processed
 */
async function batchMarkProcessed(eventIds) {
    const batch = db.batch();
    const ttl = firestore_1.Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000);
    for (const eventId of eventIds) {
        const ref = db.collection('ops').doc('stripe')
            .collection('processed_events').doc(eventId);
        const data = {
            ts: firestore_1.Timestamp.now(),
            processedAt: firestore_1.Timestamp.now(),
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
async function logStripeEvent(event, extra) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    const ref = db.collection('logs').doc('stripe')
        .collection('events').doc();
    const payloadObject = event.data.object;
    const logEntry = {
        ts: firestore_1.Timestamp.now(),
        eventId: event.id,
        type: event.type,
        requestId: (_b = (_a = event.request) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null,
        livemode: (_c = event.livemode) !== null && _c !== void 0 ? _c : false,
        uid: (_d = extra === null || extra === void 0 ? void 0 : extra.uid) !== null && _d !== void 0 ? _d : null,
        customerId: (_f = (_e = extra === null || extra === void 0 ? void 0 : extra.customerId) !== null && _e !== void 0 ? _e : payloadObject === null || payloadObject === void 0 ? void 0 : payloadObject.customer) !== null && _f !== void 0 ? _f : null,
        objectId: (_g = payloadObject === null || payloadObject === void 0 ? void 0 : payloadObject.id) !== null && _g !== void 0 ? _g : null,
        payloadSummary: {
            status: (payloadObject === null || payloadObject === void 0 ? void 0 : payloadObject.status) || null,
            priceId: (_p = (_j = (_h = payloadObject === null || payloadObject === void 0 ? void 0 : payloadObject.price) === null || _h === void 0 ? void 0 : _h.id) !== null && _j !== void 0 ? _j : (_o = (_m = (_l = (_k = payloadObject === null || payloadObject === void 0 ? void 0 : payloadObject.items) === null || _k === void 0 ? void 0 : _k.data) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.price) === null || _o === void 0 ? void 0 : _o.id) !== null && _p !== void 0 ? _p : null,
            amount: (_r = (_q = payloadObject === null || payloadObject === void 0 ? void 0 : payloadObject.amount_paid) !== null && _q !== void 0 ? _q : payloadObject === null || payloadObject === void 0 ? void 0 : payloadObject.amount) !== null && _r !== void 0 ? _r : null,
            currency: (payloadObject === null || payloadObject === void 0 ? void 0 : payloadObject.currency) || null,
        },
        processing: {
            deduped: false,
            applied: !(extra === null || extra === void 0 ? void 0 : extra.error),
            error: (_s = extra === null || extra === void 0 ? void 0 : extra.error) !== null && _s !== void 0 ? _s : null,
            processingTimeMs: (_t = extra === null || extra === void 0 ? void 0 : extra.processingTimeMs) !== null && _t !== void 0 ? _t : null,
        }
    };
    await ref.set(logEntry);
}
/**
 * Log a deduped event (already processed)
 */
async function logDedupedEvent(event) {
    var _a, _b, _c;
    const ref = db.collection('logs').doc('stripe')
        .collection('events').doc();
    const logEntry = {
        ts: firestore_1.Timestamp.now(),
        eventId: event.id,
        type: event.type,
        requestId: (_b = (_a = event.request) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null,
        livemode: (_c = event.livemode) !== null && _c !== void 0 ? _c : false,
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
async function mapUidToCustomer(uid, customerId) {
    const batch = db.batch();
    const now = firestore_1.Timestamp.now();
    // uid -> customerId mapping
    const uidRef = db.collection('stripe').doc('byUid')
        .collection('uidToCustomer').doc(uid);
    const uidMapping = {
        customerId,
        createdAt: now,
        updatedAt: now
    };
    batch.set(uidRef, uidMapping, { merge: true });
    // customerId -> uid mapping
    const customerRef = db.collection('stripe').doc('byCustomer')
        .collection('customerToUid').doc(customerId);
    const customerMapping = {
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
async function getCustomerIdByUid(uid) {
    const ref = db.collection('stripe').doc('byUid')
        .collection('uidToCustomer').doc(uid);
    const snap = await ref.get();
    if (!snap.exists)
        return null;
    const data = snap.data();
    return data.customerId;
}
/**
 * Get Firebase UID by Stripe Customer ID
 */
async function getUidByCustomerId(customerId) {
    const ref = db.collection('stripe').doc('byCustomer')
        .collection('customerToUid').doc(customerId);
    const snap = await ref.get();
    if (!snap.exists)
        return null;
    const data = snap.data();
    return data.uid;
}
/**
 * Check if a customer mapping exists
 */
async function hasCustomerMapping(customerId) {
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
async function upsertUserSubscriptionByCustomerId(customerId, facts) {
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
async function upsertUserSubscriptionByUid(uid, customerId, facts) {
    const userRef = db.collection('users').doc(uid);
    // Build the subscription data object
    const subscriptionData = {
        stripeCustomerId: customerId,
        metadata: {
            source: 'stripe',
            updatedAt: firestore_1.Timestamp.now(),
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
        subscriptionData.currentPeriodEnd = firestore_1.Timestamp.fromMillis(facts.currentPeriodEnd * 1000);
    }
    if (facts.currentPeriodStart !== undefined && facts.currentPeriodStart !== null) {
        subscriptionData.currentPeriodStart = firestore_1.Timestamp.fromMillis(facts.currentPeriodStart * 1000);
    }
    if (facts.cancelAtPeriodEnd !== undefined) {
        subscriptionData.cancelAtPeriodEnd = facts.cancelAtPeriodEnd;
    }
    if (facts.canceledAt !== undefined) {
        subscriptionData.canceledAt = facts.canceledAt
            ? firestore_1.Timestamp.fromMillis(facts.canceledAt * 1000)
            : null;
    }
    if (facts.trialEnd !== undefined) {
        subscriptionData.trialEnd = facts.trialEnd
            ? firestore_1.Timestamp.fromMillis(facts.trialEnd * 1000)
            : null;
    }
    // Use merge to preserve other user fields
    await userRef.set({
        subscription: subscriptionData,
        updatedAt: firestore_1.Timestamp.now()
    }, { merge: true });
}
/**
 * Clear subscription facts (for subscription deletion)
 */
async function clearUserSubscription(uid) {
    const userRef = db.collection('users').doc(uid);
    await userRef.update({
        subscription: {
            plan: 'free',
            status: 'canceled',
            stripeCustomerId: firestore_1.FieldValue.delete(),
            stripeSubscriptionId: firestore_1.FieldValue.delete(),
            stripePriceId: firestore_1.FieldValue.delete(),
            currentPeriodEnd: firestore_1.FieldValue.delete(),
            currentPeriodStart: firestore_1.FieldValue.delete(),
            cancelAtPeriodEnd: firestore_1.FieldValue.delete(),
            canceledAt: firestore_1.Timestamp.now(),
            trialEnd: firestore_1.FieldValue.delete(),
            metadata: {
                source: 'stripe',
                updatedAt: firestore_1.Timestamp.now()
            }
        },
        updatedAt: firestore_1.Timestamp.now()
    });
}
// ============================================================================
// BATCH OPERATIONS
// ============================================================================
/**
 * Batch update multiple user subscriptions
 */
async function batchUpdateSubscriptions(updates) {
    // Process in batches of 500 (Firestore limit)
    const batchSize = 500;
    for (let i = 0; i < updates.length; i += batchSize) {
        const batchUpdates = updates.slice(i, i + batchSize);
        const batch = db.batch();
        for (const update of batchUpdates) {
            const uid = await getUidByCustomerId(update.customerId);
            if (!uid)
                continue;
            const userRef = db.collection('users').doc(uid);
            const subscriptionData = buildSubscriptionData(update.customerId, update.facts);
            batch.set(userRef, {
                subscription: subscriptionData,
                updatedAt: firestore_1.Timestamp.now()
            }, { merge: true });
        }
        await batch.commit();
    }
}
/**
 * Helper to build subscription data object
 */
function buildSubscriptionData(customerId, facts) {
    const data = {
        stripeCustomerId: customerId,
        metadata: {
            source: 'stripe',
            updatedAt: firestore_1.Timestamp.now(),
        }
    };
    if (facts.eventId) {
        data.metadata.updateEventId = facts.eventId;
    }
    if (facts.plan !== undefined)
        data.plan = facts.plan;
    if (facts.status !== undefined)
        data.status = facts.status;
    if (facts.stripeSubscriptionId !== undefined)
        data.stripeSubscriptionId = facts.stripeSubscriptionId;
    if (facts.stripePriceId !== undefined)
        data.stripePriceId = facts.stripePriceId;
    if (facts.currentPeriodEnd !== undefined && facts.currentPeriodEnd !== null) {
        data.currentPeriodEnd = firestore_1.Timestamp.fromMillis(facts.currentPeriodEnd * 1000);
    }
    if (facts.currentPeriodStart !== undefined && facts.currentPeriodStart !== null) {
        data.currentPeriodStart = firestore_1.Timestamp.fromMillis(facts.currentPeriodStart * 1000);
    }
    if (facts.cancelAtPeriodEnd !== undefined)
        data.cancelAtPeriodEnd = facts.cancelAtPeriodEnd;
    if (facts.canceledAt !== undefined) {
        data.canceledAt = facts.canceledAt
            ? firestore_1.Timestamp.fromMillis(facts.canceledAt * 1000)
            : null;
    }
    if (facts.trialEnd !== undefined) {
        data.trialEnd = facts.trialEnd
            ? firestore_1.Timestamp.fromMillis(facts.trialEnd * 1000)
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
async function runTransaction(fn, maxAttempts = 3) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await db.runTransaction(fn);
        }
        catch (error) {
            lastError = error;
            // Don't retry on non-retryable errors
            if (error instanceof Error &&
                (error.message.includes('NOT_FOUND') ||
                    error.message.includes('PERMISSION_DENIED'))) {
                throw error;
            }
            if (attempt < maxAttempts) {
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
            }
        }
    }
    throw lastError;
}
/**
 * Atomically update subscription with verification
 */
async function atomicSubscriptionUpdate(uid, customerId, updater) {
    await runTransaction(async (transaction) => {
        const userRef = db.collection('users').doc(uid);
        const doc = await transaction.get(userRef);
        const currentData = doc.data();
        const currentSubscription = currentData === null || currentData === void 0 ? void 0 : currentData.subscription;
        const newSubscription = updater(currentSubscription);
        transaction.set(userRef, {
            subscription: Object.assign(Object.assign({}, newSubscription), { stripeCustomerId: customerId, metadata: {
                    source: 'stripe',
                    updatedAt: firestore_1.Timestamp.now()
                } }),
            updatedAt: firestore_1.Timestamp.now()
        }, { merge: true });
    });
}
// ============================================================================
// CLEANUP & MAINTENANCE
// ============================================================================
/**
 * Clean up old processed events (TTL-based)
 */
async function cleanupOldProcessedEvents(daysToKeep = 30) {
    const cutoffDate = firestore_1.Timestamp.fromMillis(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
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
async function cleanupOldEventLogs(daysToKeep = 90) {
    const cutoffDate = firestore_1.Timestamp.fromMillis(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
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
async function getUserSubscription(uid) {
    var _a;
    const userRef = db.collection('users').doc(uid);
    const doc = await userRef.get();
    if (!doc.exists)
        return null;
    const data = doc.data();
    return (_a = data.subscription) !== null && _a !== void 0 ? _a : null;
}
/**
 * Get recent Stripe events for a user
 */
async function getRecentUserEvents(uid, limit = 10) {
    const query = db.collection('logs').doc('stripe')
        .collection('events')
        .where('uid', '==', uid)
        .orderBy('ts', 'desc')
        .limit(limit);
    const snapshot = await query.get();
    return snapshot.docs.map(doc => doc.data());
}
/**
 * Get recent Stripe events by type
 */
async function getEventsByType(eventType, limit = 20) {
    const query = db.collection('logs').doc('stripe')
        .collection('events')
        .where('type', '==', eventType)
        .orderBy('ts', 'desc')
        .limit(limit);
    const snapshot = await query.get();
    return snapshot.docs.map(doc => doc.data());
}
/**
 * Check subscription health
 */
async function checkSubscriptionHealth(uid) {
    var _a;
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
    const willCancel = (_a = subscription.cancelAtPeriodEnd) !== null && _a !== void 0 ? _a : false;
    let daysUntilRenewal = null;
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
//# sourceMappingURL=firestore.js.map