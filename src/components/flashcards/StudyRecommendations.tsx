'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, TrendingUp, AlertCircle, Brain, Zap, Calendar, Target, Flame } from 'lucide-react';
import type { StudyRecommendation, LearningInsights } from '@/lib/flashcards/SessionManager';
import { useI18n } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';

interface StudyRecommendationsProps {
  recommendations: StudyRecommendation[];
  insights: LearningInsights | null;
  currentStreak: number;
  onSelectDeck: (deckId: string) => void;
}

export function StudyRecommendations({
  recommendations,
  insights,
  currentStreak,
  onSelectDeck
}: StudyRecommendationsProps) {
  const { t } = useI18n();

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20';
      case 'low': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Quick Stats */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary-500" />
            {t('flashcards.learningInsights')}
          </h3>

          <div className="space-y-4">
            {/* Current Streak */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className={cn(
                  "w-5 h-5",
                  currentStreak > 0 ? "text-orange-500" : "text-gray-400"
                )} />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('flashcards.currentStreak')}
                </span>
              </div>
              <span className={cn(
                "font-bold text-lg",
                currentStreak > 0 ? "text-orange-600 dark:text-orange-400" : "text-gray-500"
              )}>
                {currentStreak} {t('common.days')}
              </span>
            </div>

            {/* Retention Rate */}
            {insights && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t('flashcards.retentionRate')}
                    </span>
                  </div>
                  <span className="font-bold text-lg text-green-600 dark:text-green-400">
                    {Math.round(insights.retentionRate * 100)}%
                  </span>
                </div>

                {/* Learning Velocity */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t('flashcards.cardsPerDay')}
                    </span>
                  </div>
                  <span className="font-bold text-lg text-blue-600 dark:text-blue-400">
                    {Math.round(insights.learningVelocity)}
                  </span>
                </div>

                {/* Best Study Time */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-purple-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t('flashcards.bestStudyTime')}
                    </span>
                  </div>
                  <span className="font-bold text-lg text-purple-600 dark:text-purple-400">
                    {insights.bestStudyTime}:00
                  </span>
                </div>

                {/* Streak Risk Warning */}
                {insights.streakRisk && currentStreak > 0 && (
                  <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-yellow-700 dark:text-yellow-300">
                        <p className="font-medium">{t('flashcards.streakAtRisk')}</p>
                        <p className="mt-1 text-xs opacity-90">
                          {t('flashcards.studyToMaintainStreak')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Optimal Session Settings */}
        {insights && (
          <div className="mt-6 bg-gradient-to-br from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 rounded-2xl p-6">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              {t('flashcards.optimalSettings')}
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  {t('flashcards.sessionLength')}:
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {insights.optimalSessionLength} {t('flashcards.cards')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  {t('flashcards.studyTime')}:
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {insights.bestStudyTime}:00
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="lg:col-span-2">
        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            {t('flashcards.recommendedStudy')}
          </h3>

          {recommendations.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <Calendar className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                {t('flashcards.allCaughtUp')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec, index) => (
                <motion.div
                  key={rec.deckId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onSelectDeck(rec.deckId)}
                  className="p-4 rounded-xl border border-gray-200 dark:border-dark-700 hover:shadow-md transition-all cursor-pointer hover:border-primary-400 dark:hover:border-primary-600"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {rec.deckName}
                        </h4>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          getUrgencyColor(rec.urgency)
                        )}>
                          {t(`flashcards.urgency.${rec.urgency}`)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {rec.reason}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(rec.estimatedTime)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          {rec.dueCards} {t('flashcards.cardsDue')}
                        </span>
                      </div>
                    </div>
                    <button className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Performance Insights */}
        {insights && insights.strongestTopics.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">
                {t('flashcards.strongTopics')}
              </h4>
              <ul className="space-y-1">
                {insights.strongestTopics.map((topic, i) => (
                  <li key={i} className="text-sm text-green-600 dark:text-green-500">
                    • {topic}
                  </li>
                ))}
              </ul>
            </div>
            {insights.weakestTopics.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">
                  {t('flashcards.needsWork')}
                </h4>
                <ul className="space-y-1">
                  {insights.weakestTopics.map((topic, i) => (
                    <li key={i} className="text-sm text-red-600 dark:text-red-500">
                      • {topic}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}