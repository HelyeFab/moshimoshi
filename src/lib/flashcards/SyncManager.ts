import { openDB, IDBPDatabase } from 'idb';
import type { FlashcardDeck } from '@/types/flashcards';

interface SyncQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete' | 'addCard' | 'removeCard' | 'updateCard';
  deckId?: string;
  data: any;
  timestamp: number;
  retryCount: number;
  lastError?: string;
  userId: string;
}

interface SyncDB {
  syncQueue: SyncQueueItem;
  conflicts: {
    id: string;
    localDeck: FlashcardDeck;
    remoteDeck: FlashcardDeck;
    timestamp: number;
    resolution?: 'local' | 'remote' | 'merge';
  };
}

export class SyncManager {
  private db: IDBPDatabase<SyncDB> | null = null;
  private syncInProgress = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private maxRetries = 5;
  private baseRetryDelay = 1000; // 1 second
  private maxRetryDelay = 30000; // 30 seconds
  private circuitBreakerFailures = 0;
  private circuitBreakerThreshold = 5;
  private circuitBreakerResetTime = 60000; // 1 minute
  private circuitBreakerOpen = false;
  private circuitBreakerTimer: NodeJS.Timeout | null = null;

  // Initialize the sync database
  private async initDB(): Promise<IDBPDatabase<SyncDB>> {
    if (this.db) return this.db;

    this.db = await openDB<SyncDB>('FlashcardSyncDB', 1, {
      upgrade(db) {
        // Sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('timestamp', 'timestamp');
          syncStore.createIndex('userId', 'userId');
          syncStore.createIndex('retryCount', 'retryCount');
        }

        // Conflicts store
        if (!db.objectStoreNames.contains('conflicts')) {
          const conflictStore = db.createObjectStore('conflicts', { keyPath: 'id' });
          conflictStore.createIndex('timestamp', 'timestamp');
        }
      }
    });

    return this.db;
  }

  // Add an operation to the sync queue
  async queueOperation(operation: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const db = await this.initDB();
    const id = `${operation.action}_${operation.deckId || 'batch'}_${Date.now()}_${Math.random()}`;

    const queueItem: SyncQueueItem = {
      id,
      ...operation,
      timestamp: Date.now(),
      retryCount: 0
    };

    await db.put('syncQueue', queueItem);

    // Trigger sync if not already in progress
    this.scheduleSyncAttempt();
  }

  // Schedule a sync attempt
  private scheduleSyncAttempt(delay: number = 0): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    this.syncTimer = setTimeout(() => {
      this.processSyncQueue();
    }, delay);
  }

  // Process the sync queue
  async processSyncQueue(): Promise<void> {
    // Check circuit breaker
    if (this.circuitBreakerOpen) {
      console.log('[SyncManager] Circuit breaker is open, skipping sync');
      return;
    }

    if (this.syncInProgress) {
      console.log('[SyncManager] Sync already in progress');
      return;
    }

    this.syncInProgress = true;

    try {
      const db = await this.initDB();
      const items = await db.getAllFromIndex('syncQueue', 'timestamp');

      if (items.length === 0) {
        console.log('[SyncManager] Sync queue is empty');
        return;
      }

      console.log(`[SyncManager] Processing ${items.length} items in sync queue`);

      // Process items in order
      for (const item of items) {
        // Skip items that have exceeded max retries
        if (item.retryCount >= this.maxRetries) {
          console.error(`[SyncManager] Item ${item.id} exceeded max retries, moving to dead letter queue`);
          await this.moveToDeadLetterQueue(item);
          continue;
        }

        try {
          await this.syncItem(item);

          // Remove from queue on success
          await db.delete('syncQueue', item.id);

          // Reset circuit breaker on success
          this.circuitBreakerFailures = 0;

          console.log(`[SyncManager] Successfully synced item ${item.id}`);
        } catch (error) {
          console.error(`[SyncManager] Failed to sync item ${item.id}:`, error);

          // Update retry count and error
          item.retryCount++;
          item.lastError = error instanceof Error ? error.message : String(error);
          await db.put('syncQueue', item);

          // Increment circuit breaker failures
          this.circuitBreakerFailures++;

          // Check if circuit breaker should open
          if (this.circuitBreakerFailures >= this.circuitBreakerThreshold) {
            this.openCircuitBreaker();
            break;
          }

          // Schedule retry with exponential backoff
          this.scheduleRetry(item);
        }
      }
    } catch (error) {
      console.error('[SyncManager] Error processing sync queue:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Sync a single item
  private async syncItem(item: SyncQueueItem): Promise<void> {
    const endpoint = this.getEndpoint(item);
    const method = this.getMethod(item.action);

    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: method !== 'DELETE' ? JSON.stringify(item.data) : undefined
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));

      // Handle conflict (409) specially
      if (response.status === 409) {
        await this.handleConflict(item, errorData);
        throw new Error('Conflict detected, manual resolution required');
      }

      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    // Update local cache with server response if needed
    if (item.action === 'create' || item.action === 'update') {
      const responseData = await response.json();
      await this.updateLocalCache(responseData.deck || responseData.card);
    }
  }

  // Get API endpoint for sync operation
  private getEndpoint(item: SyncQueueItem): string {
    const base = '/api/flashcards/decks';

    switch (item.action) {
      case 'create':
        return base;
      case 'update':
      case 'delete':
        return `${base}/${item.deckId}`;
      case 'addCard':
        return `${base}/${item.deckId}/cards`;
      case 'updateCard':
      case 'removeCard':
        return `${base}/${item.deckId}/cards/${item.data.cardId}`;
      default:
        throw new Error(`Unknown sync action: ${item.action}`);
    }
  }

  // Get HTTP method for sync operation
  private getMethod(action: string): string {
    switch (action) {
      case 'create':
      case 'addCard':
        return 'POST';
      case 'update':
      case 'updateCard':
        return 'PUT';
      case 'delete':
      case 'removeCard':
        return 'DELETE';
      default:
        return 'POST';
    }
  }

  // Schedule retry with exponential backoff
  private scheduleRetry(item: SyncQueueItem): void {
    const delay = Math.min(
      this.baseRetryDelay * Math.pow(2, item.retryCount),
      this.maxRetryDelay
    );

    console.log(`[SyncManager] Scheduling retry for ${item.id} in ${delay}ms`);

    const timeout = setTimeout(() => {
      this.retryTimeouts.delete(item.id);
      this.processSyncQueue();
    }, delay);

    this.retryTimeouts.set(item.id, timeout);
  }

  // Handle sync conflicts
  private async handleConflict(item: SyncQueueItem, serverData: any): Promise<void> {
    const db = await this.initDB();

    const conflict = {
      id: `conflict_${item.deckId}_${Date.now()}`,
      localDeck: item.data,
      remoteDeck: serverData.remoteDeck,
      timestamp: Date.now()
    };

    await db.put('conflicts', conflict);

    // Notify UI about conflict
    this.notifyConflict(conflict);
  }

  // Open circuit breaker
  private openCircuitBreaker(): void {
    console.warn('[SyncManager] Opening circuit breaker due to repeated failures');
    this.circuitBreakerOpen = true;

    // Schedule circuit breaker reset
    if (this.circuitBreakerTimer) {
      clearTimeout(this.circuitBreakerTimer);
    }

    this.circuitBreakerTimer = setTimeout(() => {
      console.log('[SyncManager] Resetting circuit breaker');
      this.circuitBreakerOpen = false;
      this.circuitBreakerFailures = 0;
      this.processSyncQueue(); // Retry after reset
    }, this.circuitBreakerResetTime);
  }

  // Move failed item to dead letter queue
  private async moveToDeadLetterQueue(item: SyncQueueItem): Promise<void> {
    const db = await this.initDB();

    // Store in a separate dead letter collection for manual review
    const deadLetterKey = `deadletter_${item.id}`;
    localStorage.setItem(deadLetterKey, JSON.stringify({
      ...item,
      movedToDeadLetter: Date.now()
    }));

    // Remove from active queue
    await db.delete('syncQueue', item.id);
  }

  // Update local cache after successful sync
  private async updateLocalCache(data: any): Promise<void> {
    // This would update the IndexedDB cache with the server response
    // Implementation depends on the FlashcardManager integration
    console.log('[SyncManager] Updating local cache with server data');
  }

  // Notify UI about conflicts
  private notifyConflict(conflict: any): void {
    // Dispatch custom event for UI to handle
    window.dispatchEvent(new CustomEvent('flashcard-sync-conflict', {
      detail: conflict
    }));
  }

  // Resolve a conflict
  async resolveConflict(conflictId: string, resolution: 'local' | 'remote' | 'merge'): Promise<void> {
    const db = await this.initDB();
    const conflict = await db.get('conflicts', conflictId);

    if (!conflict) {
      throw new Error('Conflict not found');
    }

    switch (resolution) {
      case 'local':
        // Force push local version
        await this.queueOperation({
          action: 'update',
          deckId: conflict.localDeck.id,
          data: { ...conflict.localDeck, forceUpdate: true },
          userId: conflict.localDeck.userId
        });
        break;

      case 'remote':
        // Accept remote version, update local
        await this.updateLocalCache(conflict.remoteDeck);
        break;

      case 'merge':
        // Merge both versions (custom logic needed)
        const merged = this.mergeDecks(conflict.localDeck, conflict.remoteDeck);
        await this.queueOperation({
          action: 'update',
          deckId: merged.id,
          data: merged,
          userId: merged.userId
        });
        break;
    }

    // Remove conflict after resolution
    await db.delete('conflicts', conflictId);
  }

  // Merge two deck versions
  private mergeDecks(local: FlashcardDeck, remote: FlashcardDeck): FlashcardDeck {
    // Simple merge strategy: take latest updates for each field
    return {
      ...local,
      ...remote,
      // Merge cards array by combining unique cards
      cards: this.mergeCards(local.cards, remote.cards),
      // Use latest update timestamp
      updatedAt: Math.max(local.updatedAt, remote.updatedAt),
      // Merge stats by taking maximums
      stats: {
        ...local.stats,
        ...remote.stats,
        totalCards: Math.max(local.stats.totalCards, remote.stats.totalCards),
        totalStudied: Math.max(local.stats.totalStudied, remote.stats.totalStudied)
      }
    };
  }

  // Merge card arrays
  private mergeCards(localCards: any[], remoteCards: any[]): any[] {
    const cardMap = new Map();

    // Add all local cards
    localCards.forEach(card => cardMap.set(card.id, card));

    // Merge or add remote cards
    remoteCards.forEach(card => {
      const existing = cardMap.get(card.id);
      if (existing) {
        // Merge based on update time if available
        const merged = card.updatedAt > existing.updatedAt ? card : existing;
        cardMap.set(card.id, merged);
      } else {
        cardMap.set(card.id, card);
      }
    });

    return Array.from(cardMap.values());
  }

  // Get sync status
  async getSyncStatus(): Promise<{
    queueLength: number;
    conflicts: number;
    issyncing: boolean;
    circuitBreakerOpen: boolean;
  }> {
    const db = await this.initDB();
    const queueItems = await db.count('syncQueue');
    const conflicts = await db.count('conflicts');

    return {
      queueLength: queueItems,
      conflicts,
      issyncing: this.syncInProgress,
      circuitBreakerOpen: this.circuitBreakerOpen
    };
  }

  // Clear sync queue (use with caution)
  async clearSyncQueue(): Promise<void> {
    const db = await this.initDB();
    const tx = db.transaction('syncQueue', 'readwrite');
    await tx.store.clear();
    await tx.done;

    // Clear all retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
  }

  // Force sync now (bypass scheduling)
  async forceSyncNow(): Promise<void> {
    // Reset circuit breaker for forced sync
    this.circuitBreakerOpen = false;
    this.circuitBreakerFailures = 0;

    await this.processSyncQueue();
  }

  // Cleanup
  destroy(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    if (this.circuitBreakerTimer) {
      clearTimeout(this.circuitBreakerTimer);
    }

    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();

    if (this.db) {
      this.db.close();
    }
  }
}

// Export singleton instance
export const syncManager = new SyncManager();