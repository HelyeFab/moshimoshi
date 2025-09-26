'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, TrendingUp, Calendar, CheckCircle2, Settings, Trophy, Flame, X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import { sessionManager } from '@/lib/flashcards/SessionManager';
import type { SessionStats } from '@/types/flashcards';

interface DailyGoal {
  cardsToReview: number;
  minutesToStudy: number;
  decksToVisit: number;
  accuracyTarget: number; // Percentage
}

interface DailyProgress {
  cardsReviewed: number;
  minutesStudied: number;
  decksVisited: Set<string>;
  averageAccuracy: number;
  sessionsToday: number;
}

interface DailyGoalsProps {
  userId: string;
  isPremium: boolean;
  onGoalComplete?: (goalType: string) => void;
}

export function DailyGoals({ userId, isPremium, onGoalComplete }: DailyGoalsProps) {
  const { t } = useI18n();
  const [goals, setGoals] = useState<DailyGoal>({
    cardsToReview: 30,
    minutesToStudy: 15,
    decksToVisit: 2,
    accuracyTarget: 80
  });

  const [progress, setProgress] = useState<DailyProgress>({
    cardsReviewed: 0,
    minutesStudied: 0,
    decksVisited: new Set(),
    averageAccuracy: 0,
    sessionsToday: 0
  });

  const [showSettings, setShowSettings] = useState(false);
  const [tempGoals, setTempGoals] = useState<DailyGoal>(goals);
  const [todaysStreak, setTodaysStreak] = useState(0);

  // Load goals from localStorage
  useEffect(() => {
    const savedGoals = localStorage.getItem(`dailyGoals_${userId}`);
    if (savedGoals) {
      const parsed = JSON.parse(savedGoals);
      setGoals(parsed);
      setTempGoals(parsed);
    }
  }, [userId]);

  // Load today's progress
  useEffect(() => {
    loadTodayProgress();
    // Reload progress every minute
    const interval = setInterval(loadTodayProgress, 60000);
    return () => clearInterval(interval);
  }, [userId]);

  const loadTodayProgress = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
      // Get today's sessions
      const todaySessions = await sessionManager.getUserSessions(
        userId,
        undefined,
        today,
        tomorrow
      );

      if (todaySessions.length > 0) {
        const cardsReviewed = todaySessions.reduce((sum, s) => sum + s.cardsStudied, 0);
        const minutesStudied = Math.round(todaySessions.reduce((sum, s) => sum + s.duration, 0) / 60);
        const decksVisited = new Set(todaySessions.map(s => s.deckId));
        const totalAccuracy = todaySessions.reduce((sum, s) => sum + s.accuracy, 0);
        const averageAccuracy = Math.round((totalAccuracy / todaySessions.length) * 100);

        setProgress({
          cardsReviewed,
          minutesStudied,
          decksVisited,
          averageAccuracy,
          sessionsToday: todaySessions.length
        });

        // Check for goal completions
        checkGoalCompletions({
          cardsReviewed,
          minutesStudied,
          decksVisited,
          averageAccuracy,
          sessionsToday: todaySessions.length
        });
      } else {
        setProgress({
          cardsReviewed: 0,
          minutesStudied: 0,
          decksVisited: new Set(),
          averageAccuracy: 0,
          sessionsToday: 0
        });
      }

      // Get current streak
      const streak = await sessionManager.calculateStreak(userId);
      setTodaysStreak(streak);
    } catch (error) {
      console.error('Failed to load today progress:', error);
    }
  };

  const checkGoalCompletions = (currentProgress: DailyProgress) => {
    if (!onGoalComplete) return;

    // Check each goal
    if (currentProgress.cardsReviewed >= goals.cardsToReview) {
      onGoalComplete('cards');
    }
    if (currentProgress.minutesStudied >= goals.minutesToStudy) {
      onGoalComplete('time');
    }
    if (currentProgress.decksVisited.size >= goals.decksToVisit) {
      onGoalComplete('decks');
    }
    if (currentProgress.averageAccuracy >= goals.accuracyTarget) {
      onGoalComplete('accuracy');
    }
  };

  const saveGoals = () => {
    localStorage.setItem(`dailyGoals_${userId}`, JSON.stringify(tempGoals));
    setGoals(tempGoals);
    setShowSettings(false);
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min(100, Math.round((current / target) * 100));
  };

  const isGoalComplete = (current: number, target: number) => {
    return current >= target;
  };

  // Calculate overall completion
  const overallCompletion = Math.round(
    (getProgressPercentage(progress.cardsReviewed, goals.cardsToReview) +
     getProgressPercentage(progress.minutesStudied, goals.minutesToStudy) +
     getProgressPercentage(progress.decksVisited.size, goals.decksToVisit) +
     getProgressPercentage(progress.averageAccuracy, goals.accuracyTarget)) / 4
  );

  const allGoalsComplete =
    isGoalComplete(progress.cardsReviewed, goals.cardsToReview) &&
    isGoalComplete(progress.minutesStudied, goals.minutesToStudy) &&
    isGoalComplete(progress.decksVisited.size, goals.decksToVisit) &&
    isGoalComplete(progress.averageAccuracy, goals.accuracyTarget);

  return (
    <div className="bg-soft-white dark:bg-dark-800 rounded-2xl shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            allGoalsComplete
              ? "bg-green-100 dark:bg-green-900/20"
              : "bg-primary-100 dark:bg-primary-900/20"
          )}>
            {allGoalsComplete ? (
              <Trophy className="w-6 h-6 text-green-600 dark:text-green-400" />
            ) : (
              <Target className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('flashcards.dailyGoals.title')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {allGoalsComplete
                ? t('flashcards.dailyGoals.allComplete')
                : t('flashcards.dailyGoals.progress', { percentage: overallCompletion })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Streak indicator */}
          {todaysStreak > 0 && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                {todaysStreak} {t('flashcards.dayStreak')}
              </span>
            </div>
          )}

          {/* Settings button */}
          {isPremium && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
            >
              <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bars */}
      <div className="space-y-4">
        {/* Cards Goal */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {t('flashcards.dailyGoals.cards')}
            </span>
            <span className={cn(
              "font-medium",
              isGoalComplete(progress.cardsReviewed, goals.cardsToReview)
                ? "text-green-600 dark:text-green-400"
                : "text-gray-900 dark:text-gray-100"
            )}>
              {progress.cardsReviewed} / {goals.cardsToReview}
            </span>
          </div>
          <div className="relative h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${getProgressPercentage(progress.cardsReviewed, goals.cardsToReview)}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={cn(
                "absolute left-0 top-0 h-full rounded-full",
                isGoalComplete(progress.cardsReviewed, goals.cardsToReview)
                  ? "bg-green-500"
                  : "bg-primary-500"
              )}
            />
          </div>
        </div>

        {/* Time Goal */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {t('flashcards.dailyGoals.time')}
            </span>
            <span className={cn(
              "font-medium",
              isGoalComplete(progress.minutesStudied, goals.minutesToStudy)
                ? "text-green-600 dark:text-green-400"
                : "text-gray-900 dark:text-gray-100"
            )}>
              {progress.minutesStudied} / {goals.minutesToStudy} {t('flashcards.minutes')}
            </span>
          </div>
          <div className="relative h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${getProgressPercentage(progress.minutesStudied, goals.minutesToStudy)}%` }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
              className={cn(
                "absolute left-0 top-0 h-full rounded-full",
                isGoalComplete(progress.minutesStudied, goals.minutesToStudy)
                  ? "bg-green-500"
                  : "bg-blue-500"
              )}
            />
          </div>
        </div>

        {/* Decks Goal */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {t('flashcards.dailyGoals.decks')}
            </span>
            <span className={cn(
              "font-medium",
              isGoalComplete(progress.decksVisited.size, goals.decksToVisit)
                ? "text-green-600 dark:text-green-400"
                : "text-gray-900 dark:text-gray-100"
            )}>
              {progress.decksVisited.size} / {goals.decksToVisit}
            </span>
          </div>
          <div className="relative h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${getProgressPercentage(progress.decksVisited.size, goals.decksToVisit)}%` }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
              className={cn(
                "absolute left-0 top-0 h-full rounded-full",
                isGoalComplete(progress.decksVisited.size, goals.decksToVisit)
                  ? "bg-green-500"
                  : "bg-purple-500"
              )}
            />
          </div>
        </div>

        {/* Accuracy Goal */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {t('flashcards.dailyGoals.accuracy')}
            </span>
            <span className={cn(
              "font-medium",
              progress.sessionsToday > 0 && isGoalComplete(progress.averageAccuracy, goals.accuracyTarget)
                ? "text-green-600 dark:text-green-400"
                : "text-gray-900 dark:text-gray-100"
            )}>
              {progress.sessionsToday > 0 ? `${progress.averageAccuracy}%` : '--'} / {goals.accuracyTarget}%
            </span>
          </div>
          <div className="relative h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: progress.sessionsToday > 0
                  ? `${getProgressPercentage(progress.averageAccuracy, goals.accuracyTarget)}%`
                  : '0%'
              }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
              className={cn(
                "absolute left-0 top-0 h-full rounded-full",
                progress.sessionsToday > 0 && isGoalComplete(progress.averageAccuracy, goals.accuracyTarget)
                  ? "bg-green-500"
                  : "bg-yellow-500"
              )}
            />
          </div>
        </div>
      </div>

      {/* Celebration animation when all goals complete */}
      <AnimatePresence>
        {allGoalsComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="mt-4 p-4 bg-gradient-to-r from-green-100 to-blue-100 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-300">
                  {t('flashcards.dailyGoals.congratulations')}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {t('flashcards.dailyGoals.keepItUp')}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-soft-white dark:bg-dark-800 rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t('flashcards.dailyGoals.customizeGoals')}
                </h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Cards input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('flashcards.dailyGoals.cardsPerDay')}
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="200"
                    value={tempGoals.cardsToReview}
                    onChange={(e) => setTempGoals({
                      ...tempGoals,
                      cardsToReview: Math.max(10, Math.min(200, parseInt(e.target.value) || 10))
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-soft-white dark:bg-dark-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Time input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('flashcards.dailyGoals.minutesPerDay')}
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={tempGoals.minutesToStudy}
                    onChange={(e) => setTempGoals({
                      ...tempGoals,
                      minutesToStudy: Math.max(5, Math.min(120, parseInt(e.target.value) || 5))
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-soft-white dark:bg-dark-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Decks input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('flashcards.dailyGoals.decksPerDay')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={tempGoals.decksToVisit}
                    onChange={(e) => setTempGoals({
                      ...tempGoals,
                      decksToVisit: Math.max(1, Math.min(10, parseInt(e.target.value) || 1))
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-soft-white dark:bg-dark-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Accuracy input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('flashcards.dailyGoals.accuracyTarget')} (%)
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="100"
                    value={tempGoals.accuracyTarget}
                    onChange={(e) => setTempGoals({
                      ...tempGoals,
                      accuracyTarget: Math.max(50, Math.min(100, parseInt(e.target.value) || 50))
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-soft-white dark:bg-dark-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={saveGoals}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  {t('common.save')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}