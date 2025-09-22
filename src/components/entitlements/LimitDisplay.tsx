/**
 * UI Components for displaying feature limits and upgrade prompts
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/I18nContext';
import DoshiMascot from '@/components/ui/DoshiMascot';
import type { Decision } from '@/hooks/useFeature';
import { isUnlimited } from '@/lib/entitlements/policy';

interface LimitDisplayProps {
  featureName: string;
  decision: Decision | null;
  className?: string;
}

export function LimitDisplay({ featureName, decision, className = '' }: LimitDisplayProps) {
  const { t } = useI18n();
  
  if (!decision) return null;

  const remaining = decision.remaining;
  const isInfinite = isUnlimited(remaining);

  // Don't show for unlimited users
  if (isInfinite) return null;

  // Color coding based on remaining
  const getColor = () => {
    if (remaining === 0) return 'text-red-600 dark:text-red-400';
    if (remaining <= 2) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getProgressColor = () => {
    if (remaining === 0) return 'bg-red-500';
    if (remaining <= 2) return 'bg-yellow-500';
    return 'bg-primary-500';
  };

  // Calculate progress percentage (assuming max is 5 for free plan)
  const maxLimit = 5; // This should come from the plan context
  const percentage = Math.round((remaining / maxLimit) * 100);

  return (
    <div className={`p-3 rounded-lg bg-gray-50 dark:bg-dark-800 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('entitlements.limits.sessionsToday', { feature: featureName })}
        </span>
        <span className={`text-lg font-bold ${getColor()}`}>
          {t('entitlements.limits.sessionsLeft', { count: remaining })}
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2">
        <div
          className={`${getProgressColor()} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {decision.resetAtUtc && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {t('entitlements.limits.resets', { time: formatResetTime(decision.resetAtUtc) })}
        </p>
      )}
    </div>
  );
}

interface UpgradePromptProps {
  title?: string;
  message?: string;
  showDoshi?: boolean;
  doshiMood?: 'thinking' | 'sad' | 'excited';
  className?: string;
}

export function UpgradePrompt({
  title,
  message,
  showDoshi = true,
  doshiMood = 'thinking',
  className = ''
}: UpgradePromptProps) {
  const router = useRouter();
  const { t } = useI18n();

  const displayTitle = title || t('entitlements.upgrade.title');
  const displayMessage = message || t('entitlements.upgrade.message');

  return (
    <div className={`bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-lg p-6 ${className}`}>
      <div className="flex items-start gap-4">
        {showDoshi && (
          <div className="flex-shrink-0">
            <DoshiMascot size="medium" />
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            {displayTitle}
          </h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {displayMessage}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/pricing')}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
            >
              {t('entitlements.upgrade.cta.viewPricing')}
            </button>
            <button
              onClick={() => router.push('/pricing#compare')}
              className="px-4 py-2 bg-white dark:bg-dark-800 hover:bg-gray-50 dark:hover:bg-dark-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-dark-600 rounded-lg font-medium transition-colors"
            >
              {t('entitlements.upgrade.cta.learnMore')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
  resetTime?: string;
}

export function LimitReachedModal({
  isOpen,
  onClose,
  featureName,
  resetTime
}: LimitReachedModalProps) {
  const router = useRouter();
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-dark-850 rounded-xl p-6 max-w-md w-full shadow-xl">
        <div className="text-center mb-4">
          <DoshiMascot size="large" />
        </div>
        
        <h2 className="text-2xl font-bold text-center mb-3 text-gray-900 dark:text-white">
          {t('entitlements.messages.featureLimitReached')}
        </h2>
        
        <p className="text-center text-gray-600 dark:text-gray-400 mb-4">
          {t('entitlements.messages.limitReached')}
          {resetTime && ` ${t('entitlements.limits.resets', { time: formatResetTime(resetTime) })}`}
        </p>

        <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-primary-900 dark:text-primary-200 mb-2">
            {t('entitlements.upgrade.title')}
          </h3>
          <ul className="space-y-1 text-sm text-primary-800 dark:text-primary-300">
            <li>✓ {t('entitlements.upgrade.benefits.unlimited')}</li>
            <li>✓ {t('entitlements.upgrade.benefits.advancedAnalytics')}</li>
            <li>✓ {t('entitlements.upgrade.benefits.prioritySupport')}</li>
            <li>✓ {t('entitlements.upgrade.benefits.offlineMode')}</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              router.push('/pricing');
              onClose();
            }}
            className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
          >
            {t('subscription.actions.upgradeNow')}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface UsageStatsProps {
  featureName: string;
  used: number;
  limit: number;
  className?: string;
}

export function UsageStats({ featureName, used, limit, className = '' }: UsageStatsProps) {
  const { t } = useI18n();
  const isInfinite = isUnlimited(limit);
  const percentage = isInfinite ? 0 : Math.round((used / limit) * 100);

  return (
    <div className={`bg-white dark:bg-dark-800 rounded-lg p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900 dark:text-white">
          {featureName}
        </h4>
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {isInfinite ? t('entitlements.limits.unlimited') : `${used} / ${limit}`}
        </span>
      </div>
      
      {!isInfinite && (
        <div className="space-y-2">
          <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                percentage >= 100 ? 'bg-red-500' :
                percentage >= 80 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {percentage}% of daily limit used
          </p>
        </div>
      )}
      
      {isInfinite && (
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full font-medium">
            Unlimited
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Premium benefit
          </span>
        </div>
      )}
    </div>
  );
}

// Helper function to format reset time
function formatResetTime(resetAtUtc: string): string {
  const resetDate = new Date(resetAtUtc);
  const now = new Date();
  const diffMs = resetDate.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffHours > 24) {
    return `tomorrow at ${resetDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  } else if (diffHours > 0) {
    return `in ${diffHours}h ${diffMinutes}m`;
  } else if (diffMinutes > 0) {
    return `in ${diffMinutes} minutes`;
  } else {
    return 'soon';
  }
}