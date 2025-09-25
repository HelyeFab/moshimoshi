/**
 * useDrill Hook
 * Client-side hook for drill feature functionality
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useFeature } from './useFeature';
import type {
  DrillSession,
  DrillQuestion,
  DrillSettings,
  DrillResults,
  JapaneseWord,
  WordTypeFilter,
  DrillMode,
} from '@/types/drill';

interface UseDrillOptions {
  mode?: DrillMode;
  wordTypeFilter?: WordTypeFilter;
  selectedLists?: string[];
  questionsPerSession?: number;
  autoAdvance?: boolean;
}

interface UseDrillReturn {
  // Session state
  session: DrillSession | null;
  currentQuestion: DrillQuestion | null;
  isLoading: boolean;
  error: string | null;

  // Progress state
  score: number;
  currentIndex: number;
  totalQuestions: number;
  isComplete: boolean;

  // Actions
  startSession: () => Promise<boolean>;
  submitAnswer: (answer: string) => Promise<void>;
  nextQuestion: () => void;
  endSession: () => Promise<void>;
  resetSession: () => void;

  // Settings
  settings: DrillSettings;
  updateSettings: (settings: Partial<DrillSettings>) => void;

  // Entitlement
  canStart: boolean;
  remaining: number;
  checkAndStart: () => Promise<boolean>;
}

export function useDrill(options: UseDrillOptions = {}): UseDrillReturn {
  // Entitlement check
  const { checkAndTrack, canUse, remaining } = useFeature('conjugation_drill', {
    showToast: true,
    showModal: true,
  });

  // Session state
  const [session, setSession] = useState<DrillSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Progress state
  const [score, setScore] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  // Settings
  const [settings, setSettings] = useState<DrillSettings>({
    questionsPerSession: options.questionsPerSession || 10,
    autoAdvance: options.autoAdvance || false,
    showRules: false,
    wordTypeFilter: options.wordTypeFilter || 'all',
    drillMode: options.mode || 'random',
    selectedLists: options.selectedLists,
  });

  // Computed values
  const currentQuestion = session?.questions[currentIndex] || null;
  const totalQuestions = session?.questions.length || 0;
  const isComplete = currentIndex >= totalQuestions - 1 && showResult;

  /**
   * Start a new drill session
   */
  const startSession = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      // Check entitlement
      const canProceed = await checkAndTrack();
      if (!canProceed) {
        setError('Daily drill limit reached');
        return false;
      }

      // Create session via API
      const response = await fetch('/api/drill/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: settings.drillMode,
          wordTypeFilter: settings.wordTypeFilter,
          selectedLists: settings.selectedLists,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to start session');
      }

      setSession(data.data.session);
      setScore(0);
      setCurrentIndex(0);
      setShowResult(false);
      setSelectedAnswer(null);

      return true;
    } catch (err) {
      console.error('Error starting drill session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [checkAndTrack, settings]);

  /**
   * Submit an answer
   */
  const submitAnswer = useCallback(async (answer: string) => {
    if (!session || showResult) return;

    setSelectedAnswer(answer);
    setShowResult(true);

    const isCorrect = answer === currentQuestion?.correctAnswer;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    // Update session on server
    try {
      await fetch('/api/drill/session', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.id,
          action: 'answer',
          answer,
        }),
      });
    } catch (err) {
      console.error('Error submitting answer:', err);
    }

    // Auto-advance if enabled
    if (settings.autoAdvance && currentIndex < totalQuestions - 1) {
      setTimeout(() => {
        nextQuestion();
      }, 2000);
    }
  }, [session, showResult, currentQuestion, currentIndex, totalQuestions, settings.autoAdvance]);

  /**
   * Move to next question
   */
  const nextQuestion = useCallback(() => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowResult(false);
      setSelectedAnswer(null);
    }
  }, [currentIndex, totalQuestions]);

  /**
   * End the session
   */
  const endSession = useCallback(async () => {
    if (!session) return;

    try {
      await fetch('/api/drill/session', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.id,
          action: 'complete',
        }),
      });
    } catch (err) {
      console.error('Error ending session:', err);
    }
  }, [session]);

  /**
   * Reset session
   */
  const resetSession = useCallback(() => {
    setSession(null);
    setScore(0);
    setCurrentIndex(0);
    setShowResult(false);
    setSelectedAnswer(null);
    setError(null);
  }, []);

  /**
   * Update settings
   */
  const updateSettings = useCallback((newSettings: Partial<DrillSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  /**
   * Check entitlement and start
   */
  const checkAndStart = useCallback(async (): Promise<boolean> => {
    const canProceed = await checkAndTrack();
    if (canProceed) {
      return startSession();
    }
    return false;
  }, [checkAndTrack, startSession]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (session && !session.completedAt) {
        endSession();
      }
    };
  }, [session, endSession]);

  return {
    // Session state
    session,
    currentQuestion,
    isLoading,
    error,

    // Progress state
    score,
    currentIndex,
    totalQuestions,
    isComplete,

    // Actions
    startSession,
    submitAnswer,
    nextQuestion,
    endSession,
    resetSession,

    // Settings
    settings,
    updateSettings,

    // Entitlement
    canStart: canUse,
    remaining,
    checkAndStart,
  };
}

/**
 * Hook for getting practice words
 */
export function usePracticeWords(type: WordTypeFilter = 'all') {
  const [words, setWords] = useState<JapaneseWord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchWords = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/drill/words?type=${type}&limit=50`);
        const data = await response.json();

        if (data.success) {
          setWords(data.data.words);
        }
      } catch (error) {
        console.error('Error fetching practice words:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWords();
  }, [type]);

  return { words, isLoading };
}

/**
 * Hook for getting drill statistics
 */
export function useDrillStats() {
  const [stats, setStats] = useState<{
    totalSessions: number;
    averageScore: number;
    totalQuestions: number;
    accuracy: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/drill/session');
        const data = await response.json();

        if (data.success) {
          const sessions = data.data.sessions || [];
          const totalSessions = sessions.length;
          const completedSessions = sessions.filter((s: any) => s.completedAt);

          if (completedSessions.length > 0) {
            const totalScore = completedSessions.reduce((sum: number, s: any) => sum + s.score, 0);
            const totalQuestions = completedSessions.reduce((sum: number, s: any) => sum + s.questions.length, 0);

            setStats({
              totalSessions,
              averageScore: totalScore / completedSessions.length,
              totalQuestions,
              accuracy: totalQuestions > 0 ? (totalScore / totalQuestions) * 100 : 0,
            });
          } else {
            setStats({
              totalSessions: 0,
              averageScore: 0,
              totalQuestions: 0,
              accuracy: 0,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching drill stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, isLoading };
}