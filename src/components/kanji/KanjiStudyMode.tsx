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
import Dialog from '@/components/ui/Dialog'
import { kanjiProgressManager } from '@/utils/kanjiProgressManager'
import { useCachedTatoebaSentences } from '@/hooks/useTatoebaCache'
import { useFeature } from '@/hooks/useFeature'
import { IoCheckmarkCircle, IoPlayForward, IoBookOutline, IoClose } from 'react-icons/io5'
import { usePrioritizedKanjiReadings } from '@/hooks/usePrioritizedKanjiReadings'
import type { KanjiStudyCard, StudyMode } from '@/types/kanji-study'
import MeaningCard from './MeaningCard'
import VocabularyCard from './VocabularyCard'
import ReadingSummaryCard from './ReadingSummaryCard'
import ReadingMatchCard from './ReadingMatchCard'

type StudyKanjiStatus = 'not-started' | 'learning' | 'learned'
const REVEAL_AUTO_HIDE_MS = 10000

interface KanjiStudyModeProps {
  kanji: Kanji
  onNext: () => void
  onPrevious: () => void
  onBack: () => void
  currentIndex: number
  totalKanji: number
  onProgressUpdate?: (kanjiId: string, updates?: Partial<any>) => void
  isKanjiLearned?: boolean // Override for kanji from "My Kanji Collection"

  // Card-level context (optional, for vocabulary-first mode)
  // Agent 3 will use these to render different card types
  currentCard?: KanjiStudyCard // Current card being displayed
  studyMode?: StudyMode // 'traditional' | 'vocabulary-first'
  cardIndex?: number // Index of current card within this kanji (0-based)
  totalCards?: number // Total cards for this kanji
  onReadingMatchStarted?: (payload: { kanji: string; pairCount: number }) => void
  onReadingMatchMismatch?: (payload: {
    kanji: string
    word: string
    selectedReading: string
  }) => void
  onReadingMatchCompleted?: (payload: {
    kanji: string
    mismatchCount: number
    durationMs: number
    pairCount: number
  }) => void
}

export default function KanjiStudyMode({
  kanji,
  onNext,
  onPrevious,
  onBack,
  currentIndex,
  totalKanji,
  onProgressUpdate,
  isKanjiLearned,
  // Card context (optional)
  currentCard,
  studyMode = 'traditional',
  cardIndex = 0,
  totalCards = 1,
  onReadingMatchStarted,
  onReadingMatchMismatch,
  onReadingMatchCompleted,
}: KanjiStudyModeProps) {
  const { t, strings } = useI18n()
  const { showToast } = useToast()
  const { user } = useAuth()
  const { isPremium } = useSubscription()
  const {
    onyomi: primaryOnyomi,
    kunyomi: primaryKunyomi,
  } = usePrioritizedKanjiReadings(kanji.kanji, kanji.onyomi || [], kanji.kunyomi || [])
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
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [completedReadingMatchCards, setCompletedReadingMatchCards] = useState<Record<string, true>>({})

  // Entitlement check for drawing practice
  const { checkAndTrack } = useFeature('drawing_practice')

  // Interactive pill states
  const [showMeaning, setShowMeaning] = useState(false)
  const [showOnyomi, setShowOnyomi] = useState(false)
  const [showKunyomi, setShowKunyomi] = useState(false)

  // Track if kanji is already learned
  const [isLearned, setIsLearned] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<StudyKanjiStatus>('not-started')
  const justToggledRef = useRef(false)

  // Timer refs for auto-hide
  const meaningTimerRef = useRef<NodeJS.Timeout | null>(null)
  const onyomiTimerRef = useRef<NodeJS.Timeout | null>(null)
  const kunyomiTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Check if kanji is already learned when kanji changes
  useEffect(() => {
    const checkLearnedStatus = async () => {
      // Don't override if we just toggled the status manually
      if (justToggledRef.current) {
        justToggledRef.current = false
        return
      }

      // If learned status is passed as prop (from "My Kanji Collection"), use it
      if (isKanjiLearned !== undefined) {
        setIsLearned(isKanjiLearned)
        setCurrentStatus(isKanjiLearned ? 'learned' : 'not-started')
        return
      }

      // Otherwise, check Firebase/IndexedDB
      if (user?.uid && kanji) {
        const progress = await kanjiProgressManager.getKanjiProgressItem(
          kanji.kanji,
          user,
          isPremium ?? false
        )
        const status = (progress?.status as StudyKanjiStatus | undefined) || 'not-started'
        setIsLearned(status === 'learned')
        setCurrentStatus(status)
      } else {
        setIsLearned(false)
        setCurrentStatus('not-started')
      }
    }
    checkLearnedStatus()
  }, [kanji?.kanji, user, isKanjiLearned, isPremium])

  // Track kanji view when component mounts or kanji changes
  useEffect(() => {
    const trackView = async () => {
      if (kanji && user && user.uid && !hasTrackedView) {
        await kanjiProgressManager.trackKanjiView(
          kanji.kanji,
          user,
          isPremium ?? false
        )
        setCurrentStatus(prev => (prev === 'learned' ? prev : 'learning'))
        onProgressUpdate?.(kanji.kanji)
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

  useEffect(() => {
    if (!tatoebaData?.sentences || tatoebaData.sentences.length === 0) return
    const texts = tatoebaData.sentences
      .map(sentence => sentence.japanese)
      .filter(Boolean)
      .slice(0, 5)
    if (texts.length > 0) {
      preload(texts, { voice: '23', speed: 0.85 })
    }
  }, [tatoebaData, preload])

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
    if (
      studyMode === 'vocabulary-first' &&
      currentCard?.type === 'reading-match' &&
      !completedReadingMatchCards[currentCard.id]
    ) {
      return
    }
    onNext()
  }

  const handleReadingMatchCompleted = (cardId: string) => {
    setCompletedReadingMatchCards(prev => {
      if (prev[cardId]) return prev
      return { ...prev, [cardId]: true }
    })
  }

  const handleToggleLearned = async () => {
    if (!user) {
      showToast('Please sign in to track progress', 'warning')
      return
    }

    if (isLearned) {
      // Show confirmation dialog before removing from collection
      setShowRemoveDialog(true)
    } else {
      // Mark as learned (no confirmation needed)
      justToggledRef.current = true
      try {
        await kanjiProgressManager.markKanjiLearned(kanji.kanji, user, isPremium ?? false)
        if (isPremium) {
          await kanjiProgressManager.flushKanjiSync()
        }
        setIsLearned(true)
        setCurrentStatus('learned')
        onProgressUpdate?.(kanji.kanji)
        showToast(strings.kana?.messages?.markedAsLearned || 'Marked as learned!', 'success')
        setTimeout(onNext, 500)
      } catch (err) {
        console.error('[KanjiStudyMode] Failed to mark learned:', err)
        justToggledRef.current = false
      }
    }
  }

  const handleConfirmRemove = async () => {
    if (!user) return

    // Mark that we're manually toggling - prevents effect from overwriting
    justToggledRef.current = true

    try {
      await kanjiProgressManager.resetKanjiProgress(kanji.kanji, user, isPremium ?? false)
      if (isPremium) {
        await kanjiProgressManager.flushKanjiSync()
      }
      setIsLearned(false)
      setCurrentStatus('not-started')
      onProgressUpdate?.(kanji.kanji)
      setShowRemoveDialog(false)
      showToast(strings.kana?.messages?.progressReset || 'Progress reset', 'info')
    } catch (err) {
      console.error('[KanjiStudyMode] Failed to reset progress:', err)
      justToggledRef.current = false
    }
  }

  const statusLabel =
    currentStatus === 'learned'
      ? 'Learned'
      : currentStatus === 'learning'
        ? 'Learning'
        : 'Not Started'

  const isReadingMatchCard =
    studyMode === 'vocabulary-first' && currentCard?.type === 'reading-match'
  const isReadingMatchCompleted =
    !isReadingMatchCard || !!(currentCard && completedReadingMatchCards[currentCard.id])
  const isFinalVocabularyFirstCard =
    studyMode === 'vocabulary-first' &&
    currentIndex === totalKanji &&
    (cardIndex ?? 0) === (totalCards ?? 1) - 1

  const hasCardNavigation =
    studyMode === 'vocabulary-first' ? (totalCards ?? 1) > 1 : totalKanji > 1
  const canGoPrevious =
    studyMode === 'vocabulary-first'
      ? hasCardNavigation && (cardIndex ?? 0) > 0
      : totalKanji > 1 && currentIndex > 1
  const canGoNext =
    studyMode === 'vocabulary-first'
      ? hasCardNavigation && (cardIndex ?? 0) < (totalCards ?? 1) - 1 && isReadingMatchCompleted
      : totalKanji > 1 && currentIndex < totalKanji

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 pb-6 relative">
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
      <div className="w-full max-w-2xl mb-4 mt-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {studyMode === 'vocabulary-first' && totalCards !== undefined
              ? (strings.vocabularyFirstStudy?.progress?.cardProgress || 'Card {current} of {total} • Kanji {kanjiCurrent} / {kanjiTotal}')
                  .replace('{current}', ((cardIndex ?? 0) + 1).toString())
                  .replace('{total}', (totalCards ?? 1).toString())
                  .replace('{kanjiCurrent}', currentIndex.toString())
                  .replace('{kanjiTotal}', totalKanji.toString())
              : `${currentIndex} / ${totalKanji}`
            }
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {statusLabel}
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-300"
            style={{
              width: studyMode === 'vocabulary-first' && totalCards !== undefined
                ? `${(((cardIndex ?? 0) + 1) / (totalCards ?? 1)) * 100}%`
                : `${(currentIndex / totalKanji) * 100}%`
            }}
          />
        </div>
      </div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="relative flex-shrink-0"
      >
        {/* Vocabulary-First Mode: Render specific card types */}
        {studyMode === 'vocabulary-first' && currentCard ? (
          <div
            key={currentCard.id}
            className={`relative w-72 sm:w-80 md:w-96 ${
              currentCard.type === 'reading-match'
                ? 'h-[28rem] sm:h-[30rem] md:h-[31rem]'
                : 'h-[24rem] sm:h-[27rem] md:h-[31rem]'
            }`}
          >
            {currentCard.type === 'meaning' && (
              <MeaningCard
                card={currentCard}
                onAudioPlay={handlePlayAudio}
              />
            )}
            {currentCard.type === 'vocabulary' && (
              <VocabularyCard
                card={currentCard}
                onAudioPlay={handlePlayAudio}
              />
            )}
            {currentCard.type === 'reading-summary' && (
              <ReadingSummaryCard
                card={currentCard}
                onAudioPlay={handlePlayAudio}
              />
            )}
            {currentCard.type === 'reading-match' && (
              <ReadingMatchCard
                card={currentCard}
                onStarted={({ pairCount }) =>
                  onReadingMatchStarted?.({
                    kanji: currentCard.kanjiCharacter,
                    pairCount,
                  })
                }
                onMismatch={({ word, selectedReading }) =>
                  onReadingMatchMismatch?.({
                    kanji: currentCard.kanjiCharacter,
                    word,
                    selectedReading,
                  })
                }
                onCompleted={({ mismatchCount, durationMs }) => {
                  handleReadingMatchCompleted(currentCard.id)
                  onReadingMatchCompleted?.({
                    kanji: currentCard.kanjiCharacter,
                    mismatchCount,
                    durationMs,
                    pairCount: currentCard.pairs.length,
                  })
                }}
              />
            )}
          </div>
        ) : (
          /* Traditional Mode: Flip card */
          <div
            className="relative w-72 h-[24rem] sm:w-80 sm:h-[27rem] md:w-96 md:h-[31rem] cursor-pointer"
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
                     style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif' }}>
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
                         p-3 sm:p-4 md:p-5 overflow-y-auto scrollbar-hide"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
              >
                {/* Kanji Badge - Top Center */}
                <div className="flex justify-center mb-2 sm:mb-4">
                  <div className="relative inline-flex items-center gap-2 sm:gap-3 px-3 py-2 sm:px-5 sm:py-2.5
                                bg-white/80 dark:bg-gray-900/50 backdrop-blur-sm
                                rounded-2xl shadow-lg border-2 border-primary-300 dark:border-primary-500/50
                                hover:shadow-xl transition-all duration-200">
                    <div className="text-3xl sm:text-4xl font-bold text-primary-600 dark:text-primary-400"
                         style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif' }}>
                      {kanji.kanji}
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <AudioButton
                        size="sm"
                        onPlay={() => handlePlayAudio(kanji.kanji)}
                      />
                    </div>
                  </div>
                </div>

                {/* Can you recall header */}
                <div className="space-y-2.5 sm:space-y-3">
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <div className="h-1 w-8 bg-primary-400 dark:bg-primary-500 rounded-full"></div>
                    <h3 className="text-sm sm:text-base font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wide">
                      Can you recall
                    </h3>
                    <div className="h-1 flex-1 bg-primary-400 dark:bg-primary-500 rounded-full"></div>
                  </div>

                  {/* Meaning pill */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 px-1">
                      <svg className="w-4 h-4 text-purple-500 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      <span className="text-[11px] sm:text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Meaning</span>
                    </div>
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
                          }, REVEAL_AUTO_HIDE_MS)
                        }
                      }}
                      className="w-full px-3 py-2.5 sm:px-4 sm:py-3 rounded-2xl
                               bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20
                               hover:from-purple-100 hover:to-purple-200 dark:hover:from-purple-900/30 dark:hover:to-purple-800/30
                               transition-all transform active:scale-[0.98] duration-200
                               border-2 border-purple-200 dark:border-purple-700
                               shadow-md hover:shadow-lg text-left
                               relative overflow-hidden group"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
                                    translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                      {showMeaning ? (
                        <span className="text-base sm:text-lg font-bold text-purple-900 dark:text-purple-100 relative z-10">
                          {kanji.meaning}
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-2 relative z-10">
                          <svg className="w-5 h-5 text-purple-400 dark:text-purple-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span className="text-xs sm:text-sm font-semibold text-purple-600 dark:text-purple-400">
                            Tap to reveal
                          </span>
                        </div>
                      )}
                    </button>
                  </div>

                  <div className={`grid gap-2 ${primaryOnyomi.length > 0 && primaryKunyomi.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {primaryOnyomi.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 px-1">
                          <svg className="w-4 h-4 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                          <span className="text-[11px] sm:text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">On'yomi</span>
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation()

                            if (onyomiTimerRef.current) {
                              clearTimeout(onyomiTimerRef.current)
                              onyomiTimerRef.current = null
                            }

                            setShowOnyomi(!showOnyomi)

                            if (!showOnyomi) {
                              onyomiTimerRef.current = setTimeout(() => {
                                setShowOnyomi(false)
                                onyomiTimerRef.current = null
                              }, REVEAL_AUTO_HIDE_MS)
                            }
                          }}
                          className="w-full min-h-[4.5rem] px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-2xl
                                   bg-gradient-to-br from-blue-50 to-sky-100 dark:from-blue-900/20 dark:to-sky-800/20
                                   hover:from-blue-100 hover:to-sky-200 dark:hover:from-blue-900/30 dark:hover:to-sky-800/30
                                   transition-all transform active:scale-[0.98] duration-200
                                   border-2 border-blue-200 dark:border-blue-700
                                   shadow-md hover:shadow-lg cursor-pointer
                                   relative overflow-hidden group"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
                                        translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                          {showOnyomi ? (
                            <div className="grid gap-1.5 relative z-10">
                              {primaryOnyomi.map((reading, idx) => (
                                <div key={idx} className="flex items-center justify-center gap-1.5 px-2 py-1 bg-white/60 dark:bg-gray-900/40 rounded-lg">
                                  <AudioButton
                                    size="sm"
                                    onPlay={() => {
                                      if (onyomiTimerRef.current) {
                                        clearTimeout(onyomiTimerRef.current)
                                        onyomiTimerRef.current = setTimeout(() => {
                                          setShowOnyomi(false)
                                          onyomiTimerRef.current = null
                                        }, REVEAL_AUTO_HIDE_MS)
                                      }
                                      handlePlayAudio(reading)
                                    }}
                                  />
                                  <span className="text-sm sm:text-base font-bold text-blue-900 dark:text-blue-100 leading-none">
                                    {reading}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5 h-full relative z-10">
                              <svg className="w-4 h-4 text-blue-400 dark:text-blue-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              <span className="text-[11px] sm:text-sm font-semibold text-blue-600 dark:text-blue-400 text-center">
                                Tap to reveal
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {primaryKunyomi.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 px-1">
                          <svg className="w-4 h-4 text-emerald-500 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                          <span className="text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Kun'yomi</span>
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation()

                            if (kunyomiTimerRef.current) {
                              clearTimeout(kunyomiTimerRef.current)
                              kunyomiTimerRef.current = null
                            }

                            setShowKunyomi(!showKunyomi)

                            if (!showKunyomi) {
                              kunyomiTimerRef.current = setTimeout(() => {
                                setShowKunyomi(false)
                                kunyomiTimerRef.current = null
                              }, REVEAL_AUTO_HIDE_MS)
                            }
                          }}
                          className="w-full min-h-[4.5rem] px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-2xl
                                   bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-900/20 dark:to-green-800/20
                                   hover:from-emerald-100 hover:to-green-200 dark:hover:from-emerald-900/30 dark:hover:to-green-800/30
                                   transition-all transform active:scale-[0.98] duration-200
                                   border-2 border-emerald-200 dark:border-emerald-700
                                   shadow-md hover:shadow-lg cursor-pointer
                                   relative overflow-hidden group"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
                                        translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                          {showKunyomi ? (
                            <div className="grid gap-1.5 relative z-10">
                              {primaryKunyomi.map((reading, idx) => (
                                <div key={idx} className="flex items-center justify-center gap-1.5 px-2 py-1 bg-white/60 dark:bg-gray-900/40 rounded-lg">
                                  <AudioButton
                                    size="sm"
                                    onPlay={() => {
                                      if (kunyomiTimerRef.current) {
                                        clearTimeout(kunyomiTimerRef.current)
                                        kunyomiTimerRef.current = setTimeout(() => {
                                          setShowKunyomi(false)
                                          kunyomiTimerRef.current = null
                                        }, REVEAL_AUTO_HIDE_MS)
                                      }
                                      handlePlayAudio(reading)
                                    }}
                                  />
                                  <span className="text-sm sm:text-base font-bold text-emerald-900 dark:text-emerald-100 leading-none">
                                    {reading}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5 h-full relative z-10">
                              <svg className="w-4 h-4 text-emerald-400 dark:text-emerald-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              <span className="text-[11px] sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 text-center">
                                Tap to reveal
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}
      </motion.div>


      {/* Action Buttons - Icon only */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
        <button
          onClick={handleSkip}
          disabled={isReadingMatchCard && !isReadingMatchCompleted}
          className={`p-4 rounded-xl
                   transition-all transform hover:scale-105 active:scale-95 disabled:bg-gray-100/60 disabled:dark:bg-dark-700/60 disabled:text-gray-400 disabled:dark:text-gray-600 disabled:cursor-not-allowed disabled:hover:scale-100"
            ${
              isFinalVocabularyFirstCard
                ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30'
                : 'bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-600 dark:text-gray-400'
            }`}
          title={
            isReadingMatchCard && !isReadingMatchCompleted
              ? 'Complete matching first'
              : isFinalVocabularyFirstCard
                ? 'Finish session'
                : 'Skip'
          }
        >
          {isFinalVocabularyFirstCard ? (
            <IoCheckmarkCircle className="w-6 h-6" />
          ) : (
            <IoPlayForward className="w-6 h-6" />
          )}
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
          onClick={handleToggleLearned}
          className={`p-4 rounded-xl text-white transition-all shadow-lg
                   transform hover:scale-105 active:scale-95 ${
                     isLearned
                       ? 'bg-green-500 hover:bg-green-600 shadow-green-500/30'
                       : 'bg-gray-400 hover:bg-gray-500 shadow-gray-400/30'
                   }`}
          title={isLearned ? 'Reset Progress' : 'Mark as Learned'}
        >
          <IoCheckmarkCircle className="w-6 h-6" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4 w-full max-w-2xl mt-3">
        <button
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className={`p-3 rounded-xl transition-all transform active:scale-95 ${
            canGoPrevious
              ? 'bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 hover:scale-105'
              : 'bg-gray-100/60 dark:bg-dark-700/60 text-gray-400 dark:text-gray-600 cursor-not-allowed'
          }`}
          title="Previous"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={onNext}
          disabled={!canGoNext}
          className={`p-3 rounded-xl transition-all transform active:scale-95 ${
            canGoNext
              ? 'bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 hover:scale-105'
              : 'bg-gray-100/60 dark:bg-dark-700/60 text-gray-400 dark:text-gray-600 cursor-not-allowed'
          }`}
          title="Next"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

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

      {/* Remove from Collection Confirmation Dialog */}
      <Dialog
        isOpen={showRemoveDialog}
        onClose={() => setShowRemoveDialog(false)}
        onConfirm={handleConfirmRemove}
        title={strings.kanjiBrowser?.collection?.confirmRemoveTitle || 'Remove from Collection?'}
        message={strings.kanjiBrowser?.collection?.confirmRemoveMessage || 'Are you sure you want to remove this kanji from your learned collection? This will reset all progress for this kanji.'}
        confirmText={strings.kanjiBrowser?.collection?.confirmRemoveButton || 'Remove'}
        cancelText={strings.common?.cancel || 'Cancel'}
        type="warning"
      />
    </div>
  )
}
