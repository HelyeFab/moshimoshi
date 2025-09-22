'use client'

import { ReviewableContent, KanaMetadata } from '@/lib/review-engine/core/interfaces'
import { ReviewMode } from '@/lib/review-engine/core/types'
import { motion, AnimatePresence } from 'framer-motion'

interface KanaCardProps {
  content: ReviewableContent
  mode: ReviewMode
  showAnswer: boolean
  onAudioPlay?: () => void
}

export default function KanaCard({
  content,
  mode,
  showAnswer,
  onAudioPlay
}: KanaCardProps) {
  const metadata = content.metadata as KanaMetadata | undefined
  
  const renderContent = () => {
    switch (mode) {
      case 'recognition':
        return (
          <>
            <div className="text-8xl font-japanese mb-8 text-center">
              {content.primaryDisplay}
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
                  {metadata?.script && (
                    <div className="text-sm text-gray-500 capitalize">
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
            <div className="text-4xl mb-8 text-center">
              Write the {metadata?.script || 'kana'} for:
            </div>
            <div className="text-6xl font-bold mb-8 text-center">
              {content.secondaryDisplay || content.primaryAnswer}
            </div>
            <AnimatePresence>
              {showAnswer && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="text-center"
                >
                  <div className="text-8xl font-japanese">
                    {content.primaryDisplay}
                  </div>
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
              <div className="text-2xl mb-4">Listen and identify the kana</div>
            </div>
            <AnimatePresence>
              {showAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center"
                >
                  <div className="text-8xl font-japanese mb-2">
                    {content.primaryDisplay}
                  </div>
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
      
      {/* Additional info */}
      {metadata && (
        <div className="mt-8 flex gap-4 text-sm text-gray-500">
          {metadata.dakuten && <span className="px-2 py-1 bg-gray-100 rounded">Dakuten</span>}
          {metadata.handakuten && <span className="px-2 py-1 bg-gray-100 rounded">Handakuten</span>}
          {metadata.combination && <span className="px-2 py-1 bg-gray-100 rounded">Combination</span>}
        </div>
      )}
    </div>
  )
}