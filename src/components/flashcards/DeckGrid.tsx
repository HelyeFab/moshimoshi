'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Play, Edit2, Trash2, Download, Upload, TrendingUp, Clock, Target, BookOpen, RefreshCw, Settings, Settings2, ChevronDown, MoreVertical, Sliders } from 'lucide-react';
import type { FlashcardDeck } from '@/types/flashcards';
import { useI18n } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface DeckGridProps {
  decks: FlashcardDeck[];
  onDeckClick: (deck: FlashcardDeck) => void;
  onCreateDeck: () => void;
  onEditDeck?: (deck: FlashcardDeck) => void;
  onDeleteDeck?: (deck: FlashcardDeck) => void;
  onExportDeck?: (deck: FlashcardDeck) => void;
  onStudyDeck?: (deck: FlashcardDeck) => void;
  onSyncDeck?: (deck: FlashcardDeck) => void;
  onSessionSettings?: (deck: FlashcardDeck) => void;
  showStats?: boolean;
  gridCols?: 2 | 3 | 4;
  isPremium?: boolean;
}

export function DeckGrid({
  decks,
  onDeckClick,
  onCreateDeck,
  onEditDeck,
  onDeleteDeck,
  onExportDeck,
  onStudyDeck,
  onSyncDeck,
  onSessionSettings,
  showStats = true,
  gridCols = 3,
  isPremium = false
}: DeckGridProps) {
  const { t } = useI18n();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (openMenuId !== null) {
        setOpenMenuId(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      primary: 'from-pink-400 to-pink-600',
      ocean: 'from-blue-400 to-blue-600',
      matcha: 'from-green-400 to-green-600',
      sunset: 'from-orange-400 to-red-600',
      lavender: 'from-purple-400 to-purple-600',
      monochrome: 'from-gray-400 to-gray-600'
    };
    return colors[color] || colors.primary;
  };

  const getDueCount = (deck: FlashcardDeck) => {
    // Calculate cards due for review
    const now = Date.now();
    return deck.cards.filter(card => {
      // New cards are always due
      if (!card.metadata?.status || card.metadata.status === 'new') {
        return true;
      }
      // Check if card's next review time has passed
      return card.metadata?.nextReview && card.metadata.nextReview <= now;
    }).length;
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={cn(
        'grid gap-6',
        gridCols === 2 && 'grid-cols-1 sm:grid-cols-2',
        gridCols === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        gridCols === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      )}
    >
      {/* Create New Deck Card */}
      <motion.div
        variants={itemVariants}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onCreateDeck}
        className="relative group cursor-pointer"
      >
        <div className="h-64 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-dark-800 flex flex-col items-center justify-center gap-4 hover:border-primary-400 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all">
          <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Plus className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
            {t('flashcards.createDeck')}
          </p>
        </div>
      </motion.div>

      {/* Empty State */}
      {decks.length === 0 && (
        <motion.div
          variants={itemVariants}
          className="col-span-full"
        >
          <div className="text-center py-12 px-6 bg-white dark:bg-dark-800 rounded-2xl shadow-lg">
            <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 dark:bg-dark-700 rounded-full flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('flashcards.noDecksYet')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              {t('flashcards.noDecksDescription')}
            </p>
            <button
              onClick={onCreateDeck}
              className="px-6 py-3 bg-gradient-to-r from-primary-500 to-purple-500 text-white rounded-lg font-medium hover:shadow-lg transform hover:scale-105 transition-all"
            >
              {t('flashcards.createFirstDeck')}
            </button>
          </div>
        </motion.div>
      )}

      {/* Deck Cards */}
      {decks.map((deck) => {
        const dueCount = getDueCount(deck);
        const accuracy = deck.stats.totalStudied > 0
          ? Math.round(deck.stats.averageAccuracy * 100)
          : 0;

        return (
          <motion.div
            key={deck.id}
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="relative group cursor-pointer"
            onClick={() => onDeckClick(deck)}
          >
            <div className="h-64 rounded-2xl bg-white dark:bg-dark-800 shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
              {/* Gradient Header */}
              <div className={cn(
                'h-24 bg-gradient-to-br flex items-center justify-center relative',
                getColorClasses(deck.color)
              )}>
                <span className="text-4xl">{deck.emoji}</span>

                {/* Settings Menu Button - Always Visible */}
                <div className="absolute top-2 right-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === deck.id ? null : deck.id);
                    }}
                    className="p-2 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur transition-colors"
                    aria-label={t('common.settings')}
                  >
                    <Settings className="w-4 h-4 text-white" />
                  </button>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {openMenuId === deck.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-56 rounded-lg bg-white dark:bg-dark-800 shadow-xl border border-gray-200 dark:border-dark-700 py-2 z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Study Options */}
                        {onStudyDeck && (
                          <button
                            onClick={() => {
                              onStudyDeck(deck);
                              setOpenMenuId(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors flex items-center gap-3"
                          >
                            <Play className="w-4 h-4" />
                            {t('flashcards.startStudying')}
                          </button>
                        )}

                        {onSessionSettings && (
                          <button
                            onClick={() => {
                              onSessionSettings(deck);
                              setOpenMenuId(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors flex items-center gap-3"
                          >
                            <Sliders className="w-4 h-4" />
                            {t('flashcards.settings.quickSettings')}
                          </button>
                        )}

                        <div className="border-t border-gray-200 dark:border-dark-700 my-1" />

                        {/* Management Options */}
                        {onEditDeck && (
                          <button
                            onClick={() => {
                              onEditDeck(deck);
                              setOpenMenuId(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors flex items-center gap-3"
                          >
                            <Edit2 className="w-4 h-4" />
                            {t('flashcards.editDeck')}
                          </button>
                        )}

                        {onExportDeck && (
                          <button
                            onClick={() => {
                              onExportDeck(deck);
                              setOpenMenuId(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors flex items-center gap-3"
                          >
                            <Download className="w-4 h-4" />
                            {t('flashcards.export.title')}
                          </button>
                        )}

                        {/* Premium Sync Option */}
                        {isPremium && onSyncDeck && (
                          <>
                            <div className="border-t border-gray-200 dark:border-dark-700 my-1" />
                            <button
                              onClick={() => {
                                onSyncDeck(deck);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors flex items-center gap-3"
                            >
                              <RefreshCw className="w-4 h-4" />
                              {t('flashcards.syncToCloud')}
                            </button>
                          </>
                        )}

                        {/* Delete Option */}
                        {onDeleteDeck && (
                          <>
                            <div className="border-t border-gray-200 dark:border-dark-700 my-1" />
                            <button
                              onClick={() => {
                                onDeleteDeck(deck);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-3"
                            >
                              <Trash2 className="w-4 h-4" />
                              {t('flashcards.deleteDeck')}
                            </button>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Due Badge */}
                {dueCount > 0 && (
                  <div className="absolute -bottom-3 left-4 px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                    {dueCount} {t('flashcards.due')}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4 flex flex-col h-40">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-1 break-words line-clamp-2">
                  {deck.name}
                </h3>

                {deck.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                    {deck.description}
                  </p>
                )}

                <div className="mt-auto space-y-2">
                  {/* Card Count */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-500">
                      {t('flashcards.totalCards', { count: deck.stats.totalCards })}
                    </span>
                    {deck.stats.lastStudied && (
                      <span className="text-gray-400 dark:text-gray-600 text-xs">
                        {formatDistanceToNow(deck.stats.lastStudied, { addSuffix: true })}
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  {showStats && deck.stats.totalStudied > 0 && (
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <Target className="w-3 h-3 text-green-500" />
                        <span className="text-gray-600 dark:text-gray-400">{accuracy}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-blue-500" />
                        <span className="text-gray-600 dark:text-gray-400">
                          {deck.stats.currentStreak}d
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-purple-500" />
                        <span className="text-gray-600 dark:text-gray-400">
                          {Math.round(deck.stats.totalTimeSpent / 60000)}m
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Progress Bar */}
                  {deck.stats.totalCards > 0 && (
                    <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-primary-400 to-primary-600 h-1.5 rounded-full transition-all"
                        style={{
                          width: `${Math.round(
                            ((deck.stats.reviewCards + deck.stats.masteredCards) / deck.stats.totalCards) * 100
                          )}%`
                        }}
                      />
                    </div>
                  )}
                </div>

              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}