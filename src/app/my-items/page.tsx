'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/I18nContext';
import { useStudyLists } from '@/hooks/useStudyLists';
import { useSubscription } from '@/hooks/useSubscription';
import Navbar from '@/components/layout/Navbar';
import LearningPageHeader from '@/components/learn/LearningPageHeader';
import ListSelectionModal from '@/components/study-lists/ListSelectionModal';
import StudyListCard from '@/components/study-lists/StudyListCard';
import { LoadingOverlay } from '@/components/ui/Loading';
import DoshiMascot from '@/components/ui/DoshiMascot';
import { studyListManager } from '@/lib/study-lists/StudyListManager';
import type { CreateStudyListInput } from '@/types/studyList';
import featuresConfig from '@/../config/features.v1.json';

type ViewMode = 'lists' | 'stats' | 'settings';

export default function MyItemsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const { subscription } = useSubscription();

  const [viewMode, setViewMode] = useState<ViewMode>('lists');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    lists,
    isLoading,
    error,
    createList,
    deleteList,
    refreshLists,
    userPlan,
  } = useStudyLists({
    user,
    filters: {
      searchQuery: searchQuery || undefined,
      sortBy: 'updated',
      sortOrder: 'desc',
    },
  });

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
        router.push('/auth/signin?redirect=/my-items');
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
        router.push('/auth/signin?redirect=/my-items');
      }
    } catch (error) {
      console.error('Failed to check session:', error);
      router.push('/auth/signin?redirect=/my-items');
    }
  };

  // Get list limits from features config
  const getMaxLists = () => {
    const feature = featuresConfig.features.find(f => f.id === 'custom_lists');
    const metadata = feature?.metadata as any;
    const plan = subscription?.status === 'active' ? 'premium' : user ? 'free' : 'guest';
    return metadata?.maxListsPerUser?.[plan] ??
           (plan === 'premium' ? -1 : plan === 'free' ? 10 : 0);
  };

  const maxLists = getMaxLists();
  const canCreateMore = maxLists === -1 || lists.length < maxLists;

  // Calculate stats
  const stats = {
    total: lists.length,
    learned: lists.filter(list =>
      list.stats && list.stats.masteredCount > 0
    ).length,
    totalItems: lists.reduce((sum, list) => sum + list.itemIds.length, 0),
    reviewable: lists.filter(list =>
      list.stats && list.stats.learningCount > 0
    ).length,
  };

  const handleCreateList = async (input: CreateStudyListInput) => {
    const newList = await createList(input);
    if (newList) {
      setShowCreateModal(false);
      refreshLists();
    }
  };

  const handleDeleteList = async (listId: string) => {
    await deleteList(listId);
    refreshLists();
  };

  const filteredLists = searchQuery
    ? lists.filter(list =>
        list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        list.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : lists;

  if (loading || isLoading) {
    return <LoadingOverlay />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-white to-accent-50/20 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      <Navbar user={user} showUserMenu={true} />

      <LearningPageHeader
        title={t('lists.title')}
        description={t('lists.pageDescription')}
        mode={viewMode}
        onModeChange={(mode) => setViewMode(mode as ViewMode)}
        stats={stats}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        actions={[
          {
            label: t('lists.actions.createNew'),
            onClick: () => setShowCreateModal(true),
            variant: 'primary',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            ),
            disabled: !canCreateMore,
          },
        ]}
      />

      <div className="container mx-auto px-4 pb-16">
        {viewMode === 'lists' && (
          <>
            {filteredLists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <DoshiMascot
                  size="large"
                  className="mb-6"
                />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {searchQuery ? t('lists.empty.noResults') : t('lists.empty.noLists')}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-center max-w-md">
                  {searchQuery
                    ? t('lists.empty.tryDifferentSearch')
                    : t('lists.empty.getStarted')
                  }
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    disabled={!canCreateMore}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {t('lists.actions.createFirst')}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredLists.map(list => (
                  <StudyListCard
                    key={list.id}
                    list={list}
                    onEdit={() => router.push(`/my-items/${list.id}`)}
                    onDelete={() => handleDeleteList(list.id)}
                    onReview={() => router.push(`/review/list/${list.id}`)}
                  />
                ))}
              </div>
            )}

            {/* Quota info for free users */}
            {userPlan === 'free' && maxLists !== -1 && (
              <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {t('lists.quota.freeLimit')}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      {t('lists.quota.remaining', { count: Math.max(0, maxLists - lists.length) })}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push('/pricing')}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm"
                  >
                    {t('common.upgrade')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {viewMode === 'stats' && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('lists.stats.overview')}
                </h3>
                <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600 dark:text-gray-400">{t('lists.stats.totalLists')}</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-white">{stats.total}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600 dark:text-gray-400">{t('lists.stats.totalItems')}</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-white">{stats.totalItems}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600 dark:text-gray-400">{t('lists.stats.reviewableLists')}</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-white">{stats.reviewable}</dd>
                </div>
              </dl>
            </div>

            {/* List type breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('lists.stats.byType')}
              </h3>
              <div className="space-y-3">
                {(['flashcard', 'drillable', 'sentence'] as const).map(type => {
                  const count = lists.filter(list => list.type === type).length;
                  return (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {t(`lists.types.${type}.name`)}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent activity */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('lists.stats.recentActivity')}
              </h3>
              <div className="space-y-2">
                {lists.slice(0, 3).map(list => (
                  <div key={list.id} className="flex items-center gap-2">
                    <span className="text-xl">{list.icon || '📝'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {list.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(list.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'settings' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('lists.settings.title')}
              </h3>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('lists.settings.comingSoon')}
                </p>
              </div>
            </div>
          </div>
        )}
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