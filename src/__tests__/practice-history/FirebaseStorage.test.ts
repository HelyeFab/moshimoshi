import { FirebasePracticeHistoryStorage } from '../../services/practiceHistory/FirebaseStorage';
import { PracticeHistoryItem } from '../../services/practiceHistory/types';
import { Timestamp } from 'firebase-admin/firestore';
import { createMockPracticeItem, createMockPracticeItems, waitForAsync } from './test-utils';

// Mock Firebase Admin
jest.mock('../../lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    batch: jest.fn()
  }
}));

// Import mocked module
import { adminDb } from '../../lib/firebase/admin';

describe('FirebasePracticeHistoryStorage', () => {
  let storage: FirebasePracticeHistoryStorage;
  const userId = 'test-user-123';
  const mockDb = adminDb as jest.Mocked<typeof adminDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new FirebasePracticeHistoryStorage(userId);

    // Setup default mock behaviors
    mockDb.collection.mockReturnThis();
    mockDb.doc.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.orderBy.mockReturnThis();
    mockDb.limit.mockReturnThis();
  });

  describe('init', () => {
    it('should initialize without requiring any operations', async () => {
      await expect(storage.init()).resolves.not.toThrow();
    });
  });

  describe('addOrUpdateItem', () => {
    it('should create a new item when it does not exist', async () => {
      const item = createMockPracticeItem();

      mockDb.get.mockResolvedValueOnce({
        exists: false,
        data: () => null
      } as any);

      mockDb.set.mockResolvedValueOnce(undefined);

      await storage.addOrUpdateItem(item);

      expect(mockDb.collection).toHaveBeenCalledWith('userPracticeHistory');
      expect(mockDb.doc).toHaveBeenCalledWith(`${userId}_${item.videoId}`);
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          videoId: item.videoId,
          videoUrl: item.videoUrl,
          videoTitle: item.videoTitle,
          practiceCount: 1,
          contentType: 'youtube'
        })
      );
    });

    it('should update an existing item and increment practice count', async () => {
      const item = createMockPracticeItem();
      const existingData = {
        practiceCount: 5,
        totalPracticeTime: 3600,
        firstPracticed: Timestamp.fromDate(new Date('2024-01-01'))
      };

      mockDb.get.mockResolvedValueOnce({
        exists: true,
        data: () => existingData
      } as any);

      mockDb.set.mockResolvedValueOnce(undefined);

      await storage.addOrUpdateItem(item);

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          practiceCount: 6, // Incremented
          totalPracticeTime: expect.any(Number)
        })
      );
    });

    it('should include optional fields when provided', async () => {
      const item = createMockPracticeItem({
        thumbnailUrl: 'https://example.com/thumb.jpg',
        channelName: 'Test Channel',
        duration: 720,
        metadata: { description: 'Test description' }
      });

      mockDb.get.mockResolvedValueOnce({
        exists: false,
        data: () => null
      } as any);

      mockDb.set.mockResolvedValueOnce(undefined);

      await storage.addOrUpdateItem(item);

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          thumbnailUrl: item.thumbnailUrl,
          channelName: item.channelName,
          duration: item.duration,
          metadata: item.metadata
        })
      );
    });

    it('should validate content type', async () => {
      const item = createMockPracticeItem({
        contentType: 'invalid' as any
      });

      mockDb.get.mockResolvedValueOnce({
        exists: false,
        data: () => null
      } as any);

      await expect(storage.addOrUpdateItem(item)).rejects.toThrow('Invalid contentType');
    });

    it('should handle Firebase errors gracefully', async () => {
      const item = createMockPracticeItem();

      mockDb.get.mockRejectedValueOnce(new Error('Firebase error'));

      await expect(storage.addOrUpdateItem(item)).rejects.toThrow('Firebase error');
    });
  });

  describe('getItem', () => {
    it('should retrieve an existing item', async () => {
      const item = createMockPracticeItem();

      mockDb.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          videoId: item.videoId,
          videoUrl: item.videoUrl,
          videoTitle: item.videoTitle,
          lastPracticed: Timestamp.fromDate(item.lastPracticed),
          firstPracticed: Timestamp.fromDate(item.firstPracticed),
          practiceCount: item.practiceCount,
          contentType: item.contentType
        })
      } as any);

      const retrieved = await storage.getItem(item.videoId);

      expect(retrieved).toBeTruthy();
      expect(retrieved?.videoId).toBe(item.videoId);
      expect(retrieved?.videoTitle).toBe(item.videoTitle);
    });

    it('should return null for non-existent item', async () => {
      mockDb.get.mockResolvedValueOnce({
        exists: false,
        data: () => null
      } as any);

      const retrieved = await storage.getItem('non-existent');

      expect(retrieved).toBeNull();
    });

    it('should handle missing date fields gracefully', async () => {
      mockDb.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          videoId: 'test',
          videoUrl: 'https://youtube.com/watch?v=test',
          videoTitle: 'Test',
          practiceCount: 1,
          contentType: 'youtube'
          // Missing date fields
        })
      } as any);

      const retrieved = await storage.getItem('test');

      expect(retrieved).toBeTruthy();
      expect(retrieved?.lastPracticed).toBeInstanceOf(Date);
      expect(retrieved?.firstPracticed).toBeInstanceOf(Date);
    });

    it('should handle Firebase errors and return null', async () => {
      mockDb.get.mockRejectedValueOnce(new Error('Firebase error'));

      const retrieved = await storage.getItem('test');

      expect(retrieved).toBeNull();
    });
  });

  describe('getAllItems', () => {
    it('should retrieve all items for the user', async () => {
      const items = createMockPracticeItems(3);

      const mockSnapshot = {
        forEach: (callback: Function) => {
          items.forEach((item, index) => {
            callback({
              id: `${userId}_${item.videoId}`,
              data: () => ({
                ...item,
                lastPracticed: Timestamp.fromDate(item.lastPracticed),
                firstPracticed: Timestamp.fromDate(item.firstPracticed)
              })
            });
          });
        }
      };

      mockDb.get.mockResolvedValueOnce(mockSnapshot as any);

      const allItems = await storage.getAllItems();

      expect(allItems).toHaveLength(3);
      expect(mockDb.where).toHaveBeenCalledWith('userId', '==', userId);
      expect(mockDb.orderBy).toHaveBeenCalledWith('lastPracticed', 'desc');
    });

    it('should return empty array when no items exist', async () => {
      const mockSnapshot = {
        forEach: (callback: Function) => {}
      };

      mockDb.get.mockResolvedValueOnce(mockSnapshot as any);

      const allItems = await storage.getAllItems();

      expect(allItems).toEqual([]);
    });

    it('should handle Firebase errors and return empty array', async () => {
      mockDb.get.mockRejectedValueOnce(new Error('Firebase error'));

      const allItems = await storage.getAllItems();

      expect(allItems).toEqual([]);
    });
  });

  describe('deleteItem', () => {
    it('should delete an existing item owned by the user', async () => {
      mockDb.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ userId })
      } as any);

      mockDb.delete.mockResolvedValueOnce(undefined);

      await storage.deleteItem('test-video');

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should throw error when trying to delete item owned by another user', async () => {
      mockDb.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ userId: 'other-user' })
      } as any);

      await expect(storage.deleteItem('test-video')).rejects.toThrow('ownership mismatch');
    });

    it('should handle deletion of non-existent item', async () => {
      mockDb.get.mockResolvedValueOnce({
        exists: false,
        data: () => null
      } as any);

      await expect(storage.deleteItem('non-existent')).resolves.not.toThrow();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('should propagate Firebase errors', async () => {
      mockDb.get.mockRejectedValueOnce(new Error('Firebase error'));

      await expect(storage.deleteItem('test')).rejects.toThrow('Firebase error');
    });
  });

  describe('clearAll', () => {
    it('should delete all items for the user', async () => {
      const items = createMockPracticeItems(3);

      const mockSnapshot = {
        forEach: (callback: Function) => {
          items.forEach((item) => {
            callback({
              ref: { delete: jest.fn() }
            });
          });
        }
      };

      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValueOnce(undefined)
      };

      mockDb.get.mockResolvedValueOnce(mockSnapshot as any);
      mockDb.batch.mockReturnValueOnce(mockBatch as any);

      await storage.clearAll();

      expect(mockDb.where).toHaveBeenCalledWith('userId', '==', userId);
      expect(mockBatch.delete).toHaveBeenCalledTimes(3);
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should handle empty collection', async () => {
      const mockSnapshot = {
        forEach: (callback: Function) => {}
      };

      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValueOnce(undefined)
      };

      mockDb.get.mockResolvedValueOnce(mockSnapshot as any);
      mockDb.batch.mockReturnValueOnce(mockBatch as any);

      await storage.clearAll();

      expect(mockBatch.delete).not.toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should handle Firebase errors', async () => {
      mockDb.get.mockRejectedValueOnce(new Error('Firebase error'));

      await expect(storage.clearAll()).rejects.toThrow('Firebase error');
    });
  });

  describe('getItemsByDateRange', () => {
    it('should retrieve items within date range', async () => {
      const startDate = new Date('2024-01-10');
      const endDate = new Date('2024-01-20');
      const items = createMockPracticeItems(2);

      const mockSnapshot = {
        forEach: (callback: Function) => {
          items.forEach((item) => {
            callback({
              id: `${userId}_${item.videoId}`,
              data: () => ({
                ...item,
                lastPracticed: Timestamp.fromDate(item.lastPracticed),
                firstPracticed: Timestamp.fromDate(item.firstPracticed)
              })
            });
          });
        }
      };

      mockDb.get.mockResolvedValueOnce(mockSnapshot as any);

      const rangeItems = await storage.getItemsByDateRange(startDate, endDate);

      expect(rangeItems).toHaveLength(2);
      expect(mockDb.where).toHaveBeenCalledWith('userId', '==', userId);
      expect(mockDb.where).toHaveBeenCalledWith(
        'lastPracticed',
        '>=',
        Timestamp.fromDate(startDate)
      );
      expect(mockDb.where).toHaveBeenCalledWith(
        'lastPracticed',
        '<=',
        Timestamp.fromDate(endDate)
      );
    });

    it('should return empty array for errors', async () => {
      mockDb.get.mockRejectedValueOnce(new Error('Firebase error'));

      const items = await storage.getItemsByDateRange(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(items).toEqual([]);
    });
  });

  describe('getMostPracticed', () => {
    it('should retrieve items sorted by practice count', async () => {
      const items = [
        createMockPracticeItem({ videoId: 'high', practiceCount: 10 }),
        createMockPracticeItem({ videoId: 'medium', practiceCount: 5 }),
        createMockPracticeItem({ videoId: 'low', practiceCount: 2 })
      ];

      const mockSnapshot = {
        forEach: (callback: Function) => {
          items.forEach((item) => {
            callback({
              id: `${userId}_${item.videoId}`,
              data: () => ({
                ...item,
                lastPracticed: Timestamp.fromDate(item.lastPracticed),
                firstPracticed: Timestamp.fromDate(item.firstPracticed)
              })
            });
          });
        }
      };

      mockDb.get.mockResolvedValueOnce(mockSnapshot as any);

      const mostPracticed = await storage.getMostPracticed(2);

      expect(mostPracticed).toHaveLength(3); // Returns all from mock
      expect(mockDb.orderBy).toHaveBeenCalledWith('practiceCount', 'desc');
      expect(mockDb.limit).toHaveBeenCalledWith(2);
    });

    it('should use default limit of 10', async () => {
      const mockSnapshot = {
        forEach: (callback: Function) => {}
      };

      mockDb.get.mockResolvedValueOnce(mockSnapshot as any);

      await storage.getMostPracticed();

      expect(mockDb.limit).toHaveBeenCalledWith(10);
    });
  });

  describe('syncFromLocal', () => {
    it('should sync multiple items from local storage', async () => {
      const localItems = createMockPracticeItems(3);

      const mockBatch = {
        set: jest.fn(),
        commit: jest.fn().mockResolvedValueOnce(undefined)
      };

      mockDb.batch.mockReturnValueOnce(mockBatch as any);

      await storage.syncFromLocal(localItems);

      expect(mockDb.batch).toHaveBeenCalled();
      expect(mockBatch.set).toHaveBeenCalledTimes(3);

      // Check that merge option is used
      localItems.forEach((item) => {
        expect(mockBatch.set).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            userId,
            videoId: item.videoId
          }),
          { merge: true }
        );
      });

      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should handle empty array', async () => {
      const mockBatch = {
        set: jest.fn(),
        commit: jest.fn().mockResolvedValueOnce(undefined)
      };

      mockDb.batch.mockReturnValueOnce(mockBatch as any);

      await storage.syncFromLocal([]);

      expect(mockBatch.set).not.toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should handle sync errors', async () => {
      const localItems = createMockPracticeItems(1);

      mockDb.batch.mockImplementationOnce(() => {
        throw new Error('Batch error');
      });

      await expect(storage.syncFromLocal(localItems)).rejects.toThrow('Batch error');
    });

    it('should include syncedAt timestamp', async () => {
      const localItems = createMockPracticeItems(1);

      const mockBatch = {
        set: jest.fn(),
        commit: jest.fn().mockResolvedValueOnce(undefined)
      };

      mockDb.batch.mockReturnValueOnce(mockBatch as any);

      await storage.syncFromLocal(localItems);

      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          syncedAt: expect.any(Timestamp)
        }),
        { merge: true }
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle very long video titles', async () => {
      const longTitle = 'A'.repeat(1000);
      const item = createMockPracticeItem({
        videoTitle: longTitle
      });

      mockDb.get.mockResolvedValueOnce({
        exists: false,
        data: () => null
      } as any);

      mockDb.set.mockResolvedValueOnce(undefined);

      await storage.addOrUpdateItem(item);

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          videoTitle: longTitle
        })
      );
    });

    it('should handle special characters in user IDs and video IDs', async () => {
      const specialUserId = 'user@test.com';
      const specialVideoId = 'video/with/slashes';
      const specialStorage = new FirebasePracticeHistoryStorage(specialUserId);

      const item = createMockPracticeItem({
        videoId: specialVideoId
      });

      mockDb.get.mockResolvedValueOnce({
        exists: false,
        data: () => null
      } as any);

      mockDb.set.mockResolvedValueOnce(undefined);

      await specialStorage.addOrUpdateItem(item);

      expect(mockDb.doc).toHaveBeenCalledWith(`${specialUserId}_${specialVideoId}`);
    });

    it('should handle concurrent operations', async () => {
      const items = createMockPracticeItems(5);

      mockDb.get.mockResolvedValue({
        exists: false,
        data: () => null
      } as any);

      mockDb.set.mockResolvedValue(undefined);

      // Perform concurrent adds
      const promises = items.map(item => storage.addOrUpdateItem(item));
      await Promise.all(promises);

      expect(mockDb.set).toHaveBeenCalledTimes(5);
    });
  });
});