'use client';

import { useSubscription } from '@/hooks/useSubscription';
import { useI18n } from '@/i18n/I18nContext';
import { formatDistanceToNow } from 'date-fns';
import {
  CreditCardIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { LoadingSpinner } from '@/components/ui/Loading';
import DoshiMascot from '@/components/ui/DoshiMascot';

interface SubscriptionStatusProps {
  compact?: boolean;
  showActions?: boolean;
}

export function SubscriptionStatus({ compact = false, showActions = true }: SubscriptionStatusProps) {
  const { t } = useI18n();
  const {
    subscription,
    isLoading,
    isPremium,
    daysUntilRenewal,
    manageBilling,
    upgradeToPremium
  } = useSubscription();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <LoadingSpinner size="medium" />
      </div>
    );
  }

  if (!subscription) {
    return null;
  }

  const getStatusIcon = () => {
    switch (subscription.status) {
      case 'active':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'past_due':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'canceled':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'trialing':
        return <ClockIcon className="h-5 w-5 text-blue-500" />;
      default:
        return <CreditCardIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (subscription.status) {
      case 'active':
        return t('subscription.status.active');
      case 'past_due':
        return t('subscription.status.pastDue');
      case 'canceled':
        return t('subscription.status.canceled');
      case 'trialing':
        return t('subscription.status.trialing');
      case 'incomplete':
        return t('subscription.status.incomplete');
      default:
        return subscription.status;
    }
  };

  const getPlanDisplayName = () => {
    switch (subscription.plan) {
      case 'free':
        return t('subscription.plans.free');
      case 'premium_monthly':
        return t('subscription.plans.premiumMonthly');
      case 'premium_yearly':
        return t('subscription.plans.premiumYearly');
      default:
        return subscription.plan;
    }
  };

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        {getStatusIcon()}
        <span className="text-sm font-medium">
          {getPlanDisplayName()}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-soft-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Subscription Status
          </h3>
          
          <div className="mt-4 space-y-3">
            {/* Plan info */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Plan</span>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  {getPlanDisplayName()}
                </span>
                {getStatusIcon()}
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
              <span className={`font-medium ${
                subscription.status === 'active' ? 'text-green-600 dark:text-green-400' :
                subscription.status === 'past_due' ? 'text-yellow-600 dark:text-yellow-400' :
                subscription.status === 'canceled' ? 'text-red-600 dark:text-red-400' :
                'text-gray-900 dark:text-white'
              }`}>
                {getStatusText()}
              </span>
            </div>

            {/* Renewal date */}
            {subscription.currentPeriodEnd && isPremium && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {subscription.cancelAtPeriodEnd ? t('subscription.renewal.ends') : t('subscription.renewal.renews')}
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {daysUntilRenewal ? t('subscription.renewal.daysRemaining', { days: daysUntilRenewal }) : t('common.soon')}
                </span>
              </div>
            )}

            {/* Cancel notice */}
            {subscription.cancelAtPeriodEnd && (
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="flex">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      {t('subscription.renewal.willEndOn', {
                        date: subscription.currentPeriodEnd
                          ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })
                          : 'the end of the current period'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          {showActions && (
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              {subscription.plan === 'free' ? (
                <button
                  onClick={() => window.location.href = '/pricing'}
                  className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
                >
                  {t('subscription.actions.upgrade')}
                </button>
              ) : (
                <button
                  onClick={manageBilling}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
                >
                  {t('subscription.actions.manageBilling')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Mascot */}
        <div className="ml-4 hidden sm:block">
          <DoshiMascot
            size="small"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Inline subscription badge for navigation/header
 */
export function SubscriptionBadge() {
  const { t } = useI18n();
  const { subscription, isLoading } = useSubscription();

  if (isLoading || !subscription) {
    return null;
  }

  const getBadgeColor = () => {
    switch (subscription.plan) {
      case 'premium_yearly':
        return 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white';
      case 'premium_monthly':
        return 'bg-gradient-to-r from-primary-400 to-primary-600 text-white';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  const getBadgeText = () => {
    switch (subscription.plan) {
      case 'premium_yearly':
        return t('subscription.badges.premiumPlus');
      case 'premium_monthly':
        return t('subscription.badges.premium');
      default:
        return t('subscription.badges.free');
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBadgeColor()}`}>
      {getBadgeText()}
    </span>
  );
}

/**
 * Subscription upgrade prompt for free users
 */
export function UpgradePrompt({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  const { subscription, isFreeTier } = useSubscription();

  if (!isFreeTier) {
    return null;
  }

  return (
    <div className={`bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-lg p-6 ${className}`}>
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <DoshiMascot size="small" />
        </div>
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('subscription.upgrade.title')}
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t('subscription.upgrade.description')}
          </p>
        </div>
        <div className="ml-4">
          <a
            href="/pricing"
            className="inline-flex items-center px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
          >
            {t('subscription.actions.viewPlans')}
          </a>
        </div>
      </div>
    </div>
  );
}