'use client'

import { ReviewableContent, KanaMetadata } from '@/lib/review-engine/core/interfaces'
import { ReviewMode } from '@/lib/review-engine/core/types'
import { motion, AnimatePresence } from 'framer-motion'
import { Volume2 } from 'lucide-react'
import { playKanaAudio } from '@/data/kanaData'

interface KanaCardProps {
  content: ReviewableContent
  mode: ReviewMode
  showAnswer: boolean
  onAudioPlay?: () => void
}

export default function KanaCard({ content, mode, showAnswer, onAudioPlay }: KanaCardProps) {
  const metadata = content.metadata as KanaMetadata | undefined

  const handlePlayKanaAudio = async () => {
    if (content.id && metadata?.script) {
      try {
        await playKanaAudio(content.id, metadata.script)
      } catch (error) {
        console.error('[KanaCard] Audio playback failed:', error)
      }
    }
  }

  const renderContent = () => {
    switch (mode) {
      case 'recognition':
        return (
          <>
            <div className="text-5xl sm:text-7xl font-japanese mb-2 sm:mb-4 text-center">
              {content.primaryDisplay}
            </div>
            <AnimatePresence>
              {showAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-center"
                >
                  <div className="text-xl sm:text-3xl mb-1 sm:mb-2">{content.primaryAnswer}</div>
                  {metadata?.script && (
                    <div className="text-xs sm:text-sm text-gray-500 capitalize">
                      {metadata.script}
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
            <div className="text-xl sm:text-4xl mb-2 sm:mb-8 text-center">
              Write the {metadata?.script || 'kana'} for:
            </div>
            <div className="text-4xl sm:text-6xl font-bold mb-2 sm:mb-8 text-center">
              {content.secondaryDisplay || content.primaryAnswer}
            </div>
            <AnimatePresence>
              {showAnswer && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-center"
                >
                  <div className="text-5xl sm:text-8xl font-japanese">{content.primaryDisplay}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )

      case 'listening':
        return (
          <>
            <div className="text-center">
              <button
                onClick={onAudioPlay}
                className="mb-3 sm:mb-8 p-4 sm:p-8 bg-primary/10 rounded-full hover:bg-primary/20 transition-colors"
              >
                <span className="text-4xl sm:text-6xl">🔊</span>
              </button>
              <div className="text-base sm:text-2xl mb-2 sm:mb-4">Listen and identify the kana</div>
            </div>
            <AnimatePresence>
              {showAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-center"
                >
                  <div className="text-5xl sm:text-8xl font-japanese mb-1 sm:mb-2">
                    {content.primaryDisplay}
                  </div>
                  <div className="text-xl sm:text-3xl">{content.primaryAnswer}</div>
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
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      {/* Audio button - top right corner of the card */}
      <button
        onClick={handlePlayKanaAudio}
        className="absolute -top-1 -right-1 sm:-top-3 sm:-right-3 p-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors hover:scale-110 active:scale-95"
        title="Play audio"
        aria-label="Play kana pronunciation"
      >
        <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {renderContent()}

      {/* Additional info - hidden on mobile to save space */}
      {metadata && (
        <div className="hidden sm:flex mt-4 sm:mt-8 gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
          {metadata.dakuten && (
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Dakuten</span>
          )}
          {metadata.handakuten && (
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Handakuten</span>
          )}
          {metadata.combination && (
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Combination</span>
          )}
        </div>
      )}
    </div>
  )
}
