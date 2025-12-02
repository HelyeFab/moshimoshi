'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'
import { useTheme } from '@/lib/theme/ThemeContext'
import { generateFurigana } from '@/utils/furigana'
import { tokenizeSentence, simpleFallbackTokenizer } from './utils/sentenceTokenizer'
import {
  GameState,
  ScrambledSentence,
  WordBlock,
  Sentence,
  GAME_CONSTANTS,
  WORD_BLOCK_COLORS,
  DISTRACTOR_EMOJIS,
  SAMPLE_SENTENCES,
} from './types'
import { X, Play, Clock, Star, RotateCcw, HelpCircle, Volume2 } from 'lucide-react'
import { useTTS } from '@/hooks/useTTS'

interface SentenceScrambleGameProps {
  sentences?: Sentence[]
  onClose?: () => void
  onComplete?: (score: number, accuracy: number) => void
}

export default function SentenceScrambleGame({
  sentences: propSentences,
  onClose,
  onComplete,
}: SentenceScrambleGameProps) {
  const { t, strings } = useI18n()
  const { resolvedTheme } = useTheme()
  const { play: playTTS } = useTTS()

  // Game state
  const [gameState, setGameState] = useState<GameState>({
    phase: 'sentence-selection',
    sentences: [],
    currentSentenceIndex: 0,
    currentSentence: null,
    totalScore: 0,
    totalAttempts: 0,
    gameStartTime: 0,
    timeRemaining: GAME_CONSTANTS.SCRAMBLE_TIME_LIMIT / 1000,
    showDistractors: true,
  })

  // UI state
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [flashTimer, setFlashTimer] = useState(0)
  const [gameTimer, setGameTimer] = useState<NodeJS.Timeout | null>(null)
  const [flashTimerRef, setFlashTimerRef] = useState<NodeJS.Timeout | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [selectedSentences, setSelectedSentences] = useState<Sentence[]>([])

  // Furigana state
  const [showFurigana, setShowFurigana] = useState(false)
  const [furiganaText, setFuriganaText] = useState<string | null>(null)
  const [loadingFurigana, setLoadingFurigana] = useState(false)

  // Initialize with provided sentences or samples
  useEffect(() => {
    if (propSentences && propSentences.length > 0) {
      // If sentences are provided, skip selection and start directly
      setGameState(prev => ({
        ...prev,
        phase: 'instructions',
        sentences: propSentences.slice(0, GAME_CONSTANTS.MAX_SENTENCES_PER_GAME),
      }))
    }
  }, [propSentences])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameTimer) clearInterval(gameTimer)
      if (flashTimerRef) clearInterval(flashTimerRef)
    }
  }, [gameTimer, flashTimerRef])

  // Generate furigana when needed
  useEffect(() => {
    const generateFuriganaText = async () => {
      if (!showFurigana || furiganaText || gameState.phase !== 'sentence-flash') return

      const currentSentence = gameState.sentences[gameState.currentSentenceIndex]
      if (!currentSentence) return

      setLoadingFurigana(true)
      try {
        const generated = await generateFurigana(currentSentence.text)
        setFuriganaText(generated)
      } catch (error) {
        console.error('Failed to generate furigana:', error)
      } finally {
        setLoadingFurigana(false)
      }
    }

    if (showFurigana && gameState.phase === 'sentence-flash') {
      generateFuriganaText()
    }
  }, [
    showFurigana,
    gameState.phase,
    gameState.currentSentenceIndex,
    gameState.sentences,
    furiganaText,
  ])

  const handleSentenceSelection = (sentence: Sentence) => {
    setSelectedSentences(prev => {
      const isSelected = prev.some(s => s.id === sentence.id)
      if (isSelected) {
        return prev.filter(s => s.id !== sentence.id)
      }
      if (prev.length >= GAME_CONSTANTS.MAX_SENTENCES_PER_GAME) {
        return prev
      }
      return [...prev, sentence]
    })
  }

  const startGame = async () => {
    setLoading(true)

    const gameSentences =
      selectedSentences.length > 0 ? selectedSentences : SAMPLE_SENTENCES.slice(0, 5)

    setGameState(prev => ({
      ...prev,
      phase: 'instructions',
      sentences: shuffleArray(gameSentences),
      gameStartTime: Date.now(),
    }))

    setLoading(false)
  }

  const proceedToFlash = () => {
    setGameState(prev => ({ ...prev, phase: 'sentence-flash' }))

    // Reset furigana state
    setShowFurigana(false)
    setFuriganaText(null)

    // Play TTS for the sentence
    const currentSentence = gameState.sentences[gameState.currentSentenceIndex]
    if (currentSentence) {
      playTTS(currentSentence.text)
    }

    // Start flash timer
    setFlashTimer(GAME_CONSTANTS.SENTENCE_FLASH_DURATION)
    const timer = setInterval(() => {
      setFlashTimer(prev => {
        if (prev <= 100) {
          clearInterval(timer)
          setFlashTimerRef(null)
          startCountdown()
          return 0
        }
        return prev - 100
      })
    }, 100)

    setFlashTimerRef(timer)
  }

  const skipFlashAndStartCountdown = () => {
    if (flashTimerRef) {
      clearInterval(flashTimerRef)
      setFlashTimerRef(null)
    }
    setFlashTimer(0)
    startCountdown()
  }

  const startCountdown = () => {
    setGameState(prev => ({ ...prev, phase: 'countdown' }))
    setCountdown(GAME_CONSTANTS.COUNTDOWN_DURATION)

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          startScramblePhase()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const startScramblePhase = async () => {
    const currentSentence = gameState.sentences[gameState.currentSentenceIndex]
    if (!currentSentence) return

    // Create scrambled sentence
    const scrambledSentence = await createScrambledSentence(currentSentence)

    setGameState(prev => ({
      ...prev,
      phase: 'scramble',
      currentSentence: scrambledSentence,
      timeRemaining: GAME_CONSTANTS.SCRAMBLE_TIME_LIMIT / 1000,
    }))

    // Start game timer
    const timer = setInterval(() => {
      setGameState(prev => {
        if (prev.timeRemaining <= 1) {
          clearInterval(timer)
          handleTimeUp()
          return prev
        }
        return { ...prev, timeRemaining: prev.timeRemaining - 1 }
      })
    }, 1000)

    setGameTimer(timer)
  }

  const createScrambledSentence = async (sentence: Sentence): Promise<ScrambledSentence> => {
    // Use the tokenizer service
    let words: string[]
    try {
      words = await tokenizeSentence(sentence.text)
    } catch {
      words = simpleFallbackTokenizer(sentence.text)
    }

    const timestamp = Date.now()
    const wordBlocks: WordBlock[] = words.map((word, index) => ({
      id: `block-${timestamp}-${index}`,
      text: word,
      originalIndex: index,
      currentIndex: index,
      isCorrectPosition: false,
      color: WORD_BLOCK_COLORS[index % WORD_BLOCK_COLORS.length],
    }))

    // Add distractor blocks
    if (gameState.showDistractors) {
      const numDistractors = Math.min(2, Math.max(1, Math.floor(words.length * 0.3)))
      for (let i = 0; i < numDistractors; i++) {
        const randomEmoji = DISTRACTOR_EMOJIS[Math.floor(Math.random() * DISTRACTOR_EMOJIS.length)]
        wordBlocks.push({
          id: `distractor-${timestamp}-${i}`,
          text: '',
          originalIndex: -1,
          currentIndex: -1,
          isCorrectPosition: false,
          color: '#e5e7eb',
          isDistractor: true,
          distractorEmoji: randomEmoji,
        })
      }
    }

    const shuffledBlocks = shuffleArray([...wordBlocks])

    return {
      id: `scrambled-${timestamp}`,
      originalSentence: sentence,
      wordBlocks: shuffledBlocks,
      userOrder: [],
      attempts: 0,
      isCompleted: false,
      isCorrect: false,
    }
  }

  const handleBlockClick = (block: WordBlock) => {
    if (!gameState.currentSentence || block.isDistractor) return

    setGameState(prev => {
      if (!prev.currentSentence) return prev

      const updatedSentence = { ...prev.currentSentence }
      updatedSentence.userOrder = [...updatedSentence.userOrder, block]
      updatedSentence.wordBlocks = updatedSentence.wordBlocks.filter(b => b.id !== block.id)

      return { ...prev, currentSentence: updatedSentence }
    })
  }

  const handleRemoveBlock = (block: WordBlock) => {
    setGameState(prev => {
      if (!prev.currentSentence) return prev

      const updatedSentence = { ...prev.currentSentence }
      updatedSentence.userOrder = updatedSentence.userOrder.filter(b => b.id !== block.id)
      updatedSentence.wordBlocks = [...updatedSentence.wordBlocks, block]

      return { ...prev, currentSentence: updatedSentence }
    })
  }

  const handleSubmitAttempt = () => {
    if (!gameState.currentSentence) return

    const isCorrect = checkSentenceOrder(gameState.currentSentence)
    const newAttempts = gameState.currentSentence.attempts + 1

    setGameState(prev => {
      if (!prev.currentSentence) return prev

      const updatedSentence = { ...prev.currentSentence }
      updatedSentence.attempts = newAttempts
      updatedSentence.isCorrect = isCorrect
      updatedSentence.isCompleted =
        isCorrect || newAttempts >= GAME_CONSTANTS.MAX_ATTEMPTS_PER_SENTENCE

      const points = isCorrect
        ? GAME_CONSTANTS.POINTS_PER_CORRECT -
          (newAttempts - 1) * GAME_CONSTANTS.POINTS_PER_ATTEMPT_DEDUCTION
        : 0

      return {
        ...prev,
        currentSentence: updatedSentence,
        totalAttempts: prev.totalAttempts + 1,
        totalScore: prev.totalScore + Math.max(0, points),
      }
    })

    setShowFeedback(true)

    setTimeout(() => {
      setShowFeedback(false)

      if (isCorrect || newAttempts >= GAME_CONSTANTS.MAX_ATTEMPTS_PER_SENTENCE) {
        if (gameTimer) clearInterval(gameTimer)

        setTimeout(() => {
          if (gameState.currentSentenceIndex < gameState.sentences.length - 1) {
            moveToNextSentence()
          } else {
            endGame()
          }
        }, 500)
      } else {
        // Reset for next attempt
        resetCurrentSentence()
      }
    }, 2000)
  }

  const resetCurrentSentence = async () => {
    if (!gameState.currentSentence) return

    const freshScrambled = await createScrambledSentence(gameState.currentSentence.originalSentence)
    freshScrambled.attempts = gameState.currentSentence.attempts

    setGameState(prev => ({
      ...prev,
      currentSentence: freshScrambled,
    }))
  }

  const checkSentenceOrder = (sentence: ScrambledSentence): boolean => {
    const userText = sentence.userOrder.map(block => block.text).join('')
    const originalText = sentence.originalSentence.text
    return userText === originalText
  }

  const moveToNextSentence = () => {
    setShowFeedback(false)
    setGameState(prev => ({
      ...prev,
      currentSentenceIndex: prev.currentSentenceIndex + 1,
      currentSentence: null,
      phase: 'sentence-flash',
    }))
    proceedToFlash()
  }

  const handleTimeUp = () => {
    if (!gameState.currentSentence) return

    setGameState(prev => ({
      ...prev,
      totalAttempts: prev.totalAttempts + 1,
    }))

    setTimeout(() => {
      if (gameState.currentSentenceIndex < gameState.sentences.length - 1) {
        moveToNextSentence()
      } else {
        endGame()
      }
    }, 1000)
  }

  const endGame = () => {
    setGameState(prev => ({ ...prev, phase: 'game-over' }))
    if (gameTimer) clearInterval(gameTimer)

    const accuracy =
      gameState.sentences.length > 0
        ? (gameState.totalScore /
            (gameState.sentences.length * GAME_CONSTANTS.POINTS_PER_CORRECT)) *
          100
        : 0

    if (onComplete) {
      onComplete(gameState.totalScore, accuracy)
    }
  }

  const resetGame = () => {
    setGameState({
      phase: propSentences ? 'instructions' : 'sentence-selection',
      sentences: propSentences || [],
      currentSentenceIndex: 0,
      currentSentence: null,
      totalScore: 0,
      totalAttempts: 0,
      gameStartTime: 0,
      timeRemaining: GAME_CONSTANTS.SCRAMBLE_TIME_LIMIT / 1000,
      showDistractors: true,
    })
    setSelectedSentences([])
    setCountdown(0)
    setFlashTimer(0)
    setShowFeedback(false)
    if (gameTimer) {
      clearInterval(gameTimer)
      setGameTimer(null)
    }
    if (flashTimerRef) {
      clearInterval(flashTimerRef)
      setFlashTimerRef(null)
    }
  }

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const handleClose = () => {
    resetGame()
    if (onClose) onClose()
  }

  const renderGamePhase = () => {
    switch (gameState.phase) {
      case 'sentence-selection':
        return renderSentenceSelection()
      case 'instructions':
        return renderInstructions()
      case 'sentence-flash':
        return renderSentenceFlash()
      case 'countdown':
        return renderCountdown()
      case 'scramble':
        return renderScramblePhase()
      case 'game-over':
        return renderGameOver()
      default:
        return null
    }
  }

  const renderSentenceSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-foreground mb-2">
          {t('games.sentenceScramble.selectSentences')}
        </h3>
        <p className="text-muted-foreground">{t('games.sentenceScramble.selectDescription')}</p>
      </div>

      <div className="grid gap-3 max-h-[400px] overflow-y-auto p-2">
        {SAMPLE_SENTENCES.map(sentence => (
          <motion.button
            key={sentence.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSentenceSelection(sentence)}
            className={`
              p-4 rounded-lg border-2 text-left transition-all
              ${
                selectedSentences.some(s => s.id === sentence.id)
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-dark-700 hover:border-primary-300'
              }
            `}
          >
            <div className="space-y-1">
              <p className="font-medium text-foreground">{sentence.text}</p>
              {sentence.furigana && (
                <p className="text-sm text-muted-foreground">{sentence.furigana}</p>
              )}
              {sentence.translation && (
                <p className="text-sm text-primary-600 dark:text-primary-400">
                  {sentence.translation}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {t(`games.sentenceScramble.difficulty.${sentence.difficulty}`)}
              </p>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="flex justify-center gap-4">
        <button
          onClick={startGame}
          disabled={selectedSentences.length === 0}
          className="
            px-8 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg
            font-medium transition-colors disabled:opacity-50 flex items-center gap-2
          "
        >
          <Play className="w-5 h-5" />
          {t('games.sentenceScramble.startGame')}
          {selectedSentences.length > 0 && ` (${selectedSentences.length})`}
        </button>
      </div>
    </div>
  )

  const renderInstructions = () => (
    <div className="space-y-6 text-center max-w-2xl mx-auto">
      <h3 className="text-2xl font-bold text-foreground">
        {t('games.sentenceScramble.howToPlay')}
      </h3>

      <div className="space-y-4 text-left">
        <div className="flex items-start gap-3">
          <span className="text-2xl">👀</span>
          <div>
            <h4 className="font-semibold text-foreground">
              {t('games.sentenceScramble.step1Title')}
            </h4>
            <p className="text-muted-foreground">{t('games.sentenceScramble.step1Desc')}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="text-2xl">🔤</span>
          <div>
            <h4 className="font-semibold text-foreground">
              {t('games.sentenceScramble.step2Title')}
            </h4>
            <p className="text-muted-foreground">{t('games.sentenceScramble.step2Desc')}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="text-2xl">⏰</span>
          <div>
            <h4 className="font-semibold text-foreground">
              {t('games.sentenceScramble.step3Title')}
            </h4>
            <p className="text-muted-foreground">{t('games.sentenceScramble.step3Desc')}</p>
          </div>
        </div>
      </div>

      <button
        onClick={proceedToFlash}
        className="
          px-8 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg
          font-medium transition-colors flex items-center gap-2 mx-auto
        "
      >
        <Play className="w-5 h-5" />
        {t('games.sentenceScramble.start')}
      </button>
    </div>
  )

  const renderSentenceFlash = () => {
    const currentSentence = gameState.sentences[gameState.currentSentenceIndex]

    return (
      <div className="space-y-6 text-center">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            {t('games.sentenceScramble.sentenceOf', {
              current: gameState.currentSentenceIndex + 1,
              total: gameState.sentences.length,
            })}
          </p>
          <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2 mt-2">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all duration-100"
              style={{
                width: `${((GAME_CONSTANTS.SENTENCE_FLASH_DURATION - flashTimer) / GAME_CONSTANTS.SENTENCE_FLASH_DURATION) * 100}%`,
              }}
            />
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-8 min-h-[200px] flex items-center justify-center relative">
          <div className="text-3xl font-medium leading-relaxed">
            {showFurigana && furiganaText ? (
              <div dangerouslySetInnerHTML={{ __html: furiganaText }} className="ruby-text" />
            ) : (
              <p>{currentSentence?.text}</p>
            )}
          </div>

          <button
            onClick={() => setShowFurigana(!showFurigana)}
            className={`
              absolute top-4 right-4 flex items-center gap-1 px-3 py-2 text-sm rounded transition-colors
              ${
                showFurigana
                  ? 'bg-primary-500/20 text-primary-600 dark:text-primary-400'
                  : 'bg-gray-200 dark:bg-dark-700 text-muted-foreground hover:bg-gray-300 dark:hover:bg-dark-600'
              }
            `}
          >
            {loadingFurigana ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              'あ'
            )}
            <span className="text-xs">{showFurigana ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => playTTS(currentSentence?.text || '')}
            className="absolute top-4 left-4 p-2 bg-gray-200 dark:bg-dark-700 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </div>

        {currentSentence?.translation && (
          <p className="text-lg text-muted-foreground">{currentSentence.translation}</p>
        )}

        <button
          onClick={skipFlashAndStartCountdown}
          className="
            px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg
            font-medium transition-colors flex items-center gap-2 mx-auto
          "
        >
          <Play className="w-5 h-5" />
          {t('games.sentenceScramble.skipReading')}
        </button>
      </div>
    )
  }

  const renderCountdown = () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
        <div className="text-8xl font-bold text-primary-500 mb-4 animate-pulse">{countdown}</div>
        <p className="text-xl text-muted-foreground">{t('games.sentenceScramble.getReady')}</p>
      </motion.div>
    </div>
  )

  const renderScramblePhase = () => {
    if (!gameState.currentSentence) return null

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span className={`font-mono ${gameState.timeRemaining <= 5 ? 'text-red-500' : ''}`}>
                {gameState.timeRemaining}s
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5" />
              <span>
                {t('games.sentenceScramble.attempts')}: {gameState.currentSentence.attempts}/
                {GAME_CONSTANTS.MAX_ATTEMPTS_PER_SENTENCE}
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('games.sentenceScramble.sentenceOf', {
              current: gameState.currentSentenceIndex + 1,
              total: gameState.sentences.length,
            })}
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium text-foreground">
            {t('games.sentenceScramble.yourSentence')}
          </h4>
          <div className="min-h-[80px] bg-gray-50 dark:bg-dark-800 rounded-lg p-4 flex flex-wrap gap-2">
            {gameState.currentSentence.userOrder.map(block => (
              <motion.button
                key={block.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleRemoveBlock(block)}
                className="px-3 py-2 rounded-lg font-medium shadow-sm border cursor-pointer hover:opacity-80"
                style={{
                  backgroundColor: block.color,
                  borderColor: `${block.color}88`,
                }}
              >
                {block.text}
              </motion.button>
            ))}
            {gameState.currentSentence.userOrder.length === 0 && (
              <p className="text-muted-foreground italic">
                {t('games.sentenceScramble.clickBlocks')}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium text-foreground">
            {t('games.sentenceScramble.availableBlocks')}
          </h4>
          <div className="flex flex-wrap gap-3 justify-center p-4 bg-gray-50/50 dark:bg-dark-800/50 rounded-lg min-h-[120px]">
            <AnimatePresence mode="popLayout">
              {gameState.currentSentence.wordBlocks.map(block => (
                <motion.button
                  key={block.id}
                  layout
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  whileHover={{ scale: block.isDistractor ? 1 : 1.1 }}
                  whileTap={{ scale: block.isDistractor ? 1 : 0.9 }}
                  onClick={() => handleBlockClick(block)}
                  className={`
                    px-4 py-3 rounded-lg font-medium shadow-lg transition-all duration-200
                    border-2 flex items-center justify-center
                    ${
                      block.isDistractor
                        ? 'cursor-not-allowed opacity-75'
                        : 'cursor-pointer hover:shadow-xl'
                    }
                  `}
                  style={{
                    backgroundColor: block.color,
                    borderColor: `${block.color}cc`,
                    boxShadow: `0 4px 8px ${block.color}40`,
                  }}
                  disabled={block.isDistractor}
                >
                  {block.isDistractor ? (
                    <span className="text-2xl">{block.distractorEmoji}</span>
                  ) : (
                    block.text
                  )}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {gameState.currentSentence.userOrder.length > 0 && !showFeedback && (
          <div className="flex justify-center">
            <button
              onClick={handleSubmitAttempt}
              className="
                px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg
                font-medium transition-colors
              "
            >
              {t('games.sentenceScramble.submitAnswer')}
            </button>
          </div>
        )}

        {showFeedback && gameState.currentSentence && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`
              text-center p-4 rounded-lg transition-all duration-300
              ${
                gameState.currentSentence.isCorrect
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
              }
            `}
          >
            <p className="text-lg font-semibold">
              {gameState.currentSentence.isCorrect
                ? `🎉 ${t('games.sentenceScramble.correct')}`
                : `❌ ${t('games.sentenceScramble.incorrect')}`}
            </p>
            <p className="text-sm mt-1">
              {t('games.sentenceScramble.original')}:{' '}
              {gameState.currentSentence.originalSentence.text}
            </p>
          </motion.div>
        )}
      </div>
    )
  }

  const renderGameOver = () => {
    const accuracy =
      gameState.sentences.length > 0
        ? (gameState.totalScore /
            (gameState.sentences.length * GAME_CONSTANTS.POINTS_PER_CORRECT)) *
          100
        : 0
    const totalTime = Math.round((Date.now() - gameState.gameStartTime) / 1000)

    return (
      <div className="space-y-6 text-center">
        <div>
          <h3 className="text-2xl font-bold text-foreground mb-2">
            {t('games.sentenceScramble.gameComplete')}
          </h3>
          <p className="text-muted-foreground">{t('games.sentenceScramble.greatJob')}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-4">
            <p className="text-2xl font-bold text-primary-500">{gameState.totalScore}</p>
            <p className="text-sm text-muted-foreground">{t('games.sentenceScramble.score')}</p>
          </div>
          <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-4">
            <p className="text-2xl font-bold text-primary-500">{gameState.sentences.length}</p>
            <p className="text-sm text-muted-foreground">
              {t('games.sentenceScramble.totalSentences')}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-4">
            <p className="text-2xl font-bold text-primary-500">{Math.round(accuracy)}%</p>
            <p className="text-sm text-muted-foreground">{t('games.sentenceScramble.accuracy')}</p>
          </div>
          <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-4">
            <p className="text-2xl font-bold text-primary-500">{totalTime}s</p>
            <p className="text-sm text-muted-foreground">{t('games.sentenceScramble.time')}</p>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={resetGame}
            className="
              px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg
              font-medium transition-colors flex items-center gap-2
            "
          >
            <RotateCcw className="w-5 h-5" />
            {t('games.sentenceScramble.playAgain')}
          </button>
          {onClose && (
            <button
              onClick={handleClose}
              className="
                px-6 py-3 border border-gray-300 dark:border-dark-600 rounded-lg
                hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors
              "
            >
              {t('common.close')}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="bg-white dark:bg-dark-850 rounded-lg shadow-xl">
        <div className="p-4 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            🧩 {t('games.sentenceScramble.title')}
          </h2>
          {onClose && (
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6">{renderGamePhase()}</div>
      </div>
    </div>
  )
}
