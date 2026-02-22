'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Target, Zap, Clock, CheckCircle, XCircle, Pause, Play, Timer } from 'lucide-react';
import type { FlashcardDeck, FlashcardContent, SessionSummary, SessionStats, PersistedStudySession } from '@/types/flashcards';
import { FlashcardViewer } from './FlashcardViewer';
import { useI18n } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { flashcardManager } from '@/lib/flashcards/FlashcardManager';
// Gamification removed - no achievements
import { sessionManager } from '@/lib/flashcards/SessionManager';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useBatchMediaHydration } from '@/hooks/useMediaHydration';
import Dialog from '@/components/ui/Dialog';
import { getFlashcardsDeviceId } from '@/lib/flashcards/deviceId';
import { weakCardsStore } from '@/lib/flashcards/weakCards';
import { mistakeReplayStore } from '@/lib/flashcards/mistakeReplay';

interface StudySessionProps {
  deck: FlashcardDeck;
  cards: FlashcardContent[];
  mode?: 'classic' | 'speed' | 'match';
  onComplete: (summary: SessionSummary) => void;
  onExit: () => void;
  onCardUpdated?: (card: FlashcardContent) => void;
  onDeckUpdated?: (deckId: string) => void;
  initialState?: PersistedStudySession | null;
}

export function StudySession({
  deck,
  cards,
  mode = 'classic',
  onComplete,
  onExit,
  onCardUpdated,
  onDeckUpdated,
  initialState
}: StudySessionProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isPremium } = useSubscription();

  const initialElapsedTime = initialState?.elapsedTime ?? 0;
  const initialPausedTime = initialState?.pausedTime ?? 0;
  const [currentIndex, setCurrentIndex] = useState(() => {
    const maxIndex = Math.max(0, cards.length - 1);
    const storedIndex = initialState?.currentIndex ?? 0;
    return Math.min(storedIndex, maxIndex);
  });
  const [sessionCards, setSessionCards] = useState(cards);
  const [correctCount, setCorrectCount] = useState(initialState?.correctCount ?? 0);
  const [incorrectCount, setIncorrectCount] = useState(initialState?.incorrectCount ?? 0);
  const [skippedCount, setSkippedCount] = useState(initialState?.skippedCount ?? 0);
  const [responses, setResponses] = useState<Map<string, { correct: boolean; difficulty?: string; responseTime: number }>>(
    () => new Map(initialState?.responses ?? [])
  );
  const [startTime] = useState(() => Date.now() - initialElapsedTime - initialPausedTime);
  const [elapsedTime, setElapsedTime] = useState(initialElapsedTime);
  const [isPaused, setIsPaused] = useState(initialState?.isPaused ?? false);
  const [pausedTime, setPausedTime] = useState(initialPausedTime);
  const [streakCount, setStreakCount] = useState(initialState?.streakCount ?? 0);
  const [bestStreak, setBestStreak] = useState(initialState?.bestStreak ?? 0);
  const [totalResponseTime, setTotalResponseTime] = useState(initialState?.totalResponseTime ?? 0);
  const [fastestResponseTime, setFastestResponseTime] = useState(initialState?.fastestResponseTime ?? Number.MAX_VALUE);
  const [slowestResponseTime, setSlowestResponseTime] = useState(initialState?.slowestResponseTime ?? 0);
  const [cardStartTime, setCardStartTime] = useState(Date.now());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [sessionFuriganaVisible, setSessionFuriganaVisible] = useState(false);
  const cardFlipMapRef = useRef<Map<string, boolean>>(new Map());
  const persistTimerRef = useRef<number | null>(null);
  const remotePersistTimerRef = useRef<number | null>(null);

  // Track card types
  const [newCardsStudied, setNewCardsStudied] = useState(initialState?.newCardsStudied ?? 0);
  const [learningCardsStudied, setLearningCardsStudied] = useState(initialState?.learningCardsStudied ?? 0);
  const [reviewCardsStudied, setReviewCardsStudied] = useState(initialState?.reviewCardsStudied ?? 0);

  // Cleanup refs for timers
  const timeoutRefs = useRef<Set<NodeJS.Timeout>>(new Set());
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmounted = useRef(false);
  const sessionKey = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const ownerId = deck.userId || user?.uid || 'guest';
    return `flashcards_active_session_${ownerId}`;
  }, [deck.userId, user?.uid]);

  const clearPersistedSession = useCallback(() => {
    if (!sessionKey || typeof window === 'undefined') return;
    localStorage.removeItem(sessionKey);
  }, [sessionKey]);

  useEffect(() => {
    setSessionFuriganaVisible(false);
  }, [deck.id]);

  const clearRemoteSession = useCallback(async () => {
    if (!isPremium || !deck.id) return;
    try {
      await fetch(`/api/flashcards/active-session?deckId=${encodeURIComponent(deck.id)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
    } catch (error) {
      console.warn('[StudySession] Failed to clear remote session:', error);
    }
  }, [deck.id, isPremium]);

  const handleExit = useCallback(() => {
    clearPersistedSession();
    clearRemoteSession();
    onExit();
  }, [clearPersistedSession, clearRemoteSession, onExit]);

  // Batch preload media for a window around the current card for smooth study experience
  // Use useMemo to prevent creating new array reference on every render (causes infinite loop)
  const cardsToPreload = useMemo(() => {
    const startIndex = Math.max(0, currentIndex - 2);
    return sessionCards.slice(startIndex, currentIndex + 5);
  }, [sessionCards, currentIndex]);
  const hydratedCardsMap = useBatchMediaHydration(cardsToPreload, cardsToPreload.length);

  // Get hydrated current card (or fallback to original if not yet hydrated)
  const currentCard = hydratedCardsMap.get(sessionCards[currentIndex]?.id) || sessionCards[currentIndex];
  const progress = ((currentIndex + 1) / sessionCards.length) * 100;
  const studyDirection = deck.settings?.studyDirection ?? 'front-to-back';
  const getInitialFlipForCard = useCallback((cardId: string) => {
    if (studyDirection === 'front-to-back') return false;
    if (studyDirection === 'back-to-front') return true;
    const existing = cardFlipMapRef.current.get(cardId);
    if (typeof existing === 'boolean') return existing;
    const randomFlip = Math.random() < 0.5;
    cardFlipMapRef.current.set(cardId, randomFlip);
    return randomFlip;
  }, [studyDirection]);

  // Celebrate milestones
  const celebrate = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b']
    });
  }, []);

  const handleResponse = useCallback(async (correct: boolean, difficulty?: 'again' | 'hard' | 'good' | 'easy') => {
    const responseTime = Date.now() - cardStartTime;

    // Track response metrics
    setTotalResponseTime(prev => prev + responseTime);
    setFastestResponseTime(prev => Math.min(prev, responseTime));
    setSlowestResponseTime(prev => Math.max(prev, responseTime));

    setResponses(prev => new Map(prev).set(currentCard.id, {
      correct,
      difficulty: difficulty || (correct ? 'good' : 'again'),
      responseTime
    }));

    // Track card type
    const cardStatus = currentCard.metadata?.status || 'new';
    switch (cardStatus) {
      case 'new':
        setNewCardsStudied(prev => prev + 1);
        break;
      case 'learning':
        setLearningCardsStudied(prev => prev + 1);
        break;
      case 'review':
      case 'mastered':
        setReviewCardsStudied(prev => prev + 1);
        break;
    }

    // Update counts
    if (correct) {
      setCorrectCount(prev => prev + 1);
      setStreakCount(prev => {
        const newStreak = prev + 1;
        setBestStreak(current => Math.max(current, newStreak));

        // Celebrate streaks
        if (newStreak === 5 || newStreak === 10 || newStreak === 20) {
          celebrate();
        }

        return newStreak;
      });
    } else {
      setIncorrectCount(prev => prev + 1);
      setStreakCount(0);
    }

    // Update card with SRS algorithm if user is logged in
    if (user && difficulty) {
      try {
        const updatedCard = await flashcardManager.updateCardAfterReview(
          deck.id,
          currentCard.id,
          difficulty,
          responseTime,
          user.uid,
          isPremium || false
        );

        if (updatedCard) {
          // Update the card in our session
          setSessionCards(prev => prev.map(card =>
            card.id === updatedCard.id ? updatedCard : card
          ));
          onCardUpdated?.(updatedCard);
        }
      } catch (error) {
        console.error('Failed to update card with SRS:', error);
      }
    }

    // Move to next card or complete
    if (currentIndex < sessionCards.length - 1) {
      const timeout = setTimeout(() => {
        if (!isUnmounted.current) {
          setCurrentIndex(prev => prev + 1);
          setCardStartTime(Date.now());
        }
      }, 500);
      timeoutRefs.current.add(timeout);
    } else {
      // Session complete
      completeSession();
    }
  }, [currentCard, currentIndex, sessionCards.length, cardStartTime, deck.id, user, isPremium, celebrate, onCardUpdated]);

  // Timer effect
  useEffect(() => {
    if (!isPaused) {
      timerIntervalRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime - pausedTime);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isPaused, startTime, pausedTime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmounted.current = true;
      // Clear all timers
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
      timeoutRefs.current.clear();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex < sessionCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setCardStartTime(Date.now());
    }
  }, [currentIndex, sessionCards.length]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setCardStartTime(Date.now());
    }
  }, [currentIndex]);

  const handleDeleteConfirm = useCallback(async () => {
    const cardToDelete = sessionCards[currentIndex];
    if (!cardToDelete) return;

    console.log('[StudySession.handleDeleteConfirm] Starting card deletion', {
      cardId: cardToDelete.id,
      deckId: deck.id,
      currentSessionCards: sessionCards.length
    });

    // Update session cards (remove from current session)
    const updatedSessionCards = sessionCards.filter(card => card.id !== cardToDelete.id);
    const newIndex = Math.min(currentIndex, Math.max(0, updatedSessionCards.length - 1));

    setSessionCards(updatedSessionCards);
    setCurrentIndex(newIndex);
    setShowDeleteDialog(false);

    console.log('[StudySession.handleDeleteConfirm] Session state updated', {
      newSessionCards: updatedSessionCards.length
    });

    if (updatedSessionCards.length === 0) {
      console.log('[StudySession.handleDeleteConfirm] No cards left, exiting session');
      handleExit();
      return;
    }

    try {
      console.log('[StudySession.handleDeleteConfirm] Calling deleteCardFromDeck...');

      // Delete card from the FULL deck using deleteCardFromDeck instead of updateDeck
      // This ensures we only remove the specific card, not replace with session cards
      const success = await flashcardManager.deleteCardFromDeck(
        deck.id,
        cardToDelete.id,
        user?.uid || 'guest',
        isPremium || false
      );

      console.log('[StudySession.handleDeleteConfirm] deleteCardFromDeck result:', success);

      if (!success) {
        console.error('[StudySession.handleDeleteConfirm] Card deletion failed!');
        return;
      }

      // Notify parent component to refresh deck data
      if (onDeckUpdated) {
        console.log('[StudySession.handleDeleteConfirm] Notifying parent of deck update');
        onDeckUpdated(deck.id);
      }

      if (isPremium && user?.uid) {
        console.log('[StudySession.handleDeleteConfirm] Persisting deletion to Firebase...');
        const response = await fetch(`/api/flashcards/decks/${deck.id}/deletions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cardId: cardToDelete.id }),
        });

        if (!response.ok) {
          console.warn('[StudySession.handleDeleteConfirm] Failed to persist deleted card:', response.status);
        } else {
          console.log('[StudySession.handleDeleteConfirm] Deletion persisted to Firebase');
        }
      }
    } catch (error) {
      console.error('[StudySession.handleDeleteConfirm] Failed to delete card from deck:', error);
    }
  }, [sessionCards, currentIndex, deck.id, user?.uid, isPremium, handleExit, onDeckUpdated]);

  const completeSession = useCallback(async () => {
    const sessionTime = Date.now() - startTime - pausedTime;
    const cardsActuallyStudied = responses.size;

    // Calculate accurate counts from responses Map to prevent sync issues
    const actualCorrectCount = Array.from(responses.values()).filter(r => r.correct).length;
    const actualIncorrectCount = Array.from(responses.values()).filter(r => !r.correct).length;
    // Clamp accuracy to [0, 1] range to prevent display bugs
    const accuracy = cardsActuallyStudied > 0
      ? Math.min(1, Math.max(0, actualCorrectCount / cardsActuallyStudied))
      : 0;

    // Big celebration for good performance
    if (accuracy >= 0.8) {
      celebrate();
    }

    // Calculate XP using centralized config
    const { xpConfigService } = await import('@/lib/services/XPConfigService');
    const fastCards = Array.from(responses.values()).filter(r => r.responseTime < 3000).length;
    const xpCalculation = xpConfigService.calculateFlashcardsXP(
      actualCorrectCount,
      bestStreak,
      accuracy === 1,
      fastCards
    );
    const totalXP = xpCalculation.cappedXP;

    const summary: SessionSummary = {
      sessionId: `session-${Date.now()}`,
      deckId: deck.id,
      cardsStudied: cardsActuallyStudied,
      correctAnswers: actualCorrectCount,
      accuracy,
      averageResponseTime: cardsActuallyStudied > 0 ? totalResponseTime / cardsActuallyStudied : 0,
      newCardsLearned: newCardsStudied,
      cardsReviewed: learningCardsStudied + reviewCardsStudied,
      streakMaintained: bestStreak >= deck.stats.currentStreak,
      xpEarned: totalXP,
      // Include for server-side XP calculation (must match client formula)
      bestStreak,
      fastCards,
    };

    const ownerId = deck.userId || user?.uid || 'guest';
    const weakCardEntries = sessionCards
      .map(card => {
        const response = responses.get(card.id);
        if (response?.difficulty === 'again' || response?.difficulty === 'hard') {
          return { cardId: card.id, difficulty: response.difficulty };
        }
        return null;
      })
      .filter(Boolean) as Array<{ cardId: string; difficulty: 'again' | 'hard' }>;
    const cappedEntries = weakCardEntries.slice(0, 200);
    weakCardsStore.save(ownerId, deck.id, cappedEntries);

    const mistakeCardIds = sessionCards
      .map(card => {
        const response = responses.get(card.id);
        if (!response) return null;
        if (!response.correct || response.difficulty === 'again' || response.difficulty === 'hard') {
          return card.id;
        }
        return null;
      })
      .filter(Boolean) as string[];
    if (mistakeCardIds.length > 0) {
      mistakeReplayStore.addSession(ownerId, deck.id, mistakeCardIds);
    }
    if (user && isPremium) {
      fetch('/api/flashcards/weak-cards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          deckId: deck.id,
          entries: cappedEntries,
        }),
      }).catch(() => {});
    }

    // Create detailed session stats for persistence
    if (user) {
      const sessionStats: SessionStats = {
        id: summary.sessionId,
        userId: user.uid,
        deckId: deck.id,
        deckName: deck.name,
        timestamp: startTime,
        duration: sessionTime,

        // Performance Metrics
        cardsStudied: cardsActuallyStudied,
        cardsCorrect: actualCorrectCount,
        cardsIncorrect: actualIncorrectCount,
        cardsSkipped: skippedCount,
        accuracy,

        // Card Type Breakdown
        newCards: newCardsStudied,
        learningCards: learningCardsStudied,
        reviewCards: reviewCardsStudied,

        // Response Metrics
        averageResponseTime: cardsActuallyStudied > 0 ? totalResponseTime / cardsActuallyStudied : 0,
        fastestResponseTime: fastestResponseTime === Number.MAX_VALUE ? 0 : fastestResponseTime,
        slowestResponseTime,

        // Progress Metrics
        xpEarned: totalXP,
        streakSnapshot: deck.stats.currentStreak,
        perfectSession: accuracy === 1,

        // Study Mode
        mode,
        settings: {
          sessionLength: deck.settings.sessionLength,
          reviewMode: deck.settings.reviewMode
        }
      };

      // Save session stats
      try {
        await flashcardManager.saveSessionStats(sessionStats, user.uid, isPremium || false);
      } catch (error) {
        console.error('❌ [StudySession] Failed to save session stats:', error);
      }

      // Note: Achievement checking is now handled by the gamification listener system
      // which responds to URE events and processes achievements server-side
    }

    clearPersistedSession();
    clearRemoteSession();
    onComplete(summary);
  }, [deck, sessionCards, responses, correctCount, incorrectCount, skippedCount,
      newCardsStudied, learningCardsStudied, reviewCardsStudied,
      streakCount, bestStreak, totalResponseTime, fastestResponseTime, slowestResponseTime,
      startTime, pausedTime, mode, user, isPremium, celebrate, onComplete, clearPersistedSession, clearRemoteSession]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Close shortcuts panel first if open, otherwise exit
        if (showShortcuts) {
          setShowShortcuts(false);
        } else {
          handleExit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleExit, showShortcuts]);

  // Close shortcuts panel when clicking outside (same as kanji mastery)
  useEffect(() => {
    if (!showShortcuts) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.shortcuts-panel') && !target.closest('.shortcuts-badge')) {
        setShowShortcuts(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showShortcuts]);

  useEffect(() => {
    if (!sessionKey || typeof window === 'undefined') return;

    if (persistTimerRef.current) {
      window.clearTimeout(persistTimerRef.current);
    }

    const buildPayload = (): PersistedStudySession => ({
      version: 1,
      userId: deck.userId || user?.uid || 'guest',
      deckId: deck.id,
      mode,
      cardIds: sessionCards.map(card => card.id),
      currentIndex,
      responses: Array.from(responses.entries()),
      correctCount,
      incorrectCount,
      skippedCount,
      newCardsStudied,
      learningCardsStudied,
      reviewCardsStudied,
      streakCount,
      bestStreak,
      totalResponseTime,
      fastestResponseTime,
      slowestResponseTime,
      elapsedTime,
      pausedTime,
      isPaused,
      savedAt: Date.now(),
    });

    const payload = buildPayload();
    persistTimerRef.current = window.setTimeout(() => {
      localStorage.setItem(sessionKey, JSON.stringify(payload));
    }, 200);

    if (isPremium) {
      if (remotePersistTimerRef.current) {
        window.clearTimeout(remotePersistTimerRef.current);
      }
      remotePersistTimerRef.current = window.setTimeout(() => {
        const deviceId = getFlashcardsDeviceId();
        fetch('/api/flashcards/active-session', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...payload,
            deviceId: deviceId || undefined
          }),
        }).catch(error => {
          console.warn('[StudySession] Failed to persist remote session:', error);
        });
      }, 5000);
    }

    return () => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
      }
      if (remotePersistTimerRef.current) {
        window.clearTimeout(remotePersistTimerRef.current);
      }
    };
  }, [
    sessionKey,
    deck.id,
    deck.userId,
    user?.uid,
    mode,
    sessionCards,
    currentIndex,
    responses,
    correctCount,
    incorrectCount,
    skippedCount,
    newCardsStudied,
    learningCardsStudied,
    reviewCardsStudied,
    streakCount,
    bestStreak,
    totalResponseTime,
    fastestResponseTime,
    slowestResponseTime,
    elapsedTime,
    pausedTime,
    isPaused,
    isPremium
  ]);

  useEffect(() => {
    if (!sessionKey || typeof window === 'undefined') return;

    const flushPersistedSession = () => {
      const payload: PersistedStudySession = {
        version: 1,
        userId: deck.userId || user?.uid || 'guest',
        deckId: deck.id,
        mode,
        cardIds: sessionCards.map(card => card.id),
        currentIndex,
        responses: Array.from(responses.entries()),
        correctCount,
        incorrectCount,
        skippedCount,
        newCardsStudied,
        learningCardsStudied,
        reviewCardsStudied,
        streakCount,
        bestStreak,
        totalResponseTime,
        fastestResponseTime,
        slowestResponseTime,
        elapsedTime,
        pausedTime,
        isPaused,
        savedAt: Date.now(),
      };

      localStorage.setItem(sessionKey, JSON.stringify(payload));
    };

    window.addEventListener('pagehide', flushPersistedSession);
    window.addEventListener('beforeunload', flushPersistedSession);

    return () => {
      window.removeEventListener('pagehide', flushPersistedSession);
      window.removeEventListener('beforeunload', flushPersistedSession);
    };
  }, [
    sessionKey,
    deck.id,
    deck.userId,
    user?.uid,
    mode,
    sessionCards,
    currentIndex,
    responses,
    correctCount,
    incorrectCount,
    skippedCount,
    newCardsStudied,
    learningCardsStudied,
    reviewCardsStudied,
    streakCount,
    bestStreak,
    totalResponseTime,
    fastestResponseTime,
    slowestResponseTime,
    elapsedTime,
    pausedTime,
    isPaused,
  ]);

  // Format time helper
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentCard) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-DEFAULT dark:from-dark-850 dark:to-dark-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-soft-white/80 dark:bg-dark-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          {/* Mobile: Stacked Layout */}
          <div className="sm:hidden space-y-2">
            {/* Row 1: Deck Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-xl flex-shrink-0">{deck.emoji}</span>
                <div className="min-w-0 flex-1">
                  <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{deck.name}</h1>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {currentIndex + 1} / {sessionCards.length}
                  </p>
                </div>
              </div>

              {/* Exit Button (mobile) */}
              <button
                onClick={handleExit}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors flex-shrink-0"
                aria-label={t('common.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Row 2: Stats */}
            <div className="flex items-center justify-between">
              {/* Timer */}
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-blue-500" />
                <span className="font-mono text-sm font-medium text-gray-700 dark:text-gray-300">
                  {formatTime(Math.floor(elapsedTime / 1000))}
                </span>
                <button
                  onClick={() => {
                    if (isPaused) {
                      setPausedTime(prev => prev + (Date.now() - (startTime + elapsedTime)));
                    }
                    setIsPaused(!isPaused);
                  }}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors"
                  aria-label={isPaused ? t('common.resume') : t('common.pause')}
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
              </div>

              {/* Accuracy */}
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {sessionCards.length > 0 ? Math.round((correctCount / (currentIndex + 1)) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Desktop: Single Row Layout */}
          <div className="hidden sm:flex items-center justify-between">
            {/* Deck Info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="text-2xl flex-shrink-0">{deck.emoji}</span>
              <div className="min-w-0 flex-1">
                <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{deck.name}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('flashcards.cardsStudied')}: {currentIndex + 1} / {sessionCards.length}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 flex-shrink-0">
              {/* Timer */}
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-blue-500" />
                <span className="font-mono text-sm font-medium text-gray-700 dark:text-gray-300">
                  {formatTime(Math.floor(elapsedTime / 1000))}
                </span>
                <button
                  onClick={() => {
                    if (isPaused) {
                      setPausedTime(prev => prev + (Date.now() - (startTime + elapsedTime)));
                    }
                    setIsPaused(!isPaused);
                  }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors"
                  aria-label={isPaused ? t('common.resume') : t('common.pause')}
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
              </div>

              {/* Streak */}
              {streakCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-2"
                >
                  <Zap className="w-5 h-5 text-yellow-500" />
                  <span className="font-bold text-yellow-600 dark:text-yellow-400">
                    {streakCount}x
                  </span>
                </motion.div>
              )}

              {/* Accuracy */}
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {sessionCards.length > 0 ? Math.round((correctCount / (currentIndex + 1)) * 100) : 0}%
                </span>
              </div>

              {/* Keyboard Shortcuts Badge - Desktop Only */}
              <div className="relative">
                <button
                  onClick={() => setShowShortcuts(!showShortcuts)}
                  className="shortcuts-badge flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors text-sm font-medium shadow-sm"
                  aria-label="Toggle keyboard shortcuts"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  <span>Shortcuts</span>
                </button>

                {/* Shortcuts Panel */}
                {showShortcuts && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="shortcuts-panel absolute top-full right-0 mt-2 bg-white dark:bg-dark-800 rounded-xl shadow-2xl border border-gray-200 dark:border-dark-700 p-4 w-80 z-50"
                  >
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Keyboard Shortcuts
                    </h3>
                    <div className="space-y-2">
                      {/* Navigation */}
                      <div className="border-b border-gray-200 dark:border-dark-700 pb-2 mb-2">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Navigation</p>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">Flip Card</span>
                            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded text-xs font-mono">Space</kbd>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">Previous Card</span>
                            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded text-xs font-mono">←</kbd>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">Next Card</span>
                            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded text-xs font-mono">→</kbd>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">Exit / Close Shortcuts</span>
                            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded text-xs font-mono">Esc</kbd>
                          </div>
                        </div>
                      </div>

                      {/* Grading */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Grading</p>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">Again</span>
                            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded text-xs font-mono">1</kbd>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">Hard</span>
                            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded text-xs font-mono">2</kbd>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">Good</span>
                            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded text-xs font-mono">3</kbd>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">Easy</span>
                            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded text-xs font-mono">4</kbd>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Exit Button */}
              <button
                onClick={handleExit}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors"
                aria-label={t('common.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-2 sm:mt-3 w-full bg-gray-200 dark:bg-dark-700 rounded-full h-1.5 sm:h-2 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary-400 to-purple-600"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ type: 'spring', damping: 20 }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentCard.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ type: 'spring', damping: 25 }}
          >
            <FlashcardViewer
              card={currentCard}
              cardStyle={deck.cardStyle}
              animationSpeed={deck.settings.animationSpeed}
              showHints={deck.settings.showHints}
              autoPlayAudio={deck.settings.autoPlay}
              isGraded={responses.has(currentCard.id)}
              initialIsFlipped={getInitialFlipForCard(currentCard.id)}
              furiganaSettings={deck.settings.furigana}
              furiganaVisible={sessionFuriganaVisible}
              onFuriganaVisibleChange={setSessionFuriganaVisible}
              onDelete={() => setShowDeleteDialog(true)}
              onNext={currentIndex < sessionCards.length - 1 ? handleNext : undefined}
              onPrevious={currentIndex > 0 ? handlePrevious : undefined}
              onResponse={handleResponse}
            />
          </motion.div>
        </AnimatePresence>

        <Dialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDeleteConfirm}
          title={t('flashcards.deleteCard')}
          message={t('flashcards.confirmDelete.card')}
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          type="danger"
        />

        {/* Response Feedback */}
        <AnimatePresence>
          {responses.has(currentCard.id) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -20 }}
              className="mt-8 flex justify-center"
            >
              {responses.get(currentCard.id)?.correct ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">{t('common.correct')}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                  <XCircle className="w-5 h-5" />
                  <span className="font-medium">{t('common.incorrect')}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
