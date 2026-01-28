'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { KanjiWithExamples, KanjiProgress } from '../LearnContent'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { Frown, Meh, HelpCircle, Smile, Sparkles, Check, X } from 'lucide-react'

interface Round3EvaluateProps {
  kanji: KanjiWithExamples
  currentIndex: number
  totalKanji: number
  progress?: KanjiProgress
  onComplete: (rating: number) => void
  onExit: () => void
}

export default function Round3Evaluate({ kanji, currentIndex, totalKanji, progress, onComplete, onExit }: Round3EvaluateProps) {
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
  const testAccuracyPercent = Math.round(testAccuracy * 100)
  const testResults = progress?.round2Results || []
  const correctCount = testResults.filter(r => r.correct).length
  const totalTests = testResults.length

  const getDoshiMood = () => {
    if (testAccuracy >= 0.8) return 'excited' as const
    if (testAccuracy >= 0.6) return 'happy' as const
    if (testAccuracy >= 0.4) return 'thinking' as const
    return 'sad' as const
  }

  const getPerformanceMessage = () => {
    if (testAccuracy >= 0.9) return 'Outstanding! You\'ve mastered this kanji!'
    if (testAccuracy >= 0.7) return 'Great job! You\'re getting there!'
    if (testAccuracy >= 0.5) return 'Good effort! Keep practicing!'
    return 'Don\'t worry, you\'ll get it with more practice!'
  }

  const ratingOptions = [
    { value: 1, label: 'Forgot', icon: Frown, color: 'bg-red-500' },
    { value: 2, label: 'Hard', icon: Meh, color: 'bg-orange-500' },
    { value: 3, label: 'Medium', icon: HelpCircle, color: 'bg-yellow-500' },
    { value: 4, label: 'Easy', icon: Smile, color: 'bg-green-500' },
    { value: 5, label: 'Perfect', icon: Sparkles, color: 'bg-blue-500' }
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
               style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif' }}>
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
              testAccuracy >= 0.7 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
            }`}>
              {testAccuracyPercent}%
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
                <div className="flex items-center justify-center">
                  {result.correct ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                </div>
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
                <div className="flex items-center justify-center mb-1">
                  <option.icon className="w-6 h-6" />
                </div>
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

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={onExit}
          className="p-2 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-dark-600 transition-all hover:scale-110"
          aria-label="Exit session"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </motion.div>
  )
}
