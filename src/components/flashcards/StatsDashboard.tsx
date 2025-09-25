'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/i18n/I18nContext';
import type { FlashcardDeck, SessionStats } from '@/types/flashcards';
import {
  Trophy, TrendingUp, Target, Clock, Brain, Zap, Award, ChevronRight,
  BarChart3, Activity, Calendar, Users, Sparkles, Timer, BookOpen,
  CheckCircle, XCircle, Star, Flame
} from 'lucide-react';

interface StatsDashboardProps {
  decks: FlashcardDeck[];
  sessions?: SessionStats[];
  userId?: string;
  onViewDetails?: (deckId: string) => void;
}

export function StatsDashboard({
  decks,
  sessions = [],
  userId,
  onViewDetails
}: StatsDashboardProps) {
  const { t } = useI18n();
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'all'>('week');
  const [expandedSection, setExpandedSection] = useState<string | null>('overview');

  const calculateStreak = (sessions: SessionStats[]): number => {
    if (!sessions.length) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sortedSessions = [...sessions].sort((a, b) => b.timestamp - a.timestamp);

    let streak = 0;
    let currentDate = new Date(today);

    for (let i = 0; i < 30; i++) { // Check last 30 days
      const dayStart = currentDate.getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;

      const hasSession = sortedSessions.some(
        s => s.timestamp >= dayStart && s.timestamp < dayEnd
      );

      if (hasSession) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (i === 0) {
        // Today - no session yet, check yesterday
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  };

  // Calculate aggregate statistics
  const stats = useMemo(() => {
    const now = Date.now();
    const periodMs = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      all: Infinity
    };

    const cutoff = selectedPeriod === 'all' ? 0 : now - periodMs[selectedPeriod];
    const filteredSessions = sessions.filter(s => s.timestamp >= cutoff);

    // Overall stats
    const totalCards = decks.reduce((sum, deck) => sum + deck.stats.totalCards, 0);
    const totalMastered = decks.reduce((sum, deck) => sum + deck.stats.masteredCards, 0);
    const totalLearning = decks.reduce((sum, deck) => sum + deck.stats.learningCards, 0);
    const totalDue = decks.reduce((sum, deck) => {
      return sum + deck.cards.filter(card =>
        card.metadata?.nextReview && card.metadata.nextReview <= now
      ).length;
    }, 0);

    // Session stats
    const totalSessions = filteredSessions.length;
    const totalStudyTime = filteredSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const avgAccuracy = filteredSessions.length > 0
      ? filteredSessions.reduce((sum, s) => sum + s.accuracy, 0) / filteredSessions.length
      : 0;

    // Streak calculation
    const currentStreak = calculateStreak(sessions);
    const longestStreak = Math.max(
      currentStreak,
      ...decks.map(d => d.stats.longestStreak || 0)
    );

    // Performance metrics
    const cardsStudiedToday = filteredSessions
      .filter(s => s.timestamp >= now - 24 * 60 * 60 * 1000)
      .reduce((sum, s) => sum + s.cardsReviewed, 0);

    const studyVelocity = totalSessions > 0 
      ? Math.round(totalMastered / Math.max(1, Math.ceil(totalStudyTime / (60 * 60 * 1000))))
      : 0;

    // Deck performance
    const deckPerformance = decks.map(deck => ({
      ...deck,
      efficiency: deck.stats.totalStudied > 0
        ? deck.stats.masteredCards / deck.stats.totalStudied
        : 0,
      progress: deck.stats.totalCards > 0
        ? (deck.stats.masteredCards / deck.stats.totalCards) * 100
        : 0
    })).sort((a, b) => b.progress - a.progress);

    return {
      totalCards,
      totalMastered,
      totalLearning,
      totalDue,
      totalSessions,
      totalStudyTime,
      avgAccuracy,
      currentStreak,
      longestStreak,
      cardsStudiedToday,
      studyVelocity,
      deckPerformance,
      masteryRate: totalCards > 0 ? (totalMastered / totalCards) * 100 : 0
    };
  }, [decks, sessions, selectedPeriod]);

  const formatDuration = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return t('flashcards.stats.hoursMinutes', { hours, minutes });
    }
    return t('flashcards.stats.minutes', { minutes });
  };

  const StatCard = ({ icon: Icon, value, label, color, trend }: any) => (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="bg-white dark:bg-dark-800 rounded-xl p-6 shadow-lg border border-gray-100 dark:border-dark-700"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-3 rounded-lg bg-gradient-to-br ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${
            trend > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            <TrendingUp className={`w-4 h-4 ${trend < 0 ? 'rotate-180' : ''}`} />
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        {value}
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {label}
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex flex-wrap gap-2 justify-center">
        {(['day', 'week', 'month', 'all'] as const).map(period => (
          <motion.button
            key={period}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedPeriod(period)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedPeriod === period
                ? 'bg-primary-500 text-white shadow-lg'
                : 'bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700'
            }`}
          >
            {t(`flashcards.stats.period.${period}`)}
          </motion.button>
        ))}
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Trophy}
          value={stats.totalMastered}
          label={t('flashcards.stats.mastered')}
          color="from-yellow-400 to-orange-500"
          trend={stats.masteryRate > 50 ? 12 : -8}
        />
        <StatCard
          icon={Brain}
          value={`${Math.round(stats.avgAccuracy * 100)}%`}
          label={t('flashcards.stats.accuracy')}
          color="from-purple-400 to-indigo-500"
        />
        <StatCard
          icon={Flame}
          value={stats.currentStreak}
          label={t('flashcards.stats.streak')}
          color="from-red-400 to-pink-500"
        />
        <StatCard
          icon={Clock}
          value={formatDuration(stats.totalStudyTime)}
          label={t('flashcards.stats.studyTime')}
          color="from-blue-400 to-cyan-500"
        />
      </div>

      {/* Detailed Sections */}
      <div className="space-y-4">
        {/* Learning Progress */}
        <motion.div
          className="bg-white dark:bg-dark-800 rounded-xl shadow-lg overflow-hidden"
          initial={false}
        >
          <button
            onClick={() => setExpandedSection(
              expandedSection === 'progress' ? null : 'progress'
            )}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-primary-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('flashcards.stats.learningProgress')}
              </h3>
            </div>
            <ChevronRight
              className={`w-5 h-5 text-gray-400 transition-transform ${
                expandedSection === 'progress' ? 'rotate-90' : ''
              }`}
            />
          </button>

          <AnimatePresence>
            {expandedSection === 'progress' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="px-6 pb-6"
              >
                <div className="space-y-4">
                  {/* Progress Overview */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        {stats.totalCards}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {t('flashcards.stats.total')}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                        {stats.totalLearning}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {t('flashcards.stats.learning')}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                        {stats.totalMastered}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {t('flashcards.stats.mastered')}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-8 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stats.masteryRate}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="absolute h-full bg-gradient-to-r from-green-400 to-emerald-500"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-medium text-white mix-blend-difference">
                        {Math.round(stats.masteryRate)}% {t('flashcards.stats.complete')}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Deck Performance */}
        <motion.div
          className="bg-white dark:bg-dark-800 rounded-xl shadow-lg overflow-hidden"
          initial={false}
        >
          <button
            onClick={() => setExpandedSection(
              expandedSection === 'decks' ? null : 'decks'
            )}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-primary-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('flashcards.stats.deckPerformance')}
              </h3>
            </div>
            <ChevronRight
              className={`w-5 h-5 text-gray-400 transition-transform ${
                expandedSection === 'decks' ? 'rotate-90' : ''
              }`}
            />
          </button>

          <AnimatePresence>
            {expandedSection === 'decks' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="px-6 pb-6"
              >
                <div className="space-y-3">
                  {stats.deckPerformance.slice(0, 5).map((deck, idx) => (
                    <motion.div
                      key={deck.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors cursor-pointer"
                      onClick={() => onViewDetails?.(deck.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{deck.emoji}</div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {deck.name}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {deck.stats.totalCards} {t('flashcards.cards')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {Math.round(deck.progress)}%
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {t('flashcards.stats.progress')}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Study Insights */}
        <motion.div
          className="bg-gradient-to-br from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-6 h-6 text-primary-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('flashcards.stats.insights')}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-yellow-500" />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {t('flashcards.stats.velocity')}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {stats.studyVelocity} {t('flashcards.stats.cardsPerHour')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-green-500" />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {t('flashcards.stats.todayGoal')}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {stats.cardsStudiedToday} / 20 {t('flashcards.cards')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Award className="w-5 h-5 text-purple-500" />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {t('flashcards.stats.bestStreak')}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {stats.longestStreak} {t('flashcards.stats.days')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Timer className="w-5 h-5 text-blue-500" />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {t('flashcards.stats.dueNow')}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {stats.totalDue} {t('flashcards.cards')}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}