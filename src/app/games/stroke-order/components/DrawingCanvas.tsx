'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

interface Point {
  x: number
  y: number
}

interface Props {
  kanji: string
  strokePaths: string[]
  correctStrokes: number[]
  onStrokeComplete: (strokeIndex: number, accuracy: number) => void
  showHint: boolean
  currentStrokeIndex: number
  difficulty: 'easy' | 'medium' | 'hard' | 'expert'
}

export default function DrawingCanvas({
  kanji,
  strokePaths,
  correctStrokes,
  onStrokeComplete,
  showHint,
  currentStrokeIndex,
  difficulty,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentPath, setCurrentPath] = useState<Point[]>([])
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = 320
    canvas.height = 320

    // Configure drawing style
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    setContext(ctx)

    // Draw the background grid
    drawGrid(ctx)

    // Draw completed strokes
    drawCompletedStrokes(ctx)

    // Show hint if needed
    if (showHint && currentStrokeIndex < strokePaths.length) {
      drawHintStroke(ctx, strokePaths[currentStrokeIndex])
    }
  }, [correctStrokes, showHint, currentStrokeIndex, strokePaths])

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = 'rgb(229, 231, 235)'
    ctx.lineWidth = 1

    // Border
    ctx.strokeRect(0, 0, 320, 320)

    // Center lines
    ctx.setLineDash([2, 2])
    ctx.beginPath()
    ctx.moveTo(160, 0)
    ctx.lineTo(160, 320)
    ctx.moveTo(0, 160)
    ctx.lineTo(320, 160)
    ctx.stroke()
    ctx.setLineDash([])
  }

  const drawCompletedStrokes = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = 'rgb(34, 197, 94)'
    ctx.lineWidth = 4

    correctStrokes.forEach(strokeIndex => {
      if (strokeIndex < strokePaths.length) {
        const path = new Path2D(strokePaths[strokeIndex])
        ctx.stroke(path)
      }
    })
  }

  const drawHintStroke = (ctx: CanvasRenderingContext2D, pathData: string) => {
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--palette-primary-500')
    ctx.strokeStyle = primaryColor + '4d' // Add transparency
    ctx.lineWidth = 3
    const path = new Path2D(pathData)
    ctx.stroke(path)
  }

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ('touches' in e) {
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      }
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const point = getCoordinates(e)
    setCurrentPath([point])
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !context) return

    const point = getCoordinates(e)
    setCurrentPath(prev => [...prev, point])

    // Draw the current stroke
    context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--palette-primary-500')
    context.lineWidth = 4
    context.beginPath()

    if (currentPath.length > 0) {
      context.moveTo(currentPath[currentPath.length - 1].x, currentPath[currentPath.length - 1].y)
      context.lineTo(point.x, point.y)
      context.stroke()
    }
  }

  const endDrawing = () => {
    if (!isDrawing || currentPath.length < 2) {
      setIsDrawing(false)
      return
    }

    setIsDrawing(false)

    // Analyze the drawn path and compare to expected stroke
    const accuracy = analyzeStroke(currentPath)

    // Clear the canvas and redraw
    if (context) {
      context.clearRect(0, 0, 320, 320)
      drawGrid(context)
      drawCompletedStrokes(context)
    }

    // Notify parent about stroke completion
    if (accuracy > 0.6) {
      onStrokeComplete(currentStrokeIndex, accuracy)
    }

    setCurrentPath([])
  }

  const analyzeStroke = (drawnPath: Point[]): number => {
    // This is a simplified stroke analysis
    // In a real implementation, you'd compare the drawn path with the expected stroke path
    // For now, return a random accuracy for demonstration
    return 0.7 + Math.random() * 0.3
  }

  return (
    <div className="relative w-80 h-80 mx-auto">
      <canvas
        ref={canvasRef}
        className="border border-gray-300 rounded-lg cursor-crosshair touch-none"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={endDrawing}
      />

      {difficulty === 'easy' && (
        <div className="absolute top-2 left-2 text-xs text-muted-foreground">
          Stroke {currentStrokeIndex + 1} of {strokePaths.length}
        </div>
      )}

      {showHint && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-2 right-2 text-xs text-primary-500 font-medium"
        >
          Hint shown
        </motion.div>
      )}
    </div>
  )
}