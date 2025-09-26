'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Flame, Crown, GraduationCap, Award, Star,
  Zap, FastForward, Clock, CheckCircle2, Target, Crosshair,
  Layers, BookOpen, Brain, Moon, Sun, Share2, RefreshCw,
  Timer, Lock, X
} from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import { achievementManager, type Achievement } from '@/lib/flashcards/AchievementManager';

// Map icon names to components
const iconMap: { [key: string]: any } = {
  Flame, Trophy, Crown, GraduationCap, Award, Star,
  Zap, FastForward, Clock, CheckCircle2, Target, Crosshair,
  Layers, BookOpen, Brain, Moon, Sun, Share2, RefreshCw, Timer
};

interface AchievementDisplayProps {
  userId: string;
  currentStats?: {
    streak: number;
    totalCardsReviewed: number;
    totalMasteredCards: number;
    averageAccuracy: number;
    totalDecksCreated: number;
    totalMinutesStudied: number;
  };
  onClose?: () => void;
}

interface AchievementNotificationProps {
  achievement: Achievement;
  onClose: () => void;
}

export function AchievementNotification({ achievement, onClose }: AchievementNotificationProps) {
  const { t } = useI18n();
  const Icon = iconMap[achievement.icon] || Trophy;

  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="fixed top-20 right-4 z-50 max-w-sm"
    >
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl shadow-2xl p-1">
        <div className="bg-soft-white dark:bg-dark-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl">
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-900 dark:text-gray-100">
                {t('flashcards.achievements.unlocked')}!
              </h4>
              <p className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-1">
                {achievement.name}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {achievement.description}
              </p>
              <p className="text-sm font-medium text-primary-600 dark:text-primary-400 mt-2">
                +{achievement.points} XP
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function AchievementDisplay({ userId, currentStats, onClose }: AchievementDisplayProps) {
  const { t } = useI18n();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [totalPoints, setTotalPoints] = useState(0);

  useEffect(() => {
    loadAchievements();
  }, [userId, currentStats]);

  const loadAchievements = () => {
    const allAchievements = achievementManager.getAllAchievementsWithProgress(userId, currentStats);
    setAchievements(allAchievements);
    setTotalPoints(achievementManager.getTotalPoints(userId));
  };

  const categories = [
    { id: 'all', name: t('common.all'), icon: Trophy },
    { id: 'streak', name: t('flashcards.achievements.streak'), icon: Flame },
    { id: 'mastery', name: t('flashcards.achievements.mastery'), icon: GraduationCap },
    { id: 'speed', name: t('flashcards.achievements.speed'), icon: Zap },
    { id: 'accuracy', name: t('flashcards.achievements.accuracy'), icon: Target },
    { id: 'volume', name: t('flashcards.achievements.volume'), icon: Layers },
    { id: 'special', name: t('flashcards.achievements.special'), icon: Star }
  ];

  const filteredAchievements = selectedCategory === 'all'
    ? achievements
    : achievements.filter(a => a.category === selectedCategory);

  const unlockedCount = achievements.filter(a => a.unlockedAt).length;
  const completionPercentage = Math.round((unlockedCount / achievements.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-soft-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-500 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Trophy className="w-7 h-7" />
                {t('flashcards.achievements.title')}
              </h2>
              <p className="text-white/90 mt-1">
                {t('flashcards.achievements.progress', {
                  unlocked: unlockedCount,
                  total: achievements.length
                })}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{totalPoints}</div>
              <div className="text-sm text-white/90">{t('flashcards.achievements.totalXP')}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${completionPercentage}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-white rounded-full"
              />
            </div>
            <p className="text-sm text-white/90 mt-1">{completionPercentage}% {t('common.complete')}</p>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="border-b border-gray-200 dark:border-dark-700">
          <div className="flex overflow-x-auto scrollbar-hide p-2 gap-2">
            {categories.map(category => {
              const Icon = category.icon;
              const categoryAchievements = category.id === 'all'
                ? achievements
                : achievements.filter(a => a.category === category.id);
              const categoryUnlocked = categoryAchievements.filter(a => a.unlockedAt).length;

              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors",
                    selectedCategory === category.id
                      ? "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                      : "hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-400"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{category.name}</span>
                  <span className="text-xs">
                    ({categoryUnlocked}/{categoryAchievements.length})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Achievements Grid */}
        <div className="p-6 overflow-y-auto max-h-[500px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAchievements.map((achievement) => {
              const Icon = iconMap[achievement.icon] || Trophy;
              const isUnlocked = !!achievement.unlockedAt;

              return (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "relative rounded-xl p-4 border-2 transition-all",
                    isUnlocked
                      ? "bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 border-yellow-400 dark:border-yellow-600"
                      : "bg-gray-50 dark:bg-dark-700 border-gray-200 dark:border-dark-600"
                  )}
                >
                  {/* Lock overlay for locked achievements */}
                  {!isUnlocked && (
                    <div className="absolute inset-0 bg-gray-900/5 dark:bg-gray-900/20 rounded-xl flex items-center justify-center">
                      <Lock className="w-8 h-8 text-gray-400 dark:text-gray-600" />
                    </div>
                  )}

                  <div className={cn("relative z-10", !isUnlocked && "opacity-50")}>
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        isUnlocked
                          ? "bg-gradient-to-br from-yellow-400 to-orange-500"
                          : "bg-gray-300 dark:bg-dark-600"
                      )}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                          {achievement.name}
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {achievement.description}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                            {achievement.points} XP
                          </span>
                          {isUnlocked && (
                            <span className="text-xs text-gray-500 dark:text-gray-500">
                              {new Date(achievement.unlockedAt!).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Progress bar for locked achievements */}
                    {!isUnlocked && achievement.progress !== undefined && achievement.progress > 0 && (
                      <div className="mt-3">
                        <div className="h-1.5 bg-gray-200 dark:bg-dark-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full"
                            style={{ width: `${achievement.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {Math.round(achievement.progress)}% {t('common.complete')}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Close Button */}
        <div className="border-t border-gray-200 dark:border-dark-700 p-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}