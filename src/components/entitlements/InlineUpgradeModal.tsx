/**
 * Modal component for inline upgrade prompts with compact pricing display
 */

import React, { useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useSubscription } from '@/hooks/useSubscription';
import Modal from '@/components/ui/Modal';
import DoshiMascot from '@/components/ui/DoshiMascot';
import { LoadingSpinner } from '@/components/ui/Loading';
import {
  CheckIcon,
  SparklesIcon,
  BoltIcon,
  RocketLaunchIcon
} from '@heroicons/react/24/outline';

interface InlineUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  currentLimit?: number;
  currentUsage?: number;
}

interface PricingOption {
  id: 'premium_monthly' | 'premium_yearly';
  name: string;
  price: string;
  interval: string;
  savings?: string;
  features: string[];
  popular?: boolean;
}

export function InlineUpgradeModal({
  isOpen,
  onClose,
  featureName,
  currentLimit,
  currentUsage
}: InlineUpgradeModalProps) {
  const { t } = useI18n();
  const { upgradeToPremium, isLoading } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<'premium_monthly' | 'premium_yearly'>('premium_monthly');
  const [isUpgrading, setIsUpgrading] = useState(false);

  const pricingOptions: PricingOption[] = [
    {
      id: 'premium_monthly',
      name: t('entitlements.upgrade.plans.monthly.name'),
      price: '9.99',
      interval: t('entitlements.upgrade.plans.monthly.interval'),
      features: [
        t('entitlements.upgrade.features.unlimited'),
        t('entitlements.upgrade.features.advancedStats'),
        t('entitlements.upgrade.features.prioritySupport'),
        t('entitlements.upgrade.features.offlineMode')
      ]
    },
    {
      id: 'premium_yearly',
      name: t('entitlements.upgrade.plans.yearly.name'),
      price: '89.99',
      interval: t('entitlements.upgrade.plans.yearly.interval'),
      savings: t('entitlements.upgrade.plans.yearly.savings'),
      popular: true,
      features: [
        t('entitlements.upgrade.features.unlimited'),
        t('entitlements.upgrade.features.advancedStats'),
        t('entitlements.upgrade.features.prioritySupport'),
        t('entitlements.upgrade.features.offlineMode'),
        t('entitlements.upgrade.features.earlyAccess')
      ]
    }
  ];

  const handleUpgrade = async () => {
    setIsUpgrading(true);
    try {
      await upgradeToPremium(selectedPlan);
      onClose();
    } catch (error) {
      console.error('Upgrade failed:', error);
      setIsUpgrading(false);
    }
  };

  if (isLoading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="" size="md">
        <div className="flex flex-col items-center justify-center py-12">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('entitlements.upgrade.loading')}</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="xl"
      className="max-w-4xl"
    >
      <div className="relative">
        {/* Header */}
        <div className="text-center mb-6">
          <DoshiMascot size="medium" />
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-4">
            {t('entitlements.upgrade.inline.title')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {featureName
              ? t('entitlements.upgrade.inline.featureLimit', { feature: featureName })
              : t('entitlements.upgrade.inline.subtitle')}
          </p>
        </div>

        {/* Current usage indicator */}
        {currentLimit !== undefined && currentUsage !== undefined && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                {t('entitlements.upgrade.currentUsage')}
              </span>
              <span className="text-lg font-bold text-yellow-900 dark:text-yellow-200">
                {currentUsage} / {currentLimit}
              </span>
            </div>
            <div className="mt-2 w-full bg-yellow-200 dark:bg-yellow-800 rounded-full h-2">
              <div
                className="bg-yellow-600 dark:bg-yellow-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min((currentUsage / currentLimit) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Pricing options */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {pricingOptions.map((option) => (
            <div
              key={option.id}
              onClick={() => setSelectedPlan(option.id)}
              className={`relative rounded-xl p-6 cursor-pointer transition-all ${
                selectedPlan === option.id
                  ? 'bg-primary-50 dark:bg-primary-900/30 ring-2 ring-primary-500'
                  : 'bg-soft-white dark:bg-dark-800 hover:bg-gray-50 dark:hover:bg-dark-700'
              }`}
            >
              {/* Popular badge */}
              {option.popular && (
                <div className="absolute -top-3 right-4">
                  <span className="bg-gradient-to-r from-primary-500 to-primary-600 text-white text-xs px-3 py-1 rounded-full font-semibold">
                    {t('entitlements.upgrade.badges.popular')}
                  </span>
                </div>
              )}

              {/* Radio indicator */}
              <div className="flex items-start mb-4">
                <div className={`w-5 h-5 rounded-full border-2 mr-3 mt-0.5 flex items-center justify-center ${
                  selectedPlan === option.id
                    ? 'border-primary-500 bg-primary-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {selectedPlan === option.id && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                    {option.name}
                  </h3>
                  {option.savings && (
                    <span className="inline-block mt-1 text-sm font-medium text-green-600 dark:text-green-400">
                      {option.savings}
                    </span>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  ${option.price}
                </span>
                <span className="text-gray-600 dark:text-gray-400 ml-1">
                  /{option.interval}
                </span>
              </div>

              {/* Features */}
              <ul className="space-y-2">
                {option.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <CheckIcon className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Premium benefits highlight */}
        <div className="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <SparklesIcon className="h-5 w-5 text-primary-600 dark:text-primary-400 mr-2 flex-shrink-0" />
            <p className="text-sm font-medium text-primary-900 dark:text-primary-200">
              {t('entitlements.upgrade.premiumNote')}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleUpgrade}
            disabled={isUpgrading}
            className="flex-1 px-6 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center justify-center"
          >
            {isUpgrading ? (
              <>
                <LoadingSpinner size="small" className="mr-2" />
                {t('entitlements.upgrade.processing')}
              </>
            ) : (
              <>
                <RocketLaunchIcon className="h-5 w-5 mr-2" />
                {t('entitlements.upgrade.upgradeNow')}
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isUpgrading}
            className="flex-1 px-6 py-3 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold transition-colors"
          >
            {t('entitlements.upgrade.maybeLater')}
          </button>
        </div>

        {/* Security note */}
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
          <BoltIcon className="inline h-3 w-3 mr-1" />
          {t('entitlements.upgrade.securePayment')}
        </p>
      </div>
    </Modal>
  );
}