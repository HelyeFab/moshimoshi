'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'

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
}

interface DrawingCanvasProps {
  width?: number
  height?: number
  characterSVG?: string // Ghost character to trace
  onDrawingComplete?: (data: DrawingData) => void
  onStrokeComplete?: (stroke: Stroke) => void
  showGhost?: boolean
  strokeColor?: string
  strokeWidth?: number
  character: string
}

export default function DrawingCanvas({
  width = 300,
  height = 300,
  characterSVG,
  onDrawingComplete,
  onStrokeComplete,
  showGhost = true,
  strokeColor = '#000000',
  strokeWidth = 3,
  character
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<Point[]>([])
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  // Initialize canvas context
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

  // Stop drawing
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
    }

    setCurrentStroke([])
  }, [isDrawing, currentStroke, strokes, onStrokeComplete])

  // Clear canvas
  const clearCanvas = useCallback(() => {
    if (!context) return

    context.clearRect(0, 0, width, height)
    setStrokes([])
    setCurrentStroke([])
    startTimeRef.current = Date.now()
  }, [context, width, height])

  // Undo last stroke
  const undoLastStroke = useCallback(() => {
    if (strokes.length === 0 || !context) return

    const newStrokes = strokes.slice(0, -1)
    setStrokes(newStrokes)

    // Redraw all remaining strokes
    context.clearRect(0, 0, width, height)

    newStrokes.forEach(stroke => {
      if (stroke.points.length < 2) return

      context.beginPath()
      context.moveTo(stroke.points[0].x, stroke.points[0].y)

      stroke.points.slice(1).forEach(point => {
        context.lineTo(point.x, point.y)
      })

      context.stroke()
    })
  }, [strokes, context, width, height])

  // Submit drawing
  const submitDrawing = useCallback(() => {
    const drawingData: DrawingData = {
      strokes,
      character,
      startTime: startTimeRef.current,
      endTime: Date.now()
    }

    if (onDrawingComplete) {
      onDrawingComplete(drawingData)
    }
  }, [strokes, character, onDrawingComplete])

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
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            dangerouslySetInnerHTML={{ __html: characterSVG }}
          />
        )}

        {/* Drawing canvas */}
        <canvas
          ref={canvasRef}
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
      </div>

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

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setStrokes([])}
          disabled={strokes.length === 0}
          className="px-4 py-2 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          Reset
        </motion.button>

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
        Draw the character above using your mouse or finger
      </p>
    </div>
  )
}