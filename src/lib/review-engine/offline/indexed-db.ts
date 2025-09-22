/**
 * IndexedDB Storage for Offline Support
 * Fixed version with proper initialization checks
 */

import { ReviewableContent } from '../core/interfaces';
import { ReviewSession } from '../core/session.types';
import { ProgressData } from '../progress/progress-tracker';
import { reviewLogger } from '@/lib/monitoring/logger';

export class IndexedDBStorage {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'MoshimoshiReviewDB';
  private readonly DB_VERSION = 1;
  private initializationPromise: Promise<void> | null = null;
  
  /**
   * Ensure database is initialized before any operation
   */
  private async ensureInitialized(): Promise<void> {
    if (this.db) return;
    
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }
    
    this.initializationPromise = this.initialize();
    await this.initializationPromise;
    
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }
  }
  
  async initialize(): Promise<void> {
    if (this.db) return; // Already initialized
    
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
        
        request.onerror = () => {
          reviewLogger.error('IndexedDB error:', request.error);
          reject(request.error);
        };
        
        request.onsuccess = () => {
          this.db = request.result;
          reviewLogger.info('IndexedDB initialized successfully');
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
      } catch (error) {
        reviewLogger.error('Failed to open IndexedDB:', error);
        reject(error);
      }
    });
  }
  
  // Session operations
  async saveSession(session: ReviewSession): Promise<void> {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db!.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      await this.promisifyRequest(store.put(session));
    } catch (error) {
      reviewLogger.error('Failed to save session:', error);
      // Don't throw - allow app to continue without offline support
    }
  }
  
  async getSession(sessionId: string): Promise<ReviewSession | null> {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db!.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const result = await this.promisifyRequest(store.get(sessionId));
      return result || null;
    } catch (error) {
      reviewLogger.error('Failed to get session:', error);
      return null;
    }
  }
  
  async getUserSessions(userId: string): Promise<ReviewSession[]> {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db!.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const index = store.index('userId');
      const result = await this.promisifyRequest(index.getAll(userId));
      return result || [];
    } catch (error) {
      reviewLogger.error('Failed to get user sessions:', error);
      return [];
    }
  }
  
  async getActiveSessions(userId: string): Promise<ReviewSession[]> {
    const sessions = await this.getUserSessions(userId);
    return sessions.filter(s => s.status === 'active' || s.status === 'paused');
  }
  
  // Content caching
  async cacheContent(content: ReviewableContent[]): Promise<void> {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db!.transaction(['content'], 'readwrite');
      const store = transaction.objectStore('content');
      
      for (const item of content) {
        await this.promisifyRequest(store.put({
          ...item,
          lastAccessed: Date.now()
        }));
      }
    } catch (error) {
      reviewLogger.error('Failed to cache content:', error);
      // Don't throw - allow app to continue
    }
  }
  
  async getContent(ids: string[]): Promise<ReviewableContent[]> {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db!.transaction(['content'], 'readonly');
      const store = transaction.objectStore('content');
      const results: ReviewableContent[] = [];
      
      for (const id of ids) {
        const item = await this.promisifyRequest(store.get(id));
        if (item) {
          results.push(item);
          
          // Update last accessed time
          const updateTx = this.db!.transaction(['content'], 'readwrite');
          const updateStore = updateTx.objectStore('content');
          item.lastAccessed = Date.now();
          await this.promisifyRequest(updateStore.put(item));
        }
      }
      
      return results;
    } catch (error) {
      reviewLogger.error('Failed to get content:', error);
      return [];
    }
  }
  
  async getAllContent(): Promise<ReviewableContent[]> {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db!.transaction(['content'], 'readonly');
      const store = transaction.objectStore('content');
      const result = await this.promisifyRequest(store.getAll());
      return result || [];
    } catch (error) {
      reviewLogger.error('Failed to get all content:', error);
      return [];
    }
  }
  
  // Sync queue operations
  async addToSyncQueue(item: any): Promise<void> {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      await this.promisifyRequest(store.add({
        ...item,
        timestamp: Date.now(),
        status: 'pending'
      }));
    } catch (error) {
      reviewLogger.error('Failed to add to sync queue:', error);
    }
  }
  
  async getSyncQueue(): Promise<any[]> {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db!.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      const index = store.index('status');
      const result = await this.promisifyRequest(index.getAll('pending'));
      return result || [];
    } catch (error) {
      reviewLogger.error('Failed to get sync queue:', error);
      return [];
    }
  }
  
  async updateSyncQueueItem(id: number, updates: any): Promise<void> {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const existing = await this.promisifyRequest(store.get(id));
      if (existing) {
        await this.promisifyRequest(store.put({ ...existing, ...updates }));
      }
    } catch (error) {
      reviewLogger.error('Failed to update sync queue item:', error);
    }
  }
  
  async removeSyncQueueItem(id: number): Promise<void> {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      await this.promisifyRequest(store.delete(id));
    } catch (error) {
      reviewLogger.error('Failed to remove sync queue item:', error);
    }
  }
  
  async moveToDeadLetter(item: any): Promise<void> {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db!.transaction(['deadLetterQueue', 'syncQueue'], 'readwrite');
      const dlqStore = transaction.objectStore('deadLetterQueue');
      const syncStore = transaction.objectStore('syncQueue');
      
      await this.promisifyRequest(dlqStore.add({
        ...item,
        movedAt: Date.now(),
        originalType: item.type
      }));
      
      if (item.id) {
        await this.promisifyRequest(syncStore.delete(item.id));
      }
    } catch (error) {
      reviewLogger.error('Failed to move to dead letter queue:', error);
    }
  }
  
  // Statistics operations
  async saveStatistics(sessionId: string, statistics: any): Promise<void> {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db!.transaction(['statistics'], 'readwrite');
      const store = transaction.objectStore('statistics');
      await this.promisifyRequest(store.put({
        ...statistics,
        sessionId,
        timestamp: Date.now()
      }));
    } catch (error) {
      reviewLogger.error('Failed to save statistics:', error);
    }
  }
  
  async getStatistics(sessionId: string): Promise<any | null> {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db!.transaction(['statistics'], 'readonly');
      const store = transaction.objectStore('statistics');
      const result = await this.promisifyRequest(store.get(sessionId));
      return result || null;
    } catch (error) {
      reviewLogger.error('Failed to get statistics:', error);
      return null;
    }
  }
  
  async getUserStatistics(userId: string): Promise<any[]> {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db!.transaction(['statistics'], 'readonly');
      const store = transaction.objectStore('statistics');
      const index = store.index('userId');
      const result = await this.promisifyRequest(index.getAll(userId));
      return result || [];
    } catch (error) {
      reviewLogger.error('Failed to get user statistics:', error);
      return [];
    }
  }
  
  // Cleanup operations
  async cleanupOldData(daysToKeep: number = 30): Promise<void> {
    try {
      await this.ensureInitialized();
      
      const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      
      // Clean old sessions
      const transaction = this.db!.transaction(['sessions', 'content', 'statistics'], 'readwrite');
      const sessionStore = transaction.objectStore('sessions');
      const sessionIndex = sessionStore.index('startedAt');
      const range = IDBKeyRange.upperBound(cutoffDate);
      
      const oldSessions = await this.promisifyRequest(sessionIndex.getAllKeys(range));
      for (const key of oldSessions) {
        await this.promisifyRequest(sessionStore.delete(key));
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
        if (stat.timestamp && stat.timestamp < cutoffDate) {
          await this.promisifyRequest(statsStore.delete(stat.sessionId));
        }
      }
    } catch (error) {
      reviewLogger.error('Failed to cleanup old data:', error);
    }
  }
  
  async clearAllData(): Promise<void> {
    try {
      await this.ensureInitialized();
      
      const storeNames = ['sessions', 'content', 'syncQueue', 'statistics', 'deadLetterQueue'];
      const transaction = this.db!.transaction(storeNames, 'readwrite');
      
      for (const storeName of storeNames) {
        const store = transaction.objectStore(storeName);
        await this.promisifyRequest(store.clear());
      }
    } catch (error) {
      reviewLogger.error('Failed to clear all data:', error);
    }
  }
  
  async getStorageSize(): Promise<{ usage: number; quota: number }> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          usage: estimate.usage || 0,
          quota: estimate.quota || 0
        };
      }
    } catch (error) {
      reviewLogger.error('Failed to get storage size:', error);
    }
    
    return { usage: 0, quota: 0 };
  }
  
  private promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  // Check if database is ready
  isReady(): boolean {
    return this.db !== null;
  }
  
  // Close database connection
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initializationPromise = null;
    }
  }
}