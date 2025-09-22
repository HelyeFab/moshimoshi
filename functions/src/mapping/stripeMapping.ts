/**
 * Stripe Price ID to Plan Mapping
 * 
 * Single source of truth for mapping Stripe price IDs to our internal plan types.
 * Supports both test and production price IDs, with graceful fallback.
 * 
 * @module stripeMapping
 */

export type Plan = 'premium_monthly' | 'premium_yearly';
export type SubscriptionPlan = 'free' | 'premium_monthly' | 'premium_yearly';

/**
 * Get price IDs from environment configuration
 * These should be set via Firebase Functions config:
 * firebase functions:config:set stripe.price_monthly_test="price_xxx" stripe.price_yearly_test="price_yyy"
 * firebase functions:config:set stripe.price_monthly_prod="price_xxx" stripe.price_yearly_prod="price_yyy"
 */
import * as functions from 'firebase-functions';

const config = functions.config();

/**
 * Test environment price IDs from Firebase config
 */
const TEST_PRICES: Record<string, Plan> = {
  ...(config.stripe?.price_monthly_test && { [config.stripe.price_monthly_test]: 'premium_monthly' as Plan }),
  ...(config.stripe?.price_yearly_test && { [config.stripe.price_yearly_test]: 'premium_yearly' as Plan }),
};

/**
 * Production environment price IDs from Firebase config
 */
const PRODUCTION_PRICES: Record<string, Plan> = {
  ...(config.stripe?.price_monthly_prod && { [config.stripe.price_monthly_prod]: 'premium_monthly' as Plan }),
  ...(config.stripe?.price_yearly_prod && { [config.stripe.price_yearly_prod]: 'premium_yearly' as Plan }),
};

// Log loaded price IDs for debugging (only in non-production)
if (process.env.NODE_ENV !== 'production') {
  console.log('[Stripe Mapping] Loaded TEST price IDs:', TEST_PRICES);
  console.log('[Stripe Mapping] Loaded PRODUCTION price IDs:', PRODUCTION_PRICES);
}

/**
 * Combined mapping for both test and production
 * This allows the same codebase to work in both environments
 */
export const PRICE_TO_PLAN: Record<string, Plan> = {
  ...TEST_PRICES,
  ...PRODUCTION_PRICES,
};

/**
 * Maps a Stripe price ID to our internal plan type
 * 
 * @param priceId - The Stripe price ID from the subscription or checkout
 * @returns The mapped plan type, or null if not recognized
 * 
 * @example
 * ```ts
 * const plan = toPlan('price_1QcTestMonthlyXXX'); // 'monthly'
 * const unknown = toPlan('price_unknown'); // null
 * const empty = toPlan(null); // null
 * ```
 */
export function toPlan(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  return PRICE_TO_PLAN[priceId] ?? null;
}

/**
 * Gets the appropriate plan for a user based on their subscription
 * 
 * @param priceId - The Stripe price ID (optional)
 * @param hasActiveSubscription - Whether the user has an active subscription
 * @returns The subscription plan type
 * 
 * @example
 * ```ts
 * const plan = getSubscriptionPlan('price_1QcTestMonthlyXXX', true); // 'monthly'
 * const freePlan = getSubscriptionPlan(null, false); // 'free'
 * ```
 */
export function getSubscriptionPlan(
  priceId: string | null | undefined,
  hasActiveSubscription: boolean
): SubscriptionPlan {
  if (!hasActiveSubscription) return 'free';
  
  const plan = toPlan(priceId);
  if (!plan) {
    console.warn(`Unknown price ID: ${priceId}, defaulting to premium_monthly`);
    return 'premium_monthly'; // Safe default for active subscriptions
  }
  
  return plan;
}

/**
 * Validates if a price ID is recognized
 * Useful for early validation in checkout flows
 * 
 * @param priceId - The Stripe price ID to validate
 * @returns true if the price ID is recognized
 */
export function isValidPriceId(priceId: string): boolean {
  return priceId in PRICE_TO_PLAN;
}

/**
 * Gets all valid price IDs for a given plan type
 * Useful for migrations or admin tools
 * 
 * @param plan - The plan type to get price IDs for
 * @returns Array of price IDs that map to this plan
 */
export function getPriceIdsForPlan(plan: Plan): string[] {
  return Object.entries(PRICE_TO_PLAN)
    .filter(([_, mappedPlan]) => mappedPlan === plan)
    .map(([priceId]) => priceId);
}

/**
 * Environment detection helper
 * Returns whether we're likely in test mode based on price IDs
 * 
 * @param priceId - The Stripe price ID to check
 * @returns true if this appears to be a test price ID
 */
export function isTestPrice(priceId: string): boolean {
  return priceId in TEST_PRICES;
}

/**
 * Price rotation helper
 * When rotating prices, this helps identify old vs new
 * 
 * @param priceId - The Stripe price ID to check
 * @returns true if this is a legacy price ID
 */
export function isLegacyPrice(priceId: string): boolean {
  return priceId.includes('Old');
}

/**
 * Default plan constants
 */
export const DEFAULT_PLAN: SubscriptionPlan = 'free';
export const DEFAULT_PAID_PLAN: Plan = 'premium_monthly';