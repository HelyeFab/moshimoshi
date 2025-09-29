'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'
import { useTTS } from '@/hooks/useTTS'
import { ListManager } from '@/lib/lists/ListManager'
import { UserList, ListItem } from '@/types/userLists'
import {
  AssemblyQuestion,
  AssemblyStats,
  generateAssemblyQuestion,
  loadAssemblyStats,
  saveAssemblyStats,
  shuffleArray
} from './utils'

interface WordAssemblyGameProps {
  onBack: () => void
}

export default function WordAssemblyGame({ onBack }: WordAssemblyGameProps) {
  const { strings } = useI18n()
  const { play: playAudio, loading: audioLoading } = useTTS({ cacheFirst: true })

  // Game state
  const [gameState, setGameState] = useState<'menu' | 'selecting' | 'playing' | 'results'>('menu')
  const [userLists, setUserLists] = useState<UserList[]>([])
  const [selectedLists, setSelectedLists] = useState<string[]>([])
  const [wordPool, setWordPool] = useState<ListItem[]>([])
  const [stats, setStats] = useState<AssemblyStats>(loadAssemblyStats())

  // Question state
  const [currentQuestion, setCurrentQuestion] = useState<AssemblyQuestion | null>(null)
  const [selectedSegments, setSelectedSegments] = useState<string[]>([])
  const [availableOptions, setAvailableOptions] = useState<string[]>([])
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [questionsAnswered, setQuestionsAnswered] = useState(0)
  const [correctAnswers, setCorrectAnswers] = useState(0)

  // Load user lists on mount
  useEffect(() => {
    loadUserLists()
  }, [])

  const loadUserLists = async () => {
    try {
      const listManager = new ListManager()
      const lists = await listManager.getLists('', false) // Get lists without user ID check
      // Filter for word lists only
      const wordLists = lists.filter(list => list.type === 'word' && list.items.length > 0)
      setUserLists(wordLists)
    } catch (error) {
      console.error('Failed to load lists:', error)
    }
  }

  const handleListToggle = (listId: string) => {
    setSelectedLists(prev =>
      prev.includes(listId)
        ? prev.filter(id => id !== listId)
        : [...prev, listId]
    )
  }

  const startGame = () => {
    if (selectedLists.length === 0) return

    // Combine all words from selected lists
    const allWords: ListItem[] = []
    selectedLists.forEach(listId => {
      const list = userLists.find(l => l.id === listId)
      if (list) {
        // Filter for words that have both content and reading
        const validWords = list.items.filter(item =>
          item.content && item.metadata?.reading
        )
        allWords.push(...validWords)
      }
    })

    if (allWords.length < 2) {
      alert(strings.games?.wordAssembly?.needMoreWords || 'Need at least 2 words with readings to play!')
      return
    }

    setWordPool(allWords)
    setGameState('playing')
    setQuestionsAnswered(0)
    setCorrectAnswers(0)
    generateNewQuestion(allWords)
  }

  const generateNewQuestion = (pool: ListItem[] = wordPool) => {
    if (pool.length === 0) return

    // Pick a random word
    const randomWord = pool[Math.floor(Math.random() * pool.length)]
    const question = generateAssemblyQuestion(randomWord, pool)

    if (question) {
      setCurrentQuestion(question)
      setSelectedSegments([])
      setAvailableOptions([...question.allOptions])
      setShowFeedback(false)
      setIsCorrect(false)

      // Play audio after a short delay
      setTimeout(() => {
        playAudio(question.word, { voice: 'ja-JP', rate: 0.9 })
      }, 500)
    }
  }

  const handleSegmentSelect = (segment: string) => {
    if (showFeedback) return

    // Move from available to selected
    setAvailableOptions(prev => prev.filter(s => s !== segment))
    setSelectedSegments(prev => [...prev, segment])
  }

  const handleSegmentRemove = (index: number) => {
    if (showFeedback) return

    const segment = selectedSegments[index]
    setSelectedSegments(prev => prev.filter((_, i) => i !== index))
    setAvailableOptions(prev => [...prev, segment])
  }

  const handleSubmit = () => {
    if (!currentQuestion || showFeedback || selectedSegments.length === 0) return

    const userAnswer = selectedSegments.join('')
    const correctAnswer = currentQuestion.kana
    const correct = userAnswer === correctAnswer

    setIsCorrect(correct)
    setShowFeedback(true)
    setQuestionsAnswered(prev => prev + 1)
    if (correct) {
      setCorrectAnswers(prev => prev + 1)
    }

    // Update stats
    const today = new Date().toDateString()
    const newStats: AssemblyStats = {
      ...stats,
      totalGames: stats.totalGames + 1,
      correctAnswers: stats.correctAnswers + (correct ? 1 : 0),
      gamesToday: stats.gamesToday + 1,
      lastPlayedDate: today,
      wordStats: {
        ...stats.wordStats,
        [currentQuestion.word]: {
          attempts: (stats.wordStats[currentQuestion.word]?.attempts || 0) + 1,
          correct: (stats.wordStats[currentQuestion.word]?.correct || 0) + (correct ? 1 : 0),
          lastSeen: today
        }
      }
    }
    setStats(newStats)
    saveAssemblyStats(newStats)
  }

  const handleNextQuestion = () => {
    generateNewQuestion()
  }

  const handleShuffle = () => {
    if (showFeedback) return
    const shuffled = [...availableOptions]
    shuffleArray(shuffled)
    setAvailableOptions(shuffled)
  }

  const handleEndGame = () => {
    setGameState('results')
  }

  const handlePlayAgain = () => {
    setGameState('menu')
    setSelectedLists([])
    setWordPool([])
    setCurrentQuestion(null)
  }

  // Render game menu
  if (gameState === 'menu' || gameState === 'selecting') {
    return (
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <button
            onClick={onBack}
            className="mb-4 text-primary hover:text-primary-600 transition-colors"
          >
            ← {strings.common?.back || 'Back to Games'}
          </button>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {strings.games?.wordAssembly?.title || 'Word Assembly'}
          </h1>
          <p className="text-muted-foreground">
            {strings.games?.wordAssembly?.description || 'Build the correct kana reading from audio'}
          </p>
          <div className="text-6xl mt-4">🔤</div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-card rounded-lg p-4 text-center border border-border">
            <div className="text-2xl font-bold text-primary">{stats.totalGames}</div>
            <div className="text-sm text-muted-foreground">{strings.games?.stats?.totalGames || 'Total Games'}</div>
          </div>
          <div className="bg-card rounded-lg p-4 text-center border border-border">
            <div className="text-2xl font-bold text-green-500">{stats.correctAnswers}</div>
            <div className="text-sm text-muted-foreground">{strings.games?.stats?.correct || 'Correct'}</div>
          </div>
          <div className="bg-card rounded-lg p-4 text-center border border-border">
            <div className="text-2xl font-bold text-blue-500">
              {stats.totalGames > 0 ? Math.round((stats.correctAnswers / stats.totalGames) * 100) : 0}%
            </div>
            <div className="text-sm text-muted-foreground">{strings.games?.stats?.accuracy || 'Accuracy'}</div>
          </div>
        </div>

        {/* List Selection */}
        <div className="bg-card rounded-lg p-6 border border-border">
          <h2 className="text-xl font-semibold mb-4">
            {strings.games?.selectLists || 'Select Word Lists'}
          </h2>

          {userLists.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{strings.games?.noLists || 'No word lists found. Create some word lists first!'}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {userLists.map(list => (
                <label
                  key={list.id}
                  className="flex items-center p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedLists.includes(list.id)}
                    onChange={() => handleListToggle(list.id)}
                    className="w-4 h-4 text-primary rounded focus:ring-primary"
                  />
                  <span className="ml-3 text-2xl">{list.emoji}</span>
                  <div className="ml-3 flex-1">
                    <div className="font-medium">{list.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {list.items.filter(item => item.content && item.metadata?.reading).length} {strings.games?.wordsAvailable || 'words available'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          <button
            onClick={startGame}
            disabled={selectedLists.length === 0}
            className="w-full py-3 px-4 bg-primary text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-600 transition-colors"
          >
            {selectedLists.length === 0
              ? (strings.games?.selectListsFirst || 'Select at least one list')
              : (strings.games?.startGame || 'Start Game')
            }
          </button>
        </div>
      </div>
    )
  }

  // Render game results
  if (gameState === 'results') {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card rounded-lg p-8 border border-border"
        >
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold mb-4">{strings.games?.gameOver || 'Game Over!'}</h2>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="text-2xl font-bold text-primary">{correctAnswers}</div>
              <div className="text-sm text-muted-foreground">{strings.games?.correct || 'Correct'}</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="text-2xl font-bold">
                {questionsAnswered > 0 ? Math.round((correctAnswers / questionsAnswered) * 100) : 0}%
              </div>
              <div className="text-sm text-muted-foreground">{strings.games?.accuracy || 'Accuracy'}</div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handlePlayAgain}
              className="flex-1 py-3 px-4 bg-primary text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
            >
              {strings.games?.playAgain || 'Play Again'}
            </button>
            <button
              onClick={onBack}
              className="flex-1 py-3 px-4 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
            >
              {strings.common?.back || 'Back to Games'}
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // Render game playing
  return (
    <div className="max-w-4xl mx-auto">
      {/* Game Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {strings.games?.question || 'Question'} {questionsAnswered + 1}
          </span>
          <span className="text-sm font-medium">
            {strings.games?.score || 'Score'}: {correctAnswers}/{questionsAnswered}
          </span>
        </div>
        <button
          onClick={handleEndGame}
          className="text-sm text-destructive hover:text-destructive/80 transition-colors"
        >
          {strings.games?.endGame || 'End Game'}
        </button>
      </div>

      {currentQuestion && (
        <>
          {/* Question Card */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card rounded-lg p-6 border border-border mb-6"
          >
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">{currentQuestion.word}</div>
              <div className="text-sm text-muted-foreground mb-4">{currentQuestion.meaning}</div>

              <button
                onClick={() => playAudio(currentQuestion.word, { voice: 'ja-JP', rate: 0.9 })}
                disabled={audioLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
              >
                <span className="text-xl">🔊</span>
                {audioLoading ? (strings.common?.loading || 'Loading...') : (strings.games?.playAudio || 'Play Audio')}
              </button>
            </div>
          </motion.div>

          {/* Assembly Area */}
          <div className="bg-card rounded-lg p-6 border border-border mb-6">
            <h3 className="text-lg font-semibold mb-4 text-center">
              {strings.games?.wordAssembly?.buildKana || 'Build the Kana Reading'}
            </h3>

            {/* Selected segments */}
            <div className="min-h-[80px] bg-muted/30 rounded-lg p-4 mb-4 flex items-center justify-center flex-wrap gap-2">
              {selectedSegments.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {strings.games?.wordAssembly?.clickToAdd || 'Click kana segments below to build the word'}
                </p>
              ) : (
                <AnimatePresence mode="popLayout">
                  {selectedSegments.map((segment, index) => (
                    <motion.button
                      key={`${segment}-${index}`}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      onClick={() => handleSegmentRemove(index)}
                      disabled={showFeedback}
                      className="px-3 py-2 bg-primary text-white rounded-lg text-lg font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
                    >
                      {segment}
                    </motion.button>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Available options */}
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              <AnimatePresence mode="popLayout">
                {availableOptions.map((option, index) => (
                  <motion.button
                    key={`${option}-${index}`}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    onClick={() => handleSegmentSelect(option)}
                    disabled={showFeedback}
                    className="px-4 py-3 bg-card border border-border rounded-lg text-xl font-medium hover:bg-muted hover:border-primary disabled:opacity-50 transition-all hover:scale-105"
                  >
                    {option}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleSubmit}
                disabled={selectedSegments.length === 0 || showFeedback}
                className="px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {strings.games?.submit || 'Submit'}
              </button>
              <button
                onClick={handleShuffle}
                disabled={showFeedback}
                className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/90 disabled:opacity-50 transition-colors"
              >
                🔀 {strings.games?.shuffle || 'Shuffle'}
              </button>
            </div>
          </div>

          {/* Feedback */}
          {showFeedback && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`p-6 rounded-lg text-center ${
                isCorrect
                  ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500'
                  : 'bg-red-100 dark:bg-red-900/30 border-2 border-red-500'
              }`}
            >
              <div className="text-3xl mb-2">{isCorrect ? '🎉' : '😅'}</div>
              <div className="text-xl font-semibold mb-2">
                {isCorrect
                  ? (strings.games?.correct || 'Correct!')
                  : (strings.games?.incorrect || 'Not quite!')
                }
              </div>
              {!isCorrect && (
                <div className="text-sm text-muted-foreground mb-2">
                  {strings.games?.correctAnswer || 'Correct answer'}: <span className="font-bold">{currentQuestion.kana}</span>
                </div>
              )}
              <button
                onClick={handleNextQuestion}
                className="mt-4 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
              >
                {strings.games?.nextQuestion || 'Next Question'}
              </button>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}