'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Volume2, VolumeX, BookOpen, X, Trophy, CheckCircle, XCircle } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import { LoadingOverlay } from '@/components/ui/Loading'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { ComicEpisode, ComicPanel, PanelDialogue } from '@/types/comic'

export default function ComicReaderPage() {
  const { strings } = useI18n()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const episodeId = params?.episodeId as string

  const [episode, setEpisode] = useState<ComicEpisode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPanelIndex, setCurrentPanelIndex] = useState(0)
  const [showTranslation, setShowTranslation] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [showVocabulary, setShowVocabulary] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [quizAnswers, setQuizAnswers] = useState<number[]>([])
  const [quizScore, setQuizScore] = useState<number | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    async function loadEpisode() {
      if (!episodeId) return

      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/comics/episodes/${episodeId}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError('Episode not found')
          } else {
            throw new Error('Failed to load episode')
          }
          return
        }

        const data = await response.json()
        setEpisode(data.episode)
      } catch (err) {
        console.error('Error loading episode:', err)
        setError('Failed to load episode')
      } finally {
        setLoading(false)
      }
    }

    loadEpisode()
  }, [episodeId])

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-orange-50 dark:from-dark-900 dark:to-dark-850">
        <div className="text-center">
          <DoshiMascot size="large" variant="static" mood="sad" />
          <h2 className="text-xl font-semibold mt-4 text-foreground dark:text-dark-100">
            {error || 'Episode not found'}
          </h2>
          <button
            onClick={() => router.push('/comics')}
            className="mt-4 px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition"
          >
            Back to Comics
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/comics')}
            className="flex items-center gap-2 text-white/80 hover:text-white transition"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="text-center">
            <h1 className="text-white font-semibold text-sm sm:text-base">
              EP {episode.episodeNumber}: {episode.title}
            </h1>
            <p className="text-white/60 text-xs font-japanese">{episode.titleJa}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTranslation(!showTranslation)}
              className={`p-2 rounded-lg transition ${
                showTranslation ? 'bg-white/20 text-white' : 'text-white/50'
              }`}
              title="Toggle translation"
            >
              <BookOpen className="w-5 h-5" />
            </button>
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`p-2 rounded-lg transition ${
                audioEnabled ? 'bg-white/20 text-white' : 'text-white/50'
              }`}
              title="Toggle audio"
            >
              {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Comic Panel */}
      <div className="min-h-screen flex items-center justify-center pt-16 pb-48 sm:pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPanelIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-2xl mx-auto px-4"
          >
            {currentPanel && (
              <div className="relative">
                {/* Panel Image */}
                <div className="relative aspect-[3/4] bg-gray-900 rounded-lg overflow-hidden shadow-2xl">
                  {currentPanel.imageUrl ? (
                    <Image
                      src={currentPanel.imageUrl}
                      alt={`Panel ${currentPanelIndex + 1}`}
                      fill
                      className="object-cover"
                      priority
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-rose-100 to-orange-100 dark:from-rose-900/30 dark:to-orange-900/30">
                      <DoshiMascot size="xlarge" variant="animated" />
                    </div>
                  )}

                  {/* Speech Bubbles Overlay */}
                  {currentPanel.dialogues?.map((dialogue, idx) => (
                    <SpeechBubble
                      key={idx}
                      dialogue={dialogue}
                      showTranslation={showTranslation}
                      onPlay={() => playDialogueAudio(dialogue.audioUrl || '')}
                      audioEnabled={audioEnabled}
                    />
                  ))}

                  {/* Sound Effects */}
                  {currentPanel.soundEffects?.map((effect, idx) => (
                    <div
                      key={idx}
                      className="absolute text-2xl font-bold text-white drop-shadow-lg font-japanese"
                      style={{
                        left: `${effect.position?.x || 50}%`,
                        top: `${effect.position?.y || 50}%`,
                        transform: 'translate(-50%, -50%) rotate(-15deg)',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                      }}
                    >
                      {effect.textJa}
                    </div>
                  ))}
                </div>

                {/* Narration */}
                {currentPanel.narration?.textJa && (
                  <div className="mt-4 p-4 bg-white/10 backdrop-blur rounded-lg">
                    <p className="text-white font-japanese text-lg text-center">
                      {currentPanel.narration.textJa}
                    </p>
                    {showTranslation && currentPanel.narration.textEn && (
                      <p className="text-white/70 text-sm text-center mt-2">
                        {currentPanel.narration.textEn}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation - with safe area for mobile navbar */}
      <div className="fixed bottom-24 sm:bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/90 to-transparent">
        <div className="container mx-auto px-4 py-4">
          {/* Progress Bar */}
          <div className="h-1 bg-white/20 rounded-full mb-4 overflow-hidden">
            <div
              className="h-full bg-rose-500 transition-all duration-300"
              style={{ width: `${((currentPanelIndex + 1) / totalPanels) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={goToPrevPanel}
              disabled={currentPanelIndex === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/20 transition"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Previous</span>
            </button>

            <div className="flex items-center gap-4">
              <span className="text-white/80 text-sm">
                {currentPanelIndex + 1} / {totalPanels}
              </span>
              <button
                onClick={() => setShowVocabulary(true)}
                className="px-4 py-2 bg-amber-500/80 text-white rounded-lg hover:bg-amber-500 transition text-sm"
              >
                Vocabulary
              </button>
            </div>

            {isLastPanel && hasQuiz ? (
              <button
                onClick={() => setShowQuiz(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition"
              >
                <Trophy className="w-5 h-5" />
                <span className="hidden sm:inline">Take Quiz</span>
              </button>
            ) : (
              <button
                onClick={goToNextPanel}
                disabled={isLastPanel}
                className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-rose-600 transition"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Vocabulary Panel */}
      <AnimatePresence>
        {showVocabulary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => setShowVocabulary(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-dark-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
                <h3 className="font-semibold text-lg text-foreground dark:text-dark-100">
                  Episode Vocabulary
                </h3>
                <button
                  onClick={() => setShowVocabulary(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {episode.vocabulary && episode.vocabulary.length > 0 ? (
                  <div className="space-y-3">
                    {episode.vocabulary.map((vocab, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-lg font-japanese font-bold text-foreground dark:text-dark-100">
                            {vocab.word}
                          </span>
                          <span className="text-sm text-muted-foreground dark:text-dark-400">
                            ({vocab.reading})
                          </span>
                        </div>
                        <p className="text-foreground dark:text-dark-100">{vocab.meaning}</p>
                        {vocab.exampleFromComic && (
                          <p className="text-sm text-muted-foreground dark:text-dark-400 mt-1 font-japanese">
                            "{vocab.exampleFromComic}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground dark:text-dark-400 py-8">
                    No vocabulary for this episode yet.
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quiz Modal */}
      <AnimatePresence>
        {showQuiz && episode?.quiz?.questions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => setShowQuiz(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-dark-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
                <h3 className="font-semibold text-lg text-foreground dark:text-dark-100 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Episode Quiz
                </h3>
                <button
                  onClick={() => setShowQuiz(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[70vh] scrollbar-hide">
                {quizScore === null ? (
                  <div className="space-y-6">
                    {episode.quiz.questions.map((question: any, qIndex: number) => (
                      <div key={qIndex} className="space-y-3">
                        <p className="font-medium text-foreground dark:text-dark-100">
                          {qIndex + 1}. {question.questionJa || question.questionEn}
                        </p>
                        {question.questionEn && question.questionJa && (
                          <p className="text-sm text-muted-foreground dark:text-dark-400">
                            {question.questionEn}
                          </p>
                        )}
                        <div className="space-y-2">
                          {question.options?.map((option: string, oIndex: number) => (
                            <label
                              key={oIndex}
                              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                                quizAnswers[qIndex] === oIndex
                                  ? 'bg-rose-100 dark:bg-rose-900/30 border-2 border-rose-500'
                                  : 'bg-gray-50 dark:bg-dark-700 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-dark-600'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`question-${qIndex}`}
                                checked={quizAnswers[qIndex] === oIndex}
                                onChange={() => handleQuizAnswer(qIndex, oIndex)}
                                className="w-4 h-4 accent-rose-500"
                              />
                              <span className="text-foreground dark:text-dark-100">{option}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => setShowQuiz(false)}
                        className="flex-1 px-4 py-2 rounded-xl bg-gray-200 dark:bg-dark-700 text-foreground dark:text-dark-100 hover:bg-gray-300 dark:hover:bg-dark-600 transition"
                      >
                        Review Episode
                      </button>
                      <button
                        onClick={handleQuizSubmit}
                        disabled={quizAnswers.length !== episode.quiz.questions.length}
                        className="flex-1 px-4 py-2 rounded-xl bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        Submit Answers
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="text-6xl mb-4">
                      {quizScore >= 80 ? '🎉' : quizScore >= 60 ? '👍' : '💪'}
                    </div>
                    <h3 className="text-2xl font-bold text-foreground dark:text-dark-100">
                      {quizScore >= 80
                        ? 'Excellent!'
                        : quizScore >= 60
                          ? 'Good job!'
                          : 'Keep practicing!'}
                    </h3>
                    <p className="text-xl text-foreground dark:text-dark-100">
                      Your Score: {quizScore}%
                    </p>

                    <div className="space-y-3 mt-6 text-left">
                      {episode.quiz.questions.map((question: any, index: number) => (
                        <div
                          key={index}
                          className="p-4 rounded-xl bg-gray-50 dark:bg-dark-700"
                        >
                          <p className="font-medium text-foreground dark:text-dark-100 mb-2">
                            {index + 1}. {question.questionJa || question.questionEn}
                          </p>
                          <div className="flex items-center gap-2">
                            {quizAnswers[index] === question.correctAnswer ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-500" />
                            )}
                            <span
                              className={
                                quizAnswers[index] === question.correctAnswer
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-red-600 dark:text-red-400'
                              }
                            >
                              Your answer: {question.options[quizAnswers[index]]}
                            </span>
                          </div>
                          {quizAnswers[index] !== question.correctAnswer && (
                            <p className="text-green-600 dark:text-green-400 mt-1 ml-7">
                              Correct: {question.options[question.correctAnswer]}
                            </p>
                          )}
                          {question.explanation && (
                            <p className="text-sm text-muted-foreground dark:text-dark-400 mt-2 ml-7">
                              {question.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => {
                          setQuizAnswers([])
                          setQuizScore(null)
                        }}
                        className="flex-1 px-4 py-2 rounded-xl bg-gray-200 dark:bg-dark-700 text-foreground dark:text-dark-100 hover:bg-gray-300 dark:hover:bg-dark-600 transition"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={() => router.push('/comics')}
                        className="flex-1 px-4 py-2 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition"
                      >
                        Back to Comics
                      </button>
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

// Speech Bubble Component
function SpeechBubble({
  dialogue,
  showTranslation,
  onPlay,
  audioEnabled,
}: {
  dialogue: PanelDialogue
  showTranslation: boolean
  onPlay: () => void
  audioEnabled: boolean
}) {
  const getBubbleStyle = () => {
    switch (dialogue.bubbleStyle) {
      case 'thought':
        return 'rounded-2xl border-2 border-dashed border-rose-400'
      case 'shout':
        return 'rounded-2xl border-4 border-rose-500'
      case 'whisper':
        return 'rounded-2xl border-2 border-rose-300 opacity-90'
      default:
        return 'rounded-2xl border-2 border-rose-400'
    }
  }

  // Anchor bubble to top of image with small margin
  const xPosition = dialogue.bubblePosition?.x || 50

  return (
    <div
      className={`absolute top-2 bg-white/95 backdrop-blur-sm p-2 sm:p-3 shadow-lg max-w-[80%] sm:max-w-[60%] cursor-pointer ${getBubbleStyle()}`}
      style={{
        left: `${xPosition}%`,
        transform: 'translateX(-50%)',
      }}
      onClick={() => audioEnabled && onPlay()}
    >
      {/* Character name */}
      <div className="text-xs text-rose-500 font-medium mb-1">{dialogue.characterName}</div>

      {/* Japanese text */}
      <p className="font-japanese text-gray-900 text-sm leading-relaxed">
        {dialogue.furigana || dialogue.textJa}
      </p>

      {/* English translation */}
      {showTranslation && dialogue.textEn && (
        <p className="text-gray-500 text-xs mt-1 border-t border-gray-200 pt-1">{dialogue.textEn}</p>
      )}

      {/* Audio indicator */}
      {audioEnabled && dialogue.audioUrl && (
        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center">
          <Volume2 className="w-3 h-3 text-white" />
        </div>
      )}

      {/* Speech bubble tail */}
      <div
        className="absolute w-4 h-4 bg-white/95 rotate-45"
        style={{
          bottom: '-8px',
          left: '20%',
        }}
      />
    </div>
  )
}
