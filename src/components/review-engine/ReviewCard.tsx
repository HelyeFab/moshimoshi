'use client'

import { ReviewableContent, ReviewableContentWithSRS } from '@/lib/review-engine/core/interfaces'
import { ReviewMode } from '@/lib/review-engine/core/types'
import { motion } from 'framer-motion'
import KanaCard from './cards/KanaCard'
import KanjiCard from './cards/KanjiCard'
import VocabularyCard from './cards/VocabularyCard'
import SentenceCard from './cards/SentenceCard'
import CustomCard from './cards/CustomCard'

interface ReviewCardProps {
  content: ReviewableContent | ReviewableContentWithSRS
  mode: ReviewMode
  showAnswer: boolean
  onAudioPlay?: () => void
  leechThreshold?: number
}

/** Check if item is a leech (8+ failures) */
function getLeechSeverity(
  content: ReviewableContent | ReviewableContentWithSRS,
  threshold = 8
): 'none' | 'warning' | 'critical' {
  const srs = (content as ReviewableContentWithSRS).srsData
  if (!srs) return 'none'
  const lapses = srs.reviewCount - srs.correctCount
  if (lapses >= threshold * 2) return 'critical'
  if (lapses >= threshold) return 'warning'
  return 'none'
}

export default function ReviewCard({
  content,
  mode,
  showAnswer,
  onAudioPlay,
  leechThreshold = 8,
}: ReviewCardProps) {
  const leechSeverity = getLeechSeverity(content, leechThreshold)
  const isLeech = leechSeverity !== 'none'

  const renderContent = () => {
    const cardProps = { content: content as ReviewableContent, mode, showAnswer, onAudioPlay }
    switch (content.contentType) {
      case 'kana':
        return <KanaCard {...cardProps} />
      case 'kanji':
        return <KanjiCard {...cardProps} />
      case 'vocabulary':
        return <VocabularyCard {...cardProps} />
      case 'sentence':
        return <SentenceCard {...cardProps} />
      case 'grammar':
        return <CustomCard {...cardProps} />
      default:
        return <CustomCard {...cardProps} />
    }
  }

  return (
    <motion.div
      className="relative bg-soft-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl p-3 sm:p-6 min-h-[140px] sm:min-h-[250px] flex flex-col justify-center"
      initial={{ scale: 0.98 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.15 }}
    >
      {/* Leech indicator badge */}
      {isLeech && (
        <div
          className={`absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            leechSeverity === 'critical'
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          }`}
          title="This item needs extra practice"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {leechSeverity === 'critical' ? 'Difficult' : 'Needs Practice'}
        </div>
      )}
      {renderContent()}
      {/* Leech tips shown after answer */}
      {isLeech && showAnswer && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-200"
        >
          <p className="font-medium mb-1">Tips for difficult items:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Create a mnemonic or story</li>
            <li>Break into smaller concepts</li>
            <li>Write it out or say it aloud</li>
          </ul>
        </motion.div>
      )}
    </motion.div>
  )
}
