'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import LearningPageHeader from '@/components/learn/LearningPageHeader';
import { DeckGrid } from '@/components/flashcards/DeckGrid';
import { DeckCreator } from '@/components/flashcards/DeckCreator';
import { StudySession } from '@/components/flashcards/StudySession';
import { StudyModeSelector } from '@/components/flashcards/StudyModeSelector';
import { StatsDashboard } from '@/components/flashcards/StatsDashboard';
import { StudyRecommendations } from '@/components/flashcards/StudyRecommendations';
import { DailyGoals } from '@/components/flashcards/DailyGoals';
import { AchievementDisplay, AchievementNotification } from '@/components/flashcards/AchievementDisplay';
import { achievementManager, type Achievement } from '@/lib/flashcards/AchievementManager';
import { ComebackMessage, checkForComeback } from '@/components/flashcards/ComebackMessage';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import Dialog from '@/components/ui/Dialog';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { flashcardManager, FlashcardManager } from '@/lib/flashcards/FlashcardManager';
import { listManager } from '@/lib/lists/ListManager';
import { storageManager } from '@/lib/flashcards/StorageManager';
import { migrationManager } from '@/lib/flashcards/MigrationManager';
import { sessionManager } from '@/lib/flashcards/SessionManager';
import type { FlashcardDeck, CreateDeckRequest, SessionSummary, DeckSettings, SessionStats } from '@/types/flashcards';
import type { StudyRecommendation, LearningInsights } from '@/lib/flashcards/SessionManager';
import type { UserList } from '@/types/userLists';
import { Trophy, TrendingUp, Target, Clock, BookOpen, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

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
  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [showMigration, setShowMigration] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<any>(null);
  const [deckToStudy, setDeckToStudy] = useState<FlashcardDeck | null>(null);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [recommendations, setRecommendations] = useState<StudyRecommendation[]>([]);
  const [insights, setInsights] = useState<LearningInsights | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showAchievements, setShowAchievements] = useState(false);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);
  const [comebackInfo, setComebackInfo] = useState<{ daysAway: number; lastStudyDate: Date } | null>(null);

  // Prevent race conditions
  const loadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Calculate user tier using proper subscription hook
  const userTier = subscription?.plan || (user ? 'free' : 'guest');
  const limits = FlashcardManager.getDeckLimits(userTier);

  // Debug logging
  console.log('[FlashcardsPage] User:', user);
  console.log('[FlashcardsPage] Subscription from hook:', subscription);
  console.log('[FlashcardsPage] User tier:', userTier, 'isPremium from hook:', isPremium);

  useEffect(() => {
    loadData();

    // Check for comeback
    if (user) {
      checkForComeback(user.uid).then(comeback => {
        if (comeback && comeback.daysAway >= 3) {
          setComebackInfo({
            daysAway: comeback.daysAway,
            lastStudyDate: comeback.lastStudyDate
          });

          // Unlock comeback achievement if eligible
          if (comeback.isComeback) {
            const achievement = achievementManager.unlockAchievement(user.uid, 'comeback_kid');
            if (achievement) {
              // Show achievement after comeback message closes
              setTimeout(() => setNewAchievement(achievement), 11000);
            }
          }
        }
      });
    }

    // Check for plan upgrade and migration needs
    if (user && isPremium) {
      checkForMigration();
    }

    // Monitor storage status
    checkStorageStatus();

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [user, isPremium]);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Prevent concurrent loads
    if (loadingRef.current) {
      return;
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    loadingRef.current = true;
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);

      // Load flashcard decks
      const userDecks = await flashcardManager.getDecks(user.uid, isPremium);

      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      setDecks(userDecks);

      // Load user lists for import option
      const lists = await listManager.getLists(user.uid, isPremium);

      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      setUserLists(lists);

      // Load learning insights and recommendations
      if (userDecks.length > 0) {
        // Get learning insights
        const userInsights = await sessionManager.getLearningInsights(user.uid);
        setInsights(userInsights);

        // Get study recommendations
        const studyRecs = await sessionManager.getStudyRecommendations(user.uid, userDecks);
        setRecommendations(studyRecs);

        // Calculate current streak
        const streak = await sessionManager.calculateStreak(user.uid);
        setCurrentStreak(streak);

        // Load recent sessions
        const recentSessions = await sessionManager.getUserSessions(user.uid, 10);
        setSessions(recentSessions);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Failed to load flashcard data:', error);
        showToast(t('flashcards.errors.loadFailed'), 'error');
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  const checkStorageStatus = async () => {
    try {
      const info = await storageManager.getStorageInfo();
      setStorageInfo(info);

      // Set up storage warnings
      storageManager.onWarning((warning) => {
        showToast(warning.message, warning.level === 'critical' ? 'error' : 'info');
      });
    } catch (error) {
      console.error('Failed to check storage status:', error);
    }
  };

  const checkForMigration = async () => {
    if (!user || !isPremium) return;

    try {
      const needsMigration = await migrationManager.checkForUpgrade(user.uid, userTier);
      if (needsMigration) {
        setShowMigration(true);
      }
    } catch (error) {
      console.error('Failed to check for migration:', error);
    }
  };

  const handleBulkSync = async () => {
    if (!user || !isPremium) {
      showToast(t('flashcards.errors.syncRequiresPremium'), 'error');
      return;
    }

    setShowMigration(false);
    setMigrationProgress({ status: 'preparing' });

    try {
      // Set up progress monitoring
      migrationManager.onProgress((progress) => {
        setMigrationProgress(progress);
      });

      const result = await migrationManager.migrateAllDecks(user.uid);

      if (result.success) {
        showToast(t('flashcards.success.allSynced'), 'success');
        await loadData(); // Reload decks
      } else {
        showToast(t('flashcards.errors.syncFailed'), 'error');
      }
    } catch (error) {
      console.error('Bulk sync failed:', error);
      showToast(t('flashcards.errors.syncFailed'), 'error');
    } finally {
      setMigrationProgress(null);
    }
  };

  const handleExportAll = async () => {
    if (!user) return;

    try {
      const jsonData = await migrationManager.exportAllDecks(user.uid);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all-decks-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(t('flashcards.success.allExported'), 'success');
    } catch (error) {
      console.error('Export failed:', error);
      showToast(t('flashcards.errors.exportFailed'), 'error');
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

      // Handle specific error types
      if (error.name === 'QuotaExceededError' || error.message?.includes('QuotaExceededError')) {
        showToast(t('flashcards.errors.storageQuotaExceeded'), 'error');
        // Show storage cleanup suggestions
        const suggestions = await storageManager.getCleanupSuggestions();
        if (suggestions.length > 0) {
          showToast(suggestions[0], 'info');
        }
      } else {
        // Show specific error message if available
        const errorMessage = error?.message || t('flashcards.errors.saveFailed');
        showToast(errorMessage, 'error');
      }
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

    // Show the study mode selector instead of session settings
    setDeckToStudy(deck);
    setShowModeSelector(true);
  };

  const handleStartSession = (selectedCards: any[], mode: string) => {
    if (!deckToStudy || selectedCards.length === 0) return;

    // Set the deck with the selected cards for this session
    setStudyingDeck({
      ...deckToStudy,
      cards: selectedCards,
      settings: {
        ...deckToStudy.settings,
        reviewMode: mode === 'speed' ? 'speed' : mode === 'cramming' ? 'cramming' : 'srs',
        sessionLength: selectedCards.length
      }
    });

    // Close the modal
    setShowModeSelector(false);
    setDeckToStudy(null);
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

  const handleSessionComplete = async (summary: SessionSummary) => {
    setStudyingDeck(null);

    // Check for unlocked achievements
    if ((summary as any).unlockedAchievements?.length > 0) {
      // Show the first achievement notification
      setNewAchievement((summary as any).unlockedAchievements[0]);

      // Show all achievements after a delay if there are multiple
      if ((summary as any).unlockedAchievements.length > 1) {
        let delay = 6000;
        (summary as any).unlockedAchievements.slice(1).forEach((achievement: Achievement) => {
          setTimeout(() => setNewAchievement(achievement), delay);
          delay += 6000;
        });
      }
    }

    // Update user stats with XP if user is logged in
    if (user && summary.xpEarned && summary.xpEarned > 0) {
      try {
        // Update stats via API route
        const response = await fetch('/api/user-stats/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            xpGained: summary.xpEarned,
            source: 'flashcard_session',
            sessionData: {
              type: 'flashcard',
              accuracy: summary.accuracy,
              itemsReviewed: summary.cardsStudied
            }
          })
        });

        if (response.ok) {
          // Show success message with XP earned
          const message = `${t('flashcards.success.progressSaved')} - ${Math.round(summary.accuracy * 100)}% ${t('flashcards.accuracy')} - +${summary.xpEarned} XP!`;
          showToast(message, 'success');
        } else {
          throw new Error('Failed to update stats');
        }
      } catch (error) {
        console.error('Failed to update user stats:', error);
        // Still show success without XP
        const message = `${t('flashcards.success.progressSaved')} - ${Math.round(summary.accuracy * 100)}% ${t('flashcards.accuracy')}`;
        showToast(message, 'success');
      }
    } else {
      // Show success message without XP for guests
      const message = `${t('flashcards.success.progressSaved')} - ${Math.round(summary.accuracy * 100)}% ${t('flashcards.accuracy')}`;
      showToast(message, 'success');
    }

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

        {/* Migration Banner for New Premium Users */}
        {showMigration && isPremium && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold mb-1">{t('flashcards.migration.title')}</h3>
                <p className="text-sm opacity-90">{t('flashcards.migration.description')}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkSync}
                  className="px-4 py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-gray-100"
                >
                  {t('flashcards.migration.syncNow')}
                </button>
                <button
                  onClick={() => setShowMigration(false)}
                  className="px-3 py-2 bg-white/20 rounded-lg hover:bg-white/30"
                >
                  {t('common.later')}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Migration Progress */}
        {migrationProgress && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-4 bg-gray-100 dark:bg-dark-800 rounded-lg"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500"></div>
              <span className="font-medium">{t('flashcards.migration.inProgress')}</span>
            </div>
            {migrationProgress.currentDeck && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('flashcards.migration.syncingDeck', { deck: migrationProgress.currentDeck })}
              </p>
            )}
            <div className="mt-2 w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all"
                style={{
                  width: `${migrationProgress.total > 0
                    ? (migrationProgress.completed / migrationProgress.total) * 100
                    : 0}%`
                }}
              />
            </div>
          </motion.div>
        )}

        {/* Storage Info and Actions Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          {/* Storage Info */}
          {storageInfo && !isPremium && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>{t('flashcards.storage.using')}:</span>
              <span className="font-medium">
                {storageManager.formatBytes(storageInfo.usage)} / {storageManager.formatBytes(storageInfo.quota)}
              </span>
              <span className={cn(
                "px-2 py-1 rounded-full text-xs",
                storageInfo.percentage > 90 ? "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300" :
                storageInfo.percentage > 70 ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300" :
                "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300"
              )}>
                {Math.round(storageInfo.percentage)}%
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {isPremium && decks.length > 0 && (
              <button
                onClick={handleBulkSync}
                className="px-3 py-1.5 text-sm bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:opacity-90"
              >
                {t('flashcards.actions.syncAll')}
              </button>
            )}
            {decks.length > 0 && (
              <button
                onClick={handleExportAll}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600"
              >
                {t('flashcards.actions.exportAll')}
              </button>
            )}
          </div>
        </div>

        {/* Daily Goals (show for logged in users) */}
        {user && (
          <div className="mb-8">
            <DailyGoals
              userId={user.uid}
              isPremium={isPremium}
              onGoalComplete={(goalType) => {
                // Could trigger achievements here
                console.log('Goal completed:', goalType);
              }}
            />
          </div>
        )}

        {/* Study Recommendations (show only if user has decks and recommendations) */}
        {user && recommendations.length > 0 && (
          <div className="mb-8">
            <StudyRecommendations
              recommendations={recommendations}
              insights={insights}
              currentStreak={currentStreak}
              onSelectDeck={(deckId) => {
                const deck = decks.find(d => d.id === deckId);
                if (deck) handleStudyDeck(deck);
              }}
            />
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="flex justify-between mb-4">
          {/* Achievements Button */}
          {user && (
            <button
              onClick={() => setShowAchievements(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              <Trophy className="w-5 h-5" />
              {t('flashcards.achievements.viewAll')}
            </button>
          )}

          {/* Toggle Stats View */}
          <div className="flex justify-end flex-1">
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
          onSessionSettings={(deck) => {
            setDeckToStudy(deck);
            setShowModeSelector(true);
          }}
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

        {/* Study Mode Selector Modal */}
        {deckToStudy && (
          <StudyModeSelector
            isOpen={showModeSelector}
            deck={deckToStudy}
            onClose={() => {
              setShowModeSelector(false);
              setDeckToStudy(null);
            }}
            onStartSession={handleStartSession}
          />
        )}

        {/* Achievement Display Modal */}
        {showAchievements && user && (
          <AchievementDisplay
            userId={user.uid}
            currentStats={{
              streak: currentStreak,
              totalCardsReviewed: decks.reduce((sum, d) => sum + (d.stats.totalCards || 0), 0),
              totalMasteredCards: decks.reduce((sum, d) => sum + (d.stats.masteredCards || 0), 0),
              averageAccuracy: averageAccuracy,
              totalDecksCreated: decks.length,
              totalMinutesStudied: sessions.reduce((sum, s) => sum + Math.floor((s as any).duration / 60000), 0)
            }}
            onClose={() => setShowAchievements(false)}
          />
        )}

        {/* Achievement Notification */}
        {newAchievement && (
          <AchievementNotification
            achievement={newAchievement}
            onClose={() => setNewAchievement(null)}
          />
        )}

        {/* Comeback Message */}
        {comebackInfo && (
          <ComebackMessage
            daysAway={comebackInfo.daysAway}
            lastStudyDate={comebackInfo.lastStudyDate}
            onClose={() => setComebackInfo(null)}
          />
        )}
      </div>
    </div>
  );
}