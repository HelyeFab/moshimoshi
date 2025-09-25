/**
 * Modal component for prompting guest users to sign in or create an account
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/I18nContext';
import Modal from '@/components/ui/Modal';
import DoshiMascot from '@/components/ui/DoshiMascot';
import {
  UserIcon,
  SparklesIcon,
  ChartBarIcon,
  CloudArrowUpIcon,
  LockClosedIcon,
  BoltIcon
} from '@heroicons/react/24/outline';

interface GuestLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
}

export function GuestLoginModal({
  isOpen,
  onClose,
  featureName
}: GuestLoginModalProps) {
  const router = useRouter();
  const { t } = useI18n();

  const handleSignIn = () => {
    // Save the feature they were trying to access for redirect after login
    if (featureName) {
      sessionStorage.setItem('redirectFeature', featureName);
    }
    router.push('/auth/signin');
    onClose();
  };

  const handleSignUp = () => {
    // Save the feature they were trying to access for redirect after signup
    if (featureName) {
      sessionStorage.setItem('redirectFeature', featureName);
    }
    router.push('/auth/signup');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="lg"
      className="max-w-2xl"
    >
      <div className="relative">
        {/* Header with mascot */}
        <div className="text-center mb-6">
          <DoshiMascot size="large" />
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-4">
            {t('entitlements.guest.title')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {featureName
              ? t('entitlements.guest.featureRequiresAccount', { feature: featureName })
              : t('entitlements.guest.subtitle')}
          </p>
        </div>

        {/* Benefits grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <ChartBarIcon className="h-6 w-6 text-primary-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('entitlements.guest.benefits.progressTracking')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('entitlements.guest.benefits.progressTrackingDesc')}
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <CloudArrowUpIcon className="h-6 w-6 text-primary-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('entitlements.guest.benefits.cloudSync')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('entitlements.guest.benefits.cloudSyncDesc')}
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <SparklesIcon className="h-6 w-6 text-primary-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('entitlements.guest.benefits.unlockFeatures')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('entitlements.guest.benefits.unlockFeaturesDesc')}
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <BoltIcon className="h-6 w-6 text-primary-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('entitlements.guest.benefits.dailyLimits')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('entitlements.guest.benefits.dailyLimitsDesc')}
              </p>
            </div>
          </div>
        </div>

        {/* Free account note */}
        <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <LockClosedIcon className="h-5 w-5 text-primary-600 dark:text-primary-400 mr-2" />
            <p className="text-sm font-medium text-primary-900 dark:text-primary-200">
              {t('entitlements.guest.freeAccountNote')}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSignUp}
            className="flex-1 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center"
          >
            <UserIcon className="h-5 w-5 mr-2" />
            {t('entitlements.guest.createAccount')}
          </button>
          <button
            onClick={handleSignIn}
            className="flex-1 px-6 py-3 bg-soft-white dark:bg-dark-800 hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-900 dark:text-white border border-gray-300 dark:border-dark-600 rounded-lg font-semibold transition-colors"
          >
            {t('entitlements.guest.signIn')}
          </button>
        </div>

        {/* Skip for now option */}
        <div className="text-center mt-4">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {t('entitlements.guest.continueAsGuest')}
          </button>
        </div>
      </div>
    </Modal>
  );
}