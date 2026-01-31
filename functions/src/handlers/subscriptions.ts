/**
 * Stripe Subscription Event Handler
 * 
 * Processes customer.subscription.* events from Stripe webhook.
 * Handles created, updated, and deleted subscription events idempotently.
 * 
 * @module handlers/subscriptions
 */

import Stripe from 'stripe';
import { getFirestore } from 'firebase-admin/firestore';
import { toPlan, DEFAULT_PAID_PLAN } from '../mapping/stripeMapping';
import {
  upsertUserSubscriptionByCustomerId,
  logStripeEvent,
  getUidByCustomerId
} from '../firestore';
import { sendSubscriptionAlert } from '../utils/alertNotifier';
// Node.js 20+ has native fetch support

const db = getFirestore();

/**
 * Helper to invalidate ALL user caches via Next.js API
 * Comprehensive cache invalidation ensures users see updated subscription immediately
 *
 * Invalidates:
 * - Tier cache (60s TTL)
 * - Session cache (1hr TTL)
 * - Stats cache (1hr TTL)
 * - Queue cache (30min TTL)
 * - Entitlements cache (10min TTL)
 * - Profile cache (15min TTL)
 *
 * @param customerId - Stripe customer ID
 * @param reason - Why cache is being invalidated (for audit logs)
 */
async function invalidateAllUserCaches(
  customerId: string,
  reason: string = 'stripe_webhook'
): Promise<void> {
  const maxRetries = 3
  const retryDelay = 1000 // 1 second
  const appUrl = process.env.APP_URL || 'https://moshimoshi.vercel.app'
  const endpoint = `${appUrl}/api/auth/invalidate-all-caches`

  console.log(`[Webhook] Invalidating ALL caches for customer ${customerId}, reason: ${reason}`)

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stripeCustomerId: customerId,
          reason: reason
        }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log(`[Webhook] ✅ Cache invalidation successful (attempt ${attempt + 1}/${maxRetries}):`, {
          cachesClearedCount: result.cachesClearedCount,
          cacheTypes: result.cacheTypes,
          userId: result.userId
        })
        return // Success - exit retry loop
      } else {
        const errorText = await response.text()
        console.error(`[Webhook] ❌ Cache invalidation failed (attempt ${attempt + 1}/${maxRetries}):`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        })

        // If this is the last attempt, log final failure
        if (attempt === maxRetries - 1) {
          console.error(`[Webhook] ⚠️  Cache invalidation failed after ${maxRetries} attempts`)
          console.error(`[Webhook] User may experience cache staleness for up to 1 hour`)
          console.error(`[Webhook] Client polling will eventually sync correct tier from Firestore`)
          return // Don't fail webhook, just log error
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
      }
    } catch (error) {
      console.error(`[Webhook] ❌ Cache invalidation error (attempt ${attempt + 1}/${maxRetries}):`, error)

      if (attempt === maxRetries - 1) {
        console.error(`[Webhook] ⚠️  Cache invalidation failed after ${maxRetries} attempts due to errors`)
        return // Don't fail webhook
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
    }
  }
}

/**
 * Main subscription event handler
 * Routes to specific handlers based on event type
 *
 * @param event - The Stripe webhook event
 */
export async function applySubscriptionEvent(
  event: Stripe.Event,
  resendApiKey?: string
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  
  // Log the event with subscription details
  await logStripeEvent(event, {
    customerId: subscription.customer as string,
  });

  // Validate we have a customer ID
  const customerId = subscription.customer as string;
  if (!customerId) {
    console.error(`Subscription ${subscription.id} has no customer ID`);
    throw new Error('Missing customer ID in subscription');
  }

  // Check if we have a user mapping
  const uid = await getUidByCustomerId(customerId);
  if (!uid) {
    console.warn(`No user mapped for customer ${customerId}, will retry later`);
    // Don't throw - the mapping might be created by checkout.completed
    // The subscription.updated event will retry and find the mapping
  }

  // Route to specific handler based on event type
  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(subscription, customerId, resendApiKey);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(subscription, customerId, resendApiKey, event.data.previous_attributes);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(subscription, customerId, resendApiKey);
      break;
    default:
      console.warn(`Unhandled subscription event type: ${event.type}`);
  }
}

/**
 * Handles subscription created events
 * 
 * @param subscription - The Stripe subscription object
 * @param customerId - The Stripe customer ID
 */
async function handleSubscriptionCreated(
  subscription: Stripe.Subscription,
  customerId: string,
  resendApiKey?: string
): Promise<void> {
  console.log(`Processing subscription.created for ${subscription.id}`);
  
  // Extract subscription details
  const facts = extractSubscriptionFacts(subscription);
  
  // Upsert the subscription facts
  try {
    await upsertUserSubscriptionByCustomerId(customerId, facts);
    console.log(`Created subscription for customer ${customerId}:`, facts);

    // Invalidate ALL user caches so user sees update immediately
    await invalidateAllUserCaches(customerId, 'stripe_subscription_created');

    // Send subscription alert (non-blocking)
    await sendSubscriptionLifecycleAlert(
      resendApiKey,
      'subscribed',
      subscription,
      customerId,
      facts
    );
  } catch (error) {
    console.error(`Failed to create subscription for customer ${customerId}:`, error);
    throw error;
  }
}

/**
 * Handles subscription updated events
 * Most common event - fired for any subscription change
 * 
 * @param subscription - The Stripe subscription object
 * @param customerId - The Stripe customer ID
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  customerId: string,
  resendApiKey?: string,
  previousAttributes?: Stripe.Event.Data.PreviousAttributes
): Promise<void> {
  console.log(`Processing subscription.updated for ${subscription.id}`);
  
  // Extract subscription details
  const facts = extractSubscriptionFacts(subscription);
  
  // Special handling for specific status transitions
  if (subscription.status === 'canceled') {
    console.log(`Subscription ${subscription.id} was canceled`);
    // The status will be updated to 'canceled'
  } else if (subscription.status === 'past_due') {
    console.warn(`Subscription ${subscription.id} is past due`);
    // Could trigger email notifications here
  }
  
  // Upsert the subscription facts
  try {
    await upsertUserSubscriptionByCustomerId(customerId, facts);
    console.log(`Updated subscription for customer ${customerId}:`, facts);

    // Invalidate ALL user caches so user sees update immediately
    await invalidateAllUserCaches(customerId, 'stripe_subscription_updated');

    // Optional unsubscribe alert if status transitioned to canceled
    const prevStatus = (previousAttributes as any)?.status;
    if (prevStatus !== 'canceled' && subscription.status === 'canceled') {
      await sendSubscriptionLifecycleAlert(
        resendApiKey,
        'unsubscribed',
        subscription,
        customerId,
        facts
      );
    }
  } catch (error) {
    console.error(`Failed to update subscription for customer ${customerId}:`, error);
    throw error;
  }
}

/**
 * Handles subscription deleted events
 * Fired when a subscription is permanently deleted (not just canceled)
 * 
 * @param subscription - The Stripe subscription object
 * @param customerId - The Stripe customer ID
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  customerId: string,
  resendApiKey?: string
): Promise<void> {
  console.log(`Processing subscription.deleted for ${subscription.id}`);
  
  // Set user to free plan
  const facts = {
    plan: 'free' as const,
    status: 'canceled' as const,
    stripeSubscriptionId: null,
    stripePriceId: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  };
  
  try {
    await upsertUserSubscriptionByCustomerId(customerId, facts);
    console.log(`Deleted subscription for customer ${customerId}, reverted to free plan`);

    // Invalidate ALL user caches so user sees update immediately (critical for security)
    await invalidateAllUserCaches(customerId, 'stripe_subscription_deleted');

    // Send unsubscribe alert (non-blocking)
    await sendSubscriptionLifecycleAlert(
      resendApiKey,
      'unsubscribed',
      subscription,
      customerId,
      facts
    );
  } catch (error) {
    console.error(`Failed to delete subscription for customer ${customerId}:`, error);
    throw error;
  }
}

async function getUserIdentityByCustomerId(customerId: string): Promise<{
  uid: string | null
  email: string | null
  name: string | null
}> {
  try {
    const uid = await getUidByCustomerId(customerId);
    if (!uid) return { uid: null, email: null, name: null };

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return { uid, email: null, name: null };

    const data = userDoc.data() || {};
    return {
      uid,
      email: data.email || null,
      name: data.displayName || null
    };
  } catch (error) {
    console.error(`Failed to resolve user identity for customer ${customerId}:`, error);
    return { uid: null, email: null, name: null };
  }
}

async function sendSubscriptionLifecycleAlert(
  resendApiKey: string | undefined,
  action: 'subscribed' | 'unsubscribed',
  subscription: Stripe.Subscription,
  customerId: string,
  facts: ReturnType<typeof extractSubscriptionFacts>
): Promise<void> {
  if (!resendApiKey) return;

  try {
    const identity = await getUserIdentityByCustomerId(customerId);
    await sendSubscriptionAlert(resendApiKey, action, {
      uid: identity.uid,
      name: identity.name,
      email: identity.email,
      plan: facts.plan,
      status: facts.status,
      customerId,
      subscriptionId: subscription.id,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false
    });
  } catch (error) {
    console.error(`[Webhook] Failed to send subscription ${action} alert:`, error);
  }
}

/**
 * Extracts subscription facts from a Stripe subscription object
 * 
 * @param subscription - The Stripe subscription
 * @returns Normalized subscription facts
 */
function extractSubscriptionFacts(subscription: Stripe.Subscription): any {
  // Get the first item (we only support single-item subscriptions)
  const item = subscription.items.data[0];
  if (!item) {
    console.error(`Subscription ${subscription.id} has no items`);
    throw new Error('Subscription has no items');
  }
  
  // Extract price ID
  const priceId = item.price?.id ?? null;
  
  // Determine the plan
  const plan = toPlan(priceId);
  if (!plan && subscription.status === 'active') {
    console.error(`Unknown price ID in subscription: ${priceId}`);
    // Use a safe default for active subscriptions
  }
  
  // Normalize the status
  const normalizedStatus = normalizeSubscriptionStatus(subscription.status);
  
  // Get current_period_end from the subscription item (it's not at root level)
  const currentPeriodEnd = (item as any).current_period_end || (subscription as any).current_period_end || null;

  return {
    plan: plan || DEFAULT_PAID_PLAN,
    status: normalizedStatus,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    currentPeriodEnd: currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    // Additional metadata
    trialEnd: subscription.trial_end,
    canceledAt: subscription.canceled_at,
    endedAt: subscription.ended_at,
  };
}

/**
 * Normalizes Stripe subscription status to our internal status type
 * 
 * @param stripeStatus - The Stripe subscription status
 * @returns Normalized status
 */
function normalizeSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status
): 'active' | 'incomplete' | 'past_due' | 'canceled' | 'trialing' {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'incomplete':
    case 'incomplete_expired':
      return 'incomplete';
    case 'trialing':
      return 'trialing';
    case 'canceled':
    case 'unpaid':
      return 'canceled';
    case 'paused': // Stripe's newer pause feature
      return 'past_due'; // Treat as past_due for entitlements
    default:
      console.warn(`Unknown Stripe subscription status: ${stripeStatus}`);
      return 'canceled'; // Safe default
  }
}

/**
 * Checks if a subscription is considered active for entitlements
 * 
 * @param subscription - The Stripe subscription
 * @returns true if the subscription grants access
 */
export function isSubscriptionActive(subscription: Stripe.Subscription): boolean {
  const activeStatuses: Stripe.Subscription.Status[] = [
    'active',
    'trialing',
    // 'past_due', // Debatable - could allow grace period
  ];
  
  return activeStatuses.includes(subscription.status);
}

/**
 * Calculates days until subscription ends
 * 
 * @param subscription - The Stripe subscription
 * @returns Number of days until end, or null if no end date
 */
export function daysUntilSubscriptionEnd(subscription: Stripe.Subscription): number | null {
  const currentPeriodEnd = (subscription as any).current_period_end;
  if (!currentPeriodEnd) return null;

  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  const secondsUntilEnd = currentPeriodEnd - now;
  const daysUntilEnd = Math.ceil(secondsUntilEnd / (60 * 60 * 24));
  
  return daysUntilEnd > 0 ? daysUntilEnd : 0;
}

/**
 * Debug helper to log subscription details
 * 
 * @param subscription - The subscription to debug
 */
export function debugSubscription(subscription: Stripe.Subscription): void {
  console.log('=== Subscription Debug ===');
  console.log('ID:', subscription.id);
  console.log('Customer:', subscription.customer);
  console.log('Status:', subscription.status);
  console.log('Items:', subscription.items.data.map(i => ({
    id: i.id,
    price: i.price.id,
    quantity: i.quantity,
  })));
  console.log('Current Period End:', new Date((subscription as any).current_period_end * 1000));
  console.log('Cancel at Period End:', subscription.cancel_at_period_end);
  console.log('Trial End:', subscription.trial_end ? new Date(subscription.trial_end * 1000) : null);
  console.log('Canceled At:', subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null);
  console.log('==========================');
}
