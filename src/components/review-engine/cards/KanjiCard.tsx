'use client'

import { ReviewableContent, KanjiMetadata } from '@/lib/review-engine/core/interfaces'
import { ReviewMode } from '@/lib/review-engine/core/types'
import { motion, AnimatePresence } from 'framer-motion'
import { useKanjiDetails } from '@/hooks/useKanjiDetails'
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal'
import { Kanji } from '@/types/kanji'
import { useTTS } from '@/hooks/useTTS'
import { useState, useCallback, useEffect } from 'react'
import { Volume2, Loader2 } from 'lucide-react'

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
  const { play: playTTS, loading: ttsLoading, playing: ttsPlaying } = useTTS({ cacheFirst: true })
  const [selectedReading, setSelectedReading] = useState<{ reading: string; type: 'onyomi' | 'kunyomi' } | null>(null)

  // Select a random reading when entering listening mode
  useEffect(() => {
    if (mode === 'listening' && metadata) {
      const readings: Array<{ reading: string; type: 'onyomi' | 'kunyomi' }> = []

      // Add on'yomi readings
      if (metadata.onyomi && Array.isArray(metadata.onyomi)) {
        for (const reading of metadata.onyomi) {
          if (reading && reading.trim()) {
            readings.push({ reading: reading.trim(), type: 'onyomi' })
          }
        }
      }

      // Add kun'yomi readings (clean okurigana after .)
      if (metadata.kunyomi && Array.isArray(metadata.kunyomi)) {
        for (const reading of metadata.kunyomi) {
          if (reading && reading.trim()) {
            const cleanReading = reading.split('.')[0].trim()
            if (cleanReading) {
              readings.push({ reading: cleanReading, type: 'kunyomi' })
            }
          }
        }
      }

      if (readings.length > 0) {
        const randomReading = readings[Math.floor(Math.random() * readings.length)]
        setSelectedReading(randomReading)
      }
    }
  }, [mode, metadata, content.id])

  // Handle audio play for listening mode
  const handleAudioPlay = useCallback(async () => {
    if (selectedReading) {
      try {
        await playTTS(selectedReading.reading, {
          voice: 'ja-JP',
          rate: 0.85,
          pitch: 1.0,
          volume: 1.0
        })
        onAudioPlay?.()
      } catch (error) {
        console.error('TTS playback failed:', error)
      }
    }
  }, [selectedReading, playTTS, onAudioPlay])

  // Convert metadata to Kanji format for the modal
  const handleOpenDetails = () => {
    const jlptLevel = metadata?.jlptLevel
    const jlptString = jlptLevel ? `N${jlptLevel}` as 'N5' | 'N4' | 'N3' | 'N2' | 'N1' : 'N5'

    // Note: primaryAnswer is the kanji character, primaryDisplay is the meaning
    const kanjiData: Kanji = {
      kanji: content.primaryAnswer,           // The kanji character
      meaning: content.primaryDisplay,        // The meaning
      meanings: [content.primaryDisplay],
      onyomi: metadata?.onyomi || [],
      kunyomi: metadata?.kunyomi || [],
      jlpt: jlptString,
      strokeCount: metadata?.strokeCount || 0,
      grade: metadata?.grade,
      frequency: metadata?.frequency,
      examples: []
    }
    openKanjiDetails(kanjiData)
  }

  const renderContent = () => {
    switch (mode) {
      case 'recognition':
        // Recognition mode: Show English meaning as prompt, user picks kanji from options
        return (
          <>
            <div className="text-center">
              <div className="text-base sm:text-lg text-gray-500 dark:text-gray-400 mb-2">
                Select the kanji for:
              </div>
              <div className="text-2xl sm:text-4xl font-bold mb-4 text-gray-800 dark:text-gray-100">
                {content.primaryDisplay}
              </div>
              {/* Info button */}
              <button
                onClick={handleOpenDetails}
                className="p-2 text-gray-400 hover:text-primary-500 dark:text-gray-500 dark:hover:text-primary-400 transition-all hover:scale-110"
                title="View full details"
                aria-label="View kanji details"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="text-center space-y-2 mt-4"
                >
                  {/* Show the kanji character after answer */}
                  <div className="text-7xl sm:text-9xl font-japanese text-gray-800 dark:text-gray-100">
                    {content.primaryAnswer}
                  </div>
                  {/* Show readings */}
                  {metadata?.onyomi && metadata.onyomi.length > 0 && (
                    <div className="text-lg text-gray-600 dark:text-gray-400">
                      <span className="text-gray-500">On: </span>
                      {metadata.onyomi.join(', ')}
                    </div>
                  )}
                  {metadata?.kunyomi && metadata.kunyomi.length > 0 && (
                    <div className="text-lg text-gray-600 dark:text-gray-400">
                      <span className="text-gray-500">Kun: </span>
                      {metadata.kunyomi.join(', ')}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )

      case 'listening':
        // Listening mode: Play reading audio, user picks kanji from options
        return (
          <>
            <div className="text-center">
              <button
                onClick={handleAudioPlay}
                disabled={ttsLoading || ttsPlaying}
                className={`mb-4 sm:mb-6 p-5 sm:p-6 rounded-full transition-all
                  ${ttsLoading || ttsPlaying
                    ? 'bg-primary-200 dark:bg-primary-800'
                    : 'bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200 dark:hover:bg-primary-800/50 hover:scale-105'
                  }`}
              >
                {ttsLoading ? (
                  <Loader2 className="w-12 h-12 sm:w-14 sm:h-14 text-primary-600 dark:text-primary-400 animate-spin" />
                ) : (
                  <Volume2 className={`w-12 h-12 sm:w-14 sm:h-14 text-primary-600 dark:text-primary-400 ${ttsPlaying ? 'animate-pulse' : ''}`} />
                )}
              </button>
              <div className="text-base sm:text-xl mb-2 text-gray-600 dark:text-gray-400">
                Listen and identify the kanji
              </div>
              {selectedReading && (
                <div className="text-sm text-gray-400 dark:text-gray-500">
                  ({selectedReading.type === 'onyomi' ? 'On\'yomi' : 'Kun\'yomi'} reading)
                </div>
              )}
            </div>
            <AnimatePresence>
              {showAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-center mt-4"
                >
                  {/* Show the kanji character */}
                  <div className="text-7xl sm:text-9xl font-japanese mb-2 text-gray-800 dark:text-gray-100">
                    {content.primaryAnswer}
                  </div>
                  {/* Show the meaning */}
                  <div className="text-xl sm:text-2xl mb-2 text-gray-700 dark:text-gray-300">
                    {content.primaryDisplay}
                  </div>
                  {/* Show the played reading highlighted */}
                  {selectedReading && (
                    <div className="text-lg text-primary-600 dark:text-primary-400 font-medium mb-2">
                      {selectedReading.reading} ({selectedReading.type === 'onyomi' ? 'On' : 'Kun'})
                    </div>
                  )}
                  {/* Show all readings */}
                  {metadata?.onyomi && metadata.onyomi.length > 0 && (
                    <div className="text-base text-gray-600 dark:text-gray-400">
                      <span className="text-gray-500">On: </span>
                      {metadata.onyomi.join(', ')}
                    </div>
                  )}
                  {metadata?.kunyomi && metadata.kunyomi.length > 0 && (
                    <div className="text-base text-gray-600 dark:text-gray-400">
                      <span className="text-gray-500">Kun: </span>
                      {metadata.kunyomi.join(', ')}
                    </div>
                  )}
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

        {/* Kanji info badges - show only in recognition mode before answer */}
        {metadata && mode === 'recognition' && !showAnswer && (
          <div className="mt-6 flex flex-wrap gap-2 justify-center text-sm">
            {metadata.strokeCount && (
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                {metadata.strokeCount} strokes
              </span>
            )}
            {metadata.jlptLevel && (
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                JLPT N{metadata.jlptLevel}
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
