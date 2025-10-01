'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, Cloud, CloudOff, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/components/ui/Toast/ToastContext';
import logger from '@/lib/logger';

// Dynamic import to avoid SSR issues
let kanaProgressManager: any = null;
if (typeof window !== 'undefined') {
  import('@/utils/kanaProgressManager').then(module => {
    kanaProgressManager = module.kanaProgressManager;
  });
}
import { achievementManager } from '@/utils/achievementManager';

interface SyncProgress {
  service: string;
  status: 'pending' | 'syncing' | 'completed' | 'error';
  count?: number;
  error?: string;
}

interface SyncStatus {
  isOnline: boolean;
  syncState: 'synced' | 'syncing' | 'offline' | 'error';
  pendingCount: number;
  lastSyncTime?: Date;
  hasErrors: boolean;
  progress?: SyncProgress[];
  currentService?: string;
  completedServices?: number;
  totalServices?: number;
}

export default function SyncStatusMenuItem() {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const { showToast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,
    syncState: 'synced',
    pendingCount: 0,
    hasErrors: false
  });

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true }));
      // Auto-sync when coming back online
      if (user && isPremium) {
        attemptSync();
      }
    };

    const handleOffline = () => {
      setSyncStatus(prev => ({
        ...prev,
        isOnline: false,
        syncState: 'offline'
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial status
    setSyncStatus(prev => ({ ...prev, isOnline: navigator.onLine }));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, isPremium]);

  // Check sync queue from IndexedDB periodically
  useEffect(() => {
    const checkSyncQueue = async () => {
      try {
        const db = await openIndexedDB();
        const pendingItems = await getPendingItems(db);

        setSyncStatus(prev => ({
          ...prev,
          pendingCount: pendingItems.length,
          syncState: pendingItems.length > 0 ? 'syncing' : 'synced'
        }));
      } catch (error) {
        logger.error('Failed to check sync queue', error);
      }
    };

    const interval = setInterval(checkSyncQueue, 10000); // Check every 10 seconds
    checkSyncQueue(); // Initial check

    return () => clearInterval(interval);
  }, []);

  const openIndexedDB = async () => {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('moshimoshi-offline', 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('deadLetterQueue')) {
          db.createObjectStore('deadLetterQueue', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const getPendingItems = async (db: IDBDatabase): Promise<any[]> => {
    return new Promise((resolve) => {
      try {
        if (!db.objectStoreNames.contains('syncQueue')) {
          resolve([]);
          return;
        }

        const transaction = db.transaction(['syncQueue'], 'readonly');
        const store = transaction.objectStore('syncQueue');
        const request = store.getAll();

        request.onsuccess = () => {
          const items = request.result || [];
          resolve(items.filter(item => item.status !== 'failed'));
        };

        request.onerror = () => resolve([]);
      } catch (error) {
        logger.error('Error accessing syncQueue', error);
        resolve([]);
      }
    });
  };

  const attemptSync = useCallback(async () => {
    if (!syncStatus.isOnline) {
      return;
    }

    try {
      setSyncStatus(prev => ({ ...prev, syncState: 'syncing' }));

      // Sync review data
      const response = await fetch('/api/review/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [] }) // Will be populated from sync queue
      });

      if (response.ok) {
        setSyncStatus(prev => ({
          ...prev,
          syncState: 'synced',
          lastSyncTime: new Date(),
          pendingCount: 0,
          hasErrors: false
        }));
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      setSyncStatus(prev => ({
        ...prev,
        syncState: 'error',
        hasErrors: true
      }));
    }
  }, [syncStatus.isOnline]);

  const handleRefreshPublicContent = async () => {
    try {
      setSyncStatus(prev => ({ ...prev, syncState: 'syncing' }));

      // Trigger a router refresh to reload all data
      if (typeof window !== 'undefined') {
        window.location.reload();
      }

      showToast('Content refreshed!', 'success');
    } catch (error) {
      logger.error('Failed to refresh content', error);
      showToast('Failed to refresh content', 'error');
    }
  };

  const handleManualSync = async () => {
    setIsManualSyncing(true);

    // Initialize progress tracking
    const services: SyncProgress[] = [
      { service: 'Lists', status: 'pending' },
      { service: 'Kana Progress', status: 'pending' },
      { service: 'Achievements', status: 'pending' },
      { service: 'Streak', status: 'pending' },
      { service: 'Preferences', status: 'pending' },
      { service: 'Pokemon', status: 'pending' },
      { service: 'Video History', status: 'pending' },
      { service: 'Practice History', status: 'pending' },
      { service: 'Review Data', status: 'pending' },
    ];

    const updateProgress = (serviceName: string, status: SyncProgress['status'], count?: number, error?: string) => {
      setSyncStatus(prev => {
        const newProgress = [...services];
        const index = newProgress.findIndex(s => s.service === serviceName);
        if (index !== -1) {
          newProgress[index] = { service: serviceName, status, count, error };
        }
        const completed = newProgress.filter(s => s.status === 'completed' || s.status === 'error').length;
        return {
          ...prev,
          progress: newProgress,
          currentService: status === 'syncing' ? serviceName : prev.currentService,
          completedServices: completed,
          totalServices: services.length
        };
      });
    };

    try {
      setSyncStatus(prev => ({
        ...prev,
        syncState: 'syncing',
        progress: services,
        completedServices: 0,
        totalServices: services.length
      }));

      // For premium users, force sync all data to Firebase
      if (user && isPremium) {
        // 1. Sync user lists
        try {
          updateProgress('Lists', 'syncing');
          const { listManager } = await import('@/lib/lists/ListManager');
          const syncedCount = await listManager.syncLocalListsToServer(user.uid);
          updateProgress('Lists', 'completed', syncedCount);
          logger.info(`Synced ${syncedCount} lists to Firebase`);
        } catch (error: any) {
          logger.error('Failed to sync lists', error);
          updateProgress('Lists', 'error', undefined, error.message);
        }

        // 2. Sync kana progress
        try {
          updateProgress('Kana Progress', 'syncing');
          if (kanaProgressManager) {
            const hiraganaProgress = await kanaProgressManager.getProgress('hiragana', user, isPremium);
            const katakanaProgress = await kanaProgressManager.getProgress('katakana', user, isPremium);

            let totalSynced = 0;
            if (Object.keys(hiraganaProgress).length > 0) {
              await kanaProgressManager['syncToFirebase'](user.uid, 'hiragana', hiraganaProgress);
              totalSynced += Object.keys(hiraganaProgress).length;
            }
            if (Object.keys(katakanaProgress).length > 0) {
              await kanaProgressManager['syncToFirebase'](user.uid, 'katakana', katakanaProgress);
              totalSynced += Object.keys(katakanaProgress).length;
            }

            // Process any pending sync queue items
            await kanaProgressManager['processSyncQueue']();
            updateProgress('Kana Progress', 'completed', totalSynced);
          } else {
            updateProgress('Kana Progress', 'completed', 0);
          }
        } catch (error: any) {
          logger.error('Failed to sync kana progress', error);
          updateProgress('Kana Progress', 'error', undefined, error.message);
        }

        // 3. Sync achievements
        try {
          updateProgress('Achievements', 'syncing');
          await achievementManager.forceSyncAll(user.uid, true);
          updateProgress('Achievements', 'completed');
        } catch (error: any) {
          logger.error('Failed to sync achievements', error);
          updateProgress('Achievements', 'error', undefined, error.message);
        }

        // 4. Sync streak data
        try {
          updateProgress('Streak', 'syncing');
          const { pushStreakToFirestore } = await import('@/lib/sync/streakSync');
          await pushStreakToFirestore();
          updateProgress('Streak', 'completed');
        } catch (error: any) {
          logger.error('Failed to sync streak', error);
          updateProgress('Streak', 'error', undefined, error.message);
        }

        // 5. Sync user preferences
        try {
          updateProgress('Preferences', 'syncing');
          const { preferencesManager } = await import('@/utils/preferencesManager');
          await preferencesManager.forceSyncAll(user.uid);
          updateProgress('Preferences', 'completed');
        } catch (error: any) {
          logger.error('Failed to sync preferences', error);
          updateProgress('Preferences', 'error', undefined, error.message);
        }

        // 6. Sync Pokemon
        try {
          updateProgress('Pokemon', 'syncing');
          const { pokemonManager } = await import('@/utils/pokemonManager');
          await pokemonManager.forceSyncToCloud(user.uid, user.email);
          updateProgress('Pokemon', 'completed');
        } catch (error: any) {
          logger.error('Failed to sync Pokemon', error);
          updateProgress('Pokemon', 'error', undefined, error.message);
        }

        // 7. Sync Video History (via API)
        try {
          updateProgress('Video History', 'syncing');
          const response = await fetch('/api/sync/video-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!response.ok) throw new Error('Video history sync failed');
          updateProgress('Video History', 'completed');
        } catch (error: any) {
          logger.error('Failed to sync video history', error);
          updateProgress('Video History', 'error', undefined, error.message);
        }

        // 8. Sync Practice History (via API)
        try {
          updateProgress('Practice History', 'syncing');
          const response = await fetch('/api/sync/practice-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!response.ok) throw new Error('Practice history sync failed');
          updateProgress('Practice History', 'completed');
        } catch (error: any) {
          logger.error('Failed to sync practice history', error);
          updateProgress('Practice History', 'error', undefined, error.message);
        }

        // 9. Sync review data
        try {
          updateProgress('Review Data', 'syncing');
          await attemptSync();
          updateProgress('Review Data', 'completed');
        } catch (error: any) {
          logger.error('Failed to sync review data', error);
          updateProgress('Review Data', 'error', undefined, error.message);
        }

        const hasErrors = services.some(s => s.status === 'error');
        const completedCount = services.filter(s => s.status === 'completed').length;

        setSyncStatus(prev => ({
          ...prev,
          syncState: hasErrors ? 'error' : 'synced',
          lastSyncTime: new Date(),
          pendingCount: 0,
          hasErrors,
          currentService: undefined
        }));

        if (hasErrors) {
          showToast(`Synced ${completedCount}/${services.length} services. Some failed.`, 'warning');
        } else {
          showToast(`All ${services.length} services synced successfully!`, 'success');
        }
      } else {
        showToast('Manual sync requires premium subscription', 'info');
      }
    } catch (error) {
      logger.error('Manual sync failed', error);
      setSyncStatus(prev => ({
        ...prev,
        syncState: 'error',
        hasErrors: true,
        currentService: undefined
      }));
      showToast('Sync failed. Will retry automatically.', 'error');
    } finally {
      setIsManualSyncing(false);
    }
  };

  const getStatusIcon = () => {
    if (!syncStatus.isOnline) return <WifiOff className="w-4 h-4 text-gray-400" />;

    switch (syncStatus.syncState) {
      case 'synced':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'syncing':
        return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Cloud className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    if (!syncStatus.isOnline) return 'Offline';

    switch (syncStatus.syncState) {
      case 'synced':
        return 'Synced';
      case 'syncing':
        if (syncStatus.currentService) {
          return `${syncStatus.currentService}... (${syncStatus.completedServices}/${syncStatus.totalServices})`;
        }
        return `Syncing (${syncStatus.pendingCount})`;
      case 'error':
        return 'Sync Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <>
      {/* Main sync status row */}
      <div
        className="px-4 py-2 border-b border-gray-200 dark:border-dark-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {getStatusText()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isPremium && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleManualSync();
                }}
                disabled={!syncStatus.isOnline || isManualSyncing}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Manual sync (Premium)"
              >
                {isManualSyncing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
              </button>
            )}
            <svg
              className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-800/50">
          <div className="space-y-2 text-xs">
            {/* Connection status */}
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Connection</span>
              <div className="flex items-center gap-1">
                {syncStatus.isOnline ? (
                  <>
                    <Wifi className="w-3 h-3 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-500">Offline</span>
                  </>
                )}
              </div>
            </div>

            {/* Sync progress */}
            {syncStatus.syncState === 'syncing' && syncStatus.progress && (
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">
                    Syncing {syncStatus.completedServices}/{syncStatus.totalServices} services
                  </span>
                </div>
                {syncStatus.progress.map((item) => (
                  <div key={item.service} className="flex items-center justify-between gap-2">
                    <span className="text-gray-600 dark:text-gray-400 truncate flex-1">
                      {item.service}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.status === 'completed' && (
                        <>
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          {item.count !== undefined && (
                            <span className="text-green-600 dark:text-green-400">{item.count}</span>
                          )}
                        </>
                      )}
                      {item.status === 'syncing' && (
                        <Loader2 className="w-3 h-3 text-yellow-500 animate-spin" />
                      )}
                      {item.status === 'error' && (
                        <AlertTriangle className="w-3 h-3 text-red-500" title={item.error} />
                      )}
                      {item.status === 'pending' && (
                        <div className="w-3 h-3 rounded-full border border-gray-300 dark:border-gray-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pending items */}
            {syncStatus.pendingCount > 0 && !syncStatus.progress && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Pending</span>
                <span className="text-yellow-600 dark:text-yellow-400">
                  {syncStatus.pendingCount} items
                </span>
              </div>
            )}

            {/* Last sync */}
            {syncStatus.lastSyncTime && !syncStatus.progress && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Last sync</span>
                <span className="text-gray-600 dark:text-gray-300">
                  {formatDistanceToNow(syncStatus.lastSyncTime, { addSuffix: true })}
                </span>
              </div>
            )}

            {/* Sync errors */}
            {syncStatus.hasErrors && !syncStatus.progress && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                <p className="text-red-600 dark:text-red-400 text-xs">
                  Sync issues detected. Will retry automatically.
                </p>
              </div>
            )}

            {/* Premium notice */}
            {!isPremium && (
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                <p className="text-blue-600 dark:text-blue-400 text-xs">
                  Upgrade to Premium for manual sync & priority syncing
                </p>
              </div>
            )}

            {/* Public content refresh - available to all users */}
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-dark-700">
              <button
                onClick={handleRefreshPublicContent}
                disabled={!syncStatus.isOnline}
                className="w-full px-3 py-2 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded hover:bg-primary-100 dark:hover:bg-primary-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh Content</span>
              </button>
              <p className="mt-1 text-gray-500 dark:text-gray-400 text-xs text-center">
                Check for new stories & articles
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}