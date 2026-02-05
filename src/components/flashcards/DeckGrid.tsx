'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Play, Edit2, Trash2, Download, Upload, TrendingUp, Clock, Target, BookOpen, RefreshCw, Settings, Settings2, ChevronDown, MoreVertical, ChevronRight, CheckSquare, Square, CloudOff, Cloud } from 'lucide-react';
import type { FlashcardDeck } from '@/types/flashcards';
import type { RestoreProgress } from '@/types/r2';
import { useI18n } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { BackupStatusBadge } from '@/components/anki/BackupStatusBadge';

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
  hideCreateCard?: boolean;
  restoreProgressByDeckId?: Record<string, RestoreProgress>;
  selectedDeckIds?: Set<string>;
  onToggleSelect?: (deckId: string) => void;
  onToggleAnkiBackup?: (deck: FlashcardDeck, enabled: boolean) => void;
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
  isPremium = false,
  hideCreateCard = false,
  restoreProgressByDeckId,
  selectedDeckIds,
  onToggleSelect,
  onToggleAnkiBackup
}: DeckGridProps) {
  const { t } = useI18n();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuActionInProgressRef = useRef(false);
  const selectionEnabled = Boolean(selectedDeckIds && onToggleSelect);
  const canEditDeck = (deck: FlashcardDeck) => isPremium && !deck.isStarter;
  const canDeleteDeck = () => isPremium;
  const canExportDeck = (deck: FlashcardDeck) => isPremium && !deck.isStarter;
  const canSyncDeck = (deck: FlashcardDeck) => isPremium && !deck.isStarter;
  const isAnkiDeck = (deck: FlashcardDeck) => deck.source === 'anki';
  const isR2BackupEnabled = (deck: FlashcardDeck) =>
    !isAnkiDeck(deck) || deck.metadata?.r2BackupEnabled !== false;

  // Track openMenuId changes
  useEffect(() => {
    console.log('[DeckGrid] openMenuId changed:', openMenuId);
  }, [openMenuId]);

  // Close menu when clicking outside - handle both mouse and touch events
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      console.log('[DeckGrid] Click outside detected', {
        type: event.type,
        insideMenu: menuRef.current && menuRef.current.contains(event.target as Node)
      });

      // Don't close if clicking inside the menu
      if (menuRef.current && menuRef.current.contains(event.target as Node)) {
        return;
      }
      if (openMenuId !== null) {
        console.log('[DeckGrid] Closing menu via outside click');
        setOpenMenuId(null);
      }
    }

    // Only use click events - they fire after touch events complete on mobile
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
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
    const now = Date.now();
    const newCardsPerDay = deck.settings?.newCardsPerDay ?? 20;
    const reviewsPerDay = deck.settings?.reviewsPerDay ?? 100;

    const newCards = deck.cards.filter(card => !card.metadata?.status || card.metadata.status === 'new');
    const reviewCards = deck.cards.filter(card =>
      card.metadata?.status &&
      card.metadata.status !== 'new' &&
      card.metadata.nextReview &&
      card.metadata.nextReview <= now
    );

    const limitedNew = Math.min(newCards.length, newCardsPerDay);
    const limitedReviews = Math.min(reviewCards.length, reviewsPerDay);

    return limitedNew + limitedReviews;
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  const getRestorePercent = (progress?: RestoreProgress) => {
    if (!progress) return 0;
    if (typeof progress.progress === 'number') return progress.progress;
    if (!progress.totalFiles) return 0;
    return (progress.filesDownloaded / progress.totalFiles) * 100;
  };

  const getRestoreState = (deck: FlashcardDeck) => {
    const progress = restoreProgressByDeckId?.[deck.id];
    if (progress) {
      return {
        progress,
        isRestoring: progress.phase !== 'complete',
        isError: progress.phase === 'error',
      };
    }
    if (deck.restoreStatus) {
      return {
        progress: {
          phase: deck.restoreStatus === 'error' ? 'error' : 'fetching-metadata',
          filesDownloaded: 0,
          totalFiles: 0,
          progress: 0,
        } as RestoreProgress,
        isRestoring: true,
        isError: deck.restoreStatus === 'error',
      };
    }
    return { progress: undefined, isRestoring: false, isError: false };
  };

  // Render dropdown menu (shared between mobile and desktop)
  const renderDropdownMenu = (deck: FlashcardDeck, isMobile = false) => (
    <AnimatePresence>
      {openMenuId === deck.id && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "rounded-lg bg-white dark:bg-dark-800 shadow-xl border border-gray-200 dark:border-dark-700 py-2 z-50",
            isMobile ? "w-full max-w-[240px] relative" : "absolute top-12 right-1.5 w-56"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Study Options */}
          {onStudyDeck && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                menuActionInProgressRef.current = true;
                setOpenMenuId(null);
                setTimeout(() => {
                  onStudyDeck(deck);
                  setTimeout(() => {
                    menuActionInProgressRef.current = false;
                  }, 300);
                }, 50);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors flex items-center gap-3"
            >
              <Play className="w-4 h-4" />
              {t('flashcards.startStudying')}
            </button>
          )}

          {/* Session Settings */}
          {onSessionSettings && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                menuActionInProgressRef.current = true;
                setOpenMenuId(null);
                setTimeout(() => {
                  onSessionSettings(deck);
                  setTimeout(() => {
                    menuActionInProgressRef.current = false;
                  }, 300);
                }, 50);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors flex items-center gap-3"
            >
              <Settings2 className="w-4 h-4" />
              {t('flashcards.settings.quickSettings')}
            </button>
          )}

          <div className="border-t border-gray-200 dark:border-dark-700 my-1" />

          {/* Management Options */}
          {onEditDeck && canEditDeck(deck) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                menuActionInProgressRef.current = true;
                setOpenMenuId(null);
                setTimeout(() => {
                  onEditDeck(deck);
                  setTimeout(() => {
                    menuActionInProgressRef.current = false;
                  }, 300);
                }, 50);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors flex items-center gap-3"
            >
              <Edit2 className="w-4 h-4" />
              {t('flashcards.editDeck')}
            </button>
          )}

          {onDeleteDeck && canDeleteDeck() && (
            <button
              onClick={(e) => {
                console.log('[DeckGrid Menu] Delete clicked', {
                  deckId: deck.id,
                  deckName: deck.name,
                  event: e.type,
                  timestamp: Date.now()
                });
                e.stopPropagation();
                e.preventDefault();

                console.log('[DeckGrid Menu] Setting menuActionInProgress = true');
                menuActionInProgressRef.current = true;

                console.log('[DeckGrid Menu] Closing menu');
                setOpenMenuId(null);

                // Small delay to ensure menu closes before action
                setTimeout(() => {
                  console.log('[DeckGrid Menu] Calling onDeleteDeck after 50ms delay');
                  onDeleteDeck(deck);
                  setTimeout(() => {
                    console.log('[DeckGrid Menu] Setting menuActionInProgress = false after 300ms');
                    menuActionInProgressRef.current = false;
                  }, 300);
                }, 50);
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-3"
            >
              <Trash2 className="w-4 h-4" />
              {t('flashcards.deleteDeck')}
            </button>
          )}

          {onExportDeck && canExportDeck(deck) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                menuActionInProgressRef.current = true;
                setOpenMenuId(null);
                setTimeout(() => {
                  onExportDeck(deck);
                  setTimeout(() => {
                    menuActionInProgressRef.current = false;
                  }, 300);
                }, 50);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors flex items-center gap-3"
            >
              <Download className="w-4 h-4" />
              {t('flashcards.export.title')}
            </button>
          )}

          {onToggleAnkiBackup && isPremium && isAnkiDeck(deck) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                menuActionInProgressRef.current = true;
                setOpenMenuId(null);
                const nextEnabled = !isR2BackupEnabled(deck);
                setTimeout(() => {
                  onToggleAnkiBackup(deck, nextEnabled);
                  setTimeout(() => {
                    menuActionInProgressRef.current = false;
                  }, 300);
                }, 50);
              }}
              className={cn(
                "w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-3",
                isR2BackupEnabled(deck)
                  ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700"
              )}
            >
              {isR2BackupEnabled(deck) ? (
                <>
                  <CloudOff className="w-4 h-4" />
                  {t('flashcards.ankiBackup.disable')}
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4" />
                  {t('flashcards.ankiBackup.enable')}
                </>
              )}
            </button>
          )}

          {/* Premium Sync Option */}
          {onSyncDeck && canSyncDeck(deck) && (
            <>
              <div className="border-t border-gray-200 dark:border-dark-700 my-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  menuActionInProgressRef.current = true;
                  setOpenMenuId(null);
                  setTimeout(() => {
                    onSyncDeck(deck);
                    setTimeout(() => {
                      menuActionInProgressRef.current = false;
                    }, 300);
                  }, 50);
                }}
                className="w-full px-4 py-2 text-left text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors flex items-center gap-3"
              >
                <RefreshCw className="w-4 h-4" />
                {t('flashcards.syncToCloud')}
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* ========== MOBILE LIST VIEW (< 640px) ========== */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="sm:hidden space-y-2"
      >

        {/* Empty State */}
        {decks.length === 0 && (
          <motion.div
            variants={itemVariants}
            className="text-center py-12 px-6"
          >
            <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 dark:bg-dark-700 rounded-full flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('flashcards.noDecksYet')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('flashcards.noDecksDescription')}
            </p>
          </motion.div>
        )}

        {/* Deck List Items */}
        {decks.map((deck) => {
          const dueCount = getDueCount(deck);
          const { progress: restoreProgress, isRestoring, isError } = getRestoreState(deck);
          const restorePercent = Math.max(0, Math.min(100, getRestorePercent(restoreProgress)));
          const isSelected = selectionEnabled ? selectedDeckIds!.has(deck.id) : false;

          return (
            <motion.div
              key={deck.id}
              variants={itemVariants}
              initial="hidden"
              animate="show"
              whileTap={{ scale: 0.98 }}
              onClick={(e) => {
                console.log('[DeckGrid Mobile] Deck card clicked', {
                  deckId: deck.id,
                  deckName: deck.name,
                  openMenuId,
                  menuActionInProgress: menuActionInProgressRef.current,
                  isRestoring,
                  willBlock: openMenuId !== null || menuActionInProgressRef.current
                });

                // Don't trigger deck click if menu is open or menu action in progress
                if (openMenuId !== null || menuActionInProgressRef.current) {
                  console.log('[DeckGrid Mobile] Deck click BLOCKED');
                  e.stopPropagation();
                  e.preventDefault();
                  return;
                }

                console.log('[DeckGrid Mobile] Deck click ALLOWED - calling onDeckClick');
                if (!isRestoring) onDeckClick(deck);
              }}
              data-testid="flashcards-deck-card"
              data-deck-name={deck.name}
              className={cn(
                "relative bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 cursor-pointer active:bg-gray-50 dark:active:bg-dark-700 transition-colors",
                isRestoring && "cursor-not-allowed opacity-60"
              )}
            >
              {/* Color Accent Border */}
              <div className={cn(
                'absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b rounded-l-lg',
                getColorClasses(deck.color)
              )} />

              {/* Due Badge - Bottom Right Corner */}
              {dueCount > 0 && (
                <div className="absolute bottom-3 right-3">
                  <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full shadow-sm">
                    {dueCount} {t('flashcards.due')}
                  </span>
                </div>
              )}

              <div className="p-4 pl-5 space-y-3">
                {/* Row 1: Emoji + Deck Name + Menu */}
                <div className="flex items-start gap-3">
                  {/* Selection Checkbox */}
                  {selectionEnabled && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect?.(deck.id);
                      }}
                      className="flex-shrink-0 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                      aria-label={isSelected ? 'Deselect deck' : 'Select deck'}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      )}
                    </button>
                  )}

                  {/* Emoji Indicator - Only show if emoji exists */}
                  {deck.emoji && (
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center">
                      <span className="text-xl">{deck.emoji}</span>
                    </div>
                  )}

                  {/* Deck Name - More prominent */}
                  <h3 className="flex-1 text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug pt-0.5 line-clamp-2 min-w-0">
                    {deck.name}
                  </h3>

                  {/* Menu Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('[DeckGrid Mobile] Menu button clicked', {
                        deckId: deck.id,
                        deckName: deck.name,
                        currentOpenMenuId: openMenuId,
                        willOpen: openMenuId !== deck.id
                      });
                      if (isRestoring) return;
                      setOpenMenuId(openMenuId === deck.id ? null : deck.id);
                    }}
                    disabled={isRestoring}
                    data-testid="flashcards-deck-menu"
                    data-deck-name={deck.name}
                    className="flex-shrink-0 p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors touch-manipulation"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <MoreVertical className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Row 2: Stats - Card Count */}
                <div className={cn(
                  "flex items-center gap-2 flex-wrap",
                  deck.emoji && "pl-13" // Only add left padding if emoji exists
                )}>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {deck.stats.totalCards} {deck.stats.totalCards === 1 ? 'term' : 'terms'}
                  </span>
                </div>

                {/* Row 3: Backup Status Badge (separate line to prevent layout jump) */}
                {deck.source === 'anki' && isPremium && isR2BackupEnabled(deck) && (
                  <div className={cn(
                    deck.emoji && "pl-13" // Match alignment with stats above
                  )}>
                    <BackupStatusBadge deckId={deck.id} />
                  </div>
                )}
                {deck.source === 'anki' && isPremium && !isR2BackupEnabled(deck) && (
                  <div className={cn(deck.emoji && "pl-13")}>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {t('flashcards.ankiBackup.localOnly')}
                    </span>
                  </div>
                )}

                {restoreProgress && (
                  <div className={cn(deck.emoji && "pl-13")}>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>{isError ? 'Restore failed' : 'Restoring...'}</span>
                      {!isError && (
                        <span>{Math.round(restorePercent)}%</span>
                      )}
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-1.5">
                      <div
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          isError
                            ? "bg-red-500"
                            : "bg-gradient-to-r from-primary-400 to-purple-500"
                        )}
                        style={{ width: `${Math.max(2, restorePercent)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ========== MOBILE MENU OVERLAY (rendered outside deck cards) ========== */}
      {openMenuId && decks.find(d => d.id === openMenuId) && (
        <div className="sm:hidden">
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              console.log('[DeckGrid Mobile] Menu overlay clicked');
              e.stopPropagation();
            }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/30"
              onClick={(e) => {
                console.log('[DeckGrid Mobile] Backdrop clicked - closing menu');
                e.stopPropagation();
                setOpenMenuId(null);
              }}
            />
            {/* Menu */}
            {renderDropdownMenu(decks.find(d => d.id === openMenuId)!, true)}
          </div>
        </div>
      )}

      {/* ========== DESKTOP GRID VIEW (>= 640px) ========== */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className={cn(
          'hidden sm:grid gap-4',
          gridCols === 2 && 'grid-cols-2',
          gridCols === 3 && 'grid-cols-2 lg:grid-cols-3',
          gridCols === 4 && 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        )}
      >
        {/* Create New Deck Card */}
        {!hideCreateCard && (
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onCreateDeck}
            data-testid="flashcards-create-deck"
            className="relative group cursor-pointer max-w-sm mx-auto w-full"
          >
            <div className="h-48 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-dark-800 flex flex-col items-center justify-center gap-3 hover:border-primary-400 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all">
              <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <p className="text-base font-medium text-gray-700 dark:text-gray-300">
                {t('flashcards.createDeck')}
              </p>
            </div>
          </motion.div>
        )}

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
          const { progress: restoreProgress, isRestoring, isError } = getRestoreState(deck);
          const restorePercent = Math.max(0, Math.min(100, getRestorePercent(restoreProgress)));
          const isSelected = selectionEnabled ? selectedDeckIds!.has(deck.id) : false;

          return (
            <motion.div
              key={deck.id}
              variants={itemVariants}
              initial="hidden"
              animate="show"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "relative group cursor-pointer max-w-sm mx-auto w-full",
                isRestoring && "cursor-not-allowed opacity-60"
              )}
              data-testid="flashcards-deck-card"
              data-deck-name={deck.name}
              onClick={() => {
                if (!isRestoring) onDeckClick(deck);
              }}
            >
              <div className="h-48 rounded-xl bg-white dark:bg-dark-800 shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
                {/* Gradient Header */}
                <div className={cn(
                  'h-16 bg-gradient-to-br flex items-center justify-center relative',
                  getColorClasses(deck.color)
                )}>
                  <span className="text-3xl">{deck.emoji}</span>

                  {/* Selection Checkbox */}
                  {selectionEnabled && (
                    <div className="absolute top-1.5 left-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSelect?.(deck.id);
                        }}
                        className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur transition-colors"
                        aria-label={isSelected ? 'Deselect deck' : 'Select deck'}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-white" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* Menu Button */}
                  <div className="absolute top-1.5 right-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('[DeckGrid Desktop] Menu button clicked', {
                          deckId: deck.id,
                          deckName: deck.name,
                          currentOpenMenuId: openMenuId,
                          willOpen: openMenuId !== deck.id
                        });
                        if (isRestoring) return;
                        setOpenMenuId(openMenuId === deck.id ? null : deck.id);
                      }}
                      disabled={isRestoring}
                      data-testid="flashcards-deck-menu"
                      data-deck-name={deck.name}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur transition-colors touch-manipulation"
                      style={{ touchAction: 'manipulation' }}
                      aria-label={t('common.settings')}
                    >
                      <MoreVertical className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>

                  {/* Due Badge */}
                  {dueCount > 0 && (
                    <div className="absolute -bottom-2.5 left-3 px-2.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full shadow-sm">
                      {dueCount} {t('flashcards.due')}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-3 flex flex-col h-32">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100 break-words line-clamp-1 flex-1">
                      {deck.name}
                    </h3>
                  </div>

                  {/* Backup Status Badge for Anki Decks */}
                  {deck.source === 'anki' && isPremium && isR2BackupEnabled(deck) && (
                    <div className="mb-1">
                      <BackupStatusBadge deckId={deck.id} />
                    </div>
                  )}
                  {deck.source === 'anki' && isPremium && !isR2BackupEnabled(deck) && (
                    <div className="mb-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {t('flashcards.ankiBackup.localOnly')}
                      </span>
                    </div>
                  )}

                  {restoreProgress && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>{isError ? 'Restore failed' : 'Restoring...'}</span>
                        {!isError && (
                          <span>{Math.round(restorePercent)}%</span>
                        )}
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-1.5">
                        <div
                          className={cn(
                            "h-1.5 rounded-full transition-all",
                            isError
                              ? "bg-red-500"
                              : "bg-gradient-to-r from-primary-400 to-purple-500"
                          )}
                          style={{ width: `${Math.max(2, restorePercent)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {deck.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-1">
                      {deck.description}
                    </p>
                  )}

                  <div className="mt-auto space-y-1.5">
                    {/* Card Count */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 dark:text-gray-500 font-medium">
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
                      <div className="flex items-center gap-2.5 text-xs">
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
                    {deck.stats.totalCards > 0 && !restoreProgress && (
                      <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-1">
                        <div
                          className="bg-gradient-to-r from-primary-400 to-primary-600 h-1 rounded-full transition-all"
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

              {/* Dropdown Menu - Positioned outside overflow-hidden to prevent clipping */}
              {renderDropdownMenu(deck)}
            </motion.div>
          );
        })}
      </motion.div>
    </>
  );
}
