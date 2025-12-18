/**
 * SessionManager Integration Tests
 *
 * Tests complete integration of SessionManager, Event Hub, and Gamification
 * Proves that events flow correctly through the system
 * Coverage target: 80%+
 */

import { SessionManager } from '../session/manager';
import { LocalSessionStorage } from '../session/storage';
import { MockAnalyticsService } from '../session/analytics.service';
import { getEventHub, initializeEventHub, destroyEventHub } from '../core/event-hub';
import { ReviewEventType } from '../core/events';
import { ReviewableContent } from '../core/interfaces';

// Mock content
const mockContent: ReviewableContent[] = [
  {
    id: 'integration-1',
    contentType: 'kana',
    primaryDisplay: 'あ',
    primaryAnswer: 'a',
    difficulty: 0.3,
    tags: ['test'],
    supportedModes: ['recognition'],
    preferredMode: 'recognition'
  },
  {
    id: 'integration-2',
    contentType: 'kana',
    primaryDisplay: 'い',
    primaryAnswer: 'i',
    difficulty: 0.3,
    tags: ['test'],
    supportedModes: ['recognition'],
    preferredMode: 'recognition'
  }
];

describe('SessionManager Integration', () => {
  let sessionManager: SessionManager;
  let storage: LocalSessionStorage;
  let analytics: MockAnalyticsService;

  beforeEach(() => {
    // Clean up any previous event hub
    destroyEventHub();

    storage = new LocalSessionStorage();
    analytics = new MockAnalyticsService(false); // Disable logging
    sessionManager = new SessionManager(storage, analytics);
  });

  afterEach(() => {
    sessionManager.removeAllListeners();
    destroyEventHub();
  });

  describe('Event Hub Integration', () => {
    test('should emit SESSION_STARTED to global event hub', async () => {
      const hub = getEventHub();
      const listener = jest.fn();
      hub.on(ReviewEventType.SESSION_STARTED, listener);

      await sessionManager.startSession({
        userId: 'test-user',
        mode: 'recognition',
        items: mockContent,
        source: 'manual'
      });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ReviewEventType.SESSION_STARTED,
          data: expect.objectContaining({
            itemCount: 2,
            mode: 'recognition',
            source: 'manual'
          })
        })
      );
    });

    test('should emit ITEM_PRESENTED to global event hub', async () => {
      const hub = getEventHub();
      const listener = jest.fn();
      hub.on(ReviewEventType.ITEM_PRESENTED, listener);

      await sessionManager.startSession({
        userId: 'test-user',
        mode: 'recognition',
        items: mockContent,
        source: 'manual'
      });

      // getCurrentItem() triggers ITEM_PRESENTED
      sessionManager.getCurrentItem();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ReviewEventType.ITEM_PRESENTED,
          data: expect.objectContaining({
            itemId: 'integration-1',
            contentType: 'kana',
            index: 0,
            total: 2
          })
        })
      );
    });

    test('should emit ITEM_ANSWERED with SRS data to global event hub', async () => {
      const hub = getEventHub();
      const listener = jest.fn();
      hub.on(ReviewEventType.ITEM_ANSWERED, listener);

      await sessionManager.startSession({
        userId: 'test-user',
        mode: 'recognition',
        items: mockContent,
        source: 'manual'
      });

      sessionManager.getCurrentItem();

      await sessionManager.submitAnswer('a', 5);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ReviewEventType.ITEM_ANSWERED,
          data: expect.objectContaining({
            itemId: 'integration-1',
            correct: true,
            userAnswer: 'a',
            expectedAnswer: 'a',
            confidence: 5,
            score: expect.any(Number),
            attempts: 1,
            contentType: 'kana'
          })
        })
      );

      // Verify SRS data is included
      const eventData = listener.mock.calls[0][0].data;
      expect(eventData.nextReviewAt).toBeDefined();
      expect(eventData.srsData).toBeDefined();
    });

    test('should emit SESSION_COMPLETED to global event hub', async () => {
      const hub = getEventHub();
      const listener = jest.fn();
      hub.on(ReviewEventType.SESSION_COMPLETED, listener);

      await sessionManager.startSession({
        userId: 'test-user',
        mode: 'recognition',
        items: mockContent,
        source: 'manual'
      });

      // Complete all items
      sessionManager.getCurrentItem();
      await sessionManager.submitAnswer('a');
      await sessionManager.nextItem();

      sessionManager.getCurrentItem();
      await sessionManager.submitAnswer('i');
      await sessionManager.nextItem();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ReviewEventType.SESSION_COMPLETED,
          data: expect.objectContaining({
            statistics: expect.objectContaining({
              totalItems: 2,
              correctItems: 2,
              accuracy: 100
            }),
            duration: expect.any(Number)
          })
        })
      );
    });

    test('should emit PROGRESS_UPDATED events', async () => {
      const hub = getEventHub();
      const listener = jest.fn();
      hub.on(ReviewEventType.PROGRESS_UPDATED, listener);

      await sessionManager.startSession({
        userId: 'test-user',
        mode: 'recognition',
        items: mockContent,
        source: 'manual'
      });

      sessionManager.getCurrentItem();
      await sessionManager.submitAnswer('a');
      await sessionManager.nextItem();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ReviewEventType.PROGRESS_UPDATED,
          data: expect.objectContaining({
            current: 1,
            total: 2,
            correct: 1,
            incorrect: 0
          })
        })
      );
    });
  });

  describe('Gamification Integration Simulation', () => {
    test('should allow gamification listener to receive events', async () => {
      // Initialize event hub like gamification would
      initializeEventHub('test-user');
      const hub = getEventHub();

      // Simulate gamification listener
      const sessionCompletedHandler = jest.fn((event) => {
        // Simulate what gamificationListener.handleSessionCompleted does
        const { statistics } = event.data;
        expect(statistics.totalItems).toBeGreaterThan(0);
        expect(statistics.accuracy).toBeGreaterThanOrEqual(0);
        expect(statistics.accuracy).toBeLessThanOrEqual(100);
      });

      hub.on(ReviewEventType.SESSION_COMPLETED, sessionCompletedHandler);

      // Run a complete session
      await sessionManager.startSession({
        userId: 'test-user',
        mode: 'recognition',
        items: mockContent,
        source: 'manual'
      });

      sessionManager.getCurrentItem();
      await sessionManager.submitAnswer('a', 5);
      await sessionManager.nextItem();

      sessionManager.getCurrentItem();
      await sessionManager.submitAnswer('i', 4);
      await sessionManager.nextItem();

      // Verify gamification handler was called with correct data
      expect(sessionCompletedHandler).toHaveBeenCalled();
    });

    test('should provide all necessary data for XP calculation', async () => {
      const hub = getEventHub();
      const capturedEvents: any[] = [];

      hub.on(ReviewEventType.SESSION_COMPLETED, (event) => {
        capturedEvents.push(event);
      });

      await sessionManager.startSession({
        userId: 'test-user',
        mode: 'recognition',
        items: mockContent,
        source: 'manual'
      });

      sessionManager.getCurrentItem();
      await sessionManager.submitAnswer('a', 5);
      await sessionManager.nextItem();

      sessionManager.getCurrentItem();
      await sessionManager.submitAnswer('wrong', 2);
      await sessionManager.nextItem();

      expect(capturedEvents).toHaveLength(1);

      const completedEvent = capturedEvents[0];
      const { statistics } = completedEvent.data;

      // Verify all fields needed for gamification exist
      expect(statistics.totalItems).toBe(2);
      expect(statistics.correctItems).toBe(1);
      expect(statistics.incorrectItems).toBe(1);
      expect(statistics.accuracy).toBe(50);
      expect(statistics.totalScore).toBeDefined();
      expect(statistics.averageResponseTime).toBeDefined();
      expect(statistics.currentStreak).toBeDefined();
      expect(completedEvent.data.duration).toBeDefined();
    });
  });

  describe('Full Session Lifecycle Integration', () => {
    test('should handle complete session flow with all events', async () => {
      const hub = getEventHub();
      const events: { type: string; timestamp: Date }[] = [];

      // Track all events
      Object.values(ReviewEventType).forEach((eventType) => {
        hub.on(eventType, (event) => {
          events.push({ type: eventType, timestamp: event.timestamp });
        });
      });

      // Run complete session
      await sessionManager.startSession({
        userId: 'test-user',
        mode: 'recognition',
        items: mockContent,
        source: 'manual',
        shuffle: false
      });

      sessionManager.getCurrentItem();
      await sessionManager.submitAnswer('a', 5);
      await sessionManager.nextItem();

      sessionManager.getCurrentItem();
      await sessionManager.submitAnswer('i', 4);
      await sessionManager.nextItem();

      // Verify event order
      const eventTypes = events.map(e => e.type);
      expect(eventTypes).toContain(ReviewEventType.SESSION_STARTED);
      expect(eventTypes).toContain(ReviewEventType.ITEM_PRESENTED);
      expect(eventTypes).toContain(ReviewEventType.ITEM_ANSWERED);
      expect(eventTypes).toContain(ReviewEventType.PROGRESS_UPDATED);
      expect(eventTypes).toContain(ReviewEventType.SESSION_COMPLETED);

      // Verify timestamps are sequential
      for (let i = 1; i < events.length; i++) {
        expect(events[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          events[i - 1].timestamp.getTime()
        );
      }
    });

    test('should handle skip item with proper events', async () => {
      const hub = getEventHub();
      const skipListener = jest.fn();
      hub.on(ReviewEventType.ITEM_SKIPPED, skipListener);

      await sessionManager.startSession({
        userId: 'test-user',
        mode: 'recognition',
        items: mockContent,
        source: 'manual'
      });

      sessionManager.getCurrentItem();
      await sessionManager.skipItem();

      expect(skipListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ReviewEventType.ITEM_SKIPPED,
          data: expect.objectContaining({
            itemId: 'integration-1',
            index: 0
          })
        })
      );
    });
  });

  describe('Multi-Listener Integration', () => {
    test('should support multiple listeners on same event', async () => {
      const hub = getEventHub();
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      hub.on(ReviewEventType.SESSION_COMPLETED, listener1);
      hub.on(ReviewEventType.SESSION_COMPLETED, listener2);
      hub.on(ReviewEventType.SESSION_COMPLETED, listener3);

      await sessionManager.startSession({
        userId: 'test-user',
        mode: 'recognition',
        items: mockContent,
        source: 'manual'
      });

      sessionManager.getCurrentItem();
      await sessionManager.submitAnswer('a');
      await sessionManager.nextItem();

      sessionManager.getCurrentItem();
      await sessionManager.submitAnswer('i');
      await sessionManager.nextItem();

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
      expect(listener3).toHaveBeenCalled();
    });

    test('should not affect other listeners if one throws error', async () => {
      const hub = getEventHub();
      const goodListener1 = jest.fn();
      const badListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener2 = jest.fn();

      jest.spyOn(console, 'error').mockImplementation();

      hub.on(ReviewEventType.SESSION_COMPLETED, goodListener1);
      hub.on(ReviewEventType.SESSION_COMPLETED, badListener);
      hub.on(ReviewEventType.SESSION_COMPLETED, goodListener2);

      await sessionManager.startSession({
        userId: 'test-user',
        mode: 'recognition',
        items: mockContent,
        source: 'manual'
      });

      sessionManager.getCurrentItem();
      await sessionManager.submitAnswer('a');
      await sessionManager.nextItem();

      sessionManager.getCurrentItem();
      await sessionManager.submitAnswer('i');
      await sessionManager.nextItem();

      // Good listeners should still be called
      expect(goodListener1).toHaveBeenCalled();
      expect(goodListener2).toHaveBeenCalled();

      (console.error as jest.Mock).mockRestore();
    });
  });

  describe('Event Data Integrity', () => {
    test('should include userId and sessionId in all events', async () => {
      const hub = getEventHub();
      const allEvents: any[] = [];

      Object.values(ReviewEventType).forEach((eventType) => {
        hub.on(eventType, (event) => {
          allEvents.push(event);
        });
      });

      await sessionManager.startSession({
        userId: 'test-user-123',
        mode: 'recognition',
        items: mockContent,
        source: 'manual'
      });

      sessionManager.getCurrentItem();
      await sessionManager.submitAnswer('a');
      await sessionManager.nextItem();

      sessionManager.getCurrentItem();
      await sessionManager.submitAnswer('i');
      await sessionManager.nextItem();

      // All events should have userId and sessionId
      allEvents.forEach((event) => {
        expect(event.userId).toBe('test-user-123');
        expect(event.sessionId).toBeTruthy();
        expect(typeof event.sessionId).toBe('string');
        expect(event.timestamp).toBeInstanceOf(Date);
      });
    });

    test('should provide consistent sessionId across events', async () => {
      const hub = getEventHub();
      const sessionIds: string[] = [];

      Object.values(ReviewEventType).forEach((eventType) => {
        hub.on(eventType, (event) => {
          if (event.sessionId) {
            sessionIds.push(event.sessionId);
          }
        });
      });

      await sessionManager.startSession({
        userId: 'test-user',
        mode: 'recognition',
        items: mockContent,
        source: 'manual'
      });

      sessionManager.getCurrentItem();
      await sessionManager.submitAnswer('a');
      await sessionManager.nextItem();

      sessionManager.getCurrentItem();
      await sessionManager.submitAnswer('i');
      await sessionManager.nextItem();

      // All sessionIds should be the same
      const uniqueSessionIds = [...new Set(sessionIds)];
      expect(uniqueSessionIds).toHaveLength(1);
    });
  });

  describe('Performance Integration', () => {
    test('should emit events efficiently even with many listeners', async () => {
      const hub = getEventHub();

      // Add many listeners
      for (let i = 0; i < 100; i++) {
        hub.on(ReviewEventType.ITEM_ANSWERED, jest.fn());
      }

      const start = Date.now();

      await sessionManager.startSession({
        userId: 'test-user',
        mode: 'recognition',
        items: mockContent,
        source: 'manual'
      });

      sessionManager.getCurrentItem();
      await sessionManager.submitAnswer('a');

      const duration = Date.now() - start;

      // Should complete in reasonable time even with 100 listeners
      expect(duration).toBeLessThan(100); // 100ms threshold
    });
  });
});
