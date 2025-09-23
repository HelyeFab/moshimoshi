'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { KanjiWithExamples } from '../LearnContent'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { useKanjiDetails } from '@/hooks/useKanjiDetails'
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal'

interface Round1LearnProps {
  kanji: KanjiWithExamples
  currentIndex: number
  totalKanji: number
  onComplete: () => void
}

export default function Round1Learn({ kanji, currentIndex, totalKanji, onComplete }: Round1LearnProps) {
  const [showReadings, setShowReadings] = useState(false)
  const [showExamples, setShowExamples] = useState(false)
  const [showSentences, setShowSentences] = useState(false)
  const { modalKanji, openKanjiDetails, closeKanjiDetails } = useKanjiDetails()

  const handleContinue = () => {
    // Reset states for next kanji
    setShowReadings(false)
    setShowExamples(false)
    setShowSentences(false)
    onComplete()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Round 1: Learn
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Kanji {currentIndex + 1} of {totalKanji}
        </p>
      </div>

      {/* Main Kanji Card */}
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8"
      >
        <div className="text-center mb-8">
          {/* Large Kanji Display */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="inline-block relative"
          >
            <div className="text-8xl font-bold text-gray-900 dark:text-gray-100 mb-4"
                 style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
              {kanji.kanji}
            </div>
            {/* View Details Button */}
            <button
              onClick={() => openKanjiDetails(kanji)}
              className="absolute -top-2 -right-14 p-2 text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 transition-all hover:scale-110"
              title="View full details"
              aria-label="View kanji details"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </motion.div>

          {/* Meaning */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-medium text-primary-600 dark:text-primary-400 mb-6"
          >
            {kanji.meaning}
          </motion.div>

          {/* Readings Section */}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: showReadings ? 'auto' : 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 mb-6">
              {kanji.onyomi && kanji.onyomi.length > 0 && (
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">On'yomi:</span>
                  <div className="text-xl font-medium text-gray-800 dark:text-gray-200">
                    {kanji.onyomi.join('、')}
                  </div>
                </div>
              )}
              {kanji.kunyomi && kanji.kunyomi.length > 0 && (
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Kun'yomi:</span>
                  <div className="text-xl font-medium text-gray-800 dark:text-gray-200">
                    {kanji.kunyomi.join('、')}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {!showReadings && (
            <button
              onClick={() => setShowReadings(true)}
              className="px-6 py-2 bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/30 transition-colors"
            >
              Show Readings
            </button>
          )}
        </div>

        {/* Examples Section */}
        {showReadings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="border-t border-gray-200 dark:border-dark-700 pt-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <span>📝</span>
              Example Words
            </h3>

            {!showExamples ? (
              <button
                onClick={() => setShowExamples(true)}
                className="px-6 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors"
              >
                Show Examples
              </button>
            ) : (
              <div className="space-y-3">
                {kanji.examples?.map((example, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-gray-50 dark:bg-dark-700 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        {example.word}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {example.reading}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {example.meaning}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Sentences Section */}
        {showExamples && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="border-t border-gray-200 dark:border-dark-700 pt-6 mt-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <span>💬</span>
              Example Sentences
            </h3>

            {!showSentences ? (
              <button
                onClick={() => setShowSentences(true)}
                className="px-6 py-2 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors"
              >
                Show Sentences
              </button>
            ) : (
              <div className="space-y-4">
                {kanji.sentences?.map((sentence, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4"
                  >
                    <div className="text-lg text-gray-900 dark:text-gray-100 mb-2"
                         style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                      {sentence.japanese}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {sentence.english}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Action Buttons */}
      {showSentences && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-between items-center"
        >
          <div className="flex items-center gap-2">
            <DoshiMascot size="small" mood="happy" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Take your time to memorize!
            </span>
          </div>

          <button
            onClick={handleContinue}
            className="px-6 py-3 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors shadow-lg"
          >
            {currentIndex < totalKanji - 1 ? 'Next Kanji →' : 'Start Testing →'}
          </button>
        </motion.div>
      )}

      {/* Kanji Details Modal */}
      <KanjiDetailsModal
        kanji={modalKanji}
        isOpen={!!modalKanji}
        onClose={closeKanjiDetails}
      />
    </motion.div>
  )
}