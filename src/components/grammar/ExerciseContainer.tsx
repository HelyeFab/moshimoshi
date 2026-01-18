'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/i18n/I18nContext'
import { Exercise, ExerciseResult } from '@/lib/grammar/types'
import { validateAnswer } from '@/lib/grammar/exerciseValidator'
import {
  advanceSession,
  calculateStats,
  completeSession,
  createSession,
  recordAnswer,
} from '@/lib/grammar/exerciseEngine'
import { MultipleChoice } from './exercises/MultipleChoice'
import { FillInBlank } from './exercises/FillInBlank'
import { SentenceMatching } from './exercises/SentenceMatching'
import { ExerciseFeedback } from './ExerciseFeedback'
import { ExerciseProgress } from './ExerciseProgress'

interface ExerciseContainerProps {
  exercises: Exercise[]
  grammarPointId: string
  locale: string
}

export function ExerciseContainer({
  exercises,
  grammarPointId,
  locale,
}: ExerciseContainerProps) {
  const { t } = useI18n()
  const [session, setSession] = useState(() => createSession(exercises))
  const [feedback, setFeedback] = useState<ExerciseResult | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [showFeedbackBanner, setShowFeedbackBanner] = useState(false)

  const currentExercise = exercises[session.currentIndex]
  const isLastExercise = session.currentIndex === exercises.length - 1

  const handleAnswer = (userAnswer: string | string[]) => {
    if (!currentExercise || feedback) return
    const result = validateAnswer(currentExercise, userAnswer)
    setFeedback(result)
    setSession(prev => recordAnswer(prev, userAnswer, result.isCorrect))
  }

  const handleNext = () => {
    if (isLastExercise) {
      setSession(prev => completeSession(prev))
      setIsComplete(true)
      return
    }

    setSession(prev => advanceSession(prev))
    setFeedback(null)
    setShowFeedbackBanner(false)
  }

  useEffect(() => {
    if (!feedback) return
    setShowFeedbackBanner(true)
    const timer = setTimeout(() => {
      setShowFeedbackBanner(false)
    }, 3500)

    return () => clearTimeout(timer)
  }, [feedback])

  if (isComplete) {
    const stats = calculateStats(session)
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-700 p-8 text-center">
          <div className="text-6xl mb-4">
            {stats.accuracy >= 80 ? '🎉' : stats.accuracy >= 60 ? '👍' : '📚'}
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t('grammarStall.practiceUi.completeTitle')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            {t('grammarStall.practiceUi.completeBody')}
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {stats.correctAnswers}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {t('grammarStall.practiceUi.correct')}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                {stats.incorrectAnswers}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {t('grammarStall.practiceUi.incorrect')}
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-1">
              {stats.accuracy}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {t('grammarStall.practiceUi.accuracy')}
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                setSession(createSession(exercises))
                setFeedback(null)
                setIsComplete(false)
              }}
              className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition"
            >
              {t('grammarStall.practiceUi.practiceAgain')}
            </button>
            <Link
              href={`/${locale}/learn/grammar/${grammarPointId}`}
              className="block w-full px-6 py-3 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-dark-600 transition"
            >
              {t('grammarStall.practiceUi.backToPoint')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!currentExercise) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="text-4xl mb-3">😕</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {t('grammarStall.practiceUi.noExercisesTitle')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {t('grammarStall.practiceUi.noExercisesBody')}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <ExerciseProgress
        current={session.currentIndex + 1}
        total={exercises.length}
      />

      {feedback && showFeedbackBanner && (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm font-medium ${
            feedback.isCorrect
              ? 'bg-green-50 dark:bg-green-900/20 border-green-400 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 border-red-400 text-red-800 dark:text-red-200'
          }`}
        >
          {feedback.isCorrect
            ? t('grammarStall.practiceUi.correctShort')
            : t('grammarStall.practiceUi.incorrectShort')}{' '}
          <span className="font-normal">{feedback.message}</span>
        </div>
      )}

      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-700 p-6 mt-6">
        {currentExercise.type === 'multiple-choice' && (
          <MultipleChoice
            key={currentExercise.id}
            exercise={currentExercise}
            onAnswer={handleAnswer}
            disabled={feedback !== null}
          />
        )}
        {currentExercise.type === 'fill-in-blank' && (
          <FillInBlank
            key={currentExercise.id}
            exercise={currentExercise}
            onAnswer={handleAnswer}
            disabled={feedback !== null}
          />
        )}
        {currentExercise.type === 'sentence-matching' && (
          <SentenceMatching
            key={currentExercise.id}
            exercise={currentExercise}
            onAnswer={handleAnswer}
            disabled={feedback !== null}
          />
        )}
      </div>

      {feedback && (
        <ExerciseFeedback
          result={feedback}
          onNext={handleNext}
          isLastExercise={isLastExercise}
        />
      )}
    </div>
  )
}
