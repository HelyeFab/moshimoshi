'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'
import AudioButton from '@/components/ui/AudioButton'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { useTTS } from '@/hooks/useTTS'
import { textbookVocabularyProgressManager } from '@/utils/textbookVocabularyProgressManager'

export interface VocabularyItem {
  id: string
  japanese: string
  reading: string
  meaning: string
  jlptLevel?: string
  partOfSpeech?: string[]
  examples?: Array<{
    japanese: string
    reading?: string
    english: string
  }>
  lesson?: number
  chapter?: number
  textbook?: string
}

interface TextbookVocabularyStudyModeProps {
  vocabulary: VocabularyItem
  onNext: () => void
  onPrevious: () => void
  onBack: () => void
  currentIndex: number
  totalItems: number
  onProgressUpdate?: (vocabId: string, updates?: Partial<any>) => void
}

export default function TextbookVocabularyStudyMode({
  vocabulary,
  onNext,
  onPrevious,
  onBack,
  currentIndex,
  totalItems,
  onProgressUpdate,
}: TextbookVocabularyStudyModeProps) {
  const { t } = useI18n()
  const { showToast } = useToast()
  const { user } = useAuth()
  const { isPremium } = useSubscription()
  const [isFlipped, setIsFlipped] = useState(false)
  const [hasTrackedView, setHasTrackedView] = useState(false)
  const { play, preload, loading: ttsLoading, playing: ttsPlaying, currentText } = useTTS({ cacheFirst: true })

  // Interactive pill states
  const [showMeaning, setShowMeaning] = useState(false)
  const [showReading, setShowReading] = useState(false)
  const [showExamples, setShowExamples] = useState(false)

  // Tatoeba example sentences
  const [tatoebaSentences, setTatoebaSentences] = useState<Array<{ japanese: string; english: string }>>([])
  const [loadingTatoeba, setLoadingTatoeba] = useState(false)

  // Timer refs for auto-hide
  const meaningTimerRef = useRef<NodeJS.Timeout | null>(null)
  const readingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const examplesTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Track vocabulary view when component mounts or vocab changes
  useEffect(() => {
    const trackView = async () => {
      if (vocabulary && user && user.uid && !hasTrackedView) {
        await textbookVocabularyProgressManager.trackVocabView(
          vocabulary.id,
          user,
          isPremium ?? false,
          {
            textbook: vocabulary.textbook,
            lesson: vocabulary.lesson,
            chapter: vocabulary.chapter
          }
        )
        onProgressUpdate?.(vocabulary.id, { status: 'learning' })
        setHasTrackedView(true)
      }
    }
    trackView()
  }, [vocabulary.id, user, hasTrackedView, isPremium, onProgressUpdate])

  // Fetch Tatoeba example sentences
  useEffect(() => {
    const fetchTatoebaSentences = async () => {
      if (!vocabulary?.japanese) return

      setLoadingTatoeba(true)
      try {
        const response = await fetch(`/api/tatoeba/search?kanji=${encodeURIComponent(vocabulary.japanese)}&limit=2`)
        if (response.ok) {
          const data = await response.json()
          setTatoebaSentences(data.sentences || [])
        }
      } catch (error) {
        console.error('Failed to fetch Tatoeba sentences:', error)
        setTatoebaSentences([])
      } finally {
        setLoadingTatoeba(false)
      }
    }

    fetchTatoebaSentences()
  }, [vocabulary?.japanese])

  // Reset state when vocabulary changes
  useEffect(() => {
    // Clear any existing timers
    if (meaningTimerRef.current) {
      clearTimeout(meaningTimerRef.current)
      meaningTimerRef.current = null
    }
    if (readingTimerRef.current) {
      clearTimeout(readingTimerRef.current)
      readingTimerRef.current = null
    }
    if (examplesTimerRef.current) {
      clearTimeout(examplesTimerRef.current)
      examplesTimerRef.current = null
    }

    setIsFlipped(false)
    setHasTrackedView(false)
    setShowMeaning(false)
    setShowReading(false)
    setShowExamples(false)

    // Preload TTS for vocabulary
    const textsToPreload: string[] = [vocabulary.japanese]
    if (vocabulary.reading && vocabulary.reading !== vocabulary.japanese) {
      textsToPreload.push(vocabulary.reading)
    }

    if (textsToPreload.length > 0) {
      preload(textsToPreload, {
        voice: 'ja-JP',
        rate: 0.9,
        pitch: 1.0
      })
    }
  }, [vocabulary.id])

  const handlePlayAudio = async (text: string) => {
    try {
      await play(text, {
        voice: 'ja-JP',
        rate: 0.9,
        pitch: 1.0,
        volume: 1.0
      })
    } catch (error) {
      console.error('TTS playback failed:', error)

      // Fallback to browser speech synthesis
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
      textbookVocabularyProgressManager
        .markVocabLearned(vocabulary.id, user, isPremium ?? false, {
          textbook: vocabulary.textbook,
          lesson: vocabulary.lesson,
          chapter: vocabulary.chapter
        })
        .then(() => onProgressUpdate?.(vocabulary.id, { status: 'learned' }))
        .catch(err => console.error('[TextbookVocabularyStudyMode] Failed to mark learned:', err))
    }
    showToast('Marked as learned!', 'success')
    setTimeout(onNext, 500)
  }

  // Check if reading differs from japanese (worth showing separately)
  const hasDistinctReading = vocabulary.reading && vocabulary.reading !== vocabulary.japanese

  // Check if word contains kanji
  const hasKanji = /[\u4e00-\u9faf]/.test(vocabulary.japanese)

  return (
    <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center p-4">
      {/* Progress Indicator */}
      <div className="w-full max-w-2xl mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {currentIndex} / {totalItems}
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {vocabulary.textbook && `${vocabulary.textbook}`}
            {vocabulary.lesson && ` - Lesson ${vocabulary.lesson}`}
            {vocabulary.chapter && ` - Chapter ${vocabulary.chapter}`}
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-300"
            style={{ width: `${(currentIndex / totalItems) * 100}%` }}
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
                {/* Audio Icon - Top Left */}
                <div className="absolute top-4 left-4">
                  <AudioButton
                    size="sm"
                    onPlay={() => handlePlayAudio(vocabulary.japanese)}
                  />
                </div>

                {/* JLPT Level Badge - Top Right */}
                {vocabulary.jlptLevel && (
                  <div className="absolute top-4 right-4 px-2 py-1 rounded-full
                                bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400
                                text-xs font-medium">
                    {vocabulary.jlptLevel}
                  </div>
                )}

                {/* Japanese Word Display */}
                <div
                  className={`font-bold text-gray-800 dark:text-gray-200 mb-4 text-center ${
                    vocabulary.japanese.length > 6 ? 'text-4xl md:text-5xl' : 'text-5xl md:text-6xl'
                  }`}
                  style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
                >
                  {vocabulary.japanese}
                </div>

                {/* Reading (if different from japanese) */}
                {hasDistinctReading && (
                  <div className="text-xl text-gray-500 dark:text-gray-400 mb-2"
                       style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                    {vocabulary.reading}
                  </div>
                )}

                {/* Part of speech tags */}
                {vocabulary.partOfSpeech && vocabulary.partOfSpeech.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {vocabulary.partOfSpeech.map((pos, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 text-xs rounded-full
                                 bg-gray-100 dark:bg-dark-700
                                 text-gray-600 dark:text-gray-400"
                      >
                        {pos}
                      </span>
                    ))}
                  </div>
                )}

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
                className="absolute inset-0 bg-white dark:bg-dark-800
                         rounded-2xl shadow-2xl border-2 border-gray-200 dark:border-dark-600
                         p-6 overflow-y-auto"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
              >
                {/* Japanese word in top-right corner */}
                <div
                  className="absolute top-4 right-4 text-2xl font-bold text-gray-800 dark:text-gray-200"
                  style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
                >
                  {vocabulary.japanese}
                </div>

                {/* Can you recall header */}
                <div className="space-y-4 mt-8">
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                    Can you recall:
                  </h3>

                  {/* Meaning pill */}
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600 dark:text-gray-300">Meaning</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (meaningTimerRef.current) {
                          clearTimeout(meaningTimerRef.current)
                          meaningTimerRef.current = null
                        }
                        setShowMeaning(!showMeaning)
                        if (!showMeaning) {
                          meaningTimerRef.current = setTimeout(() => {
                            setShowMeaning(false)
                            meaningTimerRef.current = null
                          }, 5000)
                        }
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-red-100 dark:bg-red-950
                               hover:bg-red-200 dark:hover:bg-red-900
                               transition-all transform active:scale-95
                               border border-red-200 dark:border-red-700 text-left"
                    >
                      <AnimatePresence mode="wait">
                        {showMeaning ? (
                          <motion.span
                            key="meaning"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-red-700 dark:text-red-300 font-medium"
                          >
                            {vocabulary.meaning}
                          </motion.span>
                        ) : (
                          <motion.span
                            key="hidden"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-sm text-red-600/70 dark:text-dark-200"
                          >
                            Tap to reveal
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  </div>

                  {/* Reading pill (only if kanji present) */}
                  {hasKanji && hasDistinctReading && (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                        Reading
                        <AudioButton
                          size="sm"
                          onPlay={() => handlePlayAudio(vocabulary.reading)}
                        />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (readingTimerRef.current) {
                            clearTimeout(readingTimerRef.current)
                            readingTimerRef.current = null
                          }
                          setShowReading(!showReading)
                          if (!showReading) {
                            readingTimerRef.current = setTimeout(() => {
                              setShowReading(false)
                              readingTimerRef.current = null
                            }, 5000)
                          }
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-blue-100 dark:bg-blue-950
                                 hover:bg-blue-200 dark:hover:bg-blue-900
                                 transition-all transform active:scale-95
                                 border border-blue-200 dark:border-blue-700 text-left"
                      >
                        <AnimatePresence mode="wait">
                          {showReading ? (
                            <motion.span
                              key="reading"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="text-blue-700 dark:text-blue-300 font-medium"
                              style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
                            >
                              {vocabulary.reading}
                            </motion.span>
                          ) : (
                            <motion.span
                              key="hidden"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="text-sm text-blue-600/70 dark:text-dark-200"
                            >
                              Tap to reveal
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </button>
                    </div>
                  )}

                  {/* Examples pill */}
                  {vocabulary.examples && vocabulary.examples.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600 dark:text-gray-300">Example</div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (examplesTimerRef.current) {
                            clearTimeout(examplesTimerRef.current)
                            examplesTimerRef.current = null
                          }
                          setShowExamples(!showExamples)
                          if (!showExamples) {
                            examplesTimerRef.current = setTimeout(() => {
                              setShowExamples(false)
                              examplesTimerRef.current = null
                            }, 8000)
                          }
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-green-100 dark:bg-green-950
                                 hover:bg-green-200 dark:hover:bg-green-900
                                 transition-all transform active:scale-95
                                 border border-green-200 dark:border-green-700 text-left"
                      >
                        <AnimatePresence mode="wait">
                          {showExamples ? (
                            <motion.div
                              key="examples"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="text-green-700 dark:text-green-300"
                            >
                              <div
                                className="font-medium mb-1"
                                style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
                              >
                                {vocabulary.examples[0].japanese}
                              </div>
                              <div className="text-sm text-green-600 dark:text-green-400">
                                {vocabulary.examples[0].english}
                              </div>
                            </motion.div>
                          ) : (
                            <motion.span
                              key="hidden"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="text-sm text-green-600/70 dark:text-dark-200"
                            >
                              Tap to reveal
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </button>
                    </div>
                  )}

                  {/* Tatoeba Example Sentences */}
                  {tatoebaSentences.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                        Example Sentences
                        <span className="text-xs text-gray-400 dark:text-gray-500">(Tatoeba)</span>
                      </div>
                      <div className="space-y-2">
                        {tatoebaSentences.map((sentence, idx) => (
                          <div
                            key={idx}
                            className="px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50
                                     border border-indigo-200 dark:border-indigo-800"
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-1">
                                <div
                                  className="text-indigo-800 dark:text-indigo-200 font-medium mb-1"
                                  style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
                                >
                                  {sentence.japanese}
                                </div>
                                <div className="text-sm text-indigo-600 dark:text-indigo-400">
                                  {sentence.english}
                                </div>
                              </div>
                              <AudioButton
                                size="sm"
                                onPlay={() => handlePlayAudio(sentence.japanese)}
                                loading={ttsLoading && currentText === sentence.japanese}
                                playing={ttsPlaying && currentText === sentence.japanese}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {loadingTatoeba && (
                    <div className="text-center text-sm text-gray-400 dark:text-gray-500 mt-4">
                      Loading example sentences...
                    </div>
                  )}
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Navigation Controls */}
      <div className="w-full max-w-2xl mt-8 flex flex-col gap-4">
        {/* Primary actions */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={handleMarkAsLearned}
            className="px-6 py-3 rounded-xl bg-green-500 hover:bg-green-600
                     text-white font-medium transition-all
                     shadow-lg shadow-green-500/30"
          >
            Mark as Learned
          </button>
          <button
            onClick={handleSkip}
            className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-dark-700
                     hover:bg-gray-200 dark:hover:bg-dark-600
                     text-gray-600 dark:text-gray-400 font-medium transition-all"
          >
            Skip
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onPrevious}
            disabled={currentIndex <= 1}
            className="p-3 rounded-xl bg-gray-100 dark:bg-dark-700
                     hover:bg-gray-200 dark:hover:bg-dark-600 transition-all
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={onBack}
            className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-dark-700
                     hover:bg-gray-200 dark:hover:bg-dark-600
                     text-gray-600 dark:text-gray-400 font-medium transition-all"
          >
            Exit Study
          </button>

          <button
            onClick={onNext}
            disabled={currentIndex >= totalItems}
            className="p-3 rounded-xl bg-gray-100 dark:bg-dark-700
                     hover:bg-gray-200 dark:hover:bg-dark-600 transition-all
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
