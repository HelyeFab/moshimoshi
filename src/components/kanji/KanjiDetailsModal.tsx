'use client'

import { useState, useEffect } from 'react'
import { Kanji } from '@/types/kanji'
import { kanjiService } from '@/services/kanjiService'
import Modal from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/Loading'
import AudioButton from '@/components/ui/AudioButton'
import StrokeOrderModal from './StrokeOrderModal'
import { motion } from 'framer-motion'
import { useTTS } from '@/hooks/useTTS'

interface KanjiDetailsModalProps {
  kanji: Kanji | null
  isOpen: boolean
  onClose: () => void
}

export default function KanjiDetailsModal({
  kanji,
  isOpen,
  onClose
}: KanjiDetailsModalProps) {
  const [strokeCount, setStrokeCount] = useState<number | null>(null)
  const [showStrokeOrder, setShowStrokeOrder] = useState(false)
  const [loadingStrokes, setLoadingStrokes] = useState(false)

  // TTS hook for audio playback
  const { play, preload } = useTTS({
    cacheFirst: true // Prioritize cached audio
  })

  // Fetch stroke count and preload audio when modal opens
  useEffect(() => {
    if (isOpen && kanji?.kanji) {
      fetchStrokeCount(kanji.kanji)

      // Preload all readings for better UX
      const readingsToPreload: string[] = []
      if (kanji.onyomi) readingsToPreload.push(...kanji.onyomi)
      if (kanji.kunyomi) readingsToPreload.push(...kanji.kunyomi)
      if (readingsToPreload.length > 0) {
        preload(readingsToPreload, { voice: 'ja-JP' })
      }
    }
  }, [isOpen, kanji?.kanji])

  const fetchStrokeCount = async (character: string) => {
    setLoadingStrokes(true)
    try {
      const svgText = await kanjiService.getStrokeOrderSVG(character)
      if (svgText) {
        const count = kanjiService.getStrokeCount(svgText)
        setStrokeCount(count)
      } else {
        setStrokeCount(null)
      }
    } catch (error) {
      console.error('Error fetching stroke count:', error)
      setStrokeCount(null)
    } finally {
      setLoadingStrokes(false)
    }
  }

  if (!kanji) return null

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title=""
        size="lg"
        showCloseButton={true}
      >
        <div className="p-6">
          {/* Large Kanji Display */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, type: 'spring' }}
              className="inline-block"
            >
              <div
                className="text-8xl sm:text-9xl font-bold text-gray-900 dark:text-gray-100 mb-4"
                style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
              >
                {kanji.kanji}
              </div>
            </motion.div>

            {/* JLPT Level and Stroke Count */}
            <div className="flex items-center justify-center gap-3">
              {kanji.jlpt && (
                <span className="px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg font-medium">
                  {kanji.jlpt}
                </span>
              )}
              {loadingStrokes ? (
                <div className="px-3 py-1.5 bg-gray-100 dark:bg-dark-700 rounded-lg">
                  <LoadingSpinner size="xsmall" />
                </div>
              ) : strokeCount !== null ? (
                <button
                  onClick={() => setShowStrokeOrder(true)}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  {strokeCount} strokes
                </button>
              ) : null}
            </div>
          </div>

          {/* Meaning Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Meaning
            </h3>
            <div className="text-xl font-medium text-gray-900 dark:text-gray-100">
              {kanji.meaning}
            </div>
          </div>

          {/* Readings Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Onyomi (Chinese Reading) */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                On'yomi (音読み)
              </h3>
              {kanji.onyomi && kanji.onyomi.length > 0 ? (
                <div className="space-y-2">
                  {kanji.onyomi.map((reading, index) => (
                    <div
                      key={index}
                      className="inline-flex items-center gap-2 mr-2"
                    >
                      <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg font-medium">
                        {reading}
                      </div>
                      <AudioButton
                        size="sm"
                        onPlay={() => play(reading, { voice: 'ja-JP' })}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-gray-400 dark:text-gray-500 italic">None</span>
              )}
            </div>

            {/* Kunyomi (Japanese Reading) */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Kun'yomi (訓読み)
              </h3>
              {kanji.kunyomi && kanji.kunyomi.length > 0 ? (
                <div className="space-y-2">
                  {kanji.kunyomi.map((reading, index) => (
                    <div
                      key={index}
                      className="inline-flex items-center gap-2 mr-2"
                    >
                      <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg font-medium">
                        {reading}
                      </div>
                      <AudioButton
                        size="sm"
                        onPlay={() => play(reading, { voice: 'ja-JP' })}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-gray-400 dark:text-gray-500 italic">None</span>
              )}
            </div>
          </div>

          {/* Additional Info */}
          {(kanji.grade || kanji.frequency) && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-dark-700">
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                {kanji.grade && (
                  <div>
                    <span className="font-medium">Grade Level:</span> {kanji.grade}
                  </div>
                )}
                {kanji.frequency && (
                  <div>
                    <span className="font-medium">Frequency Rank:</span> #{kanji.frequency}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Stroke Order Modal */}
      {showStrokeOrder && kanji && (
        <StrokeOrderModal
          character={kanji.kanji}
          isOpen={showStrokeOrder}
          onClose={() => setShowStrokeOrder(false)}
        />
      )}
    </>
  )
}