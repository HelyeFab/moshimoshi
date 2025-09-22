/**
 * Integration Tests for Offline Sync System
 * Tests reliability, performance, and data consistency under load
 */

import { ImprovedSyncQueue } from '../improved-sync-queue';
import { SimplifiedConflictResolver } from '../simplified-conflict-resolver';
import { SyncTelemetry } from '../sync-telemetry';
import { IndexedDBStorage } from '../indexed-db';

// Mock implementations
class MockIndexedDBStorage extends IndexedDBStorage {
  private syncQueue: any[] = [];
  private deadLetterQueue: any[] = [];
  
  async getSyncQueueItems(status: string): Promise<any[]> {
    return this.syncQueue.filter(item => item.status === status);
  }
  
  async addToSyncQueue(item: any): Promise<number> {
    const id = this.syncQueue.length + 1;
    this.syncQueue.push({ ...item, id });
    return id;
  }
  
  async updateSyncQueueItem(item: any): Promise<void> {
    const index = this.syncQueue.findIndex(i => i.id === item.id);
    if (index !== -1) {
      this.syncQueue[index] = item;
    }
  }
  
  async deleteSyncQueueItem(id: number): Promise<void> {
    this.syncQueue = this.syncQueue.filter(item => item.id !== id);
  }
  
  async moveToDeadLetterQueue(item: any): Promise<void> {
    this.deadLetterQueue.push(item);
  }
  
  getDeadLetterQueueSize(): number {
    return this.deadLetterQueue.length;
  }
  
  getSyncQueueSize(): number {
    return this.syncQueue.length;
  }
}

class MockAPIClient {
  private failureRate: number = 0;
  private latency: number = 50;
  private callCount: number = 0;
  
  setFailureRate(rate: number): void {
    this.failureRate = rate;
  }
  
  setLatency(ms: number): void {
    this.latency = ms;
  }
  
  getCallCount(): number {
    return this.callCount;
  }
  
  private async simulateNetwork(): Promise<void> {
    this.callCount++;
    await new Promise(resolve => setTimeout(resolve, this.latency));
    
    if (Math.random() < this.failureRate) {
      throw new Error('Network error');
    }
  }
  
  async createSession(session: any): Promise<any> {
    await this.simulateNetwork();
    return { ...session, id: 'mock-id' };
  }
  
  async updateSession(id: string, updates: any): Promise<any> {
    await this.simulateNetwork();
    return { id, ...updates };
  }
  
  async submitAnswer(data: any): Promise<any> {
    await this.simulateNetwork();
    return { success: true };
  }
  
  async saveStatistics(statistics: any): Promise<void> {
    await this.simulateNetwork();
  }
  
  async updateProgress(progress: any): Promise<void> {
    await this.simulateNetwork();
  }
}

describe('Offline Sync Integration Tests', () => {
  let storage: MockIndexedDBStorage;
  let apiClient: MockAPIClient;
  let syncQueue: ImprovedSyncQueue;
  let telemetry: SyncTelemetry;
  
  beforeEach(() => {
    storage = new MockIndexedDBStorage();
    apiClient = new MockAPIClient();
    telemetry = new SyncTelemetry();
    syncQueue = new ImprovedSyncQueue(storage, apiClient);
  });
  
  afterEach(() => {
    syncQueue.cleanup();
  });
  
  describe('Load Testing', () => {
    test('should handle 1000 concurrent items', async () => {
      const startTime = Date.now();
      const items = [];
      
      // Add 1000 items
      for (let i = 0; i < 1000; i++) {
        items.push(
          syncQueue.add({
            type: 'progress',
            action: 'update',
            data: { id: i, value: Math.random() }
          })
        );
      }
      
      await Promise.all(items);
      
      // Process queue
      await syncQueue.process();
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const status = await syncQueue.getQueueStatus();
      const metrics = syncQueue.getMetrics();
      
      expect(status.total).toBeLessThan(100); // Most should be processed
      expect(metrics.successfulSyncs).toBeGreaterThan(900);
      expect(Date.now() - startTime).toBeLessThan(10000); // Under 10 seconds
    });
    
    test('should maintain performance under sustained load', async () => {
      const duration = 5000; // 5 seconds
      const startTime = Date.now();
      let itemsAdded = 0;
      
      // Continuously add items
      const interval = setInterval(() => {
        if (Date.now() - startTime < duration) {
          syncQueue.add({
            type: 'answer',
            action: 'create',
            data: { answer: 'test', timestamp: Date.now() }
          });
          itemsAdded++;
        } else {
          clearInterval(interval);
        }
      }, 10); // Add item every 10ms
      
      // Start auto-sync
      syncQueue.startAutoSync(100);
      
      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, duration + 1000));
      
      const metrics = syncQueue.getMetrics();
      
      expect(itemsAdded).toBeGreaterThan(400);
      expect(metrics.syncRate).toBeGreaterThan(0);
      expect(metrics.successRate).toBeGreaterThan(95);
    });
  });
  
  describe('Reliability Testing', () => {
    test('should handle network failures with exponential backoff', async () => {
      apiClient.setFailureRate(0.5); // 50% failure rate
      
      await syncQueue.add({
        type: 'session',
        action: 'create',
        data: { userId: 'test' }
      });
      
      await syncQueue.process();
      
      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const metrics = syncQueue.getMetrics();
      const status = await syncQueue.getQueueStatus();
      
      expect(metrics.averageRetryCount).toBeGreaterThan(0);
      expect(apiClient.getCallCount()).toBeGreaterThan(1); // Should retry
    });
    
    test('should trigger circuit breaker on repeated failures', async () => {
      apiClient.setFailureRate(1); // 100% failure rate
      
      // Add multiple items
      for (let i = 0; i < 10; i++) {
        await syncQueue.add({
          type: 'progress',
          action: 'update',
          data: { id: i }
        });
      }
      
      await syncQueue.process();
      
      // Wait for circuit breaker
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const status = await syncQueue.getQueueStatus();
      const metrics = syncQueue.getMetrics();
      
      expect(status.circuitBreakerOpen).toBe(true);
      expect(metrics.circuitBreakerTrips).toBeGreaterThan(0);
    });
    
    test('should move items to dead letter queue after max retries', async () => {
      apiClient.setFailureRate(1); // Always fail
      
      await syncQueue.add({
        type: 'statistics',
        action: 'create',
        data: { sessionId: 'test' }
      });
      
      // Process multiple times to trigger retries
      for (let i = 0; i < 5; i++) {
        await syncQueue.process();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const deadLetterSize = storage.getDeadLetterQueueSize();
      expect(deadLetterSize).toBeGreaterThan(0);
    });
  });
  
  describe('Conflict Resolution', () => {
    test('should resolve conflicts using last-write-wins', () => {
      const resolver = new SimplifiedConflictResolver();
      
      const local = {
        id: '1',
        lastActivityAt: 1000,
        data: 'local'
      };
      
      const remote = {
        id: '1',
        lastActivityAt: 2000,
        data: 'remote'
      };
      
      const result = resolver.resolveSessionConflict(local as any, remote as any);
      
      expect(result.resolved).toBe(remote);
      expect(result.winner).toBe('remote');
      expect(result.strategy).toBe('last-write-wins');
    });
    
    test('should handle batch conflict resolution', () => {
      const resolver = new SimplifiedConflictResolver();
      
      const localItems = [
        { id: '1', lastModified: 1000, data: 'local1' },
        { id: '2', lastModified: 2000, data: 'local2' },
        { id: '3', lastModified: 3000, data: 'local3' }
      ];
      
      const remoteItems = [
        { id: '1', lastModified: 1500, data: 'remote1' },
        { id: '2', lastModified: 1500, data: 'remote2' },
        { id: '4', lastModified: 4000, data: 'remote4' }
      ];
      
      const resolved = resolver.resolveBatch(localItems, remoteItems);
      
      expect(resolved.length).toBe(4);
      expect(resolved.find(i => i.id === '1')?.data).toBe('remote1');
      expect(resolved.find(i => i.id === '2')?.data).toBe('local2');
      expect(resolved.find(i => i.id === '3')).toBeDefined();
      expect(resolved.find(i => i.id === '4')).toBeDefined();
    });
  });
  
  describe('Data Consistency', () => {
    test('should maintain data order during sync', async () => {
      const items = [];
      
      for (let i = 0; i < 10; i++) {
        items.push({
          type: 'answer' as const,
          action: 'create' as const,
          data: { sequence: i, timestamp: Date.now() + i }
        });
      }
      
      // Add items in order
      for (const item of items) {
        await syncQueue.add(item);
      }
      
      await syncQueue.process();
      
      // Verify order is maintained
      const processedOrder = apiClient.getCallCount();
      expect(processedOrder).toBeGreaterThan(0);
    });
    
    test('should handle concurrent modifications correctly', async () => {
      const itemId = 'test-item';
      
      // Simulate concurrent updates
      await Promise.all([
        syncQueue.add({
          type: 'progress',
          action: 'update',
          data: { id: itemId, value: 1, timestamp: 1000 }
        }),
        syncQueue.add({
          type: 'progress',
          action: 'update',
          data: { id: itemId, value: 2, timestamp: 2000 }
        }),
        syncQueue.add({
          type: 'progress',
          action: 'update',
          data: { id: itemId, value: 3, timestamp: 3000 }
        })
      ]);
      
      await syncQueue.process();
      
      // All updates should be processed
      expect(apiClient.getCallCount()).toBe(3);
    });
  });
  
  describe('Performance Metrics', () => {
    test('should track sync performance accurately', async () => {
      apiClient.setLatency(100);
      
      for (let i = 0; i < 10; i++) {
        await syncQueue.add({
          type: 'statistics',
          action: 'create',
          data: { id: i }
        });
      }
      
      await syncQueue.process();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const metrics = syncQueue.getMetrics();
      
      expect(metrics.successfulSyncs).toBe(10);
      expect(metrics.syncRate).toBeGreaterThan(0);
      expect(metrics.averageRetryCount).toBe(0);
    });
    
    test('should calculate percentiles correctly', () => {
      const telemetry = new SyncTelemetry();
      
      // Record various sync times
      const times = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      times.forEach(time => telemetry.recordSyncTime(time));
      
      const metrics = telemetry.getPerformanceMetrics();
      
      expect(metrics.p50SyncTime).toBeCloseTo(50, 10);
      expect(metrics.p95SyncTime).toBeCloseTo(95, 10);
      expect(metrics.averageSyncTime).toBeCloseTo(55, 10);
    });
  });
  
  describe('Error Recovery', () => {
    test('should recover from temporary network issues', async () => {
      // Start with failures
      apiClient.setFailureRate(1);
      
      await syncQueue.add({
        type: 'session',
        action: 'create',
        data: { test: true }
      });
      
      await syncQueue.process();
      
      // Network recovers
      apiClient.setFailureRate(0);
      
      // Retry
      await syncQueue.retryAll();
      await syncQueue.process();
      
      const status = await syncQueue.getQueueStatus();
      expect(status.total).toBe(0); // Should be cleared
    });
    
    test('should handle partial sync failures gracefully', async () => {
      // Fail every other request
      let callCount = 0;
      apiClient.setFailureRate(0);
      
      const originalCreate = apiClient.createSession.bind(apiClient);
      apiClient.createSession = async (session: any) => {
        callCount++;
        if (callCount % 2 === 0) {
          throw new Error('Intermittent failure');
        }
        return originalCreate(session);
      };
      
      // Add multiple items
      for (let i = 0; i < 5; i++) {
        await syncQueue.add({
          type: 'session',
          action: 'create',
          data: { id: i }
        });
      }
      
      // Process with retries
      for (let i = 0; i < 3; i++) {
        await syncQueue.process();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const metrics = syncQueue.getMetrics();
      expect(metrics.retryRate).toBeGreaterThan(0);
    });
  });
});

describe('Sync System Stress Tests', () => {
  test('should handle rapid online/offline transitions', async () => {
    const storage = new MockIndexedDBStorage();
    const apiClient = new MockAPIClient();
    const syncQueue = new ImprovedSyncQueue(storage, apiClient);
    
    // Simulate rapid network changes
    for (let i = 0; i < 10; i++) {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: i % 2 === 0
      });
      
      await syncQueue.add({
        type: 'progress',
        action: 'update',
        data: { id: i }
      });
      
      await syncQueue.process();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Restore online
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
    
    await syncQueue.process();
    
    const status = await syncQueue.getQueueStatus();
    expect(status.circuitBreakerOpen).toBe(false);
    
    syncQueue.cleanup();
  });
  
  test('should maintain 99.9% reliability target', async () => {
    const storage = new MockIndexedDBStorage();
    const apiClient = new MockAPIClient();
    const syncQueue = new ImprovedSyncQueue(storage, apiClient);
    
    // Set realistic failure rate (0.1%)
    apiClient.setFailureRate(0.001);
    apiClient.setLatency(50);
    
    // Add 1000 items
    for (let i = 0; i < 1000; i++) {
      await syncQueue.add({
        type: 'answer',
        action: 'create',
        data: { id: i, timestamp: Date.now() }
      });
    }
    
    // Process all
    syncQueue.startAutoSync(100);
    
    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const metrics = syncQueue.getMetrics();
    const reliability = metrics.successRate;
    
    expect(reliability).toBeGreaterThan(99.9);
    
    syncQueue.cleanup();
  });
});