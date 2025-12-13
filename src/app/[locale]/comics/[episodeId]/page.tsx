'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  BookOpen,
  X,
  Trophy,
  CheckCircle,
  XCircle,
  Sparkles,
  BookMarked,
  Star
} from 'lucide-react'
import { LoadingOverlay } from '@/components/ui/Loading'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useCachedEpisode } from '@/hooks/useComicCache'
import { ComicEpisode } from '@/types/comic'

export default function ComicReaderPage() {
  const { strings } = useI18n()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const episodeId = params?.episodeId as string

  // Use cache-first episode loading
  const { episode: cachedEpisode, loading, error, fromCache } = useCachedEpisode(episodeId)
  // Cast to ComicEpisode for component compatibility
  const episode = cachedEpisode as ComicEpisode | null

  const [currentPanelIndex, setCurrentPanelIndex] = useState(0)
  const [showTranslation, setShowTranslation] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [showVocabulary, setShowVocabulary] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [quizAnswers, setQuizAnswers] = useState<number[]>([])
  const [quizScore, setQuizScore] = useState<number | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Log cache status in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && episode) {
      console.log(`[ComicReaderPage] Episode loaded ${fromCache ? 'from cache' : 'from network'}:`, episodeId)
    }
  }, [episode, fromCache, episodeId])

  const currentPanel = episode?.panels?.[currentPanelIndex]
  const totalPanels = episode?.panels?.length || 0

  const goToNextPanel = () => {
    if (currentPanelIndex < totalPanels - 1) {
      setCurrentPanelIndex(prev => prev + 1)
    }
  }

  const goToPrevPanel = () => {
    if (currentPanelIndex > 0) {
      setCurrentPanelIndex(prev => prev - 1)
    }
  }

  const playDialogueAudio = (audioUrl: string) => {
    if (!audioEnabled || !audioUrl) return

    if (audioRef.current) {
      audioRef.current.pause()
    }

    audioRef.current = new Audio(audioUrl)
    audioRef.current.play().catch(err => console.error('Audio playback error:', err))
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        goToNextPanel()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPrevPanel()
      } else if (e.key === 'Escape') {
        router.push('/comics')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPanelIndex, totalPanels, router])

  // Quiz handlers
  const handleQuizAnswer = (questionIndex: number, answerIndex: number) => {
    const newAnswers = [...quizAnswers]
    newAnswers[questionIndex] = answerIndex
    setQuizAnswers(newAnswers)
  }

  const handleQuizSubmit = () => {
    const questions = episode?.quiz?.questions || []
    if (quizAnswers.length !== questions.length) return

    let correctAnswers = 0
    questions.forEach((question: any, index: number) => {
      if (quizAnswers[index] === question.correctAnswer) {
        correctAnswers++
      }
    })

    const score = Math.round((correctAnswers / questions.length) * 100)
    setQuizScore(score)
  }

  const isLastPanel = currentPanelIndex === totalPanels - 1
  const hasQuiz = episode?.quiz?.questions && episode.quiz.questions.length > 0

  // Show loading state while auth is loading or content is loading
  if (authLoading || loading) {
    return <LoadingOverlay isLoading={true} message="Loading episode..." />
  }

  if (error || !episode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-950 dark:via-dark-900 dark:to-dark-850">
        <div className="text-center px-4">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-primary-400/20 rounded-full blur-3xl scale-150" />
            <div className="relative">
              <DoshiMascot size="large" variant="static" mood="sad" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2 text-foreground dark:text-dark-100">
            {error || 'Episode not found'}
          </h2>
          <p className="text-muted-foreground dark:text-dark-400 mb-6">
            We couldn't find this episode. It may have been moved or removed.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/comics')}
            className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-semibold shadow-lg shadow-primary-500/25 transition-all"
          >
            Back to Comics
          </motion.button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-950 via-dark-900 to-dark-850">
      {/* Floating Header - Glassmorphism Design */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-4 left-4 right-4 z-50"
      >
        <div className="max-w-3xl mx-auto">
          <div className="bg-dark-900/70 backdrop-blur-xl border border-dark-700/50 rounded-2xl px-4 py-3 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              {/* Back Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push('/comics')}
                className="flex items-center gap-2 text-dark-300 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="hidden sm:inline text-sm font-medium">Back</span>
              </motion.button>

              {/* Episode Title */}
              <div className="flex-1 text-center min-w-0">
                <h1 className="text-white font-semibold text-sm sm:text-base truncate">
                  EP {episode.episodeNumber}: {episode.title}
                </h1>
                <p className="text-dark-400 text-xs font-japanese truncate">{episode.titleJa}</p>
              </div>

              {/* Control Toggles */}
              <div className="flex items-center gap-1">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowTranslation(!showTranslation)}
                  className={`p-2.5 rounded-xl transition-all ${showTranslation
                    ? 'bg-primary-500/20 text-primary-400 ring-1 ring-primary-500/50'
                    : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700/50'
                    }`}
                  title="Toggle translation"
                >
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setAudioEnabled(!audioEnabled)}
                  className={`p-2.5 rounded-xl transition-all ${audioEnabled
                    ? 'bg-primary-500/20 text-primary-400 ring-1 ring-primary-500/50'
                    : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700/50'
                    }`}
                  title="Toggle audio"
                >
                  {audioEnabled ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />}
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Comic Panel Area */}
      <div className="min-h-screen flex items-center justify-center pt-24 pb-64 sm:pb-40 px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPanelIndex}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative w-full max-w-3xl mx-auto"
          >
            {currentPanel && (
              <div className="relative">
                {/* Dialogue Cards - Above the image */}
                {currentPanel.dialogues && currentPanel.dialogues.length > 0 && (
                  <div className="mb-4 space-y-3">
                    {currentPanel.dialogues.map((dialogue, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white dark:bg-dark-800 rounded-xl p-4 shadow-lg border border-gray-100 dark:border-dark-700"
                      >
                        <div className="flex items-start gap-3">
                          {/* Character info and text */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-2.5 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-lg text-xs font-bold">
                                {dialogue.characterName}
                              </span>
                              {dialogue.emotion && (
                                <span className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-dark-400 rounded text-xs">
                                  {dialogue.emotion}
                                </span>
                              )}
                            </div>
                            {/* Japanese text */}
                            <p className="font-japanese text-gray-900 dark:text-white text-base sm:text-lg leading-relaxed">
                              {dialogue.furigana || dialogue.textJa}
                            </p>
                            {/* English translation */}
                            {showTranslation && dialogue.textEn && (
                              <p className="text-gray-500 dark:text-dark-400 text-sm mt-2">
                                {dialogue.textEn}
                              </p>
                            )}
                          </div>
                          {/* Audio button */}
                          <motion.button
                            whileHover={audioEnabled && dialogue.audioUrl ? { scale: 1.1 } : {}}
                            whileTap={audioEnabled && dialogue.audioUrl ? { scale: 0.9 } : {}}
                            onClick={() => dialogue.audioUrl && playDialogueAudio(dialogue.audioUrl)}
                            disabled={!audioEnabled || !dialogue.audioUrl}
                            className={`flex-shrink-0 p-3 rounded-xl transition-all ${
                              audioEnabled && dialogue.audioUrl
                                ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-900/60'
                                : 'bg-gray-100 dark:bg-dark-700 text-gray-400 dark:text-dark-500 cursor-not-allowed'
                            }`}
                          >
                            <Volume2 className="w-5 h-5" />
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Panel Image - Premium Card Design */}
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10">
                  {currentPanel.imageUrl ? (
                    <Image
                      src={currentPanel.imageUrl}
                      alt={`Panel ${currentPanelIndex + 1}`}
                      fill
                      className="object-cover"
                      priority
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-100 via-primary-50 to-orange-50 dark:from-primary-900/40 dark:via-dark-800 dark:to-orange-900/20">
                      <DoshiMascot size="xlarge" variant="animated" />
                    </div>
                  )}

                  {/* Sound Effects - Keep on image */}
                  {currentPanel.soundEffects?.map((effect, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: -15 }}
                      className="absolute text-2xl sm:text-3xl font-bold text-white font-japanese pointer-events-none"
                      style={{
                        left: `${effect.position?.x || 50}%`,
                        top: `${effect.position?.y || 50}%`,
                        transform: 'translate(-50%, -50%)',
                        textShadow: '0 0 20px rgba(0,0,0,0.8), 2px 2px 4px rgba(0,0,0,0.9)',
                        WebkitTextStroke: '1px rgba(0,0,0,0.3)',
                      }}
                    >
                      {effect.textJa}
                    </motion.div>
                  ))}

                  {/* Panel number indicator */}
                  <div className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full text-white/80 text-xs font-medium">
                    {currentPanelIndex + 1} / {totalPanels}
                  </div>
                </div>

                {/* Narration Box - Below the image */}
                {currentPanel.narration?.textJa && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-dark-800/80 dark:to-dark-800/60 backdrop-blur-lg rounded-xl border border-amber-200/50 dark:border-dark-700/50"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded text-xs font-semibold">
                        Narration
                      </span>
                    </div>
                    <p className="text-gray-800 dark:text-white font-japanese text-base leading-relaxed">
                      「{currentPanel.narration.textJa}」
                    </p>
                    {showTranslation && currentPanel.narration.textEn && (
                      <p className="text-gray-500 dark:text-dark-400 text-sm mt-2 italic">
                        {currentPanel.narration.textEn}
                      </p>
                    )}
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation - Floating Pill Design */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-36 sm:bottom-8 left-4 right-4 z-50"
      >
        <div className="max-w-2xl mx-auto">
          <div className="bg-dark-900/80 backdrop-blur-xl border border-dark-700/50 rounded-2xl p-4 shadow-xl">
            {/* Progress Bar - Gradient Fill */}
            <div className="h-1.5 bg-dark-700 rounded-full mb-4 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${((currentPanelIndex + 1) / totalPanels) * 100}%` }}
                transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              {/* Previous Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={goToPrevPanel}
                disabled={currentPanelIndex === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-dark-700/50 text-white rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-dark-600/50 transition-all font-medium"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Previous</span>
              </motion.button>

              {/* Center Controls */}
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowVocabulary(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/20 text-amber-300 rounded-xl hover:bg-amber-500/30 transition-all font-medium ring-1 ring-amber-500/30"
                >
                  <BookMarked className="w-4 h-4" />
                  <span className="hidden sm:inline">Vocabulary</span>
                </motion.button>
              </div>

              {/* Next/Quiz Button */}
              {isLastPanel && hasQuiz ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowQuiz(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all font-medium shadow-lg shadow-emerald-500/20"
                >
                  <Trophy className="w-5 h-5" />
                  <span className="hidden sm:inline">Take Quiz</span>
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={goToNextPanel}
                  disabled={isLastPanel}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:from-primary-600 hover:to-primary-700 transition-all font-medium shadow-lg shadow-primary-500/20"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-5 h-5" />
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Vocabulary Panel - Premium Modal */}
      <AnimatePresence>
        {showVocabulary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center"
            onClick={() => setShowVocabulary(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-dark-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl"
            >
              {/* Header with gradient */}
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <BookMarked className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white">
                        Episode Vocabulary
                      </h3>
                      <p className="text-white/80 text-sm">
                        {episode.vocabulary?.length || 0} words to learn
                      </p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowVocabulary(false)}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </motion.button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 overflow-y-auto max-h-[60vh] scrollbar-hide">
                {episode.vocabulary && episode.vocabulary.length > 0 ? (
                  <div className="space-y-3">
                    {episode.vocabulary.map((vocab, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl border border-gray-100 dark:border-dark-600 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-xl font-japanese font-bold text-foreground dark:text-dark-100">
                            {vocab.word}
                          </span>
                          <span className="text-sm text-primary-600 dark:text-primary-400 font-medium">
                            ({vocab.reading})
                          </span>
                          {vocab.jlptLevel && (
                            <span className="ml-auto px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs font-medium">
                              {vocab.jlptLevel}
                            </span>
                          )}
                        </div>
                        <p className="text-foreground dark:text-dark-200 mb-2">{vocab.meaning}</p>
                        {vocab.exampleFromComic && (
                          <div className="pt-2 border-t border-gray-200 dark:border-dark-600">
                            <p className="text-sm text-muted-foreground dark:text-dark-400 font-japanese">
                              「{vocab.exampleFromComic}」
                            </p>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="relative inline-block mb-4">
                      <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-2xl scale-150" />
                      <DoshiMascot size="large" variant="static" mood="thinking" />
                    </div>
                    <p className="text-muted-foreground dark:text-dark-400">
                      No vocabulary for this episode yet.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quiz Modal - Premium Design */}
      <AnimatePresence>
        {showQuiz && episode?.quiz?.questions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center"
            onClick={() => setShowQuiz(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-dark-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl"
            >
              {/* Header with gradient */}
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white">
                        Episode Quiz
                      </h3>
                      <p className="text-white/80 text-sm">
                        {episode.quiz.questions.length} questions
                      </p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowQuiz(false)}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </motion.button>
                </div>
              </div>

              <div className="p-5 overflow-y-auto max-h-[70vh] scrollbar-hide">
                {quizScore === null ? (
                  <div className="space-y-6">
                    {episode.quiz.questions.map((question: any, qIndex: number) => (
                      <motion.div
                        key={qIndex}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: qIndex * 0.1 }}
                        className="space-y-3"
                      >
                        <div className="flex items-start gap-3">
                          <span className="inline-flex items-center justify-center w-7 h-7 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg text-sm font-bold flex-shrink-0">
                            {qIndex + 1}
                          </span>
                          <div>
                            <p className="font-medium text-foreground dark:text-dark-100">
                              {question.questionJa || question.questionEn}
                            </p>
                            {question.questionEn && question.questionJa && (
                              <p className="text-sm text-muted-foreground dark:text-dark-400 mt-1">
                                {question.questionEn}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2 ml-10">
                          {question.options?.map((option: string, oIndex: number) => (
                            <motion.label
                              key={oIndex}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              className={`flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-all ${quizAnswers[qIndex] === oIndex
                                ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500 shadow-sm'
                                : 'bg-gray-50 dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600'
                                }`}
                            >
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${quizAnswers[qIndex] === oIndex
                                ? 'border-primary-500 bg-primary-500'
                                : 'border-gray-300 dark:border-dark-500'
                                }`}>
                                {quizAnswers[qIndex] === oIndex && (
                                  <div className="w-2 h-2 bg-white rounded-full" />
                                )}
                              </div>
                              <span className="text-foreground dark:text-dark-100">{option}</span>
                            </motion.label>
                          ))}
                        </div>
                      </motion.div>
                    ))}

                    <div className="flex gap-3 pt-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowQuiz(false)}
                        className="flex-1 px-4 py-3 rounded-xl bg-gray-100 dark:bg-dark-700 text-foreground dark:text-dark-100 hover:bg-gray-200 dark:hover:bg-dark-600 transition-all font-medium"
                      >
                        Review Episode
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleQuizSubmit}
                        disabled={quizAnswers.length !== episode.quiz.questions.length}
                        className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold shadow-lg shadow-primary-500/20"
                      >
                        Submit Answers
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-6">
                    {/* Score display with animation */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                      className="relative inline-block"
                    >
                      <div className="text-7xl mb-2">
                        {quizScore >= 80 ? '🎉' : quizScore >= 60 ? '👍' : '💪'}
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-6 h-6 ${quizScore >= star * 20
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-gray-300 dark:text-dark-600'
                              }`}
                          />
                        ))}
                      </div>
                    </motion.div>

                    <div>
                      <h3 className="text-2xl font-bold text-foreground dark:text-dark-100">
                        {quizScore >= 80
                          ? 'Excellent!'
                          : quizScore >= 60
                            ? 'Good job!'
                            : 'Keep practicing!'}
                      </h3>
                      <p className="text-3xl font-bold text-primary-600 dark:text-primary-400 mt-2">
                        {quizScore}%
                      </p>
                    </div>

                    <div className="space-y-3 text-left">
                      {episode.quiz.questions.map((question: any, index: number) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + index * 0.1 }}
                          className={`p-4 rounded-xl ${quizAnswers[index] === question.correctAnswer
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50'
                            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50'
                            }`}
                        >
                          <p className="font-medium text-foreground dark:text-dark-100 mb-2 text-sm">
                            {index + 1}. {question.questionJa || question.questionEn}
                          </p>
                          <div className="flex items-center gap-2">
                            {quizAnswers[index] === question.correctAnswer ? (
                              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            )}
                            <span
                              className={`text-sm ${quizAnswers[index] === question.correctAnswer
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-red-700 dark:text-red-400'
                                }`}
                            >
                              {question.options[quizAnswers[index]]}
                            </span>
                          </div>
                          {quizAnswers[index] !== question.correctAnswer && (
                            <p className="text-emerald-600 dark:text-emerald-400 mt-1 ml-6 text-sm">
                              ✓ {question.options[question.correctAnswer]}
                            </p>
                          )}
                          {question.explanation && (
                            <p className="text-xs text-muted-foreground dark:text-dark-400 mt-2 ml-6 italic">
                              {question.explanation}
                            </p>
                          )}
                        </motion.div>
                      ))}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setQuizAnswers([])
                          setQuizScore(null)
                        }}
                        className="flex-1 px-4 py-3 rounded-xl bg-gray-100 dark:bg-dark-700 text-foreground dark:text-dark-100 hover:bg-gray-200 dark:hover:bg-dark-600 transition-all font-medium"
                      >
                        Try Again
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => router.push('/comics')}
                        className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 transition-all font-semibold shadow-lg shadow-primary-500/20"
                      >
                        Back to Comics
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
