'use client'

import { useState, useRef, useEffect } from 'react'
import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { motion } from 'framer-motion'
import ConfidenceSlider from '../ConfidenceSlider'
import { useI18n } from '@/i18n/I18nContext'

interface TextInputProps {
  content: ReviewableContent
  onAnswer: (answer: string, confidence?: number) => void
  disabled: boolean
  showAnswer: boolean
}

export default function TextInput({
  content,
  onAnswer,
  disabled,
  showAnswer
}: TextInputProps) {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const [confidence, setConfidence] = useState(0.7)
  const [submitted, setSubmitted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    // Focus input when component mounts or content changes
    if (!disabled && inputRef.current) {
      inputRef.current.focus()
    }
    
    // Reset state when content changes
    setValue('')
    setSubmitted(false)
    setConfidence(0.7)
  }, [content, disabled])
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim() && !disabled) {
      setSubmitted(true)
      onAnswer(value.trim(), confidence)
    }
  }
  
  const isCorrect = () => {
    const userAnswer = value.trim().toLowerCase()
    const correct = content.primaryAnswer.toLowerCase()
    const alternatives = content.alternativeAnswers?.map(a => a.toLowerCase()) || []
    
    return userAnswer === correct || alternatives.includes(userAnswer)
  }
  
  return (
    <div className="mt-8 max-w-lg mx-auto">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Text input */}
          <div>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={disabled}
              placeholder="Type your answer..."
              className={`
                w-full px-4 py-3 text-lg rounded-lg border-2
                transition-colors duration-200
                ${disabled
                  ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
                  : 'bg-soft-white dark:bg-gray-800 focus:border-primary'
                }
                ${showAnswer && submitted
                  ? isCorrect()
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  : 'border-gray-300 dark:border-gray-600'
                }
              `}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
          </div>
          
          {/* Confidence slider */}
          {!showAnswer && (
            <ConfidenceSlider
              value={confidence}
              onChange={setConfidence}
              disabled={disabled}
              className="mt-4"
            />
          )}
          
          {/* Submit button */}
          <button
            type="submit"
            disabled={disabled || !value.trim() || (submitted && showAnswer)}
            data-submit
            className={`
              w-full px-6 py-3 rounded-lg font-semibold
              border border-transparent shadow-sm
              transition-all duration-200
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-900
              ${submitted && showAnswer
                ? 'bg-green-500 text-white cursor-default'
                : disabled || !value.trim()
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-primary-500 text-white hover:bg-primary-600'
              }
            `}
          >
            {submitted && showAnswer ? t('review.correct') : t('review.submitEnter')}
          </button>
        </div>
      </form>
      
      {/* Feedback */}
      {showAnswer && submitted && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 text-center"
        >
          {isCorrect() ? (
            <div className="text-green-600 font-semibold">
              ✓ Correct!
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-red-600 font-semibold">
                ✗ Incorrect
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                Correct answer: <span className="font-semibold">{content.primaryAnswer}</span>
              </div>
              {content.alternativeAnswers && content.alternativeAnswers.length > 0 && (
                <div className="text-sm text-gray-500">
                  Also accepted: {content.alternativeAnswers.join(', ')}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
