/**
 * Stripe Price ID to Plan Mapping
 */

export type SubscriptionPlan = 'free' | 'premium_monthly' | 'premium_yearly';

// Price IDs from your Stripe account - MUST be set in environment variables
const PRICE_IDS = {
  monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY!,
  yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY!,
} as const;

// Log the actual values for debugging
console.log('[Stripe Mapping] Loaded price IDs:', {
  monthly: PRICE_IDS.monthly,
  yearly: PRICE_IDS.yearly
});

// Validate that price IDs are configured
if (!PRICE_IDS.monthly || !PRICE_IDS.yearly) {
  console.error('[Stripe Mapping] Missing price IDs in environment variables!');
  console.error('Please set NEXT_PUBLIC_STRIPE_PRICE_MONTHLY and NEXT_PUBLIC_STRIPE_PRICE_YEARLY');
}

/**
 * Map Stripe price ID to our plan names
 */
export function toPlan(priceId: string | null | undefined): SubscriptionPlan {
  if (!priceId) return 'free';

  console.log('[Stripe Mapping] toPlan called with:', priceId);
  console.log('[Stripe Mapping] Comparing against:', {
    monthly: PRICE_IDS.monthly,
    yearly: PRICE_IDS.yearly
  });

  switch (priceId) {
    case PRICE_IDS.monthly:
      console.log('[Stripe Mapping] Matched monthly price');
      return 'premium_monthly';
    case PRICE_IDS.yearly:
      console.log('[Stripe Mapping] Matched yearly price');
      return 'premium_yearly';
    default:
      console.warn(`Unknown price ID: ${priceId}`);
      return 'free';
  }
}

/**
 * Get price ID from plan name
 */
export function getPriceId(plan: SubscriptionPlan): string | null {
  switch (plan) {
    case 'premium_monthly':
      return PRICE_IDS.monthly;
    case 'premium_yearly':
      return PRICE_IDS.yearly;
    default:
      return null;
  }
}

/**
 * Validate if a price ID is valid
 */
export function isValidPriceId(priceId: string): boolean {
  return Object.values(PRICE_IDS).includes(priceId as any);
}