'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { kanjiCanvasService } from '@/services/kanjiCanvasService'

// Types for stroke data
export interface Point {
  x: number
  y: number
  timestamp: number
}

export interface Stroke {
  points: Point[]
  strokeNumber: number
}

export interface DrawingData {
  strokes: Stroke[]
  character: string
  startTime: number
  endTime: number
  recognized?: string[]
  confidence?: number
}

interface DrawingCanvasWithRecognitionProps {
  width?: number
  height?: number
  characterSVG?: string // Ghost character to trace
  onDrawingComplete?: (data: DrawingData) => void
  onStrokeComplete?: (stroke: Stroke) => void
  onRecognition?: (candidates: string[], confidence: number[]) => void
  showGhost?: boolean
  strokeColor?: string
  strokeWidth?: number
  character: string
  characterType?: 'kanji' | 'kana'
  autoRecognize?: boolean // Automatically recognize after each stroke
}

export default function DrawingCanvasWithRecognition({
  width = 300,
  height = 300,
  characterSVG,
  onDrawingComplete,
  onStrokeComplete,
  onRecognition,
  showGhost = true,
  strokeColor = '#000000',
  strokeWidth = 3,
  character,
  characterType = 'kanji',
  autoRecognize = true
}: DrawingCanvasWithRecognitionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasId = useRef(`canvas-${Math.random().toString(36).substr(2, 9)}`)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<Point[]>([])
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null)
  const [isKanjiCanvasReady, setIsKanjiCanvasReady] = useState(false)
  const [recognizedCandidates, setRecognizedCandidates] = useState<string[]>([])
  const startTimeRef = useRef<number>(Date.now())

  // Initialize KanjiCanvas
  useEffect(() => {
    const initKanjiCanvas = async () => {
      const canvas = canvasRef.current
      if (!canvas) return

      // Set the canvas ID before initializing
      canvas.id = canvasId.current

      try {
        await kanjiCanvasService.loadScripts()

        // Wait a bit to ensure canvas is in DOM
        await new Promise(resolve => setTimeout(resolve, 100))

        // Check if canvas is still in DOM
        if (document.getElementById(canvasId.current)) {
          await kanjiCanvasService.initCanvas(canvasId.current)
          setIsKanjiCanvasReady(true)
          console.log('KanjiCanvas initialized for', canvasId.current)
        }
      } catch (error) {
        console.error('Failed to initialize KanjiCanvas:', error)
      }
    }

    // Delay initialization to ensure canvas is rendered
    const timer = setTimeout(initKanjiCanvas, 200)

    return () => clearTimeout(timer)
  }, [])

  // Initialize canvas context for visual drawing
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas properties
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = strokeWidth

    setContext(ctx)

    // Clear canvas
    ctx.clearRect(0, 0, width, height)
  }, [width, height, strokeColor, strokeWidth])

  // Get coordinates from mouse or touch event
  const getCoordinates = useCallback((e: MouseEvent | TouchEvent): Point | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number

    if ('touches' in e) {
      if (e.touches.length === 0) return null
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      timestamp: Date.now()
    }
  }, [])

  // Start drawing
  const startDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault()
    const point = getCoordinates(e)
    if (!point || !context) return

    setIsDrawing(true)
    setCurrentStroke([point])

    context.beginPath()
    context.moveTo(point.x, point.y)
  }, [context, getCoordinates])

  // Draw on canvas
  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault()
    if (!isDrawing || !context) return

    const point = getCoordinates(e)
    if (!point) return

    setCurrentStroke(prev => [...prev, point])

    context.lineTo(point.x, point.y)
    context.stroke()
  }, [isDrawing, context, getCoordinates])

  // Stop drawing and trigger recognition
  const stopDrawing = useCallback((e?: MouseEvent | TouchEvent) => {
    if (e) e.preventDefault()
    if (!isDrawing) return

    setIsDrawing(false)

    if (currentStroke.length > 1) {
      const newStroke: Stroke = {
        points: currentStroke,
        strokeNumber: strokes.length
      }

      const updatedStrokes = [...strokes, newStroke]
      setStrokes(updatedStrokes)

      if (onStrokeComplete) {
        onStrokeComplete(newStroke)
      }

      // Trigger recognition if KanjiCanvas is ready and auto-recognize is enabled
      if (isKanjiCanvasReady && autoRecognize) {
        setTimeout(() => {
          recognizeCharacter()
        }, 100) // Small delay to ensure canvas is updated
      }
    }

    setCurrentStroke([])
  }, [isDrawing, currentStroke, strokes, onStrokeComplete, isKanjiCanvasReady, autoRecognize])

  // Recognize the drawn character
  const recognizeCharacter = useCallback(() => {
    if (!isKanjiCanvasReady) {
      console.warn('KanjiCanvas not ready')
      return
    }

    // Use checkMatch for filtering by character type
    const result = kanjiCanvasService.checkMatch(canvasId.current, character, characterType)
    setRecognizedCandidates(result.candidates)

    if (onRecognition) {
      // Create confidence array for the filtered candidates
      const confidence = result.candidates.map((_, index) =>
        Math.max(0.3, 1 - (index * 0.15))
      )
      onRecognition(result.candidates, confidence)
    }

    console.log('Recognition result:', result)
  }, [isKanjiCanvasReady, onRecognition, character, characterType])

  // Clear canvas
  const clearCanvas = useCallback(() => {
    if (!context) return

    context.clearRect(0, 0, width, height)
    setStrokes([])
    setCurrentStroke([])
    setRecognizedCandidates([])
    startTimeRef.current = Date.now()

    // Clear KanjiCanvas as well
    if (isKanjiCanvasReady) {
      kanjiCanvasService.eraseCanvas(canvasId.current)
    }
  }, [context, width, height, isKanjiCanvasReady])

  // Undo last stroke
  const undoLastStroke = useCallback(() => {
    if (strokes.length === 0 || !context) return

    const newStrokes = strokes.slice(0, -1)
    setStrokes(newStrokes)

    // Clear and redraw
    context.clearRect(0, 0, width, height)

    // Clear KanjiCanvas and reinitialize
    if (isKanjiCanvasReady) {
      kanjiCanvasService.eraseCanvas(canvasId.current)
    }

    // Redraw all remaining strokes
    newStrokes.forEach(stroke => {
      if (stroke.points.length < 2) return

      context.beginPath()
      context.moveTo(stroke.points[0].x, stroke.points[0].y)

      stroke.points.slice(1).forEach(point => {
        context.lineTo(point.x, point.y)
      })

      context.stroke()
    })

    // Re-recognize if auto-recognize is enabled
    if (isKanjiCanvasReady && autoRecognize && newStrokes.length > 0) {
      setTimeout(() => {
        recognizeCharacter()
      }, 100)
    }
  }, [strokes, context, width, height, isKanjiCanvasReady, autoRecognize, recognizeCharacter])

  // Submit drawing with recognition
  const submitDrawing = useCallback(() => {
    // Get final recognition
    let finalCandidates: string[] = []
    let finalConfidence = 0

    if (isKanjiCanvasReady) {
      const result = kanjiCanvasService.checkMatch(canvasId.current, character, characterType)
      finalCandidates = result.candidates
      finalConfidence = result.confidence
    }

    const drawingData: DrawingData = {
      strokes,
      character,
      startTime: startTimeRef.current,
      endTime: Date.now(),
      recognized: finalCandidates,
      confidence: finalConfidence
    }

    if (onDrawingComplete) {
      onDrawingComplete(drawingData)
    }
  }, [strokes, character, characterType, isKanjiCanvasReady, onDrawingComplete])

  // Add event listeners
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Mouse events
    const handleMouseDown = (e: MouseEvent) => startDrawing(e)
    const handleMouseMove = (e: MouseEvent) => draw(e)
    const handleMouseUp = (e: MouseEvent) => stopDrawing(e)
    const handleMouseOut = (e: MouseEvent) => stopDrawing(e)

    // Touch events
    const handleTouchStart = (e: TouchEvent) => startDrawing(e)
    const handleTouchMove = (e: TouchEvent) => draw(e)
    const handleTouchEnd = (e: TouchEvent) => stopDrawing(e)
    const handleTouchCancel = (e: TouchEvent) => stopDrawing(e)

    // Add listeners
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseout', handleMouseOut)

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false })
    canvas.addEventListener('touchcancel', handleTouchCancel, { passive: false })

    // Cleanup
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseout', handleMouseOut)

      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchend', handleTouchEnd)
      canvas.removeEventListener('touchcancel', handleTouchCancel)
    }
  }, [startDrawing, draw, stopDrawing])

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Canvas Container */}
      <div className="relative bg-white dark:bg-dark-900 rounded-lg shadow-lg border-2 border-gray-200 dark:border-dark-700">
        {/* Ghost character overlay */}
        {showGhost && characterSVG && (
          <svg
            viewBox="0 0 109 109"
            width={width}
            height={height}
            className="absolute inset-0 opacity-20 pointer-events-none"
            dangerouslySetInnerHTML={{ __html: characterSVG.replace(/<svg[^>]*>|<\/svg>/g, '') }}
          />
        )}

        {/* Drawing canvas */}
        <canvas
          ref={canvasRef}
          id={canvasId.current}
          width={width}
          height={height}
          className="cursor-crosshair touch-none"
        />

        {/* Grid lines */}
        <svg
          className="absolute inset-0 pointer-events-none opacity-10"
          width={width}
          height={height}
        >
          <line x1={width/2} y1={0} x2={width/2} y2={height} stroke="currentColor" />
          <line x1={0} y1={height/2} x2={width} y2={height/2} stroke="currentColor" />
          <line x1={0} y1={0} x2={width} y2={height} stroke="currentColor" strokeDasharray="5,5" />
          <line x1={width} y1={0} x2={0} y2={height} stroke="currentColor" strokeDasharray="5,5" />
        </svg>

        {/* Stroke counter */}
        <div className="absolute top-2 right-2 bg-primary-500 text-white text-xs px-2 py-1 rounded-full">
          {strokes.length} strokes
        </div>

        {/* KanjiCanvas status */}
        {!isKanjiCanvasReady && (
          <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
            Loading recognition...
          </div>
        )}
      </div>

      {/* Recognition candidates */}
      {recognizedCandidates.length > 0 && (
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-500">Recognized:</span>
          <div className="flex gap-1">
            {recognizedCandidates.slice(0, 5).map((candidate, index) => (
              <div
                key={index}
                className={`px-2 py-1 rounded ${
                  candidate === character
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold'
                    : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {candidate}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control buttons */}
      <div className="flex gap-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={clearCanvas}
          className="px-4 py-2 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 rounded-lg transition-colors"
        >
          Clear
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={undoLastStroke}
          disabled={strokes.length === 0}
          className="px-4 py-2 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          Undo
        </motion.button>

        {!autoRecognize && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={recognizeCharacter}
            disabled={strokes.length === 0 || !isKanjiCanvasReady}
            className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Recognize
          </motion.button>
        )}

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={submitDrawing}
          disabled={strokes.length === 0}
          className="px-4 py-2 bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          Submit
        </motion.button>
      </div>

      {/* Instructions */}
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
        Draw the character above. {autoRecognize ? 'Recognition happens automatically.' : 'Click "Recognize" to check your drawing.'}
      </p>
    </div>
  )
}