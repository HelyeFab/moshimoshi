'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Target, Zap, Clock, CheckCircle, XCircle } from 'lucide-react';
import type { FlashcardDeck, FlashcardContent, SessionSummary } from '@/types/flashcards';
import { FlashcardViewer } from './FlashcardViewer';
import { useI18n } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface StudySessionProps {
  deck: FlashcardDeck;
  cards: FlashcardContent[];
  mode?: 'classic' | 'speed' | 'match';
  onComplete: (summary: SessionSummary) => void;
  onExit: () => void;
}

export function StudySession({
  deck,
  cards,
  mode = 'classic',
  onComplete,
  onExit
}: StudySessionProps) {
  const { t } = useI18n();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionCards, setSessionCards] = useState(cards);
  const [correctCount, setCorrectCount] = useState(0);
  const [responses, setResponses] = useState<Map<string, boolean>>(new Map());
  const [startTime] = useState(Date.now());
  const [streakCount, setStreakCount] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalResponseTime, setTotalResponseTime] = useState(0);
  const [cardStartTime, setCardStartTime] = useState(Date.now());

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

  const handleResponse = useCallback((correct: boolean, difficulty?: 'again' | 'hard' | 'good' | 'easy') => {
    const responseTime = Date.now() - cardStartTime;
    setTotalResponseTime(prev => prev + responseTime);
    setResponses(prev => new Map(prev).set(currentCard.id, correct));

    if (correct) {
      setCorrectCount(prev => prev + 1);
      setStreakCount(prev => {
        const newStreak = prev + 1;
        setBestStreak(current => Math.max(current, newStreak));

        // Celebrate streaks
        if (newStreak === 5) {
          celebrate();
        } else if (newStreak === 10) {
          celebrate();
        }

        return newStreak;
      });
    } else {
      setStreakCount(0);
    }

    // Move to next card or complete
    if (currentIndex < sessionCards.length - 1) {
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setCardStartTime(Date.now());
      }, 500);
    } else {
      // Session complete
      completeSession();
    }
  }, [currentCard, currentIndex, sessionCards.length, cardStartTime, celebrate]);

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

  const completeSession = useCallback(() => {
    const sessionTime = Date.now() - startTime;
    const accuracy = correctCount / sessionCards.length;

    // Big celebration for good performance
    if (accuracy >= 0.8) {
      celebrate();
    }

    const summary: SessionSummary = {
      sessionId: `session-${Date.now()}`,
      deckId: deck.id,
      cardsStudied: sessionCards.length,
      correctAnswers: correctCount,
      accuracy,
      averageResponseTime: totalResponseTime / sessionCards.length,
      newCardsLearned: sessionCards.filter(c => !c.metadata?.lastReviewed).length,
      cardsReviewed: sessionCards.filter(c => c.metadata?.lastReviewed).length,
      streakMaintained: streakCount > 0,
      xpEarned: Math.round(correctCount * 10 + bestStreak * 5)
    };

    onComplete(summary);
  }, [deck.id, sessionCards, correctCount, streakCount, bestStreak, totalResponseTime, startTime, celebrate, onComplete]);

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
            <div className="flex items-center gap-6">
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
              {responses.get(currentCard.id) ? (
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