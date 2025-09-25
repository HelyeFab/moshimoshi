'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Play, Edit2, Trash2, Download, Upload, TrendingUp, Clock, Target, BookOpen, RefreshCw } from 'lucide-react';
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
  showStats = true,
  gridCols = 3,
  isPremium = false
}: DeckGridProps) {
  const { t } = useI18n();

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
    return deck.cards.filter(card =>
      card.metadata?.nextReview && card.metadata.nextReview <= now
    ).length;
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

                {/* Action Buttons */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onStudyDeck && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onStudyDeck(deck); }}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur transition-colors"
                      aria-label={t('flashcards.startStudying')}
                    >
                      <Play className="w-4 h-4 text-white" />
                    </button>
                  )}
                  {onEditDeck && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditDeck(deck); }}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur transition-colors"
                      aria-label={t('flashcards.editDeck')}
                    >
                      <Edit2 className="w-4 h-4 text-white" />
                    </button>
                  )}
                  {onExportDeck && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onExportDeck(deck); }}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur transition-colors"
                      aria-label={t('flashcards.export.title')}
                    >
                      <Download className="w-4 h-4 text-white" />
                    </button>
                  )}
                  {onDeleteDeck && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteDeck(deck); }}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur transition-colors"
                      aria-label={t('flashcards.deleteDeck')}
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  )}
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

                {/* Sync Button for Premium Users */}
                {isPremium && onSyncDeck && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSyncDeck(deck);
                    }}
                    className="absolute bottom-3 right-3 p-2 rounded-full bg-primary-500 hover:bg-primary-600 text-white shadow-md hover:shadow-lg transition-all group/sync"
                    aria-label="Sync to Firebase"
                    title="Sync to Firebase"
                  >
                    <RefreshCw className="w-4 h-4 group-hover/sync:rotate-180 transition-transform duration-500" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}