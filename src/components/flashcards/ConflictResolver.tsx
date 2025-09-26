'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Cloud, HardDrive, GitMerge, Check, X, Info } from 'lucide-react';
import type { FlashcardDeck } from '@/types/flashcards';
import { useI18n } from '@/i18n/I18nContext';
import { syncManager } from '@/lib/flashcards/SyncManager';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface ConflictData {
  id: string;
  localDeck: FlashcardDeck;
  remoteDeck: FlashcardDeck;
  timestamp: number;
}

interface ConflictResolverProps {
  isOpen: boolean;
  onClose: () => void;
  onResolve: () => void;
}

export function ConflictResolver({ isOpen, onClose, onResolve }: ConflictResolverProps) {
  const { t } = useI18n();
  const [conflicts, setConflicts] = useState<ConflictData[]>([]);
  const [currentConflict, setCurrentConflict] = useState<ConflictData | null>(null);
  const [selectedResolution, setSelectedResolution] = useState<'local' | 'remote' | 'merge' | null>(null);
  const [resolving, setResolving] = useState(false);
  const [comparisonView, setComparisonView] = useState<'side-by-side' | 'diff'>('side-by-side');

  useEffect(() => {
    if (isOpen) {
      loadConflicts();
    }

    // Listen for new conflicts
    const handleNewConflict = (event: CustomEvent) => {
      loadConflicts();
    };

    window.addEventListener('flashcard-sync-conflict', handleNewConflict as EventListener);
    return () => {
      window.removeEventListener('flashcard-sync-conflict', handleNewConflict as EventListener);
    };
  }, [isOpen]);

  const loadConflicts = async () => {
    // Load conflicts from IndexedDB via SyncManager
    // This is a simplified version - real implementation would query the conflicts store
    const status = await syncManager.getSyncStatus();
    if (status.conflicts > 0) {
      // Mock data for demonstration - replace with actual IndexedDB query
      // const conflicts = await syncManager.getConflicts();
      // setConflicts(conflicts);
    }
  };

  const handleResolve = async () => {
    if (!currentConflict || !selectedResolution) return;

    setResolving(true);
    try {
      await syncManager.resolveConflict(currentConflict.id, selectedResolution);

      // Remove from list
      setConflicts(conflicts.filter(c => c.id !== currentConflict.id));

      // Move to next conflict or close
      if (conflicts.length > 1) {
        const nextConflict = conflicts.find(c => c.id !== currentConflict.id);
        setCurrentConflict(nextConflict || null);
        setSelectedResolution(null);
      } else {
        onResolve();
        onClose();
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    } finally {
      setResolving(false);
    }
  };

  const getDifferences = (local: FlashcardDeck, remote: FlashcardDeck) => {
    const diffs = [];

    if (local.name !== remote.name) {
      diffs.push({ field: 'Name', local: local.name, remote: remote.name });
    }
    if (local.description !== remote.description) {
      diffs.push({ field: 'Description', local: local.description, remote: remote.description });
    }
    if (local.cards.length !== remote.cards.length) {
      diffs.push({
        field: 'Cards',
        local: `${local.cards.length} cards`,
        remote: `${remote.cards.length} cards`
      });
    }
    if (local.updatedAt !== remote.updatedAt) {
      diffs.push({
        field: 'Last Updated',
        local: formatDistanceToNow(local.updatedAt, { addSuffix: true }),
        remote: formatDistanceToNow(remote.updatedAt, { addSuffix: true })
      });
    }

    return diffs;
  };

  if (!isOpen || conflicts.length === 0) return null;

  const conflict = currentConflict || conflicts[0];
  if (!conflict) return null;

  const differences = getDifferences(conflict.localDeck, conflict.remoteDeck);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-dark-850 rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-8 h-8" />
                  <div>
                    <h2 className="text-2xl font-bold">
                      {t('flashcards.sync.conflictDetected')}
                    </h2>
                    <p className="text-white/80 mt-1">
                      {t('flashcards.sync.conflictDescription')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {conflicts.length > 1 && (
                <div className="mt-3 text-sm text-white/80">
                  {t('flashcards.sync.multipleConflicts', {
                    current: conflicts.indexOf(conflict) + 1,
                    total: conflicts.length
                  })}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Deck Info */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{conflict.localDeck.emoji}</span>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {conflict.localDeck.name}
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('flashcards.sync.conflictTime', {
                    time: formatDistanceToNow(conflict.timestamp, { addSuffix: true })
                  })}
                </p>
              </div>

              {/* View Toggle */}
              <div className="flex justify-center mb-6">
                <div className="inline-flex rounded-lg bg-gray-100 dark:bg-dark-800 p-1">
                  <button
                    onClick={() => setComparisonView('side-by-side')}
                    className={cn(
                      'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                      comparisonView === 'side-by-side'
                        ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 shadow'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    )}
                  >
                    {t('flashcards.sync.sideBySide')}
                  </button>
                  <button
                    onClick={() => setComparisonView('diff')}
                    className={cn(
                      'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                      comparisonView === 'diff'
                        ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 shadow'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    )}
                  >
                    {t('flashcards.sync.differences')}
                  </button>
                </div>
              </div>

              {/* Comparison */}
              {comparisonView === 'side-by-side' ? (
                <div className="grid grid-cols-2 gap-4">
                  {/* Local Version */}
                  <div
                    className={cn(
                      'p-4 border-2 rounded-lg cursor-pointer transition-all',
                      selectedResolution === 'local'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                    onClick={() => setSelectedResolution('local')}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <HardDrive className="w-5 h-5 text-blue-500" />
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        {t('flashcards.sync.localVersion')}
                      </h4>
                      {selectedResolution === 'local' && (
                        <Check className="w-5 h-5 text-blue-500 ml-auto" />
                      )}
                    </div>
                    <dl className="space-y-2 text-sm">
                      <div>
                        <dt className="text-gray-500 dark:text-gray-500">
                          {t('flashcards.sync.lastUpdated')}
                        </dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                          {formatDistanceToNow(conflict.localDeck.updatedAt, { addSuffix: true })}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500 dark:text-gray-500">
                          {t('flashcards.totalCards', { count: conflict.localDeck.cards.length })}
                        </dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                          {conflict.localDeck.cards.length}
                        </dd>
                      </div>
                      {conflict.localDeck.description && (
                        <div>
                          <dt className="text-gray-500 dark:text-gray-500">
                            {t('common.description')}
                          </dt>
                          <dd className="text-gray-900 dark:text-gray-100 line-clamp-2">
                            {conflict.localDeck.description}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {/* Remote Version */}
                  <div
                    className={cn(
                      'p-4 border-2 rounded-lg cursor-pointer transition-all',
                      selectedResolution === 'remote'
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                    onClick={() => setSelectedResolution('remote')}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Cloud className="w-5 h-5 text-green-500" />
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        {t('flashcards.sync.cloudVersion')}
                      </h4>
                      {selectedResolution === 'remote' && (
                        <Check className="w-5 h-5 text-green-500 ml-auto" />
                      )}
                    </div>
                    <dl className="space-y-2 text-sm">
                      <div>
                        <dt className="text-gray-500 dark:text-gray-500">
                          {t('flashcards.sync.lastUpdated')}
                        </dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                          {formatDistanceToNow(conflict.remoteDeck.updatedAt, { addSuffix: true })}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500 dark:text-gray-500">
                          {t('flashcards.totalCards', { count: conflict.remoteDeck.cards.length })}
                        </dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                          {conflict.remoteDeck.cards.length}
                        </dd>
                      </div>
                      {conflict.remoteDeck.description && (
                        <div>
                          <dt className="text-gray-500 dark:text-gray-500">
                            {t('common.description')}
                          </dt>
                          <dd className="text-gray-900 dark:text-gray-100 line-clamp-2">
                            {conflict.remoteDeck.description}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {differences.map((diff, index) => (
                    <div key={index} className="p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
                      <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                        {diff.field}
                      </h5>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center gap-2 mb-1">
                            <HardDrive className="w-4 h-4 text-blue-500" />
                            <span className="text-blue-700 dark:text-blue-300 font-medium">
                              {t('flashcards.sync.local')}
                            </span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">{diff.local || '-'}</p>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2 mb-1">
                            <Cloud className="w-4 h-4 text-green-500" />
                            <span className="text-green-700 dark:text-green-300 font-medium">
                              {t('flashcards.sync.cloud')}
                            </span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">{diff.remote || '-'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Merge Option */}
              <div className="mt-6">
                <button
                  onClick={() => setSelectedResolution('merge')}
                  className={cn(
                    'w-full p-4 border-2 rounded-lg transition-all',
                    selectedResolution === 'merge'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <GitMerge className="w-5 h-5 text-purple-500" />
                    <div className="text-left">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        {t('flashcards.sync.mergeVersions')}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {t('flashcards.sync.mergeDescription')}
                      </p>
                    </div>
                    {selectedResolution === 'merge' && (
                      <Check className="w-5 h-5 text-purple-500 ml-auto" />
                    )}
                  </div>
                </button>
              </div>

              {/* Info */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {t('flashcards.sync.conflictInfo')}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleResolve}
                  disabled={!selectedResolution || resolving}
                  className={cn(
                    'px-4 py-2 rounded-lg font-medium transition-colors',
                    selectedResolution && !resolving
                      ? 'bg-gradient-to-r from-primary-500 to-purple-500 text-white hover:shadow-lg'
                      : 'bg-gray-200 dark:bg-dark-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  )}
                >
                  {resolving ? t('common.processing') : t('flashcards.sync.resolve')}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}