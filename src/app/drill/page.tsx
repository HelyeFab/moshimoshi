/**
 * Conjugation Drill Page
 * Self-contained drill page following doshi-sensei pattern
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/hooks/useAuth';
import { useFeature } from '@/hooks/useFeature';
import type {
  JapaneseWord,
  DrillQuestion,
  WordTypeFilter,
  DrillMode,
  WordList,
  ConjugationForms
} from '@/types/drill';
import { ConjugationEngine } from '@/lib/drill/conjugation-engine';
import { QuestionGenerator } from '@/lib/drill/question-generator';
import { WordUtils } from '@/lib/drill/word-utils';

export default function DrillPage() {
  const router = useRouter();
  const { t, strings } = useI18n();
  const { user, loading: authLoading } = useAuth();

  // Feature entitlement
  const { checkAndTrack, remaining } = useFeature('conjugation_drill');

  // Drill state
  const [questions, setQuestions] = useState<DrillQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [wordTypeFilter, setWordTypeFilter] = useState<WordTypeFilter>('all');
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [drillMode, setDrillMode] = useState<DrillMode>('random');
  const [autoAdvance, setAutoAdvance] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];
  const isGameComplete = currentQuestionIndex >= questions.length - 1 && showResult;

  // Generate questions for drill
  const generateQuestionsForWords = (words: JapaneseWord[]) => {
    const drillQuestions = QuestionGenerator.generateQuestions(words, 3, 30);
    setQuestions(drillQuestions);
  };

  // Load random practice words
  const loadRandomQuestions = async () => {
    try {
      setLoading(true);

      // Use fallback words for now
      const practiceWords = WordUtils.getCommonPracticeWords();
      const filteredWords = WordUtils.filterByType(practiceWords, wordTypeFilter);

      if (filteredWords.length === 0) {
        setQuestions([]);
        setLoading(false);
        return;
      }

      // Select random words for drill (10 words, 3 questions each = 30 questions)
      const selectedWords = filteredWords
        .sort(() => Math.random() - 0.5)
        .slice(0, 10);

      generateQuestionsForWords(selectedWords);
      setLoading(false);
    } catch (error) {
      console.error('Error generating questions:', error);
      setLoading(false);
    }
  };

  // Start the drill
  const startGame = async () => {
    const canProceed = await checkAndTrack();
    if (!canProceed) return;

    setGameStarted(true);
    setScore(0);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);

    await loadRandomQuestions();
  };

  // Handle answer selection
  const handleAnswer = (answer: string) => {
    if (showResult) return;

    setSelectedAnswer(answer);
    setShowResult(true);

    const isCorrect = answer === currentQuestion?.correctAnswer;
    if (isCorrect) {
      setScore(score + 1);
    }

    // Auto-advance after a delay if enabled
    if (autoAdvance) {
      setTimeout(() => {
        handleNextQuestion();
      }, isCorrect ? 1000 : 2000);
    }
  };

  // Move to next question
  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  };

  // Restart with same questions
  const restartGame = () => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setQuestions(questions.sort(() => Math.random() - 0.5));
  };

  // Back to setup
  const handleBackToSetup = () => {
    setGameStarted(false);
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setShowResult(false);
  };

  if (authLoading) {
    return <LoadingOverlay />;
  }

  // Setup screen
  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light to-background dark:from-dark-850 dark:to-dark-900">
        <Navbar
          user={user ? {
            uid: user.uid,
            email: user.email || undefined,
            displayName: user.displayName,
            photoURL: user.photoURL,
            isAdmin: user.isAdmin
          } : undefined}
          showUserMenu={true}
        />

        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center">
                <span className="text-2xl">⚡</span>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground dark:text-dark-foreground mb-2">
              {t('drill.title')}
            </h1>
            <p className="text-muted-foreground dark:text-dark-muted">
              {t('drill.description')}
            </p>
          </div>

          {/* Practice Mode Selection */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">{t('drill.practiceMode')}</h3>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <button
                onClick={() => setDrillMode('random')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  drillMode === 'random'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-300 dark:border-dark-600 hover:border-primary-300'
                }`}
              >
                <div className="text-2xl mb-2">🎲</div>
                <div className="font-medium">{t('drill.randomWords')}</div>
                <div className="text-sm text-muted-foreground dark:text-dark-muted">
                  {t('drill.randomDescription')}
                </div>
              </button>

              <button
                onClick={() => setDrillMode('lists')}
                disabled={true} // Lists mode not yet implemented
                className={`p-4 rounded-lg border-2 transition-all opacity-50 cursor-not-allowed ${
                  drillMode === 'lists'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-300 dark:border-dark-600'
                }`}
              >
                <div className="text-2xl mb-2">📋</div>
                <div className="font-medium">{t('drill.fromLists')}</div>
                <div className="text-sm text-muted-foreground dark:text-dark-muted">
                  {t('drill.listsDescription')}
                </div>
              </button>
            </div>
          </div>

          {/* Word Type Filter */}
          {drillMode === 'random' && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">{t('drill.wordTypes')}</h3>
              <div className="flex gap-2 flex-wrap">
                {(['all', 'verbs', 'adjectives'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setWordTypeFilter(filter)}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      wordTypeFilter === filter
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-white dark:bg-dark-800 text-foreground dark:text-dark-foreground border-gray-300 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700'
                    }`}
                  >
                    {filter === 'all' ? t('drill.allTypes') :
                     filter === 'verbs' ? t('drill.verbsOnly') : t('drill.adjectivesOnly')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Auto-advance Option */}
          <div className="mb-8">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoAdvance}
                onChange={(e) => setAutoAdvance(e.target.checked)}
                className="rounded border-gray-300 dark:border-dark-600"
              />
              <span className="text-sm">
                {t('drill.autoAdvance')}
              </span>
            </label>
          </div>

          {/* Usage Info */}
          {remaining !== null && remaining >= 0 && (
            <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                {t('drill.remainingToday', { count: remaining })}
              </p>
            </div>
          )}

          {/* Start Button */}
          <div className="flex justify-center">
            <button
              onClick={startGame}
              className="px-8 py-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium text-lg"
            >
              {t('drill.startDrill')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Game screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background dark:from-dark-850 dark:to-dark-900">
      <Navbar
        user={user ? {
          uid: user.uid,
          email: user.email || undefined,
          displayName: user.displayName,
          photoURL: user.photoURL,
          isAdmin: user.isAdmin
        } : undefined}
        showUserMenu={true}
      />

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground dark:text-dark-muted">
              {t('drill.questionNumber', { current: currentQuestionIndex + 1, total: questions.length })}
            </span>
            <span className="text-sm font-medium">
              {t('drill.score')}: {score}/{questions.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {loading ? (
          // Loading state
          <div className="text-center py-12">
            <LoadingOverlay message={t('drill.loadingQuestions')} />
          </div>
        ) : questions.length === 0 ? (
          // No questions
          <div className="text-center py-12 bg-white dark:bg-dark-800 rounded-lg shadow-lg p-8">
            <p className="text-muted-foreground dark:text-dark-muted mb-4">
              {t('drill.noQuestions')}
            </p>
            <button
              onClick={handleBackToSetup}
              className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              {t('drill.backToSetup')}
            </button>
          </div>
        ) : isGameComplete ? (
          // Results screen
          <div className="text-center py-12 bg-white dark:bg-dark-800 rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold mb-4">{t('drill.complete')}</h2>
            <div className="text-6xl mb-6">
              {score >= questions.length * 0.8 ? '🎉' : score >= questions.length * 0.6 ? '👍' : '💪'}
            </div>
            <p className="text-2xl mb-2">
              {t('drill.yourScore')}: {score}/{questions.length}
            </p>
            <p className="text-lg text-muted-foreground dark:text-dark-muted mb-8">
              {Math.round((score / questions.length) * 100)}% {t('drill.accuracy')}
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={restartGame}
                className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                {t('drill.tryAgain')}
              </button>
              <button
                onClick={handleBackToSetup}
                className="px-6 py-3 bg-gray-200 dark:bg-dark-700 text-foreground dark:text-dark-foreground rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors"
              >
                {t('drill.newDrill')}
              </button>
            </div>
          </div>
        ) : currentQuestion ? (
          // Question screen
          <>
            <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-8 mb-6">
              {/* Question Header */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-4">
                  {t('drill.conjugateTo')}: {ConjugationEngine.getFormDisplayName(currentQuestion.targetForm)}
                </h2>
                <div className="flex items-baseline gap-4 mb-2">
                  <span className="text-3xl font-medium">
                    {currentQuestion.word.kanji}
                  </span>
                  <span className="text-xl text-muted-foreground dark:text-dark-muted">
                    {currentQuestion.word.kana}
                  </span>
                </div>
                <p className="text-muted-foreground dark:text-dark-muted">
                  {currentQuestion.word.meaning}
                </p>
              </div>

              {/* Show rules toggle */}
              <button
                onClick={() => setShowRules(!showRules)}
                className="text-sm text-primary-500 hover:text-primary-600 transition-colors mb-4"
              >
                {showRules ? t('drill.hideRules') : t('drill.showRules')}
              </button>

              {showRules && currentQuestion.rule && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm mb-6">
                  <p className="text-blue-700 dark:text-blue-400">
                    {currentQuestion.rule}
                  </p>
                </div>
              )}

              {/* Answer Options */}
              <div className="grid grid-cols-2 gap-3">
                {currentQuestion.options.map((option, index) => {
                  const isCorrect = option === currentQuestion.correctAnswer;
                  const isSelected = option === selectedAnswer;

                  return (
                    <button
                      key={index}
                      onClick={() => handleAnswer(option)}
                      disabled={showResult}
                      className={`p-4 rounded-lg border-2 transition-all text-left font-medium ${
                        showResult
                          ? isCorrect
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                            : isSelected
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                            : 'border-gray-300 dark:border-dark-600 opacity-50'
                          : 'border-gray-300 dark:border-dark-600 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                      }`}
                    >
                      <span className="text-lg">{option}</span>
                      {showResult && isCorrect && (
                        <span className="ml-2 text-green-600">✓</span>
                      )}
                      {showResult && isSelected && !isCorrect && (
                        <span className="ml-2 text-red-600">✗</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Next Button */}
            {showResult && !autoAdvance && (
              <div className="flex justify-center">
                <button
                  onClick={handleNextQuestion}
                  className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  {currentQuestionIndex < questions.length - 1 ? t('common.next') : t('drill.seeResults')}
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}