'use client'

import { useState, useEffect } from 'react'
import { Kanji } from '@/types/kanji'
import { kanjiService } from '@/services/kanjiService'
import Modal from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/Loading'
import AudioButton from '@/components/ui/AudioButton'
import StrokeOrderModal from './StrokeOrderModal'
import DrawingPracticeModal from '@/components/drawing-practice/DrawingPracticeModal'
import { motion } from 'framer-motion'
import { useTTS } from '@/hooks/useTTS'
import { fetchTatoebaSentences, TatoebaSentence } from '@/utils/tatoeba-client'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import KuromojiService from '@/utils/kuromojiService'

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
  const [showDrawingPractice, setShowDrawingPractice] = useState(false)
  const [loadingStrokes, setLoadingStrokes] = useState(false)
  const [exampleSentences, setExampleSentences] = useState<TatoebaSentence[]>([])
  const [loadingSentences, setLoadingSentences] = useState(false)
  const [furiganaTexts, setFuriganaTexts] = useState<Record<string, string>>({})
  const [showFurigana, setShowFurigana] = useState(true)
  const { strings } = useI18n()
  const { user } = useAuth()
  const { subscription } = useSubscription()
  const userPlan = !user ? 'guest' : (subscription?.status === 'active' ? 'premium' : 'free')

  // TTS hook for audio playback
  const { play, preload } = useTTS({
    cacheFirst: true // Prioritize cached audio
  })

  // Fetch stroke count, example sentences, and preload audio when modal opens
  useEffect(() => {
    if (isOpen && kanji?.kanji) {
      fetchStrokeCount(kanji.kanji)
      fetchExamples(kanji.kanji)

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

  const fetchExamples = async (character: string) => {
    setLoadingSentences(true)
    try {
      const sentences = await fetchTatoebaSentences(character, 2)
      setExampleSentences(sentences)

      // Generate proper furigana using Kuromoji
      const kuromoji = KuromojiService.getInstance()
      const furiganaMap: Record<string, string> = {}

      for (const sentence of sentences) {
        try {
          const withFurigana = await kuromoji.addFurigana(sentence.japanese)
          furiganaMap[sentence.japanese] = withFurigana
        } catch (error) {
          console.error('Error generating furigana:', error)
          furiganaMap[sentence.japanese] = sentence.japanese
        }
      }

      setFuriganaTexts(furiganaMap)
    } catch (error) {
      console.error('Error fetching example sentences:', error)
      setExampleSentences([])
    } finally {
      setLoadingSentences(false)
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
        showCloseButton={false}
      >
        {/* Custom Header with Kanji and Meaning */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100" style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
              {kanji.kanji}
            </span>
            <span className="text-lg text-gray-600 dark:text-gray-400">
              {kanji.meaning}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Large Kanji Display with Stroke and Practice buttons */}
          <div className="text-center mb-8">
            <div className="relative inline-block">
              {/* Stroke Order Button - Top Left */}
              {strokeCount !== null && (
                <button
                  onClick={() => setShowStrokeOrder(true)}
                  className="absolute top-0 -left-12 sm:-left-16 p-2 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-all hover:scale-125"
                  title={`${strokeCount} strokes - Watch stroke order`}
                  aria-label="Show stroke order animation"
                >
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              )}

              {/* Practice Button - Top Right */}
              <button
                onClick={() => setShowDrawingPractice(true)}
                className="absolute top-0 -right-12 sm:-right-16 p-2 text-green-500 dark:text-green-400 hover:text-green-600 dark:hover:text-green-300 transition-all hover:scale-125"
                title="Practice writing"
                aria-label="Practice drawing this kanji"
              >
                <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>

              {/* Large Kanji */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, type: 'spring' }}
              >
                <div
                  className="text-8xl sm:text-9xl font-bold text-gray-900 dark:text-gray-100"
                  style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
                >
                  {kanji.kanji}
                </div>
              </motion.div>
            </div>

            {/* JLPT Level and Stroke Count Info */}
            <div className="flex items-center justify-center gap-3 mt-4">
              {kanji.jlpt && (
                <span className="px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg font-medium">
                  {kanji.jlpt}
                </span>
              )}
              {strokeCount !== null && (
                <span className="px-3 py-1.5 bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-lg">
                  {strokeCount} strokes
                </span>
              )}
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

          {/* Example Sentences from Tatoeba */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-dark-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {strings.learn?.kanji?.study?.exampleSentences || strings.kanji?.exampleSentences || 'Example Sentences'}
              </h3>
              {exampleSentences.length > 0 && furiganaTexts && Object.keys(furiganaTexts).length > 0 && (
                <button
                  onClick={() => setShowFurigana(!showFurigana)}
                  className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-lg bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
                  aria-label={showFurigana ? 'Hide furigana' : 'Show furigana'}
                >
                  {/* Ruby icon */}
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="hidden sm:inline">
                    {showFurigana ? 'Hide' : 'Show'} Furigana
                  </span>
                  <span className="sm:hidden">
                    {showFurigana ? 'あ' : 'A'}
                  </span>
                </button>
              )}
            </div>
            {loadingSentences ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="small" />
              </div>
            ) : exampleSentences.length > 0 ? (
              <div className="space-y-4">
                {exampleSentences.map((sentence, index) => (
                  <div key={sentence.id || index} className="bg-gray-50 dark:bg-dark-700/50 rounded-lg p-4 sm:p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1">
                        {/* Japanese sentence with furigana and highlighted kanji */}
                        <div className="text-lg text-gray-900 dark:text-gray-100 font-medium mb-2 leading-loose sm:leading-relaxed">
                          {showFurigana && furiganaTexts[sentence.japanese] ? (
                            <span
                              dangerouslySetInnerHTML={{
                                __html: furiganaTexts[sentence.japanese]
                                  .replace(new RegExp(`(${kanji.kanji})`, 'g'),
                                    '<span class="text-primary-600 dark:text-primary-400 font-bold">$1</span>')
                              }}
                            />
                          ) : (
                            sentence.japanese.split(kanji.kanji).map((part, i, arr) => (
                              <span key={i}>
                                {part}
                                {i < arr.length - 1 && (
                                  <span className="text-primary-600 dark:text-primary-400 font-bold">
                                    {kanji.kanji}
                                  </span>
                                )}
                              </span>
                            ))
                          )}
                        </div>
                        {/* English translation */}
                        <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                          {sentence.english}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <AudioButton
                          size="sm"
                          onPlay={() => play(sentence.japanese, { voice: 'ja-JP', rate: 0.9 })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 dark:text-gray-500 italic text-sm">
                {strings.learn?.kanji?.study?.noExampleSentences || strings.kanji?.noExampleSentences || 'No example sentences available'}
              </p>
            )}
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

      {/* Drawing Practice Modal */}
      {showDrawingPractice && kanji && (
        <DrawingPracticeModal
          character={kanji.kanji}
          isOpen={showDrawingPractice}
          onClose={() => setShowDrawingPractice(false)}
          characterType="kanji"
        />
      )}


    </>
  )
}