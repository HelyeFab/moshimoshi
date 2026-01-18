'use client';

import { PricingPlan } from '@/lib/stripe/types';
import { PRICING_CONFIG } from '@/config/pricing';
import { CheckIcon } from '@heroicons/react/24/outline';
import { LoadingButton } from '@/components/ui/Loading';
import { useI18n } from '@/i18n/I18nContext';

interface PricingPlanCardProps {
  plan: PricingPlan;
  onSelect: (plan: PricingPlan) => void;
  isLoading?: boolean;
  isCurrentPlan?: boolean;
  user?: any;
  variant?: 'default' | 'compact';
  className?: string;
}

export function PricingPlanCard({
  plan,
  onSelect,
  isLoading = false,
  isCurrentPlan = false,
  user,
  variant = 'default',
  className = '',
}: PricingPlanCardProps) {
  const { t } = useI18n();

  const getButtonText = () => {
    if (isLoading) return t('pricing.buttons.processing');

    if (!user) {
      return plan.id === 'free' ? t('pricing.buttons.signUpFree') : t('pricing.buttons.startFreeTrial');
    }

    if (isCurrentPlan) {
      return t('pricing.buttons.currentPlan');
    }

    if (plan.id === 'free') {
      return t('pricing.buttons.downgrade');
    }

    return t('pricing.buttons.upgradeNow');
  };

  const currencySymbol = PRICING_CONFIG.currencySymbol;

  return (
    <div
      className={`relative rounded-2xl bg-white dark:bg-gray-800 shadow-lg ${
        plan.popular ? 'ring-2 ring-primary-500' : ''
      } ${isCurrentPlan ? 'ring-2 ring-green-500' : ''} ${className}`}
    >
      {/* Popular badge */}
      {plan.popular && !isCurrentPlan && (
        <div className="absolute -top-5 left-0 right-0 mx-auto w-32">
          <div className="rounded-full bg-gradient-to-r from-primary-500 to-primary-600 px-3 py-1 text-sm font-semibold text-white text-center">
            {t('pricing.badges.mostPopular')}
          </div>
        </div>
      )}

      {/* Current plan badge */}
      {isCurrentPlan && (
        <div className="absolute -top-5 left-0 right-0 mx-auto w-32">
          <div className="rounded-full bg-green-500 px-3 py-1 text-sm font-semibold text-white text-center">
            {t('pricing.badges.currentPlan')}
          </div>
        </div>
      )}

      <div className={variant === 'compact' ? 'p-4' : 'p-8'}>
        {/* Plan name and price */}
        <h3 className={`${variant === 'compact' ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 dark:text-white`}>
          {plan.name}
        </h3>
        <p className={`${variant === 'compact' ? 'mt-1' : 'mt-2'} text-gray-600 dark:text-gray-400`}>
          {plan.description}
        </p>
        <div className={variant === 'compact' ? 'mt-2' : 'mt-6'}>
          <span className={`${variant === 'compact' ? 'text-3xl' : 'text-4xl'} font-bold text-gray-900 dark:text-white`}>
            {currencySymbol}{plan.price}
          </span>
          <span className="text-gray-600 dark:text-gray-400">/{plan.interval}</span>
        </div>

        {/* Features list */}
        <ul className={`${variant === 'compact' ? 'mt-4 space-y-2' : 'mt-8 space-y-4'}`}>
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <CheckIcon className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="ml-3 text-gray-700 dark:text-gray-300 text-sm">
                {t(feature)}
              </span>
            </li>
          ))}
        </ul>

        {/* CTA button */}
        <div className={variant === 'compact' ? 'mt-4' : 'mt-8'}>
          <LoadingButton
            onClick={() => onSelect(plan)}
            isLoading={isLoading}
            disabled={isCurrentPlan && plan.id !== 'free'}
            className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
              plan.popular && !isCurrentPlan
                ? 'bg-primary-500 hover:bg-primary-600 text-white'
                : isCurrentPlan
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 cursor-not-allowed'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white'
            }`}
          >
            {getButtonText()}
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
