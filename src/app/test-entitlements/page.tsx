'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useFeature } from '@/hooks/useFeature';
import { useI18n } from '@/i18n/I18nContext';
import { GuestLoginModal } from '@/components/entitlements/GuestLoginModal';
import { InlineUpgradeModal } from '@/components/entitlements/InlineUpgradeModal';
import { LimitReachedModal } from '@/components/entitlements/LimitDisplay';
import { EntitlementGate } from '@/components/review-engine/EntitlementGate';
import Navbar from '@/components/layout/Navbar';
import DoshiMascot from '@/components/ui/DoshiMascot';
import { useToast } from '@/components/ui/Toast';

export default function TestEntitlementsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { subscription, isLoading: subLoading } = useSubscription();
  const { showToast } = useToast();

  // Modal states
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Feature hooks for testing
  const hiraganaFeature = useFeature('hiragana_practice');
  const drillFeature = useFeature('conjugation_drill');
  const kanjiFeature = useFeature('kanji_browser');

  // Check features on mount to load remaining counts
  useEffect(() => {
    const checkFeatures = async () => {
      await hiraganaFeature.checkOnly();
      await drillFeature.checkOnly();
      await kanjiFeature.checkOnly();
    };

    if (user) {
      checkFeatures();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Test functions
  const testGuestModal = () => {
    setShowGuestModal(true);
  };

  const testUpgradeModal = () => {
    setShowUpgradeModal(true);
  };

  const testLimitModal = () => {
    setShowLimitModal(true);
  };

  const testFeatureCheck = async (featureId: string) => {
    const feature = featureId === 'hiragana' ? hiraganaFeature :
                    featureId === 'drill' ? drillFeature : kanjiFeature;

    const allowed = await feature.checkAndTrack({ showUI: true });
    if (allowed) {
      showToast(`✅ Access granted for ${featureId}`, 'success');
    } else {
      showToast(`❌ Access denied for ${featureId}`, 'error');
    }
  };

  const simulateGuestUser = () => {
    // This would normally require backend changes
    showToast('To test as guest, please sign out first', 'info');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <Navbar user={user} showUserMenu={true} />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <DoshiMascot size="large" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-4">
              Entitlements System Test Page
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Test various entitlement modals and gates
            </p>
          </div>

          {/* Current State */}
          <div className="bg-soft-white dark:bg-dark-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Current State</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">User:</span>{' '}
                {user ? user.email : 'Not signed in (Guest)'}
              </div>
              <div>
                <span className="font-medium">Plan:</span>{' '}
                {subLoading ? 'Loading...' : subscription?.plan || 'guest'}
              </div>
              <div>
                <span className="font-medium">Hiragana Remaining:</span>{' '}
                {hiraganaFeature.isLoading ? 'Loading...' :
                 hiraganaFeature.remaining === -1 ? 'Unlimited' :
                 hiraganaFeature.remaining ?? 'N/A'}
              </div>
              <div>
                <span className="font-medium">Drill Remaining:</span>{' '}
                {drillFeature.isLoading ? 'Loading...' :
                 drillFeature.remaining === -1 ? 'Unlimited' :
                 drillFeature.remaining ?? 'N/A'}
              </div>
              <div>
                <span className="font-medium">Kanji Browser Remaining:</span>{' '}
                {kanjiFeature.isLoading ? 'Loading...' :
                 kanjiFeature.remaining === -1 ? 'Unlimited' :
                 kanjiFeature.remaining ?? 'N/A'}
              </div>
            </div>
          </div>

          {/* Test Modals Directly */}
          <div className="bg-soft-white dark:bg-dark-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Test Modals Directly</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={testGuestModal}
                className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
              >
                Test Guest Login Modal
              </button>
              <button
                onClick={testUpgradeModal}
                className="px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
              >
                Test Upgrade Modal
              </button>
              <button
                onClick={testLimitModal}
                className="px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors"
              >
                Test Limit Reached Modal
              </button>
            </div>
          </div>

          {/* Test Feature Checks */}
          <div className="bg-soft-white dark:bg-dark-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Test Feature Checks (Triggers Real Flow)</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              These will check and track usage, showing appropriate modals based on your current state
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => testFeatureCheck('hiragana')}
                className="px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
              >
                Check Hiragana Practice
              </button>
              <button
                onClick={() => testFeatureCheck('drill')}
                className="px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
              >
                Check Conjugation Drill
              </button>
              <button
                onClick={() => testFeatureCheck('kanji')}
                className="px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
              >
                Check Kanji Browser
              </button>
            </div>
          </div>

          {/* Test EntitlementGate */}
          <div className="bg-soft-white dark:bg-dark-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Test EntitlementGate Component</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This component will show different UI based on your access level
            </p>

            <EntitlementGate
              featureId="conjugation_drill"
              onAccessGranted={(decision) => console.log('Access granted:', decision)}
              onAccessDenied={() => console.log('Access denied')}
            >
              <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                  ✅ Access Granted!
                </h3>
                <p className="text-green-700 dark:text-green-300 mt-2">
                  You have access to this feature. This content is only visible when access is granted.
                </p>
              </div>
            </EntitlementGate>
          </div>

          {/* Modal Examples with Different Configurations */}
          <div className="bg-soft-white dark:bg-dark-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Modal Configuration Examples</h2>
            <div className="space-y-4">
              <button
                onClick={() => {
                  setShowUpgradeModal(true);
                }}
                className="w-full text-left px-4 py-3 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-lg transition-colors"
              >
                <span className="font-medium">Upgrade Modal with Usage (3/5)</span>
                <span className="block text-sm text-gray-600 dark:text-gray-400">
                  Shows current usage progress bar
                </span>
              </button>

              <button
                onClick={() => {
                  setShowGuestModal(true);
                }}
                className="w-full text-left px-4 py-3 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-lg transition-colors"
              >
                <span className="font-medium">Guest Modal for Kanji Browser</span>
                <span className="block text-sm text-gray-600 dark:text-gray-400">
                  Shows feature-specific messaging
                </span>
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
              Testing Instructions
            </h2>
            <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
              <li>• Sign out to test as a guest user</li>
              <li>• Use a free account to test upgrade modals</li>
              <li>• Use a premium account to verify unlimited access</li>
              <li>• Check browser console for debug information</li>
              <li>• The EntitlementGate section will show different UI based on your access</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modals */}
      <GuestLoginModal
        isOpen={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        featureName="Test Feature"
      />

      <InlineUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureName="Conjugation Drill"
        currentLimit={5}
        currentUsage={3}
      />

      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        featureName="Hiragana Practice"
        resetTime={new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()}
      />
    </div>
  );
}