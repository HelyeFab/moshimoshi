'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/hooks/useAuth';
import { useFeature } from '@/hooks/useFeature';
import { useSubscription } from '@/hooks/useSubscription';
import { useXP } from '@/hooks/useXP';
import Navbar from '@/components/layout/Navbar';
import LearningPageHeader from '@/components/learn/LearningPageHeader';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { useToast } from '@/components/ui/Toast';
import { recordActivityAndSync } from '@/lib/sync/streakSync';
import { StreakActivity } from '@/stores/streakStore';
import { useAchievementStore } from '@/stores/achievement-store';
import type { DrillSession, DrillQuestion, DrillSettings } from '@/types/drill';
import { DrillProgressManager } from '@/lib/review-engine/progress/DrillProgressManager';
import type { DrillSessionData } from '@/lib/review-engine/progress/DrillProgressManager';

export default function DrillPage() {
  const { t, strings } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const { checkAndTrack, remaining } = useFeature('conjugation_drill');
  const { showToast } = useToast();
  const { trackXP } = useXP();
  const { updateProgress } = useAchievementStore();
  const drillManager = DrillProgressManager.getInstance();

  // Debug logging
  useEffect(() => {
    console.log('[Drill Page] Subscription:', subscription);
    console.log('[Drill Page] Remaining drills:', remaining);
  }, [subscription, remaining]);

  // Initialize DrillProgressManager
  useEffect(() => {
    if (user?.uid) {
      drillManager.initializeDrillProgress(user.uid);
    }
  }, [user?.uid]);

  // Drill state
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<DrillSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [drillStats, setDrillStats] = useState<any>(null);

  // Settings state with question count slider
  const [settings, setSettings] = useState<DrillSettings>({
    questionsPerSession: 10, // Default 10 questions
    autoAdvance: false,
    showRules: true,
    wordTypeFilter: 'all',
    drillMode: 'random',
    selectedLists: []
  });

  // Question count limits based on user plan
  const getQuestionLimits = () => {
    if (!user) return { min: 5, max: 10, default: 5 }; // Guest

    // Get actual subscription plan
    const plan = subscription?.plan || 'free';
    switch (plan) {
      case 'premium_monthly':
      case 'premium_yearly':
        return { min: 5, max: 50, default: 20 }; // Premium
      case 'free':
        return { min: 5, max: 20, default: 10 }; // Free
      default:
        return { min: 5, max: 10, default: 5 }; // Guest
    }
  };

  const questionLimits = getQuestionLimits();

  // Initialize settings with plan defaults
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      questionsPerSession: questionLimits.default
    }));
  }, [user]);

  // Load drill stats on mount and after completion
  useEffect(() => {
    const loadStats = async () => {
      if (user?.uid) {
        const isPremium = subscription?.plan?.includes('premium');
        const stats = await drillManager.getDrillStats(user.uid, isPremium || false);
        setDrillStats(stats);
      }
    };
    loadStats();
  }, [user?.uid, subscription, isComplete]);

  const startDrill = async () => {
    // Check entitlement
    const allowed = await checkAndTrack({ showUI: true });
    if (!allowed) {
      // Don't show another toast - checkAndTrack already showed one with showUI: true
      return;
    }

    setLoading(true);
    try {
      // Create session via API
      const response = await fetch('/api/drill/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: settings.drillMode,
          wordTypeFilter: settings.wordTypeFilter,
          selectedLists: settings.selectedLists,
          questionsCount: settings.questionsPerSession // Pass the user-selected count
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start drill');
      }

      const { data } = await response.json();
      setSession(data.session);
      setCurrentQuestionIndex(0);
      setScore(0);
      setIsComplete(false);
    } catch (error) {
      console.error('Error starting drill:', error);
      showToast(t('drill.startError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (answer: string) => {
    if (!session || showResult) return;

    setSelectedAnswer(answer);
    setShowResult(true);

    const currentQuestion = session.questions[currentQuestionIndex];
    const isCorrect = answer === currentQuestion.correctAnswer;

    if (isCorrect) {
      setScore(score + 1);
    }

    // Auto-advance after delay if enabled
    if (settings.autoAdvance) {
      setTimeout(() => nextQuestion(), 1500);
    }
  };

  const handleDrillComplete = async () => {
    if (!session || !user) return;

    const isPremium = subscription?.plan === 'premium_monthly' ||
                      subscription?.plan === 'premium_yearly';
    const accuracy = (score / session.questions.length) * 100;

    try {
      // 1. Extract practiced words from session
      const verbsPracticed: string[] = [];
      const adjectivesPracticed: string[] = [];
      const conjugationTypes: string[] = [];

      session.questions.forEach(question => {
        // Extract word type and conjugation
        if (question.word.type === 'verb') {
          verbsPracticed.push(question.word.kanji || question.word.kana);
        } else if (question.word.type === 'adjective') {
          adjectivesPracticed.push(question.word.kanji || question.word.kana);
        }
        conjugationTypes.push(question.targetForm);
      });

      // 2. Create session data object
      const sessionData: DrillSessionData = {
        sessionId: session.id,
        userId: user.uid,
        startedAt: new Date(session.startedAt),
        completedAt: new Date(),
        questions: session.questions.length,
        correctAnswers: score,
        accuracy: accuracy,
        mode: session.mode || 'random',
        wordTypeFilter: session.wordTypeFilter || 'all',
        verbsPracticed: [...new Set(verbsPracticed)], // Remove duplicates
        adjectivesPracticed: [...new Set(adjectivesPracticed)],
        conjugationTypes: [...new Set(conjugationTypes)]
      };

      // 3. Track drill session using DrillProgressManager
      // This automatically handles:
      // - IndexedDB storage for all users
      // - Firebase sync for premium users
      // - Achievement event emission
      await drillManager.trackDrillSession(sessionData, user, isPremium);

      // 4. Track activity for streak
      await recordActivityAndSync(
        StreakActivity.DRILL_COMPLETION,
        isPremium,
        Date.now()
      );

      // 5. Award XP based on performance
      let xpAmount = 25; // Base XP
      if (accuracy === 100) {
        xpAmount += 50; // Perfect bonus = 75 total
      } else if (accuracy >= 90) {
        xpAmount += 30; // = 55 total
      } else if (accuracy >= 80) {
        xpAmount += 20; // = 45 total
      } else if (accuracy >= 70) {
        xpAmount += 10; // = 35 total
      }

      // 6. Track XP with idempotency and feature tracking
      await trackXP(
        'drill_completed',
        xpAmount,
        `Drill Session - ${session.mode}`,
        {
          // Required fields for proper tracking
          idempotencyKey: `drill_${session.id}`,
          feature: 'drill',

          // Session details
          sessionId: session.id,
          accuracy,
          questionsCount: session.questions.length,
          score: score,
          mode: session.mode,
          wordTypeFilter: session.wordTypeFilter
        }
      );

      // 7. Update achievements
      await updateProgress({
        sessionType: 'drill',
        itemsReviewed: session.questions.length,
        accuracy,
        duration: Date.now() - new Date(session.startedAt).getTime()
      });

      // 8. Show success message with stats
      const stats = await drillManager.getDrillStats(user.uid, isPremium);
      showToast(
        `${t('drill.complete')} - ${t('common.accuracy')}: ${accuracy.toFixed(1)}% (+${xpAmount} XP) | Total Drills: ${stats?.totalDrills || 1}`,
        'success'
      );

    } catch (error) {
      console.error('Error tracking drill completion:', error);
      // Still show basic completion even if tracking fails
      showToast(t('drill.complete'), 'success');
    }
  };

  const nextQuestion = async () => {
    if (!session) return;

    if (currentQuestionIndex < session.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      // Complete the drill and track progress
      setIsComplete(true);
      await handleDrillComplete();
    }
  };

  const handleDrillComplete = async () => {
    if (!session) return;

    const isPremium = subscription?.plan === 'premium_monthly' || subscription?.plan === 'premium_yearly';
    const accuracy = (score / session.questions.length) * 100;

    try {
      // 1. Record drill session for streak (local for free, synced for premium)
      await recordActivityAndSync(
        StreakActivity.DRILL_COMPLETION,
        isPremium,
        Date.now()
      );

      // 2. Award XP based on performance
      let xpAmount = 25; // Base XP for completion
      if (accuracy === 100) {
        xpAmount += 50; // Perfect session bonus
      } else if (accuracy >= 90) {
        xpAmount += 30;
      } else if (accuracy >= 80) {
        xpAmount += 20;
      } else if (accuracy >= 70) {
        xpAmount += 10;
      }

      // Track XP if user is authenticated (local for free, synced for premium)
      if (user) {
        if (isPremium) {
          // Premium users: XP syncs to Firebase
          await trackXP(
            'review_completed',
            xpAmount,
            'Drill Session',
            {
              sessionId: session.id,
              accuracy,
              questionsCount: session.questions.length,
              score: score,
              mode: session.mode
            }
          );
        } else {
          // Free users: Store XP locally
          const currentXP = parseInt(localStorage.getItem(`xp_${user.uid}`) || '0');
          const newXP = currentXP + xpAmount;
          localStorage.setItem(`xp_${user.uid}`, newXP.toString());

          // Trigger XP gained event for UI update
          window.dispatchEvent(new CustomEvent('xpGained', {
            detail: {
              xpGained: xpAmount,
              totalXP: newXP,
              source: 'Drill Session'
            }
          }));
        }
      }

      // 3. Update achievement progress (local for all)
      await updateProgress({
        sessionType: 'drill',
        itemsReviewed: session.questions.length,
        accuracy,
        duration: Date.now() - new Date(session.startedAt).getTime()
      });

      // 4. Save drill session data
      if (isPremium) {
        // Premium users: Save to Firebase
        await fetch('/api/drill/session', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: session.id,
            action: 'complete',
            finalScore: score,
            accuracy
          })
        });
      } else if (user) {
        // Free users: Save to IndexedDB
        const drillHistory = JSON.parse(localStorage.getItem(`drill_history_${user.uid}`) || '[]');
        drillHistory.push({
          sessionId: session.id,
          completedAt: new Date().toISOString(),
          score: score,
          totalQuestions: session.questions.length,
          accuracy,
          mode: session.mode,
          wordTypeFilter: session.wordTypeFilter
        });
        // Keep only last 50 sessions in local storage
        if (drillHistory.length > 50) {
          drillHistory.shift();
        }
        localStorage.setItem(`drill_history_${user.uid}`, JSON.stringify(drillHistory));

        // Update drill stats in localStorage
        const stats = JSON.parse(localStorage.getItem(`drill_stats_${user.uid}`) || '{}');
        stats.totalSessions = (stats.totalSessions || 0) + 1;
        stats.totalQuestions = (stats.totalQuestions || 0) + session.questions.length;
        stats.totalCorrect = (stats.totalCorrect || 0) + score;
        stats.lastSessionAt = new Date().toISOString();
        if (accuracy === 100) {
          stats.perfectSessions = (stats.perfectSessions || 0) + 1;
        }
        if (!stats.bestAccuracy || accuracy > stats.bestAccuracy) {
          stats.bestAccuracy = accuracy;
        }
        localStorage.setItem(`drill_stats_${user.uid}`, JSON.stringify(stats));
      }

      // Show success message with XP gained
      showToast(
        `${t('drill.complete')} - ${t('common.accuracy')}: ${accuracy.toFixed(1)}% (+${xpAmount} XP)`,
        'success'
      );
    } catch (error) {
      console.error('Error tracking drill completion:', error);
      // Still show basic completion message even if tracking fails
      showToast(t('drill.complete'), 'success');
    }
  };

  const resetDrill = () => {
    setSession(null);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setIsComplete(false);
  };

  const currentQuestion = session?.questions[currentQuestionIndex];

  if (loading) {
    return <LoadingOverlay message={t('drill.loading')} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-DEFAULT dark:from-dark-850 dark:to-dark-900">
      <Navbar user={user} showUserMenu={true} />

      <LearningPageHeader
        title={t('drill.title')}
        description={t('drill.description')}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {remaining !== undefined && remaining !== null && (
            <div className="text-center mb-4 text-sm text-primary-600 dark:text-primary-400">
              {remaining === -1
                ? t('drill.unlimited') || 'Unlimited drills available'
                : t('drill.remainingToday', { count: remaining || 0 })}
            </div>
          )}

          {!session ? (
            // Setup screen
            <div className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-semibold mb-6">{t('drill.settings')}</h2>

              {/* Drill Stats Display */}
              {drillStats && drillStats.totalDrills > 0 && (
                <div className="mb-6 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                  <h3 className="font-semibold mb-2">{t('drill.yourProgress') || 'Your Progress'}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('drill.totalDrills') || 'Total Drills'}:</span>
                      <span className="ml-1 font-bold">{drillStats.totalDrills}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('drill.accuracy') || 'Accuracy'}:</span>
                      <span className="ml-1 font-bold">{drillStats.averageAccuracy?.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('drill.perfectDrills') || 'Perfect'}:</span>
                      <span className="ml-1 font-bold">{drillStats.perfectDrills}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('drill.wordsStudied') || 'Words'}:</span>
                      <span className="ml-1 font-bold">
                        {(drillStats.verbsStudied?.size || 0) + (drillStats.adjectivesStudied?.size || 0)}
                      </span>
                    </div>
                  </div>
                  {drillStats.status && (
                    <div className="mt-2 text-xs text-primary-600 dark:text-primary-400">
                      Status: {drillStats.status}
                    </div>
                  )}
                </div>
              )}

              {/* Question Count Slider */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-2">
                  {t('drill.questionsPerSession')}: <span className="text-primary-600 font-bold">{settings.questionsPerSession}</span>
                </label>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">{questionLimits.min}</span>
                  <input
                    type="range"
                    min={questionLimits.min}
                    max={questionLimits.max}
                    value={settings.questionsPerSession}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      questionsPerSession: Number(e.target.value)
                    }))}
                    className="flex-1 h-2 bg-primary-100 rounded-lg appearance-none cursor-pointer dark:bg-dark-700 accent-primary-500"
                  />
                  <span className="text-sm text-muted-foreground">{questionLimits.max}</span>
                </div>
                {user?.subscription?.plan === 'free' && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('drill.upgradeForMore')}
                  </p>
                )}
              </div>

              {/* Word Type Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-2">
                  {t('drill.wordTypeFilter')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, wordTypeFilter: 'all' }))}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      settings.wordTypeFilter === 'all'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    {t('drill.allTypes')}
                  </button>
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, wordTypeFilter: 'verbs' }))}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      settings.wordTypeFilter === 'verbs'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    {t('drill.verbs')}
                  </button>
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, wordTypeFilter: 'adjectives' }))}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      settings.wordTypeFilter === 'adjectives'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    {t('drill.adjectives')}
                  </button>
                </div>
              </div>

              {/* Practice Mode */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-2">
                  {t('drill.practiceMode')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, drillMode: 'random' }))}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      settings.drillMode === 'random'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    {t('drill.randomWords')}
                  </button>
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, drillMode: 'lists' }))}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      settings.drillMode === 'lists'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                    disabled={!user}
                  >
                    {t('drill.myLists')}
                  </button>
                </div>
              </div>

              {/* Auto-advance toggle */}
              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.autoAdvance}
                    onChange={(e) => setSettings(prev => ({ ...prev, autoAdvance: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-foreground dark:text-dark-foreground">
                    {t('drill.autoAdvance')}
                  </span>
                </label>
              </div>

              {/* Start Button */}
              <button
                onClick={startDrill}
                className="w-full py-3 px-6 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
              >
                {t('drill.startDrill')}
              </button>
            </div>
          ) : isComplete ? (
            // Results screen
            <div className="bg-soft-white dark:bg-dark-800 rounded-xl shadow-lg p-8 text-center border border-primary-100 dark:border-dark-700">
              <h2 className="text-3xl font-bold mb-4">{t('drill.complete')}</h2>
              <div className="text-6xl mb-4">
                {score >= session.questions.length * 0.8 ? '🏆' : score >= session.questions.length * 0.6 ? '✨' : '💪'}
              </div>
              <p className="text-2xl mb-2">
                {score} / {session.questions.length}
              </p>
              <p className="text-muted-foreground dark:text-dark-muted mb-6">
                {Math.round((score / session.questions.length) * 100)}% {t('drill.accuracy')}
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={resetDrill}
                  className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
                >
                  {t('drill.newDrill')}
                </button>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-foreground dark:text-dark-foreground rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  {t('drill.backToDashboard')}
                </button>
              </div>
            </div>
          ) : currentQuestion ? (
            // Question screen
            <div className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl shadow-lg p-8">
              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm text-muted-foreground dark:text-dark-muted mb-2">
                  <span>{t('drill.question')} {currentQuestionIndex + 1} / {session.questions.length}</span>
                  <span>{t('drill.score')}: {score}</span>
                </div>
                <div className="w-full bg-primary-100 dark:bg-dark-700 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all"
                    style={{ width: `${((currentQuestionIndex + 1) / session.questions.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">
                  {t('drill.conjugateTo')}: <span className="text-primary-600">{currentQuestion.targetForm}</span>
                </h2>
                <div className="flex items-baseline gap-4 mb-2">
                  <span className="text-3xl font-medium">{currentQuestion.word.kanji}</span>
                  <span className="text-xl text-muted-foreground dark:text-dark-muted">{currentQuestion.word.kana}</span>
                </div>
                <p className="text-muted-foreground dark:text-dark-muted">{currentQuestion.word.meaning}</p>
              </div>

              {/* Answer options */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswer(option)}
                    disabled={showResult}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      showResult && option === currentQuestion.correctAnswer
                        ? 'bg-green-500 text-white border-green-600 dark:bg-green-600 dark:border-green-700'
                        : showResult && option === selectedAnswer && option !== currentQuestion.correctAnswer
                        ? 'bg-red-500 text-white border-red-600 dark:bg-red-600 dark:border-red-700'
                        : option === selectedAnswer
                        ? 'bg-primary-100 border-primary-500 dark:bg-primary-900/30 dark:border-primary-400'
                        : 'bg-white/50 dark:bg-dark-700 border-primary-200 dark:border-dark-600 hover:bg-primary-50 dark:hover:bg-dark-600 hover:border-primary-300'
                    } ${!showResult && !selectedAnswer ? 'hover:border-primary-400' : ''}`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              {/* Next button */}
              {showResult && !settings.autoAdvance && (
                <button
                  onClick={nextQuestion}
                  className="w-full py-3 px-6 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
                >
                  {currentQuestionIndex < session.questions.length - 1 ? t('drill.nextQuestion') : t('drill.showResults')}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}