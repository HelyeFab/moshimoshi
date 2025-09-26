import type { UserList, ListItem, CreateListRequest, AddItemRequest, UpdateListRequest, ListType } from '@/types/userLists';
import { openDB, IDBPDatabase } from 'idb';

interface ListManagerDB {
  lists: UserList;
  syncQueue: {
    id: string;
    action: 'create' | 'update' | 'delete' | 'addItem' | 'removeItem';
    data: any;
    timestamp: number;
    retryCount: number;
  };
}

class ListManager {
  private db: IDBPDatabase<ListManagerDB> | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private listeners: Map<string, Set<() => void>> = new Map();

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

    this.db = await openDB<ListManagerDB>('UserListsDB', 1, {
      upgrade(db) {
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
      }
    });

    return this.db;
  }

  // Get all lists for a user
  async getLists(userId: string, isPremium: boolean): Promise<UserList[]> {
    const db = await this.initDB();

    // Try to fetch from server to check storage location
    try {
      console.log('[ListManager.getLists] Checking server for lists:', userId);
      const response = await fetch('/api/lists', {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const { lists, storage } = data;

        // Check storage location from response
        if (storage?.location === 'local') {
          // Free user - use IndexedDB only
          console.log('[ListManager.getLists] Free user - using local IndexedDB only');
          const localLists = await db.getAllFromIndex('lists', 'userId', userId);
          return localLists.sort((a, b) => b.updatedAt - a.updatedAt);
        } else if (storage?.location === 'both' || storage?.syncEnabled) {
          // Premium user - sync from Firebase to IndexedDB
          console.log('[ListManager.getLists] Premium user - syncing', lists?.length || 0, 'lists from Firebase');

          // Clear and sync all lists from server for premium users
          const tx = db.transaction('lists', 'readwrite');
          // Clear existing lists for this user
          const existingLists = await tx.store.index('userId').getAllKeys(userId);
          for (const key of existingLists) {
            await tx.store.delete(key);
          }
          // Add server lists
          if (lists && lists.length > 0) {
            for (const list of lists) {
              await tx.store.put(list);
            }
          }
          await tx.done;
          console.log('[ListManager.getLists] Synced to IndexedDB');

          return lists || [];
        }
      }
    } catch (error) {
      console.error('Failed to fetch lists from server:', error);
    }

    // Fallback: Use IndexedDB for offline access
    console.log('[ListManager.getLists] Using IndexedDB (offline or error)');
    const lists = await db.getAllFromIndex('lists', 'userId', userId);
    return lists.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // Create a new list
  async createList(request: CreateListRequest, userId: string, isPremium: boolean): Promise<UserList | null> {
    const db = await this.initDB();
    const now = Date.now();

    // If there's a first item, prepare it
    const items: ListItem[] = [];
    if (request.firstItem) {
      items.push({
        id: crypto.randomUUID(),
        content: request.firstItem.content,
        type: request.type,
        metadata: {
          ...request.firstItem.metadata,
          addedAt: now
        }
      });
    }

    const list: UserList = {
      id: crypto.randomUUID(),
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
    console.log('[ListManager.createList] userId:', userId, 'isPremium:', isPremium);
    console.log('[ListManager.createList] Calling server API to create list');
    try {
      const response = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(request)
      });

      if (response.ok) {
        const data = await response.json();
        const { data: serverList, storage } = data;

        console.log('[ListManager.createList] Server response - storage location:', storage?.location);

        // Always save to IndexedDB for local access
        // Premium users: This is synced with Firebase
        // Free users: This is their only storage
        const listToStore = serverList || list;
        await db.put('lists', listToStore);
        this.notifyListeners('lists-changed');

        if (storage?.location === 'local') {
          console.log('[ListManager.createList] Free user - list saved to IndexedDB only');
        } else if (storage?.location === 'both') {
          console.log('[ListManager.createList] Premium user - list saved to both IndexedDB and Firebase');
        }

        return listToStore;
      } else {
        const error = await response.text();
        console.error('[ListManager.createList] Server rejected list creation:', response.status, error);
      }
    } catch (error) {
      console.error('Failed to create list on server:', error);
      // Fall through to local storage for offline users
    }

    // Fallback: Save to IndexedDB only if server fails
    console.log('[ListManager.createList] Server failed, saving to IndexedDB only');
    await db.put('lists', list);
    this.notifyListeners('lists-changed');
    return list;
  }

  // Add item to list
  async addItemToList(listId: string, content: string, metadata: any, userId: string, isPremium: boolean): Promise<ListItem | null> {
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
      id: crypto.randomUUID(),
      content,
      type: list.type,
      metadata: {
        ...metadata,
        addedAt: Date.now()
      }
    };

    // Premium users: Try server first
    if (isPremium) {
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
          await db.put('lists', list);
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
        // Fall through for offline premium users
      }
    }

    // Free users or offline: Update IndexedDB only
    // (We've already checked for duplicates above)
    list.items.push(newItem);
    list.updatedAt = Date.now();
    await db.put('lists', list);
    this.notifyListeners(`list-${listId}`);
    return newItem;
  }

  // Sync local lists to Firebase (for when session is corrected)
  async syncLocalListsToServer(userId: string): Promise<number> {
    const db = await this.initDB();
    const localLists = await db.getAllFromIndex('lists', 'userId', userId);

    if (localLists.length === 0) {
      console.log('[ListManager.syncLocalListsToServer] No local lists to sync');
      return 0;
    }

    console.log('[ListManager.syncLocalListsToServer] Found', localLists.length, 'local lists to sync');
    let syncedCount = 0;

    for (const list of localLists) {
      try {
        // Check if list exists on server first
        const checkResponse = await fetch(`/api/lists/${list.id}`, {
          method: 'GET',
          credentials: 'include'
        });

        if (checkResponse.status === 404) {
          // List doesn't exist on server, create it
          console.log('[ListManager.syncLocalListsToServer] Syncing list:', list.name);
          const response = await fetch('/api/lists/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(list)
          });

          if (response.ok) {
            syncedCount++;
            console.log('[ListManager.syncLocalListsToServer] Successfully synced list:', list.name);
          } else {
            console.error('[ListManager.syncLocalListsToServer] Failed to sync list:', list.name, await response.text());
          }
        }
      } catch (error) {
        console.error('[ListManager.syncLocalListsToServer] Error syncing list:', list.name, error);
      }
    }

    console.log('[ListManager.syncLocalListsToServer] Synced', syncedCount, 'lists to server');
    return syncedCount;
  }

  // Update list details (name, emoji, color)
  async updateList(listId: string, updates: { name?: string; emoji?: string; color?: string }, userId: string): Promise<UserList | null> {
    const db = await this.initDB();

    try {
      // Try server first for all authenticated users
      const response = await fetch(`/api/lists/${listId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const { list: updatedList } = await response.json();

        // Update local IndexedDB
        await db.put('lists', updatedList);
        this.notifyListeners('lists-changed');

        return updatedList;
      }
    } catch (error) {
      console.error('Failed to update list on server:', error);
    }

    // Fallback: Update locally only
    const list = await db.get('lists', listId);
    if (list && list.userId === userId) {
      Object.assign(list, updates, { updatedAt: Date.now() });
      await db.put('lists', list);
      this.notifyListeners('lists-changed');
      return list;
    }

    return null;
  }


  // Remove item from list
  async removeItemFromList(listId: string, itemId: string, userId: string, isPremium: boolean): Promise<boolean> {
    const db = await this.initDB();

    // Premium users: Try server first
    if (isPremium) {
      try {
        const response = await fetch(`/api/lists/${listId}/items?itemId=${itemId}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        if (response.ok) {
          // Update local IndexedDB
          const list = await db.get('lists', listId);
          if (list) {
            list.items = list.items.filter(item => item.id !== itemId);
            list.updatedAt = Date.now();
            await db.put('lists', list);
            this.notifyListeners(`list-${listId}`);
          }
          return true;
        }
      } catch (error) {
        console.error('Failed to remove item on server:', error);
        // Fall through for offline premium users
      }
    }

    // Free users or offline: Update IndexedDB only
    const list = await db.get('lists', listId);
    if (list && list.userId === userId) {
      list.items = list.items.filter(item => item.id !== itemId);
      list.updatedAt = Date.now();
      await db.put('lists', list);
      this.notifyListeners(`list-${listId}`);
      return true;
    }

    return false;
  }

  // Update list metadata
  async updateList(listId: string, updates: UpdateListRequest, userId: string, isPremium: boolean): Promise<UserList | null> {
    const db = await this.initDB();

    // Premium users: Try server first
    if (isPremium) {
      try {
        const response = await fetch(`/api/lists/${listId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(updates)
        });

        if (response.ok) {
          const { list } = await response.json();
          await db.put('lists', list);
          this.notifyListeners('lists-changed');
          return list;
        }
      } catch (error) {
        console.error('Failed to update list on server:', error);
        // Fall through for offline premium users
      }
    }

    // Free users or offline: Update IndexedDB only
    const list = await db.get('lists', listId);
    if (list && list.userId === userId) {
      Object.assign(list, updates);
      list.updatedAt = Date.now();
      await db.put('lists', list);
      this.notifyListeners('lists-changed');
      return list;
    }

    return null;
  }

  // Delete a list
  async deleteList(listId: string, userId: string, isPremium: boolean): Promise<boolean> {
    console.log('[ListManager.deleteList] Starting delete:', { listId, userId, isPremium });
    const db = await this.initDB();

    // Premium users: Delete from server AND IndexedDB
    if (isPremium) {
      try {
        console.log('[ListManager.deleteList] Premium user, trying server delete');
        const response = await fetch(`/api/lists/${listId}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        console.log('[ListManager.deleteList] Server response:', response.status, response.ok);

        if (response.ok) {
          console.log('[ListManager.deleteList] Server delete successful, removing from IndexedDB');
          await db.delete('lists', listId);
          this.notifyListeners('lists-changed');
          return true;
        } else {
          console.error('[ListManager.deleteList] Server delete failed:', response.status);
          return false;
        }
      } catch (error) {
        console.error('[ListManager.deleteList] Failed to delete list on server:', error);
        // For offline premium users, still delete locally
        console.log('[ListManager.deleteList] Premium user offline, deleting locally only');
      }
    }

    // Free users or offline premium users: Delete from IndexedDB only
    console.log('[ListManager.deleteList] Deleting from local IndexedDB only');
    const list = await db.get('lists', listId);
    console.log('[ListManager.deleteList] List found in IndexedDB:', list);

    if (list && list.userId === userId) {
      console.log('[ListManager.deleteList] User owns list, deleting from IndexedDB');
      await db.delete('lists', listId);
      this.notifyListeners('lists-changed');
      return true;
    }

    console.log('[ListManager.deleteList] Failed to delete - list not found or user mismatch');
    return false;
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
    const rows = list.items.map(item => [
      item.content,
      item.metadata?.reading || '',
      item.metadata?.meaning || '',
      item.metadata?.notes || '',
      (item.metadata?.tags || []).join(';'),
      new Date(item.metadata?.addedAt || Date.now()).toISOString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  // Import list from CSV or JSON
  async importList(name: string, type: 'sentence' | 'word' | 'verbAdj', data: string, format: 'csv' | 'json' | 'text', userId: string, isPremium: boolean): Promise<UserList | null> {
    const items: ListItem[] = [];

    if (format === 'json') {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        parsed.forEach(item => {
          items.push({
            id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
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

    const list = await this.createList(request, userId, isPremium);
    if (list) {
      // Add all items at once
      const db = await this.initDB();
      list.items = items;
      list.updatedAt = Date.now();
      await db.put('lists', list);
      this.notifyListeners('lists-changed');
    }

    return list;
  }

  // Add to sync queue for later sync
  private async addToSyncQueue(action: string, data: any): Promise<void> {
    const db = await this.initDB();
    await db.add('syncQueue', {
      id: crypto.randomUUID(),
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
    const db = await this.initDB();
    const items = await db.getAllFromIndex('syncQueue', 'timestamp');

    for (const item of items) {
      try {
        // Attempt to sync based on action type
        // Implementation depends on specific sync requirements

        // If successful, remove from queue
        await db.delete('syncQueue', item.id);
      } catch (error) {
        // Increment retry count
        item.retryCount++;
        if (item.retryCount < 3) {
          await db.put('syncQueue', item);
        } else {
          // Give up after 3 retries
          await db.delete('syncQueue', item.id);
        }
      }
    }
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
  private notifyListeners(event: string): void {
    this.listeners.get(event)?.forEach(callback => callback());
  }
}

// Export singleton instance
export const listManager = new ListManager();