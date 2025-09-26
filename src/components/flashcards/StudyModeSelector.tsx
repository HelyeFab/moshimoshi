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
  const [customSettings, setCustomSettings] = useState({
    cardLimit: 20,
    includeNew: true,
    includeDue: true,
    includeMastered: false,
    sortBy: 'priority' as 'priority' | 'random' | 'oldest'
  });

  // Calculate card counts for each mode
  const now = Date.now();
  const dueCards = deck.cards.filter(card => {
    if (!card.metadata?.status || card.metadata.status === 'new') return false;
    return card.metadata.nextReview && card.metadata.nextReview <= now;
  });

  const newCards = deck.cards.filter(card =>
    !card.metadata?.status || card.metadata.status === 'new'
  );

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
      icon: <Clock className="w-6 h-6" />,
      color: 'from-blue-500 to-indigo-600',
      cardCount: dueCards.length,
      estimatedTime: Math.ceil((dueCards.length * 3) / 60)
    },
    {
      id: 'new',
      name: t('flashcards.modes.new.name'),
      description: t('flashcards.modes.new.description'),
      icon: <Sparkles className="w-6 h-6" />,
      color: 'from-green-500 to-emerald-600',
      cardCount: newCards.length,
      estimatedTime: Math.ceil((newCards.length * 4) / 60)
    },
    {
      id: 'all',
      name: t('flashcards.modes.all.name'),
      description: t('flashcards.modes.all.description'),
      icon: <BookOpen className="w-6 h-6" />,
      color: 'from-purple-500 to-pink-600',
      cardCount: deck.cards.length,
      estimatedTime: Math.ceil((deck.cards.length * 3) / 60)
    },
    {
      id: 'cramming',
      name: t('flashcards.modes.cramming.name'),
      description: t('flashcards.modes.cramming.description'),
      icon: <Zap className="w-6 h-6" />,
      color: 'from-yellow-500 to-orange-600',
      cardCount: Math.min(50, deck.cards.length),
      estimatedTime: 15
    },
    {
      id: 'speed',
      name: t('flashcards.modes.speed.name'),
      description: t('flashcards.modes.speed.description'),
      icon: <Timer className="w-6 h-6" />,
      color: 'from-red-500 to-rose-600',
      cardCount: Math.min(20, deck.cards.length),
      estimatedTime: 5
    },
    {
      id: 'weakness',
      name: t('flashcards.modes.weakness.name'),
      description: t('flashcards.modes.weakness.description'),
      icon: <TrendingDown className="w-6 h-6" />,
      color: 'from-amber-500 to-orange-600',
      cardCount: weakCards.length,
      estimatedTime: Math.ceil((weakCards.length * 4) / 60)
    },
    {
      id: 'custom',
      name: t('flashcards.modes.custom.name'),
      description: t('flashcards.modes.custom.description'),
      icon: <Brain className="w-6 h-6" />,
      color: 'from-gray-500 to-gray-700',
      cardCount: 0,
      estimatedTime: 0
    }
  ];

  const getCardsForMode = (mode: StudyModeType): FlashcardContent[] => {
    let cards: FlashcardContent[] = [];

    switch (mode) {
      case 'due':
        cards = [...dueCards, ...newCards.slice(0, 5)]; // Add some new cards
        break;

      case 'new':
        cards = newCards;
        break;

      case 'all':
        cards = [...deck.cards];
        break;

      case 'cramming':
        // High frequency review of recent and difficult cards
        cards = [...dueCards, ...weakCards].slice(0, 50);
        if (cards.length < 20) {
          cards.push(...deck.cards.slice(0, 20 - cards.length));
        }
        break;

      case 'speed':
        // Random selection for speed practice
        cards = [...deck.cards].sort(() => Math.random() - 0.5).slice(0, 20);
        break;

      case 'weakness':
        cards = weakCards;
        if (cards.length < 10) {
          // Add some due cards if not enough weak cards
          cards.push(...dueCards.slice(0, 10 - cards.length));
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
        className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {t('flashcards.selectStudyMode')}
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {deck.name} • {deck.cards.length} {t('flashcards.totalCards')}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modes.map((mode) => (
              <motion.div
                key={mode.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedMode(mode.id)}
                className={cn(
                  "relative p-4 rounded-xl cursor-pointer transition-all",
                  selectedMode === mode.id
                    ? "ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20"
                    : "bg-gray-50 dark:bg-dark-700 hover:shadow-md"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center text-white",
                    mode.color
                  )}>
                    {mode.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {mode.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {mode.description}
                    </p>
                    {mode.cardCount !== undefined && mode.cardCount > 0 && (
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-500">
                        <span className="flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          {mode.cardCount} {t('flashcards.cards')}
                        </span>
                        {mode.estimatedTime !== undefined && mode.estimatedTime > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {mode.estimatedTime} {t('common.minutes')}
                          </span>
                        )}
                      </div>
                    )}
                    {mode.cardCount === 0 && mode.id !== 'custom' && (
                      <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {t('flashcards.noCardsAvailable')}
                      </div>
                    )}
                  </div>
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
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('flashcards.cardLimit')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={deck.cards.length}
                      value={customSettings.cardLimit}
                      onChange={(e) => setCustomSettings(prev => ({
                        ...prev,
                        cardLimit: parseInt(e.target.value) || 1
                      }))}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
                    />
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
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('flashcards.sortBy')}
                    </label>
                    <select
                      value={customSettings.sortBy}
                      onChange={(e) => setCustomSettings(prev => ({
                        ...prev,
                        sortBy: e.target.value as 'priority' | 'random' | 'oldest'
                      }))}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="priority">{t('flashcards.priority')}</option>
                      <option value="random">{t('flashcards.random')}</option>
                      <option value="oldest">{t('flashcards.oldest')}</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleStartStudy}
              disabled={!selectedMode || (selectedMode !== 'custom' && modes.find(m => m.id === selectedMode)?.cardCount === 0)}
              className={cn(
                "px-6 py-2 rounded-lg font-medium transition-all",
                selectedMode && (selectedMode === 'custom' || modes.find(m => m.id === selectedMode)?.cardCount !== 0)
                  ? "bg-gradient-to-r from-primary-500 to-purple-600 text-white hover:shadow-lg"
                  : "bg-gray-200 dark:bg-dark-700 text-gray-400 cursor-not-allowed"
              )}
            >
              {t('flashcards.startStudying')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}