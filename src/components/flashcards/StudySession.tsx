'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Target, Zap, Clock, CheckCircle, XCircle, Pause, Play, Timer, BookOpen, Shuffle, Loader2 } from 'lucide-react';
import type { FlashcardDeck, FlashcardContent, SessionSummary, SessionStats, PersistedStudySession, StudyMode } from '@/types/flashcards';
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
import Alert from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { getFlashcardsDeviceId } from '@/lib/flashcards/deviceId';
import { weakCardsStore } from '@/lib/flashcards/weakCards';
import { mistakeReplayStore } from '@/lib/flashcards/mistakeReplay';
import { startLocalFlashcardsAudioWarmup } from '@/lib/flashcards/audioWarmup';

interface StudySessionProps {
  deck: FlashcardDeck;
  cards: FlashcardContent[];
  mode?: StudyMode;
  followUpRound?: number;
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
  followUpRound = 0,
  onComplete,
  onExit,
  onCardUpdated,
  onDeckUpdated,
  initialState
}: StudySessionProps) {
  const SHUFFLE_ICON_MIN_MS = 450;
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
  const [answeredCardIndexes, setAnsweredCardIndexes] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    const resumedResponses = initialState?.responses ?? [];
    const answeredIds = new Set(resumedResponses.map(([cardId]) => cardId));
    cards.forEach((card, index) => {
      if (answeredIds.has(card.id)) {
        initial.add(index);
      }
    });
    return initial;
  });
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
  const [showModeHint, setShowModeHint] = useState(true);
  const [isShuffling, setIsShuffling] = useState(false);
  const [showShuffleComplete, setShowShuffleComplete] = useState(false);
  const [audioWarmupProgress, setAudioWarmupProgress] = useState<{
    phase: 'idle' | 'warming' | 'complete'
    completed: number
    total: number
  }>({ phase: 'idle', completed: 0, total: 0 });
  const cardFlipMapRef = useRef<Map<string, boolean>>(new Map());
  const shuffleCompleteTimerRef = useRef<number | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const remotePersistTimerRef = useRef<number | null>(null);
  const isPreviewMode = mode === 'preview';
  const isStudyMode = mode === 'study';
  const isNonSrsMode = isPreviewMode || isStudyMode;
  const hasNativeDeckAudio = useMemo(
    () =>
      sessionCards.some(card => {
        const metadata = card.metadata || {}
        const hasMetadataAudio =
          Boolean(metadata.audioUrl) ||
          Boolean(metadata.audioFilename) ||
          Boolean((metadata as { frontAudioUrl?: string }).frontAudioUrl) ||
          Boolean((metadata as { backAudioUrl?: string }).backAudioUrl) ||
          Boolean((metadata as { frontAudioFilename?: string }).frontAudioFilename) ||
          Boolean((metadata as { backAudioFilename?: string }).backAudioFilename)

        if (hasMetadataAudio) return true

        const hasFrontAudio =
          typeof card.front !== 'string' && card.front?.media?.type === 'audio'
        const hasBackAudio =
          typeof card.back !== 'string' && card.back?.media?.type === 'audio'
        if (hasFrontAudio || hasBackAudio) return true

        const mediaKeys = (card as { media?: string[] }).media
        if (Array.isArray(mediaKeys) && mediaKeys.some(key => /\.(mp3|m4a|wav|ogg)$/i.test(key))) {
          return true
        }

        const frontText = typeof card.front === 'string' ? card.front : card.front?.text || ''
        const backText = typeof card.back === 'string' ? card.back : card.back?.text || ''
        return /\[sound:[^\]]+\]/i.test(frontText) || /\[sound:[^\]]+\]/i.test(backText)
      }),
    [sessionCards]
  )

  // Track card types
  const [newCardsStudied, setNewCardsStudied] = useState(initialState?.newCardsStudied ?? 0);
  const [learningCardsStudied, setLearningCardsStudied] = useState(initialState?.learningCardsStudied ?? 0);
  const [reviewCardsStudied, setReviewCardsStudied] = useState(initialState?.reviewCardsStudied ?? 0);

  // Cleanup refs for timers
  const timeoutRefs = useRef<Set<number | NodeJS.Timeout>>(new Set());
  const timerIntervalRef = useRef<number | NodeJS.Timeout | null>(null);
  const isUnmounted = useRef(false);
  const sessionCompletedRef = useRef(false);
  const exitInProgressRef = useRef(false);
  const sessionKey = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const ownerId = deck.userId || user?.uid || 'guest';
    return `flashcards_active_session_${ownerId}`;
  }, [deck.userId, user?.uid]);

  const clearPersistedSession = useCallback(() => {
    if (!sessionKey || typeof window === 'undefined') return;
    localStorage.removeItem(sessionKey);
  }, [sessionKey]);

  const shuffleRemainingCards = useCallback(() => {
    if (isShuffling || currentIndex >= sessionCards.length - 1) return;

    const beforeOrder = sessionCards.map((card, index) => ({
      index,
      id: card.id,
      front: typeof card.front === 'string' ? card.front.slice(0, 40) : card.front?.text?.slice(0, 40),
    }));
    console.log(
      '%c[StudySession] Current deck order (before shuffle)',
      'color: #facc15; font-weight: 700;',
      beforeOrder
    );

    const shuffleStartedAt = performance.now();
    setIsShuffling(true);

    const timeout = window.setTimeout(() => {
      try {
        if (isUnmounted.current) return;

        const head = sessionCards.slice(0, currentIndex + 1);
        const tail = [...sessionCards.slice(currentIndex + 1)];
        for (let i = tail.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [tail[i], tail[j]] = [tail[j], tail[i]];
        }

        const nextCards = [...head, ...tail];
        setSessionCards(nextCards);

        const answeredIds = new Set(responses.keys());
        const remappedAnsweredIndexes = new Set<number>();
        nextCards.forEach((card, index) => {
          if (answeredIds.has(card.id)) {
            remappedAnsweredIndexes.add(index);
          }
        });
        setAnsweredCardIndexes(remappedAnsweredIndexes);

        const afterOrder = nextCards.map((card, index) => ({
          index,
          id: card.id,
          front: typeof card.front === 'string' ? card.front.slice(0, 40) : card.front?.text?.slice(0, 40),
        }));
        console.log(
          '%c[StudySession] Shuffled deck order (after shuffle)',
          'color: #60a5fa; font-weight: 700;',
          afterOrder
        );
        if (shuffleCompleteTimerRef.current) {
          window.clearTimeout(shuffleCompleteTimerRef.current);
        }
        setShowShuffleComplete(true);
        shuffleCompleteTimerRef.current = window.setTimeout(() => {
          if (!isUnmounted.current) {
            setShowShuffleComplete(false);
          }
          shuffleCompleteTimerRef.current = null;
        }, 1400);
      } catch (error) {
        console.error('[StudySession] Shuffle failed:', error);
      } finally {
        const elapsed = performance.now() - shuffleStartedAt;
        const remaining = Math.max(0, SHUFFLE_ICON_MIN_MS - elapsed);
        const resetTimeout = window.setTimeout(() => {
          if (!isUnmounted.current) {
            setIsShuffling(false);
          }
        }, remaining);
        timeoutRefs.current.add(resetTimeout);
      }
    }, 80);
    timeoutRefs.current.add(timeout);
  }, [currentIndex, sessionCards, responses, isShuffling, SHUFFLE_ICON_MIN_MS]);

  useEffect(() => {
    setSessionFuriganaVisible(false);
  }, [deck.id]);

  useEffect(() => {
    if (!isNonSrsMode || sessionCards.length === 0) return;

    const cancelWarmup = startLocalFlashcardsAudioWarmup({
      deckId: deck.id,
      deckUpdatedAt: deck.updatedAt,
      cards: sessionCards,
      enabled: !hasNativeDeckAudio,
      onProgress: setAudioWarmupProgress,
    });

    return cancelWarmup;
  }, [deck.id, deck.updatedAt, sessionCards, isNonSrsMode, hasNativeDeckAudio]);

  useEffect(() => {
    if (!isNonSrsMode) {
      setAudioWarmupProgress({ phase: 'idle', completed: 0, total: 0 });
    }
  }, [isNonSrsMode]);

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

  const persistPartialSessionIfNeeded = useCallback(async () => {
    if (sessionCompletedRef.current) return;
    if (!user || isNonSrsMode) return;

    const cardsActuallyStudied = responses.size;
    if (cardsActuallyStudied <= 0) return;

    const sessionTime = Date.now() - startTime - pausedTime;
    const actualCorrectCount = Array.from(responses.values()).filter(r => r.correct).length;
    const actualIncorrectCount = Array.from(responses.values()).filter(r => !r.correct).length;
    const accuracy = Math.min(1, Math.max(0, actualCorrectCount / cardsActuallyStudied));

    const sessionStats: SessionStats = {
      id: `session-partial-${Date.now()}`,
      userId: user.uid,
      deckId: deck.id,
      deckName: deck.name,
      timestamp: startTime,
      duration: sessionTime,
      cardsStudied: cardsActuallyStudied,
      cardsCorrect: actualCorrectCount,
      cardsIncorrect: actualIncorrectCount,
      cardsSkipped: skippedCount,
      accuracy,
      newCards: newCardsStudied,
      learningCards: learningCardsStudied,
      reviewCards: reviewCardsStudied,
      averageResponseTime: cardsActuallyStudied > 0 ? totalResponseTime / cardsActuallyStudied : 0,
      fastestResponseTime: fastestResponseTime === Number.MAX_VALUE ? 0 : fastestResponseTime,
      slowestResponseTime,
      xpEarned: 0,
      streakSnapshot: deck.stats.currentStreak,
      perfectSession: accuracy === 1,
      mode,
      settings: {
        sessionLength: deck.settings.sessionLength,
        reviewMode: deck.settings.reviewMode
      }
    };

    try {
      await flashcardManager.saveSessionStats(sessionStats, user.uid, isPremium || false);
    } catch (error) {
      console.error('❌ [StudySession] Failed to save partial session stats:', error);
    }
  }, [
    user,
    isNonSrsMode,
    responses,
    startTime,
    pausedTime,
    deck,
    skippedCount,
    newCardsStudied,
    learningCardsStudied,
    reviewCardsStudied,
    totalResponseTime,
    fastestResponseTime,
    slowestResponseTime,
    mode,
    isPremium
  ]);

  const handleExit = useCallback(async () => {
    if (exitInProgressRef.current) return;
    exitInProgressRef.current = true;
    try {
      await persistPartialSessionIfNeeded();
      clearPersistedSession();
      await clearRemoteSession();
      onExit();
    } finally {
      exitInProgressRef.current = false;
    }
  }, [persistPartialSessionIfNeeded, clearPersistedSession, clearRemoteSession, onExit]);

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
    // Prevent duplicate taps from recording multiple answers for the same card.
    if (answeredCardIndexes.has(currentIndex)) {
      return;
    }

    const responseTime = Date.now() - cardStartTime;
    setAnsweredCardIndexes(prev => {
      const next = new Set(prev);
      next.add(currentIndex);
      return next;
    });

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

    // Preview/study modes are exposure/guided practice and should not mutate SRS scheduling.
    if (!isNonSrsMode && user && difficulty) {
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
      }, isNonSrsMode ? 250 : 500);
      timeoutRefs.current.add(timeout);
    } else {
      if (isStudyMode) {
        // Let state updates flush before computing follow-up drill data in Study mode.
        const timeout = setTimeout(() => {
          if (!isUnmounted.current) {
            completeSession();
          }
        }, 0);
        timeoutRefs.current.add(timeout);
      } else {
        completeSession();
      }
    }
  }, [answeredCardIndexes, responses, currentCard, currentIndex, sessionCards.length, cardStartTime, deck.id, user, isPremium, celebrate, onCardUpdated, isNonSrsMode, isStudyMode]);

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
    // In React Strict Mode (dev), cleanup can run during mount simulation.
    // Always reset this flag on effect init so runtime checks stay accurate.
    isUnmounted.current = false;

    return () => {
      isUnmounted.current = true;
      // Clear all timers
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
      timeoutRefs.current.clear();
      if (shuffleCompleteTimerRef.current) {
        window.clearTimeout(shuffleCompleteTimerRef.current);
        shuffleCompleteTimerRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

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
    if (sessionCompletedRef.current) {
      return;
    }
    sessionCompletedRef.current = true;

    const sessionTime = Date.now() - startTime - pausedTime;
    const cardsActuallyStudied = isNonSrsMode
      ? Math.max(0, Math.min(sessionCards.length, Math.max(responses.size, currentIndex + 1)))
      : responses.size;

    // Calculate accurate counts from responses Map to prevent sync issues
    const actualCorrectCount = Array.from(responses.values()).filter(r => r.correct).length;
    const actualIncorrectCount = Array.from(responses.values()).filter(r => !r.correct).length;
    // Clamp accuracy to [0, 1] range to prevent display bugs
    const accuracy = cardsActuallyStudied > 0
      ? Math.min(1, Math.max(0, actualCorrectCount / cardsActuallyStudied))
      : 0;

    // Big celebration for good performance
    if (!isNonSrsMode && accuracy >= 0.8) {
      celebrate();
    }

    // Calculate XP using centralized config
    const fastCards = isNonSrsMode
      ? 0
      : Array.from(responses.values()).filter(r => r.responseTime < 3000).length;
    const totalXP = isNonSrsMode
      ? 0
      : (await import('@/lib/services/XPConfigService'))
          .xpConfigService
          .calculateFlashcardsXP(
            actualCorrectCount,
            bestStreak,
            accuracy === 1,
            fastCards
          ).cappedXP;

    const againCardIds = sessionCards
      .map(card => {
        const response = responses.get(card.id);
        return response?.difficulty === 'again' ? card.id : null;
      })
      .filter(Boolean) as string[];
    const hardCardIds = sessionCards
      .map(card => {
        const response = responses.get(card.id);
        return response?.difficulty === 'hard' ? card.id : null;
      })
      .filter(Boolean) as string[];
    const studyFollowUpCardIds = isStudyMode
      ? Array.from(new Set([...againCardIds, ...hardCardIds]))
      : [];

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
      studyFollowUpCardIds,
    };

    const shouldPersistPracticeSignals = !isPreviewMode;
    if (shouldPersistPracticeSignals) {
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

      const mistakeCardIds = isStudyMode
        ? againCardIds
        : (sessionCards
            .map(card => {
              const response = responses.get(card.id);
              if (!response) return null;
              if (!response.correct || response.difficulty === 'again' || response.difficulty === 'hard') {
                return card.id;
              }
              return null;
            })
            .filter(Boolean) as string[]);
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
    }

    // Create detailed session stats for persistence
    if (user && !isNonSrsMode) {
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
      startTime, pausedTime, mode, user, isPremium, celebrate, onComplete, clearPersistedSession, clearRemoteSession, isNonSrsMode, isPreviewMode, isStudyMode, currentIndex]);

  useEffect(() => {
    if (!isStudyMode) return;
    const isLastCard = currentIndex === sessionCards.length - 1;
    if (!isLastCard) return;
    if (!answeredCardIndexes.has(currentIndex)) return;
    void completeSession();
  }, [currentIndex, sessionCards.length, answeredCardIndexes, completeSession, isStudyMode]);

  const handleNext = useCallback(() => {
    if (currentIndex < sessionCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setCardStartTime(Date.now());
      return;
    }
    if (isNonSrsMode) {
      completeSession();
    }
  }, [currentIndex, sessionCards.length, completeSession, isNonSrsMode]);

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

  const modeBadgeLabel = isPreviewMode
    ? t('flashcards.modes.preview.name')
    : isStudyMode
      ? t('flashcards.modes.study.name')
      : null;
  const modeHintText = isPreviewMode
    ? t('flashcards.modes.preview.description')
    : isStudyMode
      ? t('flashcards.modes.study.description')
      : null;

  useEffect(() => {
    if (!modeHintText) {
      setShowModeHint(false);
      return;
    }

    setShowModeHint(true);
    const timeout = window.setTimeout(() => {
      setShowModeHint(false);
    }, 4500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [deck.id, mode, modeHintText]);

  if (!currentCard) {
    return null;
  }

  const answeredCount = correctCount + incorrectCount;
  const answeredCorrectCount = correctCount;
  const accuracyPercent = answeredCount > 0 ? Math.round((answeredCorrectCount / answeredCount) * 100) : 0;

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
                  {modeBadgeLabel && (
                    <p className="text-[11px] text-primary-600 dark:text-primary-400">
                      {modeBadgeLabel}
                    </p>
                  )}
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
                <button
                  onClick={shuffleRemainingCards}
                  disabled={isShuffling || currentIndex >= sessionCards.length - 1}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label={t('common.shuffle')}
                  title={t('common.shuffle')}
                >
                  {isShuffling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
                </button>
              </div>

              {/* Accuracy */}
              <div className="flex items-center gap-2">
                {isPreviewMode ? (
                  <>
                    <BookOpen className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('flashcards.modes.preview.name')}
                    </span>
                  </>
                ) : (
                  <>
                    <Target className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {accuracyPercent}%
                    </span>
                  </>
                )}
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
                {modeBadgeLabel && (
                  <p className="text-xs text-primary-600 dark:text-primary-400">
                    {modeBadgeLabel}
                  </p>
                )}
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
                <button
                  onClick={shuffleRemainingCards}
                  disabled={isShuffling || currentIndex >= sessionCards.length - 1}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label={t('common.shuffle')}
                  title={t('common.shuffle')}
                >
                  {isShuffling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
                </button>
              </div>

              {/* Streak */}
              {!isNonSrsMode && streakCount > 0 && (
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
                {isPreviewMode ? (
                  <>
                    <BookOpen className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('flashcards.modes.preview.name')}
                    </span>
                  </>
                ) : (
                  <>
                    <Target className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {accuracyPercent}%
                    </span>
                  </>
                )}
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
                      {!isNonSrsMode && (
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
                      )}
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
              isGraded={answeredCardIndexes.has(currentIndex)}
              initialIsFlipped={getInitialFlipForCard(currentCard.id)}
              furiganaSettings={deck.settings.furigana}
              furiganaVisible={sessionFuriganaVisible}
              onFuriganaVisibleChange={setSessionFuriganaVisible}
              onDelete={() => setShowDeleteDialog(true)}
              onNext={currentIndex < sessionCards.length - 1 || isNonSrsMode ? handleNext : undefined}
              onPrevious={currentIndex > 0 ? handlePrevious : undefined}
              onResponse={!isNonSrsMode ? handleResponse : undefined}
            />
          </motion.div>
        </AnimatePresence>

        {isNonSrsMode && audioWarmupProgress.phase === 'warming' && audioWarmupProgress.total > 0 && (
          <div className="mt-6 max-w-sm mx-auto">
            <Alert
              type="info"
              showDoshi
              doshiMood="thinking"
              title={t('flashcards.audioWarmup.title')}
              message={t('flashcards.audioWarmup.message')}
              className="mb-2"
            />
            <ProgressBar
              value={Math.min(audioWarmupProgress.completed, audioWarmupProgress.total)}
              max={audioWarmupProgress.total}
              color="blue"
              animated
              striped
              showValue
              label={t('flashcards.audioWarmup.progress', {
                current: Math.min(audioWarmupProgress.completed, audioWarmupProgress.total),
                total: audioWarmupProgress.total,
              })}
            />
          </div>
        )}

        {isShuffling && (
          <div className="mt-6 max-w-sm mx-auto rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50/90 dark:bg-blue-950/40 px-4 py-3">
            <div className="flex items-start gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-300 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  {t('flashcards.shuffleStatus.title')}
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200/90">
                  {t('flashcards.shuffleStatus.message')}
                </p>
              </div>
            </div>
          </div>
        )}

        {showShuffleComplete && !isShuffling && (
          <div className="mt-6 max-w-sm mx-auto rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/90 dark:bg-emerald-950/40 px-4 py-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-300 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  {t('flashcards.shuffleStatus.doneTitle')}
                </p>
                <p className="text-sm text-emerald-800 dark:text-emerald-200/90">
                  {t('flashcards.shuffleStatus.doneMessage')}
                </p>
              </div>
            </div>
          </div>
        )}

        {modeHintText && showModeHint && (
          <div className="mt-6 max-w-sm mx-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-dark-800/80 px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
            {modeHintText}
          </div>
        )}

        {isStudyMode && followUpRound > 0 && (
          <div className="mt-3 max-w-sm mx-auto rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              {t('flashcards.studyFollowUp.title', { round: followUpRound })}
            </p>
            <p className="mt-1 text-amber-800 dark:text-amber-300">
              {t('flashcards.studyFollowUp.cardsLeft', { count: sessionCards.length })}
            </p>
          </div>
        )}

        {isStudyMode && (
          <div className="mt-6 max-w-sm mx-auto flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => handleResponse(false, 'again')}
              disabled={answeredCardIndexes.has(currentIndex)}
              className="px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors font-medium text-sm"
            >
              {t('flashcards.markIncorrect')}
            </button>
            <button
              onClick={() => handleResponse(false, 'hard')}
              disabled={answeredCardIndexes.has(currentIndex)}
              className="px-4 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors font-medium text-sm"
            >
              {t('flashcards.difficulty.hard')}
            </button>
            <button
              onClick={() => handleResponse(true, 'good')}
              disabled={answeredCardIndexes.has(currentIndex)}
              className="px-4 py-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors font-medium text-sm"
            >
              {t('flashcards.markCorrect')}
            </button>
          </div>
        )}

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
          {answeredCardIndexes.has(currentIndex) && !isPreviewMode && (
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
