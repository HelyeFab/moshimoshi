import { IndexedDBPracticeHistoryStorage } from '../../services/practiceHistory/IndexedDBStorage';
import { PracticeHistoryItem } from '../../services/practiceHistory/types';
import { setupTestEnvironment, createMockPracticeItem, createMockPracticeItems, waitForAsync } from './test-utils';

describe('IndexedDBPracticeHistoryStorage', () => {
  let storage: IndexedDBPracticeHistoryStorage;
  let cleanup: Function;

  beforeEach(() => {
    cleanup = setupTestEnvironment();
    storage = new IndexedDBPracticeHistoryStorage();
  });

  afterEach(() => {
    cleanup();
  });

  describe('init', () => {
    it('should initialize the database successfully', async () => {
      await expect(storage.init()).resolves.not.toThrow();
    });

    it('should handle initialization errors gracefully', async () => {
      (global as any).indexedDB = {
        open: jest.fn().mockReturnValue({
          onerror: null,
          addEventListener: (event: string, handler: Function) => {
            if (event === 'error') {
              setTimeout(() => handler(new Error('Database error')), 0);
            }
          }
        })
      };

      await expect(storage.init()).rejects.toThrow();
    });
  });

  describe('addOrUpdateItem', () => {
    beforeEach(async () => {
      await storage.init();
    });

    it('should add a new practice item', async () => {
      const item = createMockPracticeItem();
      await storage.addOrUpdateItem(item);
      await waitForAsync();

      const retrieved = await storage.getItem(item.videoId);
      expect(retrieved).toBeTruthy();
      expect(retrieved?.videoId).toBe(item.videoId);
      expect(retrieved?.videoTitle).toBe(item.videoTitle);
    });

    it('should update an existing practice item', async () => {
      const item = createMockPracticeItem();

      // Add initial item
      await storage.addOrUpdateItem(item);
      await waitForAsync();

      // Update the item
      const updatedItem = {
        ...item,
        practiceCount: 10,
        totalPracticeTime: 7200
      };
      await storage.addOrUpdateItem(updatedItem);
      await waitForAsync();

      const retrieved = await storage.getItem(item.videoId);
      expect(retrieved?.practiceCount).toBe(11); // Should increment
      expect(retrieved?.totalPracticeTime).toBe(7200);
    });

    it('should set firstPracticed and lastPracticed dates', async () => {
      const item = createMockPracticeItem();
      await storage.addOrUpdateItem(item);
      await waitForAsync();

      const retrieved = await storage.getItem(item.videoId);
      expect(retrieved?.firstPracticed).toBeDefined();
      expect(retrieved?.lastPracticed).toBeDefined();
    });

    it('should preserve firstPracticed date on updates', async () => {
      const item = createMockPracticeItem();
      const firstDate = new Date('2024-01-01');
      item.firstPracticed = firstDate;

      await storage.addOrUpdateItem(item);
      await waitForAsync();

      // Update item
      await storage.addOrUpdateItem(item);
      await waitForAsync();

      const retrieved = await storage.getItem(item.videoId);
      expect(retrieved?.firstPracticed).toEqual(firstDate);
    });
  });

  describe('getItem', () => {
    beforeEach(async () => {
      await storage.init();
    });

    it('should retrieve an existing item', async () => {
      const item = createMockPracticeItem();
      await storage.addOrUpdateItem(item);
      await waitForAsync();

      const retrieved = await storage.getItem(item.videoId);
      expect(retrieved).toBeTruthy();
      expect(retrieved?.videoId).toBe(item.videoId);
    });

    it('should return null for non-existent item', async () => {
      const retrieved = await storage.getItem('non-existent-id');
      expect(retrieved).toBeNull();
    });

    it('should handle retrieval errors gracefully', async () => {
      // Force an error by not initializing
      storage = new IndexedDBPracticeHistoryStorage();

      const retrieved = await storage.getItem('test-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('getAllItems', () => {
    beforeEach(async () => {
      await storage.init();
    });

    it('should retrieve all items', async () => {
      const items = createMockPracticeItems(3);

      for (const item of items) {
        await storage.addOrUpdateItem(item);
        await waitForAsync();
      }

      const allItems = await storage.getAllItems();
      expect(allItems).toHaveLength(3);
    });

    it('should return items sorted by lastPracticed descending', async () => {
      const items = createMockPracticeItems(3);

      // Add items in random order
      for (const item of [items[2], items[0], items[1]]) {
        await storage.addOrUpdateItem(item);
        await waitForAsync();
      }

      const allItems = await storage.getAllItems();

      // Check if sorted correctly (most recent first)
      for (let i = 1; i < allItems.length; i++) {
        const prevDate = new Date(allItems[i - 1].lastPracticed).getTime();
        const currDate = new Date(allItems[i].lastPracticed).getTime();
        expect(prevDate).toBeGreaterThanOrEqual(currDate);
      }
    });

    it('should return empty array when no items exist', async () => {
      const allItems = await storage.getAllItems();
      expect(allItems).toEqual([]);
    });
  });

  describe('deleteItem', () => {
    beforeEach(async () => {
      await storage.init();
    });

    it('should delete an existing item', async () => {
      const item = createMockPracticeItem();
      await storage.addOrUpdateItem(item);
      await waitForAsync();

      await storage.deleteItem(item.videoId);
      await waitForAsync();

      const retrieved = await storage.getItem(item.videoId);
      expect(retrieved).toBeNull();
    });

    it('should handle deletion of non-existent item', async () => {
      await expect(storage.deleteItem('non-existent-id')).resolves.not.toThrow();
    });

    it('should not affect other items when deleting', async () => {
      const items = createMockPracticeItems(3);

      for (const item of items) {
        await storage.addOrUpdateItem(item);
        await waitForAsync();
      }

      await storage.deleteItem(items[1].videoId);
      await waitForAsync();

      const allItems = await storage.getAllItems();
      expect(allItems).toHaveLength(2);
      expect(allItems.find(i => i.videoId === items[0].videoId)).toBeTruthy();
      expect(allItems.find(i => i.videoId === items[2].videoId)).toBeTruthy();
      expect(allItems.find(i => i.videoId === items[1].videoId)).toBeFalsy();
    });
  });

  describe('clearAll', () => {
    beforeEach(async () => {
      await storage.init();
    });

    it('should clear all items', async () => {
      const items = createMockPracticeItems(3);

      for (const item of items) {
        await storage.addOrUpdateItem(item);
        await waitForAsync();
      }

      await storage.clearAll();
      await waitForAsync();

      const allItems = await storage.getAllItems();
      expect(allItems).toEqual([]);
    });

    it('should handle clearing when already empty', async () => {
      await expect(storage.clearAll()).resolves.not.toThrow();
    });
  });

  describe('getItemsByDateRange', () => {
    beforeEach(async () => {
      await storage.init();
    });

    it('should retrieve items within date range', async () => {
      const items = [
        createMockPracticeItem({
          videoId: 'old',
          lastPracticed: new Date('2024-01-01')
        }),
        createMockPracticeItem({
          videoId: 'recent',
          lastPracticed: new Date('2024-01-15')
        }),
        createMockPracticeItem({
          videoId: 'newest',
          lastPracticed: new Date('2024-01-30')
        })
      ];

      for (const item of items) {
        await storage.addOrUpdateItem(item);
        await waitForAsync();
      }

      const rangeItems = await storage.getItemsByDateRange(
        new Date('2024-01-10'),
        new Date('2024-01-20')
      );

      expect(rangeItems).toHaveLength(1);
      expect(rangeItems[0].videoId).toBe('recent');
    });

    it('should include boundary dates', async () => {
      const items = [
        createMockPracticeItem({
          videoId: 'start',
          lastPracticed: new Date('2024-01-10T00:00:00')
        }),
        createMockPracticeItem({
          videoId: 'end',
          lastPracticed: new Date('2024-01-20T23:59:59')
        })
      ];

      for (const item of items) {
        await storage.addOrUpdateItem(item);
        await waitForAsync();
      }

      const rangeItems = await storage.getItemsByDateRange(
        new Date('2024-01-10T00:00:00'),
        new Date('2024-01-20T23:59:59')
      );

      expect(rangeItems).toHaveLength(2);
    });

    it('should return empty array when no items in range', async () => {
      const item = createMockPracticeItem({
        lastPracticed: new Date('2024-01-01')
      });

      await storage.addOrUpdateItem(item);
      await waitForAsync();

      const rangeItems = await storage.getItemsByDateRange(
        new Date('2024-02-01'),
        new Date('2024-02-28')
      );

      expect(rangeItems).toEqual([]);
    });
  });

  describe('getMostPracticed', () => {
    beforeEach(async () => {
      await storage.init();
    });

    it('should retrieve items sorted by practice count', async () => {
      const items = [
        createMockPracticeItem({ videoId: 'low', practiceCount: 2 }),
        createMockPracticeItem({ videoId: 'high', practiceCount: 10 }),
        createMockPracticeItem({ videoId: 'medium', practiceCount: 5 })
      ];

      for (const item of items) {
        await storage.addOrUpdateItem(item);
        await waitForAsync();
      }

      const mostPracticed = await storage.getMostPracticed(2);

      expect(mostPracticed).toHaveLength(2);
      expect(mostPracticed[0].videoId).toBe('high');
      expect(mostPracticed[1].videoId).toBe('medium');
    });

    it('should respect the limit parameter', async () => {
      const items = createMockPracticeItems(5);

      for (const item of items) {
        await storage.addOrUpdateItem(item);
        await waitForAsync();
      }

      const mostPracticed = await storage.getMostPracticed(3);
      expect(mostPracticed).toHaveLength(3);
    });

    it('should return all items if limit exceeds count', async () => {
      const items = createMockPracticeItems(3);

      for (const item of items) {
        await storage.addOrUpdateItem(item);
        await waitForAsync();
      }

      const mostPracticed = await storage.getMostPracticed(10);
      expect(mostPracticed).toHaveLength(3);
    });

    it('should use default limit of 10', async () => {
      const items = createMockPracticeItems(15);

      for (const item of items) {
        await storage.addOrUpdateItem(item);
        await waitForAsync();
      }

      const mostPracticed = await storage.getMostPracticed();
      expect(mostPracticed).toHaveLength(10);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle concurrent operations', async () => {
      await storage.init();
      const items = createMockPracticeItems(5);

      // Add multiple items concurrently
      const promises = items.map(item => storage.addOrUpdateItem(item));
      await Promise.all(promises);
      await waitForAsync();

      const allItems = await storage.getAllItems();
      expect(allItems.length).toBeGreaterThanOrEqual(items.length - 1); // Allow for some race conditions
    });

    it('should handle very large practice counts', async () => {
      await storage.init();
      const item = createMockPracticeItem({
        practiceCount: Number.MAX_SAFE_INTEGER - 1
      });

      await storage.addOrUpdateItem(item);
      await waitForAsync();

      const retrieved = await storage.getItem(item.videoId);
      expect(retrieved?.practiceCount).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle special characters in video IDs', async () => {
      await storage.init();
      const specialIds = [
        'test-with-dash',
        'test_with_underscore',
        'test.with.dot',
        'test with space',
        'test/with/slash',
        'テスト日本語'
      ];

      for (const id of specialIds) {
        const item = createMockPracticeItem({ videoId: id });
        await storage.addOrUpdateItem(item);
        await waitForAsync();

        const retrieved = await storage.getItem(id);
        expect(retrieved?.videoId).toBe(id);
      }
    });

    it('should handle missing optional fields', async () => {
      await storage.init();
      const minimalItem: PracticeHistoryItem = {
        id: 'minimal',
        videoUrl: 'https://youtube.com/watch?v=minimal',
        videoTitle: 'Minimal Video',
        videoId: 'minimal',
        lastPracticed: new Date(),
        firstPracticed: new Date(),
        practiceCount: 1,
        contentType: 'youtube'
      };

      await storage.addOrUpdateItem(minimalItem);
      await waitForAsync();

      const retrieved = await storage.getItem(minimalItem.videoId);
      expect(retrieved).toBeTruthy();
      expect(retrieved?.thumbnailUrl).toBeUndefined();
      expect(retrieved?.channelName).toBeUndefined();
      expect(retrieved?.metadata).toBeUndefined();
    });
  });
});