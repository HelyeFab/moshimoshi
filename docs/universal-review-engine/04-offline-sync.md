# Module 4: Offline Sync System

**Status**: 🔴 Not Started  
**Priority**: MEDIUM  
**Owner**: Agent 4  
**Dependencies**: Core Interfaces (Module 1), Session Management (Module 3)  
**Estimated Time**: 6-7 hours  

## Overview
Implement offline-first infrastructure using IndexedDB for storage, Service Workers for background sync, and a robust queue management system. This ensures users can review even without internet connection.

## Deliverables

### 1. IndexedDB Storage Layer

```typescript
// lib/review-engine/offline/indexed-db.ts

import { ReviewSession, ReviewableContent, SessionStatistics } from '../core/interfaces';

export class IndexedDBStorage {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'MoshimoshiReviewDB';
  private readonly DB_VERSION = 1;
  
  async initialize(): Promise<void> {
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
      };
    });
  }
  
  // Session operations
  async saveSession(session: ReviewSession): Promise<void> {
    const transaction = this.db!.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');
    await this.promisifyRequest(store.put(session));
  }
  
  async getSession(sessionId: string): Promise<ReviewSession | null> {
    const transaction = this.db!.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');
    const result = await this.promisifyRequest(store.get(sessionId));
    return result || null;
  }
  
  async getUserSessions(userId: string): Promise<ReviewSession[]> {
    const transaction = this.db!.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');
    const index = store.index('userId');
    const result = await this.promisifyRequest(index.getAll(userId));
    return result || [];
  }
  
  // Content caching
  async cacheContent(content: ReviewableContent[]): Promise<void> {
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
      if (item) results.push(item);
    }
    
    return results;
  }
  
  // Cleanup old data
  async cleanupOldData(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    // Clean old sessions
    const transaction = this.db!.transaction(['sessions', 'content'], 'readwrite');
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
  }
  
  private promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
```

### 2. Sync Queue Management

```typescript
// lib/review-engine/offline/sync-queue.ts

export interface SyncQueueItem {
  id?: number;
  type: 'session' | 'answer' | 'statistics' | 'progress';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  error?: string;
}

export class SyncQueue {
  private queue: SyncQueueItem[] = [];
  private isProcessing = false;
  private syncInterval: number | null = null;
  
  constructor(
    private storage: IndexedDBStorage,
    private apiClient: ReviewAPIClient
  ) {
    this.loadQueue();
  }
  
  async add(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<void> {
    const queueItem: SyncQueueItem = {
      ...item,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    };
    
    // Save to IndexedDB
    await this.storage.addToSyncQueue(queueItem);
    
    // Add to memory queue
    this.queue.push(queueItem);
    
    // Try to sync immediately if online
    if (navigator.onLine) {
      this.process();
    }
  }
  
  async process(): Promise<void> {
    if (this.isProcessing || !navigator.onLine) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const item = this.queue[0];
      
      try {
        item.status = 'syncing';
        await this.syncItem(item);
        
        item.status = 'completed';
        await this.storage.updateSyncQueueItem(item);
        
        this.queue.shift();
      } catch (error) {
        item.retryCount++;
        item.status = 'failed';
        item.error = error.message;
        
        if (item.retryCount >= 3) {
          // Move to dead letter queue
          await this.moveToDeadLetter(item);
          this.queue.shift();
        } else {
          // Move to end of queue for retry
          this.queue.push(this.queue.shift()!);
        }
        
        await this.storage.updateSyncQueueItem(item);
        
        // Wait before retrying
        await this.delay(Math.pow(2, item.retryCount) * 1000);
      }
    }
    
    this.isProcessing = false;
  }
  
  private async syncItem(item: SyncQueueItem): Promise<void> {
    switch (item.type) {
      case 'session':
        if (item.action === 'create') {
          await this.apiClient.createSession(item.data);
        } else if (item.action === 'update') {
          await this.apiClient.updateSession(item.data.id, item.data);
        }
        break;
        
      case 'answer':
        await this.apiClient.submitAnswer(item.data);
        break;
        
      case 'statistics':
        await this.apiClient.saveStatistics(item.data);
        break;
        
      case 'progress':
        await this.apiClient.updateProgress(item.data);
        break;
    }
  }
  
  startAutoSync(intervalMs: number = 30000): void {
    if (this.syncInterval) return;
    
    this.syncInterval = window.setInterval(() => {
      if (navigator.onLine) {
        this.process();
      }
    }, intervalMs);
    
    // Listen for online/offline events
    window.addEventListener('online', () => this.process());
    window.addEventListener('offline', () => this.pause());
  }
  
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 3. Service Worker

```typescript
// public/sw.js

const CACHE_NAME = 'moshimoshi-review-v1';
const urlsToCache = [
  '/',
  '/review',
  '/offline.html',
  '/manifest.json'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  // Cache-first strategy for static assets
  if (event.request.url.includes('/static/')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request))
    );
    return;
  }
  
  // Network-first strategy for API calls
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone the response
          const responseClone = response.clone();
          
          // Cache successful responses
          if (response.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          
          return response;
        })
        .catch(() => {
          // Return cached response if available
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Default strategy
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'review-sync') {
    event.waitUntil(syncReviewData());
  }
});

async function syncReviewData() {
  // Get pending sync items from IndexedDB
  const db = await openDB();
  const tx = db.transaction('syncQueue', 'readonly');
  const store = tx.objectStore('syncQueue');
  const index = store.index('status');
  const pending = await index.getAll('pending');
  
  // Process each item
  for (const item of pending) {
    try {
      const response = await fetch('/api/review/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      
      if (response.ok) {
        // Mark as synced
        const tx = db.transaction('syncQueue', 'readwrite');
        const store = tx.objectStore('syncQueue');
        item.status = 'completed';
        await store.put(item);
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }
}
```

### 4. Conflict Resolution

```typescript
// lib/review-engine/offline/conflict-resolver.ts

export class ConflictResolver {
  resolveSessionConflict(
    local: ReviewSession,
    remote: ReviewSession
  ): ReviewSession {
    // Last-write-wins strategy with merge
    const merged = { ...local };
    
    // Use remote if it's newer
    if (remote.lastActivityAt > local.lastActivityAt) {
      return remote;
    }
    
    // Merge statistics (take maximum values)
    if (local.statistics && remote.statistics) {
      merged.statistics = {
        ...local.statistics,
        correctItems: Math.max(
          local.statistics.correctItems,
          remote.statistics.correctItems
        ),
        completedItems: Math.max(
          local.statistics.completedItems,
          remote.statistics.completedItems
        )
      };
    }
    
    return merged;
  }
  
  resolveProgressConflict(
    local: ProgressData,
    remote: ProgressData
  ): ProgressData {
    // Merge progress, taking the best values
    return {
      ...local,
      learned: Math.max(local.learned, remote.learned),
      reviewCount: Math.max(local.reviewCount, remote.reviewCount),
      correctCount: Math.max(local.correctCount, remote.correctCount),
      lastReviewed: local.lastReviewed > remote.lastReviewed 
        ? local.lastReviewed 
        : remote.lastReviewed
    };
  }
}
```

## Testing Requirements

```typescript
// __tests__/offline/sync.test.ts

describe('Offline Sync System', () => {
  describe('IndexedDB Storage', () => {
    it('should initialize database');
    it('should save and retrieve sessions');
    it('should clean up old data');
  });
  
  describe('Sync Queue', () => {
    it('should queue items when offline');
    it('should process queue when online');
    it('should handle retry logic');
    it('should move failed items to dead letter queue');
  });
  
  describe('Conflict Resolution', () => {
    it('should resolve session conflicts');
    it('should merge statistics correctly');
    it('should handle edge cases');
  });
});
```

## Acceptance Criteria

- [ ] IndexedDB properly initialized
- [ ] Offline sessions fully functional
- [ ] Automatic sync when connection restored
- [ ] Conflict resolution without data loss
- [ ] Service Worker caching strategies
- [ ] Background sync implementation
- [ ] Storage quota management
- [ ] 85% test coverage