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
    currency: 'USD',
    interval: 'month',
    features: [
      '5 Hiragana practice sessions per day',
      '5 Katakana practice sessions per day',
      'Basic progress tracking',
      'Community support'
    ],
    stripePriceId: ''
  },
  {
    id: 'premium_monthly',
    name: 'Premium Monthly',
    description: 'Full access with monthly billing',
    price: PRICING_CONFIG.monthly.amount,
    currency: 'USD',
    interval: 'month',
    features: [
      'Unlimited Hiragana practice',
      'Unlimited Katakana practice',
      'Advanced SRS algorithm',
      'Detailed progress analytics',
      'Priority support',
      'Offline mode',
      'Cancel anytime'
    ],
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY || '',
    popular: true
  },
  {
    id: 'premium_yearly',
    name: 'Premium Yearly',
    description: 'Best value with annual billing',
    price: PRICING_CONFIG.yearly.amount,
    currency: 'USD',
    interval: 'year',
    features: [
      'Everything in Premium Monthly',
      'Save 25% compared to monthly',
      '2 months free',
      'Early access to new features',
      'Personalized learning insights'
    ],
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY || ''
  }
];