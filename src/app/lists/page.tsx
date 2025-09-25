'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import { listManager } from '@/lib/lists/ListManager';
import CreateListModal from '@/components/lists/CreateListModal';
import EditListModal from '@/components/lists/EditListModal';
import type { UserList } from '@/types/userLists';
import { motion, AnimatePresence } from 'framer-motion';
import DoshiMascot from '@/components/ui/DoshiMascot';
import { useToast } from '@/components/ui/Toast/ToastContext';
import Dialog from '@/components/ui/Dialog';
import Modal from '@/components/ui/Modal';
import LearningPageHeader from '@/components/learn/LearningPageHeader';

export default function MyListsPage() {
  const { t, strings } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const { isPremium, isLoading: subscriptionLoading } = useSubscription();
  const router = useRouter();
  const { showToast } = useToast();

  const [lists, setLists] = useState<UserList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedList, setSelectedList] = useState<UserList | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState('');
  const [importFormat, setImportFormat] = useState<'csv' | 'json' | 'text'>('text');
  const [editingList, setEditingList] = useState<UserList | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deletingList, setDeletingList] = useState<UserList | null>(null);

  useEffect(() => {
    // Only load lists after both auth and subscription have loaded
    if (!authLoading && !subscriptionLoading) {
      loadLists();
    }
  }, [user, authLoading, isPremium, subscriptionLoading]);

  const loadLists = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      console.log('[MyListsPage] Loading lists with isPremium:', isPremium);
      const userLists = await listManager.getLists(user.uid, isPremium);
      setLists(userLists);
    } catch (error) {
      console.error('Error loading lists:', error);
      showToast(t('lists.errors.loadFailed'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteList = async () => {
    console.log('[handleDeleteList] Starting delete operation');
    console.log('[handleDeleteList] deletingList:', deletingList);
    console.log('[handleDeleteList] user:', user);
    console.log('[handleDeleteList] isPremium:', isPremium);

    if (!user || !deletingList) {
      console.log('[handleDeleteList] Missing user or deletingList, aborting');
      return;
    }

    try {
      console.log('[handleDeleteList] Calling listManager.deleteList with:', {
        listId: deletingList.id,
        userId: user.uid,
        isPremium: isPremium || false
      });

      // Use the version with isPremium parameter
      const success = await listManager.deleteList(deletingList.id, user.uid, isPremium || false);

      console.log('[handleDeleteList] Delete result:', success);

      if (success) {
        await loadLists();
        showToast(t('lists.deleted'), 'success');
      } else {
        showToast(t('lists.errors.deleteFailed'), 'error');
      }
      setDeletingList(null);
    } catch (error) {
      console.error('[handleDeleteList] Error deleting list:', error);
      showToast(t('lists.errors.deleteFailed'), 'error');
      setDeletingList(null);
    }
  };

  const handleExportList = async (list: UserList, format: 'csv' | 'json') => {
    try {
      const data = await listManager.exportList(list.id, format);
      const blob = new Blob([data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
      const filename = `${list.name.replace(/[^a-z0-9]/gi, '_')}.${format}`;

      // Use browser API for download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      showToast(t('common.success'), 'success');
    } catch (error) {
      console.error('Error exporting list:', error);
      showToast(t('common.error'), 'error');
    }
  };

  const handleEditList = (list: UserList) => {
    setEditingList(list);
    setShowEditModal(true);
  };

  const handleListUpdated = (updatedList: UserList) => {
    // Update the list in our local state
    setLists(lists.map(list =>
      list.id === updatedList.id ? updatedList : list
    ));
    setShowEditModal(false);
    setEditingList(null);
  };

  const handleImport = async () => {
    if (!user || !importData.trim()) return;

    try {
      const listName = prompt(t('lists.fields.name'));
      if (!listName) return;

      const list = await listManager.importList(
        listName,
        'word', // Default type
        importData,
        importFormat,
        user.uid,
        isPremium || false
      );

      if (list) {
        await loadLists();
        setShowImportModal(false);
        setImportData('');
        showToast(t('lists.success.created'), 'success');
      }
    } catch (error) {
      console.error('Error importing list:', error);
      showToast(t('common.error'), 'error');
    }
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
        <Navbar user={user} showUserMenu={true} />
        <LearningPageHeader
          title={t('lists.title')}
          description={t('lists.pageDescription')}
          mascot="doshi"
        />
        <div className="container mx-auto px-4 py-16">
          <div className="flex flex-col items-center justify-center">
            <DoshiMascot size="large" mood="thinking" />
            <p className="text-gray-500 dark:text-gray-400 mt-4">{t('common.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light via-white to-primary-50
        dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
        <Navbar user={user} showUserMenu={true} />
        <LearningPageHeader
          title={t('lists.title')}
          description={t('lists.pageDescription')}
          mascot="doshi"
        />
        <div className="container mx-auto px-4 py-16">
          <div className="flex flex-col items-center justify-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4">
              {t('lists.errors.signInRequired')}
            </h2>
            <button
              onClick={() => router.push('/auth/signin')}
              className="mt-4 px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600
                transition-all font-medium"
            >
              {t('common.signIn')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-white to-primary-50
      dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
      <Navbar user={user} showUserMenu={true} />

      {/* Learning Page Header */}
      <LearningPageHeader
        title={t('lists.title')}
        description={t('lists.pageDescription')}
        mascot="doshi"
      />

      <div className="container mx-auto px-4 py-8">

        {/* Actions bar */}
        <div className="flex flex-wrap gap-3 mb-6 mt-6">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600
              transition-all font-medium flex items-center gap-2"
          >
            <span>➕</span>
            {t('lists.createNew')}
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-white dark:bg-dark-800 border border-gray-200
              dark:border-dark-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700
              transition-all font-medium flex items-center gap-2"
          >
            <span>📥</span>
            {t('common.import')}
          </button>
        </div>

        {/* Lists grid */}
        {lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-4">
              {t('lists.empty.noLists')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-center">
              {t('lists.empty.getStarted')}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-6 py-3 bg-primary-500 text-white rounded-xl
                hover:bg-primary-600 transition-all font-medium"
            >
              {t('lists.actions.createFirst')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {lists.map((list) => (
                <motion.div
                  key={list.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ scale: 1.02 }}
                  className="relative group"
                >
                  <div className={`${getColorClasses(list.color)} rounded-2xl p-6 text-white
                    shadow-lg hover:shadow-xl transition-all cursor-pointer`}
                    onClick={() => router.push(`/lists/${list.id}`)}
                  >
                    {/* List emoji and name */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-4xl">{list.emoji}</span>
                        <div>
                          <h3 className="font-bold text-lg">{list.name}</h3>
                          <p className="text-sm opacity-90">
                            {t(`lists.types.${list.type}.short`)} • {list.items.length} {t('lists.items')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Quick stats */}
                    <div className="flex gap-4 text-sm opacity-90">
                      <span>{new Date(list.updatedAt).toLocaleDateString()}</span>
                    </div>

                    {/* Actions - always visible */}
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditList(list);
                        }}
                        className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-all"
                        title={t('lists.actions.edit')}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportList(list, 'json');
                        }}
                        className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-all"
                        title="Export as JSON"
                      >
                        📤
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportList(list, 'csv');
                        }}
                        className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-all"
                        title="Export as CSV"
                      >
                        📊
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingList(list);
                        }}
                        className="p-1.5 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-all"
                        title={t('common.delete')}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <CreateListModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          loadLists();
        }}
      />

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title={t('common.import')}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Format
            </label>
            <select
              value={importFormat}
              onChange={(e) => setImportFormat(e.target.value as any)}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-600
                bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100"
            >
              <option value="text">Plain Text (one per line)</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data
            </label>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder={importFormat === 'text' ? 'One item per line' : 'Paste your data here'}
              className="w-full h-48 px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-600
                bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 resize-none"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowImportModal(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100
                dark:hover:bg-dark-700 rounded-lg transition-all"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleImport}
              disabled={!importData.trim()}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600
                disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Import
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit List Modal */}
      <EditListModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingList(null);
        }}
        onUpdated={handleListUpdated}
        list={editingList}
      />

      {/* Delete Confirmation Dialog */}
      {deletingList && (
        <Dialog
          isOpen={true}
          onClose={() => setDeletingList(null)}
          onConfirm={handleDeleteList}
          title={t('lists.deleteDialog.title') || 'Delete List'}
          message={`Are you sure you want to delete "${deletingList.name}"? This action cannot be undone.`}
          confirmText={t('common.delete') || 'Delete'}
          cancelText={t('common.cancel') || 'Cancel'}
          type="danger"
        />
      )}
    </div>
  );
}