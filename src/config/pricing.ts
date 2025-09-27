/**
 * Pricing configuration - single source of truth for all pricing values
 * These values should be kept in sync with Stripe dashboard
 */

export const PRICING_CONFIG = {
  monthly: {
    amount: Number(process.env.NEXT_PUBLIC_STRIPE_MONTHLY_AMOUNT || '8.99'),
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY || '',
    displayAmount: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_AMOUNT || '8.99',
  },
  yearly: {
    amount: Number(process.env.NEXT_PUBLIC_STRIPE_YEARLY_AMOUNT || '99.99'),
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY || '',
    displayAmount: process.env.NEXT_PUBLIC_STRIPE_YEARLY_AMOUNT || '99.99',
  },
  currency: process.env.NEXT_PUBLIC_STRIPE_CURRENCY || 'GBP',
  currencySymbol: process.env.NEXT_PUBLIC_STRIPE_CURRENCY === 'GBP' ? '£' :
                  process.env.NEXT_PUBLIC_STRIPE_CURRENCY === 'EUR' ? '€' :
                  process.env.NEXT_PUBLIC_STRIPE_CURRENCY === 'USD' ? '$' : '£',
} as const;

// Computed values
export const YEARLY_SAVINGS_PERCENTAGE = Math.round(
  ((PRICING_CONFIG.monthly.amount * 12 - PRICING_CONFIG.yearly.amount) /
   (PRICING_CONFIG.monthly.amount * 12)) * 100
);

export const MONTHLY_EQUIVALENT_FROM_YEARLY = PRICING_CONFIG.yearly.amount / 12;