'use client'

import { useMemo, useState } from 'react'
import { SentenceMatchingExercise } from '@/lib/grammar/types'
import { useI18n } from '@/i18n/I18nContext'

interface SentenceMatchingProps {
  exercise: SentenceMatchingExercise
  onAnswer: (answer: string[]) => void
  disabled: boolean
}

function shuffle<T>(items: T[]) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = result[i]
    result[i] = result[j]
    result[j] = temp
  }
  return result
}

export function SentenceMatching({
  exercise,
  onAnswer,
  disabled,
}: SentenceMatchingProps) {
  const { t } = useI18n()
  const englishOptions = useMemo(
    () => shuffle(exercise.pairs.map(pair => pair.english)),
    [exercise.pairs]
  )
  const [selections, setSelections] = useState<(number | null)[]>(
    () => new Array(exercise.pairs.length).fill(null)
  )

  const handleSelect = (pairIndex: number, englishIndex: number) => {
    if (disabled) return
    setSelections(prev => {
      const next = [...prev]
      next[pairIndex] = englishIndex
      return next
    })
  }

  const handleSubmit = () => {
    if (disabled) return
    if (selections.some(selection => selection === null)) return
    const answerPairs = exercise.pairs.map((pair, index) => {
      const selectedIndex = selections[index] as number
      const english = englishOptions[selectedIndex]
      return `${pair.japanese}=>${english}`
    })
    onAnswer(answerPairs)
  }

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {exercise.question}
        </h3>
      </div>

      <div className="space-y-4 mb-6">
        {exercise.pairs.map((pair, pairIndex) => (
          <div
            key={pairIndex}
            className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4 border border-gray-200 dark:border-dark-600"
          >
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  {t('grammarStall.practiceUi.japaneseLabel')}
                </div>
                <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {pair.japanese}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{pair.romaji}</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  {t('grammarStall.practiceUi.chooseEnglishMatch')}
                </div>
                <div className="space-y-2">
                  {englishOptions.map((english, englishIndex) => {
                    const isSelected = selections[pairIndex] === englishIndex
                    return (
                      <button
                        key={`${pairIndex}-${englishIndex}`}
                        onClick={() => handleSelect(pairIndex, englishIndex)}
                        disabled={disabled}
                        className={`w-full text-left px-3 py-2 rounded-lg border transition ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
                        } ${
                          disabled
                            ? 'opacity-50 cursor-not-allowed'
                            : 'cursor-pointer'
                        }`}
                      >
                        {english}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!disabled && (
        <button
          onClick={handleSubmit}
          disabled={selections.some(selection => selection === null)}
          className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-dark-700 disabled:cursor-not-allowed transition"
        >
          {t('grammarStall.practiceUi.submitMatches')}
        </button>
      )}
    </div>
  )
}
