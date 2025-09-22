"use strict";
/**
 * Stripe Checkout Session Handler
 *
 * Processes checkout.session.completed events from Stripe webhook.
 * Idempotent handler that creates user-customer mappings and updates subscription facts.
 *
 * @module handlers/checkout
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyCheckoutCompleted = applyCheckoutCompleted;
exports.isValidCheckoutSession = isValidCheckoutSession;
exports.debugCheckoutSession = debugCheckoutSession;
const stripeMapping_1 = require("../mapping/stripeMapping");
const firestore_1 = require("../firestore");
/**
 * Processes a checkout.session.completed event
 *
 * This handler:
 * 1. Extracts customer and uid information
 * 2. Creates uid <-> customer mapping if needed
 * 3. Updates user subscription facts based on the purchased plan
 *
 * @param event - The Stripe webhook event
 * @throws Error if critical data is missing (but handler above catches it)
 */
async function applyCheckoutCompleted(event) {
    var _a, _b, _c;
    const session = event.data.object;
    // Log the event with additional context
    await (0, firestore_1.logStripeEvent)(event, {
        customerId: session.customer,
    });
    // Extract customer ID (required for subscription mode)
    const customerId = session.customer;
    if (!customerId) {
        console.warn(`Checkout session ${session.id} has no customer ID`);
        return; // Non-critical, might be a one-time payment
    }
    // Extract uid from multiple possible locations
    // Priority: client_reference_id > metadata.uid > customer_details.metadata.uid
    const uid = session.client_reference_id ||
        ((_a = session.metadata) === null || _a === void 0 ? void 0 : _a.uid) ||
        ((_c = (_b = session.customer_details) === null || _b === void 0 ? void 0 : _b.metadata) === null || _c === void 0 ? void 0 : _c.uid) ||
        null;
    // Map uid to customer if we have both
    if (uid && customerId) {
        await (0, firestore_1.mapUidToCustomer)(uid, customerId);
        console.log(`Mapped uid ${uid} to customer ${customerId}`);
    }
    else {
        // Try to find existing uid mapping
        const existingUid = await (0, firestore_1.getUidByCustomerId)(customerId);
        if (!existingUid) {
            console.warn(`No uid found for customer ${customerId} in checkout`);
            // Continue anyway - subscription facts can still be stored
        }
    }
    // Handle subscription checkout
    if (session.mode === 'subscription') {
        await handleSubscriptionCheckout(session, customerId);
    }
    // Handle one-time payment checkout (future enhancement)
    if (session.mode === 'payment') {
        await handlePaymentCheckout(session, customerId);
    }
}
/**
 * Handles subscription mode checkout completion
 *
 * @param session - The checkout session
 * @param customerId - The Stripe customer ID
 */
async function handleSubscriptionCheckout(session, customerId) {
    // Extract subscription ID
    const subscriptionId = session.subscription;
    // Extract price ID from line items or metadata
    // Note: line_items might need to be expanded in the webhook configuration
    const priceId = extractPriceId(session);
    // Determine the plan
    const plan = (0, stripeMapping_1.toPlan)(priceId);
    if (!plan) {
        console.error(`Unknown price ID in checkout: ${priceId}`);
        // Fall back to a safe default rather than failing
    }
    // Prepare subscription facts
    const subscriptionFacts = {
        plan: plan || stripeMapping_1.DEFAULT_PAID_PLAN,
        status: 'active', // Checkout completion implies active
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId,
        // Period end will be set by subscription.created/updated events
        cancelAtPeriodEnd: false,
    };
    // Upsert the subscription facts
    try {
        await (0, firestore_1.upsertUserSubscriptionByCustomerId)(customerId, subscriptionFacts);
        console.log(`Updated subscription for customer ${customerId}:`, subscriptionFacts);
    }
    catch (error) {
        console.error(`Failed to update subscription for customer ${customerId}:`, error);
        throw error; // Re-throw to prevent marking as processed
    }
}
/**
 * Handles one-time payment checkout completion
 * (Placeholder for future functionality)
 *
 * @param session - The checkout session
 * @param customerId - The Stripe customer ID
 */
async function handlePaymentCheckout(session, customerId) {
    // Future: Handle one-time purchases, credits, etc.
    console.log(`Payment checkout completed for customer ${customerId}`);
    // Example: Could store purchase history, grant temporary access, etc.
    // await recordPurchase(customerId, session);
}
/**
 * Extracts price ID from various possible locations in the session
 *
 * @param session - The checkout session
 * @returns The price ID or null if not found
 */
function extractPriceId(session) {
    var _a, _b, _c, _d, _e, _f;
    // Try metadata first (most reliable if set by our code)
    if ((_a = session.metadata) === null || _a === void 0 ? void 0 : _a.price_id) {
        return session.metadata.price_id;
    }
    // Try line items if expanded
    // Note: Requires line_items expansion in webhook endpoint configuration
    const lineItems = session.line_items;
    if ((_d = (_c = (_b = lineItems === null || lineItems === void 0 ? void 0 : lineItems.data) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.price) === null || _d === void 0 ? void 0 : _d.id) {
        return lineItems.data[0].price.id;
    }
    // Try subscription_data if present
    const subscriptionData = session.subscription_data;
    if ((_f = (_e = subscriptionData === null || subscriptionData === void 0 ? void 0 : subscriptionData.items) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.price) {
        return subscriptionData.items[0].price;
    }
    // Log warning if we can't find price ID
    console.warn(`Could not extract price ID from checkout session ${session.id}`);
    return null;
}
/**
 * Validates checkout session data
 * Used for early validation and debugging
 *
 * @param session - The checkout session to validate
 * @returns true if session has minimum required data
 */
function isValidCheckoutSession(session) {
    // Must have customer for subscription mode
    if (session.mode === 'subscription' && !session.customer) {
        return false;
    }
    // Must have successful payment
    if (session.payment_status !== 'paid') {
        return false;
    }
    // Must be completed
    if (session.status !== 'complete') {
        return false;
    }
    return true;
}
/**
 * Debug helper to log session details
 *
 * @param session - The checkout session to debug
 */
function debugCheckoutSession(session) {
    var _a;
    console.log('=== Checkout Session Debug ===');
    console.log('ID:', session.id);
    console.log('Mode:', session.mode);
    console.log('Status:', session.status);
    console.log('Payment Status:', session.payment_status);
    console.log('Customer:', session.customer);
    console.log('Subscription:', session.subscription);
    console.log('Metadata:', session.metadata);
    console.log('Client Reference ID:', session.client_reference_id);
    console.log('Line Items:', (_a = session.line_items) === null || _a === void 0 ? void 0 : _a.data);
    console.log('==============================');
}
//# sourceMappingURL=checkout.js.map