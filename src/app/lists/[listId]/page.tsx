'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useRouter, useParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import { listManager } from '@/lib/lists/ListManager';
import type { UserList, ListItem } from '@/types/userLists';
import { motion, AnimatePresence } from 'framer-motion';
import DoshiMascot from '@/components/ui/DoshiMascot';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { useTTS } from '@/hooks/useTTS';
import Dialog from '@/components/ui/Dialog';

export default function ListDetailPage() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const { isPremium } = useSubscription();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const { play: playTTS } = useTTS();

  const listId = params.listId as string;

  const [list, setList] = useState<UserList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemContent, setNewItemContent] = useState('');
  const [newItemMetadata, setNewItemMetadata] = useState({
    reading: '',
    meaning: '',
    notes: ''
  });
  const [deletingItem, setDeletingItem] = useState<string | null>(null);
  const [deletingMultiple, setDeletingMultiple] = useState(false);

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

  const handleRemoveSelected = async () => {
    if (!user || !list || selectedItems.size === 0) return;

    try {
      const count = selectedItems.size;
      for (const itemId of selectedItems) {
        await listManager.removeItemFromList(list.id, itemId, user.uid, isPremium);
      }
      await loadList();
      setSelectedItems(new Set());
      setDeletingMultiple(false);
      showToast(t('lists.success.itemRemoved', { count }), 'success');
    } catch (error) {
      console.error('Error removing items:', error);
      showToast(t('common.error'), 'error');
    }
  };

  const handlePlayAudio = async (content: string) => {
    try {
      await playTTS(content, { voice: 'ja-JP', rate: 0.9 });
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const handleStartReview = () => {
    if (!list || list.items.length === 0) {
      showToast(t('lists.empty.noItems'), 'error');
      return;
    }

    // Navigate to review page with list ID
    router.push(`/review?listId=${list.id}`);
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
        <Navbar user={user} showUserMenu={true} backLink="/lists" />
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-white to-primary-50
      dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
      <Navbar user={user} showUserMenu={true} backLink="/lists" />

      <div className="container mx-auto px-4 py-8">
        {/* List header */}
        <div className={`${getColorClasses(list.color)} rounded-2xl p-6 text-white mb-6 shadow-lg`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-5xl">{list.emoji}</span>
              <div>
                <h1 className="text-2xl font-bold">{list.name}</h1>
                <p className="opacity-90">
                  {t(`lists.types.${list.type}.short`)} • {list.items.length} {t('lists.items')}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleStartReview}
                className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30
                  transition-all font-medium flex items-center gap-2"
              >
                <span>🎯</span>
                {t('lists.actions.review')}
              </button>
            </div>
          </div>
        </div>

        {/* Actions bar */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600
              transition-all font-medium flex items-center gap-2"
          >
            <span>➕</span>
            {t('lists.actions.addItems')}
          </button>

          {selectedItems.size > 0 && (
            <button
              onClick={() => setDeletingMultiple(true)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600
                transition-all font-medium flex items-center gap-2"
            >
              <span>🗑️</span>
              Remove {selectedItems.size} items
            </button>
          )}
        </div>

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
              {list.items.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-dark-700
                    transition-all ${index > 0 ? 'border-t border-gray-100 dark:border-dark-700' : ''}`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedItems);
                      if (e.target.checked) {
                        newSelected.add(item.id);
                      } else {
                        newSelected.delete(item.id);
                      }
                      setSelectedItems(newSelected);
                    }}
                    className="w-5 h-5 text-primary-500 rounded"
                  />

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

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePlayAudio(item.content)}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-600
                        transition-all text-gray-600 dark:text-gray-400"
                      title={t('common.playAudio')}
                    >
                      🔊
                    </button>
                    <button
                      onClick={() => setDeletingItem(item.id)}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20
                        transition-all text-red-500"
                      title={t('common.delete')}
                    >
                      ❌
                    </button>
                  </div>
                </motion.div>
              ))}
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

      {/* Delete multiple items confirmation dialog */}
      <Dialog
        isOpen={deletingMultiple}
        onClose={() => setDeletingMultiple(false)}
        title={t('lists.confirmDelete')}
        message={t('lists.confirmDeleteMultiple', { count: selectedItems.size })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleRemoveSelected}
        variant="danger"
      />
    </div>
  );
}