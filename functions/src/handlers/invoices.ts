/**
 * Stripe Invoice Event Handler
 * 
 * Processes invoice.* events from Stripe webhook.
 * Handles payment success/failure events to update subscription status.
 * 
 * @module handlers/invoices
 */

import Stripe from 'stripe';
import { 
  upsertUserSubscriptionByCustomerId,
  logStripeEvent,
  getUidByCustomerId 
} from '../firestore';

/**
 * Main invoice event handler
 * Routes to specific handlers based on event type
 * 
 * @param event - The Stripe webhook event
 */
export async function applyInvoiceEvent(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  
  // Log the event with invoice details
  await logStripeEvent(event, {
    customerId: invoice.customer as string,
  });

  // Validate we have a customer ID
  const customerId = invoice.customer as string;
  if (!customerId) {
    console.error(`Invoice ${invoice.id} has no customer ID`);
    throw new Error('Missing customer ID in invoice');
  }

  // Check if we have a user mapping
  const uid = await getUidByCustomerId(customerId);
  if (!uid) {
    console.warn(`No user mapped for customer ${customerId} in invoice event`);
    // Don't throw - this might be a timing issue
    // The subscription events should handle the main flow
  }

  // Route to specific handler based on event type
  switch (event.type) {
    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(invoice, customerId);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(invoice, customerId);
      break;
    case 'invoice.created':
      await handleInvoiceCreated(invoice, customerId);
      break;
    case 'invoice.finalized':
      await handleInvoiceFinalized(invoice, customerId);
      break;
    case 'invoice.payment_action_required':
      await handlePaymentActionRequired(invoice, customerId);
      break;
    default:
      console.log(`Ignoring invoice event type: ${event.type}`);
  }
}

/**
 * Handles successful invoice payment
 * Updates subscription status to active
 * 
 * @param invoice - The Stripe invoice object
 * @param customerId - The Stripe customer ID
 */
async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  customerId: string
): Promise<void> {
  console.log(`Processing invoice.payment_succeeded for ${invoice.id}`);
  
  // Only update status for subscription invoices
  if (!(invoice as any).subscription) {
    console.log(`Invoice ${invoice.id} is not for a subscription, skipping status update`);
    return;
  }

  // Extract billing reason to understand the context
  const billingReason = invoice.billing_reason;
  console.log(`Invoice billing reason: ${billingReason}`);
  
  // Payment succeeded means subscription is active
  const facts = {
    status: 'active' as const,
    // Update payment metadata
    lastPaymentDate: Math.floor(Date.now() / 1000),
    lastPaymentAmount: invoice.amount_paid,
    lastInvoiceId: invoice.id,
  };
  
  try {
    await upsertUserSubscriptionByCustomerId(customerId, facts);
    console.log(`Payment succeeded for customer ${customerId}, status set to active`);
    
    // Log successful payment for analytics
    await logPaymentSuccess(invoice);
  } catch (error) {
    console.error(`Failed to update payment success for customer ${customerId}:`, error);
    throw error;
  }
}

/**
 * Handles failed invoice payment
 * Updates subscription status to past_due
 * 
 * @param invoice - The Stripe invoice object
 * @param customerId - The Stripe customer ID
 */
async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  customerId: string
): Promise<void> {
  console.log(`Processing invoice.payment_failed for ${invoice.id}`);
  
  // Only update status for subscription invoices
  if (!(invoice as any).subscription) {
    console.log(`Invoice ${invoice.id} is not for a subscription, skipping status update`);
    return;
  }

  // Determine the new status based on attempt count
  const attemptCount = invoice.attempt_count || 1;
  const nextPaymentAttempt = invoice.next_payment_attempt;
  
  let status: 'past_due' | 'canceled';
  if (nextPaymentAttempt) {
    // Stripe will retry, mark as past_due
    status = 'past_due';
    console.log(`Payment failed (attempt ${attemptCount}), will retry at ${new Date(nextPaymentAttempt * 1000)}`);
  } else {
    // No more retries, subscription will be canceled
    status = 'canceled';
    console.log(`Payment failed (attempt ${attemptCount}), no more retries scheduled`);
  }
  
  const facts = {
    status,
    // Track payment failure metadata
    lastPaymentFailureDate: Math.floor(Date.now() / 1000),
    lastPaymentFailureReason: (invoice as any).last_payment_error?.message || 'Unknown',
    paymentAttemptCount: attemptCount,
  };
  
  try {
    await upsertUserSubscriptionByCustomerId(customerId, facts);
    console.log(`Payment failed for customer ${customerId}, status set to ${status}`);
    
    // Log payment failure for monitoring
    await logPaymentFailure(invoice);
    
    // Could trigger email notification here
    if (attemptCount === 1) {
      // First failure - send gentle reminder
      console.log(`TODO: Send payment failure email to customer ${customerId}`);
    } else if (!nextPaymentAttempt) {
      // Final failure - subscription will be canceled
      console.log(`TODO: Send subscription cancellation email to customer ${customerId}`);
    }
  } catch (error) {
    console.error(`Failed to update payment failure for customer ${customerId}:`, error);
    throw error;
  }
}

/**
 * Handles invoice created event
 * Can be used for upcoming invoice notifications
 * 
 * @param invoice - The Stripe invoice object
 * @param customerId - The Stripe customer ID
 */
async function handleInvoiceCreated(
  invoice: Stripe.Invoice,
  customerId: string
): Promise<void> {
  console.log(`Invoice created for customer ${customerId}: ${invoice.id}`);
  
  // Could send upcoming payment notification
  if (invoice.billing_reason === 'subscription_cycle') {
    const dueDate = invoice.due_date || invoice.period_end;
    if (dueDate) {
      console.log(`Subscription renewal due on ${new Date(dueDate * 1000)}`);
      // TODO: Send renewal reminder email
    }
  }
}

/**
 * Handles invoice finalized event
 * Invoice is ready to be paid
 * 
 * @param invoice - The Stripe invoice object
 * @param customerId - The Stripe customer ID
 */
async function handleInvoiceFinalized(
  invoice: Stripe.Invoice,
  customerId: string
): Promise<void> {
  console.log(`Invoice finalized for customer ${customerId}: ${invoice.id}`);
  
  // Invoice is now immutable and ready for payment
  // Could trigger payment attempt or send invoice to customer
}

/**
 * Handles payment action required event
 * Customer needs to complete additional steps (3DS, etc.)
 * 
 * @param invoice - The Stripe invoice object
 * @param customerId - The Stripe customer ID
 */
async function handlePaymentActionRequired(
  invoice: Stripe.Invoice,
  customerId: string
): Promise<void> {
  console.log(`Payment action required for customer ${customerId}: ${invoice.id}`);
  
  // Update status to indicate action needed
  const facts = {
    status: 'incomplete' as const,
    requiresAction: true,
    hostedInvoiceUrl: invoice.hosted_invoice_url,
  };
  
  try {
    await upsertUserSubscriptionByCustomerId(customerId, facts);
    console.log(`Customer ${customerId} needs to complete payment action`);
    
    // TODO: Send email with link to complete payment
    if (invoice.hosted_invoice_url) {
      console.log(`Payment can be completed at: ${invoice.hosted_invoice_url}`);
    }
  } catch (error) {
    console.error(`Failed to update payment action required for customer ${customerId}:`, error);
    throw error;
  }
}

/**
 * Logs successful payment for analytics
 * 
 * @param invoice - The successful invoice
 */
async function logPaymentSuccess(invoice: Stripe.Invoice): Promise<void> {
  // Could write to analytics collection or send to analytics service
  console.log('Payment success analytics:', {
    amount: invoice.amount_paid,
    currency: invoice.currency,
    customerId: invoice.customer as string,
    subscriptionId: (invoice as any).subscription,
    billingReason: invoice.billing_reason,
  });
}

/**
 * Logs payment failure for monitoring
 * 
 * @param invoice - The failed invoice
 */
async function logPaymentFailure(invoice: Stripe.Invoice): Promise<void> {
  // Could write to monitoring collection or send alert
  console.error('Payment failure alert:', {
    amount: invoice.amount_due,
    currency: invoice.currency,
    customerId: invoice.customer as string,
    subscriptionId: (invoice as any).subscription,
    attemptCount: invoice.attempt_count,
    nextAttempt: invoice.next_payment_attempt,
    error: (invoice as any).last_payment_error,
  });
}

/**
 * Checks if an invoice is for a subscription
 * 
 * @param invoice - The invoice to check
 * @returns true if this is a subscription invoice
 */
export function isSubscriptionInvoice(invoice: Stripe.Invoice): boolean {
  return invoice.subscription !== null;
}

/**
 * Calculates the subscription period from an invoice
 * 
 * @param invoice - The invoice
 * @returns Period start and end dates
 */
export function getInvoicePeriod(invoice: Stripe.Invoice): { start: Date; end: Date } | null {
  if (!invoice.period_start || !invoice.period_end) return null;
  
  return {
    start: new Date(invoice.period_start * 1000),
    end: new Date(invoice.period_end * 1000),
  };
}

/**
 * Debug helper to log invoice details
 * 
 * @param invoice - The invoice to debug
 */
export function debugInvoice(invoice: Stripe.Invoice): void {
  console.log('=== Invoice Debug ===');
  console.log('ID:', invoice.id);
  console.log('Customer:', invoice.customer);
  console.log('Subscription:', invoice.subscription);
  console.log('Status:', invoice.status);
  console.log('Amount Due:', invoice.amount_due / 100, invoice.currency.toUpperCase());
  console.log('Amount Paid:', invoice.amount_paid / 100, invoice.currency.toUpperCase());
  console.log('Billing Reason:', invoice.billing_reason);
  console.log('Attempt Count:', invoice.attempt_count);
  console.log('Next Payment Attempt:', invoice.next_payment_attempt 
    ? new Date(invoice.next_payment_attempt * 1000) 
    : 'None');
  console.log('Period:', getInvoicePeriod(invoice));
  console.log('=====================');
}