'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Target, Zap, Clock, CheckCircle, XCircle, Pause, Play, Timer } from 'lucide-react';
import type { FlashcardDeck, FlashcardContent, SessionSummary, SessionStats } from '@/types/flashcards';
import { FlashcardViewer } from './FlashcardViewer';
import { useI18n } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { flashcardManager } from '@/lib/flashcards/FlashcardManager';
import { achievementManager } from '@/lib/flashcards/AchievementManager';
import { sessionManager } from '@/lib/flashcards/SessionManager';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';

interface StudySessionProps {
  deck: FlashcardDeck;
  cards: FlashcardContent[];
  mode?: 'classic' | 'speed' | 'match';
  onComplete: (summary: SessionSummary) => void;
  onExit: () => void;
  onCardUpdated?: (card: FlashcardContent) => void;
}

export function StudySession({
  deck,
  cards,
  mode = 'classic',
  onComplete,
  onExit,
  onCardUpdated
}: StudySessionProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isPremium } = useSubscription();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionCards, setSessionCards] = useState(cards);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [responses, setResponses] = useState<Map<string, { correct: boolean; difficulty?: string; responseTime: number }>>(new Map());
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedTime, setPausedTime] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalResponseTime, setTotalResponseTime] = useState(0);
  const [fastestResponseTime, setFastestResponseTime] = useState(Number.MAX_VALUE);
  const [slowestResponseTime, setSlowestResponseTime] = useState(0);
  const [cardStartTime, setCardStartTime] = useState(Date.now());

  // Track card types
  const [newCardsStudied, setNewCardsStudied] = useState(0);
  const [learningCardsStudied, setLearningCardsStudied] = useState(0);
  const [reviewCardsStudied, setReviewCardsStudied] = useState(0);

  // Cleanup refs for timers
  const timeoutRefs = useRef<Set<NodeJS.Timeout>>(new Set());
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmounted = useRef(false);

  const currentCard = sessionCards[currentIndex];
  const progress = ((currentIndex + 1) / sessionCards.length) * 100;

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

  const completeSession = useCallback(async () => {
    const sessionTime = Date.now() - startTime - pausedTime;
    const cardsActuallyStudied = responses.size;
    const accuracy = cardsActuallyStudied > 0 ? correctCount / cardsActuallyStudied : 0;

    // Big celebration for good performance
    if (accuracy >= 0.8) {
      celebrate();
    }

    // Calculate XP with enhanced formula
    const baseXP = correctCount * 10;
    const streakBonus = bestStreak * 5;
    const perfectBonus = accuracy === 1 ? 50 : 0;
    const speedBonus = Math.floor(Array.from(responses.values()).filter(r => r.responseTime < 3000).length * 2);
    const totalXP = baseXP + streakBonus + perfectBonus + speedBonus;

    const summary: SessionSummary = {
      sessionId: `session-${Date.now()}`,
      deckId: deck.id,
      cardsStudied: cardsActuallyStudied,
      correctAnswers: correctCount,
      accuracy,
      averageResponseTime: cardsActuallyStudied > 0 ? totalResponseTime / cardsActuallyStudied : 0,
      newCardsLearned: newCardsStudied,
      cardsReviewed: learningCardsStudied + reviewCardsStudied,
      streakMaintained: bestStreak >= deck.stats.currentStreak,
      xpEarned: totalXP
    };

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
        cardsCorrect: correctCount,
        cardsIncorrect: incorrectCount,
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
        console.error('Failed to save session stats:', error);
      }

      // Check for achievements
      const newAchievements = achievementManager.checkSessionAchievements(user.uid, sessionStats);

      // Check comeback achievement
      const lastSession = await sessionManager.getUserSessions(user.uid, 1);
      if (lastSession.length > 0) {
        const daysSinceLastSession = Math.floor((Date.now() - lastSession[0].timestamp) / (1000 * 60 * 60 * 24));
        if (daysSinceLastSession >= 7) {
          const comebackAchievement = achievementManager.unlockAchievement(user.uid, 'comeback_kid');
          if (comebackAchievement) {
            newAchievements.push(comebackAchievement);
          }
        }
      }

      // Check marathon achievement (60+ minutes in a day)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const todaySessions = await sessionManager.getUserSessions(user.uid, undefined, today, tomorrow);
      const totalMinutesToday = todaySessions.reduce((sum, s) => sum + Math.floor(s.duration / 60000), 0);
      if (totalMinutesToday >= 60) {
        const marathonAchievement = achievementManager.unlockAchievement(user.uid, 'marathon');
        if (marathonAchievement) {
          newAchievements.push(marathonAchievement);
        }
      }

      // Check progress-based achievements
      const allDecks = await flashcardManager.getDecks(user.uid, isPremium || false);
      const totalCardsReviewed = allDecks.reduce((sum, d) => sum + (d.stats.totalCards || 0), 0);
      const totalMasteredCards = allDecks.reduce((sum, d) => sum + (d.stats.masteredCards || 0), 0);
      const streak = await sessionManager.calculateStreak(user.uid);

      const progressAchievements = await achievementManager.checkProgressAchievements(
        user.uid,
        {
          streak,
          totalCardsReviewed,
          totalMasteredCards,
          averageAccuracy: accuracy,
          totalDecksCreated: allDecks.length,
          totalMinutesStudied: totalMinutesToday
        }
      );

      newAchievements.push(...progressAchievements);

      // Add achievements to summary
      if (newAchievements.length > 0) {
        (summary as any).unlockedAchievements = newAchievements;
      }
    }

    onComplete(summary);
  }, [deck, sessionCards, responses, correctCount, incorrectCount, skippedCount,
      newCardsStudied, learningCardsStudied, reviewCardsStudied,
      streakCount, bestStreak, totalResponseTime, fastestResponseTime, slowestResponseTime,
      startTime, pausedTime, mode, user, isPremium, celebrate, onComplete]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExit();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onExit]);

  if (!currentCard) {
    return null;
  }

  // Format time helper
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-DEFAULT dark:from-dark-850 dark:to-dark-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-soft-white/80 dark:bg-dark-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Deck Info */}
            <div className="flex items-center gap-3">
              <span className="text-2xl">{deck.emoji}</span>
              <div>
                <h1 className="font-semibold text-gray-900 dark:text-gray-100">{deck.name}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('flashcards.cardsStudied')}: {currentIndex + 1} / {sessionCards.length}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 sm:gap-6">
              {/* Timer */}
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-blue-500" />
                <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
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
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {sessionCards.length > 0 ? Math.round((correctCount / (currentIndex + 1)) * 100) : 0}%
                </span>
              </div>

              {/* Exit Button */}
              <button
                onClick={onExit}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors"
                aria-label={t('common.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-3 w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2 overflow-hidden">
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
              onNext={currentIndex < sessionCards.length - 1 ? handleNext : undefined}
              onPrevious={currentIndex > 0 ? handlePrevious : undefined}
              onResponse={handleResponse}
            />
          </motion.div>
        </AnimatePresence>

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