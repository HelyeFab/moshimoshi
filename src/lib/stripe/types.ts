/**
 * Public Stripe types for client-side usage
 */

import { PRICING_CONFIG } from '@/config/pricing';

export type SubscriptionPlan = 'free' | 'premium_monthly' | 'premium_yearly';
export type SubscriptionStatus = 'active' | 'incomplete' | 'past_due' | 'canceled' | 'trialing';

export interface SubscriptionFacts {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  metadata?: {
    source: 'stripe';
    updatedAt: Date;
  };
}

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  stripePriceId: string;
  popular?: boolean;
}

export interface CheckoutSessionRequest {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}

export interface PortalSessionRequest {
  returnUrl: string;
  idempotencyKey: string;
}

export interface StripeConfig {
  publishableKey: string;
  prices: {
    monthly: string;
    yearly: string;
  };
}

// Pricing configuration (would typically come from env vars)
const MONTHLY_FEATURES = [
  'pricing.features.monthly.everythingFree',
  'pricing.features.monthly.learnFaster',
  'pricing.features.monthly.readMore',
  'pricing.features.monthly.goDeeper',
  'pricing.features.monthly.buildHabits',
  'pricing.features.monthly.crossDeviceSync',
  'pricing.features.monthly.prioritySupport',
  'pricing.features.monthly.futureFeaturesUnlimited',
];

const YEARLY_FEATURES = [
  ...MONTHLY_FEATURES,
  'pricing.features.yearly.twoMonthsFree',
];

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'pricing.planNames.free',
    description: 'pricing.planDescriptions.free',
    price: 0,
    currency: PRICING_CONFIG.currency,
    interval: 'month',
    features: [
      'pricing.features.free.startLearning',
      'pricing.features.free.dailyPractice',
      'pricing.features.free.limitedStoriesNews',
      'pricing.features.free.basicProgressTracking',
      'pricing.features.free.learnAtYourPace',
    ],
    stripePriceId: ''
  },
  {
    id: 'premium_monthly',
    name: 'pricing.planNames.premiumMonthly',
    description: 'pricing.planDescriptions.premiumMonthly',
    price: PRICING_CONFIG.monthly.amount,
    currency: PRICING_CONFIG.currency,
    interval: 'month',
    features: MONTHLY_FEATURES,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY || '',
    popular: false,
  },
  {
    id: 'premium_yearly',
    name: 'pricing.planNames.premiumYearly',
    description: 'pricing.planDescriptions.premiumYearly',
    price: PRICING_CONFIG.yearly.amount,
    currency: PRICING_CONFIG.currency,
    interval: 'year',
    features: YEARLY_FEATURES,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY || '',
    popular: true,
  }
];
