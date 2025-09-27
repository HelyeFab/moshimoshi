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
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLeaderboardManually = exports.updateLeaderboardSnapshots = exports.createBillingPortalSession = exports.createCheckoutSession = exports.syncSubscriptionStatus = exports.linkStripeCustomer = exports.stripeWebhook = void 0;
exports.getUserByStripeCustomerId = getUserByStripeCustomerId;
exports.updateSubscriptionFacts = updateSubscriptionFacts;
exports.removeSubscriptionFacts = removeSubscriptionFacts;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
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
// Define secrets for Stripe configuration
const stripeSecretKey = (0, params_1.defineSecret)('STRIPE_SECRET_KEY');
const stripeWebhookSecret = (0, params_1.defineSecret)('STRIPE_WEBHOOK_SECRET');
// Initialize Stripe lazily when needed
let stripe = null;
function getStripe() {
    if (!stripe) {
        stripe = new stripe_1.default(stripeSecretKey.value(), {
            apiVersion: '2025-08-27.basil',
        });
    }
    return stripe;
}
// Get webhook secret when needed
function getWebhookSecret() {
    return stripeWebhookSecret.value();
}
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
        currentPeriodEnd: subscription.current_period_end ? admin.firestore.Timestamp.fromDate(new Date(subscription.current_period_end * 1000)) : null,
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
// Legacy webhook handler removed - using new handler from ./webhook.ts
/**
 * HTTP callable function to link a Stripe customer to a Firebase user
 * Called after successful checkout session
 */
exports.linkStripeCustomer = (0, https_1.onCall)({
    region: 'europe-west1',
    secrets: [stripeSecretKey]
}, async (request) => {
    // Verify user is authenticated
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { customerId, checkoutSessionId } = request.data;
    const userId = request.auth.uid;
    if (!customerId || !checkoutSessionId) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required parameters');
    }
    try {
        // Verify the checkout session with Stripe
        const session = await getStripe().checkout.sessions.retrieve(checkoutSessionId);
        if (session.customer !== customerId) {
            throw new https_1.HttpsError('invalid-argument', 'Customer ID mismatch');
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
        throw new https_1.HttpsError('internal', 'Failed to link customer');
    }
});
/**
 * Scheduled function to check and update subscription statuses
 * Runs daily to catch any missed webhook events
 */
exports.syncSubscriptionStatus = (0, scheduler_1.onSchedule)({
    schedule: 'every 24 hours',
    timeZone: 'UTC',
    region: 'europe-west1',
    secrets: [stripeSecretKey]
}, async (event) => {
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
            const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
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
// Legacy checkout session creator removed - using new handler from ./endpoints.ts
/**
 * Export the production-grade billing portal session creator
 */
exports.createBillingPortalSession = endpoints_1.createBillingPortalSession;
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