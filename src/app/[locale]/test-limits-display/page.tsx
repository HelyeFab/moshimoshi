'use client';

/**
 * Test page to showcase all entitlement limit display components
 *
 * URL: /en/test-limits-display
 */

import React, { useState } from 'react';
import { LimitDisplay, UsageStats, UpgradePrompt, LimitReachedModal } from '@/components/entitlements/LimitDisplay';
import { ProgressBar, CircularProgress } from '@/components/ui/ProgressBar';
import type { Decision } from '@/hooks/useFeature';

export default function TestLimitsDisplayPage() {
  const [showModal, setShowModal] = useState(false);

  // Mock decisions for different states
  const fullLimitDecision: Decision = {
    allow: true,
    remaining: 5,
    reason: 'ok',
    policyVersion: 1,
    resetAtUtc: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours from now
    limit: 5,
    usageBefore: 0
  };

  const lowLimitDecision: Decision = {
    allow: true,
    remaining: 2,
    reason: 'ok',
    policyVersion: 1,
    resetAtUtc: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now
    limit: 5,
    usageBefore: 3
  };

  const noLimitDecision: Decision = {
    allow: false,
    remaining: 0,
    reason: 'limit_reached',
    policyVersion: 1,
    resetAtUtc: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    limit: 5,
    usageBefore: 5
  };

  const unlimitedDecision: Decision = {
    allow: true,
    remaining: -1,
    reason: 'ok',
    policyVersion: 1,
    limit: -1,
    usageBefore: 0
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="bg-white dark:bg-dark-850 rounded-lg p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Entitlement Limits Display Components
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Visual showcase of all limit display components used throughout the app
          </p>
        </div>

        {/* LimitDisplay Component */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            1. LimitDisplay Component
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Used under page headers in EntitlementGate. Shows remaining sessions with a progress bar.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-300">
                Full Limit (5 remaining)
              </h3>
              <LimitDisplay
                featureName="Kanji Browser"
                decision={fullLimitDecision}
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-300">
                Low Limit (2 remaining)
              </h3>
              <LimitDisplay
                featureName="News Reading"
                decision={lowLimitDecision}
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-300">
                Limit Reached (0 remaining)
              </h3>
              <LimitDisplay
                featureName="Grammar Explanations"
                decision={noLimitDecision}
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-300">
                Unlimited (Premium)
              </h3>
              <LimitDisplay
                featureName="Kanji Mastery"
                decision={unlimitedDecision}
              />
              <p className="text-sm text-gray-500 mt-2">
                (Doesn't show for unlimited users)
              </p>
            </div>
          </div>
        </div>

        {/* UsageStats Component */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            2. UsageStats Component
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Detailed usage statistics with percentage-based progress bars.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <UsageStats
              featureName="Kanji Browser"
              used={2}
              limit={5}
            />
            <UsageStats
              featureName="News Reading"
              used={4}
              limit={5}
            />
            <UsageStats
              featureName="Grammar Explanations"
              used={5}
              limit={5}
            />
            <UsageStats
              featureName="Kanji Mastery"
              used={0}
              limit={-1}
            />
            <UsageStats
              featureName="Flashcards"
              used={3}
              limit={10}
            />
            <UsageStats
              featureName="Drawing Practice"
              used={8}
              limit={10}
            />
          </div>
        </div>

        {/* Generic ProgressBar Component */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            3. Generic ProgressBar Component
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Reusable progress bar with different sizes, colors, and animations.
          </p>

          <div className="bg-white dark:bg-dark-850 rounded-lg p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                Sizes
              </h3>
              <div className="space-y-3">
                <ProgressBar value={60} size="sm" label="Small" showValue />
                <ProgressBar value={60} size="md" label="Medium" showValue />
                <ProgressBar value={60} size="lg" label="Large" showValue />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                Colors
              </h3>
              <div className="space-y-3">
                <ProgressBar value={60} color="primary" label="Primary" showValue />
                <ProgressBar value={60} color="green" label="Green" showValue />
                <ProgressBar value={60} color="blue" label="Blue" showValue />
                <ProgressBar value={60} color="yellow" label="Yellow" showValue />
                <ProgressBar value={60} color="red" label="Red" showValue />
                <ProgressBar value={60} color="gradient" label="Gradient" showValue />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                Animated & Striped
              </h3>
              <div className="space-y-3">
                <ProgressBar value={60} striped label="Striped" showValue />
                <ProgressBar value={60} striped animated label="Animated Striped" showValue />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                Usage Simulation (0% - 100%)
              </h3>
              <div className="space-y-3">
                <ProgressBar value={0} max={5} color="green" label="0 / 5 (Full limit)" showValue />
                <ProgressBar value={2} max={5} color="blue" label="2 / 5 (Good)" showValue />
                <ProgressBar value={4} max={5} color="yellow" label="4 / 5 (Running low)" showValue />
                <ProgressBar value={5} max={5} color="red" label="5 / 5 (Limit reached)" showValue />
              </div>
            </div>
          </div>
        </div>

        {/* Circular Progress */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            4. CircularProgress Component
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Circular variant for compact displays.
          </p>

          <div className="bg-white dark:bg-dark-850 rounded-lg p-6">
            <div className="flex flex-wrap gap-8 justify-center">
              <CircularProgress
                value={0}
                max={5}
                label="0 / 5 available"
                color="green"
              />
              <CircularProgress
                value={2}
                max={5}
                label="2 / 5 used"
                color="blue"
              />
              <CircularProgress
                value={4}
                max={5}
                label="4 / 5 used"
                color="yellow"
              />
              <CircularProgress
                value={5}
                max={5}
                label="5 / 5 used"
                color="red"
              />
            </div>
          </div>
        </div>

        {/* Upgrade Prompt */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            5. UpgradePrompt Component
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Shown when users hit limits or try to access premium features.
          </p>

          <UpgradePrompt />
        </div>

        {/* Limit Reached Modal */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            6. LimitReachedModal Component
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Modal shown when users reach their daily/monthly limits.
          </p>

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
          >
            Show Limit Reached Modal
          </button>

          <LimitReachedModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            featureName="Kanji Browser"
            resetTime={new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()}
          />
        </div>

        {/* Code Examples */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            7. Usage Examples
          </h2>

          <div className="bg-gray-900 dark:bg-dark-950 rounded-lg p-6 overflow-x-auto">
            <pre className="text-sm text-gray-100">
              <code>{`// LimitDisplay - Shows under page headers
<LimitDisplay
  featureName="Kanji Browser"
  decision={decision}
  className="mb-4"
/>

// UsageStats - Detailed stats card
<UsageStats
  featureName="News Reading"
  used={3}
  limit={5}
/>

// ProgressBar - Generic progress bar
<ProgressBar
  value={3}
  max={5}
  label="Daily Usage"
  showValue
  color="primary"
/>

// CircularProgress - Circular variant
<CircularProgress
  value={3}
  max={5}
  label="Sessions remaining"
  color="blue"
/>

// Used in EntitlementGate
<EntitlementGate
  featureId="kanji_browser"
  showLimitDisplay={true}  // Shows LimitDisplay at top
>
  <YourPageContent />
</EntitlementGate>`}</code>
            </pre>
          </div>
        </div>

        {/* Component Locations */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-900 dark:text-blue-200 mb-3">
            📁 Component Locations
          </h3>
          <ul className="space-y-2 text-sm font-mono text-blue-800 dark:text-blue-300">
            <li>• src/components/entitlements/LimitDisplay.tsx</li>
            <li>• src/components/ui/ProgressBar.tsx</li>
            <li>• src/components/review-engine/EntitlementGate.tsx</li>
            <li>• src/hooks/useFeature.ts</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
