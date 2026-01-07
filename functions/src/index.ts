/**
 * Firebase Functions for DoshiSensei Entitlements v2
 * Handles Stripe webhook events and writes subscription facts to Firestore
 *
 * Key principle: This file ONLY writes facts, never business logic
 * The evaluator.ts handles all entitlement decisions
 */

import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import * as admin from 'firebase-admin'
import Stripe from 'stripe'
// Updated import to match new Agent 3 mapping module
import { toPlan, isValidPriceId } from './mapping/stripeMapping'
// Import the new webhook handler from Agent 1/2 work
import { stripeWebhook as webhookHandler } from './webhook'
// Import public endpoints handlers
import {
  createCheckoutSession as checkoutHandler,
  createBillingPortalSession as portalHandler,
} from './endpoints'
// Import scheduled leaderboard functions
import { updateLeaderboardSnapshots, updateLeaderboardManually } from './scheduled/leaderboard'
// Import onboarding helpers
import { createStarterLists } from './onboarding'

// Initialize Firebase Admin only if not already initialized
if (!admin.apps.length) {
  admin.initializeApp()
}
const db = admin.firestore()

// Define secrets for Stripe configuration
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY')
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET')

// Initialize Stripe lazily when needed
let stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(stripeSecretKey.value(), {
      apiVersion: '2025-08-27.basil' as any,
    })
  }
  return stripe
}

// Get webhook secret when needed
function getWebhookSecret(): string {
  return stripeWebhookSecret.value()
}

/**
 * User document interface matching the entitlements spec
 */
interface UserDoc {
  profileVersion: 1
  locale: string
  createdAt: admin.firestore.Timestamp
  updatedAt: admin.firestore.Timestamp
  subscription?: {
    plan: 'free' | 'premium_monthly' | 'premium_yearly'
    status: 'active' | 'incomplete' | 'past_due' | 'canceled' | 'trialing'
    stripeCustomerId?: string
    stripeSubscriptionId?: string
    stripePriceId?: string
    currentPeriodEnd?: admin.firestore.Timestamp
    cancelAtPeriodEnd?: boolean
    metadata?: {
      source: 'stripe'
      createdAt: admin.firestore.Timestamp
      updatedAt: admin.firestore.Timestamp
    }
  }
}

/**
 * Helper to get Firebase user by Stripe customer ID
 */
async function getUserByStripeCustomerId(customerId: string): Promise<string | null> {
  const snapshot = await db
    .collection('users')
    .where('subscription.stripeCustomerId', '==', customerId)
    .limit(1)
    .get()

  if (snapshot.empty) {
    console.warn(`No user found for Stripe customer ${customerId}`)
    return null
  }

  return snapshot.docs[0].id
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
  const priceId = subscription.items.data[0]?.price.id
  const plan = toPlan(priceId) || 'free'

  // Map Stripe status to our status enum
  let status: 'active' | 'incomplete' | 'past_due' | 'canceled' | 'trialing' = 'active'
  switch (subscription.status) {
    case 'active':
      status = 'active'
      break
    case 'incomplete':
    case 'incomplete_expired':
      status = 'incomplete'
      break
    case 'past_due':
      status = 'past_due'
      break
    case 'canceled':
    case 'unpaid':
      status = 'canceled'
      break
    case 'trialing':
      status = 'trialing'
      break
  }

  // Prepare subscription facts
  const subscriptionFacts: UserDoc['subscription'] = {
    plan: plan === 'free' ? 'free' : plan,
    status,
    stripeCustomerId: subscription.customer as string,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    currentPeriodEnd: (subscription as any).current_period_end
      ? admin.firestore.Timestamp.fromDate(
          new Date((subscription as any).current_period_end * 1000)
        )
      : null,
    cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
    metadata: {
      source: 'stripe',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    },
  }

  // Write facts to Firestore
  await db.collection('users').doc(userId).update({
    subscription: subscriptionFacts,
    updatedAt: admin.firestore.Timestamp.now(),
  })

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
  })

  console.log(`Updated subscription facts for user ${userId}: plan=${plan}, status=${status}`)
}

/**
 * Helper to remove subscription (for cancellations/deletions)
 */
async function removeSubscriptionFacts(userId: string, reason: string): Promise<void> {
  // Set subscription to free plan (no subscription object means free tier)
  await db
    .collection('users')
    .doc(userId)
    .update({
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
    })

  console.log(`Removed subscription for user ${userId}: reason=${reason}`)
}

/**
 * Export the main Stripe webhook handler from the dedicated webhook module
 * This replaces the inline implementation with the production-grade handler
 */
export const stripeWebhook = webhookHandler

// Legacy webhook handler removed - using new handler from ./webhook.ts

/**
 * HTTP callable function to link a Stripe customer to a Firebase user
 * Called after successful checkout session
 */
export const linkStripeCustomer = onCall(
  {
    region: 'europe-west1',
    secrets: [stripeSecretKey],
  },
  async (request: CallableRequest) => {
    // Verify user is authenticated
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated')
    }

    const { customerId, checkoutSessionId } = request.data
    const userId = request.auth.uid

    if (!customerId || !checkoutSessionId) {
      throw new HttpsError('invalid-argument', 'Missing required parameters')
    }

    try {
      // Verify the checkout session with Stripe
      const session = await getStripe().checkout.sessions.retrieve(checkoutSessionId)

      if (session.customer !== customerId) {
        throw new HttpsError('invalid-argument', 'Customer ID mismatch')
      }

      // Update user document with Stripe customer ID
      await db.collection('users').doc(userId).update({
        'subscription.stripeCustomerId': customerId,
        updatedAt: admin.firestore.Timestamp.now(),
      })

      console.log(`Linked Stripe customer ${customerId} to user ${userId}`)
      return { success: true }
    } catch (error) {
      console.error('Error linking Stripe customer:', error)
      throw new HttpsError('internal', 'Failed to link customer')
    }
  }
)

/**
 * Scheduled function to check and update subscription statuses
 * Runs daily to catch any missed webhook events
 */
export const syncSubscriptionStatus = onSchedule(
  {
    schedule: 'every 24 hours',
    timeZone: 'UTC',
    region: 'europe-west1',
    secrets: [stripeSecretKey],
  },
  async event => {
    console.log('Starting subscription status sync')

    // Get all users with active subscriptions
    const snapshot = await db.collection('users').where('subscription.status', '==', 'active').get()

    let updated = 0
    let errors = 0

    for (const doc of snapshot.docs) {
      const userData = doc.data() as UserDoc
      const subscriptionId = userData.subscription?.stripeSubscriptionId

      if (!subscriptionId) continue

      try {
        // Fetch current status from Stripe
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId)

        // Update if status changed
        if (subscription.status !== 'active') {
          await updateSubscriptionFacts(doc.id, subscription, 'sync_update')
          updated++
        }
      } catch (error) {
        console.error(`Error syncing subscription ${subscriptionId}:`, error)
        errors++
      }
    }

    console.log(`Subscription sync complete: ${updated} updated, ${errors} errors`)
    return null
  }
)

/**
 * Export the production-grade checkout session creator
 */
export const createCheckoutSession = checkoutHandler

// Legacy checkout session creator removed - using new handler from ./endpoints.ts

/**
 * Export the production-grade billing portal session creator
 */
export const createBillingPortalSession = portalHandler

// Legacy portal session creator removed - using new handler from ./endpoints.ts

/**
 * Export helper functions for other agents to use
 */
export { getUserByStripeCustomerId, updateSubscriptionFacts, removeSubscriptionFacts }

/**
 * Export leaderboard functions
 */
export { updateLeaderboardSnapshots, updateLeaderboardManually }

/**
 * Re-export handler functions for testing
 */
export * from './handlers/checkout'
export * from './handlers/subscriptions'
export * from './handlers/invoices'
export * from './mapping/stripeMapping'

/**
 * Export scheduled notification functions
 * These replace Vercel cron jobs to avoid plan limitations
 */
export * from './notifications/scheduled-notifications'

/**
 * Export scheduled news scraper functions
 * Automatically fetches news from multiple Japanese sources daily
 */
export { scheduledNewsScraperFunction, manualNewsScraperFunction } from './scheduled/newsScheduler'

/**
 * Export scheduled story generator functions
 * Generates a new AI story daily at 00:00 UTC
 */
export {
  scheduledStoryGeneratorFunction,
  manualStoryGeneratorFunction,
  dailyStoryRetryScheduler,
} from './scheduled/storyScheduler'

/**
 * Export scheduled comic generator functions
 * Generates a new "Moshi Goes to Japan" comic episode weekly on Sundays
 */
export {
  scheduledComicGeneratorFunction,
  manualComicGeneratorFunction,
} from './scheduled/comicScheduler'

/**
 * Export scheduled streak auto-break function
 * Phase 2.5: Automatically breaks streaks beyond grace period every hour
 */
export { autoBreakStreaks } from './scheduled/streakAutoBreak'

/**
 * Export content integrity checker functions
 * Runs every 6 hours to check and auto-repair missing translations, audio, etc.
 */
export {
  contentIntegrityCheckerFunction,
  manualIntegrityCheckerFunction,
} from './scheduled/contentIntegrityChecker'

/**
 * Export article audio generator functions
 * Runs 30 minutes after each news scraper to generate VOICEVOX audio for new articles
 * Schedule: 00:30, 06:30, 12:30, 18:30 JST
 */
export {
  scheduledArticleAudioGenerator,
  manualArticleAudioGenerator,
} from './scheduled/articleAudioGenerator'

/**
 * Export sentence data backfill function
 * One-time callable to pre-generate sentence audio/translations for existing content
 * Usage: Call with contentType: 'articles' | 'stories' | 'books' | 'all'
 */
export { backfillSentenceData } from './admin/backfillSentenceData'

/**
 * User Onboarding Trigger
 * Automatically creates starter lists when a new user document is created
 * Triggers on: users/{userId} onCreate
 */
export const onUserCreated = onDocumentCreated('users/{userId}', async (event) => {
  const userId = event.params.userId;
  console.log(`[onUserCreated] New user created: ${userId}`);

  // Create starter lists asynchronously
  // This won't block user creation even if it fails
  await createStarterLists(userId);
});

/**
 * Export Q&A moderation functions
 * Automatically moderates questions and answers using AI when created or updated
 * Checks for hate speech, spam, off-topic content, etc.
 */
export {
  moderateQuestion,
  moderateQuestionOnUpdate,
  moderateAnswer,
  moderateAnswerOnUpdate,
} from './qa-moderation';

/**
 * Export Q&A voting functions
 * Server-side vote counting for questions and answers
 * Automatically updates vote counts when votes are created/deleted
 */
export {
  onQuestionVoteCreated,
  onQuestionVoteDeleted,
  onAnswerVoteCreated,
  onAnswerVoteDeleted,
} from './qa-voting';
