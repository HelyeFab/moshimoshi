import { PracticeHistoryItem } from '../../services/practiceHistory/types';

/**
 * Test utilities for practice history tests
 */

// Mock IndexedDB implementation
export class MockIndexedDB {
  private stores: Map<string, Map<string, any>> = new Map();

  open(dbName: string, version?: number) {
    return {
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any,
      result: this.createDatabase(dbName),

      addEventListener: (event: string, handler: Function) => {
        if (event === 'success' && this.onsuccess) {
          setTimeout(() => handler({ target: { result: this.createDatabase(dbName) } }), 0);
        }
      }
    };
  }

  private createDatabase(dbName: string) {
    if (!this.stores.has(dbName)) {
      this.stores.set(dbName, new Map());
    }

    return {
      transaction: (storeNames: string[], mode: string) => {
        return {
          objectStore: (storeName: string) => this.createObjectStore(dbName, storeName)
        };
      },
      createObjectStore: (storeName: string, options?: any) => {
        return this.createObjectStore(dbName, storeName);
      },
      objectStoreNames: {
        contains: (storeName: string) => this.stores.get(dbName)?.has(storeName) || false
      },
      deleteObjectStore: (storeName: string) => {
        this.stores.get(dbName)?.delete(storeName);
      }
    };
  }

  private createObjectStore(dbName: string, storeName: string) {
    const db = this.stores.get(dbName);
    if (!db?.has(storeName)) {
      db?.set(storeName, new Map());
    }

    const store = db?.get(storeName) || new Map();

    return {
      add: (value: any) => this.createRequest(() => {
        store.set(value.id || Math.random().toString(), value);
      }),
      put: (value: any) => this.createRequest(() => {
        store.set(value.id || value.videoId, value);
      }),
      get: (key: string) => this.createRequest(() => store.get(key)),
      getAll: () => this.createRequest(() => Array.from(store.values())),
      delete: (key: string) => this.createRequest(() => store.delete(key)),
      clear: () => this.createRequest(() => store.clear()),
      createIndex: (name: string, keyPath: string, options?: any) => ({
        get: (key: string) => this.createRequest(() => {
          const items = Array.from(store.values());
          return items.find(item => item[keyPath] === key);
        }),
        getKey: (key: string) => this.createRequest(() => {
          const items = Array.from(store.entries());
          const found = items.find(([_, item]) => item[keyPath] === key);
          return found ? found[0] : undefined;
        })
      }),
      index: (indexName: string) => ({
        get: (key: string) => this.createRequest(() => {
          const items = Array.from(store.values());
          return items.find(item => item.videoId === key);
        }),
        getKey: (key: string) => this.createRequest(() => {
          const items = Array.from(store.entries());
          const found = items.find(([_, item]) => item.videoId === key);
          return found ? found[0] : undefined;
        })
      })
    };
  }

  private createRequest(operation: Function) {
    const result = operation();
    return {
      result,
      onsuccess: null as any,
      onerror: null as any,
      addEventListener: (event: string, handler: Function) => {
        if (event === 'success') {
          setTimeout(() => handler({ target: { result } }), 0);
        }
      }
    };
  }

  clear() {
    this.stores.clear();
  }
}

// Mock Firebase Admin
export const mockAdminDb = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  batch: jest.fn().mockReturnValue({
    set: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined)
  })
};

// Sample test data
export const createMockPracticeItem = (overrides?: Partial<PracticeHistoryItem>): PracticeHistoryItem => ({
  id: 'test_video_123',
  videoUrl: 'https://www.youtube.com/watch?v=test123',
  videoTitle: 'Test Japanese Lesson',
  videoId: 'test123',
  thumbnailUrl: 'https://img.youtube.com/vi/test123/mqdefault.jpg',
  channelName: 'Test Channel',
  lastPracticed: new Date('2024-01-15T10:00:00'),
  firstPracticed: new Date('2024-01-01T10:00:00'),
  practiceCount: 5,
  totalPracticeTime: 3600,
  duration: 720,
  contentType: 'youtube',
  metadata: {
    channelTitle: 'Test Channel',
    description: 'Test video description',
    publishedAt: '2024-01-01T00:00:00Z'
  },
  ...overrides
});

export const createMockPracticeItems = (count: number = 5): PracticeHistoryItem[] => {
  return Array.from({ length: count }, (_, i) => createMockPracticeItem({
    id: `test_video_${i}`,
    videoId: `test${i}`,
    videoUrl: `https://www.youtube.com/watch?v=test${i}`,
    videoTitle: `Test Video ${i}`,
    practiceCount: Math.floor(Math.random() * 10) + 1,
    lastPracticed: new Date(Date.now() - i * 24 * 60 * 60 * 1000), // Each day older
    totalPracticeTime: Math.floor(Math.random() * 7200)
  }));
};

// Mock localStorage
export class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] || null;
  }
}

// Mock fetch for YouTube API
export const mockYouTubeApiResponse = (videoId: string = 'test123') => ({
  items: [{
    id: videoId,
    snippet: {
      title: 'Test Japanese Lesson',
      channelTitle: 'Test Channel',
      description: 'Learn Japanese with this test video',
      thumbnails: {
        high: {
          url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        },
        default: {
          url: `https://img.youtube.com/vi/${videoId}/default.jpg`
        }
      },
      publishedAt: '2024-01-01T00:00:00Z'
    },
    contentDetails: {
      duration: 'PT12M30S'
    }
  }]
});

// Mock authentication session
export const mockAuthSession = (overrides?: any) => ({
  uid: 'test-user-123',
  email: 'test@example.com',
  subscription: {
    plan: 'free',
    ...overrides?.subscription
  },
  ...overrides
});

// Wait for async operations
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// Setup test environment
export const setupTestEnvironment = () => {
  // Mock IndexedDB
  const mockIndexedDB = new MockIndexedDB();
  (global as any).indexedDB = mockIndexedDB;

  // Mock localStorage
  const mockLocalStorage = new MockLocalStorage();
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true
  });

  // Mock fetch
  global.fetch = jest.fn();

  // Clean up function
  return () => {
    mockIndexedDB.clear();
    mockLocalStorage.clear();
    jest.clearAllMocks();
  };
};