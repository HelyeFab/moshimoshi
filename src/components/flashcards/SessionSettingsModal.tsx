'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Settings, Shuffle, ArrowRight, Brain, ArrowLeftRight, ArrowRightLeft, RefreshCw } from 'lucide-react';
import type { FlashcardDeck, DeckSettings } from '@/types/flashcards';
import { useI18n } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import Dropdown from '@/components/ui/Dropdown';
import Checkbox from '@/components/ui/Checkbox';

interface SessionSettingsModalProps {
  isOpen: boolean;
  deck: FlashcardDeck;
  onClose: () => void;
  onStartSession: (settings: Partial<DeckSettings>) => void;
}

export function SessionSettingsModal({
  isOpen,
  deck,
  onClose,
  onStartSession
}: SessionSettingsModalProps) {
  const { t } = useI18n();

  const maxCards = deck.cards.length;

  // Initialize with deck's current settings, clamped to max cards
  const [sessionLength, setSessionLength] = useState(
    Math.min(deck.settings?.sessionLength || 20, maxCards)
  );
  const [reviewMode, setReviewMode] = useState(deck.settings?.reviewMode || 'sequential');
  const [studyDirection, setStudyDirection] = useState(deck.settings?.studyDirection || 'front-to-back');
  const [furiganaEnabled, setFuriganaEnabled] = useState(deck.settings?.furigana?.enabled ?? true);
  const [furiganaOnFront, setFuriganaOnFront] = useState(deck.settings?.furigana?.showOnFront ?? true);
  const [furiganaOnBack, setFuriganaOnBack] = useState(deck.settings?.furigana?.showOnBack ?? true);

  const actualSessionLength = Math.min(sessionLength, maxCards);

  // Generate smart preset buttons based on deck size
  const getPresets = () => {
    const presets = [5, 10, 20, maxCards];
    // Remove duplicates and values greater than maxCards, then sort
    return [...new Set(presets.filter(p => p <= maxCards))].sort((a, b) => a - b);
  };

  const handleStartSession = () => {
    onStartSession({
      sessionLength: actualSessionLength,
      reviewMode,
      studyDirection,
      furigana: {
        enabled: furiganaEnabled,
        showOnFront: furiganaOnFront,
        showOnBack: furiganaOnBack
      }
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-soft-white dark:bg-dark-850 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {t('flashcards.settings.quickSettings')}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Deck Info */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{deck.emoji}</span>
              <div className="flex-1 min-w-0">
                <h3
                  className="font-semibold text-gray-900 dark:text-gray-100 truncate min-w-0"
                  title={deck.name}
                >
                  {deck.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('flashcards.totalCards', { count: maxCards })}
                </p>
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-6 mb-6">
            {/* Session Length */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('flashcards.settings.sessionLength')}
              </label>

              {/* Quick select buttons */}
              <div className={cn(
                "grid gap-2 mb-3",
                getPresets().length === 4 ? "grid-cols-4" :
                getPresets().length === 3 ? "grid-cols-3" :
                getPresets().length === 2 ? "grid-cols-2" :
                "grid-cols-1"
              )}>
                {getPresets().map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setSessionLength(preset)}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                      sessionLength === preset
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                    )}
                  >
                    {preset === maxCards ? t('common.all') || 'All' : preset}
                  </button>
                ))}
              </div>

              {/* Stepper controls */}
              <div className="flex items-center justify-center gap-4 p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                <button
                  onClick={() => setSessionLength(Math.max(1, sessionLength - 1))}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-dark-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-600 transition-colors active:scale-95"
                  disabled={sessionLength <= 1}
                >
                  <span className="text-xl font-semibold text-gray-700 dark:text-gray-300">−</span>
                </button>

                <div className="flex flex-col items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max={maxCards}
                    value={sessionLength}
                    onChange={(e) => {
                      const value = Math.max(1, Math.min(maxCards, Number(e.target.value)));
                      setSessionLength(value);
                    }}
                    className="w-16 px-2 py-2 text-center text-lg font-semibold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    of {maxCards} cards
                  </span>
                </div>

                <button
                  onClick={() => setSessionLength(Math.min(maxCards, sessionLength + 1))}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-dark-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-600 transition-colors active:scale-95"
                  disabled={sessionLength >= maxCards}
                >
                  <span className="text-xl font-semibold text-gray-700 dark:text-gray-300">+</span>
                </button>
              </div>

            </div>

            {/* Review Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('flashcards.settings.reviewMode')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setReviewMode('sequential')}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1',
                    reviewMode === 'sequential'
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                  )}
                >
                  <ArrowRight className="w-4 h-4" />
                  {t('flashcards.settings.sequential')}
                </button>
                <button
                  onClick={() => setReviewMode('random')}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1',
                    reviewMode === 'random'
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                  )}
                >
                  <Shuffle className="w-4 h-4" />
                  {t('flashcards.settings.random')}
                </button>
                <button
                  onClick={() => setReviewMode('srs')}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1',
                    reviewMode === 'srs'
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                  )}
                >
                  <Brain className="w-4 h-4" />
                  {t('flashcards.settings.smart')}
                </button>
              </div>
            </div>

            {/* Study Direction */}
            <div>
              <Dropdown
                label={t('flashcards.settings.studyDirection')}
                value={studyDirection}
                onChange={(value) => setStudyDirection(value as any)}
                options={[
                  {
                    value: 'front-to-back',
                    label: t('flashcards.settings.frontToBack'),
                    icon: <ArrowRight className="w-4 h-4" />,
                    description: t('flashcards.settings.frontToBackDesc', 'Show front side first')
                  },
                  {
                    value: 'back-to-front',
                    label: t('flashcards.settings.backToFront'),
                    icon: <ArrowLeftRight className="w-4 h-4" />,
                    description: t('flashcards.settings.backToFrontDesc', 'Show back side first')
                  },
                  {
                    value: 'mixed',
                    label: t('flashcards.settings.mixed'),
                    icon: <RefreshCw className="w-4 h-4" />,
                    description: t('flashcards.settings.mixedDesc', 'Random direction for each card')
                  }
                ]}
                size="medium"
                variant="default"
              />
            </div>

            {/* Furigana Settings */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('flashcards.settings.furigana')}
              </label>

              {/* Enable Furigana Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {t('flashcards.settings.furiganaEnabled')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('flashcards.settings.furiganaEnabledHint')}
                  </p>
                </div>
                <button
                  onClick={() => setFuriganaEnabled(!furiganaEnabled)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    furiganaEnabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      furiganaEnabled ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              {/* Show on Front/Back - only when furigana is enabled */}
              {furiganaEnabled && (
                <div className="space-y-2 pl-3">
                  <Checkbox
                    checked={furiganaOnFront}
                    onChange={setFuriganaOnFront}
                    label={t('flashcards.settings.furiganaOnFront')}
                    size="small"
                  />
                  <Checkbox
                    checked={furiganaOnBack}
                    onChange={setFuriganaOnBack}
                    label={t('flashcards.settings.furiganaOnBack')}
                    size="small"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleStartSession}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-primary-500 to-purple-500 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              {t('flashcards.startSession')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
