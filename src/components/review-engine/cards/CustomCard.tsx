'use client'

import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { ReviewMode } from '@/lib/review-engine/core/types'
import { motion, AnimatePresence } from 'framer-motion'
import { Volume2 } from 'lucide-react'

interface CustomCardProps {
  content: ReviewableContent
  mode: ReviewMode
  showAnswer: boolean
  onAudioPlay?: () => void
}

export default function CustomCard({
  content,
  mode,
  showAnswer,
  onAudioPlay
}: CustomCardProps) {

  // Check if this is an Anki card with rich content
  const isAnkiCard = content.metadata?.source === 'anki'
  const reading = content.reading || content.metadata?.reading
  const expression = content.metadata?.expression
  const meaning = content.metadata?.meaning
  const sentence = content.metadata?.sentence
  const sentenceReading = content.metadata?.sentenceReading
  const sentenceMeaning = content.metadata?.sentenceMeaning

  const renderContent = () => {
    switch (mode) {
      case 'recognition':
      case 'recall':
        return (
          <>
            <div className="text-center">
              {/* Primary content (expression/kanji) */}
              <div className="text-5xl font-bold mb-2">
                {mode === 'recognition' ? content.primaryDisplay : content.secondaryDisplay || 'Question'}
              </div>

              {/* Reading (hiragana) - show on front for Anki cards */}
              {isAnkiCard && reading && !showAnswer && (
                <div className="text-2xl text-gray-500 dark:text-gray-400 mb-4">
                  {reading}
                </div>
              )}

              {/* Audio button - inline for cards with audio */}
              {content.audioUrl && onAudioPlay && (
                <button
                  onClick={onAudioPlay}
                  className="mb-4 p-3 bg-primary-100 dark:bg-primary-900/30 rounded-full hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                  title="Play audio"
                >
                  <Volume2 className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </button>
              )}

              {/* Image if available */}
              {content.imageUrl && (
                <div className="mb-4">
                  <img
                    src={content.imageUrl}
                    alt="Content visual"
                    className="max-w-full max-h-48 mx-auto rounded-lg shadow-md"
                  />
                </div>
              )}

              {/* Tertiary display (hints/context) - only if no image */}
              {!content.imageUrl && content.tertiaryDisplay && (
                <div className="text-lg text-gray-600 dark:text-gray-400 mb-4 whitespace-pre-line">
                  {content.tertiaryDisplay}
                </div>
              )}
            </div>

            <AnimatePresence>
              {showAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center mt-6 space-y-4"
                >
                  {/* Reading on answer (if not shown on front) */}
                  {reading && !isAnkiCard && (
                    <div className="text-xl text-gray-500 dark:text-gray-400">
                      {reading}
                    </div>
                  )}

                  {/* Meaning/Answer */}
                  <div className="text-2xl font-semibold text-primary-600 dark:text-primary-400">
                    {meaning || (mode === 'recognition' ? content.primaryAnswer : content.primaryDisplay)}
                  </div>

                  {/* Secondary display (full answer info) */}
                  {content.secondaryDisplay && mode === 'recognition' && !meaning && (
                    <div className="text-lg text-gray-600 dark:text-gray-400 whitespace-pre-line">
                      {content.secondaryDisplay}
                    </div>
                  )}

                  {/* Example sentence for Anki cards */}
                  {isAnkiCard && sentence && (
                    <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-left">
                      <div className="text-lg font-medium mb-1">{sentence}</div>
                      {sentenceReading && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                          {sentenceReading}
                        </div>
                      )}
                      {sentenceMeaning && (
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {sentenceMeaning}
                        </div>
                      )}
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
              {content.audioUrl ? (
                <button
                  onClick={onAudioPlay}
                  className="mb-8 p-8 bg-primary/10 rounded-full hover:bg-primary/20 transition-colors"
                >
                  <span className="text-6xl">🔊</span>
                </button>
              ) : (
                <div className="text-gray-500 mb-8">
                  No audio available for this content
                </div>
              )}
              
              {content.tertiaryDisplay && (
                <div className="text-lg text-gray-600 mb-4">
                  {content.tertiaryDisplay}
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
                  <div className="text-3xl font-semibold mb-2">
                    {content.primaryDisplay}
                  </div>
                  <div className="text-xl">
                    {content.primaryAnswer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )
      default:
        return (
          <div className="text-center">
            <div className="text-4xl font-bold mb-6">
              {content.primaryDisplay}
            </div>
            {showAnswer && (
              <div className="text-2xl">
                {content.primaryAnswer}
              </div>
            )}
          </div>
        )
    }
  }
  
  return (
    <div className="flex flex-col items-center justify-center">
      {renderContent()}
    </div>
  )
}