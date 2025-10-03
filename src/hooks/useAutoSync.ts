import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import logger from '@/lib/logger';

const SYNC_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes
const LAST_SYNC_KEY = 'moshimoshi:last-auto-sync';

/**
 * Auto-sync hook for background data synchronization
 *
 * Features:
 * - Throttled to max once per 5 minutes
 * - Completely silent (no UI, no toasts)
 * - Works for all authenticated users
 * - Syncs all systems (lists, gamification, kana, preferences)
 * - Queues failures for retry automatically
 *
 * Usage: Call this hook in any page where you want background sync (e.g., dashboard)
 */
export function useAutoSync() {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const hasAttemptedSync = useRef(false);

  useEffect(() => {
    // Only run once per mount
    if (hasAttemptedSync.current) return;

    // Only sync for authenticated users
    if (!user) return;

    const performAutoSync = async () => {
      try {
        // Check throttle
        const lastSyncTime = localStorage.getItem(LAST_SYNC_KEY);
        const now = Date.now();

        if (lastSyncTime) {
          const timeSinceLastSync = now - parseInt(lastSyncTime, 10);
          if (timeSinceLastSync < SYNC_THROTTLE_MS) {
            logger.info('[AutoSync] Throttled - last sync was', Math.round(timeSinceLastSync / 1000), 'seconds ago');
            return;
          }
        }

        // Mark that we've attempted sync for this mount
        hasAttemptedSync.current = true;

        logger.info('[AutoSync] Starting background sync...');

        // Import and execute sync orchestrator
        const { SyncOrchestrator } = await import('@/lib/sync/syncOrchestrator');
        const result = await SyncOrchestrator.syncAll(user, isPremium);

        // Update last sync timestamp
        localStorage.setItem(LAST_SYNC_KEY, now.toString());

        if (result.overallSuccess) {
          logger.info('[AutoSync] ✅ All systems synced successfully');
        } else {
          const failedSystems = Object.values(result.results)
            .filter(r => !r.success)
            .map(r => r.system);
          logger.warn('[AutoSync] ⚠️ Partial sync failure:', failedSystems);
          // Note: Failures are automatically queued for retry by SyncOrchestrator
        }
      } catch (error) {
        logger.error('[AutoSync] Background sync failed:', error);
        // Silent failure - will retry on next dashboard visit
      }
    };

    // Execute sync
    performAutoSync();
  }, [user, isPremium]);

  // This hook has no return value - it's fire-and-forget
}
