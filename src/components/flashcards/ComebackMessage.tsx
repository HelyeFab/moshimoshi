'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, TrendingUp, Calendar, X, Sparkles } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import confetti from 'canvas-confetti';

interface ComebackMessageProps {
  daysAway: number;
  lastStudyDate: Date;
  onClose: () => void;
}

export function ComebackMessage({ daysAway, lastStudyDate, onClose }: ComebackMessageProps) {
  const { t } = useI18n();
  const [show, setShow] = useState(true);

  useEffect(() => {
    // Celebration confetti for comeback
    const timer = setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ec4899', '#8b5cf6', '#3b82f6']
      });
    }, 500);

    // Auto-hide after 10 seconds
    const hideTimer = setTimeout(() => {
      setShow(false);
      setTimeout(onClose, 300);
    }, 10000);

    return () => {
      clearTimeout(timer);
      clearTimeout(hideTimer);
    };
  }, [onClose]);

  const handleClose = () => {
    setShow(false);
    setTimeout(onClose, 300);
  };

  const getMotivationalMessage = () => {
    if (daysAway >= 30) {
      return t('flashcards.comeback.monthPlus');
    } else if (daysAway >= 14) {
      return t('flashcards.comeback.twoWeeks');
    } else if (daysAway >= 7) {
      return t('flashcards.comeback.oneWeek');
    }
    return t('flashcards.comeback.default');
  };

  const getEncouragementMessage = () => {
    const messages = [
      t('flashcards.comeback.encourage1'),
      t('flashcards.comeback.encourage2'),
      t('flashcards.comeback.encourage3'),
      t('flashcards.comeback.encourage4')
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4"
        >
          <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 p-1 rounded-2xl shadow-2xl">
            <div className="bg-soft-white dark:bg-dark-800 rounded-xl p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl">
                    <Heart className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {t('flashcards.comeback.welcomeBack')}!
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('flashcards.comeback.missedYou')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                  aria-label={t('common.close')}
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Stats */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t('flashcards.comeback.lastStudy')}
                    </span>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {lastStudyDate.toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t('flashcards.comeback.daysAway')}
                    </span>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {daysAway} {t('common.days')}
                  </span>
                </div>
              </div>

              {/* Motivational message */}
              <div className="mb-4">
                <p className="text-gray-700 dark:text-gray-300 font-medium">
                  {getMotivationalMessage()}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 italic">
                  "{getEncouragementMessage()}"
                </p>
              </div>

              {/* Achievement notification */}
              {daysAway >= 7 && (
                <div className="flex items-center gap-2 p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                  <Sparkles className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                      {t('flashcards.comeback.achievementEarned')}
                    </p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      "Comeback Kid" - {t('flashcards.comeback.achievementDesc')}
                    </p>
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('flashcards.comeback.readyToStart')}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export async function checkForComeback(userId: string) {
  try {
    // Get last session timestamp from localStorage
    const lastSessionKey = `lastSession_${userId}`;
    const lastSessionTimestamp = localStorage.getItem(lastSessionKey);

    if (!lastSessionTimestamp) {
      // First time user or cleared storage
      localStorage.setItem(lastSessionKey, Date.now().toString());
      return null;
    }

    const lastSession = parseInt(lastSessionTimestamp);
    const now = Date.now();
    const daysSince = Math.floor((now - lastSession) / (1000 * 60 * 60 * 24));

    // Update last session timestamp
    localStorage.setItem(lastSessionKey, now.toString());

    // Check if it's been long enough for a comeback
    if (daysSince >= 3) { // Show comeback for 3+ days away
      return {
        daysAway: daysSince,
        lastStudyDate: new Date(lastSession),
        isComeback: daysSince >= 7 // Achievement threshold
      };
    }

    return null;
  } catch (error) {
    console.error('Error checking for comeback:', error);
    return null;
  }
}