'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, RotateCcw } from 'lucide-react'
import { JapaneseWord } from '@/types/vocabulary'
import { GameState, GameStats, GAME_CONFIG } from './types'
import { createTiles, checkMatch } from './gameUtils'
import GameGrid from './GameGrid'
import VictoryScreen from './VictoryScreen'
import { useI18n } from '@/i18n/I18nContext'
import { useTTS } from '@/hooks/useTTS'

interface MatchingGameProps {
  isOpen: boolean
  onClose: () => void
  words: JapaneseWord[]
  onPlayAgain?: () => void
}

export default function MatchingGame({ isOpen, onClose, words, onPlayAgain }: MatchingGameProps) {
  const { strings } = useI18n()
  const { play: playTTS } = useTTS({ cacheFirst: true })

  // Calculate number of pairs based on available words
  const pairCount = useMemo(() => {
    if (words.length >= 10) {
      return GAME_CONFIG.MAX_PAIRS // 15 pairs
    } else if (words.length >= 7) {
      return 12
    } else if (words.length >= 5) {
      return 10
    }
    return Math.min(words.length * 2, GAME_CONFIG.MIN_PAIRS)
  }, [words])

  const [gameState, setGameState] = useState<GameState>(() => ({
    tiles: [],
    selectedTiles: [],
    matchedPairs: 0,
    totalPairs: pairCount,
    moves: 0,
    isGameOver: false,
    startTime: Date.now()
  }))

  const [showVictory, setShowVictory] = useState(false)
  const [gameStats, setGameStats] = useState<GameStats | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  // Initialize game
  useEffect(() => {
    if (isOpen && words.length > 0) {
      startNewGame()
    }
  }, [isOpen])

  const startNewGame = useCallback(() => {
    const tiles = createTiles(words, pairCount)
    const actualPairs = tiles.length / 2
    setGameState({
      tiles,
      selectedTiles: [],
      matchedPairs: 0,
      totalPairs: actualPairs,
      moves: 0,
      isGameOver: false,
      startTime: Date.now()
    })
    setShowVictory(false)
    setGameStats(null)
  }, [words, pairCount])

  const playSound = useCallback(async (text: string) => {
    if (soundEnabled && text) {
      try {
        await playTTS(text, { voice: 'ja-JP', rate: 0.9 })
      } catch (error) {
        console.error('Failed to play sound:', error)
      }
    }
  }, [soundEnabled, playTTS])

  const handleTileClick = useCallback(async (tileId: string) => {
    if (isProcessing || gameState.selectedTiles.length >= GAME_CONFIG.MAX_SELECTED) {
      return
    }

    const clickedTile = gameState.tiles.find(t => t.id === tileId)
    if (!clickedTile || clickedTile.isFlipped || clickedTile.isMatched) {
      return
    }

    // Play the word sound
    if (clickedTile.word) {
      const textToSpeak = clickedTile.word.kana || clickedTile.word.kanji || ''
      playSound(textToSpeak)
    }

    // Flip the tile
    setGameState(prev => ({
      ...prev,
      tiles: prev.tiles.map(t =>
        t.id === tileId ? { ...t, isFlipped: true } : t
      ),
      selectedTiles: [...prev.selectedTiles, tileId]
    }))

    // Check for match if this is the second tile
    if (gameState.selectedTiles.length === 1) {
      setIsProcessing(true)
      const firstTileId = gameState.selectedTiles[0]
      const firstTile = gameState.tiles.find(t => t.id === firstTileId)

      if (firstTile && clickedTile) {
        const isMatch = checkMatch(firstTile, clickedTile)

        if (isMatch) {
          // Match found!
          setTimeout(() => {
            setGameState(prev => {
              const newMatchedPairs = prev.matchedPairs + 1
              const newMoves = prev.moves + 1
              const isGameOver = newMatchedPairs === prev.totalPairs

              // Check for victory
              if (isGameOver) {
                setTimeout(() => {
                  const endTime = Date.now()
                  const timeTaken = endTime - prev.startTime
                  const perfectGame = newMoves === prev.totalPairs

                  setGameStats({
                    totalMoves: newMoves,
                    timeTaken,
                    perfectGame
                  })
                  setShowVictory(true)
                }, GAME_CONFIG.VICTORY_DELAY)
              }

              return {
                ...prev,
                tiles: prev.tiles.map(t =>
                  t.id === firstTileId || t.id === tileId
                    ? { ...t, isMatched: true, isFlipped: true }
                    : t
                ),
                selectedTiles: [],
                matchedPairs: newMatchedPairs,
                moves: newMoves,
                isGameOver,
                endTime: isGameOver ? Date.now() : undefined
              }
            })

            setIsProcessing(false)
          }, GAME_CONFIG.MATCH_DELAY)
        } else {
          // No match - flip back
          setTimeout(() => {
            setGameState(prev => ({
              ...prev,
              tiles: prev.tiles.map(t =>
                t.id === firstTileId || t.id === tileId
                  ? { ...t, isFlipped: false }
                  : t
              ),
              selectedTiles: [],
              moves: prev.moves + 1
            }))
            setIsProcessing(false)
          }, GAME_CONFIG.MISMATCH_DELAY)
        }
      }
    }
  }, [gameState, isProcessing, playSound])

  const handleReset = () => {
    startNewGame()
  }

  const handlePlayAgain = () => {
    setShowVictory(false)
    if (onPlayAgain) {
      onPlayAgain()
    } else {
      startNewGame()
    }
  }

  const handleVictoryClose = () => {
    setShowVictory(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-soft-white dark:bg-dark-850 rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gray-50 dark:bg-dark-900 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-dark-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-lg sm:text-xl font-bold text-foreground">
                  {strings.games?.matching?.title || 'Matching Game'}
                </h2>
                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
                  {/* Stats */}
                  <div className="flex items-center gap-3 sm:gap-4 text-sm">
                    <div className="text-muted-foreground">
                      {strings.games?.matching?.moves || 'Moves'}: <span className="font-bold text-foreground">{gameState.moves}</span>
                    </div>
                    <div className="text-muted-foreground">
                      {strings.games?.matching?.pairs || 'Pairs'}: <span className="font-bold text-primary-600 dark:text-primary-400">
                        {gameState.matchedPairs}/{gameState.totalPairs}
                      </span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-1 sm:gap-2">
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                      title={soundEnabled ? "Mute sounds" : "Enable sounds"}
                    >
                      <span className={`text-xl ${soundEnabled ? '' : 'opacity-50'}`}>
                        {soundEnabled ? '🔊' : '🔇'}
                      </span>
                    </button>
                    <button
                      onClick={handleReset}
                      className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                      title="Reset game"
                    >
                      <RotateCcw className="w-4 sm:w-5 h-4 sm:h-5" />
                    </button>
                    <button
                      onClick={onClose}
                      className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                      title="Close game"
                    >
                      <X className="w-4 sm:w-5 h-4 sm:h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Game Content */}
            <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto scrollbar-hide max-h-[calc(95vh-80px)]">
              <GameGrid
                gameState={gameState}
                onTileClick={handleTileClick}
                disabled={isProcessing || showVictory}
              />
            </div>
          </motion.div>

          {/* Victory Screen */}
          {showVictory && gameStats && (
            <VictoryScreen
              stats={gameStats}
              onPlayAgain={handlePlayAgain}
              onClose={handleVictoryClose}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}