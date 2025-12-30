'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { kanjiCanvasService } from '@/services/kanjiCanvasService'
import { Trash2, Undo2, Search } from 'lucide-react'

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

interface DrawingSearchCanvasProps {
  width?: number
  height?: number
  onCandidatesChange: (candidates: string[]) => void
  onSearching?: (isSearching: boolean) => void
  strokeColor?: string
  strokeWidth?: number
  debounceMs?: number
  className?: string
}

export default function DrawingSearchCanvas({
  width = 200,
  height = 200,
  onCandidatesChange,
  onSearching,
  strokeColor = '#000000',
  strokeWidth = 4,
  debounceMs = 400,
  className = ''
}: DrawingSearchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasId = useRef(`search-canvas-${Math.random().toString(36).substr(2, 9)}`)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<Point[]>([])
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null)
  const [isRecognitionReady, setIsRecognitionReady] = useState(false)
  const [isRecognizing, setIsRecognizing] = useState(false)
  const recognizeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize KanjiCanvas
  useEffect(() => {
    const initKanjiCanvas = async () => {
      const canvas = canvasRef.current
      if (!canvas) return

      canvas.id = canvasId.current

      try {
        await kanjiCanvasService.loadScripts()
        await new Promise(resolve => setTimeout(resolve, 100))

        if (document.getElementById(canvasId.current)) {
          await kanjiCanvasService.initCanvas(canvasId.current)
          setIsRecognitionReady(true)
        }
      } catch (error) {
        console.error('Failed to initialize recognition:', error)
      }
    }

    const timer = setTimeout(initKanjiCanvas, 150)
    return () => clearTimeout(timer)
  }, [])

  // Initialize canvas context
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = strokeWidth

    setContext(ctx)
    ctx.clearRect(0, 0, width, height)
  }, [width, height, strokeColor, strokeWidth])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognizeTimeoutRef.current) {
        clearTimeout(recognizeTimeoutRef.current)
      }
    }
  }, [])

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

  // Recognize with debounce
  const triggerRecognition = useCallback(async (currentStrokes: Stroke[]) => {
    if (!isRecognitionReady || currentStrokes.length === 0) return

    // Clear any pending recognition
    if (recognizeTimeoutRef.current) {
      clearTimeout(recognizeTimeoutRef.current)
    }

    recognizeTimeoutRef.current = setTimeout(async () => {
      setIsRecognizing(true)
      onSearching?.(true)

      try {
        const result = await kanjiCanvasService.recognizeHybrid(
          canvasId.current,
          currentStrokes,
          'kanji',
          width,
          height
        )

        onCandidatesChange(result.candidates)
      } catch (error) {
        console.error('Recognition error:', error)
        onCandidatesChange([])
      } finally {
        setIsRecognizing(false)
        onSearching?.(false)
      }
    }, debounceMs)
  }, [isRecognitionReady, width, height, debounceMs, onCandidatesChange, onSearching])

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

      // Trigger recognition after stroke
      triggerRecognition(updatedStrokes)
    }

    setCurrentStroke([])
  }, [isDrawing, currentStroke, strokes, triggerRecognition])

  // Clear canvas
  const clearCanvas = useCallback(() => {
    if (!context) return

    context.clearRect(0, 0, width, height)
    setStrokes([])
    setCurrentStroke([])
    onCandidatesChange([])

    if (isRecognitionReady) {
      kanjiCanvasService.eraseCanvas(canvasId.current)
    }

    // Clear any pending recognition
    if (recognizeTimeoutRef.current) {
      clearTimeout(recognizeTimeoutRef.current)
    }
  }, [context, width, height, isRecognitionReady, onCandidatesChange])

  // Undo last stroke
  const undoLastStroke = useCallback(() => {
    if (strokes.length === 0 || !context) return

    const newStrokes = strokes.slice(0, -1)
    setStrokes(newStrokes)

    // Clear and redraw
    context.clearRect(0, 0, width, height)

    if (isRecognitionReady) {
      kanjiCanvasService.eraseCanvas(canvasId.current)
    }

    // Redraw remaining strokes
    newStrokes.forEach(stroke => {
      if (stroke.points.length < 2) return

      context.beginPath()
      context.moveTo(stroke.points[0].x, stroke.points[0].y)

      stroke.points.slice(1).forEach(point => {
        context.lineTo(point.x, point.y)
      })

      context.stroke()
    })

    // Re-trigger recognition with remaining strokes
    if (newStrokes.length > 0) {
      triggerRecognition(newStrokes)
    } else {
      onCandidatesChange([])
    }
  }, [strokes, context, width, height, isRecognitionReady, triggerRecognition, onCandidatesChange])

  // Add event listeners
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleMouseDown = (e: MouseEvent) => startDrawing(e)
    const handleMouseMove = (e: MouseEvent) => draw(e)
    const handleMouseUp = (e: MouseEvent) => stopDrawing(e)
    const handleMouseOut = (e: MouseEvent) => stopDrawing(e)

    const handleTouchStart = (e: TouchEvent) => startDrawing(e)
    const handleTouchMove = (e: TouchEvent) => draw(e)
    const handleTouchEnd = (e: TouchEvent) => stopDrawing(e)
    const handleTouchCancel = (e: TouchEvent) => stopDrawing(e)

    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseout', handleMouseOut)

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false })
    canvas.addEventListener('touchcancel', handleTouchCancel, { passive: false })

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
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* Canvas Container */}
      <div className="relative bg-white dark:bg-dark-900 rounded-lg shadow-md border-2 border-gray-200 dark:border-dark-700">
        {/* Drawing canvas */}
        <canvas
          ref={canvasRef}
          id={canvasId.current}
          width={width}
          height={height}
          className="cursor-crosshair touch-none rounded-lg"
          data-testid="drawing-search-canvas"
        />

        {/* Grid lines for guidance */}
        <svg
          className="absolute inset-0 pointer-events-none opacity-10"
          width={width}
          height={height}
        >
          <line x1={width/2} y1={0} x2={width/2} y2={height} stroke="currentColor" />
          <line x1={0} y1={height/2} x2={width} y2={height/2} stroke="currentColor" />
        </svg>

        {/* Stroke counter */}
        <div className="absolute top-1.5 right-1.5 bg-gray-500/80 text-white text-xs px-1.5 py-0.5 rounded-full">
          {strokes.length}
        </div>

        {/* Recognition status indicator */}
        {isRecognizing && (
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-500">Searching...</span>
          </div>
        )}

        {/* Recognition ready indicator */}
        {!isRecognitionReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-dark-900/80 rounded-lg">
            <span className="text-xs text-gray-500">Loading...</span>
          </div>
        )}
      </div>

      {/* Control buttons */}
      <div className="flex gap-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={undoLastStroke}
          disabled={strokes.length === 0}
          className="p-2 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          title="Undo last stroke"
          aria-label="Undo last stroke"
          data-testid="undo-button"
        >
          <Undo2 className="w-4 h-4" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={clearCanvas}
          disabled={strokes.length === 0}
          className="p-2 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          title="Clear canvas"
          aria-label="Clear canvas"
          data-testid="clear-button"
        >
          <Trash2 className="w-4 h-4" />
        </motion.button>
      </div>

      {/* Instructions */}
      <p className="text-xs text-gray-400 text-center">
        Draw a kanji to search
      </p>
    </div>
  )
}
