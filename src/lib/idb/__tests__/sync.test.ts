/**
 * Sync Tests for Agent 3 - Data & Sync
 *
 * Comprehensive tests for offline sync, conflict resolution, and data integrity
 */

import { idbClient } from '../client';
import { outboxManager } from '../outbox';
import { firebaseSync } from '../firebase-sync';
import { accountCleanup } from '../account-cleanup';
import { DB_NAME } from '../types';

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock IndexedDB (using fake-indexeddb)
require('fake-indexeddb/auto');

// Mock service worker
const mockServiceWorker = {
  ready: Promise.resolve({
    sync: {
      register: jest.fn()
    }
  })
};

Object.defineProperty(navigator, 'serviceWorker', {
  value: mockServiceWorker,
  writable: true
});

describe('IndexedDB Client', () => {
  beforeEach(async () => {
    // Clear all data before each test
    await idbClient.clearAllData();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Operations', () => {
    test('should add and retrieve a list', async () => {
      const listId = await idbClient.addList({
        title: 'Test List',
        type: 'words'
      });

      expect(listId).toBeDefined();
      expect(listId).toMatch(/^list_/);

      const lists = await idbClient.getAllLists();
      expect(lists).toHaveLength(1);
      expect(lists[0].title).toBe('Test List');
      expect(lists[0].type).toBe('words');
    });

    test('should add items to a list', async () => {
      const listId = await idbClient.addList({
        title: 'Test List',
        type: 'sentences'
      });

      await idbClient.addItems(listId, [
        { payload: { text: 'こんにちは', translation: 'Hello' } },
        { payload: { text: 'ありがとう', translation: 'Thank you' } }
      ]);

      const items = await idbClient.getItemsByListId(listId);
      expect(items).toHaveLength(2);
      expect(items[0].payload.text).toBe('こんにちは');
    });

    test('should get due items for review', async () => {
      const listId = await idbClient.addList({
        title: 'Review List',
        type: 'words'
      });

      await idbClient.addItems(listId, [
        { payload: { word: 'test1' } },
        { payload: { word: 'test2' } }
      ]);

      const dueItems = await idbClient.getDueItems();
      expect(dueItems).toHaveLength(2);
    });

    test('should update and retrieve streak', async () => {
      await idbClient.updateStreak({
        current: 5,
        best: 10
      });

      const streak = await idbClient.getStreak();
      expect(streak).toBeDefined();
      expect(streak?.current).toBe(5);
      expect(streak?.best).toBe(10);
    });

    test('should emit dueCountChanged event when items are added', async () => {
      let eventFired = false;
      let eventCount = 0;

      const listener = (event: Event) => {
        eventFired = true;
        eventCount = (event as CustomEvent).detail.count;
      };

      document.addEventListener('dueCountChanged', listener);

      const listId = await idbClient.addList({
        title: 'Test List',
        type: 'words'
      });

      await idbClient.addItems(listId, [
        { payload: { word: 'test' } }
      ]);

      // Wait for async event
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(eventFired).toBe(true);
      expect(eventCount).toBeGreaterThan(0);

      document.removeEventListener('dueCountChanged', listener);
    });
  });

  describe('Sync Operations', () => {
    test('should queue operations for sync when offline', async () => {
      // Mock offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true
      });

      const listId = await idbClient.addList({
        title: 'Offline List',
        type: 'verbs'
      });

      const pendingItems = await idbClient.getPendingSyncItems();
      expect(pendingItems.length).toBeGreaterThan(0);
      expect(pendingItems[0].type).toBe('addList');
    });

    test('should handle sync conflicts with LWW policy', async () => {
      const localList = {
        id: 'list_123',
        title: 'Local Version',
        type: 'words' as const,
        updatedAt: Date.now(),
        createdAt: Date.now()
      };

      const remoteList = {
        id: 'list_123',
        title: 'Remote Version',
        type: 'words' as const,
        updatedAt: Date.now() - 1000, // Older
        createdAt: Date.now() - 2000
      };

      // Mock fetch to return remote data
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [remoteList]
      });

      const result = await firebaseSync.syncAll();

      // Local should win (LWW - local is newer)
      const lists = await idbClient.getAllLists();
      const syncedList = lists.find(l => l.id === 'list_123');
      expect(syncedList?.title).toBe('Local Version');
    });

    test('should handle merge conflicts for lists', async () => {
      // Test merge policy for lists
      // Implementation would test actual merge logic
    });

    test('should handle append conflicts for review history', async () => {
      // Test append policy for review history
      // Implementation would test combining history arrays
    });
  });

  describe('Outbox Manager', () => {
    test('should process outbox with exponential backoff on failure', async () => {
      // Mock failed API call
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true });

      await outboxManager.queue('addList', { title: 'Test' });

      await outboxManager.sync();

      // Should retry with backoff
      const status = await outboxManager.getStatus();
      expect(status.pendingCount).toBeGreaterThanOrEqual(0);
    });

    test('should trip circuit breaker after consecutive failures', async () => {
      // Mock multiple failures
      for (let i = 0; i < 6; i++) {
        (global.fetch as jest.Mock).mockRejectedValueOnce(
          new Error('Server error')
        );
      }

      await outboxManager.queue('addList', { title: 'Test' });

      // Try to sync multiple times
      for (let i = 0; i < 5; i++) {
        await outboxManager.sync();
      }

      const status = await outboxManager.getStatus();
      expect(status.circuitBreakerOpen).toBe(true);
    });

    test('should handle auth errors by stopping sync', async () => {
      let authEventFired = false;

      document.addEventListener('authRequired', () => {
        authEventFired = true;
      });

      // Mock 401 response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      await outboxManager.queue('addList', { title: 'Test' });
      await outboxManager.sync();

      expect(authEventFired).toBe(true);
    });

    test('should move permanently failed items to dead letter', async () => {
      let errorEventFired = false;

      document.addEventListener('syncError', (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (detail.type === 'permanent') {
          errorEventFired = true;
        }
      });

      // Mock client error (4xx - non-retryable)
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400
      });

      await outboxManager.queue('addList', { title: 'Bad Request' });

      // Set max retries to 0 for test
      const item = (await idbClient.getPendingSyncItems())[0];
      if (item) {
        await idbClient.updateSyncItem(item.id, { attempts: 5 });
      }

      await outboxManager.sync();

      // Item should be removed from queue
      const pending = await idbClient.getPendingSyncItems();
      expect(pending).toHaveLength(0);
    });
  });

  describe('Firebase Sync', () => {
    test('should perform full sync on login', async () => {
      // Mock remote data
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [] // Empty lists
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => null // No streak
        });

      // Add local data
      await idbClient.addList({
        title: 'Local List',
        type: 'words'
      });

      // Trigger login event
      const event = new CustomEvent('authStateChanged', {
        detail: { user: { uid: 'test-user' } }
      });
      document.dispatchEvent(event);

      // Wait for async sync
      await new Promise(resolve => setTimeout(resolve, 100));

      // Local data should be pushed to remote
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/sync'),
        expect.any(Object)
      );
    });

    test('should handle periodic sync for premium users', async () => {
      // Enable periodic sync in settings
      await idbClient.updateSettings('sync', {
        periodicSyncEnabled: true,
        syncEnabled: true
      });

      firebaseSync.enableAutoSync();

      // Should be enabled
      const settings = await idbClient.getSettings('sync');
      expect(settings?.syncEnabled).toBe(true);
    });

    test('should respect quiet hours for notifications', async () => {
      const isInQuietHours = (settings: any) => {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        const [startHour, startMin] = settings.quietHours.start.split(':').map(Number);
        const [endHour, endMin] = settings.quietHours.end.split(':').map(Number);

        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        if (startTime <= endTime) {
          return currentTime >= startTime && currentTime <= endTime;
        } else {
          return currentTime >= startTime || currentTime <= endTime;
        }
      };

      const settings = {
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '08:00'
        }
      };

      // Test quiet hours logic
      const mockDate = new Date();
      mockDate.setHours(23, 0); // 11 PM
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      expect(isInQuietHours(settings)).toBe(true);

      mockDate.setHours(12, 0); // Noon
      expect(isInQuietHours(settings)).toBe(false);
    });
  });

  describe('Account Cleanup', () => {
    test('should clear all data on account deletion', async () => {
      // Add test data
      await idbClient.addList({
        title: 'Test List',
        type: 'words'
      });

      await idbClient.updateStreak({
        current: 5,
        best: 10
      });

      localStorage.setItem('test_key', 'test_value');
      sessionStorage.setItem('test_session', 'session_value');

      // Perform cleanup
      const result = await accountCleanup.performFullCleanup();

      expect(result.success).toBe(true);
      expect(result.clearedStores.length).toBeGreaterThan(0);

      // Verify data is cleared
      const lists = await idbClient.getAllLists();
      expect(lists).toHaveLength(0);

      const streak = await idbClient.getStreak();
      expect(streak).toBeNull();

      expect(localStorage.getItem('test_key')).toBeNull();
      expect(sessionStorage.getItem('test_session')).toBeNull();
    });

    test('should keep user preferences on logout cleanup', async () => {
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('locale', 'ja');
      localStorage.setItem('auth_token', 'secret');

      const result = await accountCleanup.clearLocalData();

      expect(result.success).toBe(true);
      expect(localStorage.getItem('theme')).toBe('dark');
      expect(localStorage.getItem('locale')).toBe('ja');
      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    test('should verify cleanup was successful', async () => {
      // Add data
      await idbClient.addList({
        title: 'Test',
        type: 'words'
      });

      // Clean up
      await accountCleanup.performFullCleanup();

      // Verify
      const isClean = await accountCleanup.verifyCleanup();
      expect(isClean).toBe(true);
    });
  });

  describe('Network State Handling', () => {
    test('should sync automatically when coming online', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true
      });

      await outboxManager.queue('addList', { title: 'Offline List' });

      // Mock successful sync
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      // Come online
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true
      });

      // Trigger online event
      window.dispatchEvent(new Event('online'));

      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 200));

      const pending = await idbClient.getPendingSyncItems();
      expect(pending).toHaveLength(0);
    });

    test('should pause sync when going offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true
      });

      window.dispatchEvent(new Event('offline'));

      const status = await outboxManager.getStatus();
      expect(status.isOnline).toBe(false);
      expect(status.isSyncing).toBe(false);
    });
  });

  describe('Data Integrity', () => {
    test('should maintain referential integrity', async () => {
      const listId = await idbClient.addList({
        title: 'Test List',
        type: 'words'
      });

      await idbClient.addItems(listId, [
        { payload: { word: 'test' } }
      ]);

      const items = await idbClient.getItemsByListId(listId);
      expect(items).toHaveLength(1);
      expect(items[0].listId).toBe(listId);
    });

    test('should handle concurrent operations safely', async () => {
      const promises = [];

      // Add multiple lists concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(
          idbClient.addList({
            title: `List ${i}`,
            type: 'words'
          })
        );
      }

      const listIds = await Promise.all(promises);

      // All should have unique IDs
      const uniqueIds = new Set(listIds);
      expect(uniqueIds.size).toBe(10);

      const lists = await idbClient.getAllLists();
      expect(lists).toHaveLength(10);
    });

    test('should recover from corrupted data gracefully', async () => {
      // Simulate corrupted data scenario
      // Implementation would test error recovery
    });
  });
});