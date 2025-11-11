'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useRouter, useParams } from 'next/navigation';
// Navigation is now global via NavigationWrapper in root layout;
import { listManager } from '@/lib/lists/ListManager';
import type { UserList, ListItem } from '@/types/userLists';
import { motion, AnimatePresence } from 'framer-motion';
import DoshiMascot from '@/components/ui/DoshiMascot';
import { useToast } from '@/components/ui/Toast/ToastContext';
import Dialog from '@/components/ui/Dialog';
import SpeakerIcon from '@/components/ui/SpeakerIcon';
import { Trash2 } from 'lucide-react';
import LearningPageHeader from '@/components/learn/LearningPageHeader';
import { ReviewEventType } from '@/lib/review-engine/core/events';
import { EventEmitter } from 'events';
import { gamificationListener } from '@/lib/gamification/gamificationListener';
import { UserListAdapter } from '@/lib/review-engine/adapters/UserListAdapter';
import dynamic from 'next/dynamic';
import { LoadingOverlay } from '@/components/ui/Loading';

// Module-level event emitter for gamification
const ureEventEmitter = new EventEmitter();
let gamificationListenerInitialized = false;

// Dynamic import for ReviewEngine to avoid SSR issues
const ReviewEngine = dynamic(
  () => import('@/components/review-engine/ReviewEngine'),
  {
    loading: () => <LoadingOverlay isVisible={true} />,
    ssr: false,
  }
);

export default function ListDetailPage() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const { isPremium } = useSubscription();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  // TTS is handled by SpeakerIcon component

  const listId = params.listId as string;

  const [list, setList] = useState<UserList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemContent, setNewItemContent] = useState('');
  const [newItemMetadata, setNewItemMetadata] = useState({
    reading: '',
    meaning: '',
    notes: ''
  });
  const [deletingItem, setDeletingItem] = useState<string | null>(null);

  // View mode state
  type ViewMode = 'browse' | 'study' | 'review';
  const [viewMode, setViewMode] = useState<ViewMode>('browse');

  // Selection state for study/review modes
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Review session state
  const [reviewContent, setReviewContent] = useState<any[]>([]);
  const [reviewContentPool, setReviewContentPool] = useState<any[]>([]);
  const [studySessionStartTime, setStudySessionStartTime] = useState<number>(0);
  const [currentStudyIndex, setCurrentStudyIndex] = useState(0);
  const [selectedItemsData, setSelectedItemsData] = useState<ListItem[]>([]);

  // Initialize gamification listener (once per user session)
  useEffect(() => {
    if (user?.uid && !gamificationListenerInitialized) {
      console.log('[User Lists] Initializing gamification listener for user:', user.uid);
      gamificationListener.initialize(user.uid, ureEventEmitter);
      gamificationListenerInitialized = true;
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!authLoading && user) {
      loadList();
    } else if (!authLoading && !user) {
      router.push('/lists');
    }
  }, [user, authLoading, listId]);

  const loadList = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const lists = await listManager.getLists(user.uid, isPremium);
      const foundList = lists.find(l => l.id === listId);

      if (foundList) {
        setList(foundList);
      } else {
        showToast(t('lists.errors.loadFailed'), 'error');
        router.push('/lists');
      }
    } catch (error) {
      console.error('Error loading list:', error);
      showToast(t('lists.errors.loadFailed'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!user || !list || !newItemContent.trim()) return;

    try {
      await listManager.addItemToList(
        list.id,
        newItemContent.trim(),
        newItemMetadata,
        user.uid,
        isPremium
      );

      await loadList();
      setShowAddModal(false);
      setNewItemContent('');
      setNewItemMetadata({ reading: '', meaning: '', notes: '' });
      showToast(t('lists.success.itemAdded'), 'success');
    } catch (error) {
      console.error('Error adding item:', error);
      showToast(t('lists.errors.addFailed'), 'error');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!user || !list) return;

    try {
      await listManager.removeItemFromList(list.id, itemId, user.uid, isPremium);
      await loadList();
      showToast(t('lists.success.itemRemoved', { count: 1 }), 'success');
      setDeletingItem(null);
    } catch (error) {
      console.error('Error removing item:', error);
      showToast(t('common.error'), 'error');
    }
  };

  // Selection handlers
  const toggleSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (!list) return;
    const allIds = list.items.map(item => item.id);
    setSelectedItems(new Set(allIds));
  };

  const handleClearSelection = () => {
    setSelectedItems(new Set());
  };

  // Study mode handler
  const handleStartStudy = () => {
    if (!list || selectedItems.size === 0) {
      showToast('Please select items to study', 'warning');
      return;
    }

    const itemsArray = list.items.filter(item => selectedItems.has(item.id));

    if (itemsArray.length === 0) {
      showToast('Could not find selected items', 'error');
      return;
    }

    // Track study session start time for gamification
    setStudySessionStartTime(Date.now());
    setSelectedItemsData(itemsArray);
    setCurrentStudyIndex(0);
    setViewMode('study');
  };

  // Review mode handler
  const handleStartReview = () => {
    if (!list || selectedItems.size === 0) {
      showToast('Please select items to review', 'warning');
      return;
    }

    // Initialize adapter with current list
    const adapter = new UserListAdapter(list);

    // Get selected items
    const itemsArray = list.items.filter(item => selectedItems.has(item.id));

    // Transform to reviewable content
    const content = itemsArray.map(item => adapter.transform(item));

    // Use all list items as pool for distractors
    const poolContent = list.items.map(item => adapter.transform(item));

    setReviewContent(content);
    setReviewContentPool(poolContent);
  };

  // Review session completion handler
  const handleReviewComplete = async (stats: any) => {
    // Emit URE SESSION_COMPLETED event for gamification
    const sessionId = `list_review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    ureEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, {
      data: {
        sessionId,
        statistics: {
          correctItems: stats.correctItems,
          accuracy: stats.accuracy,
          averageResponseTime: stats.averageResponseTime || 0,
          bestStreak: stats.bestStreak || 0
        },
        duration: stats.duration || 0
      }
    });

    console.log('[User Lists] Emitted SESSION_COMPLETED event for gamification:', {
      sessionId,
      correctItems: stats.correctItems,
      accuracy: stats.accuracy,
      averageResponseTime: stats.averageResponseTime,
      bestStreak: stats.bestStreak,
      duration: stats.duration
    });

    setReviewContent([]);
    setReviewContentPool([]);
    setViewMode('browse');
    setSelectedItems(new Set());
    showToast(`Review complete! Accuracy: ${stats.accuracy.toFixed(1)}%`, 'success');
  };

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      primary: 'bg-primary-500 dark:bg-primary-600',
      ocean: 'bg-blue-500 dark:bg-blue-600',
      matcha: 'bg-green-500 dark:bg-green-600',
      sunset: 'bg-orange-500 dark:bg-orange-600',
      lavender: 'bg-purple-500 dark:bg-purple-600',
      monochrome: 'bg-gray-500 dark:bg-gray-600'
    };
    return colorMap[color] || colorMap.primary;
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light via-white to-primary-50
        dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
      {/* Navigation is now global - rendered in root layout */}
        <div className="container mx-auto px-4 py-16">
          <div className="flex flex-col items-center justify-center">
            <DoshiMascot size="large" mood="thinking" />
            <p className="text-gray-500 dark:text-gray-400 mt-4">{t('common.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!list) {
    return null;
  }

  // Active study session
  if (selectedItemsData.length > 0 && selectedItemsData[currentStudyIndex]) {
    const currentItem = selectedItemsData[currentStudyIndex];

    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light via-white to-primary-50
        dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
      {/* Navigation is now global - rendered in root layout */}
        <LearningPageHeader
          title={list.name}
          description={t(`lists.types.${list.type}.description`)}
          subtitle={`Studying ${selectedItems.size} items`}
          stats={{
            total: list.items.length,
            learned: 0
          }}
          mode={viewMode}
          backLink="/lists"
        />
        <main className="container mx-auto px-4 py-8">
          {/* Simple study card */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-dark-800 rounded-2xl p-8 shadow-lg">
              <div className="text-center mb-6">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {currentStudyIndex + 1} / {selectedItemsData.length}
                </span>
              </div>

              <div className="text-center mb-8">
                <div className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  {currentItem.content}
                </div>
                {currentItem.metadata?.reading && (
                  <div className="text-lg text-gray-600 dark:text-gray-400 mb-2">
                    {currentItem.metadata.reading}
                  </div>
                )}
                {currentItem.metadata?.meaning && (
                  <div className="text-xl text-primary-600 dark:text-primary-400 mb-4">
                    {currentItem.metadata.meaning}
                  </div>
                )}
                {currentItem.metadata?.notes && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 italic mt-4 p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
                    📝 {currentItem.metadata.notes}
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    if (currentStudyIndex > 0) {
                      setCurrentStudyIndex(currentStudyIndex - 1);
                    }
                  }}
                  disabled={currentStudyIndex === 0}
                  className="px-6 py-3 rounded-lg bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    if (currentStudyIndex < selectedItemsData.length - 1) {
                      setCurrentStudyIndex(currentStudyIndex + 1);
                    } else {
                      // Emit SESSION_COMPLETED event for gamification
                      const sessionDuration = Date.now() - studySessionStartTime;
                      const totalItems = selectedItemsData.length;
                      const averageTimePerItem = totalItems > 0 ? sessionDuration / totalItems : 0;

                      const sessionId = `list_study_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                      ureEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, {
                        data: {
                          sessionId,
                          statistics: {
                            correctItems: totalItems,
                            accuracy: 100,
                            averageResponseTime: averageTimePerItem,
                            bestStreak: totalItems
                          },
                          duration: sessionDuration
                        }
                      });

                      console.log('[User Lists Study] Emitted SESSION_COMPLETED event for gamification:', {
                        sessionId,
                        correctItems: totalItems,
                        accuracy: 100,
                        duration: sessionDuration
                      });

                      showToast('Study session complete!', 'success');
                      setViewMode('browse');
                      setCurrentStudyIndex(0);
                      setSelectedItemsData([]);
                      setSelectedItems(new Set());
                      setStudySessionStartTime(0);
                    }
                  }}
                  className="px-6 py-3 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-all"
                >
                  {currentStudyIndex < selectedItemsData.length - 1 ? 'Next' : 'Complete'}
                </button>
              </div>

              <button
                onClick={() => {
                  setViewMode('browse');
                  setCurrentStudyIndex(0);
                  setSelectedItemsData([]);
                }}
                className="mt-4 w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-all"
              >
                Back to Browse
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Active review session
  if (reviewContent.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light via-white to-primary-50
        dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
      {/* Navigation is now global - rendered in root layout */}
        <LearningPageHeader
          title={list.name}
          description={t(`lists.types.${list.type}.description`)}
          subtitle="Review Mode"
          backLink="/lists"
        />
        <main className="container mx-auto px-4 py-8">
          <ReviewEngine
            content={reviewContent}
            contentPool={reviewContentPool}
            mode="recall"
            onComplete={handleReviewComplete}
            onCancel={() => {
              setReviewContent([]);
              setReviewContentPool([]);
              setViewMode('browse');
              setSelectedItems(new Set());
            }}
            userId={user?.uid || 'guest'}
          />
        </main>
      </div>
    );
  }

  // Main browse/selection view
  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-white to-primary-50
      dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
      {/* Navigation is now global - rendered in root layout */}

      <LearningPageHeader
        title={list.name}
        description={t(`lists.types.${list.type}.description`)}
        subtitle={`${list.items.length} items`}
        stats={
          viewMode !== 'browse' ? {
            selected: selectedItems.size,
            total: list.items.length
          } : undefined
        }
        mode={viewMode}
        onModeChange={setViewMode}
        actions={
          viewMode !== 'browse' && selectedItems.size > 0 ? (
            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-dark-700 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-all"
              >
                {t('lists.selectAll')}
              </button>
              <button
                onClick={handleClearSelection}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-dark-700 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-all"
              >
                {t('lists.clearSelection')}
              </button>
              {viewMode === 'study' && (
                <button
                  onClick={handleStartStudy}
                  className="px-4 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-all"
                >
                  {t('lists.startStudy')}
                </button>
              )}
              {viewMode === 'review' && (
                <button
                  onClick={handleStartReview}
                  className="px-4 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all"
                >
                  {t('lists.startReview')}
                </button>
              )}
            </div>
          ) : undefined
        }
        backLink="/lists"
      />

      <div className="container mx-auto px-4 py-8">
        {/* Actions bar - only show add button in browse mode */}
        {viewMode === 'browse' && (
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600
                transition-all font-medium flex items-center gap-2"
            >
              <span>➕</span>
              {t('lists.actions.addItems')}
            </button>
          </div>
        )}

        {/* Items list */}
        {list.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <DoshiMascot size="large" mood="thinking" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-4">
              {t('lists.empty.noItems')}
            </h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-6 py-3 bg-primary-500 text-white rounded-xl
                hover:bg-primary-600 transition-all font-medium"
            >
              {t('lists.actions.addItems')}
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm">
            <AnimatePresence>
              {list.items.map((item, index) => {
                const isSelected = selectedItems.has(item.id);

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-dark-700
                      transition-all ${index > 0 ? 'border-t border-gray-100 dark:border-dark-700' : ''}`}
                  >
                    {/* Pin for selection in study/review modes */}
                    {(viewMode === 'study' || viewMode === 'review') && (
                      <button
                        className="text-xl transition-all hover:scale-110"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleSelection(item.id);
                        }}
                        aria-label={isSelected ? "Unpin" : "Pin"}
                      >
                        <span className={isSelected ? "" : "opacity-30 grayscale"}>
                          📌
                        </span>
                      </button>
                    )}

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100 text-lg">
                            {item.content}
                          </div>
                          {item.metadata?.reading && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {item.metadata.reading}
                            </div>
                          )}
                        </div>
                        {item.metadata?.meaning && (
                          <div className="flex-1 px-3 py-1 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                            <div className="text-sm font-medium text-primary-700 dark:text-primary-300">
                              → {item.metadata.meaning}
                            </div>
                          </div>
                        )}
                      </div>
                      {item.metadata?.notes && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 italic mt-1">
                          📝 {item.metadata.notes}
                        </div>
                      )}
                    </div>

                    {/* Actions - only show in browse mode */}
                    {viewMode === 'browse' && (
                      <div className="flex gap-2 items-center">
                        <SpeakerIcon
                          text={item.content}
                          size="sm"
                          variant="ghost"
                          options={{ voice: 'ja-JP', speed: 0.9 }}
                        />
                        <button
                          onClick={() => setDeletingItem(item.id)}
                          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20
                            transition-all text-red-500"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white dark:bg-dark-800 rounded-2xl p-6 max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                {t('lists.actions.addItems')}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Content *
                  </label>
                  <input
                    type="text"
                    value={newItemContent}
                    onChange={(e) => setNewItemContent(e.target.value)}
                    placeholder={list.type === 'sentence' ? 'Enter a sentence' : 'Enter a word or phrase'}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-600
                      bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Reading {t('common.optional')}
                  </label>
                  <input
                    type="text"
                    value={newItemMetadata.reading}
                    onChange={(e) => setNewItemMetadata({ ...newItemMetadata, reading: e.target.value })}
                    placeholder="Hiragana reading"
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-600
                      bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Meaning {t('common.optional')}
                  </label>
                  <input
                    type="text"
                    value={newItemMetadata.meaning}
                    onChange={(e) => setNewItemMetadata({ ...newItemMetadata, meaning: e.target.value })}
                    placeholder="English meaning"
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-600
                      bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes {t('common.optional')}
                  </label>
                  <textarea
                    value={newItemMetadata.notes}
                    onChange={(e) => setNewItemMetadata({ ...newItemMetadata, notes: e.target.value })}
                    placeholder="Personal notes or mnemonics"
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-600
                      bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 resize-none"
                    rows={2}
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100
                      dark:hover:bg-dark-700 rounded-lg transition-all"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleAddItem}
                    disabled={!newItemContent.trim()}
                    className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600
                      disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {t('common.add')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete single item confirmation dialog */}
      <Dialog
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        title={t('lists.confirmDelete')}
        message={t('lists.confirmDeleteMessage')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          if (deletingItem) {
            handleRemoveItem(deletingItem);
          }
        }}
        variant="danger"
      />
    </div>
  );
}