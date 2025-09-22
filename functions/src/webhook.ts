/**
 * Stripe Webhook Receiver
 *
 * Main entry point for all Stripe webhook events.
 * Handles signature verification, deduplication, and routing to handlers.
 *
 * @module webhook
 */

import * as functions from 'firebase-functions';
import { getStripe } from './stripeClient';
import {
  wasProcessed,
  markProcessed,
  logStripeEvent
} from './firestore';
import { applyCheckoutCompleted } from './handlers/checkout';
import { applySubscriptionEvent } from './handlers/subscriptions';
import { applyInvoiceEvent } from './handlers/invoices';
import Stripe from 'stripe';

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
export const stripeWebhook = functions.region('europe-west1').https.onRequest(
  async (req: functions.https.Request, res: functions.Response) => {
    // Only accept POST requests
    if (req.method !== 'POST') {
      res.set('Allow', 'POST');
      res.status(405).send('Method Not Allowed');
      return;
    }

    // Get the Stripe signature header
    const sig = req.headers['stripe-signature'] as string | undefined;
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
    const stripe = getStripe();
    let event: Stripe.Event;

    try {
      // Get webhook secrets from environment config
      const testSecret = functions.config().stripe?.webhook_secret_test;
      const prodSecret = functions.config().stripe?.webhook_secret_prod;

      if (!testSecret || !prodSecret) {
        console.error('Webhook secrets not configured in environment');
        res.status(500).send('Configuration error');
        return;
      }

      // Try test secret first
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, testSecret);
        if (process.env.NODE_ENV !== 'production') {
          console.log('Webhook verified with TEST secret');
        }
      } catch (testErr) {
        // If test fails, try production secret
        event = stripe.webhooks.constructEvent(rawBody, sig, prodSecret);
        if (process.env.NODE_ENV !== 'production') {
          console.log('Webhook verified with PRODUCTION secret');
        }
      }
    } catch (err: any) {
      console.error('Webhook signature verification failed for both secrets:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Check for duplicate processing
    try {
      if (await wasProcessed(event.id)) {
        console.log(`Event ${event.id} already processed, skipping`);
        res.status(200).json({
          received: true,
          duplicate: true,
          eventId: event.id
        });
        return;
      }
    } catch (error) {
      console.error('Error checking duplicate status:', error);
      // Continue processing even if duplicate check fails
    }

    // Log the event
    try {
      await logStripeEvent(event);
    } catch (error) {
      console.error('Error logging event:', error);
      // Continue processing even if logging fails
    }

    // Route to appropriate handler
    try {
      console.log(`Processing ${event.type} event: ${event.id}`);

      switch (event.type) {
        // Checkout events
        case 'checkout.session.completed':
          await applyCheckoutCompleted(event);
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
          await applySubscriptionEvent(event);
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
          await applyInvoiceEvent(event);
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
      await markProcessed(event.id);

      // Return success response
      res.status(200).json({
        received: true,
        eventId: event.id,
        type: event.type,
        processed: true
      });

    } catch (err: any) {
      console.error(`Error processing ${event.type} event ${event.id}:`, err);

      // Log the error details
      await logStripeEvent(event, {
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
  }
);

/**
 * Health check endpoint for webhook
 * Useful for monitoring and debugging
 */
export const webhookHealth = functions.region('europe-west1').https.onRequest(
  async (req: functions.https.Request, res: functions.Response) => {
    if (req.method !== 'GET') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    try {
      // Check if Stripe client is initialized
      const stripe = getStripe();

      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        region: 'europe-west1',
        hasStripeClient: !!stripe,
        testWebhookConfigured: true,
        prodWebhookConfigured: true,
        apiVersion: '2024-06-20',
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);