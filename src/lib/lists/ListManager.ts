import type { UserList, ListItem, CreateListRequest, AddItemRequest, UpdateListRequest, ListType } from '@/types/userLists';
import { openDB, IDBPDatabase } from 'idb';
import { TabCoordinator } from './TabCoordinator';
import { QuotaGuard, QuotaError } from '../storage/QuotaGuard';
import { createUuid } from '@/lib/utils/uuid';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error';

export interface ListSyncStatus {
  isOnline: boolean;
  syncState: SyncState;
  pendingCount: number;
  failedCount: number;
  lastSyncTime: Date | null;
  lastError: string | null;
}

interface ListManagerDB {
  lists: UserList;
  syncQueue: {
    id: string;
    action: 'create' | 'update' | 'delete' | 'addItem' | 'removeItem';
    data: any;
    timestamp: number;
    retryCount: number;
  };
  deletedLists: {
    listId: string;
    userId: string;
    deletedAt: number;
  };
}

class ListManager {
  private db: IDBPDatabase<ListManagerDB> | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private listeners: Map<string, Set<() => void>> = new Map();
  private tabCoordinator: TabCoordinator | null = null;
  private pendingSyncLock: Set<string> = new Set();

  private syncStatus: ListSyncStatus = {
    isOnline: true,
    syncState: 'idle',
    pendingCount: 0,
    failedCount: 0,
    lastSyncTime: null,
    lastError: null
  };

  private circuitBreakerFailures: number = 0;
  private circuitBreakerResetTime: number = 0;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_RESET_MS = 30000; // 30 seconds

  /**
   * Normalize content for duplicate comparison based on list type
   */
  private normalizeForComparison(content: string, type: ListType): string {
    let normalized = content.trim().toLowerCase();

    if (type === 'sentence') {
      // Remove common punctuation and normalize spaces for sentences
      normalized = normalized
        .replace(/[。、！？.,!?\s]+/g, ' ') // Replace punctuation and spaces with single space
        .trim()
        .replace(/\s+/g, ' '); // Ensure only single spaces
    }

    return normalized;
  }

  private normalizeListName(name: string): string {
    return name.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  /**
   * Check if content already exists in the list
   */
  private isDuplicate(newContent: string, existingItems: ListItem[], type: ListType): boolean {
    const normalizedNew = this.normalizeForComparison(newContent, type);

    return existingItems.some(item => {
      const normalizedExisting = this.normalizeForComparison(item.content, type);
      return normalizedNew === normalizedExisting;
    });
  }

  // Initialize IndexedDB
  private async initDB(): Promise<IDBPDatabase<ListManagerDB>> {
    if (this.db) return this.db;

    // Initialize TabCoordinator FIRST (before database opens)
    if (!this.tabCoordinator) {
      this.tabCoordinator = new TabCoordinator('lists-coordination');
      await this.tabCoordinator.initialize();
      console.log('[ListManager] TabCoordinator initialized, isLeader:', this.tabCoordinator.isLeader());
    }

    this.db = await openDB<ListManagerDB>('UserListsDB', 2, {
      upgrade(db, oldVersion) {
        // Lists store
        if (!db.objectStoreNames.contains('lists')) {
          const listsStore = db.createObjectStore('lists', { keyPath: 'id' });
          listsStore.createIndex('userId', 'userId');
          listsStore.createIndex('type', 'type');
          listsStore.createIndex('updatedAt', 'updatedAt');
        }

        // Sync queue for premium users
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('timestamp', 'timestamp');
        }

        // Deletion tombstones - added in version 2
        // Tracks deleted list IDs to prevent resurrection from stale local data
        if (!db.objectStoreNames.contains('deletedLists')) {
          const deletedStore = db.createObjectStore('deletedLists', { keyPath: 'listId' });
          deletedStore.createIndex('userId', 'userId');
          deletedStore.createIndex('deletedAt', 'deletedAt');
        }
      },
      blocking() {
        console.warn('[ListManager] Database upgrade blocked by another tab');
      },
      blocked() {
        console.warn('[ListManager] Database upgrade blocked - will retry');
      }
    });

    // Setup version change handler
    this.db.onversionchange = (event) => {
      console.warn('[ListManager] Database version change detected, closing connection');
      this.db?.close();
      this.db = null;
      this.notifyListeners('version-change');
    };

    // Setup cross-tab message handlers
    this.setupTabCoordination();

    // Setup online/offline detection
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[ListManager] Network online, scheduling sync');
        this.syncStatus.isOnline = true;
        this.scheduleSync();
      });

      window.addEventListener('offline', () => {
        console.log('[ListManager] Network offline');
        this.syncStatus.isOnline = false;
        this.syncStatus.syncState = 'error';
        this.syncStatus.lastError = 'Network offline';
      });

      this.syncStatus.isOnline = navigator.onLine;
    }

    return this.db;
  }

  /**
   * Setup cross-tab coordination message handlers
   * Handles messages from other tabs to keep UI synchronized
   */
  private setupTabCoordination(): void {
    if (!this.tabCoordinator) return;

    this.tabCoordinator.onMessage((message) => {
      console.log('[ListManager] Received tab message:', message.type, 'from', message.tabId);

      switch (message.type) {
        case 'list-created':
        case 'list-updated':
        case 'list-deleted':
          // Invalidate cache and notify listeners to refresh
          this.notifyListeners('lists-changed');
          break;

        case 'item-added':
        case 'item-removed':
          // Notify listeners for specific list
          if (message.data?.listId) {
            this.notifyListeners(`list-${message.data.listId}`);
          }
          break;

        case 'sync-request':
          // Another tab requested sync status
          if (this.tabCoordinator?.isLeader()) {
            // Leader should broadcast sync status (future enhancement)
            console.log('[ListManager] Sync status request received (leader)');
          }
          break;
      }
    });
  }

  // Get all lists for a user
  async getLists(userId: string, _isPremium: boolean): Promise<UserList[]> {
    const db = await this.initDB();

    // Try to fetch from server to check storage location
    try {
      const response = await fetch('/api/lists', {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const { lists, deletedListIds, storage } = data;

        // Check storage location from response
        if (storage?.location === 'local') {
          // Free user - use IndexedDB only
          const localLists = await db.getAllFromIndex('lists', 'userId', userId);
          return localLists.sort((a, b) => b.updatedAt - a.updatedAt);
        } else if (storage?.location === 'both' || storage?.syncEnabled) {
          // Premium user - MERGE server lists with local lists (never delete all!)
          // Get current local lists
          const localLists = await db.getAllFromIndex('lists', 'userId', userId);

          // Create a map of server lists by ID for efficient lookup
          const serverListsMap = new Map<string, UserList>();
          (lists || []).forEach((list: UserList) => serverListsMap.set(list.id, list));

          // Create a map of local lists by ID
          const localListsMap = new Map<string, UserList>();
          localLists.forEach(list => localListsMap.set(list.id, list));

          // Merge logic: keep the most recent version of each list
          const mergedLists: UserList[] = [];
          const processedIds = new Set<string>();

          // Combine local tombstones with server-provided deleted list IDs
          // Server tombstones are authoritative - they come from deletions on other devices
          const localTombstones = await db.getAllFromIndex('deletedLists', 'userId', userId);
          const tombstoneIds = new Set(localTombstones.map(t => t.listId));

          // Add server-provided deleted list IDs to tombstones
          // This is the key fix: server tells us what was deleted on other devices
          const serverDeletedIds = new Set<string>(deletedListIds || []);
          for (const deletedId of serverDeletedIds) {
            tombstoneIds.add(deletedId);
            // Also save to local IndexedDB for offline access
            if (!localTombstones.some(t => t.listId === deletedId)) {
              await db.put('deletedLists', {
                listId: deletedId,
                userId: userId,
                deletedAt: Date.now()
              });
            }
          }

          if (serverDeletedIds.size > 0) {
            console.log('[ListManager] Server provided', serverDeletedIds.size, 'deleted list IDs as tombstones');
          }

          // Process server lists (these are the source of truth if they exist)
          for (const serverList of (lists || [])) {
            const localList = localListsMap.get(serverList.id);

            if (!localList || serverList.updatedAt >= localList.updatedAt) {
              // Server version is newer or local doesn't exist - use server version
              mergedLists.push(serverList);
            } else {
              // Local version is newer (might have just been created)
              mergedLists.push(localList);
            }
            processedIds.add(serverList.id);

            // Clear tombstone if server has the list (it was re-created or never actually deleted)
            if (tombstoneIds.has(serverList.id)) {
              await db.delete('deletedLists', serverList.id);
              tombstoneIds.delete(serverList.id);
            }
          }

          // Process local-only lists - check if they should be synced or deleted
          // A local-only list should be DELETED (not synced) if:
          // 1. It's in the tombstone list (deleted on another device)
          // 2. OR it doesn't exist on server AND was created before the last server sync
          const listsToDeleteLocally: string[] = [];
          const listsToSync: UserList[] = [];

          for (const localList of localLists) {
            if (processedIds.has(localList.id)) {
              continue; // Already processed from server
            }

            // Check if this list was deleted (exists in tombstones)
            if (tombstoneIds.has(localList.id)) {
              console.log('[ListManager] Skipping tombstoned list:', localList.name, localList.id);
              listsToDeleteLocally.push(localList.id);
              continue;
            }

            // List doesn't exist on server and not in tombstones
            // This could be:
            // 1. A new list created offline (should sync)
            // 2. A list deleted on another device (should NOT sync)
            //
            // Heuristic: If the server returned ANY lists, it means we have connectivity
            // and the server is authoritative. A local-only list that's not on server
            // was likely deleted elsewhere. Only sync if the list was created very recently
            // (within last 5 minutes) to handle the "just created offline" case.
            const RECENT_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
            const now = Date.now();
            const isRecentlyCreated = (now - localList.createdAt) < RECENT_THRESHOLD_MS;

            if (isRecentlyCreated) {
              // Likely a new list created offline - sync it
              console.log('[ListManager] Local-only list is recent, will sync:', localList.name);
              mergedLists.push(localList);
              listsToSync.push(localList);
            } else {
              // Old list not on server - was deleted elsewhere, record tombstone
              console.log('[ListManager] Local-only list not on server, treating as deleted:', localList.name, localList.id);
              listsToDeleteLocally.push(localList.id);

              // Record tombstone to prevent future resurrection
              await db.put('deletedLists', {
                listId: localList.id,
                userId: userId,
                deletedAt: now
              });
            }
          }

          // Save merged lists back to IndexedDB
          await QuotaGuard.guardedWrite(async () => {
            const tx = db.transaction('lists', 'readwrite');
            // Clear all lists for this user
            const existingKeys = await tx.store.index('userId').getAllKeys(userId);
            for (const key of existingKeys) {
              await tx.store.delete(key);
            }
            // Add merged lists
            for (const list of mergedLists) {
              await tx.store.put(list);
            }
            await tx.done;
          }, 'getLists');

          // Only sync truly new lists (created recently)
          if (listsToSync.length > 0 && (typeof navigator === 'undefined' || navigator.onLine)) {
            console.log('[ListManager] Syncing', listsToSync.length, 'recently created lists to server');
            void this.syncLocalListsToServer(userId);
          }

          // Clean up old tombstones (older than 30 days)
          void this.cleanupOldTombstones(userId);

          return mergedLists.sort((a, b) => b.updatedAt - a.updatedAt);
        }
      }
    } catch (error) {
      console.error('Failed to fetch lists from server:', error);
    }

    // Fallback: Use IndexedDB for offline access
    const lists = await db.getAllFromIndex('lists', 'userId', userId);
    return lists.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // Create a new list
  async createList(request: CreateListRequest, userId: string, _isPremium: boolean): Promise<UserList | null> {
    const db = await this.initDB();
    const now = Date.now();

    const localLists = await db.getAllFromIndex('lists', 'userId', userId);
    const normalizedName = this.normalizeListName(request.name);
    const duplicateLocal = localLists.some(list =>
      list.type === request.type && this.normalizeListName(list.name) === normalizedName
    );
    if (duplicateLocal) {
      throw new Error('DUPLICATE_LIST');
    }

    // If there's a first item, prepare it
    const items: ListItem[] = [];
    if (request.firstItem) {
      items.push({
        id: createUuid(),
        content: request.firstItem.content,
        type: request.type,
        metadata: {
          ...request.firstItem.metadata,
          addedAt: now
        }
      });
    }

    const list: UserList = {
      id: createUuid(),
      userId,
      name: request.name,
      type: request.type,
      emoji: request.emoji || '📚',
      color: request.color || 'primary',
      items,
      createdAt: now,
      updatedAt: now,
      settings: {
        reviewEnabled: true,
        sortOrder: 'dateAdded'
      }
    };

    // Call server API - it will decide storage based on user's plan
    const requestBody = JSON.stringify(request);

    try {
      const response = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: requestBody
      });

      if (response.ok) {
        const data = await response.json();
        const { data: serverList, storage } = data;

        // Always save to IndexedDB for local access
        // Premium users: This is synced with Firebase
        // Free users: This is their only storage
        const listToStore = serverList || list;
        await QuotaGuard.guardedWrite(
          () => db.put('lists', listToStore),
          'createList'
        );
        this.notifyListeners('lists-changed');

        return listToStore;
      } else {
        // Try to get error as JSON first, fall back to text
        let errorDetails;
        const contentType = response.headers.get('content-type');

        try {
          if (contentType?.includes('application/json')) {
            errorDetails = await response.json();
          } else {
            errorDetails = await response.text();
          }
        } catch (e) {
          errorDetails = 'Could not parse error response';
        }

        console.error('[ListManager.createList] ✗ Server rejected list creation:', {
          status: response.status,
          statusText: response.statusText,
          contentType,
          errorDetails,
          url: response.url
        });

        if (response.status === 409 || errorDetails?.code === 'DUPLICATE_LIST') {
          throw new Error('DUPLICATE_LIST');
        }
        if (response.status === 429) {
          throw new Error('LIMIT_REACHED');
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error('UNAUTHORIZED');
        }
        throw new Error('CREATE_LIST_FAILED');
      }
    } catch (error) {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (
        error instanceof Error &&
        ['DUPLICATE_LIST', 'LIMIT_REACHED', 'UNAUTHORIZED', 'CREATE_LIST_FAILED'].includes(error.message)
      ) {
        throw error;
      }
      if (!isOffline) {
        throw error;
      }
      console.error('[ListManager.createList] ✗ Failed to create list on server:', error);
      // Fall through to local storage for offline users
    }

    // Fallback: Save to IndexedDB only if server fails
    await QuotaGuard.guardedWrite(
      () => db.put('lists', list),
      'createList'
    );

    // Broadcast to other tabs
    this.tabCoordinator?.broadcast({
      type: 'list-created',
      tabId: this.tabCoordinator.getTabId(),
      timestamp: Date.now(),
      data: { listId: list.id, listName: list.name }
    });

    this.notifyListeners('lists-changed');
    return list;
  }

  // Add item to list
  async addItemToList(listId: string, content: string, metadata: any, userId: string, _isPremium: boolean): Promise<ListItem | null> {
    const db = await this.initDB();

    // Get the list first to check for duplicates
    const list = await db.get('lists', listId);
    if (!list || list.userId !== userId) {
      throw new Error('List not found or unauthorized');
    }

    // Check for duplicate content
    if (this.isDuplicate(content, list.items, list.type)) {
      throw new Error('This item already exists in the list');
    }

    // Create the item
    const newItem: ListItem = {
      id: createUuid(),
      content,
      type: list.type,
      metadata: {
        ...metadata,
        addedAt: Date.now()
      }
    };

    const shouldUseServer = typeof navigator === 'undefined' || navigator.onLine;

    // Try server first when online
    if (shouldUseServer) {
      try {
        const response = await fetch(`/api/lists/${listId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content, metadata })
        });

        if (response.ok) {
          const { item } = await response.json();

          // Update local IndexedDB
          list.items.push(item);
          list.updatedAt = Date.now();
          await QuotaGuard.guardedWrite(
            () => db.put('lists', list),
            'addItemToList'
          );

          // Broadcast to other tabs
          this.tabCoordinator?.broadcast({
            type: 'item-added',
            tabId: this.tabCoordinator.getTabId(),
            timestamp: Date.now(),
            data: { listId: list.id, itemId: item.id }
          });

          this.notifyListeners(`list-${listId}`);

          return item;
        } else if (response.status === 409) {
          // Duplicate detected on server
          const error = await response.json();
          throw new Error(error.error || 'This item already exists in the list');
        }
      } catch (error: any) {
        // If it's a duplicate error, re-throw it (this is expected validation)
        if (error.message?.includes('already exists')) {
          throw error;
        }
        // Only log non-duplicate errors
        console.error('Failed to add item on server:', error);
        // Fall through for offline users
      }
    }

    // Offline: Update IndexedDB only
    // (We've already checked for duplicates above)
    list.items.push(newItem);
    list.updatedAt = Date.now();
    await QuotaGuard.guardedWrite(
      () => db.put('lists', list),
      'addItemToList'
    );

    // Broadcast to other tabs
    this.tabCoordinator?.broadcast({
      type: 'item-added',
      tabId: this.tabCoordinator.getTabId(),
      timestamp: Date.now(),
      data: { listId: list.id, itemId: newItem.id }
    });

    this.notifyListeners(`list-${listId}`);
    return newItem;
  }

  // Sync local lists to Firebase (for when session is corrected)
  async syncLocalListsToServer(userId: string): Promise<number> {
    const db = await this.initDB();
    const localLists = await db.getAllFromIndex('lists', 'userId', userId);

    if (localLists.length === 0) {
      return 0;
    }

    // Get tombstones to avoid re-uploading deleted lists
    const tombstones = await db.getAllFromIndex('deletedLists', 'userId', userId);
    const tombstoneIds = new Set(tombstones.map(t => t.listId));

    let syncedCount = 0;
    let warnedForeignLists = false;

    // Only sync lists created recently (within 5 minutes) to avoid resurrecting old deleted lists
    const RECENT_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    for (const list of localLists) {
      if (list.userId !== userId) {
        if (!warnedForeignLists) {
          console.warn('[ListManager.syncLocalListsToServer] Skipping lists for a different user');
          warnedForeignLists = true;
        }
        continue;
      }

      // Skip tombstoned lists
      if (tombstoneIds.has(list.id)) {
        console.log('[ListManager.syncLocalListsToServer] Skipping tombstoned list:', list.name);
        continue;
      }

      // Skip old lists - they were likely deleted on server
      const isRecentlyCreated = (now - list.createdAt) < RECENT_THRESHOLD_MS;
      if (!isRecentlyCreated) {
        console.log('[ListManager.syncLocalListsToServer] Skipping old list (likely deleted on server):', list.name);
        continue;
      }

      try {
        // Check if list exists on server first
        const checkResponse = await fetch(`/api/lists/${list.id}`, {
          method: 'GET',
          credentials: 'include'
        });

        if (checkResponse.status === 404) {
          // List doesn't exist on server - only create if it's recent
          console.log('[ListManager.syncLocalListsToServer] Syncing recent list to server:', list.name);
          const response = await fetch('/api/lists/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(list)
          });

          if (response.ok) {
            syncedCount++;
          } else {
            const responseText = await response.text().catch(() => '');
            const isForeignUser = response.status === 403 && responseText.includes('Cannot sync lists for other users');
            if (isForeignUser) {
              if (!warnedForeignLists) {
                console.warn('[ListManager.syncLocalListsToServer] Skipping lists for a different user');
                warnedForeignLists = true;
              }
              continue;
            }
            console.error('[ListManager.syncLocalListsToServer] Failed to sync list:', list.name, responseText);
          }
        }
      } catch (error) {
        console.error('[ListManager.syncLocalListsToServer] Error syncing list:', list.name, error);
      }
    }

    return syncedCount;
  }

  // Remove item from list
  async removeItemFromList(listId: string, itemId: string, userId: string, _isPremium: boolean): Promise<boolean> {
    const db = await this.initDB();

    const shouldUseServer = typeof navigator === 'undefined' || navigator.onLine;

    // Try server first when online
    if (shouldUseServer) {
      try {
        const response = await fetch(`/api/lists/${listId}/items?itemId=${itemId}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        if (response.ok) {
          // Update local IndexedDB
          const list = await db.get('lists', listId);
          if (list) {
            list.items = list.items.filter((item: ListItem) => item.id !== itemId);
            list.updatedAt = Date.now();
            await QuotaGuard.guardedWrite(
              () => db.put('lists', list),
              'removeItemFromList'
            );
            this.notifyListeners(`list-${listId}`);
          }
          return true;
        }
      } catch (error) {
        console.error('Failed to remove item on server:', error);
        // Fall through for offline users
      }
    }

    // Offline: Update IndexedDB only
    const list = await db.get('lists', listId);
    if (list && list.userId === userId) {
      list.items = list.items.filter((item: ListItem) => item.id !== itemId);
      list.updatedAt = Date.now();
      await QuotaGuard.guardedWrite(
        () => db.put('lists', list),
        'removeItemFromList'
      );
      this.notifyListeners(`list-${listId}`);
      return true;
    }

    return false;
  }

  // Update list metadata
  async updateList(listId: string, updates: UpdateListRequest, userId: string, _isPremium: boolean): Promise<UserList | null> {
    const db = await this.initDB();

    const shouldUseServer = typeof navigator === 'undefined' || navigator.onLine;

    // Try server first when online
    if (shouldUseServer) {
      try {
        const response = await fetch(`/api/lists/${listId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(updates)
        });

        if (response.ok) {
          const { list } = await response.json();
          await QuotaGuard.guardedWrite(
            () => db.put('lists', list),
            'updateList'
          );

          // Broadcast to other tabs
          this.tabCoordinator?.broadcast({
            type: 'list-updated',
            tabId: this.tabCoordinator.getTabId(),
            timestamp: Date.now(),
            data: { listId: list.id, updates }
          });

          this.notifyListeners('lists-changed');
          return list;
        }
      } catch (error) {
        console.error('Failed to update list on server:', error);
        // Fall through for offline users
      }
    }

    // Offline: Update IndexedDB only
    const list = await db.get('lists', listId);
    if (list && list.userId === userId) {
      Object.assign(list, updates);
      list.updatedAt = Date.now();
      await QuotaGuard.guardedWrite(
        () => db.put('lists', list),
        'updateList'
      );

      // Broadcast to other tabs
      this.tabCoordinator?.broadcast({
        type: 'list-updated',
        tabId: this.tabCoordinator.getTabId(),
        timestamp: Date.now(),
        data: { listId: list.id, updates }
      });

      this.notifyListeners('lists-changed');
      return list;
    }

    return null;
  }

  // Delete a list
  async deleteList(listId: string, userId: string, _isPremium: boolean): Promise<boolean> {
    const db = await this.initDB();

    const shouldUseServer = typeof navigator === 'undefined' || navigator.onLine;

    // Record tombstone to prevent resurrection from stale data on other devices
    const recordTombstone = async () => {
      await db.put('deletedLists', {
        listId,
        userId,
        deletedAt: Date.now()
      });
      console.log('[ListManager] Recorded deletion tombstone for list:', listId);
    };

    // Delete from server AND IndexedDB when online
    if (shouldUseServer) {
      try {
        const response = await fetch(`/api/lists/${listId}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        if (response.ok) {
          await db.delete('lists', listId);
          await recordTombstone();

          // Broadcast to other tabs
          this.tabCoordinator?.broadcast({
            type: 'list-deleted',
            tabId: this.tabCoordinator.getTabId(),
            timestamp: Date.now(),
            data: { listId }
          });

          this.notifyListeners('lists-changed');
          return true;
        } else {
          return false;
        }
      } catch (error) {
        console.error('[ListManager.deleteList] Failed to delete list on server:', error);
        // For offline users, still delete locally
      }
    }

    // Offline: Delete from IndexedDB only
    const list = await db.get('lists', listId);

    if (list && list.userId === userId) {
      await db.delete('lists', listId);
      await recordTombstone();

      // Broadcast to other tabs
      this.tabCoordinator?.broadcast({
        type: 'list-deleted',
        tabId: this.tabCoordinator.getTabId(),
        timestamp: Date.now(),
        data: { listId }
      });

      this.notifyListeners('lists-changed');
      return true;
    }

    return false;
  }

  /**
   * Clean up old tombstones to prevent IndexedDB bloat
   * Removes tombstones older than 30 days
   */
  private async cleanupOldTombstones(userId: string): Promise<void> {
    try {
      const db = await this.initDB();
      const TOMBSTONE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
      const cutoffTime = Date.now() - TOMBSTONE_MAX_AGE_MS;

      const tombstones = await db.getAllFromIndex('deletedLists', 'userId', userId);
      let cleanedCount = 0;

      for (const tombstone of tombstones) {
        if (tombstone.deletedAt < cutoffTime) {
          await db.delete('deletedLists', tombstone.listId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`[ListManager] Cleaned up ${cleanedCount} old tombstones`);
      }
    } catch (error) {
      console.error('[ListManager] Error cleaning up tombstones:', error);
    }
  }

  // Export list as CSV or JSON
  async exportList(listId: string, format: 'csv' | 'json'): Promise<string> {
    const db = await this.initDB();
    const list = await db.get('lists', listId);

    if (!list) {
      throw new Error('List not found');
    }

    if (format === 'json') {
      return JSON.stringify(list, null, 2);
    }

    // CSV format
    const headers = ['Content', 'Reading', 'Meaning', 'Notes', 'Tags', 'Added Date'];
    const rows = list.items.map((item: ListItem) => [
      item.content,
      item.metadata?.reading || '',
      item.metadata?.meaning || '',
      item.metadata?.notes || '',
      (item.metadata?.tags || []).join(';'),
      new Date(item.metadata?.addedAt || Date.now()).toISOString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: string[]) => row.map((cell: string) => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  // Import list from CSV or JSON
  async importList(name: string, type: 'sentence' | 'word' | 'verbAdj', data: string, format: 'csv' | 'json' | 'text', userId: string, _isPremium: boolean): Promise<UserList | null> {
    const items: ListItem[] = [];

    if (format === 'json') {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        parsed.forEach(item => {
          items.push({
            id: createUuid(),
            content: item.content || item,
            type,
            metadata: {
              reading: item.reading,
              meaning: item.meaning,
              notes: item.notes,
              tags: item.tags,
              addedAt: Date.now()
            }
          });
        });
      }
    } else if (format === 'csv') {
      const lines = data.split('\n');
      const headers = lines[0].toLowerCase().split(',');

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].match(/(".*?"|[^,]+)/g) || [];
        const cleanValues = values.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));

        items.push({
          id: createUuid(),
          content: cleanValues[0] || '',
          type,
          metadata: {
            reading: cleanValues[1],
            meaning: cleanValues[2],
            notes: cleanValues[3],
            tags: cleanValues[4]?.split(';').filter(Boolean),
            addedAt: Date.now()
          }
        });
      }
    } else {
      // Plain text format - one item per line
      const lines = data.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        items.push({
          id: createUuid(),
          content: line.trim(),
          type,
          metadata: {
            addedAt: Date.now()
          }
        });
      });
    }

    // Create the list with imported items
    const request: CreateListRequest = {
      name,
      type,
      emoji: '📥',
      color: 'primary'
    };

    const list = await this.createList(request, userId, _isPremium);
    if (list) {
      // Add all items at once
      const db = await this.initDB();
      list.items = items;
      list.updatedAt = Date.now();
      await QuotaGuard.guardedWrite(
        () => db.put('lists', list),
        'importList'
      );
      this.notifyListeners('lists-changed');
    }

    return list;
  }

  // Add to sync queue for later sync
  private async addToSyncQueue(action: string, data: any): Promise<void> {
    const db = await this.initDB();
    await db.add('syncQueue', {
      id: createUuid(),
      action: action as any,
      data,
      timestamp: Date.now(),
      retryCount: 0
    });

    // Schedule sync
    this.scheduleSync();
  }

  // Schedule background sync
  private scheduleSync(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    this.syncTimer = setTimeout(() => {
      this.processSyncQueue();
    }, 5000); // Try syncing after 5 seconds
  }

  // Process sync queue
  private async processSyncQueue(): Promise<void> {
    // Only leader processes sync queue (prevents duplicate API calls)
    if (!this.tabCoordinator?.isLeader()) {
      console.log('[ListManager] Not leader, skipping sync queue processing');
      return;
    }

    // Check circuit breaker
    const now = Date.now();
    if (this.circuitBreakerFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      if (now < this.circuitBreakerResetTime) {
        console.warn('[ListManager] Circuit breaker open, skipping sync');
        return;
      } else {
        // Reset circuit breaker
        console.log('[ListManager] Circuit breaker reset');
        this.circuitBreakerFailures = 0;
      }
    }

    console.log('[ListManager] Leader processing sync queue');

    const db = await this.initDB();
    const items = await db.getAllFromIndex('syncQueue', 'timestamp');

    if (items.length === 0) {
      console.log('[ListManager] Sync queue is empty, nothing to sync');
      this.syncStatus.syncState = 'synced';
      this.syncStatus.pendingCount = 0;
      this.syncStatus.lastSyncTime = new Date();
      this.notifyListeners('sync-completed');
      return;
    }

    // Update sync status
    this.syncStatus.syncState = 'syncing';
    this.syncStatus.pendingCount = items.length;
    this.notifyListeners('sync-started');

    let successCount = 0;
    let failureCount = 0;

    for (const item of items) {
      // Skip if already processing
      if (this.pendingSyncLock.has(item.id)) {
        continue;
      }

      this.pendingSyncLock.add(item.id);

      try {
        // Sync to Firebase based on action type
        await this.syncToFirebase(item);

        // If successful, remove from queue
        await db.delete('syncQueue', item.id);
        this.pendingSyncLock.delete(item.id);
        successCount++;

        // Reset circuit breaker on success
        if (this.circuitBreakerFailures > 0) {
          this.circuitBreakerFailures = 0;
        }
      } catch (error: any) {
        this.pendingSyncLock.delete(item.id);
        failureCount++;
        this.circuitBreakerFailures++;

        console.error('[ListManager] Sync failed for item:', item.id, error);

        // Increment retry count
        item.retryCount++;

        if (item.retryCount < 5) {
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 30s)
          const backoffMs = Math.min(30000, Math.pow(2, item.retryCount - 1) * 1000);

          await db.put('syncQueue', item);

          // Schedule retry with backoff
          setTimeout(() => {
            this.processSyncQueue();
          }, backoffMs);
        } else {
          // Give up after 5 retries
          console.error('[ListManager] Giving up on sync item after 5 retries:', item.id);
          await db.delete('syncQueue', item.id);
          this.syncStatus.failedCount++;
          this.notifyListeners('sync-failed', { item, error });
        }
      }
    }

    // Update circuit breaker reset time if failures occurred
    if (failureCount > 0 && this.circuitBreakerFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreakerResetTime = now + this.CIRCUIT_BREAKER_RESET_MS;
      console.warn('[ListManager] Circuit breaker opened, will reset in 30s');
    }

    // Update final sync status
    const remainingItems = await db.getAllFromIndex('syncQueue', 'timestamp');
    this.syncStatus.pendingCount = remainingItems.length;
    this.syncStatus.lastSyncTime = new Date();

    if (remainingItems.length === 0) {
      this.syncStatus.syncState = 'synced';
      this.notifyListeners('sync-completed');
    } else {
      this.syncStatus.syncState = 'error';
      this.syncStatus.lastError = `${failureCount} items failed to sync`;
    }
  }

  private async syncToFirebase(item: ListManagerDB['syncQueue']): Promise<void> {
    console.log('[ListManager.syncToFirebase] Processing sync item:', item.action, item.id);

    try {
      switch (item.action) {
        case 'create': {
          // Data format: { list: UserList }
          const { list } = item.data;
          if (!list) {
            throw new Error('Missing list data for create action');
          }

          console.log('[ListManager.syncToFirebase] Creating list on server:', list.id);
          const response = await fetch('/api/lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              name: list.name,
              type: list.type,
              emoji: list.emoji,
              color: list.color,
              firstItem: list.items && list.items.length > 0 ? {
                content: list.items[0].content,
                metadata: list.items[0].metadata
              } : undefined
            })
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(`Server returned ${response.status}: ${error.error || 'Unknown error'}`);
          }

          console.log('[ListManager.syncToFirebase] ✓ List created successfully:', list.id);
          break;
        }

        case 'update': {
          // Data format: { listId: string, updates: Partial<UserList> }
          const { listId, updates } = item.data;
          if (!listId || !updates) {
            throw new Error('Missing listId or updates for update action');
          }

          console.log('[ListManager.syncToFirebase] Updating list on server:', listId);
          const response = await fetch(`/api/lists/${listId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(updates)
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(`Server returned ${response.status}: ${error.error || 'Unknown error'}`);
          }

          console.log('[ListManager.syncToFirebase] ✓ List updated successfully:', listId);
          break;
        }

        case 'delete': {
          // Data format: { listId: string }
          const { listId } = item.data;
          if (!listId) {
            throw new Error('Missing listId for delete action');
          }

          console.log('[ListManager.syncToFirebase] Deleting list on server:', listId);
          const response = await fetch(`/api/lists/${listId}`, {
            method: 'DELETE',
            credentials: 'include'
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(`Server returned ${response.status}: ${error.error || 'Unknown error'}`);
          }

          console.log('[ListManager.syncToFirebase] ✓ List deleted successfully:', listId);
          break;
        }

        case 'addItem': {
          // Data format: { listId: string, content: string, metadata: any }
          const { listId, content, metadata } = item.data;
          if (!listId || !content) {
            throw new Error('Missing listId or content for addItem action');
          }

          console.log('[ListManager.syncToFirebase] Adding item to list on server:', listId);
          const response = await fetch(`/api/lists/${listId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              content,
              metadata
            })
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(`Server returned ${response.status}: ${error.error || 'Unknown error'}`);
          }

          console.log('[ListManager.syncToFirebase] ✓ Item added successfully to list:', listId);
          break;
        }

        case 'removeItem': {
          // Data format: { listId: string, itemId: string }
          const { listId, itemId } = item.data;
          if (!listId || !itemId) {
            throw new Error('Missing listId or itemId for removeItem action');
          }

          console.log('[ListManager.syncToFirebase] Removing item from list on server:', listId, itemId);
          const response = await fetch(`/api/lists/${listId}/items?itemId=${itemId}`, {
            method: 'DELETE',
            credentials: 'include'
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(`Server returned ${response.status}: ${error.error || 'Unknown error'}`);
          }

          console.log('[ListManager.syncToFirebase] ✓ Item removed successfully from list:', listId);
          break;
        }

        default:
          throw new Error(`Unknown sync action: ${item.action}`);
      }

      console.log('[ListManager.syncToFirebase] ✓ Sync completed successfully for:', item.action, item.id);
    } catch (error) {
      console.error('[ListManager.syncToFirebase] ✗ Sync failed:', item.action, item.id, error);
      throw error; // Re-throw to be handled by processSyncQueue
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): ListSyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Force sync all pending items immediately
   */
  async forceSyncAll(): Promise<void> {
    console.log('[ListManager] Forcing immediate sync');
    await this.processSyncQueue();
  }

  // Subscribe to changes
  subscribe(event: string, callback: () => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  // Notify listeners
  private notifyListeners(event: string, data?: any): void {
    this.listeners.get(event)?.forEach(callback => callback());
  }
}

// Export singleton instance
export const listManager = new ListManager();
