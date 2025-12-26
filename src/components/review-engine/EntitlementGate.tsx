'use client'

/**
 * Integration component to gate review sessions with entitlements
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFeature } from '@/hooks/useFeature';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useI18n } from '@/i18n/I18nContext';
import { LimitDisplay, LimitReachedModal, UpgradePrompt } from '@/components/entitlements/LimitDisplay';
import { GuestLoginModal } from '@/components/entitlements/GuestLoginModal';
import type { FeatureId } from '@/types/FeatureId';
import type { Decision } from '@/hooks/useFeature';
import { LoadingSpinner } from '@/components/ui/Loading';
import DoshiMascot from '@/components/ui/DoshiMascot';

interface EntitlementGateProps {
  featureId: FeatureId;
  children: React.ReactNode;
  onAccessDenied?: () => void;
  onAccessGranted?: (decision: Decision) => void;
  showLimitDisplay?: boolean;
  showUpgradePrompt?: boolean;
  loadingMessage?: string;
}

export function EntitlementGate({
  featureId,
  children,
  onAccessDenied,
  onAccessGranted,
  showLimitDisplay = true,
  showUpgradePrompt = true,
  loadingMessage = 'Checking access...'
}: EntitlementGateProps) {
  const router = useRouter();
  const { language } = useI18n();
  const { user } = useAuth();
  const { isFreeTier } = useSubscription();
  const { checkOnly, remaining, isLoading, lastDecision } = useFeature(featureId);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    // Check access on mount
    const checkAccess = async () => {
      console.log('[EntitlementGate] Checking access for feature:', featureId);
      const decision = await checkOnly();
      console.log('[EntitlementGate] Decision received:', decision);
      if (decision) {
        console.log('[EntitlementGate] Setting hasAccess to:', decision.allow);
        setHasAccess(decision.allow);
        if (decision.allow) {
          onAccessGranted?.(decision);
        } else {
          onAccessDenied?.();

          // Determine which action to take based on user state
          if (!user) {
            // Guest users - show login prompt
            setShowGuestModal(true);
          } else if (isFreeTier && (decision.reason === 'limit_reached' || decision.reason === 'no_permission')) {
            // Free users hitting limits OR trying premium-only features - redirect to pricing page
            console.log('[EntitlementGate] Redirecting free user to pricing page');
            setIsRedirecting(true);
            // Pass the feature ID so pricing page knows where we came from
            router.push(`/${language}/pricing?from=${featureId}`);
          } else if (decision.reason === 'limit_reached') {
            // Premium users hitting limits (rare) - show limit modal
            setShowLimitModal(true);
          }
        }
      } else {
        // API failed - grant access by default to avoid blocking users
        console.warn('[EntitlementGate] Entitlement check failed, granting access by default');
        setHasAccess(true);
      }
    };

    checkAccess();
  }, [featureId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Loading state (includes initial load and redirecting state)
  console.log('[EntitlementGate] Render state:', { isLoading, hasAccess, featureId, lastDecision, isRedirecting });
  if (isLoading || hasAccess === null || isRedirecting) {
    console.log('[EntitlementGate] Showing loading state because:', { isLoading, hasAccessIsNull: hasAccess === null, isRedirecting });
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <LoadingSpinner size="large" />
        <p className="text-gray-600 dark:text-gray-400">
          {isRedirecting ? 'Redirecting to pricing...' : loadingMessage}
        </p>
      </div>
    );
  }

  // Access denied - show appropriate UI (only for guest users or premium users with limits)
  console.log('[EntitlementGate] Access denied state:', { hasAccess, lastDecision });
  if (!hasAccess) {
    return (
      <>
        <div className="min-h-[400px] flex flex-col items-center justify-center p-6">
          <DoshiMascot size="large" className="mb-4" />

          {lastDecision?.reason === 'limit_reached' ? (
            <>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Daily Limit Reached
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                You've used all your {featureId.replace('_', ' ')} sessions for today.
                {lastDecision.resetAtUtc && (
                  <span className="block mt-2">
                    Come back {formatResetTime(lastDecision.resetAtUtc)} for more practice!
                  </span>
                )}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Feature Unavailable
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                {lastDecision?.reason === 'no_permission'
                  ? 'This feature requires a premium subscription.'
                  : 'This feature is currently unavailable.'}
              </p>
            </>
          )}

          {showUpgradePrompt && lastDecision?.reason !== 'lifecycle_blocked' && (
            <UpgradePrompt className="max-w-lg" />
          )}
        </div>

        <GuestLoginModal
          isOpen={showGuestModal}
          onClose={() => setShowGuestModal(false)}
          featureName={featureId.replace('_practice', '').replace('_', ' ')}
        />

        <LimitReachedModal
          isOpen={showLimitModal}
          onClose={() => setShowLimitModal(false)}
          featureName={featureId.replace('_', ' ')}
          resetTime={lastDecision?.resetAtUtc}
        />
      </>
    );
  }

  // Access granted - show children with optional limit display
  return (
    <>
      {showLimitDisplay && lastDecision && remaining !== null && remaining !== -1 && (
        <LimitDisplay
          featureName={featureId.replace('_practice', '').replace('_', ' ')}
          decision={lastDecision}
          className="mb-4"
        />
      )}
      {children}
    </>
  );
}

interface ReviewSessionGateProps {
  contentType: 'hiragana' | 'katakana';
  onStartSession: () => void;
  className?: string;
}

export function ReviewSessionGate({
  contentType,
  onStartSession,
  className = ''
}: ReviewSessionGateProps) {
  const featureId = `${contentType}_practice` as FeatureId;
  const { checkAndTrack, remaining, isLoading } = useFeature(featureId);
  const [showLimitModal, setShowLimitModal] = useState(false);

  const handleStartSession = async () => {
    const allowed = await checkAndTrack({
      showUI: true,
      skipTracking: false
    });

    if (allowed) {
      onStartSession();
    } else {
      setShowLimitModal(true);
    }
  };

  return (
    <div className={className}>
      <button
        onClick={handleStartSession}
        disabled={isLoading}
        className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <LoadingSpinner size="small" />
            <span>Checking...</span>
          </>
        ) : (
          <>
            <span>Start {contentType.charAt(0).toUpperCase() + contentType.slice(1)} Practice</span>
            {remaining !== null && remaining !== -1 && (
              <span className="text-sm opacity-90">({remaining} left today)</span>
            )}
          </>
        )}
      </button>

      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        featureName={`${contentType} practice`}
      />
    </div>
  );
}

// Helper function to format reset time
function formatResetTime(resetAtUtc: string): string {
  const resetDate = new Date(resetAtUtc);
  const now = new Date();
  const diffMs = resetDate.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours > 24) {
    return 'tomorrow';
  } else if (diffHours > 0) {
    return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  } else {
    return 'soon';
  }
}