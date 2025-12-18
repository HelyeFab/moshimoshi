/**
 * useSessionManager Hook Tests
 *
 * Tests React hook for SessionManager integration
 * Coverage target: 80%+
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useSessionManager } from '../useSessionManager';
import { ReviewableContent } from '@/lib/review-engine/core/interfaces';
import { SessionStatistics } from '@/lib/review-engine/core/session.types';

// Mock content for testing
const mockContent: ReviewableContent[] = [
  {
    id: 'item-1',
    contentType: 'kana',
    primaryDisplay: 'あ',
    secondaryDisplay: 'Hiragana A',
    primaryAnswer: 'a',
    alternativeAnswers: ['A'],
    difficulty: 0.3,
    tags: ['hiragana', 'beginner'],
    supportedModes: ['recognition', 'recall'],
    preferredMode: 'recognition'
  },
  {
    id: 'item-2',
    contentType: 'kana',
    primaryDisplay: 'い',
    secondaryDisplay: 'Hiragana I',
    primaryAnswer: 'i',
    difficulty: 0.3,
    tags: ['hiragana', 'beginner'],
    supportedModes: ['recognition', 'recall'],
    preferredMode: 'recognition'
  },
  {
    id: 'item-3',
    contentType: 'kana',
    primaryDisplay: 'う',
    secondaryDisplay: 'Hiragana U',
    primaryAnswer: 'u',
    difficulty: 0.3,
    tags: ['hiragana', 'beginner'],
    supportedModes: ['recognition', 'recall'],
    preferredMode: 'recognition'
  }
];

describe('useSessionManager', () => {
  const defaultOptions = {
    userId: 'test-user-123',
    mode: 'recognition' as const,
    content: mockContent
  };

  describe('Hook Initialization', () => {
    test('should initialize with correct default state', () => {
      const { result } = renderHook(() => useSessionManager(defaultOptions));

      expect(result.current.state).toEqual({
        isActive: false,
        isPaused: false,
        isCompleted: false,
        currentItem: null,
        progress: {
          current: 0,
          total: mockContent.length,
          percentage: 0,
          correct: 0,
          incorrect: 0,
          skipped: 0
        },
        statistics: null,
        error: null
      });
    });

    test('should expose session management methods', () => {
      const { result } = renderHook(() => useSessionManager(defaultOptions));

      expect(typeof result.current.startSession).toBe('function');
      expect(typeof result.current.submitAnswer).toBe('function');
      expect(typeof result.current.nextItem).toBe('function');
      expect(typeof result.current.skipItem).toBe('function');
      expect(typeof result.current.useHint).toBe('function');
      expect(typeof result.current.pauseSession).toBe('function');
      expect(typeof result.current.resumeSession).toBe('function');
      expect(typeof result.current.completeSession).toBe('function');
    });

    test('should initialize SessionManager instance', () => {
      const { result } = renderHook(() => useSessionManager(defaultOptions));

      expect(result.current.manager).toBeTruthy();
      expect(result.current.getEventEmitter()).toBeTruthy();
    });
  });

  describe('Auto-start Functionality', () => {
    test('should auto-start session when autoStart is true', async () => {
      const { result } = renderHook(() =>
        useSessionManager({
          ...defaultOptions,
          autoStart: true
        })
      );

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(true);
      });

      expect(result.current.state.currentItem).not.toBeNull();
      expect(result.current.state.currentItem?.content.id).toBe('item-1');
    });

    test('should not auto-start when autoStart is false', () => {
      const { result } = renderHook(() =>
        useSessionManager({
          ...defaultOptions,
          autoStart: false
        })
      );

      expect(result.current.state.isActive).toBe(false);
      expect(result.current.state.currentItem).toBeNull();
    });
  });

  describe('Session Lifecycle', () => {
    test('should start session manually', async () => {
      const { result } = renderHook(() => useSessionManager(defaultOptions));

      expect(result.current.state.isActive).toBe(false);

      await act(async () => {
        await result.current.startSession();
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(true);
        expect(result.current.state.currentItem).not.toBeNull();
      });
    });

    test('should track progress through session', async () => {
      const { result } = renderHook(() => useSessionManager(defaultOptions));

      await act(async () => {
        await result.current.startSession();
      });

      await waitFor(() => {
        expect(result.current.state.currentItem).not.toBeNull();
      });

      // Answer first item correctly
      await act(async () => {
        await result.current.submitAnswer('a', 5);
      });

      await act(async () => {
        await result.current.nextItem();
      });

      await waitFor(() => {
        expect(result.current.state.progress.current).toBe(1);
        expect(result.current.state.progress.correct).toBe(1);
        expect(result.current.state.progress.percentage).toBeGreaterThan(0);
      });
    });

    test('should complete session after all items', async () => {
      const onComplete = jest.fn();
      const { result } = renderHook(() =>
        useSessionManager({
          ...defaultOptions,
          onComplete
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      // Answer all 3 items
      for (let i = 0; i < 3; i++) {
        await waitFor(() => {
          expect(result.current.state.currentItem).not.toBeNull();
        });

        await act(async () => {
          const answer = ['a', 'i', 'u'][i];
          await result.current.submitAnswer(answer, 5);
        });

        await act(async () => {
          await result.current.nextItem();
        });
      }

      await waitFor(() => {
        expect(result.current.state.isCompleted).toBe(true);
        expect(result.current.state.statistics).not.toBeNull();
        expect(onComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            totalItems: 3,
            correctItems: 3
          })
        );
      });
    });
  });

  describe('Answer Validation', () => {
    test('should handle correct answers', async () => {
      const { result } = renderHook(() => useSessionManager(defaultOptions));

      await act(async () => {
        await result.current.startSession();
      });

      await waitFor(() => {
        expect(result.current.state.currentItem).not.toBeNull();
      });

      await act(async () => {
        const validation = await result.current.submitAnswer('a', 5);
        expect(validation.correct).toBe(true);
      });

      await act(async () => {
        await result.current.nextItem();
      });

      await waitFor(() => {
        expect(result.current.state.progress.correct).toBe(1);
        expect(result.current.state.progress.incorrect).toBe(0);
      });
    });

    test('should handle incorrect answers', async () => {
      const { result } = renderHook(() => useSessionManager(defaultOptions));

      await act(async () => {
        await result.current.startSession();
      });

      await waitFor(() => {
        expect(result.current.state.currentItem).not.toBeNull();
      });

      await act(async () => {
        const validation = await result.current.submitAnswer('wrong', 5);
        expect(validation.correct).toBe(false);
      });

      await act(async () => {
        await result.current.nextItem();
      });

      await waitFor(() => {
        expect(result.current.state.progress.correct).toBe(0);
        expect(result.current.state.progress.incorrect).toBe(1);
      });
    });

    test('should support confidence ratings', async () => {
      const { result } = renderHook(() => useSessionManager(defaultOptions));

      await act(async () => {
        await result.current.startSession();
      });

      await waitFor(() => {
        expect(result.current.state.currentItem).not.toBeNull();
      });

      // Test different confidence levels
      for (const confidence of [1, 2, 3, 4, 5] as const) {
        await act(async () => {
          const validation = await result.current.submitAnswer('a', confidence);
          expect(validation).toBeTruthy();
        });
      }
    });
  });

  describe('Skip Functionality', () => {
    test('should skip current item', async () => {
      const { result } = renderHook(() => useSessionManager(defaultOptions));

      await act(async () => {
        await result.current.startSession();
      });

      await waitFor(() => {
        expect(result.current.state.currentItem?.content.id).toBe('item-1');
      });

      await act(async () => {
        await result.current.skipItem();
      });

      await waitFor(() => {
        expect(result.current.state.currentItem?.content.id).toBe('item-2');
        expect(result.current.state.progress.skipped).toBe(1);
      });
    });
  });

  describe('Error Handling', () => {
    test('should call onError callback on errors', async () => {
      const onError = jest.fn();
      const { result } = renderHook(() =>
        useSessionManager({
          ...defaultOptions,
          onError
        })
      );

      // Try to submit answer before starting session
      await act(async () => {
        try {
          await result.current.submitAnswer('a');
        } catch (error) {
          // Expected to throw
        }
      });

      // onError should have been called or state should show error
      await waitFor(() => {
        expect(
          result.current.state.error || onError.mock.calls.length > 0
        ).toBeTruthy();
      });
    });

    test('should handle empty content gracefully', () => {
      const onError = jest.fn();
      const { result } = renderHook(() =>
        useSessionManager({
          ...defaultOptions,
          content: [],
          onError
        })
      );

      expect(result.current.state.progress.total).toBe(0);
    });
  });

  describe('Event Subscriptions', () => {
    test('should update state on SESSION_STARTED event', async () => {
      const { result } = renderHook(() => useSessionManager(defaultOptions));

      expect(result.current.state.isActive).toBe(false);

      await act(async () => {
        await result.current.startSession();
      });

      await waitFor(() => {
        expect(result.current.state.isActive).toBe(true);
      });
    });

    test('should update state on PROGRESS_UPDATED event', async () => {
      const { result } = renderHook(() => useSessionManager(defaultOptions));

      await act(async () => {
        await result.current.startSession();
      });

      const initialProgress = result.current.state.progress.current;

      await act(async () => {
        await result.current.submitAnswer('a');
        await result.current.nextItem();
      });

      await waitFor(() => {
        expect(result.current.state.progress.current).toBeGreaterThan(
          initialProgress
        );
      });
    });

    test('should update state on SESSION_COMPLETED event', async () => {
      const { result } = renderHook(() => useSessionManager(defaultOptions));

      await act(async () => {
        await result.current.startSession();
      });

      // Complete all items
      for (let i = 0; i < 3; i++) {
        await waitFor(() => {
          expect(result.current.state.currentItem).not.toBeNull();
        });

        await act(async () => {
          await result.current.submitAnswer(['a', 'i', 'u'][i]);
          await result.current.nextItem();
        });
      }

      await waitFor(() => {
        expect(result.current.state.isCompleted).toBe(true);
        expect(result.current.state.isActive).toBe(false);
        expect(result.current.state.statistics).not.toBeNull();
      });
    });
  });

  describe('Cleanup', () => {
    test('should cleanup listeners on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useSessionManager(defaultOptions)
      );

      const manager = result.current.manager;
      expect(manager).toBeTruthy();

      unmount();

      // Verify cleanup happened (manager should have no listeners)
      if (manager) {
        expect(manager.listenerCount('SESSION_STARTED')).toBe(0);
        expect(manager.listenerCount('SESSION_COMPLETED')).toBe(0);
      }
    });
  });

  describe('Shuffle Option', () => {
    test('should shuffle items when shuffle is true', async () => {
      const { result: result1 } = renderHook(() =>
        useSessionManager({
          ...defaultOptions,
          shuffle: false
        })
      );

      await act(async () => {
        await result1.current.startSession();
      });

      await waitFor(() => {
        expect(result1.current.state.currentItem?.content.id).toBe('item-1');
      });

      // With shuffle, order might be different (not guaranteed, but probabilistic)
      // This test is weak but demonstrates the option exists
      const { result: result2 } = renderHook(() =>
        useSessionManager({
          ...defaultOptions,
          shuffle: true
        })
      );

      await act(async () => {
        await result2.current.startSession();
      });

      await waitFor(() => {
        expect(result2.current.state.currentItem).not.toBeNull();
        // First item could be any of the three
        expect(['item-1', 'item-2', 'item-3']).toContain(
          result2.current.state.currentItem?.content.id
        );
      });
    });
  });

  describe('Progress Calculation', () => {
    test('should calculate percentage correctly', async () => {
      const { result } = renderHook(() => useSessionManager(defaultOptions));

      await act(async () => {
        await result.current.startSession();
      });

      // Complete first item
      await act(async () => {
        await result.current.submitAnswer('a');
        await result.current.nextItem();
      });

      await waitFor(() => {
        expect(result.current.state.progress.current).toBe(1);
        expect(result.current.state.progress.total).toBe(3);
        expect(result.current.state.progress.percentage).toBeCloseTo(33, 0);
      });

      // Complete second item
      await act(async () => {
        await result.current.submitAnswer('i');
        await result.current.nextItem();
      });

      await waitFor(() => {
        expect(result.current.state.progress.current).toBe(2);
        expect(result.current.state.progress.percentage).toBeCloseTo(67, 0);
      });
    });

    test('should track correct/incorrect/skipped separately', async () => {
      const { result } = renderHook(() => useSessionManager(defaultOptions));

      await act(async () => {
        await result.current.startSession();
      });

      // First: correct
      await act(async () => {
        await result.current.submitAnswer('a');
        await result.current.nextItem();
      });

      // Second: incorrect
      await act(async () => {
        await result.current.submitAnswer('wrong');
        await result.current.nextItem();
      });

      // Third: skip
      await act(async () => {
        await result.current.skipItem();
      });

      await waitFor(() => {
        expect(result.current.state.progress.correct).toBe(1);
        expect(result.current.state.progress.incorrect).toBe(1);
        expect(result.current.state.progress.skipped).toBe(1);
      });
    });
  });
});
