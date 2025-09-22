'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { KanjiWithExamples, KanjiProgress } from '../LearnContent'
import DoshiMascot from '@/components/ui/DoshiMascot'

interface Round3EvaluateProps {
  kanji: KanjiWithExamples
  currentIndex: number
  totalKanji: number
  progress?: KanjiProgress
  onComplete: (rating: number) => void
}

export default function Round3Evaluate({ kanji, currentIndex, totalKanji, progress, onComplete }: Round3EvaluateProps) {
  const [selectedRating, setSelectedRating] = useState<number | null>(null)

  const handleRatingSelect = (rating: number) => {
    setSelectedRating(rating)
    setTimeout(() => {
      onComplete(rating)
      setSelectedRating(null)
    }, 500)
  }

  // Calculate test performance
  const testAccuracy = progress?.round2Accuracy || 0
  const testResults = progress?.round2Results || []
  const correctCount = testResults.filter(r => r.correct).length
  const totalTests = testResults.length

  const getDoshiMood = () => {
    if (testAccuracy >= 80) return 'excited' as const
    if (testAccuracy >= 60) return 'happy' as const
    if (testAccuracy >= 40) return 'thinking' as const
    return 'sad' as const
  }

  const getPerformanceMessage = () => {
    if (testAccuracy >= 90) return 'Outstanding! You\'ve mastered this kanji!'
    if (testAccuracy >= 70) return 'Great job! You\'re getting there!'
    if (testAccuracy >= 50) return 'Good effort! Keep practicing!'
    return 'Don\'t worry, you\'ll get it with more practice!'
  }

  const ratingOptions = [
    { value: 1, label: 'Forgot', emoji: '😓', color: 'bg-red-500' },
    { value: 2, label: 'Hard', emoji: '😰', color: 'bg-orange-500' },
    { value: 3, label: 'Medium', emoji: '🤔', color: 'bg-yellow-500' },
    { value: 4, label: 'Easy', emoji: '😊', color: 'bg-green-500' },
    { value: 5, label: 'Perfect', emoji: '🎉', color: 'bg-blue-500' }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Round 3: Evaluate
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Kanji {currentIndex + 1} of {totalKanji}
        </p>
      </div>

      {/* Kanji Review Card */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          {/* Kanji Display */}
          <div className="text-7xl font-bold text-gray-900 dark:text-gray-100 mb-4"
               style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
            {kanji.kanji}
          </div>

          {/* Meaning */}
          <div className="text-xl font-medium text-primary-600 dark:text-primary-400 mb-2">
            {kanji.meaning}
          </div>

          {/* Readings */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            {kanji.onyomi && kanji.onyomi.length > 0 && (
              <div>
                <span className="font-medium">On:</span> {kanji.onyomi.join('、')}
              </div>
            )}
            {kanji.kunyomi && kanji.kunyomi.length > 0 && (
              <div>
                <span className="font-medium">Kun:</span> {kanji.kunyomi.join('、')}
              </div>
            )}
          </div>
        </div>

        {/* Test Results */}
        <div className="border-t border-gray-200 dark:border-dark-700 pt-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center justify-between">
            <span>Test Results</span>
            <span className={`text-2xl font-bold ${
              testAccuracy >= 70 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
            }`}>
              {Math.round(testAccuracy)}%
            </span>
          </h3>

          {/* Result breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {testResults.map((result, idx) => (
              <div
                key={idx}
                className={`px-3 py-2 rounded-lg text-center ${
                  result.correct
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                }`}
              >
                <div className="text-xs font-medium mb-1 capitalize">{result.type}</div>
                <div className="text-lg">{result.correct ? '✓' : '✗'}</div>
              </div>
            ))}
          </div>

          {/* Performance message with Doshi */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
            <DoshiMascot size="small" mood={getDoshiMood()} />
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {getPerformanceMessage()}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                You got {correctCount} out of {totalTests} tests correct.
              </p>
            </div>
          </div>
        </div>

        {/* Self-evaluation */}
        <div className="border-t border-gray-200 dark:border-dark-700 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            How well do you know this kanji now?
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {ratingOptions.map((option) => (
              <motion.button
                key={option.value}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleRatingSelect(option.value)}
                className={`
                  p-4 rounded-lg border-2 transition-all
                  ${selectedRating === option.value
                    ? `${option.color} text-white border-transparent shadow-lg`
                    : 'bg-white dark:bg-dark-700 border-gray-300 dark:border-dark-600 hover:border-primary-400 dark:hover:border-primary-500'
                  }
                `}
              >
                <div className="text-2xl mb-1">{option.emoji}</div>
                <div className={`text-sm font-medium ${
                  selectedRating === option.value ? 'text-white' : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {option.label}
                </div>
              </motion.button>
            ))}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
            Your rating helps determine when you'll review this kanji again
          </p>
        </div>
      </div>
    </motion.div>
  )
}