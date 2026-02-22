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
import { getFeature } from '@/lib/features/registry';
import { getSnapshotPolicyVersion, getValidatedEntitlementsSnapshot, isFeatureUnlimitedForPlan, isOffline, mapSnapshotTierToPlan } from '@/lib/pwa/offline-entitlements';
import { getOfflineUsageDelta, getUsageSnapshotEntry, incrementOfflineUsageDelta, markOfflineItemSeen, hasOfflineItemSeen, syncOfflineUsageDelta, updateUsageSnapshotEntry, updateUsageSnapshotFromDecision } from '@/lib/pwa/offline-usage';

export interface Decision {
  allow: boolean;
  remaining: number | -1;
  reason: 'ok' | 'no_permission' | 'limit_reached' | 'lifecycle_blocked';
  policyVersion: number;
  resetAtUtc?: string;
  limit?: number;
  usageBefore?: number;
  currentUsage?: number;
  incremented?: boolean;
}

export interface CheckOptions {
  showUI?: boolean;
  skipTracking?: boolean;
  silent?: boolean;
  metadata?: UsageMetadata;
}

interface UseFeatureReturn {
  checkAndTrack: (options?: CheckOptions) => Promise<boolean>;
  checkOnly: (options?: CheckOnlyOptions) => Promise<Decision>;
  remaining: number | null;
  isLoading: boolean;
  lastDecision: Decision | null;
  refresh: () => Promise<void>;
}

// Cache for decisions to reduce API calls
const decisionCache = new Map<string, { decision: Decision; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache
let networkListenersAttached = false;

interface CheckOnlyOptions {
  failOpen?: boolean;
  metadata?: UsageMetadata;
}

interface UsageMetadata {
  boardId?: string;
  itemId?: string;
}

const UNIQUE_ITEM_FEATURES = new Set<FeatureId>([
  'kanji_mood_board',
  'news',
  'story',
  'books',
  'comics',
  'kanji_connection',
  'textbook_vocabulary',
  'kanji_drawing_practice',
]);

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
      decisionCache.clear();
    }
  }, [subscription?.plan, subscription?.status, featureId]);

  // Generate idempotency key for atomic operations
  const generateIdempotencyKey = useCallback(() => {
    return `${featureId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, [featureId]);

  // Check cache first
  const getCacheKey = useCallback(() => {
    return `${featureId}:${isOffline() ? 'offline' : 'online'}`;
  }, [featureId]);

  const getCachedDecision = useCallback((): Decision | null => {
    const cached = decisionCache.get(getCacheKey());
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.decision;
    }
    decisionCache.delete(getCacheKey());
    return null;
  }, [featureId, getCacheKey]);

  // Cache decision
  const cacheDecision = useCallback((decision: Decision) => {
    decisionCache.set(getCacheKey(), {
      decision,
      timestamp: Date.now()
    });
  }, [featureId, getCacheKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (networkListenersAttached) return;
    networkListenersAttached = true;

    const handleConnectivityChange = () => {
      decisionCache.clear();
      if (navigator.onLine) {
        syncOfflineUsageDelta().catch(error =>
          console.warn('[useFeature] Failed to sync offline usage:', error)
        );
      }
    };

    window.addEventListener('online', handleConnectivityChange);
    window.addEventListener('offline', handleConnectivityChange);
    handleConnectivityChange();
  }, []);

  // Format reset time for display
  const formatResetTime = useCallback((resetAtUtc?: string): string => {
    if (!resetAtUtc) return '';

    const limitType = getFeature(featureId)?.limitType;
    if (limitType === 'monthly') {
      return t('entitlements.limits.resetsNextMonth');
    }

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
  }, [featureId, t]);

  // Check only (no tracking)
  const checkOnly = useCallback(async (options: CheckOnlyOptions = {}): Promise<Decision> => {
    const { failOpen = true, metadata } = options;
    const uniqueItemId = metadata?.boardId ?? metadata?.itemId;
    const shouldDedupe = UNIQUE_ITEM_FEATURES.has(featureId);
    const shouldUseCache = !(shouldDedupe && uniqueItemId);
    if (shouldUseCache) {
      const cached = getCachedDecision();
      if (cached) {
        setRemaining(cached.remaining);
        setLastDecision(cached);
        return cached;
      }
    }

    if (isOffline()) {
      const snapshot = await getValidatedEntitlementsSnapshot();
      if (!snapshot) {
        const denied: Decision = {
          allow: false,
          remaining: 0,
          reason: 'lifecycle_blocked',
          policyVersion: getSnapshotPolicyVersion(null)
        };
        setLastDecision(denied);
        setRemaining(0);
        if (shouldUseCache) {
          cacheDecision(denied);
        }
        return denied;
      }

      const plan = mapSnapshotTierToPlan(snapshot.tier);
      const policyVersion = getSnapshotPolicyVersion(snapshot);

      if (isFeatureUnlimitedForPlan(featureId, plan)) {
        const unlimitedDecision: Decision = {
          allow: true,
          remaining: -1,
          reason: 'ok',
          policyVersion
        };
        setLastDecision(unlimitedDecision);
        setRemaining(-1);
        if (shouldUseCache) {
          cacheDecision(unlimitedDecision);
        }
        return unlimitedDecision;
      }

      const entry = getUsageSnapshotEntry(featureId);
      if (!entry || !entry.resetAtUtc) {
        const denied: Decision = {
          allow: false,
          remaining: 0,
          reason: 'lifecycle_blocked',
          policyVersion
        };
        setLastDecision(denied);
        setRemaining(0);
        if (shouldUseCache) {
          cacheDecision(denied);
        }
        return denied;
      }

      const resetAtMs = Date.parse(entry.resetAtUtc);
      if (Number.isNaN(resetAtMs) || resetAtMs <= Date.now()) {
        const denied: Decision = {
          allow: false,
          remaining: 0,
          reason: 'lifecycle_blocked',
          policyVersion,
          resetAtUtc: entry.resetAtUtc,
          limit: entry.limit,
          usageBefore: entry.used
        };
        setLastDecision(denied);
        setRemaining(0);
        if (shouldUseCache) {
          cacheDecision(denied);
        }
        return denied;
      }

      if (shouldDedupe && uniqueItemId) {
        if (hasOfflineItemSeen(featureId, uniqueItemId, entry.resetAtUtc)) {
          const allowedRepeat: Decision = {
            allow: true,
            remaining: Math.max(0, entry.limit - (entry.used + getOfflineUsageDelta(featureId))),
            reason: 'ok',
            policyVersion,
            resetAtUtc: entry.resetAtUtc,
            limit: entry.limit,
            usageBefore: entry.used
          };
          setLastDecision(allowedRepeat);
          setRemaining(allowedRepeat.remaining);
          if (shouldUseCache) {
            cacheDecision(allowedRepeat);
          }
          return allowedRepeat;
        }
      }

      const usedEffective = entry.used + getOfflineUsageDelta(featureId);
      const remaining = Math.max(0, entry.limit - usedEffective);
      const offlineDecision: Decision = {
        allow: remaining > 0,
        remaining,
        reason: remaining > 0 ? 'ok' : 'limit_reached',
        policyVersion,
        resetAtUtc: entry.resetAtUtc,
        limit: entry.limit,
        usageBefore: entry.used
      };
      setLastDecision(offlineDecision);
      setRemaining(offlineDecision.remaining);
      if (shouldUseCache) {
        cacheDecision(offlineDecision);
      }
      return offlineDecision;
    }

    try {
      setIsLoading(true);
      const query = uniqueItemId ? `?itemId=${encodeURIComponent(uniqueItemId)}` : '';
      const response = await fetch(`/api/usage/${featureId}/check${query}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (!failOpen) {
          console.warn('[useFeature] API check failed, denying access (fail-closed).');
          const fallbackDecision: Decision = {
            allow: false,
            remaining: 0,
            reason: 'lifecycle_blocked',
            policyVersion: 1
          };
          setLastDecision(fallbackDecision);
          setRemaining(0);
          return fallbackDecision;
        }

        // API failed - return fallback decision with fail-open policy
        console.warn('[useFeature] API check failed, falling back to allow access');
        const fallbackDecision: Decision = {
          allow: true,
          remaining: -1,
          reason: 'ok',
          policyVersion: 1
        };
        setLastDecision(fallbackDecision);
        setRemaining(-1);
        if (shouldUseCache) {
          cacheDecision(fallbackDecision);
        }
        return fallbackDecision;
      }

      const decision: Decision = await response.json();
      updateUsageSnapshotFromDecision(featureId, decision, false);
      setRemaining(decision.remaining);
      setLastDecision(decision);
      if (shouldUseCache) {
        cacheDecision(decision);
      }
      return decision;
    } catch (error) {
      console.error('Failed to check feature entitlement:', error);
      if (!failOpen) {
        const fallbackDecision: Decision = {
          allow: false,
          remaining: 0,
          reason: 'lifecycle_blocked',
          policyVersion: 1
        };
        setLastDecision(fallbackDecision);
        setRemaining(0);
        return fallbackDecision;
      }

      // Network error - return fallback decision with fail-open policy
      const fallbackDecision: Decision = {
        allow: true,
        remaining: -1,
        reason: 'ok',
        policyVersion: 1
      };
      setLastDecision(fallbackDecision);
      setRemaining(-1);
      if (shouldUseCache) {
        cacheDecision(fallbackDecision);
      }
      return fallbackDecision;
    } finally {
      setIsLoading(false);
    }
  }, [featureId, getCachedDecision, cacheDecision]);

  // Listen for cross-instance usage updates (e.g. FeatureUsageIndicator refresh)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.featureId || detail.featureId === featureId) {
        decisionCache.delete(getCacheKey());
        checkOnly({}).catch(() => {});
      }
    };
    window.addEventListener('feature-usage-updated', handler);
    return () => window.removeEventListener('feature-usage-updated', handler);
  }, [featureId, getCacheKey, checkOnly]);

  // Check and track (with increment)
  const checkAndTrack = useCallback(async (options: CheckOptions = {}): Promise<boolean> => {
    const { showUI = true, skipTracking = false, silent = false, metadata } = options;
    const uniqueItemId = metadata?.boardId ?? metadata?.itemId;
    const shouldDedupe = UNIQUE_ITEM_FEATURES.has(featureId);

    try {
      setIsLoading(true);

      if (isOffline()) {
        const decision = await checkOnly({ failOpen: false, metadata });
        if (decision.allow && !skipTracking) {
          const entry = getUsageSnapshotEntry(featureId);
          if (entry) {
            let incremented = true;
            if (shouldDedupe && uniqueItemId) {
              incremented = markOfflineItemSeen(featureId, uniqueItemId, entry.resetAtUtc);
            }

            if (incremented) {
              updateUsageSnapshotEntry(featureId, {
                ...entry,
                used: entry.used + 1
              });
              incrementOfflineUsageDelta(featureId, 1);
              const remainingAfter = decision.remaining === -1 ? -1 : Math.max(0, decision.remaining - 1);
              const updatedDecision = { ...decision, remaining: remainingAfter };
              setRemaining(updatedDecision.remaining);
              setLastDecision(updatedDecision);
              cacheDecision(updatedDecision);
            } else {
              setRemaining(decision.remaining);
              setLastDecision(decision);
              cacheDecision(decision);
            }
          }
        }
        return decision.allow;
      }

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
        body: JSON.stringify({ idempotencyKey, itemId: uniqueItemId }),
      });

      if (!response.ok) {
        throw new Error('Failed to track usage');
      }

      const decision: Decision = await response.json();
      updateUsageSnapshotFromDecision(
        featureId,
        decision,
        decision.incremented ?? true
      );
      setRemaining(decision.remaining);
      setLastDecision(decision);
      
      // Clear cache after increment
      decisionCache.delete(getCacheKey());

      // Handle UI feedback based on decision
      if (showUI && !silent) {
        if (!decision.allow) {
          switch (decision.reason) {
            case 'limit_reached':
              const limitType = getFeature(featureId)?.limitType;
              // Only show upgrade action if not already premium
              const toastAction = !isPremium ? {
                label: t('subscription.actions.upgrade'),
                onClick: () => router.push('/pricing')
              } : undefined;

              const isMonthly = limitType === 'monthly';
              const isLookupFeature = featureId === 'word_lookup' || featureId === 'kanji_lookup';
              const messageKey = isMonthly
                ? 'entitlements.messages.limitReachedMonthlyWithTime'
                : isLookupFeature
                  ? 'entitlements.messages.lookupLimitReached'
                  : 'entitlements.messages.limitReached';

              const message = isMonthly
                ? t(messageKey, {
                    feature: featureId.replace('_', ' '),
                    time: formatResetTime(decision.resetAtUtc)
                  })
                : t(messageKey);

              showToast(
                message,
                'warning',
                5000,
                toastAction
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
    decisionCache.delete(getCacheKey());
    await checkOnly();
  }, [featureId, checkOnly, getCacheKey]);

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
