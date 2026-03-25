'use client'

import { motion } from 'framer-motion'
import type { MeaningCard as MeaningCardType } from '@/types/kanji-study'
import AudioButton from '@/components/ui/AudioButton'
import { useI18n } from '@/i18n/I18nContext'

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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="w-full h-full bg-white dark:bg-dark-800 rounded-2xl shadow-2xl
                 border-2 border-gray-200 dark:border-dark-600
                 flex flex-col items-center justify-center p-8 relative"
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

      {/* Kanji Character */}
      <div className="text-9xl sm:text-[10rem] font-bold text-gray-800 dark:text-gray-200 mb-6"
           style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif' }}>
        {card.kanjiCharacter}
      </div>

      {/* Primary Meaning */}
      <div className="text-center mb-6">
        <div className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2">
          {t?.meaning || 'Meaning'}
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200">
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
    </motion.div>
  )
}
