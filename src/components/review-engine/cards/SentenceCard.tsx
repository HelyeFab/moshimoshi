'use client'

import { ReviewableContent, SentenceMetadata } from '@/lib/review-engine/core/interfaces'
import { ReviewMode } from '@/lib/review-engine/core/types'
import { motion, AnimatePresence } from 'framer-motion'

interface SentenceCardProps {
  content: ReviewableContent
  mode: ReviewMode
  showAnswer: boolean
  onAudioPlay?: () => void
}

export default function SentenceCard({
  content,
  mode,
  showAnswer,
  onAudioPlay
}: SentenceCardProps) {
  const metadata = content.metadata as SentenceMetadata | undefined
  
  const renderContent = () => {
    switch (mode) {
      case 'recognition':
        return (
          <>
            <div className="text-center">
              <div className="text-2xl font-japanese mb-4 leading-relaxed">
                {content.primaryDisplay}
              </div>
              {metadata?.furigana && (
                <div className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                  {metadata.furigana}
                </div>
              )}
            </div>
            <AnimatePresence>
              {showAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center mt-8"
                >
                  <div className="text-xl">
                    {metadata?.translation || content.primaryAnswer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )
        
      case 'recall':
        return (
          <>
            <div className="text-center">
              <div className="text-xl mb-4">Translate to Japanese:</div>
              <div className="text-2xl mb-6 leading-relaxed">
                {metadata?.translation || content.primaryAnswer}
              </div>
              {metadata?.grammarPoints && metadata.grammarPoints.length > 0 && (
                <div className="text-sm text-gray-500 mb-4">
                  Grammar points: {metadata.grammarPoints.join(', ')}
                </div>
              )}
            </div>
            <AnimatePresence>
              {showAnswer && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="text-center mt-8"
                >
                  <div className="text-2xl font-japanese mb-2 leading-relaxed">
                    {content.primaryDisplay}
                  </div>
                  {metadata?.furigana && (
                    <div className="text-lg text-gray-600">
                      {metadata.furigana}
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
              <div className="text-xl mb-4">Listen and understand the sentence</div>
            </div>
            <AnimatePresence>
              {showAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center space-y-4"
                >
                  <div className="text-2xl font-japanese leading-relaxed">
                    {content.primaryDisplay}
                  </div>
                  {metadata?.furigana && (
                    <div className="text-lg text-gray-600">
                      {metadata.furigana}
                    </div>
                  )}
                  <div className="text-xl">
                    {metadata?.translation || content.primaryAnswer}
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
    <div className="flex flex-col items-center justify-center">
      {renderContent()}
      
      {/* Grammar points and difficulty */}
      {metadata && showAnswer && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex flex-wrap gap-2 justify-center"
        >
          {metadata.difficulty && (
            <span className={`
              px-3 py-1 rounded-full text-sm
              ${metadata.difficulty === 'beginner' && 'bg-green-100 text-green-700'}
              ${metadata.difficulty === 'intermediate' && 'bg-yellow-100 text-yellow-700'}
              ${metadata.difficulty === 'advanced' && 'bg-red-100 text-red-700'}
            `}>
              {metadata.difficulty}
            </span>
          )}
          {metadata.grammarPoints?.map((point, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
            >
              {point}
            </span>
          ))}
        </motion.div>
      )}
    </div>
  )
}