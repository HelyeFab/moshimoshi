/**
 * Firebase Functions for DoshiSensei Entitlements v2
 * Handles Stripe webhook events and writes subscription facts to Firestore
 * 
 * Key principle: This file ONLY writes facts, never business logic
 * The evaluator.ts handles all entitlement decisions
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
// Updated import to match new Agent 3 mapping module
import { toPlan, isValidPriceId } from './mapping/stripeMapping';
// Import the new webhook handler from Agent 1/2 work
import { stripeWebhook as webhookHandler } from './webhook';
// Import public endpoints handlers
import { createCheckoutSession as checkoutHandler, createBillingPortalSession as portalHandler } from './endpoints';

// Initialize Firebase Admin only if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Initialize Stripe with secret key from environment
const stripe = new Stripe(functions.config().stripe?.secret_key || process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil' as any,
});

// Webhook endpoint secret for validating Stripe signatures
const endpointSecret = functions.config().stripe?.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET || '';

/**
 * User document interface matching the entitlements spec
 */
interface UserDoc {
  profileVersion: 1;
  locale: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  subscription?: {
    plan: 'free' | 'premium_monthly' | 'premium_yearly';
    status: 'active' | 'incomplete' | 'past_due' | 'canceled' | 'trialing';
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    currentPeriodEnd?: admin.firestore.Timestamp;
    cancelAtPeriodEnd?: boolean;
    metadata?: {
      source: 'stripe';
      createdAt: admin.firestore.Timestamp;
      updatedAt: admin.firestore.Timestamp;
    };
  };
}

/**
 * Helper to get Firebase user by Stripe customer ID
 */
async function getUserByStripeCustomerId(customerId: string): Promise<string | null> {
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
async function updateSubscriptionFacts(
  userId: string,
  subscription: Stripe.Subscription,
  eventType: string
): Promise<void> {
  const priceId = subscription.items.data[0]?.price.id;
  const plan = toPlan(priceId) || 'free';
  
  // Map Stripe status to our status enum
  let status: 'active' | 'incomplete' | 'past_due' | 'canceled' | 'trialing' = 'active';
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
  const subscriptionFacts: UserDoc['subscription'] = {
    plan: plan === 'free' ? 'free' : plan,
    status,
    stripeCustomerId: subscription.customer as string,
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
async function removeSubscriptionFacts(userId: string, reason: string): Promise<void> {
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
export const stripeWebhook = webhookHandler;

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
  
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    res.status(401).send('Webhook signature verification failed');
    return;
  }
  
  // Handle different event types
  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
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
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
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
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`Trial ending soon for subscription ${subscription.id}`);
        // Could trigger an email notification here
        break;
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    // Acknowledge receipt of the event
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * HTTP callable function to link a Stripe customer to a Firebase user
 * Called after successful checkout session
 */
export const linkStripeCustomer = functions.https.onCall(async (data, context) => {
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
  } catch (error) {
    console.error('Error linking Stripe customer:', error);
    throw new functions.https.HttpsError('internal', 'Failed to link customer');
  }
});

/**
 * Scheduled function to check and update subscription statuses
 * Runs daily to catch any missed webhook events
 */
export const syncSubscriptionStatus = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    console.log('Starting subscription status sync');
    
    // Get all users with active subscriptions
    const snapshot = await db.collection('users')
      .where('subscription.status', '==', 'active')
      .get();
    
    let updated = 0;
    let errors = 0;
    
    for (const doc of snapshot.docs) {
      const userData = doc.data() as UserDoc;
      const subscriptionId = userData.subscription?.stripeSubscriptionId;
      
      if (!subscriptionId) continue;
      
      try {
        // Fetch current status from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        
        // Update if status changed
        if (subscription.status !== 'active') {
          await updateSubscriptionFacts(doc.id, subscription, 'sync_update');
          updated++;
        }
      } catch (error) {
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
export const createCheckoutSession = checkoutHandler;

/**
 * Legacy checkout session creator (deprecated)
 * @deprecated Use the new handler from ./endpoints.ts
 */
const legacyCreateCheckoutSession = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { priceId, successUrl, cancelUrl } = data;
  const userId = context.auth.uid;
  
  if (!priceId || !isValidPriceId(priceId)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid price ID');
  }
  
  try {
    // Get or create Stripe customer
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data() as UserDoc;
    
    let customerId = userData?.subscription?.stripeCustomerId;
    
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
      success_url: successUrl || `${functions.config().app?.url}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${functions.config().app?.url}/pricing`,
      metadata: {
        firebaseUserId: userId,
      },
    });
    
    return {
      sessionId: session.id,
      url: session.url,
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw new functions.https.HttpsError('internal', 'Failed to create checkout session');
  }
});

/**
 * Export the production-grade billing portal session creator
 */
export const createBillingPortalSession = portalHandler;

/**
 * Legacy portal session creator (deprecated)
 * @deprecated Use the new handler from ./endpoints.ts
 */
const legacyCreatePortalSession = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { returnUrl } = data;
  const userId = context.auth.uid;
  
  try {
    // Get user's Stripe customer ID
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data() as UserDoc;
    const customerId = userData?.subscription?.stripeCustomerId;
    
    if (!customerId) {
      throw new functions.https.HttpsError('not-found', 'No subscription found');
    }
    
    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${functions.config().app?.url}/account`,
    });
    
    return {
      url: session.url,
    };
  } catch (error) {
    console.error('Error creating portal session:', error);
    throw new functions.https.HttpsError('internal', 'Failed to create portal session');
  }
});

/**
 * Export helper functions for other agents to use
 */
export { 
  getUserByStripeCustomerId,
  updateSubscriptionFacts,
  removeSubscriptionFacts 
};

/**
 * Re-export handler functions for testing
 */
export * from './handlers/checkout';
export * from './handlers/subscriptions';
export * from './handlers/invoices';
export * from './mapping/stripeMapping';

/**
 * Export scheduled notification functions
 * These replace Vercel cron jobs to avoid plan limitations
 */
export * from './notifications/scheduled-notifications';