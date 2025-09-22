/**
 * SessionManager Core Lifecycle Tests
 * Agent 2: Core Systems Tester
 * 
 * Testing session lifecycle, state management, and event handling
 */

import { SessionManager } from '../manager';
import { SessionState, SessionAction } from '../state-machine';
import { ReviewEventType } from '../../core/events';
import { SessionError } from '../../core/errors';
import { ReviewMode } from '../../core/types';
import { ContentType } from '../../core/interfaces';
import { 
  MockFactory,
  createReviewableContent,
  createSessionStatistics,
  createReviewSession
} from '../../__tests__/test-utils/mockFactory';

describe('SessionManager', () => {
  let manager: SessionManager;
  let mockStorage: any;
  let mockAnalytics: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockStorage = {
      saveSession: jest.fn().mockResolvedValue(undefined),
      updateSession: jest.fn().mockResolvedValue(undefined),
      loadSession: jest.fn().mockResolvedValue(null),
      deleteSession: jest.fn().mockResolvedValue(undefined),
      saveStatistics: jest.fn().mockResolvedValue(undefined),
      loadStatistics: jest.fn().mockResolvedValue(null),
      getUserSessions: jest.fn().mockResolvedValue([]),
      getActiveSession: jest.fn().mockResolvedValue(null),
      getSessionSummaries: jest.fn().mockResolvedValue([]),
      clearAllSessions: jest.fn().mockResolvedValue(undefined),
      getStorageSize: jest.fn().mockResolvedValue(0)
    };

    mockAnalytics = {
      trackSessionStart: jest.fn().mockResolvedValue(undefined),
      trackAnswer: jest.fn().mockResolvedValue(undefined),
      trackSessionComplete: jest.fn().mockResolvedValue(undefined),
      trackEvent: jest.fn().mockResolvedValue(undefined)
    };

    manager = new SessionManager(mockStorage, mockAnalytics);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Session Lifecycle', () => {
    describe('startSession', () => {
      it('should create a new session with correct initial state', async () => {
        const items = MockFactory.createBulkContent(5);
        const options = {
          userId: 'user123',
          items,
          mode: ReviewMode.RECOGNITION,
          shuffle: false,
          source: 'test',
          tags: ['test-tag']
        };

        const session = await manager.startSession(options);

        expect(session).toMatchObject({
          userId: 'user123',
          status: 'active',
          mode: ReviewMode.RECOGNITION,
          currentIndex: 0,
          source: 'test',
          tags: ['test-tag']
        });
        
        expect(session.items).toHaveLength(5);
        expect(session.items[0].content).toEqual(items[0]);
        expect(mockStorage.saveSession).toHaveBeenCalledWith(session);
        expect(mockAnalytics.trackSessionStart).toHaveBeenCalledWith(session);
      });

      it('should shuffle items when shuffle option is true', async () => {
        const items = MockFactory.createBulkContent(10);
        const options = {
          userId: 'user123',
          items,
          mode: ReviewMode.RECOGNITION,
          shuffle: true
        };

        // Mock Math.random to ensure predictable shuffling
        const mockRandom = jest.spyOn(Math, 'random');
        mockRandom.mockReturnValue(0.5);

        const session = await manager.startSession(options);

        expect(session.items.length).toBe(10);
        // Items should be shuffled (we can't test exact order due to random nature)
        // But we can verify all items are present
        const itemIds = session.items.map(i => i.content.id);
        const originalIds = items.map(i => i.id);
        expect(itemIds.sort()).toEqual(originalIds.sort());

        mockRandom.mockRestore();
      });

      it('should throw error if session is already active', async () => {
        const items = MockFactory.createBulkContent(3);
        const options = {
          userId: 'user123',
          items,
          mode: ReviewMode.RECOGNITION
        };

        await manager.startSession(options);

        await expect(manager.startSession(options)).rejects.toThrow(SessionError);
        await expect(manager.startSession(options)).rejects.toThrow('A session is already active');
      });

      it('should emit SESSION_STARTED event', async () => {
        const items = MockFactory.createBulkContent(3);
        const eventPromise = new Promise(resolve => {
          manager.once(ReviewEventType.SESSION_STARTED, resolve);
        });

        await manager.startSession({
          userId: 'user123',
          items,
          mode: ReviewMode.RECOGNITION
        });

        const event = await eventPromise;
        expect(event).toMatchObject({
          type: ReviewEventType.SESSION_STARTED,
          data: {
            itemCount: 3,
            mode: ReviewMode.RECOGNITION,
            contentTypes: expect.arrayContaining(['kana'])
          }
        });
      });

      it('should start activity timer', async () => {
        const items = MockFactory.createBulkContent(3);
        await manager.startSession({
          userId: 'user123',
          items,
          mode: ReviewMode.RECOGNITION
        });

        // Fast-forward to just before timeout
        jest.advanceTimersByTime(5 * 60 * 1000 - 1000);
        expect(manager.getSession()?.status).toBe('active');

        // Trigger timeout warning
        jest.advanceTimersByTime(1001);
        // Should emit timeout warning but session still active
        expect(manager.getSession()?.status).toBe('active');
      });
    });

    describe('getCurrentItem', () => {
      beforeEach(async () => {
        const items = MockFactory.createBulkContent(5);
        await manager.startSession({
          userId: 'user123',
          items,
          mode: ReviewMode.RECOGNITION
        });
      });

      it('should return current item', () => {
        const item = manager.getCurrentItem();
        expect(item).toBeDefined();
        expect(item?.content.id).toBe('kana_0');
      });

      it('should set presentedAt timestamp on first access', () => {
        const item1 = manager.getCurrentItem();
        expect(item1?.presentedAt).toBeDefined();

        const timestamp = item1?.presentedAt;
        const item2 = manager.getCurrentItem();
        expect(item2?.presentedAt).toBe(timestamp); // Should not change
      });

      it('should emit ITEM_PRESENTED event on first access', async () => {
        const eventPromise = new Promise(resolve => {
          manager.once(ReviewEventType.ITEM_PRESENTED, resolve);
        });

        manager.getCurrentItem();

        const event = await eventPromise;
        expect(event).toMatchObject({
          type: ReviewEventType.ITEM_PRESENTED,
          data: {
            itemId: 'kana_0',
            contentType: 'kana',
            index: 0,
            total: 5
          }
        });
      });

      it('should return null when all items are completed', async () => {
        const session = manager.getSession()!;
        session.currentIndex = 5; // Beyond last item

        const item = manager.getCurrentItem();
        expect(item).toBeNull();
      });
    });

    describe('submitAnswer', () => {
      beforeEach(async () => {
        const items = [
          createReviewableContent({ 
            id: 'item1',
            primaryAnswer: 'correct',
            alternativeAnswers: ['also-correct']
          }),
          createReviewableContent({ 
            id: 'item2',
            primaryAnswer: 'test'
          })
        ];

        await manager.startSession({
          userId: 'user123',
          items,
          mode: ReviewMode.RECALL
        });

        // Present the item first
        manager.getCurrentItem();
      });

      it('should validate correct answer', async () => {
        const result = await manager.submitAnswer('correct', 3);

        expect(result).toMatchObject({
          correct: true,
          expectedAnswer: 'correct'
        });

        const item = manager.getCurrentItem();
        expect(item?.correct).toBe(true);
        expect(item?.userAnswer).toBe('correct');
        expect(item?.confidence).toBe(3);
        expect(item?.attempts).toBe(1);
        expect(item?.responseTime).toBeGreaterThan(0);
      });

      it('should validate alternative answers', async () => {
        const result = await manager.submitAnswer('also-correct');

        expect(result).toMatchObject({
          correct: true,
          expectedAnswer: 'also-correct'
        });
      });

      it('should handle incorrect answer', async () => {
        const result = await manager.submitAnswer('wrong');

        expect(result).toMatchObject({
          correct: false,
          expectedAnswer: 'correct',
          feedback: expect.any(String)
        });

        const item = manager.getCurrentItem();
        expect(item?.correct).toBe(false);
        expect(item?.userAnswer).toBe('wrong');
      });

      it('should calculate scores correctly', async () => {
        jest.advanceTimersByTime(2000); // Fast response
        
        const result = await manager.submitAnswer('correct', 5);
        
        const item = manager.getCurrentItem();
        expect(item?.baseScore).toBeGreaterThan(100); // Bonus for fast response
        expect(item?.finalScore).toBeGreaterThan(100); // Confidence bonus
      });

      it('should update statistics', async () => {
        await manager.submitAnswer('correct');
        
        const stats = manager.getStatistics();
        expect(stats).toMatchObject({
          completedItems: 1,
          correctItems: 1,
          incorrectItems: 0,
          accuracy: 100,
          currentStreak: 1
        });

        await manager.nextItem();
        manager.getCurrentItem();
        await manager.submitAnswer('wrong');

        const updatedStats = manager.getStatistics();
        expect(updatedStats).toMatchObject({
          completedItems: 2,
          correctItems: 1,
          incorrectItems: 1,
          accuracy: 50,
          currentStreak: 0
        });
      });

      it('should emit ITEM_ANSWERED event', async () => {
        const eventPromise = new Promise(resolve => {
          manager.once(ReviewEventType.ITEM_ANSWERED, resolve);
        });

        await manager.submitAnswer('correct', 4);

        const event = await eventPromise;
        expect(event).toMatchObject({
          type: ReviewEventType.ITEM_ANSWERED,
          data: {
            itemId: 'item1',
            correct: true,
            userAnswer: 'correct',
            expectedAnswer: 'correct',
            confidence: 4,
            attempts: 1
          }
        });
      });

      it('should reset activity timer', async () => {
        jest.advanceTimersByTime(4 * 60 * 1000); // Advance 4 minutes
        
        await manager.submitAnswer('correct');
        
        // Activity timer should be reset
        jest.advanceTimersByTime(4 * 60 * 1000); // Another 4 minutes
        expect(manager.getSession()?.status).toBe('active'); // Still active
      });

      it('should throw error if no active session', async () => {
        await manager.abandonSession();

        await expect(manager.submitAnswer('test')).rejects.toThrow('No active session');
      });
    });

    describe('nextItem', () => {
      beforeEach(async () => {
        const items = MockFactory.createBulkContent(3);
        await manager.startSession({
          userId: 'user123',
          items,
          mode: ReviewMode.RECOGNITION
        });
      });

      it('should advance to next item', async () => {
        expect(manager.getSession()?.currentIndex).toBe(0);
        
        await manager.nextItem();
        expect(manager.getSession()?.currentIndex).toBe(1);
        
        await manager.nextItem();
        expect(manager.getSession()?.currentIndex).toBe(2);
      });

      it('should complete session when all items are done', async () => {
        // Answer all items
        for (let i = 0; i < 3; i++) {
          manager.getCurrentItem();
          await manager.submitAnswer('test');
          if (i < 2) {
            await manager.nextItem();
          }
        }

        const eventPromise = new Promise(resolve => {
          manager.once(ReviewEventType.SESSION_COMPLETED, resolve);
        });

        await manager.nextItem(); // This should trigger completion

        const event = await eventPromise;
        expect(event).toMatchObject({
          type: ReviewEventType.SESSION_COMPLETED,
          data: {
            statistics: expect.objectContaining({
              totalItems: 3,
              completedItems: 3
            })
          }
        });

        expect(manager.getSession()).toBeNull();
      });

      it('should emit PROGRESS_UPDATED event', async () => {
        const eventPromise = new Promise(resolve => {
          manager.once(ReviewEventType.PROGRESS_UPDATED, resolve);
        });

        await manager.nextItem();

        const event = await eventPromise;
        expect(event).toMatchObject({
          type: ReviewEventType.PROGRESS_UPDATED,
          data: {
            current: 1,
            total: 3,
            correct: 0,
            incorrect: 0,
            skipped: 0
          }
        });
      });
    });

    describe('skipItem', () => {
      beforeEach(async () => {
        const items = MockFactory.createBulkContent(3);
        await manager.startSession({
          userId: 'user123',
          items,
          mode: ReviewMode.RECOGNITION
        });
      });

      it('should mark item as skipped and advance', async () => {
        manager.getCurrentItem();
        
        await manager.skipItem();
        
        const stats = manager.getStatistics();
        expect(stats?.skippedItems).toBe(1);
        expect(manager.getSession()?.currentIndex).toBe(1);
      });

      it('should emit ITEM_SKIPPED event', async () => {
        const eventPromise = new Promise(resolve => {
          manager.once(ReviewEventType.ITEM_SKIPPED, resolve);
        });

        manager.getCurrentItem();
        await manager.skipItem();

        const event = await eventPromise;
        expect(event).toMatchObject({
          type: ReviewEventType.ITEM_SKIPPED,
          data: {
            itemId: 'kana_0',
            index: 0
          }
        });
      });
    });

    describe('pauseSession', () => {
      beforeEach(async () => {
        const items = MockFactory.createBulkContent(3);
        await manager.startSession({
          userId: 'user123',
          items,
          mode: ReviewMode.RECOGNITION
        });
      });

      it('should pause active session', async () => {
        await manager.pauseSession();

        const session = manager.getSession();
        expect(session?.status).toBe('paused');
        expect(session?.pausedAt).toBeDefined();
      });

      it('should stop activity timer when paused', async () => {
        await manager.pauseSession();

        // Advance time beyond activity timeout
        jest.advanceTimersByTime(10 * 60 * 1000);

        // Session should still be paused, not timed out
        expect(manager.getSession()?.status).toBe('paused');
      });

      it('should emit SESSION_PAUSED event', async () => {
        const eventPromise = new Promise(resolve => {
          manager.once(ReviewEventType.SESSION_PAUSED, resolve);
        });

        jest.advanceTimersByTime(5000); // Simulate some elapsed time
        await manager.pauseSession();

        const event = await eventPromise;
        expect(event).toMatchObject({
          type: ReviewEventType.SESSION_PAUSED,
          data: {
            currentIndex: 0,
            timeElapsed: expect.any(Number)
          }
        });
      });

      it('should throw error if no active session', async () => {
        await manager.pauseSession();
        
        await expect(manager.pauseSession()).rejects.toThrow('No active session to pause');
      });
    });

    describe('resumeSession', () => {
      beforeEach(async () => {
        const items = MockFactory.createBulkContent(3);
        await manager.startSession({
          userId: 'user123',
          items,
          mode: ReviewMode.RECOGNITION
        });
        await manager.pauseSession();
      });

      it('should resume paused session', async () => {
        await manager.resumeSession();

        const session = manager.getSession();
        expect(session?.status).toBe('active');
        expect(session?.pausedAt).toBeUndefined();
      });

      it('should restart activity timer', async () => {
        await manager.resumeSession();

        // Activity timer should be active again
        jest.advanceTimersByTime(5 * 60 * 1000);
        
        // Should emit timeout warning
        const eventPromise = new Promise(resolve => {
          manager.once(ReviewEventType.TIMEOUT_WARNING, resolve);
        });

        jest.advanceTimersByTime(1);
        
        await expect(eventPromise).resolves.toBeDefined();
      });

      it('should emit SESSION_RESUMED event with pause duration', async () => {
        jest.advanceTimersByTime(30000); // Pause for 30 seconds

        const eventPromise = new Promise(resolve => {
          manager.once(ReviewEventType.SESSION_RESUMED, resolve);
        });

        await manager.resumeSession();

        const event = await eventPromise;
        expect(event).toMatchObject({
          type: ReviewEventType.SESSION_RESUMED,
          data: {
            pauseDuration: 30000
          }
        });
      });

      it('should throw error if session is not paused', async () => {
        await manager.resumeSession();
        
        await expect(manager.resumeSession()).rejects.toThrow('No paused session to resume');
      });
    });

    describe('completeSession', () => {
      beforeEach(async () => {
        const items = MockFactory.createBulkContent(3);
        await manager.startSession({
          userId: 'user123',
          items,
          mode: ReviewMode.RECOGNITION
        });

        // Answer all items
        for (let i = 0; i < 3; i++) {
          manager.getCurrentItem();
          await manager.submitAnswer('test');
          if (i < 2) await manager.nextItem();
        }
      });

      it('should complete session and return statistics', async () => {
        const stats = await manager.completeSession();

        expect(stats).toMatchObject({
          totalItems: 3,
          completedItems: 3,
          accuracy: expect.any(Number),
          totalTime: expect.any(Number)
        });

        expect(manager.getSession()).toBeNull();
        expect(manager.getStatistics()).toBeNull();
      });

      it('should save final state to storage', async () => {
        const stats = await manager.completeSession();

        expect(mockStorage.updateSession).toHaveBeenCalled();
        expect(mockStorage.saveStatistics).toHaveBeenCalledWith(stats);
      });

      it('should stop all timers', async () => {
        await manager.completeSession();

        // Advance time - no timeout events should fire
        jest.advanceTimersByTime(10 * 60 * 1000);
        
        // Session should remain null
        expect(manager.getSession()).toBeNull();
      });

      it('should check for achievements', async () => {
        // Set up perfect session
        const session = manager.getSession()!;
        session.items.forEach(item => {
          item.correct = true;
        });
        
        const stats = manager.getStatistics()!;
        stats.accuracy = 100;
        stats.totalItems = 10;
        stats.correctItems = 10;

        const eventPromise = new Promise(resolve => {
          manager.once(ReviewEventType.ACHIEVEMENT_UNLOCKED, resolve);
        });

        await manager.completeSession();

        const event = await eventPromise;
        expect(event).toMatchObject({
          type: ReviewEventType.ACHIEVEMENT_UNLOCKED,
          data: {
            achievementId: 'perfect_session',
            achievementName: 'Perfect Session'
          }
        });
      });
    });

    describe('abandonSession', () => {
      beforeEach(async () => {
        const items = MockFactory.createBulkContent(3);
        await manager.startSession({
          userId: 'user123',
          items,
          mode: ReviewMode.RECOGNITION
        });
      });

      it('should abandon session and clear state', async () => {
        await manager.abandonSession();

        expect(manager.getSession()).toBeNull();
        expect(manager.getStatistics()).toBeNull();
      });

      it('should emit SESSION_ABANDONED event', async () => {
        manager.getCurrentItem();
        await manager.nextItem();

        const eventPromise = new Promise(resolve => {
          manager.once(ReviewEventType.SESSION_ABANDONED, resolve);
        });

        await manager.abandonSession();

        const event = await eventPromise;
        expect(event).toMatchObject({
          type: ReviewEventType.SESSION_ABANDONED,
          data: {
            reason: 'user_action',
            currentIndex: 1,
            completionPercentage: expect.closeTo(33.33, 1)
          }
        });
      });

      it('should stop all timers', async () => {
        await manager.abandonSession();

        jest.advanceTimersByTime(10 * 60 * 1000);
        
        // No events should fire
        expect(manager.getSession()).toBeNull();
      });
    });
  });

  describe('Progress and Statistics', () => {
    beforeEach(async () => {
      const items = MockFactory.createBulkContent(10);
      await manager.startSession({
        userId: 'user123',
        items,
        mode: ReviewMode.RECOGNITION
      });
    });

    it('should calculate progress correctly', () => {
      const progress = manager.getProgress();
      
      expect(progress).toMatchObject({
        current: 0,
        total: 10,
        percentage: 0,
        timeElapsed: expect.any(Number),
        estimatedTimeRemaining: expect.any(Number)
      });
    });

    it('should update progress as items are completed', async () => {
      for (let i = 0; i < 5; i++) {
        manager.getCurrentItem();
        await manager.submitAnswer('test');
        if (i < 4) await manager.nextItem();
      }

      const progress = manager.getProgress();
      expect(progress).toMatchObject({
        current: 4,
        total: 10,
        percentage: 40
      });
    });

    it('should track performance by difficulty', async () => {
      // Set up items with different difficulties
      const session = manager.getSession()!;
      session.items[0].content.difficulty = 0.2; // Easy
      session.items[1].content.difficulty = 0.5; // Medium
      session.items[2].content.difficulty = 0.8; // Hard

      for (let i = 0; i < 3; i++) {
        manager.getCurrentItem();
        await manager.submitAnswer('test');
        session.items[i].correct = i < 2; // First two correct
        if (i < 2) await manager.nextItem();
      }

      const stats = manager.getStatistics()!;
      expect(stats.performanceByDifficulty).toMatchObject({
        easy: { correct: 1, total: 1 },
        medium: { correct: 1, total: 1 },
        hard: { correct: 0, total: 1 }
      });
    });

    it('should track streak correctly', async () => {
      const answers = [true, true, true, false, true, true];
      
      for (let i = 0; i < answers.length; i++) {
        manager.getCurrentItem();
        const session = manager.getSession()!;
        await manager.submitAnswer('test');
        session.items[i].correct = answers[i];
        
        if (i < answers.length - 1) await manager.nextItem();
      }

      const stats = manager.getStatistics()!;
      expect(stats.currentStreak).toBe(2);
      expect(stats.bestStreak).toBe(3);
    });

    it('should emit STREAK_UPDATED on milestone streaks', async () => {
      const eventPromise = new Promise(resolve => {
        manager.once(ReviewEventType.STREAK_UPDATED, resolve);
      });

      // Create a 5-answer streak
      for (let i = 0; i < 5; i++) {
        manager.getCurrentItem();
        const session = manager.getSession()!;
        await manager.submitAnswer('test');
        session.items[i].correct = true;
        
        if (i < 4) await manager.nextItem();
      }

      const event = await eventPromise;
      expect(event).toMatchObject({
        type: ReviewEventType.STREAK_UPDATED,
        data: {
          current: 5,
          best: 5,
          type: 'session'
        }
      });
    });
  });

  describe('Hint System', () => {
    beforeEach(async () => {
      const items = [
        createReviewableContent({ 
          id: 'item1',
          primaryAnswer: 'correct'
        })
      ];

      await manager.startSession({
        userId: 'user123',
        items,
        mode: ReviewMode.RECALL
      });

      manager.getCurrentItem();
    });

    it('should provide hints with progressive penalties', async () => {
      const hint1 = await manager.useHint();
      expect(hint1).toBeTruthy();

      const item = manager.getCurrentItem()!;
      expect(item.hintsUsed).toBe(1);

      const hint2 = await manager.useHint();
      expect(hint2).toBeTruthy();
      expect(item.hintsUsed).toBe(2);
    });

    it('should apply hint penalties to score', async () => {
      await manager.useHint(); // -10% penalty

      await manager.submitAnswer('correct');
      
      const item = manager.getCurrentItem()!;
      expect(item.finalScore).toBeLessThan(item.baseScore);
    });

    it('should emit ITEM_HINT_USED event', async () => {
      const eventPromise = new Promise(resolve => {
        manager.once(ReviewEventType.ITEM_HINT_USED, resolve);
      });

      await manager.useHint();

      const event = await eventPromise;
      expect(event).toMatchObject({
        type: ReviewEventType.ITEM_HINT_USED,
        data: {
          itemId: 'item1',
          hintLevel: 1,
          hintContent: expect.any(String),
          penaltyApplied: 0.1
        }
      });
    });
  });

  describe('Activity Timeout', () => {
    beforeEach(async () => {
      const items = MockFactory.createBulkContent(3);
      await manager.startSession({
        userId: 'user123',
        items,
        mode: ReviewMode.RECOGNITION
      });
    });

    it('should warn before timeout', async () => {
      const eventPromise = new Promise(resolve => {
        manager.once(ReviewEventType.TIMEOUT_WARNING, resolve);
      });

      // Advance to timeout warning
      jest.advanceTimersByTime(5 * 60 * 1000);

      const event = await eventPromise;
      expect(event).toMatchObject({
        type: ReviewEventType.TIMEOUT_WARNING,
        data: {
          timeRemaining: 60000,
          action: 'warning'
        }
      });
    });

    it('should auto-pause after final timeout', async () => {
      // Advance past warning
      jest.advanceTimersByTime(5 * 60 * 1000);
      
      // Advance to final timeout
      jest.advanceTimersByTime(60 * 1000);

      // Session should be paused
      const session = manager.getSession();
      expect(session?.status).toBe('paused');
    });

    it('should reset timer on user activity', async () => {
      // Advance partway to timeout
      jest.advanceTimersByTime(3 * 60 * 1000);

      // User activity
      manager.getCurrentItem();
      await manager.submitAnswer('test');

      // Timer should be reset
      jest.advanceTimersByTime(3 * 60 * 1000);
      expect(manager.getSession()?.status).toBe('active'); // Still active

      // Now advance to timeout
      jest.advanceTimersByTime(2 * 60 * 1000 + 1);
      
      // Should emit warning
      const eventPromise = new Promise(resolve => {
        manager.once(ReviewEventType.TIMEOUT_WARNING, resolve);
      });

      await expect(eventPromise).resolves.toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      mockStorage.saveSession.mockRejectedValue(new Error('Storage error'));

      const items = MockFactory.createBulkContent(3);
      
      await expect(manager.startSession({
        userId: 'user123',
        items,
        mode: ReviewMode.RECOGNITION
      })).rejects.toThrow('Failed to save session');
    });

    it('should handle analytics errors without breaking flow', async () => {
      mockAnalytics.trackSessionStart.mockRejectedValue(new Error('Analytics error'));
      
      const items = MockFactory.createBulkContent(3);
      
      // Should not throw - analytics errors are caught
      const session = await manager.startSession({
        userId: 'user123',
        items,
        mode: ReviewMode.RECOGNITION
      });

      expect(session).toBeDefined();
      expect(session.status).toBe('active');
    });

    it('should validate session state before operations', async () => {
      // No session started
      await expect(manager.submitAnswer('test')).rejects.toThrow('No active session');
      await expect(manager.skipItem()).rejects.toThrow('No active session');
      await expect(manager.pauseSession()).rejects.toThrow('No active session to pause');
      await expect(manager.resumeSession()).rejects.toThrow('No paused session to resume');
    });
  });

  describe('Spaced Repetition', () => {
    beforeEach(async () => {
      const items = [
        createReviewableContent({ 
          id: 'item1',
          primaryAnswer: 'correct'
        })
      ];

      await manager.startSession({
        userId: 'user123',
        items,
        mode: ReviewMode.RECALL,
        config: { spacedRepetition: true }
      });

      manager.getCurrentItem();
    });

    it('should update SRS intervals on correct answer', async () => {
      await manager.submitAnswer('correct', 4);

      const item = manager.getCurrentItem()!;
      expect(item.easeFactor).toBeDefined();
      expect(item.nextInterval).toBeDefined();
      expect(item.nextInterval).toBeGreaterThan(0);
    });

    it('should reset interval on incorrect answer', async () => {
      const item = manager.getCurrentItem()!;
      item.previousInterval = 6;
      item.easeFactor = 2.5;

      await manager.submitAnswer('wrong');

      expect(item.nextInterval).toBe(1); // Reset to 1
    });

    it('should adjust ease factor based on confidence', async () => {
      const item = manager.getCurrentItem()!;
      const initialEase = 2.5;
      item.easeFactor = initialEase;

      await manager.submitAnswer('correct', 5); // High confidence

      expect(item.easeFactor).toBeGreaterThan(initialEase);
    });
  });
});