'use client'

import { ReviewableContent, VocabularyMetadata } from '@/lib/review-engine/core/interfaces'
import { ReviewMode } from '@/lib/review-engine/core/types'
import { motion, AnimatePresence } from 'framer-motion'

interface VocabularyCardProps {
  content: ReviewableContent
  mode: ReviewMode
  showAnswer: boolean
  onAudioPlay?: () => void
}

export default function VocabularyCard({
  content,
  mode,
  showAnswer,
  onAudioPlay
}: VocabularyCardProps) {
  const metadata = content.metadata as VocabularyMetadata | undefined
  
  const renderContent = () => {
    switch (mode) {
      case 'recognition':
        return (
          <>
            <div className="text-center">
              <div className="text-6xl font-japanese mb-4">
                {content.primaryDisplay}
              </div>
              {metadata?.reading && (
                <div className="text-2xl text-gray-600 dark:text-gray-400 mb-6">
                  {metadata.reading}
                </div>
              )}
            </div>
            <AnimatePresence>
              {showAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center"
                >
                  <div className="text-3xl mb-2">{content.primaryAnswer}</div>
                  {metadata?.partOfSpeech && (
                    <div className="text-sm text-gray-500">
                      {metadata.partOfSpeech.join(', ')}
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
            <div className="text-center">
              <div className="text-2xl mb-4">Write the Japanese for:</div>
              <div className="text-4xl font-bold mb-6">
                {content.primaryAnswer}
              </div>
              {metadata?.partOfSpeech && (
                <div className="text-lg text-gray-500 mb-4">
                  ({metadata.partOfSpeech[0]})
                </div>
              )}
            </div>
            <AnimatePresence>
              {showAnswer && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="text-center"
                >
                  <div className="text-6xl font-japanese mb-2">
                    {content.primaryDisplay}
                  </div>
                  {metadata?.reading && (
                    <div className="text-2xl text-gray-600">
                      {metadata.reading}
                    </div>
                  )}
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
                className="mb-8 p-8 bg-primary/10 rounded-full hover:bg-primary/20 transition-colors"
              >
                <span className="text-6xl">🔊</span>
              </button>
              <div className="text-2xl mb-4">What word do you hear?</div>
            </div>
            <AnimatePresence>
              {showAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center"
                >
                  <div className="text-6xl font-japanese mb-2">
                    {content.primaryDisplay}
                  </div>
                  {metadata?.reading && (
                    <div className="text-2xl text-gray-600 mb-2">
                      {metadata.reading}
                    </div>
                  )}
                  <div className="text-3xl">{content.primaryAnswer}</div>
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
    <div className="flex flex-col items-center justify-center">
      {renderContent()}
      
      {/* Example sentences */}
      {showAnswer && metadata?.exampleSentences && metadata.exampleSentences.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 w-full max-w-2xl"
        >
          <div className="text-sm text-gray-500 mb-2">Example:</div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-lg font-japanese mb-2">
              {metadata.exampleSentences[0].japanese}
            </div>
            {metadata.exampleSentences[0].furigana && (
              <div className="text-sm text-gray-600 mb-2">
                {metadata.exampleSentences[0].furigana}
              </div>
            )}
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {metadata.exampleSentences[0].translation}
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Word info badges */}
      {metadata && (
        <div className="mt-6 flex gap-2 text-sm">
          {metadata.commonUsage && (
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full">
              Common
            </span>
          )}
          {metadata.pitchAccent !== undefined && (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
              Pitch: {metadata.pitchAccent}
            </span>
          )}
        </div>
      )}
    </div>
  )
}