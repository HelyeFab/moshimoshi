import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminFirestore } from '@/lib/firebase/admin';
import { toPlan } from '@/lib/stripe/mapping';
import { getInvoiceFooter } from '@/lib/stripe/invoice-messages';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil' as any,
});

export async function POST(request: NextRequest) {
  console.log('[Webhook] ========== WEBHOOK REQUEST RECEIVED ==========');

  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    // Use TEST secret in development, PROD secret in production
    const webhookSecret = process.env.NODE_ENV === 'production'
      ? process.env.STRIPE_WEBHOOK_SECRET
      : (process.env.STRIPE_WEBHOOK_SECRET_TEST || process.env.STRIPE_WEBHOOK_SECRET);

    if (!webhookSecret) {
      console.error('[Webhook] No webhook secret configured');
      return NextResponse.json(
        { error: 'Webhook configuration error' },
        { status: 500 }
      );
    }

    event = stripe.webhooks.constructEvent(
      body,
      sig,
      webhookSecret
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  console.log(`[Webhook] Event type: ${event.type}`);
  console.log(`[Webhook] Event ID: ${event.id}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('[Webhook] Processing checkout.session.completed:', session.id);
        console.log('[Webhook] Session metadata:', JSON.stringify(session.metadata, null, 2));
        console.log('[Webhook] Session mode:', session.mode);
        console.log('[Webhook] Session subscription ID:', session.subscription);

        if (session.mode === 'subscription' && session.subscription) {
          // Get the subscription details
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );

          // Try to get user ID from session metadata first
          let userId: string | null = null;

          // Check if we have uid in metadata
          if (session.metadata?.uid) {
            userId = session.metadata.uid;
            console.log(`[Webhook] Found user ID in metadata: ${userId}`);
          } else {
            // Fallback to email lookup
            const customer = await stripe.customers.retrieve(
              subscription.customer as string
            );

            const customerEmail = (customer as Stripe.Customer).email;

            if (!customerEmail) {
              console.error('[Webhook] No customer email found and no uid in metadata');
              break;
            }

            // Find user by email
            const usersSnapshot = await adminFirestore
              .collection('users')
              .where('email', '==', customerEmail)
              .limit(1)
              .get();

            if (usersSnapshot.empty) {
              console.error(`[Webhook] No user found with email: ${customerEmail}`);
              break;
            }

            const userDoc = usersSnapshot.docs[0];
            userId = userDoc.id;
            console.log(`[Webhook] Found user ID by email: ${userId}`);
          }

          // Get the plan from price ID
          const priceId = subscription.items.data[0]?.price.id;
          const plan = toPlan(priceId) || 'premium_monthly';

          console.log(`[Webhook] About to update user ${userId} with plan: ${plan}`);

          // Update user subscription
          const updateData = {
            subscription: {
              plan,
              status: subscription.status,
              stripeCustomerId: subscription.customer,
              stripeSubscriptionId: subscription.id,
              stripePriceId: priceId,
              currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              metadata: {
                source: 'stripe',
                updatedAt: new Date()
              }
            },
            stripeCustomerId: subscription.customer,
            updatedAt: new Date()
          };

          console.log('[Webhook] Update data:', JSON.stringify(updateData, null, 2));

          await adminFirestore.collection('users').doc(userId).set(updateData, { merge: true });

          console.log(`[Webhook] ✅ SUCCESSFULLY updated user ${userId} to ${plan}`);

          // The account page will fetch the updated tier from Firestore
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[Webhook] Processing ${event.type}:`, subscription.id);
        console.log(`[Webhook] Cancel at period end:`, subscription.cancel_at_period_end);
        console.log(`[Webhook] Current period end:`, subscription.current_period_end);
        console.log(`[Webhook] Status:`, subscription.status);

        let userId: string | null = null;

        // Check subscription metadata for uid
        if (subscription.metadata?.uid) {
          userId = subscription.metadata.uid;
          console.log(`[Webhook] Found user ID in subscription metadata: ${userId}`);
        } else {
          // Fallback to email lookup
          const customer = await stripe.customers.retrieve(
            subscription.customer as string
          );

          const customerEmail = (customer as Stripe.Customer).email;

          if (!customerEmail) {
            console.error('[Webhook] No customer email found and no uid in metadata');
            break;
          }

          // Find user by email
          const usersSnapshot = await adminFirestore
            .collection('users')
            .where('email', '==', customerEmail)
            .limit(1)
            .get();

          if (usersSnapshot.empty) {
            console.error(`[Webhook] No user found with email: ${customerEmail}`);
            break;
          }

          const userDoc = usersSnapshot.docs[0];
          userId = userDoc.id;
        }

        // Get the plan from price ID
        const priceId = subscription.items.data[0]?.price.id;
        const plan = toPlan(priceId) || 'premium_monthly';

        // Update user subscription
        const updateData = {
          subscription: {
            plan,
            status: subscription.status,
            stripeCustomerId: subscription.customer,
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId,
            currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            metadata: {
              source: 'stripe',
              updatedAt: new Date()
            }
          },
          stripeCustomerId: subscription.customer,
          updatedAt: new Date()
        };

        console.log(`[Webhook] About to update Firebase for user ${userId} with data:`, JSON.stringify(updateData.subscription, null, 2));

        await adminFirestore.collection('users').doc(userId).set(updateData, { merge: true });

        console.log(`[Webhook] ✅ Successfully updated subscription for user ${userId}`);

        // The account page will fetch the updated tier from Firestore
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('[Webhook] Processing customer.subscription.deleted:', subscription.id);

        let userId: string | null = null;

        // Check subscription metadata for uid
        if (subscription.metadata?.uid) {
          userId = subscription.metadata.uid;
          console.log(`[Webhook] Found user ID in subscription metadata: ${userId}`);
        } else {
          // Try to find by Stripe customer ID first
          const usersSnapshot = await adminFirestore
            .collection('users')
            .where('stripeCustomerId', '==', subscription.customer)
            .limit(1)
            .get();

          if (!usersSnapshot.empty) {
            const userDoc = usersSnapshot.docs[0];
            userId = userDoc.id;
            console.log(`[Webhook] Found user by customer ID: ${userId}`);
          } else {
            // Fallback to email lookup
            const customer = await stripe.customers.retrieve(
              subscription.customer as string
            );

            const customerEmail = (customer as Stripe.Customer).email;

            if (!customerEmail) {
              console.error('[Webhook] No user found by customer ID and no email available');
              break;
            }

            // Find user by email
            const emailSnapshot = await adminFirestore
              .collection('users')
              .where('email', '==', customerEmail)
              .limit(1)
              .get();

            if (emailSnapshot.empty) {
              console.error(`[Webhook] No user found with email: ${customerEmail}`);
              break;
            }

            const userDoc = emailSnapshot.docs[0];
            userId = userDoc.id;
            console.log(`[Webhook] Found user by email: ${userId}`);
          }
        }

        // Reset to free plan (preserve other user data with merge)
        await adminFirestore.collection('users').doc(userId).set({
          subscription: {
            plan: 'free',
            status: 'active',
            stripeCustomerId: subscription.customer,
            canceledAt: new Date(),
            previousPlan: subscription.items.data[0]?.price.id,
            metadata: {
              source: 'stripe',
              updatedAt: new Date(),
              cancelReason: 'subscription_deleted'
            }
          },
          updatedAt: new Date()
        }, { merge: true });

        console.log(`[Webhook] Reset user ${userId} to free plan (subscription deleted)`);

        // The account page will fetch the updated tier from Firestore
        break;
      }

      case 'invoice.created': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`[Webhook] Processing ${event.type}:`, invoice.id);

        // Add custom footer to draft invoices
        if (invoice.status === 'draft') {
          try {
            await stripe.invoices.update(invoice.id, {
              footer: getInvoiceFooter(),
              metadata: {
                ...invoice.metadata,
                platform: 'moshimoshi',
                mascot: 'doshi'
              }
            });
            console.log(`[Webhook] Added custom footer to invoice ${invoice.id}`);
          } catch (error) {
            console.error(`[Webhook] Failed to update invoice ${invoice.id}:`, error);
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`[Webhook] Payment succeeded for invoice ${invoice.id}`);
        // Payment succeeded - subscription is active
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`[Webhook] Payment failed for invoice ${invoice.id}`);
        // Payment failed - handle retry logic
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Disable body parsing to get raw body for signature verification
export const runtime = 'nodejs';