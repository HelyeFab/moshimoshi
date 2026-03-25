'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ReadingRecallCard as ReadingRecallCardType } from '@/types/kanji-study'
import { useI18n } from '@/i18n/I18nContext'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'

interface ReadingRecallCardProps {
  card: ReadingRecallCardType
}

/**
 * Reading recall card - interactive recall test
 * Tests memory of vocabulary words for each reading
 */
export default function ReadingRecallCard({ card }: ReadingRecallCardProps) {
  const { strings } = useI18n()
  const t = (strings.vocabularyFirstStudy as any)?.readingRecallCard
  const [revealedItems, setRevealedItems] = useState<Set<number>>(new Set())

  const handleReveal = (index: number) => {
    setRevealedItems(prev => new Set([...prev, index]))
  }

  const allRevealed = revealedItems.size === card.items.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full py-8 px-4 sm:px-8"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-3">
          <div className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse"></div>
          <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
            {t?.title || 'Recall Test'}
          </span>
        </div>
        <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {t?.subtitle || 'Can you recall the words you just learned?'}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t?.instructions || 'Tap each reading to reveal its vocabulary word'}
        </p>
      </div>

      {/* Recall Items */}
      <div className="space-y-4 max-w-3xl mx-auto">
        {card.items.map((item, index) => {
          const isRevealed = revealedItems.has(index)
          const isOnyomi = item.readingType === 'onyomi'

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`rounded-2xl border-2 overflow-hidden transition-all ${
                isRevealed
                  ? isOnyomi
                    ? 'border-blue-400 dark:border-blue-600 shadow-lg'
                    : 'border-purple-400 dark:border-purple-600 shadow-lg'
                  : 'border-gray-300 dark:border-dark-600 hover:border-amber-400 dark:hover:border-amber-600'
              }`}
            >
              {!isRevealed ? (
                /* Hidden State - Click to Reveal */
                <button
                  type="button"
                  onClick={() => handleReveal(index)}
                  className={`w-full p-6 text-left transition-all hover:scale-[1.02] ${
                    isOnyomi
                      ? 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/10 dark:to-cyan-900/10 hover:from-blue-100 hover:to-cyan-100 dark:hover:from-blue-900/20 dark:hover:to-cyan-900/20'
                      : 'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-900/20 dark:hover:to-pink-900/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs font-bold uppercase tracking-wider mb-2 opacity-60">
                        {isOnyomi ? (strings.vocabularyFirstStudy?.vocabularyCard?.onyomi || "On'yomi") : (strings.vocabularyFirstStudy?.vocabularyCard?.kunyomi || "Kun'yomi")}
                      </div>
                      <div className="text-4xl font-bold mb-3"
                           style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                        {item.reading}
                      </div>
                      <div className="text-xs sm:text-sm font-medium opacity-70">
                        {t?.recallPrompt || 'Do you recall a word for this reading?'}
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      <div className={`p-3 rounded-full ${
                        isOnyomi
                          ? 'bg-blue-200 dark:bg-blue-800'
                          : 'bg-purple-200 dark:bg-purple-800'
                      }`}>
                        <svg className={`w-6 h-6 ${
                          isOnyomi
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-purple-700 dark:text-purple-300'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </button>
              ) : (
                /* Revealed State - Show Word */
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`p-6 ${
                    isOnyomi
                      ? 'bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30'
                      : 'bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Reading Badge */}
                    <div className="flex-shrink-0">
                      <div className={`px-4 py-2 rounded-xl shadow-md ${
                        isOnyomi
                          ? 'bg-blue-500 text-white'
                          : 'bg-purple-500 text-white'
                      }`}>
                        <div className="text-sm font-bold uppercase tracking-wider mb-1 opacity-90">
                          {isOnyomi ? (strings.vocabularyFirstStudy?.vocabularyCard?.onyomi || "On'yomi") : (strings.vocabularyFirstStudy?.vocabularyCard?.kunyomi || "Kun'yomi")}
                        </div>
                        <div className="text-2xl font-bold leading-none"
                             style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                          {item.reading}
                        </div>
                      </div>
                    </div>

                    {/* Word Details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">
                          {t?.revealed || 'Revealed'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-baseline gap-3">
                          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100"
                               style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                            {item.word}
                          </div>
                          <div className="text-lg text-gray-600 dark:text-gray-400"
                               style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                            {item.wordReading}
                          </div>
                        </div>
                        <div className="text-lg font-medium text-gray-800 dark:text-gray-200">
                          {item.wordMeaning}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Progress Indicator */}
      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-dark-700">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {revealedItems.size} / {card.items.length} {t?.revealed || 'revealed'}
          </span>
          {allRevealed && (
            <motion.svg
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-5 h-5 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </motion.svg>
          )}
        </div>
      </div>

      {/* Mobile Navigation Spacer */}
      <MobileNavSpacer />
    </motion.div>
  )
}
