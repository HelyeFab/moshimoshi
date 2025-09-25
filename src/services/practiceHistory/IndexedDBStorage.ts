import { PracticeHistoryItem, PracticeHistoryStorage } from './types';

const DB_NAME = 'MoshimoshiPracticeHistory';
const DB_VERSION = 1;
const STORE_NAME = 'practiceHistory';

export class IndexedDBPracticeHistoryStorage implements PracticeHistoryStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Delete old store if it exists (to handle upgrade)
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }

        // Create new store with correct indexes
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('lastPracticed', 'lastPracticed', { unique: false });
        store.createIndex('practiceCount', 'practiceCount', { unique: false });
        store.createIndex('videoId', 'videoId', { unique: false });
      };
    });
  }

  async addOrUpdateItem(item: PracticeHistoryItem): Promise<void> {
    if (!this.db) await this.init();

    const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Check if item exists
    const getRequest = store.index('videoId').get(item.videoId);

    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const existingItem = getRequest.result;

        if (existingItem) {
          // Update existing item
          const updatedItem: PracticeHistoryItem = {
            ...existingItem,
            ...item,
            practiceCount: existingItem.practiceCount + 1,
            lastPracticed: new Date(),
            totalPracticeTime: (existingItem.totalPracticeTime || 0) + (item.totalPracticeTime || 0)
          };

          const updateRequest = store.put(updatedItem);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          // Add new item
          const newItem: PracticeHistoryItem = {
            ...item,
            id: item.videoId, // Use videoId as ID for IndexedDB
            firstPracticed: new Date(),
            lastPracticed: new Date(),
            practiceCount: 1
          };

          const addRequest = store.add(newItem);
          addRequest.onsuccess = () => resolve();
          addRequest.onerror = () => reject(addRequest.error);
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async getItem(videoId: string): Promise<PracticeHistoryItem | null> {
    if (!this.db) await this.init();

    const transaction = this.db!.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.index('videoId').get(videoId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllItems(): Promise<PracticeHistoryItem[]> {
    if (!this.db) await this.init();

    const transaction = this.db!.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const items = request.result || [];
        // Sort by lastPracticed descending
        items.sort((a, b) =>
          new Date(b.lastPracticed).getTime() - new Date(a.lastPracticed).getTime()
        );
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteItem(videoId: string): Promise<void> {
    if (!this.db) await this.init();

    const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('videoId');
    const getRequest = index.getKey(videoId);

    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        if (getRequest.result) {
          const deleteRequest = store.delete(getRequest.result);
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(deleteRequest.error);
        } else {
          resolve(); // Item doesn't exist
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.init();

    const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getItemsByDateRange(startDate: Date, endDate: Date): Promise<PracticeHistoryItem[]> {
    const allItems = await this.getAllItems();
    return allItems.filter(item => {
      const practiceDate = new Date(item.lastPracticed);
      return practiceDate >= startDate && practiceDate <= endDate;
    });
  }

  async getMostPracticed(limit: number = 10): Promise<PracticeHistoryItem[]> {
    const allItems = await this.getAllItems();
    return allItems
      .sort((a, b) => b.practiceCount - a.practiceCount)
      .slice(0, limit);
  }
}