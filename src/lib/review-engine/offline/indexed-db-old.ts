// IndexedDB Storage Layer for Offline Sync

import { ReviewSession, SessionStatistics } from '../core/session.types';
import { ReviewableContent } from '../core/interfaces';

export class IndexedDBStorage {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'MoshimoshiReviewDB';
  private readonly DB_VERSION = 1;
  
  private async ensureInitialized(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }
  }
  
  async initialize(): Promise<void> {
    if (this.db) return; // Already initialized
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('userId', 'userId', { unique: false });
          sessionStore.createIndex('status', 'status', { unique: false });
          sessionStore.createIndex('startedAt', 'startedAt', { unique: false });
        }
        
        // Content store
        if (!db.objectStoreNames.contains('content')) {
          const contentStore = db.createObjectStore('content', { keyPath: 'id' });
          contentStore.createIndex('contentType', 'contentType', { unique: false });
          contentStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }
        
        // Sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncStore.createIndex('type', 'type', { unique: false });
          syncStore.createIndex('status', 'status', { unique: false });
        }
        
        // Statistics store
        if (!db.objectStoreNames.contains('statistics')) {
          const statsStore = db.createObjectStore('statistics', { keyPath: 'sessionId' });
          statsStore.createIndex('userId', 'userId', { unique: false });
        }
        
        // Dead letter queue for failed syncs
        if (!db.objectStoreNames.contains('deadLetterQueue')) {
          const dlqStore = db.createObjectStore('deadLetterQueue', { keyPath: 'id', autoIncrement: true });
          dlqStore.createIndex('timestamp', 'timestamp', { unique: false });
          dlqStore.createIndex('originalType', 'originalType', { unique: false });
        }
      };
    });
  }
  
  // Session operations
  async saveSession(session: ReviewSession): Promise<void> {
    await this.ensureInitialized();
    
    const transaction = this.db!.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');
    await this.promisifyRequest(store.put(session));
  }
  
  async getSession(sessionId: string): Promise<ReviewSession | null> {
    if (!this.db) {
      await this.initialize();
      if (!this.db) return null;
    }
    
    const transaction = this.db.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');
    const result = await this.promisifyRequest(store.get(sessionId));
    return result || null;
  }
  
  async getUserSessions(userId: string): Promise<ReviewSession[]> {
    await this.ensureInitialized();
    
    const transaction = this.db!.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');
    const index = store.index('userId');
    const result = await this.promisifyRequest(index.getAll(userId));
    return result || [];
  }
  
  async getActiveSessions(userId: string): Promise<ReviewSession[]> {
    const transaction = this.db!.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');
    const sessions = await this.getUserSessions(userId);
    return sessions.filter(s => s.status === 'active' || s.status === 'paused');
  }
  
  // Content caching
  async cacheContent(content: ReviewableContent[]): Promise<void> {
    await this.ensureInitialized();
    
    const transaction = this.db!.transaction(['content'], 'readwrite');
    const store = transaction.objectStore('content');
    
    for (const item of content) {
      await this.promisifyRequest(store.put({
        ...item,
        lastAccessed: Date.now()
      }));
    }
  }
  
  async getContent(ids: string[]): Promise<ReviewableContent[]> {
    const transaction = this.db!.transaction(['content'], 'readonly');
    const store = transaction.objectStore('content');
    const results: ReviewableContent[] = [];
    
    for (const id of ids) {
      const item = await this.promisifyRequest(store.get(id));
      if (item) {
        // Update last accessed time
        const updateTx = this.db!.transaction(['content'], 'readwrite');
        const updateStore = updateTx.objectStore('content');
        item.lastAccessed = Date.now();
        await this.promisifyRequest(updateStore.put(item));
        
        results.push(item);
      }
    }
    
    return results;
  }
  
  async getAllContent(): Promise<ReviewableContent[]> {
    const transaction = this.db!.transaction(['content'], 'readonly');
    const store = transaction.objectStore('content');
    const result = await this.promisifyRequest(store.getAll());
    return result || [];
  }
  
  // Sync queue operations
  async addToSyncQueue(item: any): Promise<number> {
    const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    const id = await this.promisifyRequest(store.add({
      ...item,
      timestamp: Date.now(),
      status: 'pending'
    }));
    return id as number;
  }
  
  async getSyncQueueItems(status?: string): Promise<any[]> {
    const transaction = this.db!.transaction(['syncQueue'], 'readonly');
    const store = transaction.objectStore('syncQueue');
    
    if (status) {
      const index = store.index('status');
      return await this.promisifyRequest(index.getAll(status)) || [];
    }
    
    return await this.promisifyRequest(store.getAll()) || [];
  }
  
  async updateSyncQueueItem(item: any): Promise<void> {
    const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    await this.promisifyRequest(store.put(item));
  }
  
  async deleteSyncQueueItem(id: number): Promise<void> {
    const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    await this.promisifyRequest(store.delete(id));
  }
  
  // Dead letter queue operations
  async moveToDeadLetterQueue(item: any): Promise<void> {
    const transaction = this.db!.transaction(['deadLetterQueue', 'syncQueue'], 'readwrite');
    const dlqStore = transaction.objectStore('deadLetterQueue');
    const syncStore = transaction.objectStore('syncQueue');
    
    await this.promisifyRequest(dlqStore.add({
      ...item,
      originalType: item.type,
      movedAt: Date.now()
    }));
    
    if (item.id) {
      await this.promisifyRequest(syncStore.delete(item.id));
    }
  }
  
  // Statistics operations
  async saveStatistics(sessionId: string, userId: string, statistics: SessionStatistics): Promise<void> {
    const transaction = this.db!.transaction(['statistics'], 'readwrite');
    const store = transaction.objectStore('statistics');
    await this.promisifyRequest(store.put({
      ...statistics,
      sessionId,
      userId,
      savedAt: Date.now()
    }));
  }
  
  async getStatistics(sessionId: string): Promise<SessionStatistics | null> {
    const transaction = this.db!.transaction(['statistics'], 'readonly');
    const store = transaction.objectStore('statistics');
    const result = await this.promisifyRequest(store.get(sessionId));
    return result || null;
  }
  
  async getUserStatistics(userId: string): Promise<SessionStatistics[]> {
    const transaction = this.db!.transaction(['statistics'], 'readonly');
    const store = transaction.objectStore('statistics');
    const index = store.index('userId');
    const result = await this.promisifyRequest(index.getAll(userId));
    return result || [];
  }
  
  // Cleanup operations
  async cleanupOldData(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    // Clean old sessions
    const transaction = this.db!.transaction(['sessions', 'content', 'statistics'], 'readwrite');
    const sessionStore = transaction.objectStore('sessions');
    const sessionIndex = sessionStore.index('startedAt');
    const range = IDBKeyRange.upperBound(cutoffDate);
    
    const oldSessions = await this.promisifyRequest(sessionIndex.getAllKeys(range));
    for (const key of oldSessions) {
      const session = await this.promisifyRequest(sessionStore.get(key));
      // Only delete completed or abandoned sessions
      if (session && (session.status === 'completed' || session.status === 'abandoned')) {
        await this.promisifyRequest(sessionStore.delete(key));
      }
    }
    
    // Clean unused content
    const contentStore = transaction.objectStore('content');
    const contentIndex = contentStore.index('lastAccessed');
    const oldContent = await this.promisifyRequest(contentIndex.getAllKeys(range));
    
    for (const key of oldContent) {
      await this.promisifyRequest(contentStore.delete(key));
    }
    
    // Clean old statistics
    const statsStore = transaction.objectStore('statistics');
    const allStats = await this.promisifyRequest(statsStore.getAll());
    for (const stat of allStats) {
      if (stat.savedAt && stat.savedAt < cutoffDate) {
        await this.promisifyRequest(statsStore.delete(stat.sessionId));
      }
    }
  }
  
  // Storage quota management
  async getStorageInfo(): Promise<{ usage: number; quota: number; percentUsed: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;
      
      return {
        usage,
        quota,
        percentUsed
      };
    }
    
    // Fallback for browsers that don't support storage estimation
    return {
      usage: 0,
      quota: 0,
      percentUsed: 0
    };
  }
  
  async requestPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      return await navigator.storage.persist();
    }
    return false;
  }
  
  // Clear all data (use with caution!)
  async clearAll(): Promise<void> {
    const transaction = this.db!.transaction(
      ['sessions', 'content', 'syncQueue', 'statistics', 'deadLetterQueue'],
      'readwrite'
    );
    
    const stores = [
      transaction.objectStore('sessions'),
      transaction.objectStore('content'),
      transaction.objectStore('syncQueue'),
      transaction.objectStore('statistics'),
      transaction.objectStore('deadLetterQueue')
    ];
    
    for (const store of stores) {
      await this.promisifyRequest(store.clear());
    }
  }
  
  // Close database connection
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
  
  // Helper method to promisify IndexedDB requests
  private promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}