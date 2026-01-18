'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { FillInBlankExercise } from '@/lib/grammar/types'
import { useI18n } from '@/i18n/I18nContext'

interface FillInBlankProps {
  exercise: FillInBlankExercise
  onAnswer: (answer: string) => void
  disabled: boolean
}

export function FillInBlank({
  exercise,
  onAnswer,
  disabled,
}: FillInBlankProps) {
  const { t } = useI18n()
  const [userAnswer, setUserAnswer] = useState('')
  const [showHints, setShowHints] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userAnswer.trim()) return
    onAnswer(userAnswer)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {exercise.question}
        </h3>
        {exercise.questionRomaji && (
          <p className="text-gray-600 dark:text-gray-400">{exercise.questionRomaji}</p>
        )}
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={userAnswer}
          onChange={event => setUserAnswer(event.target.value)}
          disabled={disabled}
          placeholder={t('grammarStall.practiceUi.answerPlaceholder')}
          className="w-full px-4 py-3 border-2 border-gray-300 dark:border-dark-600 rounded-lg focus:border-primary-500 focus:outline-none disabled:bg-gray-100 dark:disabled:bg-dark-700 disabled:cursor-not-allowed text-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
          autoFocus
        />
      </div>

      {exercise.hints && exercise.hints.length > 0 && !disabled && (
        <div className="mb-6">
          {!showHints ? (
            <button
              type="button"
              onClick={() => setShowHints(true)}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              💡 {t('grammarStall.practiceUi.showHints')}
            </button>
          ) : (
            <div className="bg-gray-100 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-lg p-3">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                {t('grammarStall.practiceUi.hintsLabel')}
              </div>
              <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
                {exercise.hints.map((hint, index) => (
                  <li key={index}>• {hint}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!disabled && (
        <button
          type="submit"
          disabled={!userAnswer.trim()}
          className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-dark-700 disabled:cursor-not-allowed transition"
        >
          {t('grammarStall.practiceUi.submitAnswer')}
        </button>
      )}
    </form>
  )
}
