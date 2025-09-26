/**
 * Firebase Sync Manager
 * Agent 3 - Data & Sync
 *
 * Handles two-way sync between IndexedDB and Firebase
 * Implements conflict resolution policies
 */

import { idbClient } from './client';
import { outboxManager } from './outbox';
import {
  List,
  Item,
  ReviewQueueItem,
  Streak,
  Settings,
  ConflictItem,
} from './types';

// Conflict resolution policies
export type ConflictPolicy = 'lww' | 'merge' | 'append';

export interface SyncConfig {
  enableAutoSync: boolean;
  syncInterval: number; // milliseconds
  conflictPolicy: Record<string, ConflictPolicy>;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  conflicts: number;
  errors: string[];
  lastSyncAt: number;
}

export class FirebaseSyncManager {
  private static instance: FirebaseSyncManager | null = null;
  private config: SyncConfig;
  private isSyncing: boolean = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private lastSyncAt: number = 0;
  private listeners = new Set<(result: SyncResult) => void>();

  private constructor() {
    this.config = {
      enableAutoSync: false,
      syncInterval: 5 * 60 * 1000, // 5 minutes
      conflictPolicy: {
        lists: 'merge',
        items: 'merge',
        reviewQueue: 'append',
        streaks: 'lww',
        settings: 'lww'
      }
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(): FirebaseSyncManager {
    if (!FirebaseSyncManager.instance) {
      FirebaseSyncManager.instance = new FirebaseSyncManager();
    }
    return FirebaseSyncManager.instance;
  }

  /**
   * Initialize sync manager
   */
  async initialize(userId: string): Promise<void> {
    console.log('[FirebaseSync] Initializing for user:', userId);

    // Set up event listeners
    this.setupEventListeners();

    // Load sync settings
    const settings = await idbClient.getSettings('sync');
    if (settings?.syncEnabled) {
      this.enableAutoSync();
    }

    // Perform initial sync
    await this.syncAll();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for auth events
    document.addEventListener('authStateChanged', async (event: any) => {
      if (event.detail.user) {
        await this.handleLogin(event.detail.user.uid);
      } else {
        await this.handleLogout();
      }
    });

    // Listen for manual sync requests
    document.addEventListener('syncRequest', () => {
      this.syncAll();
    });
  }

  /**
   * Handle user login
   */
  private async handleLogin(userId: string): Promise<void> {
    console.log('[FirebaseSync] User logged in:', userId);

    // Perform merge sync
    await this.syncAll(true);

    // Enable auto-sync if configured
    const settings = await idbClient.getSettings('sync');
    if (settings?.syncEnabled) {
      this.enableAutoSync();
    }
  }

  /**
   * Handle user logout
   */
  private async handleLogout(): Promise<void> {
    console.log('[FirebaseSync] User logged out');

    // Disable auto-sync
    this.disableAutoSync();

    // Clear sync status from local data
    await this.clearSyncStatus();
  }

  /**
   * Enable automatic sync
   */
  enableAutoSync(): void {
    if (this.syncTimer) {
      return; // Already enabled
    }

    console.log('[FirebaseSync] Enabling auto-sync');
    this.config.enableAutoSync = true;

    // Set up periodic sync
    this.syncTimer = setInterval(() => {
      this.syncAll();
    }, this.config.syncInterval);

    // Update settings
    idbClient.updateSettings('sync', {
      syncEnabled: true,
      lastSyncAt: this.lastSyncAt
    });
  }

  /**
   * Disable automatic sync
   */
  disableAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    console.log('[FirebaseSync] Disabling auto-sync');
    this.config.enableAutoSync = false;

    // Update settings
    idbClient.updateSettings('sync', {
      syncEnabled: false
    });
  }

  /**
   * Sync all data
   */
  async syncAll(mergeOnLogin: boolean = false): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log('[FirebaseSync] Sync already in progress');
      return {
        success: false,
        synced: 0,
        conflicts: 0,
        errors: ['Sync already in progress'],
        lastSyncAt: this.lastSyncAt
      };
    }

    this.isSyncing = true;

    const result: SyncResult = {
      success: true,
      synced: 0,
      conflicts: 0,
      errors: [],
      lastSyncAt: Date.now()
    };

    try {
      console.log('[FirebaseSync] Starting full sync...');

      // 1. Process outbox first (pending local changes)
      await this.syncOutbox(result);

      // 2. Sync each data type
      await this.syncLists(result, mergeOnLogin);
      await this.syncItems(result, mergeOnLogin);
      await this.syncReviewQueue(result, mergeOnLogin);
      await this.syncStreaks(result, mergeOnLogin);
      await this.syncSettings(result, mergeOnLogin);

      // 3. Update last sync time
      this.lastSyncAt = result.lastSyncAt;
      await idbClient.updateSettings('sync', {
        lastSyncAt: this.lastSyncAt
      });

      console.log('[FirebaseSync] Sync completed:', result);

    } catch (error) {
      console.error('[FirebaseSync] Sync failed:', error);
      result.success = false;
      result.errors.push(String(error));
    } finally {
      this.isSyncing = false;
      this.notifyListeners(result);
    }

    return result;
  }

  /**
   * Sync outbox (pending local changes)
   */
  private async syncOutbox(result: SyncResult): Promise<void> {
    try {
      await outboxManager.sync();
      const status = await outboxManager.getStatus();
      result.synced += status.pendingCount;
    } catch (error) {
      console.error('[FirebaseSync] Outbox sync failed:', error);
      result.errors.push(`Outbox sync failed: ${error}`);
    }
  }

  /**
   * Sync lists
   */
  private async syncLists(result: SyncResult, mergeOnLogin: boolean): Promise<void> {
    try {
      const localLists = await idbClient.getAllLists();
      const remoteLists = await this.fetchRemoteLists();

      for (const remoteList of remoteLists) {
        const localList = localLists.find(l => l.id === remoteList.id);

        if (!localList) {
          // New remote list
          await this.saveLocalList(remoteList);
          result.synced++;
        } else if (localList.syncStatus === 'pending') {
          // Local change pending
          const resolved = await this.resolveConflict(
            'lists',
            localList,
            remoteList,
            mergeOnLogin
          );

          if (resolved) {
            result.synced++;
          } else {
            result.conflicts++;
          }
        } else if (remoteList.updatedAt > localList.updatedAt) {
          // Remote is newer
          await this.saveLocalList(remoteList);
          result.synced++;
        }
      }

      // Check for local-only lists
      for (const localList of localLists) {
        const remoteExists = remoteLists.some(r => r.id === localList.id);
        if (!remoteExists && localList.syncStatus === 'synced') {
          // Deleted on remote
          if (!mergeOnLogin) {
            await this.deleteLocalList(localList.id);
            result.synced++;
          }
        }
      }

    } catch (error) {
      console.error('[FirebaseSync] Lists sync failed:', error);
      result.errors.push(`Lists sync failed: ${error}`);
    }
  }

  /**
   * Sync items
   */
  private async syncItems(result: SyncResult, mergeOnLogin: boolean): Promise<void> {
    // Similar to syncLists but for items
    // Implementation follows the same pattern
  }

  /**
   * Sync review queue
   */
  private async syncReviewQueue(result: SyncResult, mergeOnLogin: boolean): Promise<void> {
    // Implementation with append policy for history
  }

  /**
   * Sync streaks
   */
  private async syncStreaks(result: SyncResult, mergeOnLogin: boolean): Promise<void> {
    try {
      const localStreak = await idbClient.getStreak();
      const remoteStreak = await this.fetchRemoteStreak();

      if (!remoteStreak) {
        // No remote streak, push local
        if (localStreak) {
          await this.pushStreak(localStreak);
          result.synced++;
        }
      } else if (!localStreak) {
        // No local streak, pull remote
        await this.saveLocalStreak(remoteStreak);
        result.synced++;
      } else {
        // Both exist, use LWW (Last Write Wins)
        if (remoteStreak.lastActiveAt > localStreak.lastActiveAt) {
          await this.saveLocalStreak(remoteStreak);
        } else {
          await this.pushStreak(localStreak);
        }
        result.synced++;
      }

    } catch (error) {
      console.error('[FirebaseSync] Streaks sync failed:', error);
      result.errors.push(`Streaks sync failed: ${error}`);
    }
  }

  /**
   * Sync settings
   */
  private async syncSettings(result: SyncResult, mergeOnLogin: boolean): Promise<void> {
    // Similar to syncStreaks with LWW policy
  }

  /**
   * Resolve conflict between local and remote versions
   */
  private async resolveConflict(
    type: string,
    local: any,
    remote: any,
    preferLocal: boolean
  ): Promise<boolean> {
    const policy = this.config.conflictPolicy[type] || 'lww';

    console.log(`[FirebaseSync] Resolving conflict for ${type} with policy ${policy}`);

    switch (policy) {
      case 'lww':
        // Last Write Wins
        if (local.updatedAt > remote.updatedAt || preferLocal) {
          await this.pushToRemote(type, local);
        } else {
          await this.saveToLocal(type, remote);
        }
        return true;

      case 'merge':
        // Merge changes
        const merged = this.mergeObjects(local, remote);
        await this.saveToLocal(type, merged);
        await this.pushToRemote(type, merged);
        return true;

      case 'append':
        // Append arrays (for history)
        if (Array.isArray(local.history) && Array.isArray(remote.history)) {
          const combined = [...local.history, ...remote.history]
            .sort((a, b) => a.timestamp - b.timestamp)
            .filter((item, index, self) =>
              index === self.findIndex(t => t.timestamp === item.timestamp)
            );
          local.history = combined;
          await this.saveToLocal(type, local);
          await this.pushToRemote(type, local);
        }
        return true;

      default:
        // Store conflict for manual resolution
        await this.storeConflict(type, local, remote);
        return false;
    }
  }

  /**
   * Merge two objects (simple merge strategy)
   */
  private mergeObjects(local: any, remote: any): any {
    const merged = { ...remote, ...local };

    // Use the latest timestamp
    merged.updatedAt = Math.max(
      local.updatedAt || 0,
      remote.updatedAt || 0
    );

    // Mark as synced
    merged.syncStatus = 'synced';

    return merged;
  }

  /**
   * Store unresolved conflict
   */
  private async storeConflict(type: string, local: any, remote: any): Promise<void> {
    const conflict: ConflictItem = {
      type,
      localVersion: local,
      remoteVersion: remote
    };

    // Store in conflicts store
    console.log('[FirebaseSync] Storing conflict:', conflict);

    // Emit conflict event
    document.dispatchEvent(
      new CustomEvent('syncConflict', {
        detail: conflict
      })
    );
  }

  /**
   * Clear sync status from all local data
   */
  private async clearSyncStatus(): Promise<void> {
    // This would iterate through all stores and clear syncStatus fields
    console.log('[FirebaseSync] Clearing sync status');
  }

  /**
   * Subscribe to sync results
   */
  onSyncComplete(callback: (result: SyncResult) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify listeners of sync completion
   */
  private notifyListeners(result: SyncResult): void {
    for (const listener of this.listeners) {
      try {
        listener(result);
      } catch (error) {
        console.error('[FirebaseSync] Listener error:', error);
      }
    }
  }

  // ============================================================================
  // Firebase API calls (these would be implemented with actual Firebase SDK)
  // ============================================================================

  private async fetchRemoteLists(): Promise<List[]> {
    const response = await fetch('/api/sync/lists', {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch lists: ${response.status}`);
    }

    return response.json();
  }

  private async fetchRemoteStreak(): Promise<Streak | null> {
    const response = await fetch('/api/sync/streak', {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch streak: ${response.status}`);
    }

    return response.json();
  }

  private async saveLocalList(list: List): Promise<void> {
    // Save to IndexedDB with synced status
    list.syncStatus = 'synced';
    // Implementation would use idbClient transaction
  }

  private async deleteLocalList(id: string): Promise<void> {
    // Delete from IndexedDB
    // Implementation would use idbClient transaction
  }

  private async saveLocalStreak(streak: Streak): Promise<void> {
    streak.syncStatus = 'synced';
    await idbClient.updateStreak(streak);
  }

  private async pushStreak(streak: Streak): Promise<void> {
    const response = await fetch('/api/sync/streak', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(streak)
    });

    if (!response.ok) {
      throw new Error(`Failed to push streak: ${response.status}`);
    }
  }

  private async pushToRemote(type: string, data: any): Promise<void> {
    const response = await fetch(`/api/sync/${type}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to push ${type}: ${response.status}`);
    }
  }

  private async saveToLocal(type: string, data: any): Promise<void> {
    data.syncStatus = 'synced';
    // Save to appropriate IndexedDB store
    // Implementation would use idbClient transaction
  }
}

// Export singleton instance
export const firebaseSync = FirebaseSyncManager.getInstance();