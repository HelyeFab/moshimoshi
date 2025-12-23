'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Volume2,
  X,
  BookMarked,
  Settings
} from 'lucide-react'
import { LoadingOverlay } from '@/components/ui/Loading'
import DoshiMascot from '@/components/ui/DoshiMascot'
import Navbar from '@/components/layout/Navbar'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useCachedEpisode } from '@/hooks/useComicCache'
import { ComicEpisode } from '@/types/comic'
import { ReadingSettings } from '@/types/story'
import { useWordExplanation } from '@/hooks/useWordExplanation'
import WordExplanationModal from '@/components/word/WordExplanationModal'
import { QuizPlayer } from '@/components/quiz/QuizPlayer'
import { RubyText } from '@/components/quiz/RubyText'
import ComicSettingsModal from '@/components/comics/ComicSettingsModal'
import { GrammarHighlightedText } from '@/components/reading/GrammarHighlightedText'

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
  const [showSettings, setShowSettings] = useState(false)

  // Reading settings for furigana, font size, etc.
  const [settings, setSettings] = useState<ReadingSettings>({
    fontSize: 'medium',
    showFurigana: true,
    highlightVocabulary: false,
    highlightMode: 'none',
    darkMode: false,
    translationMode: 'off',
    translationProvider: 'ai',
    showTranslationConfidence: false,
    preserveGrammarStructure: false,
    includeGrammarNotes: false,
    autoAddToVocabulary: false,
    highlightGrammar: false,
    shadowingMode: false,
  })

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [wordModalOpen, setWordModalOpen] = useState(false)
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [wordContext, setWordContext] = useState<string | undefined>(undefined)

  const {
    explainWord,
    loading: wordLoading,
    error: wordError,
    explanation: wordExplanation,
    reset: resetWordExplanation,
    prefetch: prefetchWordExplanations,
  } = useWordExplanation({ comicId: episodeId })

  // Log cache status in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && episode) {
      console.log(`[ComicReaderPage] Episode loaded ${fromCache ? 'from cache' : 'from network'}:`, episodeId)
    }
  }, [episode, fromCache, episodeId])

  // Prefetch word explanations for this comic episode (all panels + vocabulary examples)
  useEffect(() => {
    if (!episode) return
    const panelText = episode.panels
      ?.map(panel => [
        ...(panel.dialogues?.map(d => d.textJa) || []),
        panel.narration?.textJa || '',
      ].filter(Boolean).join(' ')) || []
    const vocabExamples = episode.vocabulary?.map(v => v.exampleFromComic || v.word) || []
    const fullText = [...panelText, ...vocabExamples].join(' ')

    if (fullText.trim().length > 0) {
      prefetchWordExplanations({
        contentId: episodeId,
        contentType: 'comic',
        text: fullText,
      })
    }
  }, [episode, episodeId, prefetchWordExplanations])

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

  const handleWordLookup = async (word: string, event?: React.MouseEvent, context?: string) => {
    const clean = word?.trim()
    if (!clean) return
    setSelectedWord(clean)
    setWordContext(context)
    setWordModalOpen(true)
    await explainWord(clean, context)
  }

  const handleCloseWordModal = () => {
    setWordModalOpen(false)
    setSelectedWord(null)
    setWordContext(undefined)
    resetWordExplanation()
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
  const handleQuizComplete = (score: number, xpEarned: number) => {
    console.log('[Comic Quiz] Completed:', { score, xpEarned })
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
      {/* Desktop Navbar */}
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      {/* Floating Header - Glassmorphism Design */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-4 sm:top-24 left-4 right-4 z-50"
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

              {/* Settings Icon - Opens CompactSettingsToolbar */}
              <div className="flex items-center gap-1">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2.5 rounded-xl transition-all ${showSettings
                    ? 'bg-primary-500/20 text-primary-400 ring-1 ring-primary-500/50'
                    : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700/50'
                    }`}
                  title="Reading settings"
                >
                  <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
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
                {/* Narration Box - Above the image */}
                {currentPanel.narration?.textJa && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-dark-800/80 dark:to-dark-800/60 backdrop-blur-lg rounded-xl border border-amber-200/50 dark:border-dark-700/50"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded text-xs font-semibold">
                        Narration
                      </span>
                    </div>
                    <div className="text-gray-800 dark:text-white font-japanese text-base leading-relaxed">
                      {(() => {
                        // Get the raw Japanese text for grammar highlighting
                        const rawText = currentPanel.narration.textJa

                        // If grammar highlighting is enabled, use GrammarHighlightedText
                        if (settings.highlightGrammar) {
                          return (
                            <>
                              「
                              <GrammarHighlightedText
                                text={rawText}
                                highlightMode={settings.highlightMode}
                                showFurigana={settings.showFurigana}
                                onWordClick={(word, event) => handleWordLookup(word, event, rawText)}
                                className="inline text-gray-800 dark:text-white"
                              />
                              」
                            </>
                          )
                        }

                        // Otherwise use RubyText with pre-generated ruby tags
                        const text = currentPanel.narration.furigana || currentPanel.narration.textJa
                        const hasRuby = text.includes('<ruby>')
                        return hasRuby ? (
                          <>
                            「
                            <RubyText
                              text={text}
                              showFurigana={settings.showFurigana}
                              className="inline text-gray-800 dark:text-white"
                            />
                            」
                          </>
                        ) : (
                          <span>「{text}」</span>
                        )
                      })()}
                    </div>
                    {showTranslation && currentPanel.narration.textEn && (
                      <p className="text-gray-500 dark:text-dark-400 text-sm mt-2 italic">
                        {currentPanel.narration.textEn}
                      </p>
                    )}
                  </motion.div>
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

                {/* Dialogue Cards - Below the image */}
                {currentPanel.dialogues && currentPanel.dialogues.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {currentPanel.dialogues.map((dialogue, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 + 0.2 }}
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
                            <div className="font-japanese text-gray-900 dark:text-white text-base sm:text-lg leading-relaxed">
                              {(() => {
                                // Get the raw Japanese text for grammar highlighting
                                const rawText = dialogue.textJa

                                // If grammar highlighting is enabled, use GrammarHighlightedText
                                if (settings.highlightGrammar) {
                                  return (
                                    <GrammarHighlightedText
                                      text={rawText}
                                      highlightMode={settings.highlightMode}
                                      showFurigana={settings.showFurigana}
                                      onWordClick={(word, event) => handleWordLookup(word, event, rawText)}
                                      className="text-gray-900 dark:text-white"
                                    />
                                  )
                                }

                                // Otherwise use RubyText with pre-generated ruby tags
                                const text = dialogue.furigana || dialogue.textJa
                                const hasRuby = text.includes('<ruby>')
                                return hasRuby ? (
                                  <RubyText
                                    text={text}
                                    showFurigana={settings.showFurigana}
                                    className="text-gray-900 dark:text-white"
                                  />
                                ) : (
                                  <span>{text}</span>
                                )
                              })()}
                            </div>
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
                  <span>Take Quiz</span>
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
                        <button
                          onClick={() => handleWordLookup(vocab.word, undefined, vocab.exampleFromComic || vocab.meaning)}
                          className="flex items-baseline gap-2 mb-2 text-left w-full"
                        >
                          <span className="text-xl font-japanese font-bold text-foreground dark:text-dark-100 hover:text-primary-500">
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
                        </button>
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

      {/* Quiz - Full Page View (matches story quiz) */}
      {showQuiz && episode?.quiz?.questions && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          {/* Desktop Navbar */}
          <div className="hidden sm:block">
            <Navbar user={user} showUserMenu={true} />
          </div>

          <QuizPlayer
            questions={episode.quiz.questions}
            contentType="comic"
            contentId={episodeId}
            contentTitle={`EP ${episode.episodeNumber}: ${episode.title}`}
            onComplete={handleQuizComplete}
            onExit={() => router.push('/comics')}
            onBack={() => setShowQuiz(false)}
            showTranslation={showTranslation}
            enableAutoSave={true}
            showFurigana={settings.showFurigana}
            fontSize={settings.fontSize}
          />
        </div>
      )}

      {/* Word Explanation Modal */}
      <WordExplanationModal
        isOpen={wordModalOpen}
        onClose={handleCloseWordModal}
        word={selectedWord}
        explanation={wordExplanation}
        loading={wordLoading}
        error={wordError}
        translationContext={wordContext ? { sentence: wordContext } : undefined}
        onWordLookup={(w) => handleWordLookup(w, undefined, wordContext)}
      />

      {/* Settings Panel - Comic-specific (only Furigana + Grammar) */}
      <ComicSettingsModal
        settings={settings}
        onSettingsChange={setSettings}
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  )
}
