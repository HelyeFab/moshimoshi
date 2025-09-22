/**
 * Stripe Price ID to Plan Mapping
 * Maps Stripe price IDs to our internal plan names
 * 
 * This is the ONLY place where Stripe price IDs are mapped to plans
 * Update this when adding new products/prices in Stripe Dashboard
 */

export type PlanType = 'free' | 'premium_monthly' | 'premium_yearly';

// Production Price IDs
export const PRODUCTION_PRICE_MAP: Record<string, PlanType> = {
  // Monthly subscription
  'price_1QVKJvHelloMoshimoshiMonthly': 'premium_monthly',
  
  // Yearly subscription  
  'price_1QVKJwHelloMoshimoshiYearly': 'premium_yearly',
};

// Test/Development Price IDs (Stripe Test Mode)
export const TEST_PRICE_MAP: Record<string, PlanType> = {
  // Test monthly subscription
  'price_1QVTestMonthlyMoshimoshi': 'premium_monthly',
  
  // Test yearly subscription
  'price_1QVTestYearlyMoshimoshi': 'premium_yearly',
};

// Determine which map to use based on environment
const isProduction = process.env.FUNCTIONS_EMULATOR !== 'true' && 
                     process.env.NODE_ENV === 'production';

export const PRICE_MAP = isProduction ? PRODUCTION_PRICE_MAP : TEST_PRICE_MAP;

/**
 * Get plan type from Stripe price ID
 * Returns 'free' if price ID not found (customer without subscription)
 */
export function getPlanFromPriceId(priceId: string | null | undefined): PlanType {
  if (!priceId) return 'free';
  return PRICE_MAP[priceId] || 'free';
}

/**
 * Validate if a price ID is recognized
 */
export function isValidPriceId(priceId: string): boolean {
  return priceId in PRICE_MAP;
}

/**
 * Get all valid price IDs for a specific plan
 */
export function getPriceIdsForPlan(plan: PlanType): string[] {
  if (plan === 'free') return [];
  
  return Object.entries(PRICE_MAP)
    .filter(([_, mappedPlan]) => mappedPlan === plan)
    .map(([priceId]) => priceId);
}

// Export metadata about available plans
export const PLAN_METADATA = {
  free: {
    name: 'Free Plan',
    description: 'Basic access with daily limits',
    features: [
      '5 Hiragana practices per day',
      '5 Katakana practices per day',
      'Basic progress tracking'
    ]
  },
  premium_monthly: {
    name: 'Premium Monthly',
    description: 'Full access billed monthly',
    features: [
      'Unlimited Hiragana practice',
      'Unlimited Katakana practice',
      'Advanced analytics',
      'Priority support'
    ]
  },
  premium_yearly: {
    name: 'Premium Yearly',
    description: 'Full access with yearly discount',
    features: [
      'Everything in Premium Monthly',
      '2 months free (16% discount)',
      'Early access to new features'
    ]
  }
};