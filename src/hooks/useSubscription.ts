'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore as db } from '@/lib/firebase/client';
import {
  SubscriptionFacts,
  SubscriptionPlan,
  SubscriptionStatus
} from '@/lib/stripe/types';
import {
  startCheckout,
  openBillingPortal,
  getCheckoutUrls,
  checkCheckoutStatus,
  clearCheckoutParams
} from '@/lib/stripe/api';
import { useToast } from '@/components/ui/Toast';
import { useI18n } from '@/i18n/I18nContext';
import logger from '@/lib/logger';

interface UseSubscriptionReturn {
  subscription: SubscriptionFacts | null;
  isLoading: boolean;
  error: Error | null;
  
  // Computed properties
  isSubscribed: boolean;
  isPremium: boolean;
  isFreeTier: boolean;
  canUpgrade: boolean;
  daysUntilRenewal: number | null;
  
  // Actions
  upgradeToPremium: (plan: 'premium_monthly' | 'premium_yearly') => Promise<void>;
  manageBilling: () => Promise<void>;
  cancelSubscription: () => Promise<void>;
  
  // Checkout status
  checkoutStatus: ReturnType<typeof checkCheckoutStatus>;
  clearCheckoutStatus: () => void;
}

/**
 * Hook for managing user subscription state and actions
 */
export function useSubscription(): UseSubscriptionReturn {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useI18n();
  const [subscription, setSubscription] = useState<SubscriptionFacts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState(() => checkCheckoutStatus());

  // Fetch subscription data from API endpoint (uses session auth)
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await fetch('/api/user/subscription');

        // Check if response is ok before trying to parse JSON
        if (!response.ok) {
          // If 404, the endpoint doesn't exist or user is not authenticated
          if (response.status === 404 || response.status === 401) {
            logger.subscription('Subscription endpoint not found or unauthorized, defaulting to free tier');
            setSubscription({
              plan: 'free',
              status: 'active'
            });
            setError(null);
            return;
          }
          throw new Error(`Failed to fetch subscription: ${response.status}`);
        }

        const data = await response.json();

        if (data.subscription) {
          // Convert date strings to Date objects if needed
          const sub = data.subscription;
          setSubscription({
            ...sub,
            currentPeriodEnd: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : undefined,
            metadata: sub.metadata ? {
              ...sub.metadata,
              updatedAt: sub.metadata.updatedAt ? new Date(sub.metadata.updatedAt) : undefined
            } : undefined
          });
        } else {
          setSubscription({
            plan: 'free',
            status: 'active'
          });
        }
        setError(null);
      } catch (err) {
        logger.error('Failed to fetch subscription:', err);
        // Default to free tier on error
        setSubscription({
          plan: 'free',
          status: 'active'
        });
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchSubscription();

    // Only poll after successful payment (not constantly)
    // We'll trigger a refresh when needed instead of constant polling
    // This prevents the constant 404 errors
  }, []);

  // Refresh subscription data (called after successful checkout)
  const refreshSubscription = useCallback(async () => {
    try {
      const response = await fetch('/api/user/subscription');
      const data = await response.json();

      if (data.subscription) {
        const sub = data.subscription;
        setSubscription({
          ...sub,
          currentPeriodEnd: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : undefined,
          metadata: sub.metadata ? {
            ...sub.metadata,
            updatedAt: sub.metadata.updatedAt ? new Date(sub.metadata.updatedAt) : undefined
          } : undefined
        });
      }
    } catch (err) {
      logger.error('Failed to refresh subscription:', err);
    }
  }, []);

  // Check for checkout completion on mount and URL changes
  useEffect(() => {
    const status = checkCheckoutStatus();
    setCheckoutStatus(status);

    if (status.completed) {
      if (status.success) {
        showToast(t('subscription.checkout.success'), 'success', 5000);
        // Refresh subscription data after successful payment
        // Poll a few times to catch webhook updates
        refreshSubscription();
        setTimeout(refreshSubscription, 2000);
        setTimeout(refreshSubscription, 5000);
        setTimeout(refreshSubscription, 10000);
      } else {
        showToast(t('subscription.checkout.canceled'), 'info');
      }

      // Clean up URL after showing message
      setTimeout(() => {
        clearCheckoutParams();
        setCheckoutStatus({ completed: false, success: false });
      }, 3000);
    }
  }, [showToast, refreshSubscription, t]);

  // Computed properties
  const isSubscribed = subscription?.plan !== 'free' && subscription?.status === 'active';
  const isPremium = subscription?.plan === 'premium_monthly' || subscription?.plan === 'premium_yearly';
  const isFreeTier = !isSubscribed;
  const canUpgrade = !isPremium || subscription?.cancelAtPeriodEnd === true;
  
  const daysUntilRenewal = useCallback(() => {
    if (!subscription?.currentPeriodEnd) return null;
    const now = new Date();
    const end = new Date(subscription.currentPeriodEnd);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : null;
  }, [subscription?.currentPeriodEnd])();

  // Actions
  const upgradeToPremium = useCallback(async (plan: 'premium_monthly' | 'premium_yearly') => {
    try {
      const priceId = plan === 'premium_monthly'
        ? process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY
        : process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY;

      if (!priceId) {
        throw new Error('Stripe price ID not configured');
      }

      const urls = getCheckoutUrls();
      await startCheckout(priceId, urls.success, urls.cancel);
    } catch (err) {
      logger.error('Failed to start checkout:', err);
      showToast(t('subscription.errors.checkoutFailed'), 'error');
      throw err;
    }
  }, [showToast]);

  const manageBilling = useCallback(async () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const returnUrl = `${origin}/account`;
      await openBillingPortal(returnUrl);
    } catch (err) {
      logger.error('Failed to open billing portal:', err);
      showToast(t('subscription.errors.billingPortalFailed'), 'error');
      throw err;
    }
  }, [showToast]);

  const cancelSubscription = useCallback(async () => {
    try {
      // Open portal for cancellation
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const returnUrl = `${origin}/account?action=canceled`;
      await openBillingPortal(returnUrl);
    } catch (err) {
      logger.error('Failed to cancel subscription:', err);
      showToast(t('subscription.errors.cancelFailed'), 'error');
      throw err;
    }
  }, [showToast]);

  const clearCheckoutStatus = useCallback(() => {
    clearCheckoutParams();
    setCheckoutStatus({ completed: false, success: false });
  }, []);

  return {
    subscription,
    isLoading,
    error,
    isSubscribed,
    isPremium,
    isFreeTier,
    canUpgrade,
    daysUntilRenewal,
    upgradeToPremium,
    manageBilling,
    cancelSubscription,
    checkoutStatus,
    clearCheckoutStatus
  };
}

/**
 * Hook to check if user has specific subscription plan
 */
export function useHasPlan(requiredPlan: SubscriptionPlan): boolean {
  const { subscription } = useSubscription();
  
  if (!subscription) return false;
  
  // Check exact plan match
  if (subscription.plan === requiredPlan) {
    return subscription.status === 'active';
  }
  
  // Premium plans include lower tiers
  if (requiredPlan === 'free') {
    return true; // Everyone has at least free tier
  }
  
  if (requiredPlan === 'premium_monthly' && subscription.plan === 'premium_yearly') {
    return subscription.status === 'active'; // Yearly includes monthly benefits
  }
  
  return false;
}