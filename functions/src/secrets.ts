/**
 * Secret Management for Stripe Integration
 * 
 * Uses Firebase Functions v2 defineSecret for secure secret handling.
 * Secrets are stored in Google Secret Manager and accessed at runtime.
 * 
 * @module secrets
 */

import { defineSecret } from 'firebase-functions/params';

/**
 * Stripe API Secret Key
 * Used for all Stripe API operations
 * Format: sk_test_* (test) or sk_live_* (production)
 */
export const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');

/**
 * Stripe Webhook Endpoint Secret
 * Used to verify webhook signatures from Stripe
 * Format: whsec_*
 * 
 * CRITICAL: This must match the webhook endpoint secret from Stripe Dashboard
 */
export const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

/**
 * Optional: Stripe Restricted Keys for specific operations
 * Use these for least-privilege access patterns
 */
export const STRIPE_CHECKOUT_KEY = defineSecret('STRIPE_CHECKOUT_KEY');
export const STRIPE_PORTAL_KEY = defineSecret('STRIPE_PORTAL_KEY');

/**
 * Helper to validate secrets are configured
 * Call this during function initialization
 */
export function validateSecrets(): void {
  const secrets = {
    STRIPE_SECRET_KEY: STRIPE_SECRET_KEY.value(),
    STRIPE_WEBHOOK_SECRET: STRIPE_WEBHOOK_SECRET.value(),
  };

  for (const [name, value] of Object.entries(secrets)) {
    if (!value || value === 'undefined') {
      throw new Error(`Missing required secret: ${name}`);
    }
  }
}

/**
 * Get environment mode from secret key
 * @returns 'test' | 'live'
 */
export function getStripeMode(): 'test' | 'live' {
  const key = STRIPE_SECRET_KEY.value();
  if (key.startsWith('sk_test_')) return 'test';
  if (key.startsWith('sk_live_')) return 'live';
  throw new Error('Invalid Stripe secret key format');
}