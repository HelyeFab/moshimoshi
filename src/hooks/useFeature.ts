/**
 * Client-side hook for feature entitlement checks
 * Works with the /api/usage/[featureId] endpoint
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import { useSubscription } from '@/hooks/useSubscription';
import { useI18n } from '@/i18n/I18nContext';
import type { FeatureId } from '@/types/FeatureId';
import { isUnlimited } from '@/lib/entitlements/policy';

export interface Decision {
  allow: boolean;
  remaining: number | -1;
  reason: 'ok' | 'no_permission' | 'limit_reached' | 'lifecycle_blocked';
  policyVersion: number;
  resetAtUtc?: string;
}

export interface CheckOptions {
  showUI?: boolean;
  skipTracking?: boolean;
  silent?: boolean;
}

interface UseFeatureReturn {
  checkAndTrack: (options?: CheckOptions) => Promise<boolean>;
  checkOnly: () => Promise<Decision | null>;
  remaining: number | null;
  isLoading: boolean;
  lastDecision: Decision | null;
  refresh: () => Promise<void>;
}

// Cache for decisions to reduce API calls
const decisionCache = new Map<string, { decision: Decision; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache

export function useFeature(featureId: FeatureId): UseFeatureReturn {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastDecision, setLastDecision] = useState<Decision | null>(null);
  const { showToast } = useToast();
  const { t } = useI18n();
  const router = useRouter();
  const { subscription, isPremium } = useSubscription();
  const idempotencyKeyRef = useRef<string | null>(null);

  // Clear cache when subscription changes
  useEffect(() => {
    if (subscription) {
      decisionCache.delete(featureId);
    }
  }, [subscription?.plan, subscription?.status, featureId]);

  // Generate idempotency key for atomic operations
  const generateIdempotencyKey = useCallback(() => {
    return `${featureId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, [featureId]);

  // Check cache first
  const getCachedDecision = useCallback((): Decision | null => {
    const cached = decisionCache.get(featureId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.decision;
    }
    decisionCache.delete(featureId);
    return null;
  }, [featureId]);

  // Cache decision
  const cacheDecision = useCallback((decision: Decision) => {
    decisionCache.set(featureId, {
      decision,
      timestamp: Date.now()
    });
  }, [featureId]);

  // Format reset time for display
  const formatResetTime = useCallback((resetAtUtc?: string): string => {
    if (!resetAtUtc) return '';
    
    const resetDate = new Date(resetAtUtc);
    const now = new Date();
    const diffMs = resetDate.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
    } else {
      return 'soon';
    }
  }, []);

  // Check only (no tracking)
  const checkOnly = useCallback(async (): Promise<Decision | null> => {
    // Check cache first
    const cached = getCachedDecision();
    if (cached) {
      setRemaining(cached.remaining);
      setLastDecision(cached);
      return cached;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/usage/${featureId}/check`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to check entitlement');
      }

      const decision: Decision = await response.json();
      setRemaining(decision.remaining);
      setLastDecision(decision);
      cacheDecision(decision);
      return decision;
    } catch (error) {
      console.error('Failed to check feature entitlement:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [featureId, getCachedDecision, cacheDecision]);

  // Check and track (with increment)
  const checkAndTrack = useCallback(async (options: CheckOptions = {}): Promise<boolean> => {
    const { showUI = true, skipTracking = false, silent = false } = options;

    try {
      setIsLoading(true);

      // If skip tracking, just check
      if (skipTracking) {
        const decision = await checkOnly();
        return decision?.allow ?? false;
      }

      // Generate idempotency key for this operation
      const idempotencyKey = generateIdempotencyKey();
      idempotencyKeyRef.current = idempotencyKey;

      // Call increment API
      const response = await fetch(`/api/usage/${featureId}/increment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idempotencyKey }),
      });

      if (!response.ok) {
        throw new Error('Failed to track usage');
      }

      const decision: Decision = await response.json();
      setRemaining(decision.remaining);
      setLastDecision(decision);
      
      // Clear cache after increment
      decisionCache.delete(featureId);

      // Handle UI feedback based on decision
      if (showUI && !silent) {
        if (!decision.allow) {
          switch (decision.reason) {
            case 'limit_reached':
              const resetIn = formatResetTime(decision.resetAtUtc);
              showToast(
                t('entitlements.messages.limitReachedWithTime', {
                  feature: featureId.replace('_', ' '),
                  time: resetIn
                }),
                'warning',
                5000,
                {
                  label: t('subscription.actions.upgrade'),
                  onClick: () => router.push('/pricing')
                }
              );
              break;
            case 'no_permission':
              showToast(
                t('entitlements.messages.upgradeRequired'),
                'error',
                5000,
                {
                  label: t('subscription.actions.viewPlans'),
                  onClick: () => router.push('/pricing')
                }
              );
              break;
            case 'lifecycle_blocked':
              showToast(
                t('entitlements.messages.featureUnavailable'),
                'info'
              );
              break;
          }
        } else if (decision.remaining > 0 && decision.remaining <= 2 && !isUnlimited(decision.remaining)) {
          // Warn when running low
          showToast(
            t('entitlements.messages.runningLow', {
              count: decision.remaining,
              feature: featureId.replace('_', ' ')
            }),
            'info',
            3000
          );
        }
      }

      return decision.allow;
    } catch (error) {
      console.error('Failed to check and track feature:', error);
      if (showUI && !silent) {
        showToast(t('entitlements.messages.checkFailed'), 'error');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [featureId, checkOnly, generateIdempotencyKey, showToast, router, formatResetTime]);

  // Refresh decision (clear cache and re-check)
  const refresh = useCallback(async () => {
    decisionCache.delete(featureId);
    await checkOnly();
  }, [featureId, checkOnly]);

  return {
    checkAndTrack,
    checkOnly,
    remaining,
    isLoading,
    lastDecision,
    refresh,
  };
}

// Hook for checking multiple features at once
export function useFeatures(featureIds: FeatureId[]): Record<FeatureId, UseFeatureReturn> {
  const features: Record<string, UseFeatureReturn> = {};
  
  for (const id of featureIds) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    features[id] = useFeature(id);
  }
  
  return features as Record<FeatureId, UseFeatureReturn>;
}

// Utility to check if user has unlimited access
export function useHasUnlimitedAccess(featureId: FeatureId): boolean {
  const { lastDecision } = useFeature(featureId);
  return lastDecision ? isUnlimited(lastDecision.remaining) : false;
}