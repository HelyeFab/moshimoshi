'use client'

import { ReviewableContent, KanjiMetadata } from '@/lib/review-engine/core/interfaces'
import { ReviewMode } from '@/lib/review-engine/core/types'
import { motion, AnimatePresence } from 'framer-motion'
import { useKanjiDetails } from '@/hooks/useKanjiDetails'
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal'
import { Kanji } from '@/types/kanji'

interface KanjiCardProps {
  content: ReviewableContent
  mode: ReviewMode
  showAnswer: boolean
  onAudioPlay?: () => void
}

export default function KanjiCard({
  content,
  mode,
  showAnswer,
  onAudioPlay
}: KanjiCardProps) {
  const metadata = content.metadata as KanjiMetadata | undefined
  const { modalKanji, openKanjiDetails, closeKanjiDetails } = useKanjiDetails()

  // Convert metadata to Kanji format for the modal
  const handleOpenDetails = () => {
    const kanjiData: Kanji = {
      kanji: content.primaryDisplay,
      meaning: content.primaryAnswer,
      onyomi: metadata?.onyomi || [],
      kunyomi: metadata?.kunyomi || [],
      jlpt: metadata?.jlpt,
      grade: metadata?.grade,
      frequency: metadata?.frequency
    }
    openKanjiDetails(kanjiData)
  }
  
  const renderContent = () => {
    switch (mode) {
      case 'recognition':
        return (
          <>
            <div className="text-9xl font-japanese mb-8 text-center relative inline-block">
              {content.primaryDisplay}
              {/* Info button */}
              <button
                onClick={handleOpenDetails}
                className="absolute -top-2 -right-12 p-2 text-gray-400 hover:text-primary-500 dark:text-gray-500 dark:hover:text-primary-400 transition-all hover:scale-110"
                title="View full details"
                aria-label="View kanji details"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
            <AnimatePresence>
              {showAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center space-y-2"
                >
                  <div className="text-2xl">{content.primaryAnswer}</div>
                  {metadata?.onyomi && metadata.onyomi.length > 0 && (
                    <div className="text-lg">
                      <span className="text-gray-500">On: </span>
                      {metadata.onyomi.join(', ')}
                    </div>
                  )}
                  {metadata?.kunyomi && metadata.kunyomi.length > 0 && (
                    <div className="text-lg">
                      <span className="text-gray-500">Kun: </span>
                      {metadata.kunyomi.join(', ')}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )
        
      case 'recall':
        return (
          <>
            <div className="text-xl mb-4 text-center text-gray-600 dark:text-gray-400">Write the kanji for:</div>
            <div className="text-3xl font-bold mb-4 text-center">
              {content.primaryDisplay?.split(',').map((part, index, array) => (
                <span key={index}>
                  {part.trim()}
                  {index < array.length - 1 && <span className="mx-2 text-gray-400">·</span>}
                </span>
              ))}
            </div>
            {content.secondaryDisplay && (
              <div className="text-lg text-center mb-4 text-gray-600 dark:text-gray-400">
                {content.secondaryDisplay}
              </div>
            )}
            <AnimatePresence>
              {showAnswer && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="text-center"
                >
                  <div className="text-9xl font-japanese">
                    {content.primaryDisplay}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )
        
      default:
        return null
    }
  }
  
  return (
    <>
      <div className="flex flex-col items-center justify-center">
        {renderContent()}

        {/* Kanji info badges */}
      {metadata && (
        <div className="mt-8 flex flex-wrap gap-2 justify-center text-sm">
          {metadata.strokeCount && (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
              {metadata.strokeCount} strokes
            </span>
          )}
          {metadata.jlptLevel && (
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full">
              JLPT N{metadata.jlptLevel}
            </span>
          )}
          {metadata.grade && (
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full">
              Grade {metadata.grade}
            </span>
          )}
          {metadata.frequency && (
            <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full">
              #{metadata.frequency} frequency
            </span>
          )}
        </div>
      )}
      </div>

      {/* Kanji Details Modal */}
      <KanjiDetailsModal
        kanji={modalKanji}
        isOpen={!!modalKanji}
        onClose={closeKanjiDetails}
      />
    </>
  )
}