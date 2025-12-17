/**
 * React hook for URE SessionManager
 * Provides React-friendly API for review sessions
 *
 * This hook wraps SessionManager with proper React lifecycle management,
 * state tracking, and automatic cleanup. It's the primary way features
 * should interact with the URE system.
 *
 * @example
 * ```typescript
 * const {
 *   state,
 *   startSession,
 *   submitAnswer,
 *   nextItem
 * } = useSessionManager({
 *   userId: user.uid,
 *   mode: 'recognition',
 *   content: reviewableContent,
 *   onComplete: (stats) => {
 *     console.log('Session complete!', stats);
 *   }
 * });
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SessionManager } from '@/lib/review-engine/session/manager';
import { LocalSessionStorage } from '@/lib/review-engine/session/storage';
import { MockAnalyticsService } from '@/lib/review-engine/session/analytics.service';
import { ReviewableContent } from '@/lib/review-engine/core/interfaces';
import { ReviewMode } from '@/lib/review-engine/core/types';
import {
  CreateSessionOptions,
  SessionStatistics,
  ReviewSessionItem
} from '@/lib/review-engine/core/session.types';
import { ReviewEventType } from '@/lib/review-engine/core/events';

export interface UseSessionManagerOptions {
  /** Authenticated user ID */
  userId: string;
  /** Review mode (recognition, recall, listening) */
  mode: ReviewMode;
  /** Content to review */
  content: ReviewableContent[];
  /** Callback when session completes */
  onComplete?: (statistics: SessionStatistics) => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
  /** Automatically start session on mount */
  autoStart?: boolean;
  /** Shuffle content order */
  shuffle?: boolean;
}

export interface SessionState {
  /** Whether session is currently active */
  isActive: boolean;
  /** Whether session is paused */
  isPaused: boolean;
  /** Whether session is completed */
  isCompleted: boolean;
  /** Current item being reviewed */
  currentItem: ReviewSessionItem | null;
  /** Progress information */
  progress: {
    current: number;
    total: number;
    percentage: number;
    correct: number;
    incorrect: number;
    skipped: number;
  };
  /** Session statistics */
  statistics: SessionStatistics | null;
  /** Error message if any */
  error: string | null;
}

/**
 * React hook for managing URE review sessions
 *
 * This hook provides a complete interface for starting, conducting, and
 * completing review sessions. It automatically handles:
 * - SessionManager lifecycle
 * - Event subscriptions
 * - State synchronization
 * - Error handling
 * - Cleanup on unmount
 *
 * @param options - Configuration options
 * @returns Session state and control methods
 */
export function useSessionManager({
  userId,
  mode,
  content,
  onComplete,
  onError,
  autoStart = false,
  shuffle = false
}: UseSessionManagerOptions) {
  const managerRef = useRef<SessionManager | null>(null);
  const [state, setState] = useState<SessionState>({
    isActive: false,
    isPaused: false,
    isCompleted: false,
    currentItem: null,
    progress: {
      current: 0,
      total: content.length,
      percentage: 0,
      correct: 0,
      incorrect: 0,
      skipped: 0
    },
    statistics: null,
    error: null
  });

  // Initialize SessionManager
  useEffect(() => {
    const storage = new LocalSessionStorage();
    const analytics = new MockAnalyticsService(true);
    managerRef.current = new SessionManager(storage, analytics);

    const manager = managerRef.current;

    // Subscribe to SESSION_STARTED event
    manager.on(ReviewEventType.SESSION_STARTED, () => {
      setState(prev => ({
        ...prev,
        isActive: true,
        isPaused: false,
        isCompleted: false,
        error: null
      }));
    });

    // Subscribe to SESSION_COMPLETED event
    manager.on(ReviewEventType.SESSION_COMPLETED, (event) => {
      setState(prev => ({
        ...prev,
        isActive: false,
        isCompleted: true,
        statistics: event.data.statistics
      }));
      if (onComplete) onComplete(event.data.statistics);
    });

    // Subscribe to SESSION_PAUSED event
    manager.on(ReviewEventType.SESSION_PAUSED, () => {
      setState(prev => ({ ...prev, isPaused: true }));
    });

    // Subscribe to SESSION_RESUMED event
    manager.on(ReviewEventType.SESSION_RESUMED, () => {
      setState(prev => ({ ...prev, isPaused: false }));
    });

    // Subscribe to PROGRESS_UPDATED event
    manager.on(ReviewEventType.PROGRESS_UPDATED, (event) => {
      setState(prev => ({
        ...prev,
        progress: {
          current: event.data.current,
          total: event.data.total,
          percentage: Math.round((event.data.current / event.data.total) * 100),
          correct: event.data.correct,
          incorrect: event.data.incorrect,
          skipped: event.data.skipped
        }
      }));
    });

    // Subscribe to ITEM_PRESENTED event
    manager.on(ReviewEventType.ITEM_PRESENTED, () => {
      const currentItem = manager.getCurrentItem();
      setState(prev => ({ ...prev, currentItem }));
    });

    // Subscribe to ERROR_OCCURRED event
    manager.on(ReviewEventType.ERROR_OCCURRED, (event) => {
      const error = event.data.error;
      setState(prev => ({ ...prev, error: String(error) }));
      if (onError) onError(error instanceof Error ? error : new Error(String(error)));
    });

    // Auto-start if requested
    if (autoStart) {
      startSession().catch(error => {
        console.error('[useSessionManager] Auto-start failed:', error);
      });
    }

    // Cleanup on unmount
    return () => {
      if (manager) {
        manager.removeAllListeners();
      }
    };
  }, [userId, mode, autoStart]); // Note: content not in deps to avoid re-init

  /**
   * Start a new review session
   */
  const startSession = useCallback(async () => {
    if (!managerRef.current) {
      throw new Error('SessionManager not initialized');
    }

    try {
      await managerRef.current.startSession({
        userId,
        mode,
        items: content,
        shuffle,
        source: 'manual',
        config: {
          mode,
          showPrimary: true,
          showSecondary: mode === 'recall',
          showTertiary: false,
          showMedia: mode === 'listening',
          inputType: mode === 'recall' ? 'text' : 'multiple-choice',
          optionCount: 4,
          allowHints: true,
          hintPenalty: 0.1,
          autoPlayAudio: mode === 'listening'
        }
      });

      const firstItem = managerRef.current.getCurrentItem();
      setState(prev => ({
        ...prev,
        isActive: true,
        isPaused: false,
        currentItem: firstItem
      }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({ ...prev, error: err.message }));
      if (onError) onError(err);
      throw err;
    }
  }, [userId, mode, content, shuffle, onError]);

  /**
   * Submit answer for current item
   *
   * @param answer - User's answer
   * @param confidence - Optional confidence level (1-5)
   * @returns Validation result
   */
  const submitAnswer = useCallback(async (
    answer: string,
    confidence?: 1 | 2 | 3 | 4 | 5
  ) => {
    if (!managerRef.current) {
      throw new Error('SessionManager not initialized');
    }
    return await managerRef.current.submitAnswer(answer, confidence);
  }, []);

  /**
   * Move to next item or complete session
   *
   * @returns Next item or null if session complete
   */
  const nextItem = useCallback(async () => {
    if (!managerRef.current) {
      throw new Error('SessionManager not initialized');
    }
    const next = await managerRef.current.nextItem();
    setState(prev => ({ ...prev, currentItem: next }));
    return next;
  }, []);

  /**
   * Skip current item
   */
  const skipItem = useCallback(async () => {
    if (!managerRef.current) {
      throw new Error('SessionManager not initialized');
    }
    await managerRef.current.skipItem();
  }, []);

  /**
   * Get hint for current item
   *
   * @returns Hint text
   */
  const useHint = useCallback(async (): Promise<string> => {
    if (!managerRef.current) {
      throw new Error('SessionManager not initialized');
    }
    return await managerRef.current.useHint();
  }, []);

  /**
   * Pause session
   */
  const pauseSession = useCallback(async () => {
    if (!managerRef.current) {
      throw new Error('SessionManager not initialized');
    }
    await managerRef.current.pauseSession();
  }, []);

  /**
   * Resume paused session
   */
  const resumeSession = useCallback(async () => {
    if (!managerRef.current) {
      throw new Error('SessionManager not initialized');
    }
    await managerRef.current.resumeSession();
  }, []);

  /**
   * Complete session manually
   *
   * @returns Final statistics
   */
  const completeSession = useCallback(async (): Promise<SessionStatistics> => {
    if (!managerRef.current) {
      throw new Error('SessionManager not initialized');
    }
    return await managerRef.current.completeSession();
  }, []);

  /**
   * Abandon session
   */
  const abandonSession = useCallback(async () => {
    if (!managerRef.current) {
      throw new Error('SessionManager not initialized');
    }
    await managerRef.current.abandonSession();
  }, []);

  return {
    /** Current session state */
    state,

    // Control methods
    /** Start a new session */
    startSession,
    /** Submit answer for current item */
    submitAnswer,
    /** Move to next item */
    nextItem,
    /** Skip current item */
    skipItem,
    /** Get hint for current item */
    useHint,
    /** Pause session */
    pauseSession,
    /** Resume paused session */
    resumeSession,
    /** Complete session manually */
    completeSession,
    /** Abandon session */
    abandonSession,

    // Advanced access
    /** Get underlying SessionManager instance (use with caution) */
    manager: managerRef.current,
    /** Get event emitter for custom listeners */
    getEventEmitter: () => managerRef.current
  };
}
