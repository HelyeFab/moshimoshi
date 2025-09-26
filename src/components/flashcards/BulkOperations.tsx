'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Trash2, Download, Upload, Edit3, Merge, Archive,
  CheckSquare, Square, ChevronDown, AlertCircle, Loader2
} from 'lucide-react';
import type { FlashcardDeck } from '@/types/flashcards';
import { useI18n } from '@/i18n/I18nContext';
import { flashcardManager } from '@/lib/flashcards/FlashcardManager';
import { dbOptimizer } from '@/lib/flashcards/IndexedDBOptimizer';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast/ToastContext';

interface BulkOperationsProps {
  decks: FlashcardDeck[];
  selectedDeckIds: Set<string>;
  onSelectionChange: (deckIds: Set<string>) => void;
  onOperationComplete: () => void;
  userId: string;
  isPremium: boolean;
}

type BulkAction = 'delete' | 'export' | 'merge' | 'duplicate' | 'archive' | 'tag';

export function BulkOperations({
  decks,
  selectedDeckIds,
  onSelectionChange,
  onOperationComplete,
  userId,
  isPremium
}: BulkOperationsProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentAction, setCurrentAction] = useState<BulkAction | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    action: BulkAction | null;
    message: string;
  }>({ isOpen: false, action: null, message: '' });

  const selectedDecks = decks.filter(deck => selectedDeckIds.has(deck.id));
  const isAllSelected = decks.length > 0 && selectedDeckIds.size === decks.length;
  const isPartiallySelected = selectedDeckIds.size > 0 && selectedDeckIds.size < decks.length;

  // Toggle all selection
  const handleToggleAll = useCallback(() => {
    if (isAllSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(decks.map(d => d.id)));
    }
  }, [isAllSelected, decks, onSelectionChange]);

  // Toggle single deck selection
  const handleToggleDeck = useCallback((deckId: string) => {
    const newSelection = new Set(selectedDeckIds);
    if (newSelection.has(deckId)) {
      newSelection.delete(deckId);
    } else {
      newSelection.add(deckId);
    }
    onSelectionChange(newSelection);
  }, [selectedDeckIds, onSelectionChange]);

  // Bulk delete
  const handleBulkDelete = async () => {
    setIsProcessing(true);
    setCurrentAction('delete');

    try {
      // Use bulk operation for better performance
      await dbOptimizer.bulkDeleteDecks(Array.from(selectedDeckIds));

      showToast(
        t('flashcards.bulk.deleteSuccess', { count: selectedDeckIds.size }),
        'success'
      );

      onSelectionChange(new Set());
      onOperationComplete();
    } catch (error) {
      console.error('Bulk delete failed:', error);
      showToast(t('flashcards.bulk.deleteFailed'), 'error');
    } finally {
      setIsProcessing(false);
      setCurrentAction(null);
      setConfirmDialog({ isOpen: false, action: null, message: '' });
    }
  };

  // Bulk export
  const handleBulkExport = async () => {
    setIsProcessing(true);
    setCurrentAction('export');

    try {
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        decks: selectedDecks.map(deck => ({
          name: deck.name,
          description: deck.description,
          emoji: deck.emoji,
          color: deck.color,
          cards: deck.cards.map(card => ({
            front: card.front.text,
            frontHint: card.front.subtext,
            back: card.back.text,
            backHint: card.back.subtext,
            tags: card.metadata?.tags,
            notes: card.metadata?.notes
          })),
          settings: deck.settings,
          stats: deck.stats
        }))
      };

      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flashcards_bulk_export_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showToast(
        t('flashcards.bulk.exportSuccess', { count: selectedDeckIds.size }),
        'success'
      );
    } catch (error) {
      console.error('Bulk export failed:', error);
      showToast(t('flashcards.bulk.exportFailed'), 'error');
    } finally {
      setIsProcessing(false);
      setCurrentAction(null);
    }
  };

  // Bulk merge
  const handleBulkMerge = async () => {
    setIsProcessing(true);
    setCurrentAction('merge');

    try {
      // Merge all selected decks into a new deck
      const mergedCards = selectedDecks.flatMap(deck => deck.cards);
      const mergedDeck = {
        name: t('flashcards.bulk.mergedDeckName'),
        description: t('flashcards.bulk.mergedDeckDescription', {
          count: selectedDecks.length
        }),
        emoji: '🔀',
        color: 'purple' as const,
        initialCards: mergedCards
      };

      await flashcardManager.createDeck(mergedDeck, userId, isPremium);

      showToast(
        t('flashcards.bulk.mergeSuccess', { count: selectedDeckIds.size }),
        'success'
      );

      onSelectionChange(new Set());
      onOperationComplete();
    } catch (error) {
      console.error('Bulk merge failed:', error);
      showToast(t('flashcards.bulk.mergeFailed'), 'error');
    } finally {
      setIsProcessing(false);
      setCurrentAction(null);
      setConfirmDialog({ isOpen: false, action: null, message: '' });
    }
  };

  // Bulk duplicate
  const handleBulkDuplicate = async () => {
    setIsProcessing(true);
    setCurrentAction('duplicate');

    try {
      const duplicatedDecks = selectedDecks.map(deck => ({
        ...deck,
        id: undefined, // Let the system generate new IDs
        name: `${deck.name} (${t('common.copy')})`,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }));

      // Use bulk create for better performance
      await dbOptimizer.bulkCreateDecks(duplicatedDecks as FlashcardDeck[]);

      showToast(
        t('flashcards.bulk.duplicateSuccess', { count: selectedDeckIds.size }),
        'success'
      );

      onSelectionChange(new Set());
      onOperationComplete();
    } catch (error) {
      console.error('Bulk duplicate failed:', error);
      showToast(t('flashcards.bulk.duplicateFailed'), 'error');
    } finally {
      setIsProcessing(false);
      setCurrentAction(null);
    }
  };

  // Show confirmation dialog
  const showConfirmation = (action: BulkAction) => {
    const messages: Record<BulkAction, string> = {
      delete: t('flashcards.bulk.confirmDelete', { count: selectedDeckIds.size }),
      export: '',
      merge: t('flashcards.bulk.confirmMerge', { count: selectedDeckIds.size }),
      duplicate: '',
      archive: t('flashcards.bulk.confirmArchive', { count: selectedDeckIds.size }),
      tag: ''
    };

    if (messages[action]) {
      setConfirmDialog({
        isOpen: true,
        action,
        message: messages[action]
      });
    } else {
      // Direct action without confirmation
      handleAction(action);
    }
  };

  // Handle action execution
  const handleAction = (action: BulkAction) => {
    switch (action) {
      case 'delete':
        handleBulkDelete();
        break;
      case 'export':
        handleBulkExport();
        break;
      case 'merge':
        handleBulkMerge();
        break;
      case 'duplicate':
        handleBulkDuplicate();
        break;
      default:
        console.warn(`Unhandled bulk action: ${action}`);
    }
  };

  // Calculate stats for selected decks
  const selectionStats = {
    totalCards: selectedDecks.reduce((sum, deck) => sum + deck.stats.totalCards, 0),
    totalStudied: selectedDecks.reduce((sum, deck) => sum + deck.stats.totalStudied, 0),
    avgAccuracy: selectedDecks.length > 0
      ? selectedDecks.reduce((sum, deck) => sum + deck.stats.averageAccuracy, 0) / selectedDecks.length
      : 0
  };

  return (
    <>
      {/* Selection Bar */}
      <AnimatePresence>
        {selectedDeckIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 p-4 bg-white dark:bg-dark-800 rounded-lg shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Select All Checkbox */}
                <button
                  onClick={handleToggleAll}
                  className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  ) : isPartiallySelected ? (
                    <div className="relative">
                      <Square className="w-5 h-5" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-primary-600 dark:bg-primary-400 rounded-sm" />
                      </div>
                    </div>
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                  <span className="text-sm font-medium">
                    {t('flashcards.bulk.selected', { count: selectedDeckIds.size })}
                  </span>
                </button>

                {/* Selection Stats */}
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500">
                  <span>{selectionStats.totalCards} {t('flashcards.cards')}</span>
                  <span>•</span>
                  <span>{Math.round(selectionStats.avgAccuracy * 100)}% {t('flashcards.accuracy')}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Quick Actions */}
                <button
                  onClick={() => handleAction('export')}
                  disabled={isProcessing}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title={t('flashcards.bulk.export')}
                >
                  {currentAction === 'export' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                </button>

                <button
                  onClick={() => handleAction('duplicate')}
                  disabled={isProcessing}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                  title={t('flashcards.bulk.duplicate')}
                >
                  {currentAction === 'duplicate' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>

                {selectedDeckIds.size > 1 && (
                  <button
                    onClick={() => showConfirmation('merge')}
                    disabled={isProcessing}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                    title={t('flashcards.bulk.merge')}
                  >
                    {currentAction === 'merge' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Merge className="w-5 h-5" />
                    )}
                  </button>
                )}

                <button
                  onClick={() => showConfirmation('delete')}
                  disabled={isProcessing}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title={t('flashcards.bulk.delete')}
                >
                  {currentAction === 'delete' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                </button>

                {/* More Options */}
                <div className="relative">
                  <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    disabled={isProcessing}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                  >
                    <ChevronDown className={cn(
                      'w-5 h-5 transition-transform',
                      isMenuOpen && 'rotate-180'
                    )} />
                  </button>

                  <AnimatePresence>
                    {isMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50"
                      >
                        <button
                          onClick={() => {
                            showConfirmation('archive');
                            setIsMenuOpen(false);
                          }}
                          disabled={isProcessing}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 flex items-center gap-2"
                        >
                          <Archive className="w-4 h-4" />
                          {t('flashcards.bulk.archive')}
                        </button>

                        <button
                          onClick={() => {
                            showConfirmation('tag');
                            setIsMenuOpen(false);
                          }}
                          disabled={isProcessing}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 flex items-center gap-2"
                        >
                          <Edit3 className="w-4 h-4" />
                          {t('flashcards.bulk.addTags')}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Clear Selection */}
                <button
                  onClick={() => onSelectionChange(new Set())}
                  className="ml-2 text-sm text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {t('common.clear')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmDialog.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setConfirmDialog({ isOpen: false, action: null, message: '' })}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-dark-850 rounded-lg shadow-xl max-w-md w-full p-6"
            >
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {t('common.confirmAction')}
                  </h3>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    {confirmDialog.message}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmDialog({ isOpen: false, action: null, message: '' })}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => {
                    if (confirmDialog.action) {
                      handleAction(confirmDialog.action);
                    }
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}