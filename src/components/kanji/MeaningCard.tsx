'use client'

import { motion } from 'framer-motion'
import type { MeaningCard as MeaningCardType } from '@/types/kanji-study'
import AudioButton from '@/components/ui/AudioButton'
import { useI18n } from '@/i18n/I18nContext'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'

interface MeaningCardProps {
  card: MeaningCardType
  onAudioPlay: (text: string) => Promise<void>
}

/**
 * Meaning introduction card for vocabulary-first kanji study
 * Shows the kanji meaning(s) before diving into vocabulary
 */
export default function MeaningCard({ card, onAudioPlay }: MeaningCardProps) {
  const { strings } = useI18n()
  const t = strings.vocabularyFirstStudy?.meaningCard

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full flex flex-col items-center justify-center py-12 px-4 sm:px-8 relative"
    >
      {/* Audio Button - Top Left */}
      <div className="absolute top-4 left-4">
        <AudioButton
          size="sm"
          onPlay={() => onAudioPlay(card.kanjiCharacter)}
        />
      </div>

      {/* Metadata Badges - Top Right */}
      {(card.strokeCount || card.jlptLevel) && (
        <div className="absolute top-4 right-4 flex gap-2">
          {card.jlptLevel && (
            <span className="px-2.5 py-1 text-xs font-bold rounded-lg
                           bg-blue-100 dark:bg-blue-900/30
                           text-blue-700 dark:text-blue-300
                           border border-blue-200 dark:border-blue-700">
              {card.jlptLevel}
            </span>
          )}
          {card.strokeCount && (
            <span className="px-2.5 py-1 text-xs font-medium rounded-lg
                           bg-gray-100 dark:bg-dark-700
                           text-gray-600 dark:text-gray-400
                           border border-gray-200 dark:border-dark-600">
              {(t?.strokes || '{count} strokes').replace('{count}', card.strokeCount.toString())}
            </span>
          )}
        </div>
      )}

      {/* Kanji Character - Hero Display */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 via-primary-400/20 to-primary-500/20 blur-3xl"></div>
        <div className="relative text-[12rem] sm:text-[14rem] font-bold bg-gradient-to-br from-gray-900 via-gray-700 to-gray-900 dark:from-gray-100 dark:via-gray-300 dark:to-gray-100 bg-clip-text text-transparent leading-none"
             style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif' }}>
          {card.kanjiCharacter}
        </div>
      </div>

      {/* Primary Meaning */}
      <div className="text-center mb-8 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-3">
          <div className="w-2 h-2 rounded-full bg-purple-500 dark:bg-purple-400"></div>
          <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
            {t?.meaning || 'Meaning'}
          </span>
        </div>
        <div className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
          {card.primaryMeaning}
        </div>
      </div>

      {/* All Meanings (if more than primary) */}
      {card.allMeanings.length > 1 && (
        <div className="text-center max-w-md">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t?.alsoMeans || 'Also means:'}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {card.allMeanings
              .filter(m => m !== card.primaryMeaning)
              .join(', ')}
          </div>
        </div>
      )}

      {/* Card Type Indicator */}
      <div className="absolute bottom-4 text-xs text-gray-400 dark:text-gray-600">
        {t?.introduction || 'Introduction'}
      </div>

      {/* Mobile Navigation Spacer */}
      <MobileNavSpacer />
    </motion.div>
  )
}
