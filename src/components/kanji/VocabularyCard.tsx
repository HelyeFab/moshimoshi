'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { toHiragana } from 'wanakana'
import type { VocabularyCard as VocabularyCardType } from '@/types/kanji-study'
import AudioButton from '@/components/ui/AudioButton'
import { useI18n } from '@/i18n/I18nContext'
import { generateTargetKanjiRuby } from '@/utils/furigana'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'

interface VocabularyCardProps {
  card: VocabularyCardType
  onAudioPlay: (text: string) => Promise<void>
}

/**
 * Vocabulary card for vocabulary-first kanji study
 * Teaches one reading through a real Japanese word
 */
export default function VocabularyCard({ card, onAudioPlay }: VocabularyCardProps) {
  const { strings } = useI18n()
  const t = strings.vocabularyFirstStudy?.vocabularyCard
  const [furiganaHtml, setFuriganaHtml] = useState<string>(
    generateTargetKanjiRuby(card.word, card.kanjiCharacter, card.targetReading)
  )

  // Vocabulary-first cards should show the intended reading for the target kanji,
  // not a guessed whole-word reading that may reflect a different sense.
  useEffect(() => {
    setFuriganaHtml(
      generateTargetKanjiRuby(card.word, card.kanjiCharacter, card.targetReading)
    )
  }, [card.word, card.kanjiCharacter, card.targetReading])

  const normalizeReading = (reading: string) => toHiragana(reading.replace(/[\.\-]/g, '').trim())
  const showWordReading =
    !(card.word === card.kanjiCharacter &&
      normalizeReading(card.wordReading) === normalizeReading(card.targetReading))

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full flex flex-col items-center justify-center py-8 px-4 sm:px-8 relative"
    >

      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
          <div className="w-2 h-2 rounded-full bg-green-500 dark:bg-green-400 animate-pulse"></div>
          <span className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wider">
            {t?.learnThisWord || 'Learn this word'}
          </span>
        </div>
      </div>

      {/* Japanese Word with Audio and Furigana - Hero Display */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-emerald-400/10 to-green-500/10 blur-2xl"></div>
        <div className="relative flex items-center justify-center gap-4">
          <div
            className="kanji-study-display-ruby text-center text-7xl sm:text-8xl font-bold text-gray-900 dark:text-gray-100 leading-none"
            style={{ fontFamily: '"Noto Sans JP", "Hiragano Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif' }}
            dangerouslySetInnerHTML={{ __html: furiganaHtml }}
          />
          <AudioButton
            size="md"
            onPlay={() => onAudioPlay(card.word)}
          />
        </div>
      </div>

      {/* Reading (Furigana/Kana) */}
      <div className="mb-8 text-center">
        {showWordReading && (
          <div className="text-xl sm:text-2xl text-gray-600 dark:text-gray-400 mb-3"
               style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
            {card.wordReading}
          </div>
        )}

        {/* Target Reading Highlight */}
        <div className="flex items-center justify-center gap-3 mt-3">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-green-400 dark:to-green-500"></div>
          <div className="px-5 py-2 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40
                        border-2 border-green-300 dark:border-green-600 shadow-lg">
            <span className="text-base font-bold text-green-700 dark:text-green-300">
              {card.targetReading}
            </span>
          </div>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-green-400 dark:to-green-500"></div>
        </div>
      </div>

      {/* Meaning */}
      <div className="text-center mb-6">
        <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 font-semibold">
          {t?.meaning || 'Meaning'}
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
          {card.wordMeaning}
        </div>
      </div>

      {/* Pattern Hint (if provided) */}
      {card.patternHint && (
        <div className="mt-4 max-w-sm">
          <div className="px-4 py-3 rounded-xl bg-white/60 dark:bg-dark-800/60
                        border border-green-200 dark:border-green-700/50">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5"
                   fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-xs text-gray-700 dark:text-gray-300">
                {card.patternHint}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card Type Indicator with Badges */}
      <div className="mt-8 w-full max-w-md flex items-center justify-between">
        {/* Reading Type Badge - Left */}
        <span className={`px-3 py-1.5 text-xs font-bold rounded-full
                        ${card.readingType === 'onyomi'
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-600'
                          : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600'
                        }`}>
          {card.readingType === 'onyomi' ? (t?.onyomi || "On'yomi") : (t?.kunyomi || "Kun'yomi")}
        </span>

        {/* Vocabulary Label - Center */}
        <div className="text-xs text-gray-400 dark:text-gray-600">
          {t?.vocabulary || 'Vocabulary'}
        </div>

        {/* Common Word Indicator - Right */}
        {card.isCommonWord ? (
          <span className="px-2.5 py-1 text-xs font-bold rounded-lg
                         bg-amber-100 dark:bg-amber-900/30
                         text-amber-700 dark:text-amber-300
                         border border-amber-300 dark:border-amber-600">
            {t?.common || 'Common'}
          </span>
        ) : (
          <div className="w-[73px]"></div>
        )}
      </div>

      {/* Mobile Navigation Spacer */}
      <MobileNavSpacer />
    </motion.div>
  )
}
