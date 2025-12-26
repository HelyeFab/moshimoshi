'use client'

import { useState, useEffect, useCallback } from 'react'
import Modal from '@/components/ui/Modal'
import DrawingCanvasWithRecognition, { DrawingData, Stroke } from './DrawingCanvasWithRecognition'
import { kanjiService } from '@/services/kanjiService'
import { kanjiCanvasService } from '@/services/kanjiCanvasService'
import { LoadingSpinner } from '@/components/ui/Loading'
import { motion, AnimatePresence } from 'framer-motion'
import { useFeature } from '@/hooks/useFeature'

interface DrawingPracticeModalProps {
  character: string
  isOpen: boolean
  onClose: () => void
  onComplete?: (score: number) => void
  characterType?: 'kanji' | 'hiragana' | 'katakana' | 'kana'
}

interface FeedbackData {
  score: number
  strokeAccuracy: number[]
  orderAccuracy: boolean
  message: string
  recognized?: string[]
}

export default function DrawingPracticeModal({
  character,
  isOpen,
  onClose,
  onComplete,
  characterType = 'kanji',
}: DrawingPracticeModalProps) {
  // Detect if character is actually kana if not explicitly set
  const detectedCharacterType = (() => {
    if (characterType === 'kana' || characterType === 'hiragana' || characterType === 'katakana') {
      return 'kana'
    }
    // Check if character is kana based on Unicode range
    const code = character.charCodeAt(0)
    const isKana = (code >= 0x3040 && code <= 0x309f) || (code >= 0x30a0 && code <= 0x30ff)
    return isKana ? 'kana' : 'kanji'
  })()
  const [svgData, setSvgData] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackData | null>(null)
  const [showHints, setShowHints] = useState(false)
  const [correctStrokes, setCorrectStrokes] = useState<number>(0)
  const [recognitionReady, setRecognitionReady] = useState<boolean | null>(null)
  const { checkAndTrack } = useFeature('drawing_practice')

  // Load SVG data for the character
  useEffect(() => {
    if (isOpen && character) {
      loadCharacterData()
    }
  }, [isOpen, character])

  const loadCharacterData = async () => {
    setIsLoading(true)
    try {
      const svg = await kanjiService.getStrokeOrderSVG(character)
      if (svg) {
        setSvgData(svg)

        // Count number of strokes
        const parser = new DOMParser()
        const svgDoc = parser.parseFromString(svg, 'image/svg+xml')
        const strokePaths = svgDoc.querySelectorAll('path[id*="kvg:"]')
        setCorrectStrokes(strokePaths.length)
      }
    } catch (error) {
      console.error('Error loading character data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle drawing submission with real recognition
  const handleDrawingComplete = useCallback(
    async (drawingData: DrawingData) => {
      // Combine client recognition with server-side Vision check
      let candidates = drawingData.recognized || []

      // Call server to verify using Vision if we have an image
      if (drawingData.imageDataUrl) {
        try {
          const resp = await fetch('/api/drawing/recognize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageDataUrl: drawingData.imageDataUrl }),
          })
          const result = await resp.json()
          if (result?.success && Array.isArray(result.candidates)) {
            // Merge: Vision candidates first, then local, dedup
            const merged = [...result.candidates, ...candidates].filter(Boolean)
            const seen = new Set<string>()
            candidates = merged.filter(c => {
              const key = c
              if (seen.has(key)) return false
              seen.add(key)
              return true
            })
          }
        } catch (err) {
          console.warn('[DrawingPractice] Vision verify failed', err)
        }
      }

      // Deterministic score: rank-based + stroke count match
      const rank = candidates.indexOf(character)
      let score = 50 // base
      if (rank === 0) score = 98
      else if (rank === 1) score = 90
      else if (rank === 2) score = 82
      else if (rank >= 3 && rank !== -1) score = Math.max(70, 80 - rank * 2)
      else if (candidates.length > 0) score = 60

      const strokeCountMatch = drawingData.strokes.length === correctStrokes
      if (strokeCountMatch) score = Math.min(100, score + 5)

      // Per-stroke accuracy: deterministic based on stroke count alignment
      const perStroke = drawingData.strokes.map((_s, idx) => {
        if (!correctStrokes) return 60
        const ratio = Math.min(1, drawingData.strokes.length / correctStrokes)
        const base = 60 + ratio * 40
        // Weight earlier strokes slightly higher if counts match
        const weight = strokeCountMatch ? (1 - idx / Math.max(1, drawingData.strokes.length)) : 0.8
        return Math.max(40, Math.min(100, base * weight))
      })

      const feedbackData: FeedbackData = {
        score,
        strokeAccuracy: perStroke,
        orderAccuracy: strokeCountMatch,
        message: getScoreMessage(score),
        recognized: candidates,
      }

      setFeedback(feedbackData)
      setShowFeedback(true)

      if (onComplete && score >= 80) {
        onComplete(score)
      }
    },
    [character, correctStrokes, onComplete]
  )

  // Handle stroke completion
  const handleStrokeComplete = useCallback((stroke: Stroke) => {
    // Could provide real-time feedback here
    console.log('Stroke completed:', stroke.strokeNumber)
  }, [])

  // Get appropriate message based on score
  const getScoreMessage = (score: number): string => {
    if (score >= 95) return 'Perfect! 完璧！'
    if (score >= 85) return 'Excellent! 素晴らしい！'
    if (score >= 75) return 'Good job! よくできました！'
    if (score >= 65) return 'Not bad! まあまあです。'
    return 'Keep practicing! 練習を続けて！'
  }

  // Reset for retry - check quota first
  const handleRetry = async () => {
    console.log('[DrawingPracticeModal] Checking quota for retry...')
    const allowed = await checkAndTrack({ showUI: true })
    console.log('[DrawingPracticeModal] Retry allowed:', allowed)

    if (allowed) {
      setShowFeedback(false)
      setFeedback(null)
    } else {
      // Quota exceeded - close modal
      console.log('[DrawingPracticeModal] Quota exceeded, closing modal')
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Drawing Practice: ${character}`} size="lg">
      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="large" />
          </div>
        ) : (
          <>
            {/* Simplified header with just strokes info and hints toggle */}
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm">
                <span className="text-gray-500">Strokes:</span>{' '}
                <span className="font-semibold">{correctStrokes}</span>
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span
                  className={`inline-flex h-2 w-2 rounded-full ${
                    recognitionReady === false
                      ? 'bg-red-500'
                      : recognitionReady === true
                        ? 'bg-green-500'
                        : 'bg-yellow-400'
                  }`}
                />
                {recognitionReady === false
                  ? 'Recognition unavailable'
                  : recognitionReady === true
                    ? 'Recognition ready'
                    : 'Loading recognition...'}
              </div>

              {!showFeedback && (
                <button
                  onClick={() => setShowHints(!showHints)}
                  className="px-3 py-1 text-sm bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 rounded-lg transition-colors"
                >
                  {showHints ? 'Hide' : 'Show'} Hints
                </button>
              )}
            </div>

            {/* Drawing area or feedback */}
            <AnimatePresence mode="wait">
              {!showFeedback ? (
                <motion.div
                  key="canvas"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <DrawingCanvasWithRecognition
                    character={character}
                    characterType={detectedCharacterType}
                    characterSVG={showHints ? svgData || undefined : undefined}
                    showGhost={showHints}
                    onDrawingComplete={handleDrawingComplete}
                    onStrokeComplete={handleStrokeComplete}
                    autoRecognize={true}
                    onReadyChange={setRecognitionReady}
                    width={280}
                    height={280}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="feedback"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center gap-6 py-8"
                >
                  {/* Score display */}
                  <div className="text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', delay: 0.2 }}
                      className={`text-6xl font-bold mb-2 ${
                        feedback!.score >= 80
                          ? 'text-green-500'
                          : feedback!.score >= 60
                            ? 'text-yellow-500'
                            : 'text-red-500'
                      }`}
                    >
                      {feedback?.score}%
                    </motion.div>
                    <p className="text-lg text-gray-700 dark:text-gray-300">{feedback?.message}</p>
                  </div>

                  {/* Stroke accuracy breakdown */}
                  {feedback && (
                    <div className="w-full">
                      <h3 className="text-sm font-semibold text-gray-500 mb-2">Stroke Accuracy</h3>
                      <div className="space-y-2">
                        {feedback.strokeAccuracy.map((accuracy, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-12">#{index + 1}</span>
                            <div className="flex-1 bg-gray-200 dark:bg-dark-700 rounded-full h-2 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${accuracy}%` }}
                                transition={{ delay: 0.1 * index }}
                                className={`h-full ${
                                  accuracy >= 80
                                    ? 'bg-green-500'
                                    : accuracy >= 60
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500'
                                }`}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-10">
                              {Math.round(accuracy)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleRetry}
                      className="px-6 py-2 bg-primary-500 text-white hover:bg-primary-600 rounded-lg transition-colors"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={onClose}
                      className="px-6 py-2 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 rounded-lg transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tips */}
            {!showFeedback && (
              <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  💡 <strong>Tips:</strong> Draw each stroke in the correct order.
                  {showHints
                    ? ' Follow the faded outline for guidance.'
                    : ' Toggle hints to see the character outline.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
