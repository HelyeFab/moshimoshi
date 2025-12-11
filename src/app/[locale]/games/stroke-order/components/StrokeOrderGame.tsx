'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, RefreshCw, Lightbulb, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import StrokeGuides from './StrokeGuides'
import DrawingCanvas from './DrawingCanvas'
import GameControls, { InputMode } from './GameControls'
import ScoreDisplay from './ScoreDisplay'
import GameOverModal from './GameOverModal'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'

export interface PracticeSet {
  id: string
  name: string
  description: string
  kanji: string[]
  color: string
}

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'

interface GameState {
  currentKanjiIndex: number
  score: number
  combo: number
  maxCombo: number
  correctStrokes: number[]
  incorrectAttempts: number
  hintsUsed: number
  startTime: number
  kanjiStartTime: number
  completedKanji: number
  totalStrokes: number
}

interface Props {
  practiceSet: PracticeSet
  onBack: () => void
}

interface StrokeOrderProgress {
  highScores: { [setId: string]: number }
  kanjiMastery: { [kanji: string]: { attempts: number; successes: number; bestTime: number } }
  totalGamesPlayed: number
  totalKanjiPracticed: number
  lastPlayed: number
}

export default function StrokeOrderGame({ practiceSet, onBack }: Props) {
  const { t, strings } = useI18n()
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [inputMode, setInputMode] = useState<InputMode>('click')
  const [strokePaths, setStrokePaths] = useState<string[]>([])
  const [loadingKanji, setLoadingKanji] = useState(true)
  const [gameState, setGameState] = useState<GameState>({
    currentKanjiIndex: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    correctStrokes: [],
    incorrectAttempts: 0,
    hintsUsed: 0,
    startTime: Date.now(),
    kanjiStartTime: Date.now(),
    completedKanji: 0,
    totalStrokes: 0,
  })
  const [isGameOver, setIsGameOver] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [lastClickedStroke, setLastClickedStroke] = useState<number | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [progress, setProgress] = useState<StrokeOrderProgress | null>(null)

  const currentKanji = practiceSet.kanji[gameState.currentKanjiIndex]

  // Load progress on mount
  useEffect(() => {
    loadProgress()
  }, [])

  // Load kanji stroke data when kanji changes
  useEffect(() => {
    loadKanjiData()
  }, [currentKanji])

  const loadKanjiData = async () => {
    if (!currentKanji) {
      setLoadingKanji(false)
      return
    }

    try {
      setLoadingKanji(true)
      const codePoint = currentKanji.charCodeAt(0).toString(16).padStart(5, '0')
      const url = `/data/kanjivg/${codePoint}.svg`
      const response = await fetch(url)

      if (response.ok) {
        const svgText = await response.text()
        const parser = new DOMParser()
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml')
        const paths = svgDoc.querySelectorAll('path[id^="kvg:"][id*="-s"]')
        const pathData = Array.from(paths).map(path => path.getAttribute('d') || '')
        setStrokePaths(pathData)
      } else {
        console.error('Failed to fetch SVG:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Failed to load kanji data:', error)
    } finally {
      setLoadingKanji(false)
    }
  }

  const loadProgress = async () => {
    try {
      const savedProgressStr = localStorage.getItem('strokeOrderProgress')
      if (savedProgressStr) {
        const savedProgress = JSON.parse(savedProgressStr) as StrokeOrderProgress
        setProgress(savedProgress)
      } else {
        // Initialize progress if not exists
        const initialProgress: StrokeOrderProgress = {
          highScores: {},
          kanjiMastery: {},
          totalGamesPlayed: 0,
          totalKanjiPracticed: 0,
          lastPlayed: Date.now(),
        }
        setProgress(initialProgress)
        localStorage.setItem('strokeOrderProgress', JSON.stringify(initialProgress))
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  const saveProgress = async (updatedProgress: StrokeOrderProgress) => {
    try {
      localStorage.setItem('strokeOrderProgress', JSON.stringify(updatedProgress))
      setProgress(updatedProgress)
    } catch (error) {
      console.error('Failed to save progress:', error)
    }
  }

  const handleStrokeClick = useCallback((strokeIndex: number, totalStrokesInKanji: number) => {
    if (gameState.correctStrokes.includes(strokeIndex)) {
      return // Already completed
    }

    const expectedStroke = gameState.correctStrokes.length
    setLastClickedStroke(strokeIndex)

    if (strokeIndex === expectedStroke) {
      // Correct stroke
      setIsCorrect(true)
      const newCombo = gameState.combo + 1
      const timeBonus = Math.max(0, 10 - Math.floor((Date.now() - gameState.kanjiStartTime) / 1000))
      const comboBonus = Math.floor(newCombo / 5) * 5
      const difficultyMultiplier = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 1.5 : difficulty === 'hard' ? 2 : 3
      const strokeScore = Math.floor((10 + timeBonus + comboBonus) * difficultyMultiplier)

      const newCorrectStrokes = [...gameState.correctStrokes, strokeIndex]

      setGameState(prev => ({
        ...prev,
        correctStrokes: newCorrectStrokes,
        score: prev.score + strokeScore,
        combo: newCombo,
        maxCombo: Math.max(newCombo, prev.maxCombo),
        totalStrokes: prev.totalStrokes + 1,
      }))

      // Check if kanji is complete
      if (newCorrectStrokes.length === totalStrokesInKanji) {
        setTimeout(() => {
          moveToNextKanji()
        }, 1000)
      }
    } else {
      // Incorrect stroke
      setIsCorrect(false)

      setGameState(prev => ({
        ...prev,
        incorrectAttempts: prev.incorrectAttempts + 1,
        combo: 0,
        score: Math.max(0, prev.score - 5),
      }))
    }

    // Clear the feedback after animation
    setTimeout(() => {
      setLastClickedStroke(null)
      setIsCorrect(null)
    }, 600)
  }, [gameState.correctStrokes, gameState.combo, gameState.kanjiStartTime, difficulty])

  const handleDrawingComplete = (strokeIndex: number, accuracy: number) => {
    if (strokeIndex === gameState.correctStrokes.length) {
      // Correct stroke drawn
      const timeBonus = Math.max(0, 10 - Math.floor((Date.now() - gameState.kanjiStartTime) / 1000))
      const accuracyBonus = Math.floor(accuracy * 10)
      const newCombo = gameState.combo + 1
      const comboBonus = Math.floor(newCombo / 5) * 5
      const difficultyMultiplier = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 1.5 : difficulty === 'hard' ? 2 : 3
      const strokeScore = Math.floor((10 + timeBonus + accuracyBonus + comboBonus) * difficultyMultiplier)

      const newCorrectStrokes = [...gameState.correctStrokes, strokeIndex]

      setGameState(prev => ({
        ...prev,
        correctStrokes: newCorrectStrokes,
        score: prev.score + strokeScore,
        combo: newCombo,
        maxCombo: Math.max(newCombo, prev.maxCombo),
        totalStrokes: prev.totalStrokes + 1,
      }))

      // Check if kanji is complete
      if (newCorrectStrokes.length === strokePaths.length) {
        setTimeout(() => {
          moveToNextKanji()
        }, 1000)
      }
    } else {
      // Incorrect stroke
      setGameState(prev => ({
        ...prev,
        incorrectAttempts: prev.incorrectAttempts + 1,
        combo: 0,
        score: Math.max(0, prev.score - 5),
      }))
    }
  }

  const moveToNextKanji = async () => {
    // Update kanji mastery
    if (progress) {
      const kanjiTime = Date.now() - gameState.kanjiStartTime
      const kanjiData = progress.kanjiMastery[currentKanji] || { attempts: 0, successes: 0, bestTime: Infinity }

      const updatedProgress = {
        ...progress,
        kanjiMastery: {
          ...progress.kanjiMastery,
          [currentKanji]: {
            attempts: kanjiData.attempts + 1,
            successes: kanjiData.successes + (gameState.incorrectAttempts === 0 ? 1 : 0),
            bestTime: Math.min(kanjiData.bestTime, kanjiTime),
          },
        },
        totalKanjiPracticed: progress.totalKanjiPracticed + 1,
      }

      await saveProgress(updatedProgress)
    }

    if (gameState.currentKanjiIndex < practiceSet.kanji.length - 1) {
      setGameState(prev => ({
        ...prev,
        currentKanjiIndex: prev.currentKanjiIndex + 1,
        correctStrokes: [],
        kanjiStartTime: Date.now(),
        completedKanji: prev.completedKanji + 1,
      }))
    } else {
      // Game over
      setGameState(prev => ({
        ...prev,
        completedKanji: prev.completedKanji + 1,
      }))

      // Save high score and update game stats
      if (progress) {
        const updatedProgress = {
          ...progress,
          highScores: {
            ...progress.highScores,
            [practiceSet.id]: Math.max(progress.highScores[practiceSet.id] || 0, gameState.score),
          },
          totalGamesPlayed: progress.totalGamesPlayed + 1,
          lastPlayed: Date.now(),
        }
        await saveProgress(updatedProgress)
      }

      setIsGameOver(true)
    }
  }

  const handleHint = () => {
    if (gameState.hintsUsed >= 3 || showHint) return

    setShowHint(true)
    setGameState(prev => ({
      ...prev,
      hintsUsed: prev.hintsUsed + 1,
      score: Math.max(0, prev.score - 20),
    }))

    setTimeout(() => {
      setShowHint(false)
    }, 2000)
  }

  const handleRestart = () => {
    setGameState({
      currentKanjiIndex: 0,
      score: 0,
      combo: 0,
      maxCombo: 0,
      correctStrokes: [],
      incorrectAttempts: 0,
      hintsUsed: 0,
      startTime: Date.now(),
      kanjiStartTime: Date.now(),
      completedKanji: 0,
      totalStrokes: 0,
    })
    setIsGameOver(false)
  }

  const getElapsedTime = () => {
    const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000)
    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-background-light to-accent-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      <div className="container mx-auto px-4 py-8">
        <main className="max-w-7xl mx-auto mb-32 md:mb-8 pb-safe">
          {/* Page Header */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold">{practiceSet.name}</h1>
          </div>

          <div className="mb-4 mt-8">
            <GameControls
              difficulty={difficulty}
              onDifficultyChange={setDifficulty}
              inputMode={inputMode}
              onInputModeChange={setInputMode}
              onHint={handleHint}
              hintsRemaining={3 - gameState.hintsUsed}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-[1fr,300px]">
            <Card className="p-8">
              <div className="flex flex-col items-center">
                <div className="mb-4 text-center">
                  <div className="text-sm text-muted-foreground mb-1">
                    {strings.games?.strokeOrder?.kanjiProgress || 'Kanji'} {gameState.currentKanjiIndex + 1} {(strings.common as any)?.of || 'of'} {practiceSet.kanji.length}
                  </div>
                  <div className="text-6xl font-bold mb-2">{currentKanji}</div>
                </div>

                {loadingKanji ? (
                  <div className="w-80 h-80 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                  </div>
                ) : inputMode === 'click' ? (
                  <StrokeGuides
                    kanji={currentKanji}
                    difficulty={difficulty}
                    correctStrokes={gameState.correctStrokes}
                    showHint={showHint}
                    onStrokeClick={handleStrokeClick}
                    lastClickedStroke={lastClickedStroke}
                    isCorrect={isCorrect}
                  />
                ) : (
                  <DrawingCanvas
                    kanji={currentKanji}
                    strokePaths={strokePaths}
                    correctStrokes={gameState.correctStrokes}
                    onStrokeComplete={handleDrawingComplete}
                    showHint={showHint}
                    currentStrokeIndex={gameState.correctStrokes.length}
                    difficulty={difficulty}
                  />
                )}

                <AnimatePresence>
                  {gameState.correctStrokes.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-4 text-sm text-muted-foreground"
                    >
                      {strings.games?.strokeOrder?.progress || 'Progress'}: {gameState.correctStrokes.length} {gameState.correctStrokes.length !== 1 ? strings.games?.strokeOrder?.strokes || 'strokes' : strings.games?.strokeOrder?.stroke || 'stroke'} {strings.games?.strokeOrder?.completed || 'completed'}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>

            <div className="space-y-4">
              <ScoreDisplay
                score={gameState.score}
                combo={gameState.combo}
                completedKanji={gameState.completedKanji}
                totalKanji={practiceSet.kanji.length}
                elapsedTime={getElapsedTime()}
              />

              {progress && progress.highScores[practiceSet.id] && (
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>{strings.games?.strokeOrder?.highScore || 'High Score'}</span>
                      <span className="font-semibold">{progress.highScores[practiceSet.id].toLocaleString()}</span>
                    </div>
                  </div>
                </Card>
              )}

              <Card className="p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  {strings.games?.strokeOrder?.tips || 'Tips'}
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• {strings.games?.strokeOrder?.tipTopBottom || 'Start from top to bottom'}</li>
                  <li>• {strings.games?.strokeOrder?.tipLeftRight || 'Left to right for horizontal strokes'}</li>
                  <li>• {strings.games?.strokeOrder?.tipOutsideInside || 'Outside before inside'}</li>
                  <li>• {strings.games?.strokeOrder?.tipCloseLast || 'Close frames last'}</li>
                </ul>
              </Card>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleRestart}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {strings.games?.strokeOrder?.restartSet || 'Restart Set'}
              </Button>
            </div>
          </div>
        </main>
      </div>

      <GameOverModal
        isOpen={isGameOver}
        onClose={() => setIsGameOver(false)}
        score={gameState.score}
        time={getElapsedTime()}
        accuracy={Math.round((gameState.totalStrokes / (gameState.totalStrokes + gameState.incorrectAttempts)) * 100)}
        maxCombo={gameState.maxCombo}
        onRestart={handleRestart}
        onBack={onBack}
      />
    </div>
  )
}