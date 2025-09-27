'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useI18n } from '@/i18n/I18nContext';
import { PRICING_PLANS, PricingPlan } from '@/lib/stripe/types';
import { PRICING_CONFIG } from '@/config/pricing';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { LoadingButton } from '@/components/ui/Loading';
import DoshiMascot from '@/components/ui/DoshiMascot';
import { useToast } from '@/components/ui/Toast';
import Navbar from '@/components/layout/Navbar';

export default function PricingPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();
  const { subscription, isLoading, upgradeToPremium, manageBilling } = useSubscription();
  const { showToast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');

  const handleSelectPlan = async (plan: PricingPlan) => {
    // Free plan - just need to sign up
    if (plan.id === 'free') {
      if (!user) {
        router.push('/auth/signup');
      } else {
        showToast(t('pricing.messages.alreadyFree'), 'info');
      }
      return;
    }

    // Premium plans - need auth and checkout
    if (!user) {
      // Save intended plan and redirect to signup
      sessionStorage.setItem('intendedPlan', plan.id);
      router.push('/auth/signup');
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

  const getButtonText = (plan: PricingPlan) => {
    if (loadingPlan === plan.id) return t('pricing.buttons.processing');
    
    if (!user) {
      return plan.id === 'free' ? t('pricing.buttons.signUpFree') : t('pricing.buttons.startFreeTrial');
    }
    
    if (subscription?.plan === plan.id && subscription?.status === 'active') {
      return t('pricing.buttons.currentPlan');
    }
    
    if (plan.id === 'free') {
      return t('pricing.buttons.downgrade');
    }
    
    return t('pricing.buttons.upgradeNow');
  };

  const isCurrentPlan = (planId: string) => {
    return subscription?.plan === planId && subscription?.status === 'active';
  };

  // Filter plans based on billing interval
  const displayedPlans = PRICING_PLANS.filter(plan => {
    if (plan.id === 'free') return true;
    if (billingInterval === 'month') return plan.id === 'premium_monthly';
    return plan.id === 'premium_yearly';
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <DoshiMascot size="large" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('pricing.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Navbar */}
      <Navbar user={user} showUserMenu={true} />

      {/* Header */}
      <div className="pt-8 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white sm:text-5xl">
            {t('pricing.title')}
          </h1>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-400">
            {t('pricing.subtitle')}
          </p>
          
          {/* Billing toggle */}
          <div className="mt-8 flex items-center justify-center space-x-4">
            <span className={`text-sm ${billingInterval === 'month' ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-500'}`}>
              {t('pricing.billing.monthly')}
            </span>
            <button
              onClick={() => setBillingInterval(billingInterval === 'month' ? 'year' : 'month')}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary-500 transition-colors"
              aria-label="Toggle billing interval"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  billingInterval === 'year' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm ${billingInterval === 'year' ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-500'}`}>
              {t('pricing.billing.yearly')}
              <span className="ml-1 text-primary-500">{t('pricing.billing.savePercent', { percent: 25 })}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Pricing cards */}
      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {displayedPlans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl bg-white dark:bg-gray-800 shadow-lg ${
                  plan.popular ? 'ring-2 ring-primary-500' : ''
                } ${isCurrentPlan(plan.id) ? 'ring-2 ring-green-500' : ''}`}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute -top-5 left-0 right-0 mx-auto w-32">
                    <div className="rounded-full bg-gradient-to-r from-primary-500 to-primary-600 px-3 py-1 text-sm font-semibold text-white text-center">
                      {t('pricing.badges.mostPopular')}
                    </div>
                  </div>
                )}
                
                {/* Current plan badge */}
                {isCurrentPlan(plan.id) && (
                  <div className="absolute -top-5 left-0 right-0 mx-auto w-32">
                    <div className="rounded-full bg-green-500 px-3 py-1 text-sm font-semibold text-white text-center">
                      {t('pricing.badges.currentPlan')}
                    </div>
                  </div>
                )}

                <div className="p-8">
                  {/* Plan name and price */}
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {plan.name}
                  </h3>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    {plan.description}
                  </p>
                  <div className="mt-6">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      {PRICING_CONFIG.currencySymbol}{plan.price}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">/{plan.interval}</span>
                  </div>

                  {/* Features list */}
                  <ul className="mt-8 space-y-4">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <CheckIcon className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="ml-3 text-gray-700 dark:text-gray-300">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA button */}
                  <div className="mt-8">
                    <LoadingButton
                      onClick={() => handleSelectPlan(plan)}
                      isLoading={loadingPlan === plan.id}
                      disabled={isCurrentPlan(plan.id) && plan.id !== 'free'}
                      className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                        plan.popular && !isCurrentPlan(plan.id)
                          ? 'bg-primary-500 hover:bg-primary-600 text-white'
                          : isCurrentPlan(plan.id)
                          ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 cursor-not-allowed'
                          : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white'
                      }`}
                    >
                      {getButtonText(plan)}
                    </LoadingButton>
                  </div>
                </div>
              </div>
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

      {/* Trust badges */}
      <div className="border-t border-gray-200 dark:border-gray-700 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-primary-500">10K+</div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('pricing.trust.activeLearners')}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary-500">98%</div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('pricing.trust.successRate')}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary-500">24/7</div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('pricing.trust.support')}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary-500">30-day</div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('pricing.trust.moneyBack')}</div>
            </div>
          </div>
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