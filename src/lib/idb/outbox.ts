/**
 * Sync Outbox Manager
 * Agent 3 - Data & Sync
 *
 * Manages offline operations queue and sync coordination
 * Implements exponential backoff and circuit breaker patterns
 */

import { idbClient } from './client';
import { SyncOutboxItem } from './types';

export interface OutboxConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number;  // milliseconds
  circuitBreakerThreshold: number; // consecutive failures to trip
  circuitBreakerResetTime: number; // milliseconds
}

export interface OutboxStatus {
  pendingCount: number;
  failedCount: number;
  isOnline: boolean;
  isSyncing: boolean;
  circuitBreakerOpen: boolean;
  lastSyncAt?: number;
  lastError?: string;
}

// Shared interface from contracts
export function queueOp(op: {
  type: string;
  payload: any;
}): Promise<void> {
  return outboxManager.queue(op.type as any, op.payload);
}

export class OutboxManager {
  private static instance: OutboxManager | null = null;
  private config: OutboxConfig;
  private isSyncing: boolean = false;
  private consecutiveFailures: number = 0;
  private circuitBreakerOpenUntil: number = 0;
  private syncPromise: Promise<void> | null = null;
  private listeners = new Set<(status: OutboxStatus) => void>();

  private constructor() {
    this.config = {
      maxRetries: 5,
      baseDelay: 1000,      // 1 second
      maxDelay: 30000,      // 30 seconds
      circuitBreakerThreshold: 5,
      circuitBreakerResetTime: 30000 // 30 seconds
    };

    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): OutboxManager {
    if (!OutboxManager.instance) {
      OutboxManager.instance = new OutboxManager();
    }
    return OutboxManager.instance;
  }

  /**
   * Queue an operation for sync
   */
  async queue(
    type: SyncOutboxItem['type'],
    payload: any
  ): Promise<void> {
    await idbClient.queueSync(type, payload);

    // Attempt immediate sync if online
    if (this.isOnline() && !this.isCircuitBreakerOpen()) {
      this.triggerSync();
    }

    this.notifyStatusChange();
  }

  /**
   * Sync all pending operations
   */
  async sync(): Promise<void> {
    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      console.log('[Outbox] Circuit breaker is open, skipping sync');
      return;
    }

    // Check if already syncing
    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.syncPromise = this.performSync();

    try {
      await this.syncPromise;
    } finally {
      this.syncPromise = null;
    }
  }

  /**
   * Perform the actual sync
   */
  private async performSync(): Promise<void> {
    if (this.isSyncing) {
      console.log('[Outbox] Sync already in progress');
      return;
    }

    if (!this.isOnline()) {
      console.log('[Outbox] Offline, skipping sync');
      return;
    }

    this.isSyncing = true;
    this.notifyStatusChange();

    try {
      console.log('[Outbox] Starting sync...');

      const items = await idbClient.getPendingSyncItems();

      if (items.length === 0) {
        console.log('[Outbox] No items to sync');
        this.consecutiveFailures = 0; // Reset on successful empty sync
        return;
      }

      console.log(`[Outbox] Syncing ${items.length} items`);

      for (const item of items) {
        const success = await this.syncItem(item);

        if (!success) {
          // Stop on first failure (will retry later)
          break;
        }
      }

      // Reset failure count on any successful sync
      if (this.consecutiveFailures < this.config.circuitBreakerThreshold) {
        this.consecutiveFailures = 0;
      }

      console.log('[Outbox] Sync completed');

    } catch (error) {
      console.error('[Outbox] Sync failed:', error);
      this.handleSyncFailure(error);
    } finally {
      this.isSyncing = false;
      this.notifyStatusChange();
    }
  }

  /**
   * Sync a single item
   */
  private async syncItem(item: SyncOutboxItem): Promise<boolean> {
    // Check retry limit
    if (item.attempts >= this.config.maxRetries) {
      console.error(`[Outbox] Item ${item.id} exceeded max retries`);
      await this.moveToDeadLetter(item);
      return true; // Continue with other items
    }

    try {
      // Make the API call
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          opId: item.id,
          type: item.type,
          payload: item.payload,
          createdAt: item.createdAt
        })
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // Auth error - stop syncing
          console.error('[Outbox] Authentication error, stopping sync');
          this.handleAuthError();
          return false;
        }

        if (response.status === 409) {
          // Conflict - handle specially
          const conflict = await response.json();
          await this.handleConflict(item, conflict);
          await idbClient.removeSyncItem(item.id);
          return true;
        }

        if (response.status >= 500) {
          // Server error - retry
          throw new Error(`Server error: ${response.status}`);
        }

        // Client error - don't retry
        console.error(`[Outbox] Client error for ${item.id}: ${response.status}`);
        await this.moveToDeadLetter(item);
        return true;
      }

      // Success - remove from queue
      await idbClient.removeSyncItem(item.id);
      console.log(`[Outbox] Successfully synced ${item.id}`);
      return true;

    } catch (error) {
      // Network or other error - retry with backoff
      console.error(`[Outbox] Failed to sync ${item.id}:`, error);

      await idbClient.updateSyncItem(item.id, {
        attempts: item.attempts + 1,
        lastAttemptAt: Date.now(),
        error: String(error)
      });

      // Schedule retry with exponential backoff
      const delay = this.calculateBackoff(item.attempts + 1);
      setTimeout(() => this.triggerSync(), delay);

      return false;
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    const delay = Math.min(
      this.config.baseDelay * Math.pow(2, attempt - 1),
      this.config.maxDelay
    );

    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() - 0.5);

    return Math.round(delay + jitter);
  }

  /**
   * Handle sync failure
   */
  private handleSyncFailure(error: any): void {
    this.consecutiveFailures++;

    if (this.consecutiveFailures >= this.config.circuitBreakerThreshold) {
      // Trip circuit breaker
      this.circuitBreakerOpenUntil = Date.now() + this.config.circuitBreakerResetTime;
      console.error('[Outbox] Circuit breaker tripped');

      // Schedule reset
      setTimeout(() => {
        this.circuitBreakerOpenUntil = 0;
        this.consecutiveFailures = 0;
        console.log('[Outbox] Circuit breaker reset');
        this.triggerSync(); // Retry after reset
      }, this.config.circuitBreakerResetTime);
    } else {
      // Schedule retry with backoff
      const delay = this.calculateBackoff(this.consecutiveFailures);
      setTimeout(() => this.triggerSync(), delay);
    }
  }

  /**
   * Handle conflict during sync
   */
  private async handleConflict(item: SyncOutboxItem, conflict: any): Promise<void> {
    // Store conflict for resolution
    console.log(`[Outbox] Conflict detected for ${item.id}`, conflict);

    // Implementation depends on conflict resolution strategy
    // For now, use Last-Write-Wins (local wins)
    // This would be expanded based on the type of operation
  }

  /**
   * Move failed item to dead letter queue
   */
  private async moveToDeadLetter(item: SyncOutboxItem): Promise<void> {
    // In production, this would move to a separate store
    // For now, just remove it and log
    console.error('[Outbox] Moving to dead letter:', item);
    await idbClient.removeSyncItem(item.id);

    // Notify user of permanent failure
    this.notifyPermanentFailure(item);
  }

  /**
   * Handle authentication error
   */
  private handleAuthError(): void {
    // Clear auth state and redirect to login
    console.error('[Outbox] Authentication required');

    // Emit auth error event
    document.dispatchEvent(
      new CustomEvent('authRequired', {
        detail: { reason: 'sync_failed' }
      })
    );
  }

  /**
   * Notify user of permanent sync failure
   */
  private notifyPermanentFailure(item: SyncOutboxItem): void {
    document.dispatchEvent(
      new CustomEvent('syncError', {
        detail: {
          type: 'permanent',
          item: item,
          message: 'Failed to sync data after multiple retries'
        }
      })
    );
  }

  /**
   * Trigger sync (with debouncing)
   */
  private triggerSync = (() => {
    let timeoutId: NodeJS.Timeout | null = null;

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        timeoutId = null;
        this.sync();
      }, 100);
    };
  })();

  /**
   * Force immediate sync
   */
  async forceSyncAll(): Promise<void> {
    this.consecutiveFailures = 0;
    this.circuitBreakerOpenUntil = 0;
    await this.sync();
  }

  /**
   * Handle online event
   */
  private handleOnline(): void {
    console.log('[Outbox] Network online');
    this.triggerSync();
    this.notifyStatusChange();
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    console.log('[Outbox] Network offline');
    this.notifyStatusChange();
  }

  /**
   * Check if online
   */
  private isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(): boolean {
    return Date.now() < this.circuitBreakerOpenUntil;
  }

  /**
   * Get current status
   */
  async getStatus(): Promise<OutboxStatus> {
    const items = await idbClient.getPendingSyncItems();
    const failed = items.filter(i => i.attempts >= this.config.maxRetries);

    return {
      pendingCount: items.length,
      failedCount: failed.length,
      isOnline: this.isOnline(),
      isSyncing: this.isSyncing,
      circuitBreakerOpen: this.isCircuitBreakerOpen(),
      lastSyncAt: undefined, // Would track this
      lastError: undefined   // Would track this
    };
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(callback: (status: OutboxStatus) => void): () => void {
    this.listeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify status change
   */
  private async notifyStatusChange(): Promise<void> {
    const status = await this.getStatus();

    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch (error) {
        console.error('[Outbox] Listener error:', error);
      }
    }
  }
}

// Export singleton instance
export const outboxManager = OutboxManager.getInstance();