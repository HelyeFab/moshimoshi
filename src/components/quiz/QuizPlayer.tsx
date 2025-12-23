'use client'

/**
 * QuizPlayer Component
 *
 * Unified quiz player for stories and comics with:
 * - Multi-locale support (ja, en, de, es, fr, it)
 * - Furigana rendering for Japanese text
 * - Auto-save functionality
 * - XP integration
 * - Score calculation with type guards
 */

import React, { useState, useEffect } from 'react'
import { BaseQuizQuestion, isMultipleChoiceQuestion, isAnswerCorrect } from '@/types/quiz'
import { RubyText } from '@/components/quiz/RubyText'
import { useI18n } from '@/i18n/I18nContext'
import { useQuizAutoSave } from '@/hooks/useQuizAutoSave'
import { useGamificationStore } from '@/state/userGamification'
import { CheckCircle, XCircle, ArrowLeft, ArrowRight, Award, Settings, Languages } from 'lucide-react'

export interface QuizPlayerProps {
  /** Quiz questions to display */
  questions: BaseQuizQuestion[]

  /** Type of content (story or comic) */
  contentType: 'story' | 'comic'

  /** Unique content ID for auto-save and progress tracking */
  contentId: string

  /** Optional content title for display */
  contentTitle?: string

  /** Callback when quiz is completed */
  onComplete?: (score: number, xpEarned: number) => void

  /** Callback when user exits quiz */
  onExit?: () => void

  /** Callback when user wants to go back */
  onBack?: () => void

  /** Show translation hints */
  showTranslation?: boolean

  /** Enable localStorage auto-save */
  enableAutoSave?: boolean

  /** Show furigana for Japanese text */
  showFurigana?: boolean

  /** Font size for text rendering */
  fontSize?: 'small' | 'medium' | 'large' | 'xlarge'
}

export function QuizPlayer({
  questions,
  contentType,
  contentId,
  contentTitle,
  onComplete,
  onExit,
  onBack,
  showTranslation = false,
  enableAutoSave = true,
  showFurigana = true,
  fontSize = 'medium',
}: QuizPlayerProps) {
  const { t, language } = useI18n()

  // Quiz state
  const [answers, setAnswers] = useState<Record<number, number | string>>({})
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [xpEarned, setXpEarned] = useState<number>(0)
  const [currentQuestion, setCurrentQuestion] = useState(0)

  // Local settings state (can be changed during quiz)
  const [localShowFurigana, setLocalShowFurigana] = useState(showFurigana)
  const [localShowTranslation, setLocalShowTranslation] = useState(showTranslation)
  const [showSettings, setShowSettings] = useState(false)

  console.log('[QuizPlayer] State:', { localShowFurigana, localShowTranslation, showSettings })

  // Auto-save hook
  const { saveProgress, restoreProgress, clearProgress } = useQuizAutoSave({
    contentType,
    contentId,
    enabled: enableAutoSave,
  })

  // Restore saved progress on mount
  useEffect(() => {
    if (enableAutoSave) {
      const savedProgress = restoreProgress()
      if (savedProgress) {
        setAnswers(savedProgress.answers || {})
        setCurrentQuestion(savedProgress.currentQuestion || 0)
      }
    }
  }, [enableAutoSave, restoreProgress])

  // Auto-save on answer change
  useEffect(() => {
    if (enableAutoSave && !isSubmitted) {
      saveProgress({
        answers,
        currentQuestion,
        totalQuestions: questions.length,
      })
    }
  }, [answers, currentQuestion, enableAutoSave, isSubmitted, questions.length, saveProgress])

  // Handle answer selection
  const handleAnswer = (questionIndex: number, answer: number | string) => {
    if (!isSubmitted) {
      setAnswers(prev => ({
        ...prev,
        [questionIndex]: answer,
      }))
    }
  }

  // Calculate score
  const calculateScore = () => {
    let correct = 0

    questions.forEach((question, index) => {
      const userAnswer = answers[index]
      if (isAnswerCorrect(question, userAnswer)) {
        correct++
      }
    })

    return {
      correct,
      total: questions.length,
      percentage: Math.round((correct / questions.length) * 100),
    }
  }

  // Submit quiz
  const handleSubmit = async () => {
    const scoreResult = calculateScore()
    setScore(scoreResult.percentage)
    setIsSubmitted(true)

    // Clear auto-save on submission
    if (enableAutoSave) {
      clearProgress()
    }

    // Call quiz completion API
    try {
      const response = await fetch('/api/quiz/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType,
          contentId,
          score: scoreResult.percentage,
          totalQuestions: scoreResult.total,
          correctAnswers: scoreResult.correct,
        }),
      })

      const data = await response.json()

      if (data.success) {
        const xpEarned = data.data.xpEarned || 0
        setXpEarned(xpEarned)
        onComplete?.(scoreResult.percentage, xpEarned)

        // 🎉 Update gamification store to trigger CelebrationProvider
        // Following the pattern from gamificationListener.ts (URE features)
        // and DrillProgressManager.ts (non-URE features)
        if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION === 'true') {
          try {
            const store = useGamificationStore.getState()

            // Update store with server response (Firebase is source of truth)
            // This updates totalXP, level, and streak data
            if (data.data.newTotalXP !== undefined) {
              store.updateFromServer({
                totalXP: data.data.newTotalXP,
                currentLevel: data.data.newLevel || Math.max(1, Math.floor(data.data.newTotalXP / 1000)),
                currentStreak: data.data.currentStreak || 0,
                bestStreak: data.data.bestStreak || 0,
              })
            }

            // Set session stats for CelebrationScreen
            // Quiz doesn't track duration, but we provide accuracy and items completed
            store.setLastSessionStats({
              itemsCompleted: scoreResult.total,
              accuracy: scoreResult.percentage,
              duration: 0, // Quizzes don't track time
              xpGained: xpEarned,
            })

            // Increment session count to trigger celebration
            // CelebrationProvider watches sessionCount and totalXP changes
            store.incrementSessionCount()

            console.log('[QuizPlayer] ✅ Gamification store updated for celebration', {
              xpEarned,
              accuracy: scoreResult.percentage,
              itemsCompleted: scoreResult.total,
            })
          } catch (storeError) {
            console.error('[QuizPlayer] Failed to update gamification store:', storeError)
            // Don't fail the whole operation if store update fails
          }
        }
      }
    } catch (error) {
      console.error('[QuizPlayer] Failed to submit quiz:', error)
    }
  }

  // Check if all questions are answered
  const allAnswered = questions.every((_, index) => answers[index] !== undefined)

  // Get localized question text
  const getQuestionText = (question: BaseQuizQuestion): string => {
    if (language === 'ja' && question.questionJa) {
      return question.questionJa
    }
    return question.question
  }

  // Get localized explanation
  const getExplanation = (question: BaseQuizQuestion): string => {
    if (language === 'ja' && question.explanationJa) {
      return question.explanationJa
    }
    return question.explanation || ''
  }

  if (isSubmitted && score !== null) {
    return <QuizResults
      score={score}
      xpEarned={xpEarned}
      questions={questions}
      answers={answers}
      onExit={onExit}
      onRetake={() => {
        setAnswers({})
        setIsSubmitted(false)
        setScore(null)
        setXpEarned(0)
        setCurrentQuestion(0)
      }}
      getQuestionText={getQuestionText}
      getExplanation={getExplanation}
      showFurigana={localShowFurigana}
      showTranslation={localShowTranslation}
      fontSize={fontSize}
      language={language}
    />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-950 via-dark-900 to-dark-850 text-white p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              {onBack && (
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
                >
                  <ArrowLeft size={20} />
                  Back
                </button>
              )}

              <h1 className="text-3xl font-bold mb-2">
                {t('story.quiz.title')}
              </h1>

              {contentTitle && (
                <p className="text-gray-400">{contentTitle}</p>
              )}
            </div>

            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2.5 rounded-xl transition-all ${
                showSettings
                  ? 'bg-primary-500/20 text-primary-400 ring-1 ring-primary-500/50'
                  : 'text-gray-400 hover:text-white hover:bg-dark-700/50'
              }`}
              title="Quiz settings"
            >
              <Settings size={20} />
            </button>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex-1 bg-dark-800 rounded-full h-2">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }}
              />
            </div>
            <span className="text-sm text-gray-400">
              {Object.keys(answers).length}/{questions.length}
            </span>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="mt-4 p-4 bg-dark-800/80 rounded-xl border border-dark-700 space-y-4">
              {/* Furigana Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Languages size={16} />
                  Show Furigana
                </span>
                <button
                  onClick={() => {
                    const newValue = !localShowFurigana
                    console.log('[QuizPlayer] Toggling furigana:', localShowFurigana, '→', newValue)
                    setLocalShowFurigana(newValue)
                  }}
                  className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${
                    localShowFurigana ? 'bg-primary-500' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-200 shadow-md ${
                      localShowFurigana ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Translation Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Languages size={16} />
                  Show Translation
                </span>
                <button
                  onClick={() => {
                    const newValue = !localShowTranslation
                    console.log('[QuizPlayer] Toggling translation:', localShowTranslation, '→', newValue)
                    setLocalShowTranslation(newValue)
                  }}
                  className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${
                    localShowTranslation ? 'bg-primary-500' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-200 shadow-md ${
                      localShowTranslation ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Questions */}
        <div className="space-y-8">
          {questions.map((question, qIndex) => (
            <QuizQuestion
              key={`${question.id}-${qIndex}`}
              question={question}
              questionIndex={qIndex}
              answer={answers[qIndex]}
              onAnswer={(answer) => handleAnswer(qIndex, answer)}
              getQuestionText={getQuestionText}
              showFurigana={localShowFurigana}
              showTranslation={localShowTranslation}
              fontSize={fontSize}
              language={language}
              isSubmitted={false}
            />
          ))}
        </div>

        {/* Submit button */}
        <div className="flex justify-between mt-12 pt-6 border-t border-dark-700">
          {onBack && (
            <button
              onClick={onBack}
              className="px-6 py-3 rounded-xl bg-dark-800 hover:bg-dark-700 transition-colors"
            >
              Cancel
            </button>
          )}

          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className={`px-8 py-3 rounded-xl font-semibold transition-all duration-200 ${
              allAnswered
                ? 'bg-primary-500 hover:bg-primary-600 hover:scale-105'
                : 'bg-dark-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {t('story.quiz.submit')}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Individual question component
 */
interface QuizQuestionProps {
  question: BaseQuizQuestion
  questionIndex: number
  answer: number | string | undefined
  onAnswer: (answer: number | string) => void
  getQuestionText: (q: BaseQuizQuestion) => string
  showFurigana: boolean
  showTranslation: boolean
  fontSize: 'small' | 'medium' | 'large' | 'xlarge'
  language: string
  isSubmitted: boolean
  correctAnswer?: number | string
}

function QuizQuestion({
  question,
  questionIndex,
  answer,
  onAnswer,
  getQuestionText,
  showFurigana,
  showTranslation,
  fontSize,
  language,
  isSubmitted,
  correctAnswer,
}: QuizQuestionProps) {
  const hasJapaneseQuestion = question.questionJa && question.questionJa.includes('<ruby>')
  const englishQuestion = question.question
  const japaneseQuestion = question.questionJa

  console.log('[QuizQuestion]', {
    questionIndex,
    hasJapaneseQuestion,
    showFurigana,
    showTranslation,
    language,
    japanesePreview: japaneseQuestion?.substring(0, 50),
    englishPreview: englishQuestion?.substring(0, 50)
  })

  return (
    <div className="bg-dark-800/50 rounded-2xl p-6 border border-dark-700">
      {/* Question text */}
      <div className="mb-4">
        <span className="text-sm text-gray-400 font-medium">
          Question {questionIndex + 1}
        </span>

        <div className="mt-2 space-y-2">
          {/* Show Japanese with furigana if available */}
          {hasJapaneseQuestion && japaneseQuestion && (
            <RubyText
              text={japaneseQuestion}
              showFurigana={showFurigana}
            />
          )}

          {/* Show English translation (except in Japanese locale where we only show Japanese) */}
          {showTranslation && language !== 'ja' && englishQuestion && (
            <p className="text-base text-gray-400 mt-2">{englishQuestion}</p>
          )}

          {/* Fallback: if no Japanese, just show English */}
          {!hasJapaneseQuestion && englishQuestion && (
            <p className="text-lg font-medium text-white">{englishQuestion}</p>
          )}
        </div>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {question.options.map((option, oIndex) => {
          const isSelected = answer === oIndex
          const isCorrect = isSubmitted && correctAnswer === oIndex
          const isWrong = isSubmitted && isSelected && !isCorrect

          return (
            <label
              key={`option-${questionIndex}-${oIndex}`}
              className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all ${
                isSubmitted
                  ? isCorrect
                    ? 'bg-green-500/20 border-2 border-green-500'
                    : isWrong
                    ? 'bg-red-500/20 border-2 border-red-500'
                    : 'bg-dark-700/50 border-2 border-transparent'
                  : isSelected
                  ? 'bg-primary-500/20 border-2 border-primary-500'
                  : 'bg-dark-700/50 border-2 border-transparent hover:border-dark-600'
              }`}
            >
              <input
                type="radio"
                name={`question-${questionIndex}`}
                checked={isSelected}
                onChange={() => onAnswer(oIndex)}
                disabled={isSubmitted}
                className="w-5 h-5 accent-primary-500"
              />

              <span className="flex-1 text-white">{option}</span>

              {isSubmitted && isCorrect && <CheckCircle size={20} className="text-green-500" />}
              {isSubmitted && isWrong && <XCircle size={20} className="text-red-500" />}
            </label>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Quiz results component
 */
interface QuizResultsProps {
  score: number
  xpEarned: number
  questions: BaseQuizQuestion[]
  answers: Record<number, number | string>
  onExit?: () => void
  onRetake: () => void
  getQuestionText: (q: BaseQuizQuestion) => string
  getExplanation: (q: BaseQuizQuestion) => string
  showFurigana: boolean
  showTranslation: boolean
  fontSize: 'small' | 'medium' | 'large' | 'xlarge'
  language: string
}

function QuizResults({
  score,
  xpEarned,
  questions,
  answers,
  onExit,
  onRetake,
  getQuestionText,
  getExplanation,
  showFurigana,
  showTranslation,
  fontSize,
  language,
}: QuizResultsProps) {
  const { t } = useI18n()
  const isPerfect = score === 100
  const isPassing = score >= 70

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-950 via-dark-900 to-dark-850 text-white p-6">
      <div className="max-w-3xl mx-auto">
        {/* Score Display */}
        <div className="text-center mb-12">
          <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full mb-6 ${
            isPerfect ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
            isPassing ? 'bg-gradient-to-br from-green-400 to-emerald-500' :
            'bg-gradient-to-br from-red-400 to-rose-500'
          }`}>
            <span className="text-5xl font-bold">{score}%</span>
          </div>

          <h2 className="text-3xl font-bold mb-2">
            {isPerfect ? t('story.quiz.perfect') :
             isPassing ? t('story.quiz.passed') :
             t('story.quiz.failed')}
          </h2>

          {xpEarned > 0 && (
            <div className="flex items-center justify-center gap-2 text-xl text-yellow-400">
              <Award size={24} />
              <span>+{xpEarned} XP</span>
            </div>
          )}
        </div>

        {/* Review */}
        <div className="space-y-6 mb-8">
          <h3 className="text-2xl font-bold">Review</h3>

          {questions.map((question, qIndex) => {
            const userAnswer = answers[qIndex]
            const isCorrect = isAnswerCorrect(question, userAnswer)
            const correctAnswerIndex = isMultipleChoiceQuestion(question)
              ? question.correctAnswer
              : -1

            return (
              <QuizQuestion
                key={`review-${question.id}-${qIndex}`}
                question={question}
                questionIndex={qIndex}
                answer={userAnswer}
                onAnswer={() => {}}
                getQuestionText={getQuestionText}
                showFurigana={showFurigana}
                showTranslation={showTranslation}
                fontSize={fontSize}
                language={language}
                isSubmitted={true}
                correctAnswer={correctAnswerIndex}
              />
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-4">
          <button
            onClick={onRetake}
            className="px-8 py-3 rounded-xl bg-dark-800 hover:bg-dark-700 transition-colors"
          >
            Try Again
          </button>

          {onExit && (
            <button
              onClick={onExit}
              className="px-8 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 transition-colors"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
