import { PracticeHistoryService } from '../../services/practiceHistory/PracticeHistoryService';
import { IndexedDBPracticeHistoryStorage } from '../../services/practiceHistory/IndexedDBStorage';
import { FirebasePracticeHistoryStorage } from '../../services/practiceHistory/FirebaseStorage';
import { createMockPracticeItem, createMockPracticeItems, setupTestEnvironment, waitForAsync } from './test-utils';

// Mock the storage implementations
jest.mock('../../services/practiceHistory/IndexedDBStorage');
jest.mock('../../services/practiceHistory/FirebaseStorage');

describe('PracticeHistoryService', () => {
  let service: PracticeHistoryService;
  let mockIndexedDB: jest.Mocked<IndexedDBPracticeHistoryStorage>;
  let mockFirebase: jest.Mocked<FirebasePracticeHistoryStorage>;
  let cleanup: Function;

  beforeEach(() => {
    cleanup = setupTestEnvironment();

    // Reset the service
    service = new PracticeHistoryService();

    // Get mocked instances
    mockIndexedDB = (IndexedDBPracticeHistoryStorage as jest.MockedClass<typeof IndexedDBPracticeHistoryStorage>).mock.instances[0] as any;

    // Setup mock implementations
    mockIndexedDB.init = jest.fn().mockResolvedValue(undefined);
    mockIndexedDB.addOrUpdateItem = jest.fn().mockResolvedValue(undefined);
    mockIndexedDB.getItem = jest.fn().mockResolvedValue(null);
    mockIndexedDB.getAllItems = jest.fn().mockResolvedValue([]);
    mockIndexedDB.deleteItem = jest.fn().mockResolvedValue(undefined);
    mockIndexedDB.clearAll = jest.fn().mockResolvedValue(undefined);
    mockIndexedDB.getMostPracticed = jest.fn().mockResolvedValue([]);
    mockIndexedDB.getItemsByDateRange = jest.fn().mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize for guest user (no userId)', async () => {
      await service.initialize();

      expect(mockIndexedDB.init).toHaveBeenCalled();
      expect(service.getStatus()).toEqual({
        initialized: true,
        userType: 'guest',
        hasFirebase: false,
        firebaseUserId: null
      });
    });

    it('should initialize for free user', async () => {
      await service.initialize('user-123', false);

      expect(mockIndexedDB.init).toHaveBeenCalled();
      expect(service.getStatus()).toEqual({
        initialized: true,
        userType: 'free',
        hasFirebase: true,
        firebaseUserId: 'user-123'
      });
    });

    it('should initialize for premium user', async () => {
      // Setup Firebase mock
      mockFirebase = (FirebasePracticeHistoryStorage as jest.MockedClass<typeof FirebasePracticeHistoryStorage>).mock.instances[0] as any;
      mockFirebase.syncFromLocal = jest.fn().mockResolvedValue(undefined);
      mockIndexedDB.getAllItems.mockResolvedValueOnce(createMockPracticeItems(3));

      await service.initialize('user-123', true);

      expect(mockIndexedDB.init).toHaveBeenCalled();
      expect(mockFirebase.syncFromLocal).toHaveBeenCalled();
      expect(service.getStatus()).toEqual({
        initialized: true,
        userType: 'premium',
        hasFirebase: true,
        firebaseUserId: 'user-123'
      });
    });

    it('should not reinitialize if already initialized with same user', async () => {
      await service.initialize('user-123', false);
      mockIndexedDB.init.mockClear();

      await service.initialize('user-123', false);

      expect(mockIndexedDB.init).not.toHaveBeenCalled();
    });

    it('should reinitialize when switching from guest to user', async () => {
      await service.initialize();
      mockIndexedDB.init.mockClear();

      await service.initialize('user-123', false);

      expect(mockIndexedDB.init).toHaveBeenCalled();
    });

    it('should sync local data to Firebase for premium users', async () => {
      mockFirebase = (FirebasePracticeHistoryStorage as jest.MockedClass<typeof FirebasePracticeHistoryStorage>).mock.instances[0] as any;
      mockFirebase.syncFromLocal = jest.fn().mockResolvedValue(undefined);

      const localItems = createMockPracticeItems(3);
      mockIndexedDB.getAllItems.mockResolvedValueOnce(localItems);

      await service.initialize('user-123', true);

      expect(mockFirebase.syncFromLocal).toHaveBeenCalledWith(localItems);
    });

    it('should handle sync errors gracefully', async () => {
      mockFirebase = (FirebasePracticeHistoryStorage as jest.MockedClass<typeof FirebasePracticeHistoryStorage>).mock.instances[0] as any;
      mockFirebase.syncFromLocal = jest.fn().mockRejectedValue(new Error('Sync failed'));

      mockIndexedDB.getAllItems.mockResolvedValueOnce(createMockPracticeItems(3));

      await service.initialize('user-123', true);

      // Should not throw, just log error
      expect(service.getStatus().initialized).toBe(true);
    });
  });

  describe('addOrUpdateItem', () => {
    it('should throw error if not initialized', async () => {
      await expect(service.addOrUpdateItem(createMockPracticeItem()))
        .rejects.toThrow('PracticeHistoryService not initialized');
    });

    it('should save to IndexedDB for guest users', async () => {
      await service.initialize();

      const item = createMockPracticeItem();
      await service.addOrUpdateItem(item);

      expect(mockIndexedDB.addOrUpdateItem).toHaveBeenCalledWith(item);
    });

    it('should save to both IndexedDB and Firebase for authenticated users', async () => {
      mockFirebase = (FirebasePracticeHistoryStorage as jest.MockedClass<typeof FirebasePracticeHistoryStorage>).mock.instances[0] as any;
      mockFirebase.addOrUpdateItem = jest.fn().mockResolvedValue(undefined);
      mockFirebase.syncFromLocal = jest.fn().mockResolvedValue(undefined);

      await service.initialize('user-123', false);

      const item = createMockPracticeItem();
      await service.addOrUpdateItem(item);

      expect(mockIndexedDB.addOrUpdateItem).toHaveBeenCalledWith(item);
      expect(mockFirebase.addOrUpdateItem).toHaveBeenCalledWith(item);
    });

    it('should handle Firebase save errors gracefully', async () => {
      mockFirebase = (FirebasePracticeHistoryStorage as jest.MockedClass<typeof FirebasePracticeHistoryStorage>).mock.instances[0] as any;
      mockFirebase.addOrUpdateItem = jest.fn().mockRejectedValue(new Error('Firebase error'));
      mockFirebase.syncFromLocal = jest.fn().mockResolvedValue(undefined);

      await service.initialize('user-123', false);

      const item = createMockPracticeItem();
      await service.addOrUpdateItem(item);

      expect(mockIndexedDB.addOrUpdateItem).toHaveBeenCalledWith(item);
      // Should not throw even if Firebase fails
    });
  });

  describe('getItem', () => {
    it('should throw error if not initialized', async () => {
      await expect(service.getItem('test'))
        .rejects.toThrow('PracticeHistoryService not initialized');
    });

    it('should get from IndexedDB for guest/free users', async () => {
      const item = createMockPracticeItem();
      mockIndexedDB.getItem.mockResolvedValueOnce(item);

      await service.initialize();

      const result = await service.getItem('test');

      expect(mockIndexedDB.getItem).toHaveBeenCalledWith('test');
      expect(result).toEqual(item);
    });

    it('should try Firebase first for premium users', async () => {
      mockFirebase = (FirebasePracticeHistoryStorage as jest.MockedClass<typeof FirebasePracticeHistoryStorage>).mock.instances[0] as any;
      mockFirebase.getItem = jest.fn().mockResolvedValue(createMockPracticeItem());
      mockFirebase.syncFromLocal = jest.fn().mockResolvedValue(undefined);

      await service.initialize('user-123', true);

      const result = await service.getItem('test');

      expect(mockFirebase.getItem).toHaveBeenCalledWith('test');
      expect(mockIndexedDB.getItem).not.toHaveBeenCalled();
    });

    it('should fallback to IndexedDB if Firebase fails for premium', async () => {
      mockFirebase = (FirebasePracticeHistoryStorage as jest.MockedClass<typeof FirebasePracticeHistoryStorage>).mock.instances[0] as any;
      mockFirebase.getItem = jest.fn().mockRejectedValue(new Error('Firebase error'));
      mockFirebase.syncFromLocal = jest.fn().mockResolvedValue(undefined);

      const item = createMockPracticeItem();
      mockIndexedDB.getItem.mockResolvedValueOnce(item);

      await service.initialize('user-123', true);

      const result = await service.getItem('test');

      expect(mockFirebase.getItem).toHaveBeenCalled();
      expect(mockIndexedDB.getItem).toHaveBeenCalled();
      expect(result).toEqual(item);
    });

    it('should fallback to IndexedDB if Firebase returns null', async () => {
      mockFirebase = (FirebasePracticeHistoryStorage as jest.MockedClass<typeof FirebasePracticeHistoryStorage>).mock.instances[0] as any;
      mockFirebase.getItem = jest.fn().mockResolvedValue(null);
      mockFirebase.syncFromLocal = jest.fn().mockResolvedValue(undefined);

      const item = createMockPracticeItem();
      mockIndexedDB.getItem.mockResolvedValueOnce(item);

      await service.initialize('user-123', true);

      const result = await service.getItem('test');

      expect(mockIndexedDB.getItem).toHaveBeenCalled();
      expect(result).toEqual(item);
    });
  });

  describe('getAllItems', () => {
    it('should throw error if not initialized', async () => {
      await expect(service.getAllItems())
        .rejects.toThrow('PracticeHistoryService not initialized');
    });

    it('should get from IndexedDB for guest/free users', async () => {
      const items = createMockPracticeItems(3);
      mockIndexedDB.getAllItems.mockResolvedValueOnce(items);

      await service.initialize();

      const result = await service.getAllItems();

      expect(mockIndexedDB.getAllItems).toHaveBeenCalled();
      expect(result).toEqual(items);
    });

    it('should get from Firebase for premium users', async () => {
      mockFirebase = (FirebasePracticeHistoryStorage as jest.MockedClass<typeof FirebasePracticeHistoryStorage>).mock.instances[0] as any;
      mockFirebase.getAllItems = jest.fn().mockResolvedValue(createMockPracticeItems(3));
      mockFirebase.syncFromLocal = jest.fn().mockResolvedValue(undefined);

      await service.initialize('user-123', true);

      const result = await service.getAllItems();

      expect(mockFirebase.getAllItems).toHaveBeenCalled();
      expect(mockIndexedDB.getAllItems).toHaveBeenCalledTimes(1); // Only during init
    });

    it('should fallback to IndexedDB if Firebase fails', async () => {
      mockFirebase = (FirebasePracticeHistoryStorage as jest.MockedClass<typeof FirebasePracticeHistoryStorage>).mock.instances[0] as any;
      mockFirebase.getAllItems = jest.fn().mockRejectedValue(new Error('Firebase error'));
      mockFirebase.syncFromLocal = jest.fn().mockResolvedValue(undefined);

      const items = createMockPracticeItems(3);
      mockIndexedDB.getAllItems.mockResolvedValue(items);

      await service.initialize('user-123', true);

      const result = await service.getAllItems();

      expect(mockFirebase.getAllItems).toHaveBeenCalled();
      expect(mockIndexedDB.getAllItems).toHaveBeenCalledTimes(2); // Init + fallback
      expect(result).toEqual(items);
    });
  });

  describe('deleteItem', () => {
    it('should throw error if not initialized', async () => {
      await expect(service.deleteItem('test'))
        .rejects.toThrow('PracticeHistoryService not initialized');
    });

    it('should delete from IndexedDB for guest users', async () => {
      await service.initialize();

      await service.deleteItem('test');

      expect(mockIndexedDB.deleteItem).toHaveBeenCalledWith('test');
    });

    it('should delete from both storages for premium users', async () => {
      mockFirebase = (FirebasePracticeHistoryStorage as jest.MockedClass<typeof FirebasePracticeHistoryStorage>).mock.instances[0] as any;
      mockFirebase.deleteItem = jest.fn().mockResolvedValue(undefined);
      mockFirebase.syncFromLocal = jest.fn().mockResolvedValue(undefined);

      await service.initialize('user-123', true);

      await service.deleteItem('test');

      expect(mockIndexedDB.deleteItem).toHaveBeenCalledWith('test');
      expect(mockFirebase.deleteItem).toHaveBeenCalledWith('test');
    });

    it('should continue if Firebase delete fails', async () => {
      mockFirebase = (FirebasePracticeHistoryStorage as jest.MockedClass<typeof FirebasePracticeHistoryStorage>).mock.instances[0] as any;
      mockFirebase.deleteItem = jest.fn().mockRejectedValue(new Error('Firebase error'));
      mockFirebase.syncFromLocal = jest.fn().mockResolvedValue(undefined);

      await service.initialize('user-123', true);

      await service.deleteItem('test');

      expect(mockIndexedDB.deleteItem).toHaveBeenCalledWith('test');
      // Should not throw
    });
  });

  describe('clearAll', () => {
    it('should clear IndexedDB for guest users', async () => {
      await service.initialize();

      await service.clearAll();

      expect(mockIndexedDB.clearAll).toHaveBeenCalled();
    });

    it('should clear both storages for premium users', async () => {
      mockFirebase = (FirebasePracticeHistoryStorage as jest.MockedClass<typeof FirebasePracticeHistoryStorage>).mock.instances[0] as any;
      mockFirebase.clearAll = jest.fn().mockResolvedValue(undefined);
      mockFirebase.syncFromLocal = jest.fn().mockResolvedValue(undefined);

      await service.initialize('user-123', true);

      await service.clearAll();

      expect(mockIndexedDB.clearAll).toHaveBeenCalled();
      expect(mockFirebase.clearAll).toHaveBeenCalled();
    });
  });

  describe('getRecentItems', () => {
    it('should return limited recent items', async () => {
      const items = createMockPracticeItems(10);
      mockIndexedDB.getAllItems.mockResolvedValue(items);

      await service.initialize();

      const recent = await service.getRecentItems(5);

      expect(recent).toHaveLength(5);
      expect(recent).toEqual(items.slice(0, 5));
    });

    it('should use default limit of 10', async () => {
      const items = createMockPracticeItems(15);
      mockIndexedDB.getAllItems.mockResolvedValue(items);

      await service.initialize();

      const recent = await service.getRecentItems();

      expect(recent).toHaveLength(10);
    });
  });

  describe('getMostPracticed', () => {
    it('should use Firebase for premium users', async () => {
      mockFirebase = (FirebasePracticeHistoryStorage as jest.MockedClass<typeof FirebasePracticeHistoryStorage>).mock.instances[0] as any;
      mockFirebase.getMostPracticed = jest.fn().mockResolvedValue(createMockPracticeItems(5));
      mockFirebase.syncFromLocal = jest.fn().mockResolvedValue(undefined);

      await service.initialize('user-123', true);

      const result = await service.getMostPracticed(5);

      expect(mockFirebase.getMostPracticed).toHaveBeenCalledWith(5);
      expect(mockIndexedDB.getMostPracticed).not.toHaveBeenCalled();
    });

    it('should use IndexedDB for free users', async () => {
      const items = createMockPracticeItems(5);
      mockIndexedDB.getMostPracticed.mockResolvedValueOnce(items);

      await service.initialize('user-123', false);

      const result = await service.getMostPracticed(5);

      expect(mockIndexedDB.getMostPracticed).toHaveBeenCalledWith(5);
    });

    it('should fallback to IndexedDB on Firebase error', async () => {
      mockFirebase = (FirebasePracticeHistoryStorage as jest.MockedClass<typeof FirebasePracticeHistoryStorage>).mock.instances[0] as any;
      mockFirebase.getMostPracticed = jest.fn().mockRejectedValue(new Error('Firebase error'));
      mockFirebase.syncFromLocal = jest.fn().mockResolvedValue(undefined);

      const items = createMockPracticeItems(5);
      mockIndexedDB.getMostPracticed.mockResolvedValueOnce(items);

      await service.initialize('user-123', true);

      const result = await service.getMostPracticed(5);

      expect(mockFirebase.getMostPracticed).toHaveBeenCalled();
      expect(mockIndexedDB.getMostPracticed).toHaveBeenCalled();
      expect(result).toEqual(items);
    });
  });

  describe('getItemsByDateRange', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    it('should use Firebase for premium users', async () => {
      mockFirebase = (FirebasePracticeHistoryStorage as jest.MockedClass<typeof FirebasePracticeHistoryStorage>).mock.instances[0] as any;
      mockFirebase.getItemsByDateRange = jest.fn().mockResolvedValue(createMockPracticeItems(3));
      mockFirebase.syncFromLocal = jest.fn().mockResolvedValue(undefined);

      await service.initialize('user-123', true);

      const result = await service.getItemsByDateRange(startDate, endDate);

      expect(mockFirebase.getItemsByDateRange).toHaveBeenCalledWith(startDate, endDate);
      expect(mockIndexedDB.getItemsByDateRange).not.toHaveBeenCalled();
    });

    it('should use IndexedDB for free users', async () => {
      const items = createMockPracticeItems(3);
      mockIndexedDB.getItemsByDateRange.mockResolvedValueOnce(items);

      await service.initialize('user-123', false);

      const result = await service.getItemsByDateRange(startDate, endDate);

      expect(mockIndexedDB.getItemsByDateRange).toHaveBeenCalledWith(startDate, endDate);
    });
  });

  describe('reinitialize', () => {
    it('should reset and reinitialize the service', async () => {
      await service.initialize('user-123', false);

      const statusBefore = service.getStatus();
      expect(statusBefore.userType).toBe('free');

      await service.reinitialize('user-456', true);

      const statusAfter = service.getStatus();
      expect(statusAfter.userType).toBe('premium');
      expect(statusAfter.firebaseUserId).toBe('user-456');
    });

    it('should handle switching from user to guest', async () => {
      await service.initialize('user-123', false);
      await service.reinitialize();

      const status = service.getStatus();
      expect(status.userType).toBe('guest');
      expect(status.hasFirebase).toBe(false);
      expect(status.firebaseUserId).toBeNull();
    });
  });

  describe('getStatus', () => {
    it('should return correct status for guest', async () => {
      await service.initialize();

      expect(service.getStatus()).toEqual({
        initialized: true,
        userType: 'guest',
        hasFirebase: false,
        firebaseUserId: null
      });
    });

    it('should return correct status for free user', async () => {
      await service.initialize('user-123', false);

      expect(service.getStatus()).toEqual({
        initialized: true,
        userType: 'free',
        hasFirebase: true,
        firebaseUserId: 'user-123'
      });
    });

    it('should return correct status for premium user', async () => {
      mockFirebase = (FirebasePracticeHistoryStorage as jest.MockedClass<typeof FirebasePracticeHistoryStorage>).mock.instances[0] as any;
      mockFirebase.syncFromLocal = jest.fn().mockResolvedValue(undefined);

      await service.initialize('user-123', true);

      expect(service.getStatus()).toEqual({
        initialized: true,
        userType: 'premium',
        hasFirebase: true,
        firebaseUserId: 'user-123'
      });
    });

    it('should return not initialized status initially', () => {
      expect(service.getStatus()).toEqual({
        initialized: false,
        userType: 'guest',
        hasFirebase: false,
        firebaseUserId: null
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple rapid initializations', async () => {
      const promises = [
        service.initialize('user-123', false),
        service.initialize('user-123', false),
        service.initialize('user-123', false)
      ];

      await Promise.all(promises);

      expect(mockIndexedDB.init).toHaveBeenCalledTimes(1);
    });

    it('should handle operations after reinitialization', async () => {
      await service.initialize('user-123', false);

      const item1 = createMockPracticeItem({ videoId: 'video1' });
      await service.addOrUpdateItem(item1);

      await service.reinitialize('user-456', true);

      const item2 = createMockPracticeItem({ videoId: 'video2' });
      await service.addOrUpdateItem(item2);

      expect(mockIndexedDB.addOrUpdateItem).toHaveBeenCalledTimes(2);
    });
  });
});