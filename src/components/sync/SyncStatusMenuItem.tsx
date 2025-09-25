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

interface SyncStatus {
  isOnline: boolean;
  syncState: 'synced' | 'syncing' | 'offline' | 'error';
  pendingCount: number;
  lastSyncTime?: Date;
  hasErrors: boolean;
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

  const handleManualSync = async () => {
    setIsManualSyncing(true);

    try {
      setSyncStatus(prev => ({ ...prev, syncState: 'syncing' }));

      // For premium users, force sync all data to Firebase
      if (user && isPremium) {
        // Sync user lists to Firebase
        try {
          const { listManager } = await import('@/lib/lists/ListManager');
          const syncedCount = await listManager.syncLocalListsToServer(user.uid);
          if (syncedCount > 0) {
            logger.info(`Synced ${syncedCount} lists to Firebase`);
          }
        } catch (error) {
          logger.error('Failed to sync lists', error);
        }

        // Check if manager is loaded (client-side only)
        if (kanaProgressManager) {
          const hiraganaProgress = await kanaProgressManager.getProgress('hiragana', user, isPremium);
          const katakanaProgress = await kanaProgressManager.getProgress('katakana', user, isPremium);

          // Force sync achievements and activities
          await achievementManager.forceSyncAll(user.uid, true);

          // Force sync streak data to Firebase
          const { pushStreakToFirestore } = await import('@/lib/sync/streakSync');
          await pushStreakToFirestore();

          // Sync kana progress to Firebase
          if (Object.keys(hiraganaProgress).length > 0) {
            await kanaProgressManager['syncToFirebase'](user.uid, 'hiragana', hiraganaProgress);
          }
          if (Object.keys(katakanaProgress).length > 0) {
            await kanaProgressManager['syncToFirebase'](user.uid, 'katakana', katakanaProgress);
          }

          // Process any pending sync queue items
          await kanaProgressManager['processSyncQueue']();
        }

        // Force sync user preferences
        const { preferencesManager } = await import('@/utils/preferencesManager');
        await preferencesManager.forceSyncAll(user.uid);

        // Attempt regular sync
        await attemptSync();

        setSyncStatus(prev => ({
          ...prev,
          syncState: 'synced',
          lastSyncTime: new Date(),
          pendingCount: 0,
          hasErrors: false
        }));

        showToast('All data synced successfully', 'success');
      } else {
        showToast('Manual sync requires premium subscription', 'info');
      }
    } catch (error) {
      logger.error('Manual sync failed', error);
      setSyncStatus(prev => ({
        ...prev,
        syncState: 'error',
        hasErrors: true
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

            {/* Pending items */}
            {syncStatus.pendingCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Pending</span>
                <span className="text-yellow-600 dark:text-yellow-400">
                  {syncStatus.pendingCount} items
                </span>
              </div>
            )}

            {/* Last sync */}
            {syncStatus.lastSyncTime && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Last sync</span>
                <span className="text-gray-600 dark:text-gray-300">
                  {formatDistanceToNow(syncStatus.lastSyncTime, { addSuffix: true })}
                </span>
              </div>
            )}

            {/* Sync errors */}
            {syncStatus.hasErrors && (
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
          </div>
        </div>
      )}
    </>
  );
}