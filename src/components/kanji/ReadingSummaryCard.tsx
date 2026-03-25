'use client'

import { motion } from 'framer-motion'
import type { ReadingSummaryCard as ReadingSummaryCardType } from '@/types/kanji-study'
import AudioButton from '@/components/ui/AudioButton'
import { useI18n } from '@/i18n/I18nContext'
import { usePrioritizedKanjiReadings } from '@/hooks/usePrioritizedKanjiReadings'

interface ReadingSummaryCardProps {
  card: ReadingSummaryCardType
  onAudioPlay: (text: string) => Promise<void>
}

/**
 * Reading summary card for vocabulary-first kanji study
 * Shows all readings after vocabulary exposure
 */
export default function ReadingSummaryCard({ card, onAudioPlay }: ReadingSummaryCardProps) {
  const { strings } = useI18n()
  const t = strings.vocabularyFirstStudy?.readingSummaryCard
  const hasExamples = card.readingsWithExamples.length > 0

  // Use curated readings (same as review mode)
  const {
    onyomi: curatedOnyomi,
    kunyomi: curatedKunyomi,
    hasAdditionalOnyomi,
    hasAdditionalKunyomi,
  } = usePrioritizedKanjiReadings(card.kanjiCharacter, card.onyomi, card.kunyomi)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="w-full h-full bg-gradient-to-br from-indigo-50 to-purple-50
                 dark:bg-gradient-to-br dark:from-dark-800 dark:to-dark-700
                 rounded-2xl shadow-2xl
                 border-2 border-indigo-200 dark:border-indigo-700
                 p-4 sm:p-6 overflow-y-auto scrollbar-hide relative"
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}
    >
      {/* Kanji Badge - Top Center */}
      <div className="flex justify-center mb-4">
        <div className="relative inline-flex items-center gap-2 px-4 py-2
                      bg-white/80 dark:bg-gray-900/50 backdrop-blur-sm
                      rounded-2xl shadow-lg border-2 border-indigo-300 dark:border-indigo-500/50">
          <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400"
               style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
            {card.kanjiCharacter}
          </div>
          <AudioButton
            size="sm"
            onPlay={() => onAudioPlay(card.kanjiCharacter)}
          />
        </div>
      </div>

      {/* Header */}
      <div className="text-center mb-4">
        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">
          {t?.readingSummary || 'Reading Summary'}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {t?.allWaysToRead || 'All ways to read this kanji'}
        </div>
      </div>

      {/* Readings Section */}
      <div className="space-y-4">
        {/* On'yomi Readings */}
        {curatedOnyomi.length > 0 && (
          <div className="bg-white/60 dark:bg-dark-800/60 rounded-xl p-3 border border-blue-200 dark:border-blue-700/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
              <div className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                {t?.onyomiLabel || "On'yomi"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {curatedOnyomi.map((reading, idx) => (
                <span
                  key={idx}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium
                            ${reading === card.primaryReading
                              ? 'bg-blue-500 text-white dark:bg-blue-600'
                              : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                            } border ${reading === card.primaryReading
                              ? 'border-blue-600 dark:border-blue-500'
                              : 'border-blue-200 dark:border-blue-700'
                            }`}
                  style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
                >
                  {reading}
                  {reading === card.primaryReading && (
                    <span className="ml-1 text-xs">★</span>
                  )}
                </span>
              ))}
            </div>
            {hasAdditionalOnyomi && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
                {t?.moreReadingsAvailable || 'More readings available in details'}
              </div>
            )}
          </div>
        )}

        {/* Kun'yomi Readings */}
        {curatedKunyomi.length > 0 && (
          <div className="bg-white/60 dark:bg-dark-800/60 rounded-xl p-3 border border-purple-200 dark:border-purple-700/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
              <div className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                {t?.kunyomiLabel || "Kun'yomi"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {curatedKunyomi.map((reading, idx) => (
                <span
                  key={idx}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium
                            ${reading === card.primaryReading
                              ? 'bg-purple-500 text-white dark:bg-purple-600'
                              : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                            } border ${reading === card.primaryReading
                              ? 'border-purple-600 dark:border-purple-500'
                              : 'border-purple-200 dark:border-purple-700'
                            }`}
                  style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
                >
                  {reading}
                  {reading === card.primaryReading && (
                    <span className="ml-1 text-xs">★</span>
                  )}
                </span>
              ))}
            </div>
            {hasAdditionalKunyomi && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
                {t?.moreReadingsAvailable || 'More readings available in details'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Examples from Vocabulary Cards */}
      {hasExamples && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-indigo-300 dark:bg-indigo-700"></div>
            <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
              {t?.wordsYouLearned || 'Words you learned'}
            </div>
            <div className="h-px flex-1 bg-indigo-300 dark:bg-indigo-700"></div>
          </div>

          <div className="space-y-2">
            {card.readingsWithExamples.map((example, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 p-2 rounded-lg
                         bg-white/60 dark:bg-dark-800/60
                         border border-gray-200 dark:border-dark-600"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-base font-bold text-gray-800 dark:text-gray-200"
                          style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                      {example.exampleWord}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400"
                          style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                      ({example.exampleReading})
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {example.exampleMeaning}
                  </div>
                </div>
                <div className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold
                               ${example.readingType === 'onyomi'
                                 ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                 : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                               }`}>
                  {example.reading}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card Type Indicator */}
      <div className="text-center mt-4 text-xs text-gray-400 dark:text-gray-600">
        {t?.summary || 'Summary'}
      </div>
    </motion.div>
  )
}
