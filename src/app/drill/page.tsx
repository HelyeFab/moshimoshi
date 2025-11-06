'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/hooks/useAuth';
import { useFeature } from '@/hooks/useFeature';
import { useSubscription } from '@/hooks/useSubscription';
import Navbar from '@/components/layout/Navbar';
import PageHeader from '@/components/layout/PageHeader';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { useToast } from '@/components/ui/Toast';
import type { DrillSession, DrillQuestion, DrillSettings } from '@/types/drill';
import { DrillProgressManager } from '@/lib/review-engine/progress/DrillProgressManager';
import type { DrillSessionData } from '@/lib/review-engine/progress/DrillProgressManager';
import { formatDrillDefinition } from '@/utils/textUtils';
import { ConjugationErrorAnalyzer } from '@/lib/conjugation-help';
import { useConjugationHelp } from '@/contexts/ConjugationHelpContext';
import { HelpModal, HelpBanner } from '@/components/conjugation-help';

export default function DrillPage() {
  const { t, strings } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const { checkAndTrack, remaining } = useFeature('conjugation_drill');
  const { showToast } = useToast();
  const { showMultipleHelps } = useConjugationHelp();
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
  const [currentErrorReport, setCurrentErrorReport] = useState<any>(null);

  // Settings state with question count slider
  const [settings, setSettings] = useState<DrillSettings>({
    questionsPerSession: 10, // Default 10 questions
    autoAdvance: false,
    showRules: true,
    wordTypeFilter: 'all',
    drillMode: 'random',
    selectedLists: [],
    jlptLevels: ['N5', 'N4'], // Default to N5 + N4
    conjugationForms: [] // Empty = all forms
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
          questionsCount: settings.questionsPerSession,
          jlptLevels: settings.jlptLevels,
          conjugationForms: settings.conjugationForms?.length > 0 ? settings.conjugationForms : undefined
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

    let hasRelevantHelp = false;

    if (isCorrect) {
      setScore(score + 1);
      setCurrentErrorReport(null); // Clear any previous error report
    } else {
      // Smart mode: Analyze the error and store it
      try {
        const errorReport = ConjugationErrorAnalyzer.analyzeError(
          answer,
          currentQuestion.correctAnswer,
          currentQuestion.targetForm as any,
          currentQuestion.word
        );

        // Check if we have relevant help to show
        hasRelevantHelp = errorReport.relevantHelp && errorReport.relevantHelp.length > 0;

        // Store error report to show help banner (don't auto-open modal!)
        setCurrentErrorReport(errorReport);
      } catch (error) {
        console.error('Error analyzing conjugation mistake:', error);
        setCurrentErrorReport(null);
        // Don't break the drill flow if error analysis fails
      }
    }

    // Auto-advance after delay if enabled
    // BUT: Don't auto-advance if there's an error with relevant help (let user read it!)
    if (settings.autoAdvance && !hasRelevantHelp) {
      // Only auto-advance for correct answers or errors without help
      setTimeout(() => nextQuestion(), 1500);
    }
    // If there's help to show, user must manually click "Next" to proceed
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
      // - Calling /api/drill/session with action='complete'
      // - Updating Firebase drill_sessions collection
      // - Recording gamification (XP + streak) via coordinator
      // - IndexedDB storage for all users
      // - Firebase sync for premium users
      await drillManager.trackDrillSession(sessionData, user, isPremium);

      // 4. Show success message with stats
      const stats = await drillManager.getDrillStats(user.uid, isPremium);
      showToast(
        `${t('drill.complete')} - ${t('common.accuracy')}: ${accuracy.toFixed(1)}% | Total Drills: ${stats?.totalDrills || 1}`,
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
      setCurrentErrorReport(null); // Clear error report for next question
    } else {
      // Complete the drill and track progress
      setIsComplete(true);
      await handleDrillComplete();
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

      <PageHeader
        title={t('drill.title')}
        description={t('drill.description')}
        mascot="doshi"
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
            <div className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl shadow-lg p-4 sm:p-6 md:p-8">
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">{t('drill.settings')}</h2>

              {/* Drill Stats Display */}
              {drillStats && drillStats.totalDrills > 0 && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                  <h3 className="font-semibold mb-2 text-sm sm:text-base">{t('drill.yourProgress') || 'Your Progress'}</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">{t('drill.totalDrills') || 'Total Drills'}</span>
                      <span className="font-bold text-lg">{drillStats.totalDrills}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">{t('drill.accuracy') || 'Accuracy'}</span>
                      <span className="font-bold text-lg">{drillStats.averageAccuracy?.toFixed(1)}%</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">{t('drill.perfectDrills') || 'Perfect'}</span>
                      <span className="font-bold text-lg">{drillStats.perfectDrills}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">{t('drill.wordsStudied') || 'Words'}</span>
                      <span className="font-bold text-lg">
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
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, wordTypeFilter: 'all' }))}
                    className={`px-1.5 sm:px-4 py-2 rounded-lg border transition-colors text-xs sm:text-base ${
                      settings.wordTypeFilter === 'all'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    {t('drill.allTypes')}
                  </button>
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, wordTypeFilter: 'verbs' }))}
                    className={`px-1.5 sm:px-4 py-2 rounded-lg border transition-colors text-xs sm:text-base ${
                      settings.wordTypeFilter === 'verbs'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    {t('drill.verbs')}
                  </button>
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, wordTypeFilter: 'adjectives' }))}
                    className={`px-1.5 sm:px-4 py-2 rounded-lg border transition-colors text-xs sm:text-base ${
                      settings.wordTypeFilter === 'adjectives'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    {t('drill.adjectives')}
                  </button>
                </div>
              </div>

              {/* JLPT Level Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-2">
                  JLPT Levels <span className="text-xs text-muted-foreground">(Select one or more)</span>
                </label>
                <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                  {(['N5', 'N4', 'N3', 'N2', 'N1'] as const).map(level => (
                    <button
                      key={level}
                      onClick={() => {
                        setSettings(prev => {
                          const current = prev.jlptLevels || [];
                          const isSelected = current.includes(level);
                          if (isSelected) {
                            // Deselect - but keep at least one selected
                            const newLevels = current.filter(l => l !== level);
                            return { ...prev, jlptLevels: newLevels.length > 0 ? newLevels : [level] };
                          } else {
                            // Select
                            return { ...prev, jlptLevels: [...current, level] };
                          }
                        });
                      }}
                      className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg border transition-colors font-medium ${
                        settings.jlptLevels?.includes(level)
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conjugation Forms Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-2">
                  Conjugation Forms <span className="text-xs text-muted-foreground">(Leave empty for all forms)</span>
                </label>
                <div className="space-y-2">
                  {/* Quick presets */}
                  <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                    <button
                      onClick={() => setSettings(prev => ({ ...prev, conjugationForms: [] }))}
                      className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs sm:text-sm transition-colors ${
                        settings.conjugationForms?.length === 0
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      All Forms
                    </button>
                    <button
                      onClick={() => setSettings(prev => ({
                        ...prev,
                        conjugationForms: ['present', 'past', 'negative', 'pastNegative']
                      }))}
                      className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs sm:text-sm border-gray-300 dark:border-gray-600 hover:border-gray-400 transition-colors"
                    >
                      Basic Only
                    </button>
                    <button
                      onClick={() => setSettings(prev => ({
                        ...prev,
                        conjugationForms: ['polite', 'politePast', 'politeNegative', 'politePastNegative']
                      }))}
                      className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs sm:text-sm border-gray-300 dark:border-gray-600 hover:border-gray-400 transition-colors"
                    >
                      Polite Only
                    </button>
                    <button
                      onClick={() => setSettings(prev => ({
                        ...prev,
                        conjugationForms: ['teForm', 'negativeTeForm', 'naiDeForm']
                      }))}
                      className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs sm:text-sm border-gray-300 dark:border-gray-600 hover:border-gray-400 transition-colors"
                    >
                      Te-Forms
                    </button>
                    <button
                      onClick={() => setSettings(prev => ({
                        ...prev,
                        conjugationForms: ['potential', 'potentialNegative', 'potentialPast', 'potentialPastNegative']
                      }))}
                      className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs sm:text-sm border-gray-300 dark:border-gray-600 hover:border-gray-400 transition-colors"
                    >
                      Potential
                    </button>
                    <button
                      onClick={() => setSettings(prev => ({
                        ...prev,
                        conjugationForms: ['passive', 'passiveNegative', 'passivePast', 'passivePastNegative']
                      }))}
                      className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs sm:text-sm border-gray-300 dark:border-gray-600 hover:border-gray-400 transition-colors"
                    >
                      Passive
                    </button>
                    <button
                      onClick={() => setSettings(prev => ({
                        ...prev,
                        conjugationForms: ['causative', 'causativeNegative', 'causativePast', 'causativePastNegative']
                      }))}
                      className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs sm:text-sm border-gray-300 dark:border-gray-600 hover:border-gray-400 transition-colors"
                    >
                      Causative
                    </button>
                  </div>
                  {settings.conjugationForms && settings.conjugationForms.length > 0 && (
                    <div className="text-xs text-primary-600 dark:text-primary-400">
                      Selected: {settings.conjugationForms.length} form{settings.conjugationForms.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* Practice Mode */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-sm font-medium text-foreground dark:text-dark-foreground mb-2">
                  {t('drill.practiceMode')}
                </label>
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, drillMode: 'random' }))}
                    className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg border transition-colors ${
                      settings.drillMode === 'random'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    {t('drill.randomWords')}
                  </button>
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, drillMode: 'lists' }))}
                    className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg border transition-colors ${
                      settings.drillMode === 'lists'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                    disabled={!user}
                  >
                    {t('drill.myLists')}
                  </button>
                </div>
              </div>

              {/* Auto-advance toggle */}
              <div className="mb-6 sm:mb-8">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.autoAdvance}
                    onChange={(e) => setSettings(prev => ({ ...prev, autoAdvance: e.target.checked }))}
                    className="mr-2 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-foreground dark:text-dark-foreground">
                    {t('drill.autoAdvance')}
                  </span>
                </label>
              </div>

              {/* Start Button - More prominent with spacing */}
              <button
                onClick={startDrill}
                className="w-full py-3 px-6 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
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
            <div className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl shadow-lg p-4 sm:p-6 md:p-8">
              {/* Progress bar */}
              <div className="mb-4 sm:mb-6">
                <div className="flex justify-between text-xs sm:text-sm text-muted-foreground dark:text-dark-muted mb-2">
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
              <div className="mb-6 sm:mb-8">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4">
                  {t('drill.conjugateTo')}: <span className="text-primary-600 block sm:inline mt-1 sm:mt-0">{currentQuestion.rule}</span>
                </h2>
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4 mb-2">
                  <span className="text-2xl sm:text-3xl font-medium">{currentQuestion.word.kanji}</span>
                  <span className="text-lg sm:text-xl text-muted-foreground dark:text-dark-muted">{currentQuestion.word.kana}</span>
                </div>
                <p className="text-sm sm:text-base text-muted-foreground dark:text-dark-muted" title={currentQuestion.word.meaning}>
                  {formatDrillDefinition(currentQuestion.word.meaning, 80)}
                </p>
              </div>

              {/* Answer options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswer(option)}
                    disabled={showResult}
                    className={`p-3 sm:p-4 text-base sm:text-lg rounded-lg border-2 transition-all min-h-[60px] sm:min-h-[auto] ${
                      showResult && option === currentQuestion.correctAnswer
                        ? 'bg-green-500 text-white border-green-600 dark:bg-green-600 dark:border-green-700'
                        : showResult && option === selectedAnswer && option !== currentQuestion.correctAnswer
                        ? 'bg-red-500 text-white border-red-600 dark:bg-red-600 dark:border-red-700'
                        : option === selectedAnswer
                        ? 'bg-primary-100 border-primary-500 dark:bg-primary-900/30 dark:border-primary-400'
                        : 'bg-white/50 dark:bg-dark-700 border-primary-200 dark:border-dark-600 hover:bg-primary-50 dark:hover:bg-dark-600 hover:border-primary-300'
                    } ${!showResult && !selectedAnswer ? 'hover:border-primary-400 active:scale-[0.98]' : ''}`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              {/* Help banner - shows contextual help when user makes a mistake */}
              {showResult && currentErrorReport && (
                <HelpBanner
                  errorReport={currentErrorReport}
                  onDismiss={() => {
                    setCurrentErrorReport(null);
                    // If auto-advance is enabled, proceed to next question after dismissing help
                    if (settings.autoAdvance) {
                      setTimeout(() => nextQuestion(), 500); // Short delay after dismissal
                    }
                  }}
                />
              )}

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

      {/* Smart help modal */}
      <HelpModal />
    </div>
  );
}