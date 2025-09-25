"use strict";
/**
 * Firebase Functions for DoshiSensei Entitlements v2
 * Handles Stripe webhook events and writes subscription facts to Firestore
 *
 * Key principle: This file ONLY writes facts, never business logic
 * The evaluator.ts handles all entitlement decisions
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLeaderboardManually = exports.updateLeaderboardSnapshots = exports.createBillingPortalSession = exports.createCheckoutSession = exports.syncSubscriptionStatus = exports.linkStripeCustomer = exports.stripeWebhook = void 0;
exports.getUserByStripeCustomerId = getUserByStripeCustomerId;
exports.updateSubscriptionFacts = updateSubscriptionFacts;
exports.removeSubscriptionFacts = removeSubscriptionFacts;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
// Updated import to match new Agent 3 mapping module
const stripeMapping_1 = require("./mapping/stripeMapping");
// Import the new webhook handler from Agent 1/2 work
const webhook_1 = require("./webhook");
// Import public endpoints handlers
const endpoints_1 = require("./endpoints");
// Import scheduled leaderboard functions
const leaderboard_1 = require("./scheduled/leaderboard");
Object.defineProperty(exports, "updateLeaderboardSnapshots", { enumerable: true, get: function () { return leaderboard_1.updateLeaderboardSnapshots; } });
Object.defineProperty(exports, "updateLeaderboardManually", { enumerable: true, get: function () { return leaderboard_1.updateLeaderboardManually; } });
// Initialize Firebase Admin only if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
// Initialize Stripe with secret key from environment
const stripe = new stripe_1.default(((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.secret_key) || process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-08-27.basil',
});
// Webhook endpoint secret for validating Stripe signatures
const endpointSecret = ((_b = functions.config().stripe) === null || _b === void 0 ? void 0 : _b.webhook_secret) || process.env.STRIPE_WEBHOOK_SECRET || '';
/**
 * Helper to get Firebase user by Stripe customer ID
 */
async function getUserByStripeCustomerId(customerId) {
    const snapshot = await db.collection('users')
        .where('subscription.stripeCustomerId', '==', customerId)
        .limit(1)
        .get();
    if (snapshot.empty) {
        console.warn(`No user found for Stripe customer ${customerId}`);
        return null;
    }
    return snapshot.docs[0].id;
}
/**
 * Helper to update subscription facts in user document
 * This function ONLY writes facts, no business logic
 */
async function updateSubscriptionFacts(userId, subscription, eventType) {
    var _a;
    const priceId = (_a = subscription.items.data[0]) === null || _a === void 0 ? void 0 : _a.price.id;
    const plan = (0, stripeMapping_1.toPlan)(priceId) || 'free';
    // Map Stripe status to our status enum
    let status = 'active';
    switch (subscription.status) {
        case 'active':
            status = 'active';
            break;
        case 'incomplete':
        case 'incomplete_expired':
            status = 'incomplete';
            break;
        case 'past_due':
            status = 'past_due';
            break;
        case 'canceled':
        case 'unpaid':
            status = 'canceled';
            break;
        case 'trialing':
            status = 'trialing';
            break;
    }
    // Prepare subscription facts
    const subscriptionFacts = {
        plan: plan === 'free' ? 'free' : plan,
        status,
        stripeCustomerId: subscription.customer,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        currentPeriodEnd: admin.firestore.Timestamp.fromDate(new Date(subscription.current_period_end * 1000)),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        metadata: {
            source: 'stripe',
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
        },
    };
    // Write facts to Firestore
    await db.collection('users').doc(userId).update({
        subscription: subscriptionFacts,
        updatedAt: admin.firestore.Timestamp.now(),
    });
    // Log the update for auditing
    await db.collection('logs').doc('subscription_updates').collection('events').add({
        userId,
        eventType,
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        plan,
        status,
        priceId,
        timestamp: admin.firestore.Timestamp.now(),
    });
    console.log(`Updated subscription facts for user ${userId}: plan=${plan}, status=${status}`);
}
/**
 * Helper to remove subscription (for cancellations/deletions)
 */
async function removeSubscriptionFacts(userId, reason) {
    // Set subscription to free plan (no subscription object means free tier)
    await db.collection('users').doc(userId).update({
        subscription: {
            plan: 'free',
            status: 'canceled',
            metadata: {
                source: 'stripe',
                createdAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now(),
            },
        },
        updatedAt: admin.firestore.Timestamp.now(),
    });
    console.log(`Removed subscription for user ${userId}: reason=${reason}`);
}
/**
 * Export the main Stripe webhook handler from the dedicated webhook module
 * This replaces the inline implementation with the production-grade handler
 */
exports.stripeWebhook = webhook_1.stripeWebhook;
/**
 * Legacy webhook handler (deprecated - kept for reference)
 * @deprecated Use the new webhook handler from ./webhook.ts
 */
const legacyStripeWebhook = functions.https.onRequest(async (req, res) => {
    // Only accept POST requests
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    // Get the raw body for signature verification
    const rawBody = req.rawBody;
    if (!rawBody) {
        console.error('No raw body in request');
        res.status(400).send('Bad Request: No body');
        return;
    }
    // Verify webhook signature
    const signature = req.headers['stripe-signature'];
    if (!signature || !endpointSecret) {
        console.error('Missing signature or endpoint secret');
        res.status(401).send('Unauthorized');
        return;
    }
    let event;
    try {
        event = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
    }
    catch (err) {
        console.error('Webhook signature verification failed:', err);
        res.status(401).send('Webhook signature verification failed');
        return;
    }
    // Handle different event types
    try {
        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                const customerId = subscription.customer;
                // Find user by Stripe customer ID
                const userId = await getUserByStripeCustomerId(customerId);
                if (!userId) {
                    console.error(`No user found for customer ${customerId}`);
                    res.status(404).send('User not found');
                    return;
                }
                // Update subscription facts
                await updateSubscriptionFacts(userId, subscription, event.type);
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const customerId = subscription.customer;
                // Find user by Stripe customer ID
                const userId = await getUserByStripeCustomerId(customerId);
                if (!userId) {
                    console.error(`No user found for customer ${customerId}`);
                    res.status(404).send('User not found');
                    return;
                }
                // Remove subscription facts
                await removeSubscriptionFacts(userId, 'subscription_deleted');
                break;
            }
            case 'customer.subscription.trial_will_end': {
                // Handle trial ending soon (optional: send notification)
                const subscription = event.data.object;
                console.log(`Trial ending soon for subscription ${subscription.id}`);
                // Could trigger an email notification here
                break;
            }
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
        // Acknowledge receipt of the event
        res.status(200).json({ received: true });
    }
    catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send('Internal Server Error');
    }
});
/**
 * HTTP callable function to link a Stripe customer to a Firebase user
 * Called after successful checkout session
 */
exports.linkStripeCustomer = functions.https.onCall(async (data, context) => {
    // Verify user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { customerId, checkoutSessionId } = data;
    const userId = context.auth.uid;
    if (!customerId || !checkoutSessionId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
    }
    try {
        // Verify the checkout session with Stripe
        const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
        if (session.customer !== customerId) {
            throw new functions.https.HttpsError('invalid-argument', 'Customer ID mismatch');
        }
        // Update user document with Stripe customer ID
        await db.collection('users').doc(userId).update({
            'subscription.stripeCustomerId': customerId,
            updatedAt: admin.firestore.Timestamp.now(),
        });
        console.log(`Linked Stripe customer ${customerId} to user ${userId}`);
        return { success: true };
    }
    catch (error) {
        console.error('Error linking Stripe customer:', error);
        throw new functions.https.HttpsError('internal', 'Failed to link customer');
    }
});
/**
 * Scheduled function to check and update subscription statuses
 * Runs daily to catch any missed webhook events
 */
exports.syncSubscriptionStatus = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {
    var _a;
    console.log('Starting subscription status sync');
    // Get all users with active subscriptions
    const snapshot = await db.collection('users')
        .where('subscription.status', '==', 'active')
        .get();
    let updated = 0;
    let errors = 0;
    for (const doc of snapshot.docs) {
        const userData = doc.data();
        const subscriptionId = (_a = userData.subscription) === null || _a === void 0 ? void 0 : _a.stripeSubscriptionId;
        if (!subscriptionId)
            continue;
        try {
            // Fetch current status from Stripe
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            // Update if status changed
            if (subscription.status !== 'active') {
                await updateSubscriptionFacts(doc.id, subscription, 'sync_update');
                updated++;
            }
        }
        catch (error) {
            console.error(`Error syncing subscription ${subscriptionId}:`, error);
            errors++;
        }
    }
    console.log(`Subscription sync complete: ${updated} updated, ${errors} errors`);
    return null;
});
/**
 * Export the production-grade checkout session creator
 */
exports.createCheckoutSession = endpoints_1.createCheckoutSession;
/**
 * Legacy checkout session creator (deprecated)
 * @deprecated Use the new handler from ./endpoints.ts
 */
const legacyCreateCheckoutSession = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
    // Verify user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { priceId, successUrl, cancelUrl } = data;
    const userId = context.auth.uid;
    if (!priceId || !(0, stripeMapping_1.isValidPriceId)(priceId)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid price ID');
    }
    try {
        // Get or create Stripe customer
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        let customerId = (_a = userData === null || userData === void 0 ? void 0 : userData.subscription) === null || _a === void 0 ? void 0 : _a.stripeCustomerId;
        if (!customerId) {
            // Create new Stripe customer
            const customer = await stripe.customers.create({
                metadata: {
                    firebaseUserId: userId,
                },
            });
            customerId = customer.id;
            // Save customer ID to user document
            await db.collection('users').doc(userId).update({
                'subscription.stripeCustomerId': customerId,
                updatedAt: admin.firestore.Timestamp.now(),
            });
        }
        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: successUrl || `${(_b = functions.config().app) === null || _b === void 0 ? void 0 : _b.url}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl || `${(_c = functions.config().app) === null || _c === void 0 ? void 0 : _c.url}/pricing`,
            metadata: {
                firebaseUserId: userId,
            },
        });
        return {
            sessionId: session.id,
            url: session.url,
        };
    }
    catch (error) {
        console.error('Error creating checkout session:', error);
        throw new functions.https.HttpsError('internal', 'Failed to create checkout session');
    }
});
/**
 * Export the production-grade billing portal session creator
 */
exports.createBillingPortalSession = endpoints_1.createBillingPortalSession;
/**
 * Legacy portal session creator (deprecated)
 * @deprecated Use the new handler from ./endpoints.ts
 */
const legacyCreatePortalSession = functions.https.onCall(async (data, context) => {
    var _a, _b;
    // Verify user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { returnUrl } = data;
    const userId = context.auth.uid;
    try {
        // Get user's Stripe customer ID
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        const customerId = (_a = userData === null || userData === void 0 ? void 0 : userData.subscription) === null || _a === void 0 ? void 0 : _a.stripeCustomerId;
        if (!customerId) {
            throw new functions.https.HttpsError('not-found', 'No subscription found');
        }
        // Create portal session
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl || `${(_b = functions.config().app) === null || _b === void 0 ? void 0 : _b.url}/account`,
        });
        return {
            url: session.url,
        };
    }
    catch (error) {
        console.error('Error creating portal session:', error);
        throw new functions.https.HttpsError('internal', 'Failed to create portal session');
    }
});
/**
 * Re-export handler functions for testing
 */
__exportStar(require("./handlers/checkout"), exports);
__exportStar(require("./handlers/subscriptions"), exports);
__exportStar(require("./handlers/invoices"), exports);
__exportStar(require("./mapping/stripeMapping"), exports);
/**
 * Export scheduled notification functions
 * These replace Vercel cron jobs to avoid plan limitations
 */
__exportStar(require("./notifications/scheduled-notifications"), exports);
//# sourceMappingURL=index.js.map