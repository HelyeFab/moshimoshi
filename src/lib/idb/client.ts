/**
 * IndexedDB Client Wrapper for moshimoshi PWA
 * Agent 3 - Data & Sync
 *
 * Typed async wrapper for free-tier storage
 * Implements interfaces from shared contracts
 */

import {
  DB_NAME,
  DB_VERSION,
  STORES,
  List,
  Item,
  ReviewQueueItem,
  Streak,
  Settings,
  SyncOutboxItem,
  ConflictItem,
  StoreName,
} from './types';

// Interface from shared contracts
export interface ListsApi {
  addList(input: {
    title: string;
    type: 'words' | 'sentences' | 'verbs' | 'adjectives';
  }): Promise<string>;

  addItems(
    listId: string,
    items: Array<{ payload: any; tags?: string[] }>
  ): Promise<void>;

  getDueItems(limit?: number): Promise<Array<any>>;
  getDueCount(): Promise<number>;
}

export class IDBClient implements ListsApi {
  private static instance: IDBClient | null = null;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private constructor() {
    // Singleton pattern
  }

  /**
   * Get singleton instance
   */
  static getInstance(): IDBClient {
    if (!IDBClient.instance) {
      IDBClient.instance = new IDBClient();
    }
    return IDBClient.instance;
  }

  /**
   * Initialize database connection
   */
  private async initialize(): Promise<void> {
    if (this.db) return;

    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[IDB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[IDB] Database opened successfully');

        // Handle database close
        this.db.onclose = () => {
          console.log('[IDB] Database connection closed');
          this.db = null;
        };

        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        console.log(`[IDB] Upgrading database from version ${oldVersion} to ${DB_VERSION}`);

        // Create stores if they don't exist

        // Lists store
        if (!db.objectStoreNames.contains(STORES.LISTS)) {
          const listsStore = db.createObjectStore(STORES.LISTS, { keyPath: 'id' });
          listsStore.createIndex('type', 'type', { unique: false });
          listsStore.createIndex('userId', 'userId', { unique: false });
          listsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // Items store
        if (!db.objectStoreNames.contains(STORES.ITEMS)) {
          const itemsStore = db.createObjectStore(STORES.ITEMS, { keyPath: 'id' });
          itemsStore.createIndex('listId', 'listId', { unique: false });
          itemsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // Review Queue store
        if (!db.objectStoreNames.contains(STORES.REVIEW_QUEUE)) {
          const reviewStore = db.createObjectStore(STORES.REVIEW_QUEUE, { keyPath: 'id' });
          reviewStore.createIndex('itemId', 'itemId', { unique: false });
          reviewStore.createIndex('dueAt', 'dueAt', { unique: false });
          reviewStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // Streaks store
        if (!db.objectStoreNames.contains(STORES.STREAKS)) {
          db.createObjectStore(STORES.STREAKS, { keyPath: 'id' });
        }

        // Settings store
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
        }

        // Sync Outbox store
        if (!db.objectStoreNames.contains(STORES.SYNC_OUTBOX)) {
          const outboxStore = db.createObjectStore(STORES.SYNC_OUTBOX, { keyPath: 'id' });
          outboxStore.createIndex('type', 'type', { unique: false });
          outboxStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Conflicts store
        if (!db.objectStoreNames.contains(STORES.CONFLICTS)) {
          db.createObjectStore(STORES.CONFLICTS, { keyPath: 'id', autoIncrement: true });
        }
      };
    });

    await this.initPromise;
  }

  /**
   * Ensure database is ready
   */
  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initialize();
    }
    if (!this.db) {
      throw new Error('[IDB] Database not initialized');
    }
    return this.db;
  }

  /**
   * Generic transaction helper
   */
  async transaction<T>(
    stores: StoreName | StoreName[],
    mode: IDBTransactionMode,
    callback: (tx: IDBTransaction) => Promise<T>
  ): Promise<T> {
    const db = await this.ensureDb();
    const storeNames = Array.isArray(stores) ? stores : [stores];
    const tx = db.transaction(storeNames, mode);

    return new Promise((resolve, reject) => {
      let result: T;

      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted'));

      callback(tx)
        .then(r => { result = r; })
        .catch(reject);
    });
  }

  // ==========================================================================
  // Lists API Implementation
  // ==========================================================================

  /**
   * Add a new list
   */
  async addList(input: {
    title: string;
    type: 'words' | 'sentences' | 'verbs' | 'adjectives';
  }): Promise<string> {
    const id = `list_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const list: List = {
      id,
      title: input.title,
      type: input.type,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending'
    };

    await this.transaction(STORES.LISTS, 'readwrite', async (tx) => {
      const store = tx.objectStore(STORES.LISTS);
      await this.promisifyRequest(store.add(list));
    });

    // Queue for sync
    await this.queueSync('addList', list);

    // Emit event for badge update
    this.emitDueCountChanged();

    return id;
  }

  /**
   * Add items to a list
   */
  async addItems(
    listId: string,
    items: Array<{ payload: any; tags?: string[] }>
  ): Promise<void> {
    const now = Date.now();

    await this.transaction(
      [STORES.ITEMS, STORES.REVIEW_QUEUE],
      'readwrite',
      async (tx) => {
        const itemsStore = tx.objectStore(STORES.ITEMS);
        const reviewStore = tx.objectStore(STORES.REVIEW_QUEUE);

        for (const item of items) {
          const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // Add item
          const newItem: Item = {
            id: itemId,
            listId,
            payload: item.payload,
            tags: item.tags,
            createdAt: now,
            syncStatus: 'pending'
          };

          await this.promisifyRequest(itemsStore.add(newItem));

          // Add to review queue
          const reviewItem: ReviewQueueItem = {
            id: `review_${itemId}`,
            itemId,
            dueAt: now, // Due immediately for new items
            history: [],
            syncStatus: 'pending'
          };

          await this.promisifyRequest(reviewStore.add(reviewItem));

          // Queue for sync
          await this.queueSync('addItem', newItem);
        }
      }
    );

    // Emit event for badge update
    this.emitDueCountChanged();
  }

  /**
   * Get due items for review
   */
  async getDueItems(limit: number = 50): Promise<Array<any>> {
    const now = Date.now();

    return this.transaction(
      [STORES.REVIEW_QUEUE, STORES.ITEMS],
      'readonly',
      async (tx) => {
        const reviewStore = tx.objectStore(STORES.REVIEW_QUEUE);
        const itemsStore = tx.objectStore(STORES.ITEMS);
        const dueIndex = reviewStore.index('dueAt');

        // Get all items due before now
        const range = IDBKeyRange.upperBound(now);
        const reviews = await this.promisifyRequest(dueIndex.getAll(range, limit));

        // Fetch associated items
        const result = [];
        for (const review of reviews) {
          const item = await this.promisifyRequest(
            itemsStore.get(review.itemId)
          );
          if (item) {
            result.push({
              ...item,
              reviewData: review
            });
          }
        }

        return result;
      }
    );
  }

  /**
   * Get count of due items
   */
  async getDueCount(): Promise<number> {
    const now = Date.now();

    return this.transaction(STORES.REVIEW_QUEUE, 'readonly', async (tx) => {
      const store = tx.objectStore(STORES.REVIEW_QUEUE);
      const index = store.index('dueAt');
      const range = IDBKeyRange.upperBound(now);

      return this.promisifyRequest(index.count(range));
    });
  }

  // ==========================================================================
  // Additional Methods
  // ==========================================================================

  /**
   * Get all lists
   */
  async getAllLists(): Promise<List[]> {
    return this.transaction(STORES.LISTS, 'readonly', async (tx) => {
      const store = tx.objectStore(STORES.LISTS);
      return this.promisifyRequest(store.getAll());
    });
  }

  /**
   * Get items by list ID
   */
  async getItemsByListId(listId: string): Promise<Item[]> {
    return this.transaction(STORES.ITEMS, 'readonly', async (tx) => {
      const store = tx.objectStore(STORES.ITEMS);
      const index = store.index('listId');
      return this.promisifyRequest(index.getAll(listId));
    });
  }

  /**
   * Update streak
   */
  async updateStreak(streakData: Partial<Streak>): Promise<void> {
    const now = Date.now();

    await this.transaction(STORES.STREAKS, 'readwrite', async (tx) => {
      const store = tx.objectStore(STORES.STREAKS);

      // Get existing or create new
      const existing = await this.promisifyRequest(store.get('global'));

      const streak: Streak = existing || {
        id: 'global',
        current: 0,
        best: 0,
        lastActiveAt: now,
        startedAt: now,
        syncStatus: 'pending'
      };

      // Update fields
      Object.assign(streak, streakData, {
        lastActiveAt: now,
        syncStatus: 'pending'
      });

      // Save
      await this.promisifyRequest(store.put(streak));

      // Queue for sync
      await this.queueSync('updateStreak', streak);
    });
  }

  /**
   * Get current streak
   */
  async getStreak(): Promise<Streak | null> {
    return this.transaction(STORES.STREAKS, 'readonly', async (tx) => {
      const store = tx.objectStore(STORES.STREAKS);
      return this.promisifyRequest(store.get('global'));
    });
  }

  /**
   * Update settings
   */
  async updateSettings(id: string, settings: Partial<Settings>): Promise<void> {
    await this.transaction(STORES.SETTINGS, 'readwrite', async (tx) => {
      const store = tx.objectStore(STORES.SETTINGS);
      const existing = await this.promisifyRequest(store.get(id));

      const updated: Settings = {
        ...existing,
        ...settings,
        id: id as any
      };

      await this.promisifyRequest(store.put(updated));

      // Queue for sync
      await this.queueSync('updateSettings', updated);
    });
  }

  /**
   * Get settings
   */
  async getSettings(id: string): Promise<Settings | null> {
    return this.transaction(STORES.SETTINGS, 'readonly', async (tx) => {
      const store = tx.objectStore(STORES.SETTINGS);
      return this.promisifyRequest(store.get(id));
    });
  }

  // ==========================================================================
  // Sync Operations
  // ==========================================================================

  /**
   * Queue an operation for sync
   */
  async queueSync(type: SyncOutboxItem['type'], payload: any): Promise<void> {
    const opId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const outboxItem: SyncOutboxItem = {
      id: opId,
      type,
      payload,
      createdAt: Date.now(),
      attempts: 0
    };

    await this.transaction(STORES.SYNC_OUTBOX, 'readwrite', async (tx) => {
      const store = tx.objectStore(STORES.SYNC_OUTBOX);
      await this.promisifyRequest(store.add(outboxItem));
    });

    // Trigger background sync if available
    this.triggerBackgroundSync();
  }

  /**
   * Get pending sync items
   */
  async getPendingSyncItems(limit: number = 100): Promise<SyncOutboxItem[]> {
    return this.transaction(STORES.SYNC_OUTBOX, 'readonly', async (tx) => {
      const store = tx.objectStore(STORES.SYNC_OUTBOX);
      const index = store.index('createdAt');
      return this.promisifyRequest(index.getAll(null, limit));
    });
  }

  /**
   * Remove sync item after successful sync
   */
  async removeSyncItem(opId: string): Promise<void> {
    await this.transaction(STORES.SYNC_OUTBOX, 'readwrite', async (tx) => {
      const store = tx.objectStore(STORES.SYNC_OUTBOX);
      await this.promisifyRequest(store.delete(opId));
    });
  }

  /**
   * Update sync item after failed attempt
   */
  async updateSyncItem(opId: string, update: Partial<SyncOutboxItem>): Promise<void> {
    await this.transaction(STORES.SYNC_OUTBOX, 'readwrite', async (tx) => {
      const store = tx.objectStore(STORES.SYNC_OUTBOX);
      const existing = await this.promisifyRequest(store.get(opId));

      if (existing) {
        const updated = { ...existing, ...update };
        await this.promisifyRequest(store.put(updated));
      }
    });
  }

  /**
   * Clear all local data (for account deletion)
   */
  async clearAllData(): Promise<void> {
    const db = await this.ensureDb();
    const storeNames = Array.from(db.objectStoreNames);

    await this.transaction(storeNames as StoreName[], 'readwrite', async (tx) => {
      for (const storeName of storeNames) {
        const store = tx.objectStore(storeName);
        await this.promisifyRequest(store.clear());
      }
    });

    console.log('[IDB] All local data cleared');
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Convert IDBRequest to Promise
   */
  private promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Emit due count changed event
   */
  private async emitDueCountChanged(): void {
    try {
      const count = await this.getDueCount();

      // Emit custom event per shared contract
      document.dispatchEvent(
        new CustomEvent('dueCountChanged', {
          detail: { count }
        })
      );

      console.log('[IDB] Due count changed:', count);
    } catch (error) {
      console.error('[IDB] Failed to emit due count:', error);
    }
  }

  /**
   * Trigger background sync
   */
  private async triggerBackgroundSync(): Promise<void> {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await (reg as any).sync.register('sync-outbox');
        console.log('[IDB] Background sync registered');
      } catch (error) {
        console.warn('[IDB] Background sync registration failed:', error);
      }
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[IDB] Database connection closed');
    }
  }
}

// Export singleton instance
export const idbClient = IDBClient.getInstance();