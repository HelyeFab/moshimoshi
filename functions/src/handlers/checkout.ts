/**
 * Stripe Checkout Session Handler
 * 
 * Processes checkout.session.completed events from Stripe webhook.
 * Idempotent handler that creates user-customer mappings and updates subscription facts.
 * 
 * @module handlers/checkout
 */

import Stripe from 'stripe';
import { toPlan, DEFAULT_PAID_PLAN } from '../mapping/stripeMapping';
import {
  mapUidToCustomer,
  upsertUserSubscriptionByCustomerId,
  logStripeEvent,
  getUidByCustomerId
} from '../firestore';
// Node.js 20+ has native fetch support

/**
 * Helper to invalidate session tier cache via Next.js API
 */
async function invalidateSessionTierCache(customerId: string): Promise<void> {
  try {
    const appUrl = process.env.APP_URL || 'https://moshimoshi.vercel.app';
    const endpoint = `${appUrl}/api/auth/invalidate-tier-cache`;

    console.log(`Calling tier cache invalidation for customer ${customerId}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stripeCustomerId: customerId }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('Tier cache invalidated successfully:', result);
    } else {
      console.error('Failed to invalidate tier cache:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('Error invalidating tier cache:', error);
  }
}

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
export async function applyCheckoutCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  
  // Log the event with additional context
  await logStripeEvent(event, {
    customerId: session.customer as string | null,
  });

  // Extract customer ID (required for subscription mode)
  const customerId = session.customer as string | null;
  if (!customerId) {
    console.warn(`Checkout session ${session.id} has no customer ID`);
    return; // Non-critical, might be a one-time payment
  }

  // Extract uid from multiple possible locations
  // Priority: client_reference_id > metadata.uid > customer_details.metadata.uid
  const uid = session.client_reference_id ||
              session.metadata?.uid ||
              (session.customer_details as any)?.metadata?.uid ||
              null;

  // Map uid to customer if we have both
  if (uid && customerId) {
    await mapUidToCustomer(uid, customerId);
    console.log(`Mapped uid ${uid} to customer ${customerId}`);
  } else {
    // Try to find existing uid mapping
    const existingUid = await getUidByCustomerId(customerId);
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
async function handleSubscriptionCheckout(
  session: Stripe.Checkout.Session,
  customerId: string
): Promise<void> {
  // Extract subscription ID
  const subscriptionId = session.subscription as string | null;
  
  // Extract price ID from line items or metadata
  // Note: line_items might need to be expanded in the webhook configuration
  const priceId = extractPriceId(session);
  
  // Determine the plan
  const plan = toPlan(priceId);
  if (!plan) {
    console.error(`Unknown price ID in checkout: ${priceId}`);
    // Fall back to a safe default rather than failing
  }

  // Prepare subscription facts
  const subscriptionFacts = {
    plan: plan || DEFAULT_PAID_PLAN,
    status: 'active' as const, // Checkout completion implies active
    stripeSubscriptionId: subscriptionId,
    stripePriceId: priceId,
    // Period end will be set by subscription.created/updated events
    cancelAtPeriodEnd: false,
  };

  // Upsert the subscription facts
  try {
    await upsertUserSubscriptionByCustomerId(customerId, subscriptionFacts);
    console.log(`Updated subscription for customer ${customerId}:`, subscriptionFacts);

    // Invalidate session tier cache so user sees update immediately
    await invalidateSessionTierCache(customerId);
  } catch (error) {
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
async function handlePaymentCheckout(
  session: Stripe.Checkout.Session,
  customerId: string
): Promise<void> {
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
function extractPriceId(session: Stripe.Checkout.Session): string | null {
  // Try metadata first (most reliable if set by our code)
  if (session.metadata?.price_id) {
    return session.metadata.price_id;
  }

  // Try line items if expanded
  // Note: Requires line_items expansion in webhook endpoint configuration
  const lineItems = (session as any).line_items;
  if (lineItems?.data?.[0]?.price?.id) {
    return lineItems.data[0].price.id;
  }

  // Try subscription_data if present
  const subscriptionData = (session as any).subscription_data;
  if (subscriptionData?.items?.[0]?.price) {
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
export function isValidCheckoutSession(session: Stripe.Checkout.Session): boolean {
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
export function debugCheckoutSession(session: Stripe.Checkout.Session): void {
  console.log('=== Checkout Session Debug ===');
  console.log('ID:', session.id);
  console.log('Mode:', session.mode);
  console.log('Status:', session.status);
  console.log('Payment Status:', session.payment_status);
  console.log('Customer:', session.customer);
  console.log('Subscription:', session.subscription);
  console.log('Metadata:', session.metadata);
  console.log('Client Reference ID:', session.client_reference_id);
  console.log('Line Items:', (session as any).line_items?.data);
  console.log('==============================');
}