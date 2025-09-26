'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import LearningPageHeader from '@/components/learn/LearningPageHeader';
import { DeckGrid } from '@/components/flashcards/DeckGrid';
import { DeckCreator } from '@/components/flashcards/DeckCreator';
import { StudySession } from '@/components/flashcards/StudySession';
import { StatsDashboard } from '@/components/flashcards/StatsDashboard';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import Dialog from '@/components/ui/Dialog';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { flashcardManager, FlashcardManager } from '@/lib/flashcards/FlashcardManager';
import { listManager } from '@/lib/lists/ListManager';
import type { FlashcardDeck, CreateDeckRequest, SessionSummary } from '@/types/flashcards';
import type { UserList } from '@/types/userLists';
import { Trophy, TrendingUp, Target, Clock, BookOpen, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function FlashcardsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { subscription, isPremium } = useSubscription();
  const { showToast } = useToast();

  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [userLists, setUserLists] = useState<UserList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [editingDeck, setEditingDeck] = useState<FlashcardDeck | null>(null);
  const [studyingDeck, setStudyingDeck] = useState<FlashcardDeck | null>(null);
  const [deckToDelete, setDeckToDelete] = useState<FlashcardDeck | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);

  // Calculate user tier using proper subscription hook
  const userTier = subscription?.plan || (user ? 'free' : 'guest');
  const limits = FlashcardManager.getDeckLimits(userTier);

  // Debug logging
  console.log('[FlashcardsPage] User:', user);
  console.log('[FlashcardsPage] Subscription from hook:', subscription);
  console.log('[FlashcardsPage] User tier:', userTier, 'isPremium from hook:', isPremium);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Load flashcard decks
      const userDecks = await flashcardManager.getDecks(user.uid, isPremium);
      setDecks(userDecks);

      // Load user lists for import option
      const lists = await listManager.getLists(user.uid, isPremium);
      setUserLists(lists);
    } catch (error) {
      console.error('Failed to load flashcard data:', error);
      showToast(t('flashcards.errors.loadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDeck = async (deckRequest: CreateDeckRequest) => {
    if (!user) {
      showToast(t('flashcards.limits.guest'), 'error');
      return;
    }

    // Check deck limits
    if (limits.maxDecks !== -1 && decks.length >= limits.maxDecks) {
      showToast(t('flashcards.errors.limitReached'), 'error');
      return;
    }

    try {
      const newDeck = await flashcardManager.createDeck(deckRequest, user.uid, isPremium);
      if (newDeck) {
        setDecks([newDeck, ...decks]);
        setShowCreator(false);
        setEditingDeck(null);
        showToast(t('flashcards.success.deckCreated'), 'success');
      }
    } catch (error: any) {
      console.error('Failed to create deck:', error);
      // Show specific error message if available
      const errorMessage = error?.message || t('flashcards.errors.saveFailed');
      showToast(errorMessage, 'error');
    }
  };

  const handleUpdateDeck = async (deckRequest: CreateDeckRequest) => {
    if (!user || !editingDeck) {
      showToast(t('flashcards.errors.updateFailed'), 'error');
      return;
    }

    try {
      const updatedDeck = await flashcardManager.updateDeck(editingDeck.id, deckRequest, user.uid, isPremium);
      if (updatedDeck) {
        setDecks(decks.map(d => d.id === updatedDeck.id ? updatedDeck : d));
        setShowCreator(false);
        setEditingDeck(null);
        showToast(t('flashcards.success.deckUpdated'), 'success');
      }
    } catch (error) {
      console.error('Failed to update deck:', error);
      showToast(t('flashcards.errors.updateFailed'), 'error');
    }
  };

  const handleEditDeck = (deck: FlashcardDeck) => {
    setEditingDeck(deck);
    setShowCreator(true);
  };

  const handleDeleteDeck = (deck: FlashcardDeck) => {
    setDeckToDelete(deck);
    setShowDeleteDialog(true);
  };

  const confirmDeleteDeck = async () => {
    if (!user || !deckToDelete) return;

    try {
      const success = await flashcardManager.deleteDeck(deckToDelete.id, user.uid, isPremium);
      if (success) {
        setDecks(decks.filter(d => d.id !== deckToDelete.id));
        showToast(t('flashcards.success.deckDeleted'), 'success');
      }
    } catch (error) {
      console.error('Failed to delete deck:', error);
      showToast(t('flashcards.errors.deleteFailed'), 'error');
    } finally {
      setDeckToDelete(null);
      setShowDeleteDialog(false);
    }
  };

  const handleExportDeck = async (deck: FlashcardDeck) => {
    try {
      const csvData = await flashcardManager.exportDeck(deck.id, 'csv');
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${deck.name}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(t('flashcards.success.exported'), 'success');
    } catch (error) {
      console.error('Failed to export deck:', error);
      showToast(t('flashcards.export.error'), 'error');
    }
  };

  const handleStudyDeck = (deck: FlashcardDeck) => {
    if (!user && userTier === 'guest') {
      showToast(t('flashcards.limits.guest'), 'error');
      return;
    }

    // Check daily review limits
    if (limits.dailyReviews !== -1) {
      // TODO: Check actual daily usage
    }

    setStudyingDeck(deck);
  };

  const handleSyncDeck = async (deck: FlashcardDeck) => {
    if (!user || !isPremium) {
      showToast(t('flashcards.errors.syncRequiresPremium'), 'error');
      return;
    }

    try {
      showToast(t('flashcards.syncing'), 'info');

      // Save the deck to Firebase
      const success = await flashcardManager.syncDeckToFirebase(deck, user.uid);

      if (success) {
        showToast(t('flashcards.success.syncComplete'), 'success');
        // Reload to ensure we have the latest data
        await loadData();
      } else {
        showToast(t('flashcards.errors.syncFailed'), 'error');
      }
    } catch (error) {
      console.error('Failed to sync deck:', error);
      showToast(t('flashcards.errors.syncFailed'), 'error');
    }
  };

  const handleSessionComplete = (summary: SessionSummary) => {
    setStudyingDeck(null);

    // Show success message with stats
    const message = `${t('flashcards.success.progressSaved')} - ${Math.round(summary.accuracy * 100)}% ${t('flashcards.accuracy')}`;
    showToast(message, 'success');

    // Reload decks to update stats
    loadData();
  };

  // Calculate overall stats
  const totalCards = decks.reduce((sum, deck) => sum + deck.stats.totalCards, 0);
  const totalMastered = decks.reduce((sum, deck) => sum + deck.stats.masteredCards, 0);
  const totalDue = decks.reduce((sum, deck) => {
    const now = Date.now();
    return sum + deck.cards.filter(card =>
      card.metadata?.nextReview && card.metadata.nextReview <= now
    ).length;
  }, 0);
  const averageAccuracy = decks.length > 0
    ? decks.reduce((sum, deck) => sum + deck.stats.averageAccuracy, 0) / decks.length
    : 0;

  if (authLoading || loading) {
    return <LoadingOverlay message={t('common.loading')} />;
  }

  if (studyingDeck) {
    return (
      <StudySession
        deck={studyingDeck}
        cards={studyingDeck.cards}
        onComplete={handleSessionComplete}
        onExit={() => setStudyingDeck(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-DEFAULT dark:from-dark-850 dark:to-dark-900">
      <Navbar user={user} showUserMenu={true} />

      {/* Learning Page Header without optional props */}
      <LearningPageHeader
        title={t('flashcards.pageTitle')}
        description={t('flashcards.pageDescription')}
        mascot="doshi"
      />

      <div className="container mx-auto px-4 py-8">

        {/* Toggle Stats View */}
        <div className="flex justify-end mb-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowStats(!showStats)}
            className="px-4 py-2 bg-gradient-to-r from-primary-500 to-purple-500 text-white rounded-lg shadow-lg font-medium flex items-center gap-2"
          >
            <BarChart3 className="w-5 h-5" />
            {showStats ? t('flashcards.hideStats') : t('flashcards.showStats')}
          </motion.button>
        </div>

        {/* Statistics Dashboard or Cards */}
        {showStats ? (
          <StatsDashboard
            decks={decks}
            sessions={sessions}
            userId={user?.uid}
            onViewDetails={(deckId) => {
              const deck = decks.find(d => d.id === deckId);
              if (deck) handleStudyDeck(deck);
            }}
          />
        ) : (
          /* Stats Cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-soft-white dark:bg-dark-800 rounded-xl p-6 shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <BookOpen className="w-8 h-8 text-blue-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {totalCards}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('flashcards.totalCards', { count: totalCards })}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-soft-white dark:bg-dark-800 rounded-xl p-6 shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <Trophy className="w-8 h-8 text-yellow-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {totalMastered}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('flashcards.masteryLevel')}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-soft-white dark:bg-dark-800 rounded-xl p-6 shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <Target className="w-8 h-8 text-green-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {Math.round(averageAccuracy * 100)}%
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('flashcards.stats.averageAccuracy')}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-soft-white dark:bg-dark-800 rounded-xl p-6 shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-8 h-8 text-purple-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {totalDue}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('flashcards.dueForReview')}
            </p>
          </motion.div>
        </div>
        )}

        {/* Deck Limits Warning */}
        {!user && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-yellow-800 dark:text-yellow-200">
              {t('flashcards.limits.guest')}
            </p>
          </div>
        )}

        {user && !isPremium && decks.length >= limits.maxDecks - 2 && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-blue-800 dark:text-blue-200">
              {t('flashcards.limits.freeLimit', {
                current: decks.length,
                max: limits.maxDecks
              })}
            </p>
          </div>
        )}

        {/* Deck Grid */}
        <DeckGrid
          decks={decks}
          onDeckClick={handleStudyDeck}
          onCreateDeck={() => setShowCreator(true)}
          onEditDeck={handleEditDeck}
          onDeleteDeck={handleDeleteDeck}
          onExportDeck={handleExportDeck}
          onStudyDeck={handleStudyDeck}
          onSyncDeck={handleSyncDeck}
          showStats={true}
          gridCols={3}
          isPremium={isPremium}
        />

        {/* Deck Creator Modal */}
        <DeckCreator
          isOpen={showCreator}
          onClose={() => {
            setShowCreator(false);
            setEditingDeck(null);
          }}
          onSave={editingDeck ? handleUpdateDeck : handleCreateDeck}
          userLists={userLists}
          userId={user?.uid || 'guest'}
          isPremium={isPremium}
          editDeck={editingDeck}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog
          isOpen={showDeleteDialog}
          onClose={() => {
            setShowDeleteDialog(false);
            setDeckToDelete(null);
          }}
          onConfirm={confirmDeleteDeck}
          title={t('flashcards.confirmDelete.title')}
          message={t('flashcards.confirmDelete.message', { name: deckToDelete?.name || '' })}
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          type="danger"
        />
      </div>
    </div>
  );
}