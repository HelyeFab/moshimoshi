'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/I18nContext';
import { useStudyLists, useStudyItems } from '@/hooks/useStudyLists';
import { useSubscription } from '@/hooks/useSubscription';
import Navbar from '@/components/layout/Navbar';
import LearningPageHeader from '@/components/learn/LearningPageHeader';
import { LoadingOverlay } from '@/components/ui/Loading';
import DoshiMascot from '@/components/ui/DoshiMascot';
import ListSelectionModal from '@/components/study-lists/ListSelectionModal';
import SaveItemModal from '@/components/study-lists/SaveItemModal';
import { studyListManager } from '@/lib/study-lists/StudyListManager';
import type { CreateStudyListInput, SavedStudyItem } from '@/types/studyList';
import { Bookmark, Plus, Trash2, ExternalLink, Volume2, Clock, CheckCircle } from 'lucide-react';
import { useTTS } from '@/hooks/useTTS';
import { motion } from 'framer-motion';

type ViewMode = 'all' | 'words' | 'kanji' | 'sentences';
type SortBy = 'recent' | 'alphabetical' | 'mastery';

export default function FavouritesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const { subscription } = useSubscription();
  const { play, isPlaying } = useTTS({ cacheFirst: true });

  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { lists, isLoading: listsLoading, createList, userPlan } = useStudyLists({ user });
  const { items, isLoading: itemsLoading, removeFromList, refreshItems } = useStudyItems({ user });

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      // Check if this is a guest user
      const isGuest = sessionStorage.getItem('isGuestUser') === 'true';

      if (isGuest) {
        // Redirect guests to sign in
        router.push('/auth/signin?redirect=/favourites');
        return;
      }

      // Check for authenticated user
      const response = await fetch('/api/auth/session');
      const data = await response.json();

      if (data.authenticated) {
        setUser(data.user);
        setLoading(false);
      } else {
        // Not authenticated, redirect to sign in
        router.push('/auth/signin?redirect=/favourites');
      }
    } catch (error) {
      console.error('Failed to check session:', error);
      router.push('/auth/signin?redirect=/favourites');
    }
  };

  // Filter items based on view mode and selected list
  const filteredItems = items.filter(item => {
    // Filter by list
    if (selectedList && !item.listIds.includes(selectedList)) {
      return false;
    }

    // Filter by type
    if (viewMode !== 'all') {
      if (viewMode === 'words' && item.itemType !== 'word') return false;
      if (viewMode === 'kanji' && item.itemType !== 'kanji') return false;
      if (viewMode === 'sentences' && item.itemType !== 'sentence') return false;
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const searchableText = [
        item.content?.text,
        item.content?.meaning,
        item.content?.reading,
        item.tags?.join(' '),
        item.notes
      ].filter(Boolean).join(' ').toLowerCase();

      return searchableText.includes(query);
    }

    return true;
  });

  // Sort items
  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case 'alphabetical':
        return (a.content?.text || '').localeCompare(b.content?.text || '', 'ja');
      case 'mastery':
        const aMastery = a.reviewData?.mastered ? 1 : 0;
        const bMastery = b.reviewData?.mastered ? 1 : 0;
        return bMastery - aMastery;
      case 'recent':
      default:
        return (b.savedAt || 0) - (a.savedAt || 0);
    }
  });

  // Calculate stats
  const stats = {
    total: items.length,
    words: items.filter(item => item.itemType === 'word').length,
    kanji: items.filter(item => item.itemType === 'kanji').length,
    sentences: items.filter(item => item.itemType === 'sentence').length,
    mastered: items.filter(item => item.reviewData?.mastered).length,
  };

  const handleRemoveItem = async (item: SavedStudyItem) => {
    const confirmed = window.confirm(t('favourites.confirmRemove'));
    if (confirmed) {
      // Remove from all lists
      for (const listId of item.listIds) {
        await removeFromList(item.id, listId);
      }
      refreshItems();
    }
  };

  const handleCreateList = async (input: CreateStudyListInput) => {
    const newList = await createList(input);
    if (newList) {
      setShowCreateModal(false);
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'kanji': return '漢';
      case 'word': return '📖';
      case 'sentence': return '💬';
      default: return '📝';
    }
  };

  const handleSpeak = async (text: string) => {
    try {
      await play(text, { voice: 'ja-JP', rate: 0.9 });
    } catch (error) {
      console.error('TTS failed:', error);
    }
  };

  if (loading || listsLoading || itemsLoading) {
    return <LoadingOverlay message={t('common.loading')} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-light/90 dark:from-background-dark dark:to-background-dark/90">
      <Navbar user={user} showUserMenu={true} />

      <LearningPageHeader
        title={t('favourites.title')}
        description={t('favourites.description')}
        mode={viewMode}
        onModeChange={(mode) => setViewMode(mode as ViewMode)}
        modeOptions={[
          { value: 'all', label: t('favourites.filters.all') },
          { value: 'words', label: t('favourites.filters.words') },
          { value: 'kanji', label: t('favourites.filters.kanji') },
          { value: 'sentences', label: t('favourites.filters.sentences') },
        ]}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        stats={stats}
        actions={[
          {
            label: t('lists.actions.createNew'),
            onClick: () => setShowCreateModal(true),
            variant: 'primary',
            icon: <Plus className="w-4 h-4" />,
            disabled: userPlan === 'guest',
          },
        ]}
      />

      <div className="container mx-auto px-4 pb-16">
        {/* Filters Bar */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          {/* List Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="list-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('favourites.filterByList')}:
            </label>
            <select
              id="list-filter"
              value={selectedList || ''}
              onChange={(e) => setSelectedList(e.target.value || null)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            >
              <option value="">{t('favourites.allLists')}</option>
              {lists.map(list => (
                <option key={list.id} value={list.id}>
                  {list.icon} {list.name} ({list.itemIds.length})
                </option>
              ))}
            </select>
          </div>

          {/* Sort Options */}
          <div className="flex items-center gap-2">
            <label htmlFor="sort-by" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('favourites.sortBy')}:
            </label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            >
              <option value="recent">{t('favourites.sort.recent')}</option>
              <option value="alphabetical">{t('favourites.sort.alphabetical')}</option>
              <option value="mastery">{t('favourites.sort.mastery')}</option>
            </select>
          </div>
        </div>

        {/* Items Grid */}
        {sortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <DoshiMascot size="large" className="mb-6" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {searchQuery ? t('favourites.noResultsFound') : t('favourites.noItemsSaved')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-center max-w-md">
              {searchQuery
                ? t('favourites.tryDifferentSearch')
                : t('favourites.startSaving')
              }
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getItemIcon(item.itemType)}</span>
                    {item.reviewData?.mastered && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {item.content?.text && (
                      <button
                        onClick={() => handleSpeak(item.content.text)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        disabled={isPlaying}
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveItem(item)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {item.content?.text && (
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {item.content.text}
                    </p>
                  )}
                  {item.content?.reading && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {item.content.reading}
                    </p>
                  )}
                  {item.content?.meaning && (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {item.content.meaning}
                    </p>
                  )}
                </div>

                {/* Lists this item belongs to */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {item.listIds.map(listId => {
                    const list = lists.find(l => l.id === listId);
                    if (!list) return null;
                    return (
                      <span
                        key={listId}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-${list.color.replace('500', '100')} dark:bg-${list.color.replace('500', '900/30')} text-${list.color.replace('500', '700')} dark:text-${list.color.replace('500', '300')}`}
                      >
                        {list.icon} {list.name}
                      </span>
                    );
                  })}
                </div>

                {/* Review info */}
                {item.reviewData && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {t('favourites.reviewedTimes', { count: item.reviewData.reviewCount })}
                      </span>
                      {item.reviewData.accuracy !== undefined && (
                        <span>{Math.round(item.reviewData.accuracy * 100)}%</span>
                      )}
                    </div>
                  </div>
                )}

                {/* User notes */}
                {item.notes && (
                  <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
                    {item.notes}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* My Lists Link */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/my-items')}
            className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          >
            <Bookmark className="w-4 h-4" />
            {t('favourites.manageLists')}
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Create List Modal */}
      <ListSelectionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateList={handleCreateList}
        currentLists={lists}
        userPlan={userPlan}
      />
    </div>
  );
}