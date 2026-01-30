/**
 * Japanese Reassembly Screen
 * Agent D - UI Components
 *
 * Tile reassembly with drag-and-drop or click-to-reorder
 * Uses app theme tokens, keyboard accessible
 */

'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, XCircle, RotateCcw, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TileScreenProps } from './types'
import { useTranslation } from '@/hooks/useTranslation'

// Unique tile wrapper for Reorder (handles duplicates)
interface UniqueTile {
  id: string
  label: string
}

export function JpReassemble({
  prompt,
  tiles,
  correctOrder,
  onAnswer,
  disabled = false
}: TileScreenProps) {
  const { t } = useTranslation()
  const isSingleChoice = correctOrder.length === 1 && tiles.length > 1
  const isPickMode = tiles.length > correctOrder.length && correctOrder.length > 1
  const canReorder = tiles.length > 1 && !isSingleChoice && !isPickMode

  // Convert tiles to unique objects (id = label + index)
  const [currentOrder, setCurrentOrder] = useState<UniqueTile[]>(
    tiles.map((label, i) => ({ id: `${label}-${i}`, label }))
  )
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [pickedTiles, setPickedTiles] = useState<UniqueTile[]>([])
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const stepStartTimeRef = React.useRef<number>(Date.now())
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Reset state when tiles change
  useEffect(() => {
    setCurrentOrder(tiles.map((label, i) => ({ id: `${label}-${i}`, label })))
    setSelectedIndex(null)
    setPickedTiles([])
    setShowFeedback(false)
    setIsCorrect(false)
    stepStartTimeRef.current = Date.now()
  }, [tiles])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Click-to-reorder: select two tiles to swap
  const handleTileClick = (index: number) => {
    if (disabled || showFeedback || !canReorder) return

    if (selectedIndex === null) {
      // First selection
      setSelectedIndex(index)
    } else if (selectedIndex === index) {
      // Deselect
      setSelectedIndex(null)
    } else {
      // Swap tiles
      const newOrder = [...currentOrder]
      ;[newOrder[selectedIndex], newOrder[index]] = [newOrder[index], newOrder[selectedIndex]]
      setCurrentOrder(newOrder)
      setSelectedIndex(null)
    }
  }

  // Submit answer
  const handleSubmit = () => {
    if (disabled || showFeedback) return

    // Capture response time at submission (not after delay)
    const responseTime = Date.now() - stepStartTimeRef.current

    let userAnswer: string[] = []

    if (canReorder) {
      userAnswer = currentOrder.map(tile => tile.label)
    } else if (isPickMode) {
      userAnswer = pickedTiles.map(tile => tile.label)
      if (userAnswer.length !== correctOrder.length) return
    } else {
      return
    }

    const correct = userAnswer.every((label, i) => label === correctOrder[i])
    setIsCorrect(correct)
    setShowFeedback(true)

    // Clear any existing timer
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Auto-advance after feedback (UI delay does not affect response time)
    timeoutRef.current = setTimeout(() => {
      onAnswer(userAnswer, correct, responseTime)
    }, 1500)
  }

  const handleSingleSelect = (label: string) => {
    if (disabled || showFeedback || !isSingleChoice) return

    // Capture response time at selection (not after delay)
    const responseTime = Date.now() - stepStartTimeRef.current

    const correct = label === correctOrder[0]
    setIsCorrect(correct)
    setShowFeedback(true)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Auto-advance after feedback (UI delay does not affect response time)
    timeoutRef.current = setTimeout(() => {
      onAnswer([label], correct, responseTime)
    }, 1200)
  }

  const handlePickTile = (tile: UniqueTile) => {
    if (disabled || showFeedback || !isPickMode) return

    const exists = pickedTiles.find(t => t.id === tile.id)
    if (exists) {
      setPickedTiles(prev => prev.filter(t => t.id !== tile.id))
      return
    }

    if (pickedTiles.length >= correctOrder.length) return
    setPickedTiles(prev => [...prev, tile])
  }

  // Reset to original shuffled order
  const handleReset = () => {
    setCurrentOrder(tiles.map((label, i) => ({ id: `${label}-${i}`, label })))
    setSelectedIndex(null)
    setPickedTiles([])
  }

  // Keyboard navigation
  useEffect(() => {
    if (disabled || showFeedback) return

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSubmit()
      } else if (e.key === 'r' || e.key === 'R') {
        handleReset()
      } else if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1
        if (index < currentOrder.length) {
          if (isPickMode) {
            handlePickTile(currentOrder[index])
          } else {
            handleTileClick(index)
          }
        }
      }
    }

    window.addEventListener('keypress', handleKeyPress)
    return () => window.removeEventListener('keypress', handleKeyPress)
  }, [currentOrder, selectedIndex, disabled, showFeedback])

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Prompt */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-xl text-center text-foreground font-medium">
            {prompt}
          </p>
        </CardContent>
      </Card>

      {/* Tiles - Reorderable or Single-Choice */}
      <Card className={cn(
        "transition-colors duration-300",
        showFeedback && isCorrect && "border-green-500 bg-green-50 dark:bg-green-950",
        showFeedback && !isCorrect && "border-red-500 bg-red-50 dark:bg-red-950"
      )}>
        <CardContent className="pt-6">
          {isSingleChoice ? (
            <div className="flex flex-wrap gap-2 justify-center min-h-[60px]">
              {currentOrder.map((tile, index) => (
                <motion.button
                  key={tile.id}
                  className={cn(
                    "px-4 py-3 rounded-lg border-2 transition-all text-2xl font-medium",
                    "bg-card text-foreground",
                    showFeedback && tile.label === correctOrder[0] && "border-green-500 bg-green-50 dark:bg-green-950",
                    showFeedback && tile.label !== correctOrder[0] && "border-red-500 bg-red-50 dark:bg-red-950",
                    !showFeedback && "hover:border-primary"
                  )}
                  onClick={() => handleSingleSelect(tile.label)}
                  disabled={disabled || showFeedback}
                  whileHover={!disabled && !showFeedback ? { scale: 1.05 } : {}}
                  whileTap={!disabled && !showFeedback ? { scale: 0.95 } : {}}
                  aria-label={`Tile ${index + 1}: ${tile.label}`}
                >
                  {tile.label}
                </motion.button>
              ))}
            </div>
          ) : (
            <>
              {isPickMode && (
                <div className="flex flex-wrap gap-2 justify-center min-h-[60px] mb-4">
                  {pickedTiles.map((tile) => (
                    <div
                      key={`picked-${tile.id}`}
                      className="px-4 py-3 rounded-lg border-2 bg-card text-foreground text-2xl font-medium"
                    >
                      {tile.label}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 justify-center min-h-[60px]">
                {currentOrder.map((tile, index) => {
                  const isPicked = pickedTiles.some(t => t.id === tile.id)
                  return (
                    <motion.button
                      key={tile.id}
                      className={cn(
                        "px-4 py-3 rounded-lg border-2 transition-all text-2xl font-medium",
                        "bg-card text-foreground",
                        canReorder && "cursor-move",
                        canReorder && selectedIndex === index && "ring-2 ring-ring border-primary",
                        isPickMode && isPicked && "ring-2 ring-ring border-primary",
                        showFeedback && "cursor-default"
                      )}
                      onClick={() => {
                        if (isPickMode) {
                          handlePickTile(tile)
                        } else {
                          handleTileClick(index)
                        }
                      }}
                      disabled={disabled || showFeedback}
                      whileHover={!disabled && !showFeedback ? { scale: 1.05 } : {}}
                      whileTap={!disabled && !showFeedback ? { scale: 0.95 } : {}}
                      aria-label={`Tile ${index + 1}: ${tile.label}`}
                    >
                      {tile.label}
                    </motion.button>
                  )
                })}
              </div>
            </>
          )}

          {/* Feedback */}
          {showFeedback && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center justify-center gap-2"
            >
              {isCorrect ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {t('blastMode.screens.reassemble.correct')}
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    {t('blastMode.screens.reassemble.incorrect', { answer: correctOrder.join(' ') })}
                  </span>
                </>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      {!showFeedback && (canReorder || isPickMode) && (
        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={disabled}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            {t('blastMode.buttons.reset')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={disabled || (isPickMode && pickedTiles.length !== correctOrder.length)}
            className="gap-2"
          >
            <Check className="h-4 w-4" />
            {t('blastMode.buttons.submit')}
          </Button>
        </div>
      )}
      {!showFeedback && canReorder && (
        <div className="text-sm text-muted-foreground text-center space-y-1">
          <p>{t('blastMode.screens.reassemble.instructions.reorder')}</p>
          <p>{t('blastMode.screens.reassemble.keyboardHints.reorder')}</p>
        </div>
      )}
      {!showFeedback && isPickMode && (
        <div className="text-sm text-muted-foreground text-center space-y-1">
          <p>{t('blastMode.screens.reassemble.instructions.pick')}</p>
          <p>{t('blastMode.screens.reassemble.keyboardHints.pick')}</p>
        </div>
      )}
      {!showFeedback && isSingleChoice && (
        <div className="text-sm text-muted-foreground text-center">
          {t('blastMode.screens.reassemble.instructions.single')}
        </div>
      )}
    </div>
  )
}
