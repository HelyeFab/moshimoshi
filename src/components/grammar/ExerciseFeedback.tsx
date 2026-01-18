'use client'

import { ExerciseResult } from '@/lib/grammar/types'
import { useI18n } from '@/i18n/I18nContext'

interface ExerciseFeedbackProps {
  result: ExerciseResult
  onNext: () => void
  isLastExercise: boolean
}

export function ExerciseFeedback({
  result,
  onNext,
  isLastExercise,
}: ExerciseFeedbackProps) {
  const { t } = useI18n()

  return (
    <div className="mt-6">
      <div
        className={`rounded-lg p-6 ${
          result.isCorrect
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-400/40 dark:border-green-400/30'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-400/40 dark:border-red-400/30'
        }`}
      >
        {!result.isCorrect && result.correctAnswer && (
          <div className="bg-white dark:bg-dark-800 rounded-lg p-4 mb-4">
            <div className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">
              {t('grammarStall.practiceUi.correctAnswerLabel')}
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {result.correctAnswer}
            </div>
          </div>
        )}

        {result.explanation && (
          <div className="bg-white dark:bg-dark-800 rounded-lg p-4 mb-4">
            <div className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">
              {t('grammarStall.practiceUi.explanationLabel')}
            </div>
            <p className="text-gray-700 dark:text-gray-300">{result.explanation}</p>
          </div>
        )}

        <div className="rounded-lg border border-transparent">
          <button
            onClick={onNext}
            className="w-full px-6 py-3 bg-gray-900 dark:bg-gray-200 text-white dark:text-gray-900 rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-300 transition border-0 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
          >
            {isLastExercise
              ? t('grammarStall.practiceUi.seeResults')
              : t('grammarStall.practiceUi.nextQuestion')}
          </button>
        </div>
      </div>
    </div>
  )
}
