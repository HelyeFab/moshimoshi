/**
 * Hook for managing entitlement-related modals (guest login, upgrade, etc.)
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import type { FeatureId } from '@/types/FeatureId';
import type { Decision } from '@/hooks/useFeature';

export type ModalType = 'guest_login' | 'upgrade' | 'limit_reached' | null;

interface EntitlementModalState {
  isOpen: boolean;
  modalType: ModalType;
  featureName?: string;
  featureId?: FeatureId;
  currentLimit?: number;
  currentUsage?: number;
  resetTime?: string;
}

interface UseEntitlementModalReturn {
  modalState: EntitlementModalState;
  showModal: (type: ModalType, options?: ShowModalOptions) => void;
  hideModal: () => void;
  determineModalType: (decision: Decision) => ModalType;
}

interface ShowModalOptions {
  featureName?: string;
  featureId?: FeatureId;
  currentLimit?: number;
  currentUsage?: number;
  resetTime?: string;
}

/**
 * Hook for managing entitlement modals based on user state and decisions
 */
export function useEntitlementModal(): UseEntitlementModalReturn {
  const { user } = useAuth();
  const { subscription, isFreeTier } = useSubscription();

  const [modalState, setModalState] = useState<EntitlementModalState>({
    isOpen: false,
    modalType: null
  });

  /**
   * Determine which modal to show based on the decision and user state
   */
  const determineModalType = useCallback((decision: Decision): ModalType => {
    // No modal needed if access is allowed
    if (decision.allow) {
      return null;
    }

    // Guest users should see login prompt
    if (!user) {
      return 'guest_login';
    }

    // Free users hitting limits should see upgrade modal
    if (isFreeTier && decision.reason === 'limit_reached') {
      return 'upgrade';
    }

    // Premium users hitting limits see the limit reached modal
    // (shouldn't happen often, but for features with limits even for premium)
    if (decision.reason === 'limit_reached') {
      return 'limit_reached';
    }

    // Default to upgrade modal for any other denial
    return 'upgrade';
  }, [user, isFreeTier]);

  /**
   * Show a specific modal with options
   */
  const showModal = useCallback((type: ModalType, options?: ShowModalOptions) => {
    if (!type) return;

    setModalState({
      isOpen: true,
      modalType: type,
      featureName: options?.featureName,
      featureId: options?.featureId,
      currentLimit: options?.currentLimit,
      currentUsage: options?.currentUsage,
      resetTime: options?.resetTime
    });

    // Track analytics event
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'entitlement_modal_shown', {
        modal_type: type,
        feature_id: options?.featureId,
        user_plan: subscription?.plan || 'guest'
      });
    }
  }, [subscription]);

  /**
   * Hide the currently open modal
   */
  const hideModal = useCallback(() => {
    setModalState({
      isOpen: false,
      modalType: null
    });
  }, []);

  return {
    modalState,
    showModal,
    hideModal,
    determineModalType
  };
}

/**
 * Helper hook to show the appropriate modal based on a decision
 */
export function useShowEntitlementModal() {
  const { showModal, determineModalType } = useEntitlementModal();
  const { getFeature } = useFeatureRegistry();

  return useCallback((decision: Decision, featureId: FeatureId) => {
    const modalType = determineModalType(decision);
    if (!modalType) return;

    const feature = getFeature(featureId);

    showModal(modalType, {
      featureId,
      featureName: feature?.name || featureId.replace('_', ' '),
      currentLimit: decision.limit,
      currentUsage: decision.usageBefore,
      resetTime: decision.resetAtUtc
    });
  }, [showModal, determineModalType, getFeature]);
}

// Helper to get feature information
function useFeatureRegistry() {
  const getFeature = useCallback((id: FeatureId) => {
    // This would ideally come from the feature registry
    // For now, return a simple transformation
    return {
      id,
      name: id.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    };
  }, []);

  return { getFeature };
}