'use client'

import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { ReviewMode } from '@/lib/review-engine/core/types'
import { motion, AnimatePresence } from 'framer-motion'

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
  
  const renderContent = () => {
    switch (mode) {
      case 'recognition':
      case 'recall':
        return (
          <>
            <div className="text-center">
              {/* Primary content */}
              <div className="text-4xl font-bold mb-6">
                {mode === 'recognition' ? content.primaryDisplay : content.secondaryDisplay || 'Question'}
              </div>
              
              {/* Tertiary display (hints/context) */}
              {content.tertiaryDisplay && (
                <div className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                  {content.tertiaryDisplay}
                </div>
              )}
              
              {/* Image if available */}
              {content.imageUrl && (
                <div className="mb-6">
                  <img 
                    src={content.imageUrl} 
                    alt="Content visual"
                    className="max-w-full max-h-64 mx-auto rounded-lg shadow-md"
                  />
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
                  <div className="text-3xl font-semibold">
                    {mode === 'recognition' ? content.primaryAnswer : content.primaryDisplay}
                  </div>
                  {content.secondaryDisplay && mode === 'recognition' && (
                    <div className="text-xl text-gray-600 mt-2">
                      {content.secondaryDisplay}
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
      
      {/* Tags and metadata */}
      {content.tags && content.tags.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2 justify-center">
          {content.tags.map((tag, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      
      {/* Difficulty indicator */}
      {content.difficulty !== undefined && (
        <div className="mt-4">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`
                  h-2 w-8 rounded-full
                  ${i < Math.ceil(content.difficulty * 5)
                    ? 'bg-primary'
                    : 'bg-gray-200 dark:bg-gray-700'
                  }
                `}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}