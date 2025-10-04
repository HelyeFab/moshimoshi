import logger from '@/lib/logger';
import type { User } from 'firebase/auth';

export interface SyncResult {
  system: string;
  success: boolean;
  error?: string;
}

export interface SyncOrchestratorResult {
  overallSuccess: boolean;
  results: {
    lists: SyncResult;
    gamification: SyncResult;
    kana: SyncResult;
    preferences: SyncResult;
  };
  timestamp: Date;
}

/**
 * Central sync orchestrator that coordinates all data syncing
 * Syncs: Lists, Gamification, Kana Progress, User Preferences
 */
export class SyncOrchestrator {
  /**
   * Execute a full sync across all systems
   */
  static async syncAll(user: User, isPremium: boolean): Promise<SyncOrchestratorResult> {
    const results: SyncOrchestratorResult = {
      overallSuccess: true,
      results: {
        lists: { system: 'lists', success: false },
        gamification: { system: 'gamification', success: false },
        kana: { system: 'kana', success: false },
        preferences: { system: 'preferences', success: false }
      },
      timestamp: new Date()
    };

    // 1. Sync User Lists (premium only for sync to Firebase)
    if (isPremium) {
      try {
        const { listManager } = await import('@/lib/lists/ListManager');
        const syncedCount = await listManager.syncLocalListsToServer(user.uid);
        results.results.lists.success = true;
        logger.info(`[SyncOrchestrator] Synced ${syncedCount} lists`);
      } catch (error: any) {
        results.results.lists.success = false;
        results.results.lists.error = error.message;
        results.overallSuccess = false;
        logger.error('[SyncOrchestrator] Lists sync failed:', error);
      }
    } else {
      // Free users don't sync lists to server
      results.results.lists.success = true;
    }

    // 2. Sync Gamification Data (BIDIRECTIONAL)
    try {
      const { useGamificationStore } = await import('@/state/userGamification');
      const gamificationStore = useGamificationStore.getState();

      if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION === 'true' && gamificationStore.userId) {
        // Premium users: Bidirectional sync (download THEN upload)
        if (isPremium) {
          logger.info('[SyncOrchestrator] Premium user - bidirectional gamification sync');

          // Step 1: Download latest from Firebase first
          try {
            await gamificationStore.loadFromFirebase();
            logger.info('[SyncOrchestrator] ✅ Downloaded gamification data from Firebase');
          } catch (downloadError) {
            logger.warn('[SyncOrchestrator] Firebase download failed, using local data:', downloadError);
          }

          // Step 2: Upload local changes to Firebase
          await gamificationStore.syncToFirebase();
          logger.info('[SyncOrchestrator] ✅ Uploaded gamification data to Firebase');
        } else {
          // Free users: No Firebase sync
          logger.info('[SyncOrchestrator] Free user - skipping Firebase gamification sync');
        }

        results.results.gamification.success = true;
      } else {
        // Gamification disabled or no user
        results.results.gamification.success = true;
      }
    } catch (error: any) {
      results.results.gamification.success = false;
      results.results.gamification.error = error.message;
      results.overallSuccess = false;
      logger.error('[SyncOrchestrator] Gamification sync failed:', error);
    }

    // 3. Sync Kana Progress
    try {
      // Dynamic import to avoid SSR issues
      const kanaProgressModule = await import('@/utils/kanaProgressManager');
      const kanaProgressManager = kanaProgressModule.kanaProgressManager;

      if (kanaProgressManager) {
        const hiraganaProgress = await kanaProgressManager.getProgress('hiragana', user, isPremium);
        const katakanaProgress = await kanaProgressManager.getProgress('katakana', user, isPremium);

        // Sync to Firebase if there's progress
        if (Object.keys(hiraganaProgress).length > 0) {
          await kanaProgressManager['syncToFirebase'](user.uid, 'hiragana', hiraganaProgress);
        }
        if (Object.keys(katakanaProgress).length > 0) {
          await kanaProgressManager['syncToFirebase'](user.uid, 'katakana', katakanaProgress);
        }

        // Process sync queue
        await kanaProgressManager['processSyncQueue']();

        results.results.kana.success = true;
        logger.info('[SyncOrchestrator] Synced kana progress');
      }
    } catch (error: any) {
      results.results.kana.success = false;
      results.results.kana.error = error.message;
      results.overallSuccess = false;
      logger.error('[SyncOrchestrator] Kana sync failed:', error);
    }

    // 4. Sync User Preferences
    try {
      const { preferencesManager } = await import('@/utils/preferencesManager');
      await preferencesManager.forceSyncAll(user.uid);
      results.results.preferences.success = true;
      logger.info('[SyncOrchestrator] Synced preferences');
    } catch (error: any) {
      results.results.preferences.success = false;
      results.results.preferences.error = error.message;
      results.overallSuccess = false;
      logger.error('[SyncOrchestrator] Preferences sync failed:', error);
    }

    return results;
  }

  /**
   * Get aggregate pending count across all sync queues
   */
  static async getPendingCount(): Promise<number> {
    let totalPending = 0;

    try {
      // Open main IndexedDB for sync queue
      const mainDb = await this.openIndexedDB('moshimoshi-offline');
      if (mainDb) {
        const items = await this.getPendingItems(mainDb, 'syncQueue');
        totalPending += items.length;
        mainDb.close();
      }
    } catch (error) {
      logger.error('[SyncOrchestrator] Failed to check main sync queue:', error);
    }

    try {
      // Check kana progress sync queue
      const kanaDb = await this.openIndexedDB('moshimoshi-kana-progress');
      if (kanaDb && kanaDb.objectStoreNames.contains('syncQueue')) {
        const items = await this.getPendingItems(kanaDb, 'syncQueue');
        totalPending += items.length;
        kanaDb.close();
      }
    } catch (error) {
      logger.error('[SyncOrchestrator] Failed to check kana sync queue:', error);
    }

    try {
      // Check preferences sync queue
      const prefsDb = await this.openIndexedDB('moshimoshi-preferences');
      if (prefsDb && prefsDb.objectStoreNames.contains('syncQueue')) {
        const items = await this.getPendingItems(prefsDb, 'syncQueue');
        totalPending += items.length;
        prefsDb.close();
      }
    } catch (error) {
      logger.error('[SyncOrchestrator] Failed to check preferences sync queue:', error);
    }

    return totalPending;
  }

  // Helper: Open IndexedDB
  private static async openIndexedDB(dbName: string): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(dbName);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      } catch (error) {
        resolve(null);
      }
    });
  }

  // Helper: Get pending items from a sync queue
  private static async getPendingItems(db: IDBDatabase, storeName: string): Promise<any[]> {
    return new Promise((resolve) => {
      try {
        if (!db.objectStoreNames.contains(storeName)) {
          resolve([]);
          return;
        }

        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const items = request.result || [];
          resolve(items.filter(item => item.status === 'pending' || !item.status));
        };

        request.onerror = () => resolve([]);
      } catch (error) {
        resolve([]);
      }
    });
  }
}
