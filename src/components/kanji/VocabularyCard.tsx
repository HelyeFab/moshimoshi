'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { toHiragana } from 'wanakana'
import type { VocabularyCard as VocabularyCardType } from '@/types/kanji-study'
import AudioButton from '@/components/ui/AudioButton'
import { useI18n } from '@/i18n/I18nContext'
import { generateTargetKanjiRuby } from '@/utils/furigana'

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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="w-full h-full bg-gradient-to-br from-green-50 to-emerald-50
                 dark:bg-gradient-to-br dark:from-dark-800 dark:to-dark-700
                 rounded-2xl shadow-2xl
                 border-2 border-green-200 dark:border-green-700
                 flex flex-col items-center justify-center p-6 sm:p-8 relative"
    >
      {/* Reading Type Badge - Top Left */}
      <div className="absolute top-4 left-4">
        <span className={`px-3 py-1.5 text-xs font-bold rounded-full
                        ${card.readingType === 'onyomi'
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-600'
                          : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600'
                        }`}>
          {card.readingType === 'onyomi' ? (t?.onyomi || "On'yomi") : (t?.kunyomi || "Kun'yomi")}
        </span>
      </div>

      {/* Common Word Indicator - Top Right */}
      {card.isCommonWord && (
        <div className="absolute top-4 right-4">
          <span className="px-2.5 py-1 text-xs font-bold rounded-lg
                         bg-amber-100 dark:bg-amber-900/30
                         text-amber-700 dark:text-amber-300
                         border border-amber-300 dark:border-amber-600">
            {t?.common || 'Common'}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-4">
        <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">
          {t?.learnThisWord || 'Learn this word'}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {(t?.usingKanji || 'Using the kanji {kanji}').replace('{kanji}', '')}
          <span className="font-bold text-lg text-gray-800 dark:text-gray-200"
                style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
            {card.kanjiCharacter}
          </span>
        </div>
      </div>

      {/* Japanese Word with Audio and Furigana */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="kanji-study-display-ruby text-center text-5xl sm:text-6xl font-bold text-gray-800 dark:text-gray-200 leading-none"
          style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif' }}
          dangerouslySetInnerHTML={{ __html: furiganaHtml }}
        />
        <AudioButton
          size="md"
          onPlay={() => onAudioPlay(card.word)}
        />
      </div>

      {/* Reading (Furigana/Kana) */}
      <div className="mb-6 text-center">
        {showWordReading && (
          <div className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-1"
               style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
            {card.wordReading}
          </div>
        )}

        {/* Target Reading Highlight */}
        <div className="flex items-center justify-center gap-2 mt-2">
          <div className="h-px w-6 bg-green-400 dark:bg-green-500"></div>
          <div className="px-3 py-1 rounded-lg bg-green-100 dark:bg-green-900/40
                        border border-green-300 dark:border-green-600">
            <span className="text-sm font-bold text-green-700 dark:text-green-300">
              {card.targetReading}
            </span>
          </div>
          <div className="h-px w-6 bg-green-400 dark:bg-green-500"></div>
        </div>
      </div>

      {/* Meaning */}
      <div className="text-center mb-4">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          {t?.meaning || 'Meaning'}
        </div>
        <div className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-200">
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

      {/* Card Type Indicator */}
      <div className="absolute bottom-4 text-xs text-gray-400 dark:text-gray-600">
        {t?.vocabulary || 'Vocabulary'}
      </div>
    </motion.div>
  )
}
