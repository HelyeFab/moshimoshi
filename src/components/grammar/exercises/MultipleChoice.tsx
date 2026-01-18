'use client'

import { useState } from 'react'
import { MultipleChoiceExercise } from '@/lib/grammar/types'
import { useI18n } from '@/i18n/I18nContext'

interface MultipleChoiceProps {
  exercise: MultipleChoiceExercise
  onAnswer: (answer: string) => void
  disabled: boolean
}

export function MultipleChoice({
  exercise,
  onAnswer,
  disabled,
}: MultipleChoiceProps) {
  const { t } = useI18n()
  const [selectedOption, setSelectedOption] = useState<string | null>(null)

  const handleSelect = (optionId: string) => {
    if (disabled) return
    setSelectedOption(optionId)
  }

  const handleSubmit = () => {
    if (!selectedOption) return
    onAnswer(selectedOption)
  }

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {exercise.question}
        </h3>
        {exercise.questionRomaji && (
          <p className="text-gray-600 dark:text-gray-400">{exercise.questionRomaji}</p>
        )}
      </div>

      <div className="space-y-3 mb-6">
        {exercise.options.map(option => (
          <button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            disabled={disabled}
            className={`w-full text-left p-4 rounded-lg border-2 transition ${
              selectedOption === option.id
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-center">
              <span className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-current flex items-center justify-center font-bold mr-3 text-gray-700 dark:text-gray-200">
                {option.id.toUpperCase()}
              </span>
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{option.text}</div>
                {option.romaji && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">{option.romaji}</div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {!disabled && (
        <button
          onClick={handleSubmit}
          disabled={!selectedOption}
          className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-dark-700 disabled:cursor-not-allowed transition"
        >
          {t('grammarStall.practiceUi.submitAnswer')}
        </button>
      )}
    </div>
  )
}
