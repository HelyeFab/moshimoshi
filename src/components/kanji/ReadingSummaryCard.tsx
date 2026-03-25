'use client'

import { motion } from 'framer-motion'
import type { ReadingSummaryCard as ReadingSummaryCardType } from '@/types/kanji-study'
import AudioButton from '@/components/ui/AudioButton'
import { useI18n } from '@/i18n/I18nContext'
import { usePrioritizedKanjiReadings } from '@/hooks/usePrioritizedKanjiReadings'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'

interface ReadingSummaryCardProps {
  card: ReadingSummaryCardType
  onAudioPlay: (text: string) => Promise<void>
}

/**
 * Reading summary card for vocabulary-first kanji study
 * Shows readings paired pedagogically with the vocabulary words that teach them
 */
export default function ReadingSummaryCard({ card, onAudioPlay }: ReadingSummaryCardProps) {
  const { strings } = useI18n()
  const t = strings.vocabularyFirstStudy?.readingSummaryCard

  // Use curated readings (same as review mode)
  const {
    onyomi: curatedOnyomi,
    kunyomi: curatedKunyomi,
    hasAdditionalOnyomi,
    hasAdditionalKunyomi,
  } = usePrioritizedKanjiReadings(card.kanjiCharacter, card.onyomi, card.kunyomi)

  // Group examples by reading for pedagogical pairing
  const readingExamplesMap = new Map<string, typeof card.readingsWithExamples[0][]>()
  card.readingsWithExamples.forEach(example => {
    const existing = readingExamplesMap.get(example.reading) || []
    readingExamplesMap.set(example.reading, [...existing, example])
  })

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
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 mb-3">
          <div className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400"></div>
          <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
            {t?.readingSummary || 'Reading Summary'}
          </span>
        </div>
        <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {t?.allWaysToRead || 'All ways to read this kanji'}
        </div>
      </div>

      {/* Pedagogical Pairing: Readings with their teaching words */}
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* On'yomi Readings with Examples */}
        {curatedOnyomi.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-1 w-8 bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"></div>
              <h3 className="text-sm font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                {t?.onyomiLabel || "On'yomi"}
              </h3>
              <div className="h-px flex-1 bg-blue-200 dark:bg-blue-800"></div>
            </div>

            <div className="grid gap-4">
              {curatedOnyomi.map((reading, idx) => {
                const examples = readingExamplesMap.get(reading) || []
                const isPrimary = reading === card.primaryReading

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`p-4 rounded-2xl border-2 transition-all ${
                      isPrimary
                        ? 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-400 dark:border-blue-600 shadow-lg'
                        : 'bg-white/60 dark:bg-dark-800/60 border-blue-200 dark:border-blue-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Reading Display */}
                      <div className="flex-shrink-0">
                        <div className={`px-4 py-2 rounded-xl ${
                          isPrimary
                            ? 'bg-blue-500 text-white shadow-md'
                            : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                        }`}>
                          <div className="text-2xl font-bold leading-none"
                               style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                            {reading}
                          </div>
                        </div>
                        {isPrimary && (
                          <div className="text-center mt-1">
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">★</span>
                          </div>
                        )}
                      </div>

                      {/* Teaching Words */}
                      <div className="flex-1 space-y-2">
                        {examples.length > 0 ? (
                          examples.map((example, exIdx) => (
                            <div
                              key={exIdx}
                              className="flex items-center gap-3 p-2 rounded-lg bg-white/80 dark:bg-dark-700/80 hover:bg-white dark:hover:bg-dark-700 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100"
                                        style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                                    {example.exampleWord}
                                  </span>
                                  <span className="text-sm text-gray-500 dark:text-gray-400"
                                        style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                                    {example.exampleReading}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                  {example.exampleMeaning}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {hasAdditionalOnyomi && (
              <div className="text-xs text-gray-500 dark:text-gray-400 italic text-center">
                {t?.moreReadingsAvailable || 'More readings available in details'}
              </div>
            )}
          </div>
        )}

        {/* Kun'yomi Readings with Examples */}
        {curatedKunyomi.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-1 w-8 bg-gradient-to-r from-purple-500 to-purple-400 rounded-full"></div>
              <h3 className="text-sm font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                {t?.kunyomiLabel || "Kun'yomi"}
              </h3>
              <div className="h-px flex-1 bg-purple-200 dark:bg-purple-800"></div>
            </div>

            <div className="grid gap-4">
              {curatedKunyomi.map((reading, idx) => {
                const examples = readingExamplesMap.get(reading) || []
                const isPrimary = reading === card.primaryReading

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (curatedOnyomi.length + idx) * 0.1 }}
                    className={`p-4 rounded-2xl border-2 transition-all ${
                      isPrimary
                        ? 'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-400 dark:border-purple-600 shadow-lg'
                        : 'bg-white/60 dark:bg-dark-800/60 border-purple-200 dark:border-purple-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Reading Display */}
                      <div className="flex-shrink-0">
                        <div className={`px-4 py-2 rounded-xl ${
                          isPrimary
                            ? 'bg-purple-500 text-white shadow-md'
                            : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                        }`}>
                          <div className="text-2xl font-bold leading-none"
                               style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                            {reading}
                          </div>
                        </div>
                        {isPrimary && (
                          <div className="text-center mt-1">
                            <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold">★ Primary</span>
                          </div>
                        )}
                      </div>

                      {/* Teaching Words */}
                      <div className="flex-1 space-y-2">
                        {examples.length > 0 ? (
                          examples.map((example, exIdx) => (
                            <div
                              key={exIdx}
                              className="flex items-center gap-3 p-2 rounded-lg bg-white/80 dark:bg-dark-700/80 hover:bg-white dark:hover:bg-dark-700 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100"
                                        style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                                    {example.exampleWord}
                                  </span>
                                  <span className="text-sm text-gray-500 dark:text-gray-400"
                                        style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                                    {example.exampleReading}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                  {example.exampleMeaning}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {hasAdditionalKunyomi && (
              <div className="text-xs text-gray-500 dark:text-gray-400 italic text-center">
                {t?.moreReadingsAvailable || 'More readings available in details'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Navigation Spacer */}
      <MobileNavSpacer />
    </motion.div>
  )
}
