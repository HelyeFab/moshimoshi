'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Zap, Brain, Target, Timer,
  AlertCircle, BookOpen, TrendingDown, Sparkles
} from 'lucide-react';
import type { FlashcardDeck, FlashcardContent } from '@/types/flashcards';
import { useI18n } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import { FlashcardSRSHelper } from '@/lib/flashcards/SRSHelper';
import Dropdown from '@/components/ui/Dropdown';

export type StudyModeType = 'due' | 'new' | 'all' | 'cramming' | 'speed' | 'weakness' | 'custom';

interface StudyMode {
  id: StudyModeType;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  cardCount?: number;
  estimatedTime?: number;
}

interface StudyModeSelectorProps {
  deck: FlashcardDeck;
  onStartStudy: (cards: FlashcardContent[], mode: StudyModeType) => void;
  onClose: () => void;
}

export function StudyModeSelector({ deck, onStartStudy, onClose }: StudyModeSelectorProps) {
  const { t } = useI18n();
  const [selectedMode, setSelectedMode] = useState<StudyModeType | null>(null);
  const maxCards = deck.cards.length;
  const [customSettings, setCustomSettings] = useState({
    cardLimit: Math.min(20, maxCards),
    includeNew: true,
    includeDue: true,
    includeMastered: false,
    sortBy: 'priority' as 'priority' | 'random' | 'oldest'
  });

  const shuffleArray = <T,>(items: T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const interleaveArrays = <T,>(primary: T[], secondary: T[]): T[] => {
    const mixed: T[] = [];
    const maxLen = Math.max(primary.length, secondary.length);
    for (let i = 0; i < maxLen; i += 1) {
      if (i < primary.length) mixed.push(primary[i]);
      if (i < secondary.length) mixed.push(secondary[i]);
    }
    return mixed;
  };

  // Generate smart preset buttons based on deck size
  const getPresets = () => {
    const presets = [5, 10, 20, maxCards];
    // Remove duplicates and values greater than maxCards, then sort
    return [...new Set(presets.filter(p => p <= maxCards))].sort((a, b) => a - b);
  };

  // Get daily limits from deck settings
  const newCardsPerDay = deck.settings?.newCardsPerDay || 20;
  const reviewsPerDay = deck.settings?.reviewsPerDay || 100;

  // Calculate card counts for each mode
  const now = Date.now();

  // Review cards: cards that have been studied before and are due for review
  const allReviewCards = deck.cards.filter(card => {
    if (!card.metadata?.status || card.metadata.status === 'new') return false;
    return card.metadata.nextReview && card.metadata.nextReview <= now;
  });

  // New cards: cards that haven't been studied yet
  const allNewCards = deck.cards.filter(card =>
    !card.metadata?.status || card.metadata.status === 'new'
  );

  // Apply daily limits
  const reviewCards = allReviewCards.slice(0, reviewsPerDay);
  const newCards = allNewCards.slice(0, newCardsPerDay);

  // "Due" for study today = new cards (up to daily limit) + review cards (up to daily limit)
  // This matches what DeckGrid shows in the "due" badge
  const dueCards = [...newCards, ...reviewCards];
  const mixedDueCards = (() => {
    const total = dueCards.length;
    if (total === 0) return [];

    const dueRatio = 0.7;
    let targetDue = Math.min(reviewCards.length, Math.round(total * dueRatio));
    let targetNew = Math.min(newCards.length, total - targetDue);

    // If we couldn't fill the target with new cards, backfill with due
    if (targetNew < total - targetDue) {
      targetDue = Math.min(reviewCards.length, total - targetNew);
    }

    const dueSlice = shuffleArray(reviewCards).slice(0, targetDue);
    const newSlice = shuffleArray(newCards).slice(0, targetNew);

    return interleaveArrays(dueSlice, newSlice);
  })();

  const weakCards = deck.cards.filter(card => {
    if (!card.metadata) return false;
    const accuracy = card.metadata.correctCount && card.metadata.reviewCount
      ? card.metadata.correctCount / card.metadata.reviewCount
      : 1;
    return accuracy < 0.6 || (card.metadata.lapses || 0) > 2;
  });

  const modes: StudyMode[] = [
    {
      id: 'due',
      name: t('flashcards.modes.due.name'),
      description: t('flashcards.modes.due.description'),
      icon: <Clock className="w-4 h-4" />,
      color: 'from-blue-500 to-indigo-600',
      cardCount: dueCards.length,
      estimatedTime: Math.ceil((dueCards.length * 3) / 60)
    },
    {
      id: 'new',
      name: t('flashcards.modes.new.name'),
      description: t('flashcards.modes.new.description'),
      icon: <Sparkles className="w-4 h-4" />,
      color: 'from-green-500 to-emerald-600',
      cardCount: newCards.length,
      estimatedTime: Math.ceil((newCards.length * 4) / 60)
    },
    {
      id: 'all',
      name: t('flashcards.modes.all.name'),
      description: t('flashcards.modes.all.description'),
      icon: <BookOpen className="w-4 h-4" />,
      color: 'from-purple-500 to-pink-600',
      cardCount: deck.cards.length,
      estimatedTime: Math.ceil((deck.cards.length * 3) / 60)
    },
    {
      id: 'cramming',
      name: t('flashcards.modes.cramming.name'),
      description: t('flashcards.modes.cramming.description'),
      icon: <Zap className="w-4 h-4" />,
      color: 'from-yellow-500 to-orange-600',
      cardCount: Math.min(50, deck.cards.length),
      estimatedTime: 15
    },
    {
      id: 'speed',
      name: t('flashcards.modes.speed.name'),
      description: t('flashcards.modes.speed.description'),
      icon: <Timer className="w-4 h-4" />,
      color: 'from-red-500 to-rose-600',
      cardCount: Math.min(20, deck.cards.length),
      estimatedTime: 5
    },
    {
      id: 'weakness',
      name: t('flashcards.modes.weakness.name'),
      description: t('flashcards.modes.weakness.description'),
      icon: <TrendingDown className="w-4 h-4" />,
      color: 'from-amber-500 to-orange-600',
      cardCount: weakCards.length,
      estimatedTime: Math.ceil((weakCards.length * 4) / 60)
    },
    {
      id: 'custom',
      name: t('flashcards.modes.custom.name'),
      description: t('flashcards.modes.custom.description'),
      icon: <Brain className="w-4 h-4" />,
      color: 'from-gray-500 to-gray-700',
      cardCount: 0,
      estimatedTime: 0
    }
  ];

  const getCardsForMode = (mode: StudyModeType): FlashcardContent[] => {
    let cards: FlashcardContent[] = [];

    switch (mode) {
      case 'due':
        // Mixed due cards = review + new (already limited by daily settings)
        cards = [...mixedDueCards];
        break;

      case 'new':
        // New cards only (limited by daily setting)
        cards = [...newCards];
        break;

      case 'all':
        cards = [...deck.cards];
        break;

      case 'cramming':
        // High frequency review - uses ALL review + weak cards (ignores daily limits)
        cards = [...allReviewCards, ...weakCards].slice(0, 50);
        if (cards.length < 20) {
          cards.push(...deck.cards.slice(0, 20 - cards.length));
        }
        break;

      case 'speed':
        // Random selection for speed practice
        cards = [...deck.cards].sort(() => Math.random() - 0.5).slice(0, 20);
        break;

      case 'weakness':
        // Focus on weak cards (ignores daily limits for fallback)
        cards = [...weakCards];
        if (cards.length < 10) {
          // Add some review cards if not enough weak cards
          cards.push(...allReviewCards.slice(0, 10 - cards.length));
        }
        break;

      case 'custom':
        cards = deck.cards.filter(card => {
          const status = card.metadata?.status || 'new';

          if (status === 'new' && !customSettings.includeNew) return false;
          if (status !== 'new' && !customSettings.includeDue) return false;
          if (status === 'mastered' && !customSettings.includeMastered) return false;

          return true;
        });

        // Apply sorting
        if (customSettings.sortBy === 'random') {
          cards.sort(() => Math.random() - 0.5);
        } else if (customSettings.sortBy === 'oldest') {
          cards.sort((a, b) => (a.metadata?.createdAt || 0) - (b.metadata?.createdAt || 0));
        } else {
          cards = FlashcardSRSHelper.sortByPriority(cards);
        }

        // Apply limit
        cards = cards.slice(0, customSettings.cardLimit);
        break;
    }

    // Initialize SRS for new cards
    return cards.map(card => {
      if (!card.metadata?.status) {
        return FlashcardSRSHelper.initializeCardSRS(card);
      }
      return card;
    });
  };

  const handleStartStudy = () => {
    if (!selectedMode) return;
    const cards = getCardsForMode(selectedMode);
    if (cards.length === 0) {
      // Show error toast
      return;
    }
    onStartStudy(cards, selectedMode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto scrollbar-hide"
      >
        <div className="p-6 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {t('flashcards.selectStudyMode')}
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 truncate">
                {deck.name} • {deck.cards.length} {t('flashcards.cards')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {modes.map((mode) => (
              <motion.div
                key={mode.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedMode(mode.id)}
                data-testid={`flashcards-study-mode-${mode.id}`}
                className={cn(
                  "relative p-2 rounded-lg cursor-pointer transition-all",
                  selectedMode === mode.id
                    ? "ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20"
                    : "bg-gray-50 dark:bg-dark-700 hover:shadow-md"
                )}
              >
                <div className="space-y-1">
                  {/* Row 1: Icon + Title */}
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-5 h-5 rounded bg-gradient-to-br flex items-center justify-center text-white flex-shrink-0",
                      mode.color
                    )}>
                      {mode.icon}
                    </div>
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                      {mode.name}
                    </h3>
                  </div>

                  {/* Row 2: Description */}
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {mode.description}
                  </p>

                  {/* Row 3: Stats */}
                  {mode.cardCount !== undefined && mode.cardCount > 0 && (
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-500">
                      <span className="flex items-center gap-1">
                        <Target className="w-2.5 h-2.5" />
                        {mode.cardCount} {t('flashcards.cards')}
                      </span>
                      {mode.estimatedTime !== undefined && mode.estimatedTime > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {mode.estimatedTime} {t('common.minutes')}
                        </span>
                      )}
                    </div>
                  )}
                  {mode.cardCount === 0 && mode.id !== 'custom' && (
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-2.5 h-2.5" />
                      {t('flashcards.noCardsAvailable')}
                    </div>
                  )}
                </div>

                {selectedMode === mode.id && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Custom Mode Settings */}
          <AnimatePresence>
            {selectedMode === 'custom' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 p-4 bg-gray-50 dark:bg-dark-700 rounded-xl"
              >
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  {t('flashcards.customSettings')}
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('flashcards.cardLimit')}
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
                          onClick={() => setCustomSettings(prev => ({
                            ...prev,
                            cardLimit: preset
                          }))}
                          className={cn(
                            'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                            customSettings.cardLimit === preset
                              ? 'bg-primary-500 text-white'
                              : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                          )}
                        >
                          {preset === maxCards ? t('common.all') || 'All' : preset}
                        </button>
                      ))}
                    </div>

                    {/* Stepper controls */}
                    <div className="flex items-center justify-center gap-4 p-3 bg-gray-100 dark:bg-dark-800 rounded-lg">
                      <button
                        onClick={() => setCustomSettings(prev => ({
                          ...prev,
                          cardLimit: Math.max(1, prev.cardLimit - 1)
                        }))}
                        className="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-dark-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-600 transition-colors active:scale-95"
                        disabled={customSettings.cardLimit <= 1}
                      >
                        <span className="text-xl font-semibold text-gray-700 dark:text-gray-300">−</span>
                      </button>

                      <div className="flex flex-col items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          max={maxCards}
                          value={customSettings.cardLimit}
                          onChange={(e) => {
                            const value = Math.max(1, Math.min(maxCards, Number(e.target.value)));
                            setCustomSettings(prev => ({
                              ...prev,
                              cardLimit: value
                            }));
                          }}
                          className="w-16 px-2 py-2 text-center text-lg font-semibold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          of {maxCards} cards
                        </span>
                      </div>

                      <button
                        onClick={() => setCustomSettings(prev => ({
                          ...prev,
                          cardLimit: Math.min(maxCards, prev.cardLimit + 1)
                        }))}
                        className="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-dark-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-600 transition-colors active:scale-95"
                        disabled={customSettings.cardLimit >= maxCards}
                      >
                        <span className="text-xl font-semibold text-gray-700 dark:text-gray-300">+</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      {t('flashcards.includeCards')}
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customSettings.includeNew}
                          onChange={(e) => setCustomSettings(prev => ({
                            ...prev,
                            includeNew: e.target.checked
                          }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {t('flashcards.newCards')}
                        </span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customSettings.includeDue}
                          onChange={(e) => setCustomSettings(prev => ({
                            ...prev,
                            includeDue: e.target.checked
                          }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {t('flashcards.dueCards')}
                        </span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customSettings.includeMastered}
                          onChange={(e) => setCustomSettings(prev => ({
                            ...prev,
                            includeMastered: e.target.checked
                          }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {t('flashcards.masteredCards')}
                        </span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <Dropdown
                      label={t('flashcards.sortBy')}
                      value={customSettings.sortBy}
                      onChange={(value) => setCustomSettings(prev => ({
                        ...prev,
                        sortBy: value as 'priority' | 'random' | 'oldest'
                      }))}
                      options={[
                        { value: 'priority', label: t('flashcards.priority') },
                        { value: 'random', label: t('flashcards.random') },
                        { value: 'oldest', label: t('flashcards.oldest') },
                      ]}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={handleStartStudy}
              disabled={!selectedMode || (selectedMode !== 'custom' && modes.find(m => m.id === selectedMode)?.cardCount === 0)}
              data-testid="flashcards-start-study"
              className={cn(
                "w-full px-6 py-3 rounded-lg font-medium transition-all",
                selectedMode && (selectedMode === 'custom' || modes.find(m => m.id === selectedMode)?.cardCount !== 0)
                  ? "bg-gradient-to-r from-primary-500 to-purple-600 text-white hover:shadow-lg"
                  : "bg-gray-200 dark:bg-dark-700 text-gray-400 cursor-not-allowed"
              )}
            >
              {t('flashcards.startStudying')}
            </button>
            <button
              onClick={onClose}
              className="w-full px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors border border-gray-300 dark:border-dark-600"
            >
              {t('common.cancel')}
            </button>
          </div>

          {/* Mobile bottom nav spacer */}
        </div>
      </motion.div>
    </div>
  );
}
