'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Kanji } from '@/types/kanji'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'
import AudioButton from '@/components/ui/AudioButton'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { useKanjiBrowser } from '@/hooks/useKanjiBrowser'
import { useTTS } from '@/hooks/useTTS'
import ExamplesModal from './ExamplesModal'
import StrokeOrderModal from './StrokeOrderModal'

interface KanjiStudyModeProps {
  kanji: Kanji
  onNext: () => void
  onPrevious: () => void
  onBack: () => void
  currentIndex: number
  totalKanji: number
}

export default function KanjiStudyMode({
  kanji,
  onNext,
  onPrevious,
  onBack,
  currentIndex,
  totalKanji
}: KanjiStudyModeProps) {
  const { t, strings } = useI18n()
  const { showToast } = useToast()
  const { user } = useAuth()
  const { isPremium } = useSubscription()
  const [isFlipped, setIsFlipped] = useState(false)
  const [hasTrackedView, setHasTrackedView] = useState(false)
  const { browseKanji } = useKanjiBrowser()
  const { play, preload, isLoading: ttsLoading } = useTTS({ cacheFirst: true })

  // Modal states
  const [showExamplesModal, setShowExamplesModal] = useState(false)
  const [showStrokeOrderModal, setShowStrokeOrderModal] = useState(false)

  // Interactive pill states
  const [showMeaning, setShowMeaning] = useState(false)
  const [showOnyomi, setShowOnyomi] = useState(false)
  const [showKunyomi, setShowKunyomi] = useState(false)

  // Timer refs for auto-hide
  const meaningTimerRef = useRef<NodeJS.Timeout | null>(null)
  const onyomiTimerRef = useRef<NodeJS.Timeout | null>(null)
  const kunyomiTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Track kanji view when component mounts or kanji changes
  useEffect(() => {
    const trackView = async () => {
      if (kanji && user && user.uid && !hasTrackedView) {
        await browseKanji(kanji.kanji, kanji.kanji)
        setHasTrackedView(true)
      }
    }
    trackView()
  }, [kanji.kanji, user, hasTrackedView])


  // Reset state when kanji changes
  useEffect(() => {
    // Clear any existing timers
    if (meaningTimerRef.current) {
      clearTimeout(meaningTimerRef.current)
      meaningTimerRef.current = null
    }
    if (onyomiTimerRef.current) {
      clearTimeout(onyomiTimerRef.current)
      onyomiTimerRef.current = null
    }
    if (kunyomiTimerRef.current) {
      clearTimeout(kunyomiTimerRef.current)
      kunyomiTimerRef.current = null
    }

    setIsFlipped(false)
    setHasTrackedView(false)
    setShowMeaning(false)
    setShowOnyomi(false)
    setShowKunyomi(false)

    // Preload TTS for kanji and readings using the proper TTS system
    const textsToPreload: string[] = [kanji.kanji]
    if (kanji.onyomi) textsToPreload.push(...kanji.onyomi.filter(r => r))
    if (kanji.kunyomi) textsToPreload.push(...kanji.kunyomi.filter(r => r))

    // Preload all audio using the app's TTS system (expects array)
    if (textsToPreload.length > 0) {
      preload(textsToPreload, {
        voice: 'ja-JP',
        rate: 0.9,
        pitch: 1.0
      })
    }
  }, [kanji.kanji])

  const handlePlayAudio = async (text: string) => {
    try {
      // Use the app's proper TTS system (will use cache first, then API)
      await play(text, {
        voice: 'ja-JP',
        rate: 0.9,
        pitch: 1.0,
        volume: 1.0
      })
    } catch (error) {
      console.error('TTS playback failed:', error)

      // Fallback to browser speech synthesis if TTS API fails
      if (window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel()
          const utterance = new SpeechSynthesisUtterance(text)
          utterance.lang = 'ja-JP'
          utterance.rate = 0.9

          const voices = window.speechSynthesis.getVoices()
          const jpVoice = voices.find(voice => voice.lang.startsWith('ja'))
          if (jpVoice) utterance.voice = jpVoice

          window.speechSynthesis.speak(utterance)
        } catch (fallbackError) {
          console.error('Fallback audio also failed:', fallbackError)
          showToast('Audio not available', 'warning')
        }
      } else {
        showToast('Audio not available', 'warning')
      }
    }
  }

  const handleSkip = () => {
    onNext()
  }

  const handleMarkAsLearned = () => {
    showToast('Marked as learned!', 'success')
    setTimeout(onNext, 500)
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center p-4">
      {/* Progress Indicator */}
      <div className="w-full max-w-2xl mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {currentIndex} / {totalKanji}
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Not Started
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-300"
            style={{ width: `${(currentIndex / totalKanji) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="relative"
      >
        <div
          className="relative w-80 h-80 md:w-96 md:h-96 cursor-pointer"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <AnimatePresence mode="wait">
            {!isFlipped ? (
              <motion.div
                key="front"
                initial={{ rotateY: 0 }}
                animate={{ rotateY: 0 }}
                exit={{ rotateY: 90 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 bg-white dark:bg-dark-800 rounded-2xl shadow-2xl
                         border-2 border-gray-200 dark:border-dark-600
                         flex flex-col items-center justify-center p-8
                         hover:scale-[1.02] transition-transform duration-200"
              >
                {/* Audio Icon for character - Top Left */}
                <div className="absolute top-4 left-4">
                  <AudioButton
                    size="sm"
                    onPlay={() => handlePlayAudio(kanji.kanji)}
                  />
                </div>

                {/* Kanji Display */}
                <div className="text-8xl font-bold text-gray-800 dark:text-gray-200 mb-4"
                     style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                  {kanji.kanji}
                </div>


                <p className="absolute bottom-4 text-xs text-gray-400 dark:text-gray-600">
                  Tap to flip
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="back"
                initial={{ rotateY: -90 }}
                animate={{ rotateY: 0 }}
                exit={{ rotateY: 90 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 bg-gradient-to-br from-primary-50 to-primary-100
                         dark:from-primary-900/20 dark:to-primary-800/20
                         rounded-2xl shadow-2xl border-2 border-primary-200 dark:border-primary-700
                         p-8 overflow-y-auto"
              >
                {/* Kanji in top-right corner */}
                <div className="absolute top-6 right-6 text-5xl font-bold text-gray-800 dark:text-gray-200"
                     style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                  {kanji.kanji}
                </div>

                {/* Can you recall header */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                    Can you recall:
                  </h3>

                  {/* Meaning pill */}
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Meaning</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()

                        // Clear existing timer
                        if (meaningTimerRef.current) {
                          clearTimeout(meaningTimerRef.current)
                          meaningTimerRef.current = null
                        }

                        setShowMeaning(!showMeaning)

                        // Set new timer only if revealing
                        if (!showMeaning) {
                          meaningTimerRef.current = setTimeout(() => {
                            setShowMeaning(false)
                            meaningTimerRef.current = null
                          }, 5000) // Increased to 5 seconds
                        }
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-red-100 dark:bg-red-900/30
                               hover:bg-red-200 dark:hover:bg-red-900/40
                               transition-all transform active:scale-95
                               border border-red-200 dark:border-red-800"
                    >
                      {showMeaning ? (
                        <span className="text-lg font-semibold text-red-700 dark:text-red-400">
                          {kanji.meaning}
                        </span>
                      ) : (
                        <span className="text-sm text-red-600/60 dark:text-red-500/60">
                          Tap to reveal
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Onyomi pill */}
                  {kanji.onyomi && kanji.onyomi.length > 0 && kanji.onyomi[0] !== '' && (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600 dark:text-gray-400">On'yomi</div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()

                          // Clear existing timer
                          if (onyomiTimerRef.current) {
                            clearTimeout(onyomiTimerRef.current)
                            onyomiTimerRef.current = null
                          }

                          setShowOnyomi(!showOnyomi)

                          // Set new timer only if revealing
                          if (!showOnyomi) {
                            onyomiTimerRef.current = setTimeout(() => {
                              setShowOnyomi(false)
                              onyomiTimerRef.current = null
                            }, 5000) // Increased to 5 seconds
                          }
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-blue-100 dark:bg-blue-900/30
                                 hover:bg-blue-200 dark:hover:bg-blue-900/40
                                 transition-all transform active:scale-95
                                 border border-blue-200 dark:border-blue-800"
                      >
                        {showOnyomi ? (
                          <div className="flex flex-wrap gap-2 justify-center items-center">
                            {kanji.onyomi.filter(r => r).map((reading, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <AudioButton
                                  size="sm"
                                  onPlay={() => {
                                    // Reset timer when playing audio
                                    if (onyomiTimerRef.current) {
                                      clearTimeout(onyomiTimerRef.current)
                                      onyomiTimerRef.current = setTimeout(() => {
                                        setShowOnyomi(false)
                                        onyomiTimerRef.current = null
                                      }, 5000)
                                    }
                                    handlePlayAudio(reading)
                                  }}
                                />
                                <span className="text-lg font-semibold text-blue-700 dark:text-blue-400">
                                  {reading}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-blue-600/60 dark:text-blue-500/60">
                            Tap to reveal
                          </span>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Kunyomi pill */}
                  {kanji.kunyomi && kanji.kunyomi.length > 0 && kanji.kunyomi[0] !== '' && (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Kun'yomi</div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()

                          // Clear existing timer
                          if (kunyomiTimerRef.current) {
                            clearTimeout(kunyomiTimerRef.current)
                            kunyomiTimerRef.current = null
                          }

                          setShowKunyomi(!showKunyomi)

                          // Set new timer only if revealing
                          if (!showKunyomi) {
                            kunyomiTimerRef.current = setTimeout(() => {
                              setShowKunyomi(false)
                              kunyomiTimerRef.current = null
                            }, 5000) // Increased to 5 seconds
                          }
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-green-100 dark:bg-green-900/30
                                 hover:bg-green-200 dark:hover:bg-green-900/40
                                 transition-all transform active:scale-95
                                 border border-green-200 dark:border-green-800"
                      >
                        {showKunyomi ? (
                          <div className="flex flex-wrap gap-2 justify-center items-center">
                            {kanji.kunyomi.filter(r => r).map((reading, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <AudioButton
                                  size="sm"
                                  onPlay={() => {
                                    // Reset timer when playing audio
                                    if (kunyomiTimerRef.current) {
                                      clearTimeout(kunyomiTimerRef.current)
                                      kunyomiTimerRef.current = setTimeout(() => {
                                        setShowKunyomi(false)
                                        kunyomiTimerRef.current = null
                                      }, 5000)
                                    }
                                    handlePlayAudio(reading)
                                  }}
                                />
                                <span className="text-lg font-semibold text-green-700 dark:text-green-400">
                                  {reading}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-green-600/60 dark:text-green-500/60">
                            Tap to reveal
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Stroke order animation button in bottom right */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowStrokeOrderModal(true)
                  }}
                  className="absolute bottom-6 right-6 p-3 rounded-xl
                           bg-blue-100 dark:bg-blue-900/30
                           hover:bg-blue-200 dark:hover:bg-blue-900/40
                           border border-blue-200 dark:border-blue-800
                           transition-all transform hover:scale-105 active:scale-95"
                  title="Stroke Order Animation"
                >
                  <svg className="w-6 h-6 text-blue-700 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                <p className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-xs text-gray-400 dark:text-gray-600">
                  Tap to flip
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>


      {/* Action Buttons - Examples button is now independent */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
        <button
          onClick={handleSkip}
          className="px-6 py-3 min-w-[120px] rounded-xl bg-gray-100 dark:bg-dark-700
                   hover:bg-gray-200 dark:hover:bg-dark-600 transition-all
                   transform hover:scale-105 active:scale-95"
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            {strings?.review?.kanji?.study?.skip || 'Skip'}
          </span>
        </button>

        <button
          onClick={() => setShowExamplesModal(true)}
          className="px-6 py-3 min-w-[120px] rounded-xl bg-purple-100 dark:bg-purple-900/30
                   hover:bg-purple-200 dark:hover:bg-purple-900/40
                   border border-purple-200 dark:border-purple-800
                   transition-all transform hover:scale-105 active:scale-95"
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 text-purple-700 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {strings?.review?.kanji?.study?.examples || 'Examples'}
          </span>
        </button>

        <button
          onClick={handleMarkAsLearned}
          className="px-6 py-3 min-w-[120px] rounded-xl bg-green-500 text-white
                   hover:bg-green-600 transition-all shadow-lg
                   transform hover:scale-105 active:scale-95"
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {strings?.review?.kanji?.study?.markAsLearned || 'Mark as Learned'}
          </span>
        </button>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between w-full max-w-2xl mt-8">
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          ← Back to Characters
        </button>

        {totalKanji > 1 && (
          <div className="flex items-center gap-4">
            <button
              onClick={onPrevious}
              className="p-2 rounded-lg bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={onNext}
              className="p-2 rounded-lg bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <ExamplesModal
        kanji={kanji.kanji}
        examples={kanji.examples || []}
        isOpen={showExamplesModal}
        onClose={() => setShowExamplesModal(false)}
      />

      <StrokeOrderModal
        character={kanji.kanji}
        isOpen={showStrokeOrderModal}
        onClose={() => setShowStrokeOrderModal(false)}
      />
    </div>
  )
}