"use strict";
/**
 * Stripe Webhook Receiver
 *
 * Main entry point for all Stripe webhook events.
 * Handles signature verification, deduplication, and routing to handlers.
 *
 * @module webhook
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookHealth = exports.stripeWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const stripeClient_1 = require("./stripeClient");
const firestore_1 = require("./firestore");
const checkout_1 = require("./handlers/checkout");
const subscriptions_1 = require("./handlers/subscriptions");
const invoices_1 = require("./handlers/invoices");
// Define secrets for webhook
const stripeSecretKey = (0, params_1.defineSecret)('STRIPE_SECRET_KEY');
const stripeWebhookSecret = (0, params_1.defineSecret)('STRIPE_WEBHOOK_SECRET');
/**
 * Main Stripe webhook handler
 *
 * Features:
 * - Signature verification with raw body
 * - Event deduplication
 * - Comprehensive logging
 * - Idempotent processing
 * - Proper error handling for retries
 */
exports.stripeWebhook = (0, https_1.onRequest)({
    region: 'europe-west1',
    maxInstances: 100,
    secrets: [stripeSecretKey, stripeWebhookSecret]
}, async (req, res) => {
    // Only accept POST requests
    if (req.method !== 'POST') {
        res.set('Allow', 'POST');
        res.status(405).send('Method Not Allowed');
        return;
    }
    // Get the Stripe signature header
    const sig = req.headers['stripe-signature'];
    if (!sig) {
        console.error('Missing Stripe signature header');
        res.status(400).send('Missing signature');
        return;
    }
    // Get the raw body for signature verification
    const rawBody = req.rawBody || Buffer.from('');
    if (!req.rawBody) {
        console.error('Missing request body');
        res.status(400).send('Missing body');
        return;
    }
    // Construct and verify the event
    const stripe = (0, stripeClient_1.getStripe)();
    let event;
    try {
        // Get webhook secret from environment
        const webhookSecret = stripeWebhookSecret.value();
        if (!webhookSecret) {
            console.error('Webhook secret not configured');
            res.status(500).send('Configuration error');
            return;
        }
        // Verify webhook signature
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
        console.log('Webhook signature verified successfully');
    }
    catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    // Check for duplicate processing
    try {
        if (await (0, firestore_1.wasProcessed)(event.id)) {
            console.log(`Event ${event.id} already processed, skipping`);
            res.status(200).json({
                received: true,
                duplicate: true,
                eventId: event.id
            });
            return;
        }
    }
    catch (error) {
        console.error('Error checking duplicate status:', error);
        // Continue processing even if duplicate check fails
    }
    // Log the event
    try {
        await (0, firestore_1.logStripeEvent)(event);
    }
    catch (error) {
        console.error('Error logging event:', error);
        // Continue processing even if logging fails
    }
    // Route to appropriate handler
    try {
        console.log(`Processing ${event.type} event: ${event.id}`);
        switch (event.type) {
            // Checkout events
            case 'checkout.session.completed':
                await (0, checkout_1.applyCheckoutCompleted)(event);
                break;
            // Subscription lifecycle events
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
            case 'customer.subscription.paused':
            case 'customer.subscription.resumed':
            case 'customer.subscription.pending_update_applied':
            case 'customer.subscription.pending_update_expired':
            case 'customer.subscription.trial_will_end':
                await (0, subscriptions_1.applySubscriptionEvent)(event);
                break;
            // Invoice events
            case 'invoice.created':
            case 'invoice.finalized':
            case 'invoice.paid':
            case 'invoice.payment_succeeded':
            case 'invoice.payment_failed':
            case 'invoice.payment_action_required':
            case 'invoice.upcoming':
            case 'invoice.marked_uncollectible':
            case 'invoice.voided':
                await (0, invoices_1.applyInvoiceEvent)(event);
                break;
            // Customer events (optional handling)
            case 'customer.created':
            case 'customer.updated':
            case 'customer.deleted':
                console.log(`Customer event ${event.type} received but not processed`);
                break;
            // Payment method events (optional handling)
            case 'payment_method.attached':
            case 'payment_method.detached':
            case 'payment_method.updated':
                console.log(`Payment method event ${event.type} received but not processed`);
                break;
            // Default: log but don't fail
            default:
                console.log(`Unhandled event type: ${event.type}`);
            // Don't throw - we successfully received the event
        }
        // Mark as processed after successful handling
        await (0, firestore_1.markProcessed)(event.id);
        // Return success response
        res.status(200).json({
            received: true,
            eventId: event.id,
            type: event.type,
            processed: true
        });
    }
    catch (err) {
        console.error(`Error processing ${event.type} event ${event.id}:`, err);
        // Log the error details
        await (0, firestore_1.logStripeEvent)(event, {
            error: err.message,
        });
        // Return 500 to trigger Stripe retry
        // Do NOT mark as processed so it will retry
        res.status(500).json({
            error: 'Webhook handler error',
            eventId: event.id,
            message: err.message
        });
    }
});
/**
 * Health check endpoint for webhook
 * Useful for monitoring and debugging
 */
exports.webhookHealth = (0, https_1.onRequest)({ region: 'europe-west1' }, async (req, res) => {
    if (req.method !== 'GET') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    try {
        // Check if Stripe client is initialized
        const stripe = (0, stripeClient_1.getStripe)();
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            region: 'europe-west1',
            hasStripeClient: !!stripe,
            testWebhookConfigured: true,
            prodWebhookConfigured: true,
            apiVersion: '2025-08-27.basil',
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
//# sourceMappingURL=webhook.js.map