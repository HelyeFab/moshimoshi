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
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with basic features',
    price: 0,
    currency: PRICING_CONFIG.currency,
    interval: 'month',
    features: [
      'pricing.features.free.hiraganaKatakana',
      'pricing.features.free.kanjiBrowser',
      'pricing.features.free.kanjiMastery',
      'pricing.features.free.drills',
      'pricing.features.free.vocabulary',
      'pricing.features.free.moodboards',
      'pricing.features.free.moshiPlayer',
      'pricing.features.free.aiStoriesNews',
      'pricing.features.free.basicProgressTracking'
    ],
    stripePriceId: ''
  },
  {
    id: 'premium_monthly',
    name: 'Premium Monthly',
    description: 'Full access with monthly billing',
    price: PRICING_CONFIG.monthly.amount,
    currency: PRICING_CONFIG.currency,
    interval: 'month',
    features: [
      'pricing.features.monthly.everythingFree',
      'pricing.features.monthly.unlimitedMoodboards',
      'pricing.features.monthly.unlimitedStories',
      'pricing.features.monthly.unlimitedNews',
      'pricing.features.monthly.unlimitedDrawPractice',
      'pricing.features.monthly.fullMoshiPlayer',
      'pricing.features.monthly.kanjiConnection',
      'pricing.features.monthly.moshiComics',
      'pricing.features.monthly.textbookVocab',
      'pricing.features.monthly.drillCustomLists',
      'pricing.features.monthly.ankiImports',
      'pricing.features.monthly.unlimitedLists',
      'pricing.features.monthly.library',
      'pricing.features.monthly.crossDeviceSync',
      'pricing.features.monthly.prioritySupport'
    ],
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY || '',
    popular: true
  },
  {
    id: 'premium_yearly',
    name: 'Premium Yearly',
    description: 'Best value with annual billing',
    price: PRICING_CONFIG.yearly.amount,
    currency: PRICING_CONFIG.currency,
    interval: 'year',
    features: [
      'pricing.features.yearly.everythingMonthly',
      'pricing.features.yearly.twoMonthsFree',
    ],
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY || ''
  }
];