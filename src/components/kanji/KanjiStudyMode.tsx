'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Kanji } from '@/types/kanji'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'
import AudioButton from '@/components/ui/AudioButton'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { useTTS } from '@/hooks/useTTS'
import ExamplesModal from './ExamplesModal'
import StrokeOrderModal from './StrokeOrderModal'
import DrawingPracticeModal from '@/components/drawing-practice/DrawingPracticeModal'
import { kanjiProgressManager } from '@/utils/kanjiProgressManager'
import { useCachedTatoebaSentences } from '@/hooks/useTatoebaCache'
import { useFeature } from '@/hooks/useFeature'
import { IoCheckmarkCircle, IoPlayForward, IoBookOutline, IoClose } from 'react-icons/io5'

interface KanjiStudyModeProps {
  kanji: Kanji
  onNext: () => void
  onPrevious: () => void
  onBack: () => void
  currentIndex: number
  totalKanji: number
  onProgressUpdate?: (kanjiId: string, updates?: Partial<any>) => void
}

export default function KanjiStudyMode({
  kanji,
  onNext,
  onPrevious,
  onBack,
  currentIndex,
  totalKanji,
  onProgressUpdate,
}: KanjiStudyModeProps) {
  const { t, strings } = useI18n()
  const { showToast } = useToast()
  const { user } = useAuth()
  const { isPremium } = useSubscription()
  const [isFlipped, setIsFlipped] = useState(false)
  const [hasTrackedView, setHasTrackedView] = useState(false)
  const { play, preload, loading: ttsLoading } = useTTS({ cacheFirst: true })

  // Fetch Tatoeba sentences with caching
  const {
    data: tatoebaData,
    loading: tatoebLoading,
  } = useCachedTatoebaSentences(kanji.kanji)

  // Modal states
  const [showExamplesModal, setShowExamplesModal] = useState(false)
  const [showStrokeOrderModal, setShowStrokeOrderModal] = useState(false)
  const [showDrawingPractice, setShowDrawingPractice] = useState(false)

  // Entitlement check for drawing practice
  const { checkAndTrack } = useFeature('drawing_practice')

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
        await kanjiProgressManager.trackKanjiView(
          kanji.kanji,
          user,
          isPremium ?? false
        )
        onProgressUpdate?.(kanji.kanji, { status: 'learning' })
        setHasTrackedView(true)
      }
    }
    trackView()
  }, [kanji.kanji, user, hasTrackedView, isPremium, onProgressUpdate])


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
    if (user) {
      kanjiProgressManager
        .markKanjiLearned(kanji.kanji, user, isPremium ?? false)
        .then(() => onProgressUpdate?.(kanji.kanji, { status: 'learned' }))
        .catch(err => console.error('[KanjiStudyMode] Failed to mark learned:', err))
    }
    showToast('Marked as learned!', 'success')
    setTimeout(onNext, 500)
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center p-4 relative">
      {/* Exit Button - Top Right */}
      <button
        onClick={onBack}
        className="absolute top-4 right-4 p-3 rounded-xl bg-gray-100 dark:bg-dark-700
                 hover:bg-gray-200 dark:hover:bg-dark-600
                 text-gray-600 dark:text-gray-400
                 transition-all transform hover:scale-105 active:scale-95 z-10"
        title="Exit Study"
      >
        <IoClose className="w-6 h-6" />
      </button>

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

                {/* Practice button - Top Right (first button) */}
                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    console.log('[KanjiStudyMode] Checking drawing_practice entitlement...')
                    const allowed = await checkAndTrack({ showUI: true })
                    console.log('[KanjiStudyMode] checkAndTrack result:', allowed)
                    if (allowed) {
                      setShowDrawingPractice(true)
                    } else {
                      console.log('[KanjiStudyMode] Access denied, modal should NOT open')
                    }
                  }}
                  className="absolute top-4 right-16 p-2.5 rounded-full
                           bg-green-50 dark:bg-green-900/20
                           hover:bg-green-100 dark:hover:bg-green-900/30
                           transition-all transform hover:scale-110 active:scale-95
                           text-green-500 dark:text-green-400 z-10"
                  title="Practice writing"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>

                {/* Stroke order animation button - Top Right */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowStrokeOrderModal(true)
                  }}
                  className="absolute top-4 right-4 p-2.5 rounded-full
                           bg-red-50 dark:bg-red-900/20
                           hover:bg-red-100 dark:hover:bg-red-900/30
                           transition-all transform hover:scale-110 active:scale-95
                           text-red-500 dark:text-red-400 z-10"
                  title="Watch stroke order"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

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
                         dark:bg-gradient-to-br dark:from-surface-dark dark:to-background-darkElevated
                         rounded-2xl shadow-2xl border-2 border-primary-200 dark:border-primary-400
                         p-8 overflow-y-auto scrollbar-hide"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
              >
                {/* Kanji in top-right corner */}
                <div className="absolute top-6 right-6 text-5xl font-bold text-gray-800 dark:text-gray-200"
                     style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                  {kanji.kanji}
                </div>

                {/* Can you recall header */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                    Can you recall:
                  </h3>

                  {/* Meaning pill */}
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600 dark:text-gray-300">Meaning</div>
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
                      className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800
                               hover:bg-slate-200 dark:hover:bg-slate-700
                               transition-all transform active:scale-95
                               border border-slate-200 dark:border-slate-600 text-left"
                    >
                      {showMeaning ? (
                        <span className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                          {kanji.meaning}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          Tap to reveal
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Onyomi pill */}
                  {kanji.onyomi && kanji.onyomi.length > 0 && kanji.onyomi[0] !== '' && (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600 dark:text-gray-300">On'yomi</div>
                      <div
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
                        className="w-full px-4 py-3 rounded-xl bg-sky-50 dark:bg-sky-900/30
                                 hover:bg-sky-100 dark:hover:bg-sky-900/50
                                 transition-all transform active:scale-95
                                 border border-sky-200 dark:border-sky-800 cursor-pointer"
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
                                <span className="text-lg font-semibold text-sky-800 dark:text-sky-200">
                                  {reading}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-sky-600 dark:text-sky-400">
                            Tap to reveal
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Kunyomi pill */}
                  {kanji.kunyomi && kanji.kunyomi.length > 0 && kanji.kunyomi[0] !== '' && (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600 dark:text-gray-300">Kun'yomi</div>
                      <div
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
                        className="w-full px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30
                                 hover:bg-emerald-100 dark:hover:bg-emerald-900/50
                                 transition-all transform active:scale-95
                                 border border-emerald-200 dark:border-emerald-800 cursor-pointer"
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
                                <span className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
                                  {reading}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-emerald-600 dark:text-emerald-400">
                            Tap to reveal
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>


      {/* Action Buttons - Icon only */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
        <button
          onClick={handleSkip}
          className="p-4 rounded-xl bg-gray-100 dark:bg-dark-700
                   hover:bg-gray-200 dark:hover:bg-dark-600
                   text-gray-600 dark:text-gray-400
                   transition-all transform hover:scale-105 active:scale-95"
          title="Skip"
        >
          <IoPlayForward className="w-6 h-6" />
        </button>

        <button
          onClick={() => setShowExamplesModal(true)}
          className="p-4 rounded-xl bg-purple-100 dark:bg-purple-900/30
                   hover:bg-purple-200 dark:hover:bg-purple-900/40
                   border border-purple-200 dark:border-purple-800
                   text-purple-700 dark:text-purple-400
                   transition-all transform hover:scale-105 active:scale-95"
          title="Examples"
        >
          <IoBookOutline className="w-6 h-6" />
        </button>

        <button
          onClick={handleMarkAsLearned}
          className="p-4 rounded-xl bg-green-500 text-white
                   hover:bg-green-600 transition-all shadow-lg shadow-green-500/30
                   transform hover:scale-105 active:scale-95"
          title="Mark as Learned"
        >
          <IoCheckmarkCircle className="w-6 h-6" />
        </button>
      </div>

      {/* Navigation */}
      {totalKanji > 1 && (
        <div className="flex items-center justify-center gap-4 w-full max-w-2xl mt-8">
          <button
            onClick={onPrevious}
            className="p-3 rounded-xl bg-gray-100 dark:bg-dark-700
                     hover:bg-gray-200 dark:hover:bg-dark-600
                     transition-all transform hover:scale-105 active:scale-95"
            title="Previous"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={onNext}
            className="p-3 rounded-xl bg-gray-100 dark:bg-dark-700
                     hover:bg-gray-200 dark:hover:bg-dark-600
                     transition-all transform hover:scale-105 active:scale-95"
            title="Next"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Modals */}
      <ExamplesModal
        kanji={kanji.kanji}
        sentences={tatoebaData?.sentences || []}
        furiganaTexts={tatoebaData?.furiganaTexts || {}}
        isOpen={showExamplesModal}
        onClose={() => setShowExamplesModal(false)}
        loading={tatoebLoading}
      />

      <StrokeOrderModal
        character={kanji.kanji}
        isOpen={showStrokeOrderModal}
        onClose={() => setShowStrokeOrderModal(false)}
      />

      {/* Drawing Practice Modal */}
      {showDrawingPractice && (
        <DrawingPracticeModal
          character={kanji.kanji}
          isOpen={showDrawingPractice}
          onClose={() => setShowDrawingPractice(false)}
          characterType="kanji"
        />
      )}
    </div>
  )
}
