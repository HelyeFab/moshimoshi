'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useI18n, useLocalePath } from '@/i18n/I18nContext';
import { PRICING_PLANS, PricingPlan } from '@/lib/stripe/types';
import { PRICING_CONFIG } from '@/config/pricing';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import DoshiMascot from '@/components/ui/DoshiMascot';
import { useToast } from '@/components/ui/Toast';
import { PricingPlanCard } from '@/components/subscription/PricingPlanCard';
// Navigation is now global via NavigationWrapper in root layout;

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { getLocalePath } = useLocalePath();
  const { user } = useAuth();
  const { subscription, isLoading, upgradeToPremium, manageBilling } = useSubscription();
  const { showToast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [showVideoLimitBanner, setShowVideoLimitBanner] = useState(false);

  // Gated feature IDs that free users can't access
  const gatedFeatures = ['kanji_connection', 'comics', 'textbook_vocabulary', 'books', 'flashcards', 'my_videos'];

  // Smart back navigation - avoid infinite loop
  const handleBack = () => {
    // Check URL params to see if user came from a gated feature
    const fromFeature = searchParams.get('from');
    const reason = searchParams.get('reason');

    // Check if came from a gated feature (either via 'from' or 'reason' param)
    const isFromGatedFeature =
      (fromFeature && gatedFeatures.includes(fromFeature)) ||
      (reason && (reason.includes('premium_only') || reason === 'video_limit'));

    if (isFromGatedFeature) {
      // Came from a gated feature - redirect to dashboard instead
      console.log('[Pricing] Redirecting to dashboard (came from gated feature or premium gate)');
      router.push(getLocalePath('/dashboard'));
    } else {
      // Safe to go back
      console.log('[Pricing] Going back normally');
      router.back();
    }
  };

  // Check if user came from video limit
  useEffect(() => {
    if (searchParams.get('reason') === 'video_limit') {
      setShowVideoLimitBanner(true);
      // Show a toast message
      showToast(t('pricing.videoLimitReached'), 'info', 5000);
    }
  }, [searchParams, showToast, t]);

  const handleSelectPlan = async (plan: PricingPlan) => {
    // Free plan - just need to sign up
    if (plan.id === 'free') {
      if (!user) {
        router.push(getLocalePath('/auth/signup'));
      } else {
        showToast(t('pricing.messages.alreadyFree'), 'info');
      }
      return;
    }

    // Premium plans - need auth and checkout
    if (!user) {
      // Save intended plan and redirect to signup
      sessionStorage.setItem('intendedPlan', plan.id);
      router.push(getLocalePath('/auth/signup'));
      return;
    }

    // Already subscribed to this plan
    if (subscription?.plan === plan.id && subscription?.status === 'active') {
      showToast(t('pricing.messages.alreadySubscribed'), 'info');
      return;
    }

    // Start checkout
    setLoadingPlan(plan.id);
    try {
      await upgradeToPremium(plan.id as 'premium_monthly' | 'premium_yearly');
    } catch (error) {
      console.error('Checkout failed:', error);
    } finally {
      setLoadingPlan(null);
    }
  };

  const isCurrentPlan = (planId: string) => {
    return subscription?.plan === planId && subscription?.status === 'active';
  };

  // Show all three plans: Free, Premium Monthly, Premium Yearly
  const displayedPlans = PRICING_PLANS;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white dark:from-dark-900 dark:to-dark-800">
        <div className="text-center">
          <DoshiMascot size="large" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('pricing.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Back button pill - top right */}
      <button
        onClick={handleBack}
        className="fixed top-20 right-4 sm:top-24 sm:right-8 z-50 flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 border border-gray-200 dark:border-gray-700"
        aria-label="Go back"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        <span className="text-sm font-medium">Back</span>
      </button>

      {/* Navbar */}
      {/* Navigation is now global - rendered in root layout */}

      {/* Hero Section */}
      <div className="px-4 sm:px-6 lg:px-8 py-12 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {t('pricing.title')}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            {t('pricing.subtitle')}
          </p>
        </div>
      </div>

      {/* Pricing cards */}
      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {displayedPlans.map((plan) => (
              <PricingPlanCard
                key={plan.id}
                plan={plan}
                onSelect={handleSelectPlan}
                isLoading={loadingPlan === plan.id}
                isCurrentPlan={isCurrentPlan(plan.id)}
                user={user}
              />
            ))}
          </div>
          
          {/* Manage billing for existing customers */}
          {subscription && subscription.plan !== 'free' && (
            <div className="mt-12 text-center">
              <button
                onClick={manageBilling}
                className="text-primary-500 hover:text-primary-600 font-medium"
              >
                {t('pricing.manageBilling')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FAQ section */}
      <div className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
            {t('pricing.faq.title')}
          </h2>
          <div className="space-y-6">
            <details className="bg-white dark:bg-gray-800 rounded-lg p-6">
              <summary className="font-semibold cursor-pointer">{t('pricing.faq.cancel.question')}</summary>
              <p className="mt-3 text-gray-600 dark:text-gray-400">
                {t('pricing.faq.cancel.answer')}
              </p>
            </details>
            <details className="bg-white dark:bg-gray-800 rounded-lg p-6">
              <summary className="font-semibold cursor-pointer">{t('pricing.faq.trial.question')}</summary>
              <p className="mt-3 text-gray-600 dark:text-gray-400">
                {t('pricing.faq.trial.answer')}
              </p>
            </details>
            <details className="bg-white dark:bg-gray-800 rounded-lg p-6">
              <summary className="font-semibold cursor-pointer">{t('pricing.faq.switch.question')}</summary>
              <p className="mt-3 text-gray-600 dark:text-gray-400">
                {t('pricing.faq.switch.answer')}
              </p>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PricingContent />
    </Suspense>
  );
}
