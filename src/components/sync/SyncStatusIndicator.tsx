'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import logger from '@/lib/logger';
import {
  Cloud,
  CloudOff,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Activity,
  Database,
  Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from '@/lib/theme/ThemeContext';
import { LoadingSpinner } from '@/components/ui/Loading';
import DoshiMascot from '@/components/ui/DoshiMascot';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
// Dynamic import to avoid SSR issues
let kanaProgressManager: any = null;
if (typeof window !== 'undefined') {
  import('@/utils/kanaProgressManager').then(module => {
    kanaProgressManager = module.kanaProgressManager;
  });
}
import { achievementManager } from '@/utils/achievementManager';

interface SyncItem {
  id: string;
  type: 'session' | 'answer' | 'progress';
  timestamp: Date;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
}

interface SyncStatus {
  isOnline: boolean;
  syncState: 'synced' | 'syncing' | 'offline' | 'error';
  pendingItems: SyncItem[];
  deadLetterQueue: SyncItem[];
  lastSyncTime?: Date;
  circuitBreaker: CircuitBreakerState;
  syncStats: {
    successRate: number;
    avgLatency: number;
    totalSynced: number;
    totalFailed: number;
  };
}

export default function SyncStatusIndicator() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,
    syncState: 'synced',
    pendingItems: [],
    deadLetterQueue: [],
    circuitBreaker: {
      state: 'closed',
      failureCount: 0
    },
    syncStats: {
      successRate: 99.9,
      avgLatency: 45,
      totalSynced: 0,
      totalFailed: 0
    }
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const { resolvedTheme } = useTheme();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle click outside to close expanded view
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isExpanded && !(event.target as Element).closest('.sync-indicator-content')) {
        setIsExpanded(false);
      }
    };
    
    if (isExpanded) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isExpanded]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true }));
      attemptSync();
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
  }, []);

  // Monitor sync queue from IndexedDB
  useEffect(() => {
    const checkSyncQueue = async () => {
      try {
        // This would connect to your actual IndexedDB
        const db = await openIndexedDB();
        const pendingItems = await getPendingItems(db);
        const deadLetterItems = await getDeadLetterItems(db);
        
        setSyncStatus(prev => ({
          ...prev,
          pendingItems,
          deadLetterQueue: deadLetterItems,
          syncState: pendingItems.length > 0 ? 'syncing' : 'synced'
        }));
      } catch (error) {
        logger.error('Failed to check sync queue', error);
      }
    };

    const interval = setInterval(checkSyncQueue, 5000); // Check every 5 seconds
    checkSyncQueue(); // Initial check

    return () => clearInterval(interval);
  }, []);

  // Monitor circuit breaker state
  useEffect(() => {
    if (syncStatus.circuitBreaker.state === 'open' && syncStatus.circuitBreaker.nextRetryTime) {
      const timeUntilRetry = syncStatus.circuitBreaker.nextRetryTime.getTime() - Date.now();
      
      if (timeUntilRetry > 0) {
        retryTimerRef.current = setTimeout(() => {
          setSyncStatus(prev => ({
            ...prev,
            circuitBreaker: {
              ...prev.circuitBreaker,
              state: 'half-open'
            }
          }));
          attemptSync();
        }, timeUntilRetry);
      }
    }

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [syncStatus.circuitBreaker]);

  const openIndexedDB = async () => {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('moshimoshi-offline', 1);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores if they don't exist
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

  const getPendingItems = async (db: IDBDatabase): Promise<SyncItem[]> => {
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

  const getDeadLetterItems = async (db: IDBDatabase): Promise<SyncItem[]> => {
    return new Promise((resolve) => {
      try {
        if (!db.objectStoreNames.contains('deadLetterQueue')) {
          resolve([]);
          return;
        }
        
        const transaction = db.transaction(['deadLetterQueue'], 'readonly');
        const store = transaction.objectStore('deadLetterQueue');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      } catch (error) {
        logger.error('Error accessing deadLetterQueue', error);
        resolve([]);
      }
    });
  };

  const attemptSync = useCallback(async () => {
    if (!syncStatus.isOnline || syncStatus.circuitBreaker.state === 'open') {
      return;
    }

    try {
      const response = await fetch('/api/review/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: syncStatus.pendingItems })
      });

      if (response.ok) {
        // Success - reset circuit breaker
        setSyncStatus(prev => ({
          ...prev,
          syncState: 'synced',
          lastSyncTime: new Date(),
          pendingItems: [],
          circuitBreaker: {
            state: 'closed',
            failureCount: 0
          },
          syncStats: {
            ...prev.syncStats,
            successRate: Math.min(99.9, prev.syncStats.successRate + 0.1),
            totalSynced: prev.syncStats.totalSynced + prev.pendingItems.length
          }
        }));
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      handleSyncFailure();
    }
  }, [syncStatus.isOnline, syncStatus.circuitBreaker.state, syncStatus.pendingItems]);

  const handleSyncFailure = () => {
    setSyncStatus(prev => {
      const newFailureCount = prev.circuitBreaker.failureCount + 1;
      const shouldOpenCircuit = newFailureCount >= 5;
      
      return {
        ...prev,
        syncState: 'error',
        circuitBreaker: {
          state: shouldOpenCircuit ? 'open' : prev.circuitBreaker.state,
          failureCount: newFailureCount,
          lastFailureTime: new Date(),
          nextRetryTime: shouldOpenCircuit 
            ? new Date(Date.now() + 30000) // 30 seconds
            : undefined
        },
        syncStats: {
          ...prev.syncStats,
          successRate: Math.max(0, prev.syncStats.successRate - 1),
          totalFailed: prev.syncStats.totalFailed + 1
        }
      };
    });
  };

  const handleManualSync = async () => {
    setIsManualSyncing(true);

    try {
      // Reset circuit breaker for manual sync
      setSyncStatus(prev => ({
        ...prev,
        circuitBreaker: {
          state: 'closed',
          failureCount: 0
        },
        syncState: 'syncing'
      }));

      // For premium users, force sync all data to Firebase
      if (user && isPremium) {
        // Force sync both hiragana and katakana progress
        // Check if manager is loaded (client-side only)
        if (!kanaProgressManager) {
          logger.sync('Progress manager not yet loaded');
          return;
        }

        const hiraganaProgress = await kanaProgressManager.getProgress('hiragana', user, isPremium);
        const katakanaProgress = await kanaProgressManager.getProgress('katakana', user, isPremium);

        // Force sync achievements and activities
        await achievementManager.forceSyncAll(user.uid, true);

        // Force sync streak data to Firebase
        const { pushStreakToFirestore } = await import('@/lib/sync/streakSync');
        await pushStreakToFirestore();

        // This will trigger immediate sync to Firebase
        if (Object.keys(hiraganaProgress).length > 0) {
          await kanaProgressManager['syncToFirebase'](user.uid, 'hiragana', hiraganaProgress);
        }
        if (Object.keys(katakanaProgress).length > 0) {
          await kanaProgressManager['syncToFirebase'](user.uid, 'katakana', katakanaProgress);
        }

        // Also process any pending sync queue items
        await kanaProgressManager['processSyncQueue']();
      }

      // Attempt regular sync for other data
      await attemptSync();

      setSyncStatus(prev => ({
        ...prev,
        syncState: 'synced',
        lastSyncTime: new Date(),
        syncStats: {
          ...prev.syncStats,
          successRate: Math.min(99.9, prev.syncStats.successRate + 0.1)
        }
      }));
    } catch (error) {
      logger.error('Manual sync failed', error);
      handleSyncFailure();
    } finally {
      setIsManualSyncing(false);
    }
  };

  const getStatusColor = () => {
    if (!syncStatus.isOnline) return 'bg-gray-500';
    
    switch (syncStatus.syncState) {
      case 'synced':
        return 'bg-green-500';
      case 'syncing':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    if (!syncStatus.isOnline) {
      return 'Offline mode - will sync when connected';
    }
    
    switch (syncStatus.syncState) {
      case 'synced':
        return 'All changes saved';
      case 'syncing':
        return `Syncing... (${syncStatus.pendingItems.length} items pending)`;
      case 'error':
        return `Sync issues - ${syncStatus.pendingItems.length} items in retry queue`;
      default:
        return 'Unknown status';
    }
  };

  const getCircuitBreakerStatus = () => {
    switch (syncStatus.circuitBreaker.state) {
      case 'closed':
        return { text: 'Sync healthy', color: 'text-green-600' };
      case 'half-open':
        return { text: 'Sync recovering', color: 'text-yellow-600' };
      case 'open':
        const retryIn = syncStatus.circuitBreaker.nextRetryTime
          ? Math.ceil((syncStatus.circuitBreaker.nextRetryTime.getTime() - Date.now()) / 1000)
          : 0;
        return { 
          text: `Sync paused - retrying in ${retryIn}s`, 
          color: 'text-red-600' 
        };
      default:
        return { text: 'Unknown', color: 'text-gray-600' };
    }
  };

  const circuitBreakerStatus = getCircuitBreakerStatus();

  // Get Doshi mood based on sync status
  const getDoshiMood = () => {
    if (!syncStatus.isOnline) return 'sleeping';
    if (syncStatus.syncState === 'error') return 'sad';
    if (syncStatus.syncState === 'syncing') return 'thinking';
    return 'happy';
  };

  return (
    <>
      {/* Floating Indicator */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <motion.button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-14 h-14 flex items-center justify-center rounded-full shadow-lg text-white transition-all ${getStatusColor()}`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title={getStatusText()}
        >
          {syncStatus.syncState === 'synced' ? (
            <CheckCircle className="w-6 h-6" />
          ) : syncStatus.syncState === 'syncing' ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : syncStatus.syncState === 'error' ? (
            <XCircle className="w-6 h-6" />
          ) : (
            <WifiOff className="w-6 h-6" />
          )}
        </motion.button>

        {/* Expanded Details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="sync-indicator-content absolute bottom-full right-0 mb-2 w-80 bg-white dark:bg-dark-800 rounded-lg shadow-xl border border-gray-200 dark:border-dark-700 p-4"
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
            >
              {/* Doshi Mascot Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <DoshiMascot size="xsmall" variant="static" />
                  {syncStatus.isOnline ? (
                    <Wifi className="w-5 h-5 text-green-500" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-red-500" />
                  )}
                  <span className="font-medium text-gray-900 dark:text-dark-50">
                    {syncStatus.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="relative group">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleManualSync();
                    }}
                    disabled={!syncStatus.isOnline || isManualSyncing || !isPremium}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Manual sync"
                  >
                    {isManualSyncing ? (
                      <LoadingSpinner size="small" />
                    ) : (
                      <RefreshCw className="w-5 h-5" />
                    )}
                  </button>
                  {!isPremium && (
                    <div className="absolute bottom-full right-0 mb-2 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                      Manual sync is for premium users
                      <div className="absolute top-full right-4 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                    </div>
                  )}
                </div>
              </div>

              {/* Circuit Breaker Status */}
              <div className="mb-4 p-3 bg-gray-50 dark:bg-dark-900 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-gray-500 dark:text-dark-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-dark-300">
                      Circuit Breaker
                    </span>
                  </div>
                  <span className={`text-sm font-medium ${circuitBreakerStatus.color}`}>
                    {circuitBreakerStatus.text}
                  </span>
                </div>
                {syncStatus.circuitBreaker.failureCount > 0 && (
                  <div className="text-xs text-gray-500 dark:text-dark-400">
                    Failures: {syncStatus.circuitBreaker.failureCount}/5
                  </div>
                )}
              </div>

              {/* Sync Queue */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                  Sync Queue
                </h4>
                {syncStatus.pendingItems.length > 0 ? (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {syncStatus.pendingItems.slice(0, 5).map(item => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-dark-900 rounded"
                      >
                        <span className="text-xs text-gray-600 dark:text-dark-400">
                          {item.type}
                        </span>
                        <div className="flex items-center gap-2">
                          {item.status === 'syncing' && (
                            <Loader2 className="w-3 h-3 animate-spin text-primary-500" />
                          )}
                          <span className="text-xs text-gray-500 dark:text-dark-400">
                            {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    ))}
                    {syncStatus.pendingItems.length > 5 && (
                      <p className="text-xs text-gray-500 dark:text-dark-400 text-center">
                        +{syncStatus.pendingItems.length - 5} more items
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-dark-400">No pending items</p>
                )}
              </div>

              {/* Dead Letter Queue */}
              {syncStatus.deadLetterQueue.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-red-700 dark:text-red-300">
                      Failed Items ({syncStatus.deadLetterQueue.length})
                    </span>
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    These items could not be synced and require attention
                  </p>
                </div>
              )}

              {/* Sync Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-2 bg-gray-50 dark:bg-dark-900 rounded">
                  <p className="text-xs text-gray-500 dark:text-dark-400">Success Rate</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-dark-50">
                    {syncStatus.syncStats.successRate.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-dark-900 rounded">
                  <p className="text-xs text-gray-500 dark:text-dark-400">Avg Latency</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-dark-50">
                    {syncStatus.syncStats.avgLatency}ms
                  </p>
                </div>
              </div>

              {/* Last Sync Time */}
              {syncStatus.lastSyncTime && (
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-dark-400">
                  <span>Last successful sync</span>
                  <span>{formatDistanceToNow(syncStatus.lastSyncTime, { addSuffix: true })}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}