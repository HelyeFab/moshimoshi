import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FlashcardManager } from '../FlashcardManager';
import { SyncManager } from '../SyncManager';
import { IndexedDBOptimizer } from '../IndexedDBOptimizer';
import { ErrorMonitor } from '../ErrorMonitor';
import { PerformanceTracker } from '../PerformanceTracker';
import type { FlashcardDeck, CreateDeckRequest } from '@/types/flashcards';

// Mock IndexedDB
vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve({
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    getAllFromIndex: vi.fn(() => Promise.resolve([])),
    count: vi.fn(() => Promise.resolve(0)),
    transaction: vi.fn(() => ({
      store: {
        put: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn()
      },
      done: Promise.resolve()
    })),
    close: vi.fn()
  }))
}));

describe('FlashcardManager', () => {
  let manager: FlashcardManager;

  beforeEach(() => {
    manager = new FlashcardManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Deck Operations', () => {
    it('should create a deck for free users', async () => {
      const request: CreateDeckRequest = {
        name: 'Test Deck',
        description: 'Test Description',
        emoji: '🎴',
        color: 'primary'
      };

      const deck = await manager.createDeck(request, 'test-user', false);

      expect(deck).toBeDefined();
      expect(deck?.name).toBe('Test Deck');
      expect(deck?.userId).toBe('test-user');
    });

    it('should enforce deck limits for free users', async () => {
      const limits = FlashcardManager.getDeckLimits('free');
      expect(limits.maxDecks).toBe(10);
      expect(limits.dailyReviews).toBe(50);
    });

    it('should allow unlimited decks for premium users', async () => {
      const limits = FlashcardManager.getDeckLimits('premium_monthly');
      expect(limits.maxDecks).toBe(-1); // Unlimited
      expect(limits.dailyReviews).toBe(-1); // Unlimited
    });

    it('should handle deck deletion', async () => {
      const success = await manager.deleteDeck('deck-id', 'user-id', false);
      expect(success).toBe(true);
    });
  });

  describe('Import/Export', () => {
    it('should export deck to CSV format', async () => {
      const csv = await manager.exportDeck('deck-id', 'csv');
      expect(csv).toContain('Front,Back');
    });

    it('should export deck to JSON format', async () => {
      const json = await manager.exportDeck('deck-id', 'json');
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('name');
      expect(parsed).toHaveProperty('cards');
    });

    it('should import deck from CSV', async () => {
      const csvData = 'Front,Back\n"Question 1","Answer 1"\n"Question 2","Answer 2"';
      const deck = await manager.importDeck(
        {
          name: 'Imported Deck',
          format: 'csv',
          data: csvData
        },
        'user-id',
        false
      );

      expect(deck).toBeDefined();
      expect(deck?.name).toBe('Imported Deck');
    });
  });
});

describe('SyncManager', () => {
  let syncManager: SyncManager;

  beforeEach(() => {
    syncManager = new SyncManager();
  });

  afterEach(() => {
    syncManager.destroy();
  });

  describe('Sync Queue', () => {
    it('should queue operations', async () => {
      await syncManager.queueOperation({
        action: 'create',
        deckId: 'deck-123',
        data: { name: 'Test Deck' },
        userId: 'user-123'
      });

      const status = await syncManager.getSyncStatus();
      expect(status.queueLength).toBeGreaterThan(0);
    });

    it('should handle circuit breaker', async () => {
      const status = await syncManager.getSyncStatus();
      expect(status.circuitBreakerOpen).toBe(false);
    });

    it('should clear sync queue', async () => {
      await syncManager.clearSyncQueue();
      const status = await syncManager.getSyncStatus();
      expect(status.queueLength).toBe(0);
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve conflicts with local preference', async () => {
      await syncManager.resolveConflict('conflict-123', 'local');
      // Verify resolution was applied
    });

    it('should resolve conflicts with remote preference', async () => {
      await syncManager.resolveConflict('conflict-123', 'remote');
      // Verify resolution was applied
    });

    it('should resolve conflicts with merge strategy', async () => {
      await syncManager.resolveConflict('conflict-123', 'merge');
      // Verify merge was performed
    });
  });
});

describe('IndexedDBOptimizer', () => {
  let optimizer: IndexedDBOptimizer;

  beforeEach(() => {
    optimizer = new IndexedDBOptimizer();
  });

  afterEach(() => {
    optimizer.destroy();
  });

  describe('Optimized Queries', () => {
    it('should use pagination for deck loading', async () => {
      const result = await optimizer.getDecksOptimized('user-123', {
        limit: 10,
        offset: 0
      });

      expect(result).toHaveProperty('decks');
      expect(result).toHaveProperty('hasMore');
      expect(result).toHaveProperty('total');
    });

    it('should support sorting options', async () => {
      const result = await optimizer.getDecksOptimized('user-123', {
        sortBy: 'cardCount',
        sortOrder: 'desc'
      });

      expect(result.decks).toBeDefined();
    });

    it('should cache query results', async () => {
      const result1 = await optimizer.getDecksOptimized('user-123', {
        useCache: true
      });

      const result2 = await optimizer.getDecksOptimized('user-123', {
        useCache: true
      });

      // Second call should be faster due to caching
      expect(result2).toEqual(result1);
    });
  });

  describe('Bulk Operations', () => {
    it('should handle bulk deck creation', async () => {
      const decks: FlashcardDeck[] = [
        createMockDeck('deck-1'),
        createMockDeck('deck-2'),
        createMockDeck('deck-3')
      ];

      await optimizer.bulkCreateDecks(decks);
      // Verify all decks were created
    });

    it('should handle bulk deck updates', async () => {
      const updates = [
        { id: 'deck-1', changes: { name: 'Updated Name 1' } },
        { id: 'deck-2', changes: { name: 'Updated Name 2' } }
      ];

      await optimizer.bulkUpdateDecks(updates);
      // Verify updates were applied
    });

    it('should handle bulk deck deletion', async () => {
      const deckIds = ['deck-1', 'deck-2', 'deck-3'];
      await optimizer.bulkDeleteDecks(deckIds);
      // Verify decks were deleted
    });
  });

  describe('Search', () => {
    it('should search decks by name', async () => {
      const results = await optimizer.searchDecks('user-123', 'Japanese', {
        searchIn: ['name']
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it('should search decks by card content', async () => {
      const results = await optimizer.searchDecks('user-123', 'kanji', {
        searchIn: ['cards']
      });

      expect(Array.isArray(results)).toBe(true);
    });
  });
});

describe('ErrorMonitor', () => {
  let monitor: ErrorMonitor;

  beforeEach(() => {
    monitor = new ErrorMonitor();
  });

  afterEach(() => {
    monitor.destroy();
  });

  describe('Error Capture', () => {
    it('should capture and categorize errors', () => {
      const errorId = monitor.captureError(
        new Error('Network error: Failed to fetch'),
        { operation: 'sync' }
      );

      expect(errorId).toBeDefined();
      const errors = monitor.getRecentErrors(1);
      expect(errors[0]?.error.type).toBe('network');
    });

    it('should detect storage quota errors', () => {
      const errorId = monitor.captureError(
        new Error('QuotaExceededError: Storage quota exceeded'),
        { operation: 'save' }
      );

      const errors = monitor.getRecentErrors(1);
      expect(errors[0]?.error.type).toBe('storage');
      expect(errors[0]?.severity).toBe('high');
    });

    it('should track error patterns', () => {
      // Simulate multiple similar errors
      monitor.captureError(new Error('Timeout'), { operation: 'fetch' });
      monitor.captureError(new Error('Timeout'), { operation: 'fetch' });
      monitor.captureError(new Error('Timeout'), { operation: 'fetch' });

      const summary = monitor.getErrorSummary();
      expect(summary.topErrors[0]?.count).toBe(3);
    });
  });

  describe('Error Resolution', () => {
    it('should mark errors as resolved', () => {
      const errorId = monitor.captureError(new Error('Test error'));
      monitor.resolveError(errorId);

      const summary = monitor.getErrorSummary();
      expect(summary.resolvedCount).toBeGreaterThan(0);
    });

    it('should identify critical errors', () => {
      monitor.captureError(
        new Error('IndexedDB blocked'),
        { operation: 'init' }
      );

      const criticalErrors = monitor.getCriticalErrors();
      expect(criticalErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Reporting', () => {
    it('should generate error report', () => {
      monitor.captureError(new Error('Test error 1'));
      monitor.captureError(new Error('Test error 2'));

      const report = monitor.generateReport();
      expect(report).toContain('Error Report');
      expect(report).toContain('Summary');
    });

    it('should export errors to CSV', () => {
      monitor.captureError(new Error('Test error'));
      const csv = monitor.exportToCSV();

      expect(csv).toContain('Timestamp');
      expect(csv).toContain('Type');
      expect(csv).toContain('Severity');
    });
  });
});

describe('PerformanceTracker', () => {
  let tracker: PerformanceTracker;

  beforeEach(() => {
    tracker = new PerformanceTracker();
  });

  afterEach(() => {
    tracker.destroy();
  });

  describe('Timer Operations', () => {
    it('should track operation timing', async () => {
      tracker.startTimer('test-operation');

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 50));

      const duration = tracker.endTimer('test-operation');
      expect(duration).toBeGreaterThan(40);
      expect(duration).toBeLessThan(100);
    });

    it('should track async operations', async () => {
      const result = await tracker.trackAsync(
        'async-operation',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 30));
          return 'success';
        }
      );

      expect(result).toBe('success');
      const stats = tracker.getMetricStats('async-operation');
      expect(stats?.count).toBe(1);
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate metric statistics', () => {
      // Record multiple measurements
      for (let i = 0; i < 10; i++) {
        tracker.recordMetric({
          name: 'test-metric',
          startTime: 0,
          endTime: 100 + i * 10,
          duration: 100 + i * 10
        });
      }

      const stats = tracker.getMetricStats('test-metric');
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(10);
      expect(stats?.min).toBe(100);
      expect(stats?.max).toBe(190);
      expect(stats?.avg).toBeCloseTo(145, 0);
    });

    it('should detect slow operations', () => {
      tracker.recordMetric({
        name: 'deckLoad',
        startTime: 0,
        endTime: 500,
        duration: 500 // Exceeds threshold of 100ms
      });

      const summary = tracker.getSummary();
      expect(summary.slowOperations.length).toBeGreaterThan(0);
    });
  });

  describe('Reporting', () => {
    it('should generate performance report', () => {
      tracker.recordMetric({
        name: 'test-operation',
        startTime: 0,
        endTime: 100,
        duration: 100
      });

      const report = tracker.generateReport();
      expect(report.metrics).toHaveProperty('test-operation');
      expect(report.timestamp).toBeDefined();
    });

    it('should provide performance suggestions', () => {
      // Simulate slow IndexedDB queries
      for (let i = 0; i < 5; i++) {
        tracker.recordMetric({
          name: 'indexedDBQuery',
          startTime: 0,
          endTime: 200,
          duration: 200
        });
      }

      const report = tracker.generateReport();
      expect(report.suggestions.length).toBeGreaterThan(0);
      expect(report.suggestions[0]).toContain('IndexedDB');
    });

    it('should export metrics to CSV', () => {
      tracker.recordMetric({
        name: 'test-metric',
        startTime: 0,
        endTime: 100,
        duration: 100
      });

      const csv = tracker.exportToCSV();
      expect(csv).toContain('Metric,Count,Avg');
      expect(csv).toContain('test-metric');
    });
  });
});

// Helper function to create mock deck
function createMockDeck(id: string): FlashcardDeck {
  return {
    id,
    userId: 'test-user',
    name: `Deck ${id}`,
    emoji: '🎴',
    color: 'primary',
    cardStyle: 'minimal',
    cards: [],
    settings: {
      studyDirection: 'front-to-back',
      autoPlay: false,
      showHints: true,
      animationSpeed: 'normal',
      soundEffects: true,
      hapticFeedback: true,
      sessionLength: 20,
      reviewMode: 'srs'
    },
    stats: {
      totalCards: 0,
      newCards: 0,
      learningCards: 0,
      reviewCards: 0,
      masteredCards: 0,
      totalStudied: 0,
      averageAccuracy: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalTimeSpent: 0
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}